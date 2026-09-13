import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type EventType } from '@prisma/client';
import { createHash, randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { RULE_LABEL_UZ } from '../tournaments/level-rules';
import { placePlayers, planMatches, stageForRound } from './draw.engine';

@Injectable()
export class DrawsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Tasdiqlangan registratsiyalardan setka generatsiyasi:
   * reyting bo'yicha seed, bye'lar kuchli seedlarga, barcha raund
   * o'yinlari oldindan yaratiladi va nextMatchId bilan bog'lanadi.
   */
  async generate(tournamentCategoryId: string) {
    const category = await this.prisma.tournamentCategory.findUnique({
      where: { id: tournamentCategoryId },
      include: {
        tournament: true,
        ageCategory: true,
        registrations: {
          where: { status: 'CONFIRMED' },
          include: { player: { select: { id: true, rankingPoints: true } } },
        },
        draws: true,
      },
    });
    if (!category) throw new NotFoundException('Kategoriya topilmadi');
    if (category.draws.length > 0) {
      throw new BadRequestException(
        'Bu kategoriya uchun setka allaqachon yaratilgan',
      );
    }
    if (category.registrations.length < 2) {
      throw new BadRequestException(
        'Setka uchun kamida 2 ta tasdiqlangan o‘yinchi kerak',
      );
    }

    const slots = placePlayers(
      category.registrations.map((r) => ({
        playerId: r.player.id,
        rankingPoints: r.player.rankingPoints,
      })),
    );
    const planned = planMatches(slots);
    const totalRounds = Math.log2(slots.length);

    return this.prisma.$transaction(async (tx) => {
      const draw = await tx.draw.create({
        data: {
          tournamentCategoryId,
          size: slots.length,
          status: 'PUBLISHED',
          entries: {
            create: slots.map((s) => ({
              position: s.position,
              seed: s.seed,
              playerId: s.playerId,
            })),
          },
        },
      });

      // O'yinlarni oxirgi raunddan boshlab yaratamiz — nextMatchId bog'lash uchun
      const idByRoundPos = new Map<string, string>();
      const sortedRounds = [...planned].sort(
        (a, b) => b.roundNumber - a.roundNumber,
      );
      for (const pm of sortedRounds) {
        const id = randomUUID();
        idByRoundPos.set(`${pm.roundNumber}:${pm.bracketPosition}`, id);
        const nextId = pm.nextBracketPosition
          ? idByRoundPos.get(`${pm.roundNumber + 1}:${pm.nextBracketPosition}`)
          : null;

        // Walkover (bye): o'yin darhol FINISHED, ball berilmaydi
        const isWalkover = pm.walkoverWinnerId !== null;

        await tx.match.create({
          data: {
            id,
            tournamentId: category.tournamentId,
            drawId: draw.id,
            stage: stageForRound(pm.roundNumber, totalRounds),
            roundNumber: pm.roundNumber,
            bracketPosition: pm.bracketPosition,
            nextMatchId: nextId,
            nextMatchSlot: pm.nextSlot,
            player1Id: pm.player1Id,
            player2Id: pm.player2Id,
            status: isWalkover ? 'FINISHED' : 'SCHEDULED',
            winnerId: pm.walkoverWinnerId,
            refereeCodeHash: createHash('sha256')
              .update(String(Math.floor(100000 + Math.random() * 900000)))
              .digest('hex'),
          },
        });
      }

      await this.awardGroupAdvance(tx, category.tournamentId, slots);

      return this.bracket(draw.id, tx);
    });
  }

  /**
   * "Guruhdan chiqish" balli: setkaga tushgan o'yinchi shu musobaqada guruh
   * bosqichida o'ynagan bo'lsa, daraja reglamentidagi GROUP_ADVANCE ballini
   * oladi. Guruh bosqichi bo'lmagan musobaqada hech kimga ball berilmaydi.
   */
  private async awardGroupAdvance(
    tx: Prisma.TransactionClient,
    tournamentId: string,
    slots: Array<{ playerId: string | null }>,
  ) {
    const tournament = await tx.tournament.findUnique({
      where: { id: tournamentId },
      include: { level: { include: { pointsRules: true } } },
    });
    const points =
      tournament?.level.pointsRules.find((r) => r.key === 'GROUP_ADVANCE')
        ?.points ?? 0;
    if (points <= 0) return;

    const playerIds = slots
      .map((s) => s.playerId)
      .filter((id): id is string => !!id);
    if (playerIds.length === 0) return;

    // Faqat shu musobaqada guruh o'yinini o'ynaganlar
    const groupMatches = await tx.match.findMany({
      where: {
        tournamentId,
        stage: 'GROUP',
        OR: [
          { player1Id: { in: playerIds } },
          { player2Id: { in: playerIds } },
        ],
      },
      select: { player1Id: true, player2Id: true },
    });
    const played = new Set<string>();
    for (const m of groupMatches) {
      if (m.player1Id && playerIds.includes(m.player1Id))
        played.add(m.player1Id);
      if (m.player2Id && playerIds.includes(m.player2Id))
        played.add(m.player2Id);
    }
    if (played.size === 0) return;

    // Bir musobaqada ikki marta berilmasin
    const already = await tx.playerPointsLog.findMany({
      where: {
        tournamentId,
        playerId: { in: [...played] },
        note: RULE_LABEL_UZ.GROUP_ADVANCE,
      },
      select: { playerId: true },
    });
    const skip = new Set(already.map((a) => a.playerId));

    for (const playerId of played) {
      if (skip.has(playerId)) continue;
      await tx.player.update({
        where: { id: playerId },
        data: { rankingPoints: { increment: points } },
      });
      await tx.playerPointsLog.create({
        data: {
          playerId,
          delta: points,
          reason: 'MATCH_WIN',
          tournamentId,
          note: RULE_LABEL_UZ.GROUP_ADVANCE,
        },
      });
    }
  }

  /** Bracket o'qish modeli: raundlar bo'yicha guruhlangan o'yinlar */
  async bracket(
    drawId: string,
    tx: Pick<PrismaService, 'draw' | 'match'> = this.prisma,
  ) {
    const draw = await tx.draw.findUnique({
      where: { id: drawId },
      include: {
        category: {
          include: {
            ageCategory: { select: { code: true, name: true } },
            tournament: { select: { id: true, slug: true, name: true } },
          },
        },
      },
    });
    if (!draw) throw new NotFoundException('Setka topilmadi');

    const matches = await tx.match.findMany({
      where: { drawId },
      orderBy: [{ roundNumber: 'asc' }, { bracketPosition: 'asc' }],
      select: {
        id: true,
        roundNumber: true,
        bracketPosition: true,
        stage: true,
        status: true,
        winnerId: true,
        player1SetsWon: true,
        player2SetsWon: true,
        seq: true,
        player1: {
          select: { id: true, slug: true, firstName: true, lastName: true },
        },
        player2: {
          select: { id: true, slug: true, firstName: true, lastName: true },
        },
        sets: {
          select: { setNumber: true, p1Points: true, p2Points: true },
          orderBy: { setNumber: 'asc' },
        },
      },
    });

    const totalRounds = Math.log2(draw.size);
    const rounds = Array.from({ length: totalRounds }, (_, i) => ({
      roundNumber: i + 1,
      stage: stageForRound(i + 1, totalRounds),
      matches: matches.filter((m) => m.roundNumber === i + 1),
    }));

    return {
      id: draw.id,
      size: draw.size,
      status: draw.status,
      category: draw.category,
      rounds,
    };
  }

  /** Turnirning barcha setkalari (kategoriya bo'yicha) */
  async byTournament(tournamentIdOrSlug: string) {
    const tournament = await this.prisma.tournament.findFirst({
      where: {
        OR: [{ id: tournamentIdOrSlug }, { slug: tournamentIdOrSlug }],
      },
      select: { id: true },
    });
    if (!tournament) throw new NotFoundException('Musobaqa topilmadi');

    const draws = await this.prisma.draw.findMany({
      where: { category: { tournamentId: tournament.id } },
      include: {
        category: {
          include: { ageCategory: { select: { code: true, name: true } } },
        },
      },
    });
    return Promise.all(draws.map((d) => this.bracket(d.id)));
  }

  /** Kategoriya registratsiyalari (admin ko'rish/tasdiqlash uchun) */
  registrations(tournamentCategoryId: string) {
    return this.prisma.tournamentRegistration.findMany({
      where: { tournamentCategoryId },
      include: {
        player: {
          select: {
            id: true,
            slug: true,
            firstName: true,
            lastName: true,
            rankingPoints: true,
            region: true,
          },
        },
        partner: { select: { id: true, firstName: true, lastName: true } },
        statusChangedBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: { registeredAt: 'asc' },
    });
  }

  /**
   * Ariza holatini o'zgartirish. REJECTED/WITHDRAWN uchun sabab MAJBURIY —
   * kim va qachon chetlatgani ham yoziladi.
   */
  async setRegistrationStatus(
    registrationId: string,
    status: 'CONFIRMED' | 'REJECTED' | 'WAITLIST' | 'WITHDRAWN',
    actorUserId?: string,
    reason?: string,
  ) {
    const reg = await this.prisma.tournamentRegistration.findUnique({
      where: { id: registrationId },
    });
    if (!reg) throw new NotFoundException('Registratsiya topilmadi');
    if ((status === 'REJECTED' || status === 'WITHDRAWN') && !reason?.trim()) {
      throw new BadRequestException(
        'Rad etish yoki chetlatish uchun sabab ko‘rsatilishi shart',
      );
    }
    return this.prisma.tournamentRegistration.update({
      where: { id: registrationId },
      data: {
        status,
        statusReason: reason?.trim() || null,
        statusChangedById: actorUserId,
        statusChangedAt: new Date(),
      },
      include: {
        player: { select: { firstName: true, lastName: true } },
      },
    });
  }

  /** Turnir kategoriyasini yaratish (admin/operator) */
  async createCategory(data: {
    tournamentId: string;
    ageCategoryCode: string;
    /** null = aralash/ochiq guruh (aralash juftlik, jamoaviy) */
    gender?: 'MALE' | 'FEMALE' | null;
    eventType?: EventType;
    maxEntries?: number;
    registrationDeadline?: string;
  }) {
    const ageCategory = await this.prisma.ageCategory.findUnique({
      where: { code: data.ageCategoryCode },
    });
    if (!ageCategory)
      throw new NotFoundException('Yosh kategoriyasi topilmadi');
    const eventType = data.eventType ?? 'SINGLES';
    const gender = eventType === 'MIXED_DOUBLES' ? null : (data.gender ?? null);

    const existing = await this.prisma.tournamentCategory.findFirst({
      where: {
        tournamentId: data.tournamentId,
        ageCategoryId: ageCategory.id,
        gender,
        eventType,
      },
    });
    if (existing) throw new ConflictException('Bunday guruh allaqachon mavjud');

    return this.prisma.tournamentCategory.create({
      data: {
        tournamentId: data.tournamentId,
        ageCategoryId: ageCategory.id,
        gender,
        eventType,
        maxEntries: data.maxEntries,
        registrationDeadline: data.registrationDeadline
          ? new Date(data.registrationDeadline)
          : undefined,
      },
      include: { ageCategory: { select: { code: true, name: true } } },
    });
  }

  /** Yosh kategoriyalari spravochnigi */
  ageCategories() {
    return this.prisma.ageCategory.findMany({
      orderBy: { sortOrder: 'asc' },
      select: { id: true, code: true, name: true, maxAge: true },
    });
  }

  /** Turnir kategoriyalari ro'yxati (public — yozilish UI uchun ham) */
  categoriesOf(tournamentId: string) {
    return this.prisma.tournamentCategory.findMany({
      where: { tournamentId },
      include: {
        ageCategory: { select: { code: true, name: true, sortOrder: true } },
        _count: { select: { registrations: true } },
      },
      orderBy: [{ eventType: 'asc' }, { gender: 'asc' }],
    });
  }
}
