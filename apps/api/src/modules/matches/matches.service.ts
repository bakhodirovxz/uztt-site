import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { MatchStage, MatchStatus, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { PrismaService } from '../../prisma/prisma.service';
import { CryptoService } from '../../common/crypto/crypto.service';
import { LiveGateway } from '../live/live.gateway';
import {
  applyPoint,
  pointAlert,
  serverSlot,
  type ScoreState,
} from './scoring.engine';
import { RULE_LABEL_UZ, awardsForMatch } from '../tournaments/level-rules';

const UPLOADS_AUDIO_DIR = join(process.cwd(), 'uploads', 'audio');

/** Undo uchun amaldan oldingi holat snapshot'i (legacy history semantikasi) */
interface PointSnapshot {
  currentSetP1: number;
  currentSetP2: number;
  setIds: string[];
  cardIds: string[];
  player1SetsWon: number;
  player2SetsWon: number;
  status: MatchStatus;
  winnerId: string | null;
  pointsAwarded: number;
}

type Tx = Prisma.TransactionClient;

@Injectable()
export class MatchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly live: LiveGateway,
  ) {}

  // ==================== PUBLIC O'QISH ====================

  async liveList() {
    const matches = await this.prisma.match.findMany({
      where: { status: 'LIVE' },
      orderBy: { updatedAt: 'desc' },
      include: this.publicInclude(),
    });
    return matches.map((m) => this.toPublic(m));
  }

  async publicById(id: string) {
    const m = await this.prisma.match.findUnique({
      where: { id },
      include: this.publicInclude(),
    });
    if (!m) throw new NotFoundException("O'yin topilmadi");
    return this.toPublic(m);
  }

  async publicByOverlayToken(token: string) {
    const m = await this.prisma.match.findUnique({
      where: { overlayToken: token },
      include: this.publicInclude(),
    });
    if (!m) throw new NotFoundException('Overlay topilmadi');
    return this.toPublic(m);
  }

  /**
   * Stolga biriktirilgan overlay/monitor uchun: shu stoldagi joriy o'yin.
   * Ustuvorlik: LIVE → keyingi SCHEDULED → oxirgi FINISHED (natijani ko'rsatish uchun).
   */
  async currentByTable(tableNumber: number) {
    const pick = async (
      where: Prisma.MatchWhereInput,
      orderBy: Prisma.MatchOrderByWithRelationInput[],
    ) =>
      this.prisma.match.findFirst({
        where: { tableNumber, ...where },
        orderBy,
        include: this.publicInclude(),
      });

    // Ekran hakamga ergashadi: hakam kodni kiritgan (verified) o'yin,
    // hatto birinchi ochkogacha ham, stoldagi eski jonli o'yindan ustun.
    const m =
      (await pick(
        {
          OR: [
            { status: 'LIVE' },
            { status: 'SCHEDULED', refereeVerifiedAt: { not: null } },
          ],
        },
        [
          { refereeVerifiedAt: { sort: 'desc', nulls: 'last' } },
          { updatedAt: 'desc' },
        ],
      )) ??
      (await pick({ status: 'SCHEDULED' }, [
        { scheduledAt: 'asc' },
        { createdAt: 'asc' },
      ])) ??
      (await pick({ status: 'FINISHED' }, [{ updatedAt: 'desc' }]));

    if (!m) throw new NotFoundException("Bu stolda o'yin yo'q");
    return this.toPublic(m);
  }

  /** Monitor uchun "keyingi o'yinlar" jadvali (WTT Upcoming Match Slate) */
  async scheduleByTable(tableNumber: number) {
    const rows = await this.prisma.match.findMany({
      where: { tableNumber, status: { in: ['SCHEDULED', 'LIVE'] } },
      orderBy: [
        { status: 'desc' },
        { scheduledAt: 'asc' },
        { createdAt: 'asc' },
      ],
      take: 6,
      include: this.publicInclude(),
    });
    return rows.map((m) => this.toPublic(m));
  }

  /** Hakam ro'yxati: bugungi rejalashtirilgan va jonli o'yinlar */
  async refereeList() {
    const matches = await this.prisma.match.findMany({
      where: { status: { in: ['SCHEDULED', 'LIVE'] } },
      orderBy: [{ tableNumber: 'asc' }, { scheduledAt: 'asc' }],
      include: this.publicInclude(),
    });
    return matches.map((m) => this.toPublic(m));
  }

  // ==================== ADMIN ====================

  async create(data: {
    tournamentId: string;
    stage?: MatchStage;
    tableNumber?: number;
    scheduledAt?: string;
    bestOf?: number;
    player1Id?: string;
    player2Id?: string;
  }) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: data.tournamentId },
    });
    if (!tournament) throw new NotFoundException('Musobaqa topilmadi');

    const code = this.genCode();
    const m = await this.prisma.match.create({
      data: {
        tournamentId: data.tournamentId,
        stage: data.stage ?? 'ROUND_1',
        tableNumber: data.tableNumber,
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : undefined,
        bestOf: data.bestOf ?? 5,
        player1Id: data.player1Id,
        player2Id: data.player2Id,
        refereeCodeHash: this.crypto.sha256(code),
      },
      include: this.publicInclude(),
    });
    // Kod FAQAT shu javobda ochiq qaytadi — bazada faqat hash
    return {
      ...this.toPublic(m),
      refereeCode: code,
      overlayToken: m.overlayToken,
    };
  }

  async update(
    id: string,
    data: Partial<{
      stage: MatchStage;
      tableNumber: number;
      scheduledAt: string;
      bestOf: number;
      player1Id: string;
      player2Id: string;
    }>,
  ) {
    const exists = await this.prisma.match.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException("O'yin topilmadi");
    if (exists.status !== 'SCHEDULED') {
      throw new BadRequestException(
        "Faqat boshlanmagan o'yinni tahrirlash mumkin",
      );
    }
    const m = await this.prisma.match.update({
      where: { id },
      data: {
        ...data,
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : undefined,
      },
      include: this.publicInclude(),
    });
    return this.toPublic(m);
  }

  /** Kod bloklanganda yoki yo'qolganda admin yangi kod yaratadi */
  async regenerateCode(id: string) {
    const exists = await this.prisma.match.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException("O'yin topilmadi");
    const code = this.genCode();
    await this.prisma.match.update({
      where: { id },
      data: {
        refereeCodeHash: this.crypto.sha256(code),
        refereeCodeAttempts: 0,
        refereeCodeLocked: false,
      },
    });
    return { refereeCode: code };
  }

  /** Admin ro'yxati: overlay token bilan (kod EMAS — u faqat yaratishda) */
  async adminList(tournamentId?: string) {
    const matches = await this.prisma.match.findMany({
      where: { tournamentId },
      orderBy: [{ status: 'asc' }, { tableNumber: 'asc' }],
      include: this.publicInclude(),
    });
    return matches.map((m) => ({
      ...this.toPublic(m),
      overlayToken: m.overlayToken,
      refereeCodeLocked: m.refereeCodeLocked,
      refereeVerifiedAt: m.refereeVerifiedAt,
    }));
  }

  // ==================== HAKAM AMALLARI ====================

  /**
   * 6 xonali kod tasdiqlash: 5 noto'g'ri urinishdan keyin kod bloklanadi.
   *
   * MUHIM: xato tranzaksiya ICHIDA otilmaydi — aks holda urinishlar hisoblagichi
   * ham rollback bo'lib, blokirovka hech qachon ishlamas edi. Natija qaytariladi,
   * xato tranzaksiya yopilgandan keyin otiladi.
   */
  async verify(matchId: string, code: string, userId: string) {
    const outcome = await this.prisma.$transaction(async (tx) => {
      const match = await this.lockMatch(tx, matchId);
      if (match.refereeCodeLocked) return { kind: 'locked' as const };

      if (this.crypto.sha256(code) !== match.refereeCodeHash) {
        const attempts = match.refereeCodeAttempts + 1;
        await tx.match.update({
          where: { id: matchId },
          data: {
            refereeCodeAttempts: attempts,
            refereeCodeLocked: attempts >= 5,
          },
        });
        return { kind: 'wrong' as const, attempts };
      }

      const updated = await tx.match.update({
        where: { id: matchId },
        data: {
          refereeVerifiedAt: new Date(),
          verifiedByUserId: userId,
          refereeCodeAttempts: 0,
          seq: { increment: 1 },
        },
        include: this.publicInclude(),
      });
      return { kind: 'ok' as const, match: updated };
    });

    if (outcome.kind === 'locked') {
      throw new ForbiddenException(
        'Kod bloklangan — administratordan yangi kod oling',
      );
    }
    if (outcome.kind === 'wrong') {
      throw new UnauthorizedException(
        outcome.attempts >= 5
          ? 'Kod bloklandi (5 noto‘g‘ri urinish)'
          : `Kod noto‘g‘ri (${outcome.attempts}/5 urinish)`,
      );
    }

    await this.logEvent(matchId, outcome.match.seq, 'VERIFY', null, userId);
    return this.emitAndReturn(outcome.match);
  }

  /** Ochko qo'shish — scoring engine + snapshot + ball berish, bitta tranzaksiyada */
  async point(matchId: string, player: 1 | 2, userId: string) {
    const updated = await this.prisma.$transaction(async (tx) => {
      const match = await this.lockMatch(tx, matchId);
      this.assertVerified(match);
      if (match.status === 'FINISHED') {
        throw new BadRequestException("O'yin allaqachon yakunlangan");
      }
      if (!match.player1Id || !match.player2Id) {
        throw new BadRequestException("O'yinchilar belgilanmagan");
      }

      const sets = await tx.matchSet.findMany({
        where: { matchId },
        orderBy: { setNumber: 'asc' },
      });
      const cards = await tx.matchCard.findMany({ where: { matchId } });

      // Amaldan OLDINGI holat — undo uchun
      const snapshot: PointSnapshot = {
        currentSetP1: match.currentSetP1,
        currentSetP2: match.currentSetP2,
        setIds: sets.map((s) => s.id),
        cardIds: cards.map((c) => c.id),
        player1SetsWon: match.player1SetsWon,
        player2SetsWon: match.player2SetsWon,
        status: match.status,
        winnerId: match.winnerId,
        pointsAwarded: match.pointsAwarded,
      };

      const state: ScoreState = {
        bestOf: match.bestOf,
        status: match.status,
        currentSet: { p1: match.currentSetP1, p2: match.currentSetP2 },
        sets: sets.map((s) => ({ p1: s.p1Points, p2: s.p2Points })),
        player1SetsWon: match.player1SetsWon,
        player2SetsWon: match.player2SetsWon,
        winnerSlot: null,
      };
      const r = applyPoint(state, player);

      if (r.setFinished) {
        const done = r.state.sets[r.state.sets.length - 1];
        await tx.matchSet.create({
          data: {
            matchId,
            setNumber: r.state.sets.length,
            p1Points: done.p1,
            p2Points: done.p2,
          },
        });
      }

      let winnerId: string | null = match.winnerId;
      let pointsAwarded = match.pointsAwarded;
      if (r.matchFinished) {
        winnerId = r.state.winnerSlot === 1 ? match.player1Id : match.player2Id;
        pointsAwarded = await this.awardPoints(tx, {
          matchId,
          tournamentId: match.tournamentId,
          stage: match.stage,
          winnerId: winnerId,
          loserId:
            winnerId === match.player1Id ? match.player2Id : match.player1Id,
        });
        await this.propagateWinner(tx, match, winnerId);
      }

      const updatedMatch = await tx.match.update({
        where: { id: matchId },
        data: {
          status: r.state.status,
          currentSetP1: r.state.currentSet.p1,
          currentSetP2: r.state.currentSet.p2,
          player1SetsWon: r.state.player1SetsWon,
          player2SetsWon: r.state.player2SetsWon,
          winnerId,
          pointsAwarded,
          seq: { increment: 1 },
        },
        include: this.publicInclude(),
      });

      await tx.matchEvent.create({
        data: {
          matchId,
          seq: updatedMatch.seq,
          type: 'POINT',
          payload: { player, snapshot } as unknown as Prisma.InputJsonValue,
          actorUserId: userId,
        },
      });

      return updatedMatch;
    });

    return this.emitAndReturn(updated);
  }

  /** Oxirgi ochkoni bekor qilish — snapshot tiklanadi, ball qaytariladi */
  async undo(matchId: string, userId: string) {
    const updated = await this.prisma.$transaction(async (tx) => {
      const match = await this.lockMatch(tx, matchId);

      const lastPoint = await tx.matchEvent.findFirst({
        where: { matchId, type: 'POINT' },
        orderBy: { seq: 'desc' },
      });
      if (!lastPoint) {
        throw new BadRequestException('Bekor qilinadigan harakat yo‘q');
      }
      const { snapshot } = lastPoint.payload as unknown as {
        snapshot: PointSnapshot;
      };

      // O'yin shu ochko bilan tugagan bo'lsa — g'olibdan ballni qaytarib olamiz
      if (
        match.status === 'FINISHED' &&
        snapshot.status !== 'FINISHED' &&
        match.winnerId
      ) {
        await this.unpropagateWinner(tx, match);
        // Reglament bo'yicha bir o'yinda bir NECHTA o'yinchi ball olishi
        // mumkin (masalan finalda ikkalasi ham). Shuning uchun jurnal
        // yozuvlarining o'zi teskari qilinadi — bitta "pointsAwarded"
        // qiymatiga tayanish yetarli emas.
        const awarded = await tx.playerPointsLog.findMany({
          where: { matchId, reason: 'MATCH_WIN' },
        });
        for (const row of awarded) {
          await tx.player.update({
            where: { id: row.playerId },
            data: { rankingPoints: { decrement: row.delta } },
          });
          await tx.playerPointsLog.create({
            data: {
              playerId: row.playerId,
              delta: -row.delta,
              reason: 'UNDO',
              matchId,
              tournamentId: match.tournamentId,
              note: row.note,
            },
          });
        }
      }

      // Snapshot'dan keyin yaratilgan set/kartochkalarni o'chiramiz
      await tx.matchSet.deleteMany({
        where: { matchId, id: { notIn: snapshot.setIds } },
      });
      await tx.matchCard.deleteMany({
        where: { matchId, id: { notIn: snapshot.cardIds } },
      });
      await tx.matchEvent.delete({ where: { id: lastPoint.id } });

      const updatedMatch = await tx.match.update({
        where: { id: matchId },
        data: {
          currentSetP1: snapshot.currentSetP1,
          currentSetP2: snapshot.currentSetP2,
          player1SetsWon: snapshot.player1SetsWon,
          player2SetsWon: snapshot.player2SetsWon,
          status: snapshot.status,
          winnerId: snapshot.winnerId,
          pointsAwarded: snapshot.pointsAwarded,
          seq: { increment: 1 },
        },
        include: this.publicInclude(),
      });

      await tx.matchEvent.create({
        data: {
          matchId,
          seq: updatedMatch.seq,
          type: 'UNDO',
          actorUserId: userId,
        },
      });

      return updatedMatch;
    });

    return this.emitAndReturn(updated);
  }

  /** Sariq/qizil kartochka */
  async card(
    matchId: string,
    player: 1 | 2,
    type: 'YELLOW' | 'RED',
    userId: string,
  ) {
    const updated = await this.prisma.$transaction(async (tx) => {
      const match = await this.lockMatch(tx, matchId);
      this.assertVerified(match);
      if (match.status === 'FINISHED') {
        throw new BadRequestException("O'yin allaqachon yakunlangan");
      }
      const setCount = await tx.matchSet.count({ where: { matchId } });
      await tx.matchCard.create({
        data: {
          matchId,
          player,
          type,
          setNumber: setCount + 1,
          issuedByUserId: userId,
        },
      });
      const updatedMatch = await tx.match.update({
        where: { id: matchId },
        data: { seq: { increment: 1 } },
        include: this.publicInclude(),
      });
      await tx.matchEvent.create({
        data: {
          matchId,
          seq: updatedMatch.seq,
          type: 'CARD',
          payload: { player, cardType: type },
          actorUserId: userId,
        },
      });
      return updatedMatch;
    });

    return this.emitAndReturn(updated);
  }

  /** Diskvalifikatsiya: sabab matn yoki ovozli fayl; raqib g'olib */
  async disqualify(
    matchId: string,
    player: 1 | 2,
    reason: string | undefined,
    audio: { buffer: Buffer; mimetype: string } | undefined,
    userId: string,
  ) {
    if (!reason && !audio) {
      throw new BadRequestException(
        'Sabab (matn yoki ovozli xabar) kiritilishi shart',
      );
    }

    let audioUrl: string | null = null;
    if (audio) {
      if (!/^audio\/(webm|ogg|mp4|mpeg|wav)/.test(audio.mimetype)) {
        throw new BadRequestException('Audio formati qo‘llab-quvvatlanmaydi');
      }
      mkdirSync(UPLOADS_AUDIO_DIR, { recursive: true });
      const fileName = `${randomUUID()}.webm`;
      writeFileSync(join(UPLOADS_AUDIO_DIR, fileName), audio.buffer);
      audioUrl = `/audio/${fileName}`;
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const match = await this.lockMatch(tx, matchId);
      this.assertVerified(match);
      if (match.status === 'FINISHED') {
        throw new BadRequestException("O'yin allaqachon yakunlangan");
      }
      if (!match.player1Id || !match.player2Id) {
        throw new BadRequestException("O'yinchilar belgilanmagan");
      }

      const disqualifiedId = player === 1 ? match.player1Id : match.player2Id;
      const winnerId = player === 1 ? match.player2Id : match.player1Id;

      const pointsAwarded = await this.awardPoints(tx, {
        matchId,
        tournamentId: match.tournamentId,
        stage: match.stage,
        winnerId,
        // Diskvalifikatsiya qilingan o'yinchi finalda ishtirok ballini olmaydi
        loserId: null,
      });
      await this.propagateWinner(tx, match, winnerId);

      const updatedMatch = await tx.match.update({
        where: { id: matchId },
        data: {
          status: 'FINISHED',
          winnerId,
          disqualifiedPlayerId: disqualifiedId,
          disqualificationReason: reason ?? null,
          disqualificationAudioUrl: audioUrl,
          pointsAwarded,
          seq: { increment: 1 },
        },
        include: this.publicInclude(),
      });

      await tx.matchEvent.create({
        data: {
          matchId,
          seq: updatedMatch.seq,
          type: 'DISQUALIFY',
          payload: { player, reason: reason ?? null, audioUrl },
          actorUserId: userId,
        },
      });

      return updatedMatch;
    });

    return this.emitAndReturn(updated);
  }

  // ==================== ICHKI ====================

  /** Legacy: stageBase × koeffitsiyent; log + kesh yangilash */
  /**
   * Ballarni musobaqa DARAJASI REGLAMENTI bo'yicha beradi.
   * Reglament bo'lmasa (eski darajalar) — bosqich balli × koeffitsiyent.
   *
   * Qaytadigan qiymat — o'yin bo'yicha berilgan JAMI ball (undo shu qiymatni
   * emas, `PlayerPointsLog` yozuvlarini teskari qiladi, shuning uchun bir
   * nechta o'yinchiga berilgan ballar ham to'g'ri qaytariladi).
   */
  private async awardPoints(
    tx: Tx,
    args: {
      matchId: string;
      tournamentId: string;
      stage: MatchStage;
      winnerId: string;
      loserId: string | null;
    },
  ): Promise<number> {
    const tournament = await tx.tournament.findUnique({
      where: { id: args.tournamentId },
      include: { level: { include: { pointsRules: true } } },
    });

    const rules = new Map(
      (tournament?.level.pointsRules ?? []).map((r) => [r.key, r.points]),
    );

    // Zaxira: reglament kiritilmagan daraja uchun eski hisob
    const stageRow = await tx.stagePoints.findUnique({
      where: { stage: args.stage },
    });
    const fallbackPoints = Math.round(
      (stageRow?.basePoints ?? 100) * (tournament?.level.coefficient ?? 1),
    );

    // Ishtirok balli — o'yinchi shu musobaqada BIRINCHI marta o'ynayotgan
    // bo'lsa. Jurnaldagi izoh bo'yicha tekshiriladi, shuning uchun ikkinchi
    // o'yinda takror berilmaydi.
    const bothPlayers = [args.winnerId, args.loserId].filter(
      (id): id is string => !!id,
    );
    let newParticipants: string[] = [];
    if ((rules.get('PARTICIPATION') ?? 0) > 0 && bothPlayers.length > 0) {
      const already = await tx.playerPointsLog.findMany({
        where: {
          tournamentId: args.tournamentId,
          playerId: { in: bothPlayers },
          note: RULE_LABEL_UZ.PARTICIPATION,
        },
        select: { playerId: true },
      });
      const has = new Set(already.map((a) => a.playerId));
      newParticipants = bothPlayers.filter((id) => !has.has(id));
    }

    const awards = awardsForMatch({
      stage: args.stage,
      winnerId: args.winnerId,
      loserId: args.loserId,
      newParticipants,
      rules,
      fallbackPoints,
    });

    for (const award of awards) {
      await tx.player.update({
        where: { id: award.playerId },
        data: { rankingPoints: { increment: award.points } },
      });
      await tx.playerPointsLog.create({
        data: {
          playerId: award.playerId,
          delta: award.points,
          reason: 'MATCH_WIN',
          matchId: args.matchId,
          tournamentId: args.tournamentId,
          note: RULE_LABEL_UZ[award.key],
        },
      });
    }

    return awards.reduce((sum, a) => sum + a.points, 0);
  }

  /** G'olibni keyingi raund o'yinining slotiga yozish (setka propagatsiyasi) */
  private async propagateWinner(
    tx: Tx,
    match: { nextMatchId: string | null; nextMatchSlot: number | null },
    winnerId: string,
  ) {
    if (!match.nextMatchId || !match.nextMatchSlot) return;
    await tx.match.update({
      where: { id: match.nextMatchId },
      data:
        match.nextMatchSlot === 1
          ? { player1Id: winnerId }
          : { player2Id: winnerId },
    });
  }

  /** Undo'da g'olibni keyingi raund slotidan olib tashlash (o'yin boshlanmagan bo'lsa) */
  private async unpropagateWinner(
    tx: Tx,
    match: {
      nextMatchId: string | null;
      nextMatchSlot: number | null;
      winnerId: string | null;
    },
  ) {
    if (!match.nextMatchId || !match.nextMatchSlot || !match.winnerId) return;
    const next = await tx.match.findUnique({
      where: { id: match.nextMatchId },
      select: { status: true },
    });
    if (next?.status !== 'SCHEDULED') return; // boshlangan o'yinga tegmaymiz
    await tx.match.update({
      where: { id: match.nextMatchId },
      data:
        match.nextMatchSlot === 1 ? { player1Id: null } : { player2Id: null },
    });
  }

  /** Row-lock: parallel hakam amallari navbat bilan bajariladi */
  private async lockMatch(tx: Tx, matchId: string) {
    const rows = await tx.$queryRaw<
      Array<{ id: string }>
    >`SELECT id FROM matches WHERE id = ${matchId} FOR UPDATE`;
    if (rows.length === 0) throw new NotFoundException("O'yin topilmadi");
    const match = await tx.match.findUnique({ where: { id: matchId } });
    if (!match) throw new NotFoundException("O'yin topilmadi");
    return match;
  }

  private assertVerified(match: { refereeVerifiedAt: Date | null }) {
    if (!match.refereeVerifiedAt) {
      throw new ForbiddenException('Avval hakam kodini tasdiqlang');
    }
  }

  private genCode(): string {
    return String(Math.floor(100000 + Math.random() * 900000));
  }

  private async logEvent(
    matchId: string,
    seq: number,
    type: 'VERIFY',
    payload: Prisma.InputJsonValue | null,
    actorUserId: string,
  ) {
    await this.prisma.matchEvent.create({
      data: { matchId, seq, type, payload: payload ?? undefined, actorUserId },
    });
  }

  private publicInclude() {
    return {
      // rankingPoints — g'olib kartochkasi uchun; qo'shimcha so'rov qilmaslik uchun
      // shu yerda olinadi (g'olib har doim player1 yoki player2 bo'ladi)
      player1: {
        select: {
          id: true,
          slug: true,
          firstName: true,
          lastName: true,
          rankingPoints: true,
        },
      },
      player2: {
        select: {
          id: true,
          slug: true,
          firstName: true,
          lastName: true,
          rankingPoints: true,
        },
      },
      sets: {
        select: { setNumber: true, p1Points: true, p2Points: true },
        orderBy: { setNumber: 'asc' as const },
      },
      cards: {
        select: { player: true, type: true, setNumber: true },
        orderBy: { issuedAt: 'asc' as const },
      },
      tournament: {
        select: {
          id: true,
          slug: true,
          name: true,
          level: { select: { name: true, coefficient: true } },
        },
      },
    } satisfies Prisma.MatchInclude;
  }

  /** Public payload: hech qachon refereeCodeHash/overlayToken chiqmaydi */
  private toPublic(
    m: Prisma.MatchGetPayload<{
      include: ReturnType<MatchesService['publicInclude']>;
    }>,
  ) {
    let winnerInfo: {
      playerId: string;
      name: string;
      pointsAwarded: number;
      totalPoints: number;
    } | null = null;

    if (m.status === 'FINISHED' && m.winnerId) {
      // G'olib — ikki ishtirokchidan biri; ular allaqachon yuklangan,
      // shuning uchun har o'yin uchun alohida so'rov QILINMAYDI (N+1 yo'q).
      const winner =
        m.player1?.id === m.winnerId
          ? m.player1
          : m.player2?.id === m.winnerId
            ? m.player2
            : null;
      if (winner) {
        winnerInfo = {
          playerId: winner.id,
          name: `${winner.firstName} ${winner.lastName}`,
          pointsAwarded: m.pointsAwarded,
          totalPoints: winner.rankingPoints,
        };
      }
    }

    // Overlay/monitor uchun: podacha kimda va setpoint/matchpoint holati
    const state: ScoreState = {
      bestOf: m.bestOf,
      status: m.status,
      currentSet: { p1: m.currentSetP1, p2: m.currentSetP2 },
      sets: m.sets.map((s) => ({ p1: s.p1Points, p2: s.p2Points })),
      player1SetsWon: m.player1SetsWon,
      player2SetsWon: m.player2SetsWon,
      winnerSlot: null,
    };
    const live = m.status === 'LIVE';

    return {
      id: m.id,
      tournamentId: m.tournamentId,
      tournament: m.tournament,
      stage: m.stage,
      status: m.status,
      tableNumber: m.tableNumber,
      scheduledAt: m.scheduledAt,
      bestOf: m.bestOf,
      seq: m.seq,
      server: live ? serverSlot(state) : null,
      pointAlert: live ? pointAlert(state) : null,
      player1: m.player1,
      player2: m.player2,
      player1Name: m.player1
        ? `${m.player1.firstName} ${m.player1.lastName}`
        : "Noma'lum",
      player2Name: m.player2
        ? `${m.player2.firstName} ${m.player2.lastName}`
        : "Noma'lum",
      currentSetP1: m.currentSetP1,
      currentSetP2: m.currentSetP2,
      player1SetsWon: m.player1SetsWon,
      player2SetsWon: m.player2SetsWon,
      sets: m.sets,
      cards: m.cards,
      winnerId: m.winnerId,
      winnerInfo,
      refereeVerified: m.refereeVerifiedAt !== null,
      disqualifiedPlayerId: m.disqualifiedPlayerId,
      disqualificationReason: m.disqualificationReason,
      disqualificationAudioUrl: m.disqualificationAudioUrl,
    };
  }

  private emitAndReturn(
    m: Prisma.MatchGetPayload<{
      include: ReturnType<MatchesService['publicInclude']>;
    }>,
  ) {
    const payload = this.toPublic(m);
    this.live.emitScoreUpdate(m.id, m.tournamentId, payload);
    return payload;
  }
}
