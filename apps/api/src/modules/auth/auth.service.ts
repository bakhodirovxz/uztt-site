import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { checkPassword, isPrivileged } from '../../common/password-policy';
import { CryptoService } from '../../common/crypto/crypto.service';
import type {
  AccessTokenPayload,
  AuthUser,
  RefreshTokenPayload,
} from '../../common/types/auth-user';

/** Ketma-ket 8 ta xato parol → 15 daqiqa blok */
export const MAX_FAILED_LOGINS = 8;
export const LOCK_MINUTES = 15;

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
}

export interface ClientMeta {
  userAgent?: string;
  ip?: string;
}

@Injectable()
export class AuthService {
  private readonly refreshSecret: string;
  private readonly accessTtl: NonNullable<JwtSignOptions['expiresIn']>;
  private readonly refreshTtl: NonNullable<JwtSignOptions['expiresIn']>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly crypto: CryptoService,
    config: ConfigService,
  ) {
    this.refreshSecret = config.getOrThrow('JWT_REFRESH_SECRET');
    this.accessTtl = config.get('JWT_ACCESS_TTL') ?? '15m';
    this.refreshTtl = config.get('JWT_REFRESH_TTL') ?? '30d';
  }

  /** Email+parol bilan kirish. Muvaffaqiyatda yangi token juftligi qaytadi. */
  async login(
    email: string,
    password: string,
    meta: ClientMeta,
  ): Promise<{ user: AuthUser; tokens: TokenPair }> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: this.rolesInclude(),
    });

    // Vaqt farqi orqali email mavjudligini bilib bo'lmasligi uchun —
    // user topilmasa ham dummy hash tekshiramiz.
    const hash =
      user?.passwordHash ??
      '$argon2id$v=19$m=65536,t=3,p=4$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    const valid = await argon2.verify(hash, password).catch(() => false);

    // Hisob bloklangan bo'lsa to'g'ri parol ham o'tmaydi; xabar bir xil (email mavjudligi oshkor bo'lmasin)
    const locked = !!user?.lockedUntil && user.lockedUntil > new Date();
    if (!user || !valid || locked || user.status !== 'ACTIVE') {
      if (user && !valid && !locked) {
        const count = user.failedLoginCount + 1;
        await this.prisma.user.update({
          where: { id: user.id },
          data: count >= MAX_FAILED_LOGINS
            ? { failedLoginCount: 0, lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60_000) }
            : { failedLoginCount: count },
        });
      }
      throw new UnauthorizedException('Email yoki parol noto‘g‘ri (yoki hisob vaqtincha bloklangan)');
    }
    if (user.failedLoginCount > 0 || user.lockedUntil) {
      await this.prisma.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null } });
    }

    const authUser = this.toAuthUser(user);
    const tokens = await this.issueTokens(authUser, randomUUID(), meta);
    return { user: authUser, tokens };
  }

  /**
   * Refresh rotation: eski refresh token bir marta ishlatiladi.
   * Agar allaqachon ishlatilgan (replaced/revoked) token kelsa — o'g'irlik
   * belgisi: butun oila bekor qilinadi.
   */
  async refresh(
    rawToken: string,
    meta: ClientMeta,
  ): Promise<{ user: AuthUser; tokens: TokenPair }> {
    let payload: RefreshTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<RefreshTokenPayload>(rawToken, {
        secret: this.refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Sessiya muddati tugagan');
    }

    const tokenHash = this.crypto.sha256(rawToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (!stored || stored.revokedAt || stored.replacedById) {
      // Reuse detection: bu token allaqachon aylantirilgan yoki bekor qilingan.
      // Butun oilani o'chirib tashlaymiz — o'g'irlangan bo'lishi mumkin.
      await this.prisma.refreshToken.updateMany({
        where: { familyId: payload.fam, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Sessiya bekor qilindi, qayta kiring');
    }

    if (stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Sessiya muddati tugagan');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: stored.userId },
      include: this.rolesInclude(),
    });
    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Hisob faol emas');
    }

    const authUser = this.toAuthUser(user);
    const tokens = await this.issueTokens(
      authUser,
      stored.familyId,
      meta,
      stored.id,
    );
    return { user: authUser, tokens };
  }

  /** Chiqish: joriy refresh token oilasini bekor qilish */
  async logout(rawToken: string | undefined): Promise<void> {
    if (!rawToken) return;
    try {
      const payload = await this.jwt.verifyAsync<RefreshTokenPayload>(
        rawToken,
        { secret: this.refreshSecret },
      );
      await this.prisma.refreshToken.updateMany({
        where: { familyId: payload.fam, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    } catch {
      // token yaroqsiz bo'lsa ham logout muvaffaqiyatli hisoblanadi
    }
  }

  /**
   * Parolni almashtirish: joriy parol tekshiriladi, barcha boshqa sessiyalar bekor qilinadi,
   * `mustChangePassword` o'chadi va yangi token juftligi beriladi.
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    meta: ClientMeta,
  ): Promise<{ user: AuthUser; tokens: TokenPair }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.status !== 'ACTIVE') throw new UnauthorizedException();
    const ok = await argon2.verify(user.passwordHash, currentPassword).catch(() => false);
    if (!ok) throw new UnauthorizedException('Joriy parol noto‘g‘ri');
    if (currentPassword === newPassword) {
      throw new BadRequestException('Yangi parol joriyidan farq qilishi kerak');
    }
    const roleRows = await this.prisma.userRole.findMany({ where: { userId }, select: { role: { select: { code: true } } } });
    const policyError = checkPassword(newPassword, {
      privileged: isPrivileged(roleRows.map((r) => r.role.code)),
      email: user.email,
      names: [user.firstName, user.lastName],
    });
    if (policyError) throw new BadRequestException(policyError);
    const passwordHash = await argon2.hash(newPassword, { type: argon2.argon2id });
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { passwordHash, mustChangePassword: false } }),
      this.prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
    const fresh = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, include: this.rolesInclude() });
    const authUser = this.toAuthUser(fresh);
    const tokens = await this.issueTokens(authUser, randomUUID(), meta);
    return { user: authUser, tokens };
  }

  /** Sessiya bormi? Faqat ha/yo'q — hech qanday shaxsiy ma'lumot qaytmaydi (sarlavha uchun, 401 shovqinisiz). */
  async hasSession(accessToken: string | undefined): Promise<boolean> {
    if (!accessToken) return false;
    try {
      await this.jwt.verifyAsync(accessToken, { issuer: 'uztt-api', audience: 'uztt-web' });
      return true;
    } catch {
      return false;
    }
  }

  /** Joriy user ma'lumotini bazadan yangilab qaytaradi (permissionlar yangi holatda) */
  async me(userId: string): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: this.rolesInclude(),
    });
    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException();
    }
    return this.toAuthUser(user);
  }

  // ==================== ichki yordamchilar ====================

  private rolesInclude() {
    return {
      roles: {
        include: {
          role: {
            include: {
              permissions: { include: { permission: true } },
            },
          },
        },
      },
    } as const;
  }

  private toAuthUser(user: {
    id: string;
    email: string;
    mustChangePassword?: boolean;
    roles: {
      role: {
        code: string;
        permissions: { permission: { code: string } }[];
      };
    }[];
  }): AuthUser {
    const roles = user.roles.map((r) => r.role.code);
    const permissions = [
      ...new Set(
        user.roles.flatMap((r) =>
          r.role.permissions.map((p) => p.permission.code),
        ),
      ),
    ];
    return {
      id: user.id,
      email: user.email,
      roles,
      permissions,
      ...(user.mustChangePassword ? { mustChangePassword: true } : {}),
    };
  }

  private async issueTokens(
    user: AuthUser,
    familyId: string,
    meta: ClientMeta,
    replacesId?: string,
  ): Promise<TokenPair> {
    const accessPayload: AccessTokenPayload = {
      sub: user.id,
      email: user.email,
      roles: user.roles,
      permissions: user.permissions,
      ...(user.mustChangePassword ? { mcp: true } : {}),
    };
    const accessToken = await this.jwt.signAsync(accessPayload, {
      expiresIn: this.accessTtl,
    });

    const jti = randomUUID();
    const refreshPayload: RefreshTokenPayload = {
      sub: user.id,
      jti,
      fam: familyId,
    };
    const refreshToken = await this.jwt.signAsync(refreshPayload, {
      secret: this.refreshSecret,
      expiresIn: this.refreshTtl,
    });

    const refreshExpiresAt = this.ttlToDate(this.refreshTtl);
    const newRow = await this.prisma.refreshToken.create({
      data: {
        id: jti,
        userId: user.id,
        tokenHash: this.crypto.sha256(refreshToken),
        familyId,
        userAgent: meta.userAgent?.slice(0, 250),
        ip: meta.ip,
        expiresAt: refreshExpiresAt,
      },
    });

    if (replacesId) {
      await this.prisma.refreshToken.update({
        where: { id: replacesId },
        data: { replacedById: newRow.id, revokedAt: new Date() },
      });
    }

    return { accessToken, refreshToken, refreshExpiresAt };
  }

  private ttlToDate(ttl: string | number): Date {
    if (typeof ttl === 'number') return new Date(Date.now() + ttl * 1000);
    const m = /^(\d+)([smhd])$/.exec(ttl);
    if (!m) return new Date(Date.now() + 30 * 24 * 3600 * 1000);
    const n = Number(m[1]);
    const mult = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[
      m[2] as 's' | 'm' | 'h' | 'd'
    ];
    return new Date(Date.now() + n * mult);
  }
}
