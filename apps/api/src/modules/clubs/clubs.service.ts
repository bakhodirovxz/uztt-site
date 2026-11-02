import { TelegramService } from '../showcase/telegram.service';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { normalizeRegion } from '../../common/regions';

export interface ClubInput {
  name: string;
  clubType?: string;
  regionName?: string;
  districtName?: string;
  address?: string;
  phoneNumber?: string;
  coachName?: string;
  managerName?: string;
  tableCount?: number;
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/['ʻʼ`’‘]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'klub';

/**
 * Ommaviy (autentifikatsiyasiz) klub maydonlari. phoneNumber / address / districtName ATAYLAB YO'Q:
 * uttf.uz dan import qilingan klublarda bu murabbiy yoki rahbarning SHAXSIY mobil raqami va manzili.
 * Ular faqat egasi (`mine`) va admin (`pending`) javoblarida. public-selects.spec.ts tekshiradi.
 */
export const PUBLIC_CLUB_SELECT = {
  id: true,
  slug: true,
  name: true,
  clubType: true,
  regionName: true,
  tableCount: true,
  logoUrl: true,
  _count: { select: { players: true } },
} as const;

@Injectable()
export class ClubsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly telegram: TelegramService,
  ) {}

  /** Ommaviy ro'yxat: faqat ACTIVE */
  async list(q?: string, region?: string, page = 1, pageSize = 24) {
    const where = {
      status: 'ACTIVE' as const,
      ...(q ? { name: { contains: q.slice(0, 80), mode: 'insensitive' as const } } : {}),
      ...(region ? { regionName: normalizeRegion(region) } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.club.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (Math.max(1, page) - 1) * pageSize,
        take: pageSize,
        select: PUBLIC_CLUB_SELECT,
      }),
      this.prisma.club.count({ where }),
    ]);
    return { rows, total, page, pageSize };
  }

  async detail(idOrSlug: string) {
    const club = await this.prisma.club.findFirst({
      where: { status: 'ACTIVE', OR: [{ id: idOrSlug.match(/^[0-9a-f-]{36}$/i) ? idOrSlug : undefined }, { slug: idOrSlug }] },
      select: {
        ...PUBLIC_CLUB_SELECT,
        players: {
          where: { status: 'ACTIVE' },
          orderBy: { rankingPoints: 'desc' },
          take: 12,
          select: { id: true, slug: true, firstName: true, lastName: true, rankingPoints: true, photoUrl: true },
        },
        coaches: {
          where: { status: 'APPROVED' },
          select: { id: true },
        },
      },
    });
    if (!club) throw new NotFoundException('Klub topilmadi');
    return { ...club, coachCount: club.coaches.length, coaches: undefined };
  }

  private async uniqueSlug(name: string) {
    let slug = slugify(name);
    if (await this.prisma.club.findUnique({ where: { slug }, select: { id: true } })) {
      slug = `${slug}-${randomUUID().slice(0, 6)}`;
    }
    return slug;
  }

  private async assertNameFree(name: string, exceptId?: string) {
    const dup = await this.prisma.club.findFirst({
      where: {
        name: { equals: name.trim(), mode: 'insensitive' },
        status: { not: 'REJECTED' },
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
      select: { id: true },
    });
    if (dup) throw new ConflictException('Bu nomdagi klub allaqachon mavjud (yoki ko‘rib chiqilmoqda)');
  }

  private data(d: ClubInput) {
    return {
      name: d.name.trim(),
      clubType: d.clubType,
      regionName: d.regionName ? normalizeRegion(d.regionName) : undefined,
      districtName: d.districtName,
      address: d.address,
      phoneNumber: d.phoneNumber,
      coachName: d.coachName,
      managerName: d.managerName,
      tableCount: d.tableCount,
    };
  }

  /** Klub ochish arizasi (tasdiqlangan murabbiy): PENDING — admin tasdiqlamaguncha ommaviy ro'yxatda yo'q */
  async request(userId: string, d: ClubInput) {
    await this.assertNameFree(d.name);
    const pendingMine = await this.prisma.club.count({ where: { ownerUserId: userId, status: 'PENDING' } });
    if (pendingMine >= 3) throw new BadRequestException("Ko'rib chiqilayotgan arizalar ko'p (3 tagacha)");
    const club = await this.prisma.club.create({
      data: { ...this.data(d), slug: await this.uniqueSlug(d.name), status: 'PENDING', ownerUserId: userId },
      select: { id: true, slug: true, name: true, status: true },
    });
    this.telegram.announce('admin', `🆕 Klub ochish so'rovi: ${club.name}\nKo'rib chiqish: ${this.telegram.siteUrl()}/panel/applications`);
    return club;
  }

  async mine(userId: string) {
    return this.prisma.club.findMany({
      where: { ownerUserId: userId },
      orderBy: { createdAt: 'desc' },
      // Egasining o'z klublari — aloqa maydonlari shu yerda ko'rinadi (ommaviy javobda yo'q)
      select: {
        id: true, slug: true, name: true, status: true, rejectReason: true, regionName: true,
        districtName: true, address: true, phoneNumber: true, tableCount: true, managerName: true, coachName: true,
      },
    });
  }

  /** Admin: to'g'ridan-to'g'ri ACTIVE klub */
  async create(d: ClubInput) {
    await this.assertNameFree(d.name);
    return this.prisma.club.create({
      data: { ...this.data(d), slug: await this.uniqueSlug(d.name), status: 'ACTIVE' },
      select: { id: true, slug: true, name: true, status: true },
    });
  }

  /** Tahrirlash: admin (club.manage) yoki klub egasi (faqat aloqa maydonlari) */
  async update(id: string, d: Partial<ClubInput>, user: { id: string; permissions: string[] }) {
    const club = await this.prisma.club.findUnique({ where: { id }, select: { id: true, ownerUserId: true, status: true } });
    if (!club) throw new NotFoundException('Klub topilmadi');
    const admin = user.permissions.includes('club.manage');
    if (!admin) {
      if (club.ownerUserId !== user.id || club.status === 'REJECTED') throw new ForbiddenException('Bu klubni tahrirlash huquqi yo‘q');
      // egasi nomni va hududni o'zgartira olmaydi — faqat aloqa/manzil/stol soni
      d = { address: d.address, phoneNumber: d.phoneNumber, tableCount: d.tableCount, managerName: d.managerName, coachName: d.coachName };
    } else if (d.name) {
      // o'z nomini qayta yuborish xato emas — klubning o'zi hisobga olinmaydi
      await this.assertNameFree(d.name, id);
    }
    const patch = Object.fromEntries(Object.entries(this.data({ name: d.name ?? '', ...d })).filter(([k, v]) => v !== undefined && !(k === 'name' && !d.name)));
    return this.prisma.club.update({ where: { id }, data: patch, select: { id: true, slug: true, name: true, status: true } });
  }

  pending() {
    return this.prisma.club.findMany({ where: { status: 'PENDING' }, orderBy: { createdAt: 'asc' }, take: 200 });
  }

  async review(id: string, decision: 'APPROVE' | 'REJECT', reason?: string) {
    if (decision === 'REJECT' && !reason?.trim()) throw new BadRequestException('Rad etish sababi majburiy');
    // Shartli (status = PENDING): ikki admin bir vaqtda bossa faqat bittasi o'tadi
    const { count } = await this.prisma.club.updateMany({
      where: { id, status: 'PENDING' },
      data: {
        status: decision === 'APPROVE' ? 'ACTIVE' : 'REJECTED',
        rejectReason: decision === 'REJECT' ? reason!.trim() : null,
        reviewedAt: new Date(),
      },
    });
    if (count !== 1) {
      const club = await this.prisma.club.findUnique({ where: { id }, select: { id: true } });
      if (!club) throw new NotFoundException('Klub topilmadi');
      throw new ConflictException('Ariza allaqachon ko‘rib chiqilgan');
    }
    return this.prisma.club.findUniqueOrThrow({ where: { id }, select: { id: true, name: true, status: true } });
  }
}
