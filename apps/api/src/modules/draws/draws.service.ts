import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { applyPoints } from '../../common/points';
import { Prisma, type EventType } from '@prisma/client';
import { randomUUID } from 'crypto';
import { sealedRefereeCodeHash } from '../matches/referee-code';
import { lockCategory } from './category-lock';
import { TelegramService } from '../showcase/telegram.service';
import { AssignmentService } from '../referee-assignment/assignment.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RULE_LABEL_UZ } from '../tournaments/level-rules';
import { drawByRules, planMatches, stageForRound } from './draw.engine';

@Injectable()
export class DrawsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assignment: AssignmentService,
    private readonly telegram: TelegramService,
  ) {}

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
          include: {
            player: {
              select: { id: true, rankingPoints: true, region: true },
            },
          },
        },
        draws: true,
        groupStage: { select: { id: true } },
      },
    });
    if (!category) throw new NotFoundException('Kategoriya topilmadi');
    if (category.draws.length > 0) {
      throw new BadRequestException(
        'Bu kategoriya uchun setka allaqachon yaratilgan',
      );
    }
    // Guruh bosqichi bor kategoriyada setka faqat guruhdan o'tkazish (advance) orqali yaratiladi
    if (category.groupStage) {
      throw new ConflictException(
        "Bu kategoriyada guruh bosqichi bor — setka guruhlar tugagach \"Guruhdan setkaga\" orqali yaratiladi",
      );
    }
    if (category.registrations.length < 2) {
      throw new BadRequestException(
        'Setka uchun kamida 2 ta tasdiqlangan o‘yinchi kerak',
      );
    }

    // Qura qoidalar bo'yicha (3.6): seedlar jereb bilan o'z joylari orasida, BYE kuchli
    // seedlar qarshisida, bir viloyat o'yinchilari imkon qadar kech uchrashadi.
    const slots = drawByRules(
      category.registrations.map((r) => ({
        playerId: r.player.id,
        rankingPoints: r.player.rankingPoints,
        org: r.player.region,
      })),
    );
    return this.persistSlots(category.id, category.tournamentId, slots);
  }

  /**
   * Tayyor joylashuv (slots) bo'yicha setka va barcha raund o'yinlarini yaratadi.
   * Qura (generate) ham, guruhdan setkaga o'tkazish (GroupsService.advance) ham shuni ishlatadi.
   */
  /** Setka/guruh saqlanadi → o'yinlarga hakamlar avtomatik tayinlanadi (xato bo'lsa ham setka saqlanadi) */
  async persistSlots(
    tournamentCategoryId: string,
    tournamentId: string,
    slots: Array<{ position: number; seed: number | null; playerId: string | null }>,
    opts: { fromGroupStageId?: string } = {},
  ) {
    const draw = await this.persistSlotsInner(tournamentCategoryId, tournamentId, slots, opts);
    await this.assignment.autoAssign(tournamentId);
    this.telegram.announceDraw(tournamentCategoryId, 'bracket');
    return draw;
  }

  private async persistSlotsInner(
    tournamentCategoryId: string,
    tournamentId: string,
    slots: Array<{ position: number; seed: number | null; playerId: string | null }>,
    opts: { fromGroupStageId?: string },
  ) {
    const planned = planMatches(slots);
    const totalRounds = Math.log2(slots.length);

    return this.prisma.$transaction(async (tx) => {
      // Kategoriya qatori qulflanadi: ikki parallel so'rov (ikki marta bosish) ikkita setka yaratmasin.
      // Guruh yaratish (GroupsService.create) ham shu qatorni qulflaydi.
      await lockCategory(tx, tournamentCategoryId);
      const existing = await tx.draw.count({ where: { tournamentCategoryId } });
      if (existing > 0) {
        throw new ConflictException('Bu kategoriya uchun setka allaqachon yaratilgan');
      }
      if (opts.fromGroupStageId) {
        const flipped = await tx.groupStage.updateMany({
          where: { id: opts.fromGroupStageId, status: 'ACTIVE' },
          data: { status: 'ADVANCED' },
        });
        if (flipped.count !== 1) {
          throw new ConflictException('Setka allaqachon yaratilgan');
        }
      }

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
            tournamentId: tournamentId,
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
            refereeCodeHash: sealedRefereeCodeHash(),
          },
        });
      }

      // 3-o'rin uchun o'yin (yarim final yutqazganlari): bonus jadvali 3- va 4-o'rinni ajratadi.
      // Yarim finalda BYE bo'lsa (4 lik setkada 3 o'yinchi) — yutqazgan yo'q, shuning uchun yaratilmaydi.
      const semis = planned.filter((pm) => pm.roundNumber === totalRounds - 1);
      if (totalRounds >= 2 && semis.length === 2 && semis.every((pm) => pm.walkoverWinnerId === null)) {
        const thirdId = randomUUID();
        await tx.match.create({
          data: {
            id: thirdId,
            tournamentId,
            drawId: draw.id,
            stage: 'THIRD_PLACE',
            roundNumber: totalRounds,
            bracketPosition: 2,
            status: 'SCHEDULED',
            refereeCodeHash: sealedRefereeCodeHash(),
          },
        });
        for (const sf of semis) {
          const sfId = idByRoundPos.get(`${sf.roundNumber}:${sf.bracketPosition}`);
          if (sfId) {
            await tx.match.update({
              where: { id: sfId },
              data: { loserNextMatchId: thirdId, loserNextMatchSlot: sf.bracketPosition },
            });
          }
        }
      }

      await this.awardGroupAdvance(tx, tournamentId, slots);

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
    // Rasmiy Nizom rejimida qat'iy "guruhdan chiqish" ballari yo'q (ball faqat o'yinlar + bonus)
    if (tournament?.level.ratingMode === 'OFFICIAL') return;
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
      await applyPoints(tx, {
        playerId,
        delta: points,
        reason: 'MATCH_WIN',
        tournamentId,
        note: RULE_LABEL_UZ.GROUP_ADVANCE,
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

    const matchRows = await tx.match.findMany({
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
          select: { id: true, slug: true, firstName: true, lastName: true, photoUrl: true },
        },
        player2: {
          select: { id: true, slug: true, firstName: true, lastName: true, photoUrl: true },
        },
        sets: {
          select: { setNumber: true, p1Points: true, p2Points: true },
          orderBy: { setNumber: 'asc' },
        },
        referee: { select: { firstName: true, lastName: true } },
        assistant: { select: { firstName: true, lastName: true } },
      },
    });
    // Ommaga faqat hakam ISMI chiqadi (id/email emas)
    const nm = (u: { firstName: string; lastName: string } | null) => (u ? `${u.firstName[0]}. ${u.lastName}` : null);
    const matches = matchRows.map(({ referee, assistant, ...m }) => ({ ...m, referee: nm(referee), assistant: nm(assistant) }));

    const totalRounds = Math.log2(draw.size);
    const rounds = Array.from({ length: totalRounds }, (_, i) => ({
      roundNumber: i + 1,
      stage: stageForRound(i + 1, totalRounds),
      matches: matches.filter((m) => m.roundNumber === i + 1 && m.stage !== 'THIRD_PLACE'),
    }));
    const thirdPlace = matches.find((m) => m.stage === 'THIRD_PLACE') ?? null;

    return {
      id: draw.id,
      size: draw.size,
      status: draw.status,
      category: draw.category,
      rounds,
      thirdPlace,
    };
  }

  /** Turnirning barcha setkalari (kategoriya bo'yicha) */
  async bracketOfCategory(categoryId: string) {
    const draw = await this.prisma.draw.findFirst({
      where: { tournamentCategoryId: categoryId },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    if (!draw) throw new NotFoundException('Bu kategoriyada setka yo‘q');
    return this.bracket(draw.id);
  }

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
