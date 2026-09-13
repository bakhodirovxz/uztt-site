import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Gender, PlayerDocumentType } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomUUID } from 'crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { PrismaService } from '../../prisma/prisma.service';
import { CryptoService } from '../../common/crypto/crypto.service';
import {
  declaredFilter,
  defaultCategory,
  eligibleCategories,
  matchesGroup,
} from './eligibility';

// Pasport fayllari: shifrlangan holda, nginx orqali HECH QACHON serve qilinmaydi
const PRIVATE_DIR = join(process.cwd(), 'uploads', 'private');

@Injectable()
export class RegistrationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  /** O'yinchi self-signup: USER akkaunt + PLAYER rol + PENDING profil */
  async signup(data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    gender: Gender;
    birthDate: string;
    region: string;
    club?: string;
    /** O'yinchi o'zi tanlagan yosh toifalari (kodlar): U13, U15, SENIOR ... */
    ageCategoryCodes?: string[];
  }) {
    const email = data.email.toLowerCase().trim();
    const exists = await this.prisma.user.findUnique({ where: { email } });
    if (exists) throw new ConflictException('Bu email allaqachon band');

    const passwordHash = await argon2.hash(data.password, {
      type: argon2.argon2id,
    });
    const playerRole = await this.prisma.role.findUnique({
      where: { code: 'PLAYER' },
    });

    // Tanlangan yosh toifalari yoshga muvofiqmi — server tomonda tekshiriladi
    const birthDate = new Date(data.birthDate);
    const declared = await this.resolveDeclaredCategories(
      birthDate,
      data.ageCategoryCodes ?? [],
    );

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
          firstName: data.firstName,
          lastName: data.lastName,
          ...(playerRole && {
            roles: { create: [{ roleId: playerRole.id }] },
          }),
        },
      });
      const slug =
        `${data.firstName}-${data.lastName}-${randomUUID().slice(0, 6)}`
          .toLowerCase()
          .replace(/['ʻʼ`’]/g, '')
          .replace(/[^a-z0-9-]+/g, '-');
      const player = await tx.player.create({
        data: {
          slug,
          firstName: data.firstName,
          lastName: data.lastName,
          gender: data.gender,
          birthDate,
          region: data.region,
          club: data.club,
          status: 'PENDING_VERIFICATION', // admin litsenziya berib tasdiqlaydi
          userId: user.id,
          declaredCategories: {
            create: declared.map((c) => ({ ageCategoryId: c.id })),
          },
        },
      });
      return {
        userId: user.id,
        playerId: player.id,
        status: player.status,
        ageCategories: declared.map((c) => c.code),
      };
    });
  }

  /**
   * Tanlangan yosh toifalarini tekshirib qaytaradi.
   * Bo'sh bo'lsa — yoshga muvofiq barcha toifalar avtomatik belgilanadi.
   */
  private async resolveDeclaredCategories(birthDate: Date, codes: string[]) {
    const all = await this.prisma.ageCategory.findMany({
      orderBy: { sortOrder: 'asc' },
    });
    const year = new Date().getFullYear();
    const eligible = eligibleCategories(birthDate, year, all);
    if (codes.length === 0) return eligible;

    const chosen = eligible.filter((c) => codes.includes(c.code));
    const invalid = codes.filter((c) => !chosen.some((e) => e.code === c));
    if (invalid.length > 0) {
      throw new BadRequestException(
        `Yoshingizga muvofiq bo'lmagan toifa(lar): ${invalid.join(', ')}`,
      );
    }
    return chosen;
  }

  /** Admin/operator: o'yinchining yosh toifalarini tuzatish */
  async setDeclaredCategories(playerId: string, codes: string[]) {
    const player = await this.prisma.player.findUnique({
      where: { id: playerId },
    });
    if (!player) throw new NotFoundException("O'yinchi topilmadi");
    if (!player.birthDate) {
      throw new BadRequestException("Tug'ilgan sana kiritilmagan");
    }
    const declared = await this.resolveDeclaredCategories(
      player.birthDate,
      codes,
    );
    await this.prisma.$transaction([
      this.prisma.playerAgeCategory.deleteMany({ where: { playerId } }),
      this.prisma.playerAgeCategory.createMany({
        data: declared.map((c) => ({ playerId, ageCategoryId: c.id })),
      }),
    ]);
    return { playerId, ageCategories: declared.map((c) => c.code) };
  }

  /** Joriy userning o'yinchi profili */
  async myPlayer(userId: string) {
    const player = await this.prisma.player.findUnique({
      where: { userId },
      include: {
        ageCategory: { select: { code: true, name: true } },
        declaredCategories: {
          include: { ageCategory: { select: { code: true, name: true } } },
        },
        registrations: {
          include: {
            partner: { select: { firstName: true, lastName: true } },
            category: {
              include: {
                ageCategory: { select: { code: true, name: true } },
                tournament: {
                  select: { slug: true, name: true, startDate: true },
                },
              },
            },
          },
        },
        documents: {
          select: { id: true, type: true, expiryDate: true, createdAt: true },
        },
      },
    });
    if (!player) throw new NotFoundException("O'yinchi profili topilmadi");
    return player;
  }

  /**
   * Muvofiq kategoriyalar: yosh (tug'ilgan sana) + jins/guruh +
   * o'yinchi ro'yxatdan o'tishda tanlagan toifalar kesishmasi.
   */
  async eligibleCategoriesFor(userId: string, tournamentId: string) {
    const player = await this.prisma.player.findUnique({
      where: { userId },
      include: { declaredCategories: { include: { ageCategory: true } } },
    });
    if (!player) throw new NotFoundException("O'yinchi profili topilmadi");
    if (!player.birthDate) {
      throw new BadRequestException("Tug'ilgan sana kiritilmagan");
    }

    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: { categories: { include: { ageCategory: true } } },
    });
    if (!tournament) throw new NotFoundException('Musobaqa topilmadi');

    const year = tournament.startDate.getFullYear();
    // Jins/guruh filtri: null gender = aralash yoki ochiq guruh
    const genderCats = tournament.categories.filter((c) =>
      matchesGroup(player.gender, c.gender),
    );
    const catLikes = genderCats.map((c) => ({
      id: c.id,
      code: c.ageCategory.code,
      maxAge: c.ageCategory.maxAge,
      sortOrder: c.ageCategory.sortOrder,
      name: c.ageCategory.name,
      gender: c.gender,
      eventType: c.eventType,
      maxEntries: c.maxEntries,
      registrationDeadline: c.registrationDeadline,
    }));
    const declaredCodes = player.declaredCategories.map(
      (d) => d.ageCategory.code,
    );
    const byAge = eligibleCategories(player.birthDate, year, catLikes);
    const eligible = declaredFilter(byAge, declaredCodes);
    // Default — o'z yosh guruhidagi YAKKA razryad (juftlik sherik talab qiladi)
    const def = defaultCategory(
      player.birthDate,
      year,
      eligible.filter((c) => c.eventType === 'SINGLES'),
    );
    return {
      declaredCategories: declaredCodes,
      eligible: eligible.map((c) => ({ ...c, isDefault: c.id === def?.id })),
    };
  }

  /** Turnirga yozilish — muvofiqlik SERVER tomonda qayta tekshiriladi */
  async register(
    userId: string,
    tournamentId: string,
    categoryId?: string,
    extra?: { partnerPlayerId?: string; teamName?: string },
  ) {
    const player = await this.prisma.player.findUnique({ where: { userId } });
    if (!player) throw new NotFoundException("O'yinchi profili topilmadi");
    if (player.status !== 'ACTIVE') {
      throw new ForbiddenException(
        'Profil hali tasdiqlanmagan — administrator tasdig‘ini kuting',
      );
    }

    const { eligible } = await this.eligibleCategoriesFor(userId, tournamentId);
    const target = categoryId
      ? eligible.find((c) => c.id === categoryId)
      : eligible.find((c) => c.isDefault);
    if (!target) {
      // noto'g'ri kategoriya/guruh — 403 (gate testi talabi)
      throw new ForbiddenException(
        'Bu guruh yoshingizga yoki jinsingizga muvofiq emas',
      );
    }
    if (
      target.registrationDeadline &&
      target.registrationDeadline < new Date()
    ) {
      throw new BadRequestException('Ro‘yxatdan o‘tish muddati tugagan');
    }

    await this.assertGroupRequirements(
      target.eventType,
      player.id,
      player.gender,
      extra,
    );

    const existing = await this.prisma.tournamentRegistration.findUnique({
      where: {
        playerId_tournamentCategoryId: {
          playerId: player.id,
          tournamentCategoryId: target.id,
        },
      },
    });
    if (existing) throw new ConflictException('Allaqachon yozilgansiz');

    // Guruhga aloqasi yo'q maydonlar saqlanmaydi (yakka razryadda sherik bo'lmaydi)
    const isDoubles =
      target.eventType === 'DOUBLES' || target.eventType === 'MIXED_DOUBLES';
    return this.prisma.tournamentRegistration.create({
      data: {
        playerId: player.id,
        tournamentCategoryId: target.id,
        source: 'SELF',
        partnerPlayerId: isDoubles ? extra?.partnerPlayerId : null,
        teamName: target.eventType === 'TEAM' ? extra?.teamName : null,
      },
      include: {
        category: { include: { ageCategory: { select: { code: true } } } },
      },
    });
  }

  /**
   * Guruh talablari: juftlikda sherik, aralash juftlikda qarama-qarshi jinsdagi
   * sherik, jamoaviyda jamoa nomi bo'lishi shart.
   */
  private async assertGroupRequirements(
    eventType: string,
    playerId: string,
    playerGender: Gender,
    extra?: { partnerPlayerId?: string; teamName?: string },
  ) {
    if (eventType === 'SINGLES') return;

    if (eventType === 'TEAM') {
      if (!extra?.teamName?.trim()) {
        throw new BadRequestException('Jamoaviy guruh uchun jamoa nomi kerak');
      }
      return;
    }

    // DOUBLES / MIXED_DOUBLES
    if (!extra?.partnerPlayerId) {
      throw new BadRequestException('Juftlik uchun sherik tanlang');
    }
    if (extra.partnerPlayerId === playerId) {
      throw new BadRequestException("O'zingizni sherik qilib bo'lmaydi");
    }
    const partner = await this.prisma.player.findUnique({
      where: { id: extra.partnerPlayerId },
    });
    if (!partner) throw new NotFoundException('Sherik topilmadi');
    if (partner.status !== 'ACTIVE') {
      throw new BadRequestException('Sherik profili tasdiqlanmagan');
    }
    if (eventType === 'MIXED_DOUBLES' && partner.gender === playerGender) {
      throw new BadRequestException(
        'Aralash juftlikda sherik qarama-qarshi jinsda bo‘lishi kerak',
      );
    }
    if (eventType === 'DOUBLES' && partner.gender !== playerGender) {
      throw new BadRequestException(
        'Juftlikda sherik bir xil jinsda bo‘lishi kerak',
      );
    }
  }

  /**
   * Operator/admin qatnashchi qo'shadi (o'yinchi o'zi yozilmagan bo'lsa ham).
   * Yosh/jins muvofiqligi baribir tekshiriladi.
   */
  async addParticipant(
    categoryId: string,
    playerId: string,
    actorUserId: string,
    extra?: { partnerPlayerId?: string; teamName?: string },
  ) {
    const category = await this.prisma.tournamentCategory.findUnique({
      where: { id: categoryId },
      include: { ageCategory: true, tournament: true },
    });
    if (!category) throw new NotFoundException('Kategoriya topilmadi');

    const player = await this.prisma.player.findUnique({
      where: { id: playerId },
      include: { declaredCategories: { include: { ageCategory: true } } },
    });
    if (!player) throw new NotFoundException("O'yinchi topilmadi");
    if (player.status !== 'ACTIVE') {
      throw new ForbiddenException("O'yinchi profili hali tasdiqlanmagan");
    }
    if (!player.birthDate) {
      throw new BadRequestException("O'yinchining tug'ilgan sanasi yo'q");
    }
    if (!matchesGroup(player.gender, category.gender)) {
      throw new ForbiddenException('Bu guruh o‘yinchining jinsiga mos emas');
    }
    const year = category.tournament.startDate.getFullYear();
    const ok = eligibleCategories(player.birthDate, year, [
      {
        id: category.id,
        code: category.ageCategory.code,
        maxAge: category.ageCategory.maxAge,
        sortOrder: category.ageCategory.sortOrder,
      },
    ]);
    if (ok.length === 0) {
      throw new ForbiddenException('Yosh toifasi o‘yinchiga mos emas');
    }
    await this.assertGroupRequirements(
      category.eventType,
      player.id,
      player.gender,
      extra,
    );

    const existing = await this.prisma.tournamentRegistration.findUnique({
      where: {
        playerId_tournamentCategoryId: {
          playerId,
          tournamentCategoryId: categoryId,
        },
      },
    });
    if (existing)
      throw new ConflictException('Bu o‘yinchi allaqachon yozilgan');

    return this.prisma.tournamentRegistration.create({
      data: {
        playerId,
        tournamentCategoryId: categoryId,
        source: 'ADMIN',
        status: 'CONFIRMED', // operator qo'shgan ariza darhol tasdiqlangan
        partnerPlayerId: extra?.partnerPlayerId,
        teamName: extra?.teamName,
        statusChangedById: actorUserId,
        statusChangedAt: new Date(),
      },
      include: { player: { select: { firstName: true, lastName: true } } },
    });
  }

  // ==================== PASPORT HUJJATLARI (AES-256) ====================

  async uploadDocument(
    userId: string,
    data: {
      type: PlayerDocumentType;
      documentNumber?: string;
      expiryDate?: string;
      file?: { buffer: Buffer; mimetype: string };
    },
  ) {
    const player = await this.prisma.player.findUnique({ where: { userId } });
    if (!player) throw new NotFoundException("O'yinchi profili topilmadi");
    if (!data.documentNumber && !data.file) {
      throw new BadRequestException('Hujjat raqami yoki fayl kiritilsin');
    }

    let filePathEnc: string | undefined;
    if (data.file) {
      if (
        !/^image\/(jpeg|png|webp)|^application\/pdf/.test(data.file.mimetype)
      ) {
        throw new BadRequestException('Faqat JPEG/PNG/WebP/PDF qabul qilinadi');
      }
      mkdirSync(PRIVATE_DIR, { recursive: true });
      const fileName = `${randomUUID()}.enc`;
      // Fayl DISKKA FAQAT shifrlangan holda yoziladi
      const encrypted = this.crypto.encryptBuffer(data.file.buffer);
      writeFileSync(join(PRIVATE_DIR, fileName), encrypted, 'utf8');
      filePathEnc = this.crypto.encryptString(fileName);
    }

    return this.prisma.playerDocument.create({
      data: {
        playerId: player.id,
        type: data.type,
        documentNumberEnc: data.documentNumber
          ? this.crypto.encryptString(data.documentNumber)
          : undefined,
        filePathEnc,
        expiryDate: data.expiryDate ? new Date(data.expiryDate) : undefined,
        uploadedById: userId,
      },
      select: { id: true, type: true, createdAt: true }, // shifrlangan maydonlar javobda YO'Q
    });
  }

  /** Admin ko'rishi: deshifrlash + majburiy audit log */
  async viewDocument(docId: string, viewerUserId: string, ip?: string) {
    const doc = await this.prisma.playerDocument.findUnique({
      where: { id: docId },
      include: { player: { select: { firstName: true, lastName: true } } },
    });
    if (!doc) throw new NotFoundException('Hujjat topilmadi');

    await this.prisma.documentAccessLog.create({
      data: { documentId: doc.id, userId: viewerUserId, action: 'VIEW', ip },
    });

    let fileBuffer: Buffer | null = null;
    if (doc.filePathEnc) {
      const fileName = this.crypto.decryptString(doc.filePathEnc);
      const encContent = readFileSync(join(PRIVATE_DIR, fileName), 'utf8');
      fileBuffer = this.crypto.decryptToBuffer(encContent);
    }

    return {
      id: doc.id,
      type: doc.type,
      player: doc.player,
      documentNumber: doc.documentNumberEnc
        ? this.crypto.decryptString(doc.documentNumberEnc)
        : null,
      expiryDate: doc.expiryDate,
      fileBuffer,
    };
  }

  /** Admin: kutayotgan o'yinchilarni tasdiqlash (litsenziya berish) */
  async verifyPlayer(playerId: string) {
    const player = await this.prisma.player.findUnique({
      where: { id: playerId },
    });
    if (!player) throw new NotFoundException("O'yinchi topilmadi");
    const count = await this.prisma.player.count({
      where: { licenseNumber: { not: null } },
    });
    return this.prisma.player.update({
      where: { id: playerId },
      data: {
        status: 'ACTIVE',
        licenseNumber: player.licenseNumber ?? `UZ-${String(2000 + count)}`,
      },
      select: { id: true, status: true, licenseNumber: true },
    });
  }

  pendingPlayers() {
    return this.prisma.player.findMany({
      where: { status: 'PENDING_VERIFICATION' },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        gender: true,
        birthDate: true,
        region: true,
        club: true,
        createdAt: true,
        documents: { select: { id: true, type: true, createdAt: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }
}
