import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { CryptoService } from '../../common/crypto/crypto.service';
import type {
  AccessTokenPayload,
  AuthUser,
  RefreshTokenPayload,
} from '../../common/types/auth-user';

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

    if (!user || !valid || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Email yoki parol noto‘g‘ri');
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
    return { id: user.id, email: user.email, roles, permissions };
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
