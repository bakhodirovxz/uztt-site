import { TelegramService } from '../showcase/telegram.service';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { checkPassword } from '../../common/password-policy';
import * as argon2 from 'argon2';
import type { ApplicationStatus, RefereeCategory } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { normalizeRegion } from '../../common/regions';

export interface BaseApplicant {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  region?: string;
}

/**
 * Hakam va murabbiy uchun OMMAVIY ariza.
 * Xavfsizlik: ariza beruvchi akkaunti HECH QANDAY rolsiz yaratiladi — admin tasdiqlamaguncha
 * hech qanday huquq (hisob kiritish, o'yinchi yozish) berilmaydi. Tasdiqlash — alohida huquq (applicant.review).
 */
@Injectable()
export class ApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly telegram: TelegramService,
  ) {}

  private async createUser(d: BaseApplicant) {
    const email = d.email.toLowerCase().trim();
    if (d.password.toLowerCase().includes(email.split('@')[0]) && email.split('@')[0].length >= 4) {
      throw new BadRequestException("Parol email'ingizni o'z ichiga olmasligi kerak");
    }
    const exists = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (exists) throw new ConflictException('Bu email allaqachon band');
    const policyError = checkPassword(d.password, { email, names: [d.firstName, d.lastName] });
    if (policyError) throw new BadRequestException(policyError);
    const passwordHash = await argon2.hash(d.password, { type: argon2.argon2id });
    return { email, passwordHash };
  }

  async applyReferee(
    d: BaseApplicant & {
      category?: RefereeCategory;
      certification?: string;
      since?: number;
      bio?: string;
    },
  ) {
    const { email, passwordHash } = await this.createUser(d);
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName: d.firstName.trim(),
        lastName: d.lastName.trim(),
        // ROL BERILMAYDI — faqat tasdiqlangandan keyin REFEREE
        refereeProfile: {
          create: {
            status: 'PENDING',
            category: d.category,
            certification: d.certification,
            since: d.since,
            phone: d.phone,
            region: d.region ? normalizeRegion(d.region) : undefined,
            bio: d.bio,
            available: false, // tasdiqlanmaguncha tayinlanmaydi
          },
        },
      },
      select: { id: true },
    });
    this.telegram.announce('admin', `🆕 Yangi hakam arizasi: ${d.lastName.trim()} ${d.firstName.trim()}${d.region ? ` (${d.region})` : ''}\nKo'rib chiqish: ${this.telegram.siteUrl()}/panel/applications`);
    return { userId: user.id, status: 'PENDING' as const };
  }

  async applyCoach(d: BaseApplicant & { clubId?: string; licenseNumber?: string; bio?: string }) {
    const { email, passwordHash } = await this.createUser(d);
    let clubId: string | undefined;
    if (d.clubId) {
      const club = await this.prisma.club.findFirst({ where: { id: d.clubId, status: 'ACTIVE' }, select: { id: true } });
      if (!club) throw new BadRequestException('Klub topilmadi yoki faol emas');
      clubId = club.id;
    }
    const user = await this.prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: { email, passwordHash, firstName: d.firstName.trim(), lastName: d.lastName.trim() },
        select: { id: true },
      });
      await tx.coachProfile.create({
        data: {
          userId: u.id,
          status: 'PENDING',
          phone: d.phone,
          region: d.region ? normalizeRegion(d.region) : undefined,
          clubId,
          licenseNumber: d.licenseNumber,
          bio: d.bio,
        },
      });
      return u;
    });
    this.telegram.announce('admin', `🆕 Yangi murabbiy arizasi: ${d.lastName.trim()} ${d.firstName.trim()}${d.region ? ` (${d.region})` : ''}\nKo'rib chiqish: ${this.telegram.siteUrl()}/panel/applications`);
    return { userId: user.id, status: 'PENDING' as const };
  }

  /** Ko'rib chiquvchi uchun ro'yxat (parol hash HECH QACHON chiqmaydi) */
  async list(type: 'referee' | 'coach', status?: ApplicationStatus) {
    if (type === 'referee') {
      return this.prisma.refereeProfile.findMany({
        where: status ? { status } : {},
        orderBy: { createdAt: 'desc' },
        take: 200,
        select: {
          id: true, userId: true, status: true, category: true, certification: true, since: true,
          phone: true, region: true, bio: true, available: true, rejectReason: true, createdAt: true, reviewedAt: true,
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      });
    }
    const rows = await this.prisma.coachProfile.findMany({
      where: status ? { status } : {},
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true, userId: true, status: true, phone: true, region: true, licenseNumber: true, bio: true,
        clubRecord: { select: { id: true, name: true } }, rejectReason: true, createdAt: true, reviewedAt: true,
      },
    });
    // CoachProfile'da User relation yo'q — ismlarni bitta so'rov bilan olamiz (N+1 emas)
    const users = await this.prisma.user.findMany({
      where: { id: { in: rows.map((r) => r.userId) } },
      select: { id: true, firstName: true, lastName: true, email: true },
    });
    const byId = new Map(users.map((u) => [u.id, u]));
    return rows.map((r) => ({ ...r, user: byId.get(r.userId) ?? null }));
  }

  /** Tasdiqlash → rol beriladi; rad etish → sabab majburiy. Faqat PENDING ko'rib chiqiladi. */
  async review(
    type: 'referee' | 'coach',
    userId: string,
    decision: 'APPROVE' | 'REJECT',
    reviewerId: string,
    reason?: string,
  ) {
    if (decision === 'REJECT' && !reason?.trim()) throw new BadRequestException('Rad etish sababi majburiy');
    const roleCode = type === 'referee' ? 'REFEREE' : 'COACH';
    const role = await this.prisma.role.findUnique({ where: { code: roleCode } });
    if (!role) throw new NotFoundException(`${roleCode} roli topilmadi`);

    const profile =
      type === 'referee'
        ? await this.prisma.refereeProfile.findUnique({ where: { userId }, select: { status: true } })
        : await this.prisma.coachProfile.findUnique({ where: { userId }, select: { status: true } });
    if (!profile) throw new NotFoundException('Ariza topilmadi');
    if (profile.status !== 'PENDING') throw new ConflictException('Ariza allaqachon ko‘rib chiqilgan');

    const approved = decision === 'APPROVE';
    const data = {
      status: (approved ? 'APPROVED' : 'REJECTED') as ApplicationStatus,
      rejectReason: approved ? null : reason!.trim(),
      reviewedById: reviewerId,
      reviewedAt: new Date(),
    };
    await this.prisma.$transaction(async (tx) => {
      if (type === 'referee') {
        await tx.refereeProfile.update({ where: { userId }, data: { ...data, available: approved } });
      } else {
        await tx.coachProfile.update({ where: { userId }, data });
      }
      if (approved) {
        await tx.userRole.upsert({
          where: { userId_roleId: { userId, roleId: role.id } },
          update: {},
          create: { userId, roleId: role.id },
        });
      }
    });
    return { userId, status: data.status };
  }

  /** Ariza beruvchining o'z holati */
  async mine(userId: string) {
    const [referee, coach] = await Promise.all([
      this.prisma.refereeProfile.findUnique({ where: { userId }, select: { status: true, rejectReason: true, category: true } }),
      this.prisma.coachProfile.findUnique({ where: { userId }, select: { status: true, rejectReason: true } }),
    ]);
    return { referee, coach };
  }
}
