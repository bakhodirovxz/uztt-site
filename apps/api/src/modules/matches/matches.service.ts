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
import { AssignmentService } from '../referee-assignment/assignment.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CryptoService } from '../../common/crypto/crypto.service';
import { applyPoints, netReversal } from '../../common/points';
import { bonusNote, lockTournamentRating, playersWithBonus } from '../rankings/bonus';
import { newRefereeCode } from './referee-code';
import {
  matchExactPoints,
  placeBonus,
  tournamentK,
  wholeDelta,
} from '../rankings/rating.engine';
import { TelegramService } from '../showcase/telegram.service';
import { LiveGateway } from '../live/live.gateway';
import {
  applyPoint,
  pointAlert,
  sideChangeDue,
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

/** Scoreboard planshetidagi o'yin holati; har 20 soniyada tasdiqlanadi */
interface BoardState {
  court: string;
  points: [number, number];
  setsWon: [number, number];
  sets: Array<[number, number]>;
  at: number;
}
const BOARD_TTL_MS = 60_000;

@Injectable()
export class MatchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly live: LiveGateway,
    private readonly telegram: TelegramService,
    private readonly assignment: AssignmentService,
  ) {}

  // ==================== PUBLIC O'QISH ====================

  /**
   * Eng ko'p so'raladigan ommaviy o'qishlar (jonli ro'yxat, stol bo'yicha joriy o'yin,
   * jadval) uchun 1 soniyalik kesh + bir vaqtdagi bir xil so'rovlarni birlashtirish.
   * 500 tomoshabin va 10 overlay har soniya bazani urmasin. Har yozuvdan keyin
   * (`emitAndReturn`) kesh tozalanadi — natija kechikmaydi.
   */
  private readonly memoStore = new Map<
    string,
    { at: number; value: Promise<unknown> }
  >();
  private memo<T>(key: string, load: () => Promise<T>, ttlMs = 1000): Promise<T> {
    const hit = this.memoStore.get(key);
    if (hit && Date.now() - hit.at < ttlMs) return hit.value as Promise<T>;
    const value = load();
    this.memoStore.set(key, { at: Date.now(), value });
    // Xato keshlanmaydi (masalan 404 "stolda o'yin yo'q")
    value.catch(() => {
      if (this.memoStore.get(key)?.value === value) this.memoStore.delete(key);
    });
    if (this.memoStore.size > 200) {
      const oldest = this.memoStore.keys().next().value;
      if (oldest !== undefined) this.memoStore.delete(oldest);
    }
    return value;
  }

  /**
   * Scoreboard planshetidagi jonli hisob: faqat xotirada, bazaga yozilmaydi. Natija o'yin tugaganda
   * bir marta sb/result orqali yoziladi (reyting va setka shu yerda). Planshet yangilab turmasa eskiradi.
   */
  private boardStates = new Map<string, BoardState>();

  private boardOf(id: string): BoardState | null {
    const s = this.boardStates.get(id);
    return s && Date.now() - s.at < BOARD_TTL_MS ? s : null;
  }

  /** Scoreboard'dan kelgan to'liq ro'yxat: o'zgargan va ro'yxatdan chiqqan o'yinlar tomoshabinlarga yuboriladi */
  async setBoardStates(list: Array<Omit<BoardState, 'at'> & { siteId: string }>) {
    const at = Date.now();
    const next = new Map(list.map(({ siteId, ...s }) => [siteId, { ...s, at }]));
    const same = (a?: BoardState, b?: BoardState) =>
      !!a && !!b && a.court === b.court && JSON.stringify([a.points, a.setsWon, a.sets]) === JSON.stringify([b.points, b.setsWon, b.sets]);
    const changed = [...new Set([...next.keys(), ...this.boardStates.keys()])].filter(
      (id) => !same(this.boardStates.get(id), next.get(id)),
    );
    this.boardStates = next;
    if (!changed.length) return;
    this.memoStore.clear();
    const rows = await this.prisma.match.findMany({
      where: { id: { in: changed } },
      include: this.publicInclude(),
    });
    for (const m of rows) this.live.emitScoreUpdate(m.id, m.tournamentId, this.toPublic(m));
  }

  async liveList() {
    return this.memo('live', () => this.liveListUncached());
  }

  private async liveListUncached() {
    const matches = await this.prisma.match.findMany({
      where: {
        OR: [
          { status: 'LIVE' },
          { status: 'SCHEDULED', id: { in: [...this.boardStates.keys()].filter((id) => this.boardOf(id)) } },
        ],
      },
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
    return this.memo(`current:${tableNumber}`, () =>
      this.currentByTableUncached(tableNumber),
    );
  }

  private async currentByTableUncached(tableNumber: number) {
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
    return this.memo(`schedule:${tableNumber}`, () =>
      this.scheduleByTableUncached(tableNumber),
    );
  }

  private async scheduleByTableUncached(tableNumber: number) {
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

  /**
   * AYNI PAYTDAGI musobaqa(lar): ochiq (kutilayotgan yoki jonli) o'yini bor musobaqalar orasidan
   * bugungi kunga eng yaqini (avval administrator "Joriy" deb belgilaganlar; bo'lmasa bugun o'tayotgan; bo'lmasa sanasi bugunga eng yaqin:
   * kelasi yoki hali tugamagan o'tgan musobaqa). Bir xil masofadagilar hammasi.
   */
  async currentTournamentIds(): Promise<string[]> {
    const t = new Date(Date.now() + 5 * 3_600_000); // UTC+5 (Toshkent)
    const day = Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate());
    const rows = await this.prisma.tournament.findMany({
      where: { matches: { some: { status: { in: ['SCHEDULED', 'LIVE'] } } } },
      select: { id: true, startDate: true, endDate: true, matches: { where: { status: 'LIVE' }, select: { id: true }, take: 1 } },
    });
    if (!rows.length) return [];
    // Administrator "Joriy" (LIVE) deb belgilagan musobaqa — eng ustuvor
    const marked = await this.prisma.tournament.findMany({
      where: { status: 'LIVE', id: { in: rows.map((r) => r.id) } },
      select: { id: true },
    });
    if (marked.length) return marked.map((r) => r.id);
    const dist = (r: (typeof rows)[number]) => {
      if (r.matches.length) return 0; // jonli o'yini bor
      const a = r.startDate.getTime();
      const b = r.endDate.getTime();
      if (day >= a && day <= b + 86_399_999) return 0;
      return Math.min(Math.abs(day - a), Math.abs(day - b));
    };
    const best = Math.min(...rows.map(dist));
    return rows.filter((r) => dist(r) === best).map((r) => r.id);
  }

  /** Hakam ro'yxati: faqat ayni paytdagi musobaqa o'yinlari. `all=true` — hammasi (admin uchun). */
  async refereeList(opts: { all?: boolean } = {}) {
    const where: Prisma.MatchWhereInput = { status: { in: ['SCHEDULED', 'LIVE'] } };
    if (!opts.all) where.tournamentId = { in: await this.currentTournamentIds() };
    const matches = await this.prisma.match.findMany({
      where,
      orderBy: [{ status: 'desc' }, { tableNumber: { sort: 'asc', nulls: 'last' } }, { scheduledAt: 'asc' }],
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
  async verify(matchId: string, code: string, userId: string, isManager = false) {
    const outcome = await this.prisma.$transaction(async (tx) => {
      const match = await this.lockMatch(tx, matchId);
      if (match.refereeCodeLocked) return { kind: 'locked' as const };

      // Hakam tayinlangan bo'lsa — faqat yetakchi/yordamchi hakam (yoki administrator) kirishi mumkin
      if (
        match.refereeUserId &&
        !isManager &&
        userId !== match.refereeUserId &&
        userId !== match.assistantUserId
      ) {
        throw new ForbiddenException('Bu o‘yinga boshqa hakam tayinlangan');
      }

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

      // 4.6.1.1: musobaqa ishtirokchisi shu musobaqada hakam bo'la olmaydi
      const own = await tx.player.findUnique({ where: { userId }, select: { id: true } });
      if (own && (own.id === match.player1Id || own.id === match.player2Id)) {
        throw new ForbiddenException("O'yinchi o'z uchrashuvida hakam bo'la olmaydi (4.6.1.1)");
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
  async point(matchId: string, player: 1 | 2, userId: string, isManager = false) {
    const updated = await this.prisma.$transaction((tx) =>
      this.pointTx(tx, matchId, player, userId, isManager),
    );
    return this.emitAndReturn(updated);
  }

  /** Bitta ochko (tranzaksiya ichida) — jarima ochkolari ham shu orqali beriladi */
  private async pointTx(
    tx: Tx,
    matchId: string,
    player: 1 | 2,
    userId: string,
    isManager: boolean,
  ) {
    const match = await this.lockMatch(tx, matchId);
    this.assertVerified(match, userId, isManager);
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
        hasThirdPlace: !!match.loserNextMatchId,
        winnerId: winnerId,
        loserId:
          winnerId === match.player1Id ? match.player2Id : match.player1Id,
      });
      await this.propagateWinner(tx, match, winnerId);
      await this.propagateLoser(
        tx,
        match,
        winnerId === match.player1Id ? match.player2Id : match.player1Id,
      );
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
  }

  /**
   * Oxirgi ochkoni bekor qilish — snapshot tiklanadi, ball qaytariladi.
   * Faqat OCHKO bekor qilinadi: oxirgi amal kartochka bo'lsa yoki o'yinda diskvalifikatsiya bo'lsa
   * rad etiladi (aks holda undo undan oldingi haqiqiy ochkoni o'chirib yuborardi).
   */
  async undo(matchId: string, userId: string, isManager = false) {
    const updated = await this.prisma.$transaction(async (tx) => {
      const match = await this.lockMatch(tx, matchId);
      this.assertVerified(match, userId, isManager);
      if (match.disqualifiedPlayerId) {
        throw new BadRequestException(
          "Diskvalifikatsiya qilingan o'yinda ochkoni bekor qilib bo'lmaydi — administratorga murojaat qiling",
        );
      }

      // Taym-aut, tasdiqlash va oldingi undo'lar hisobni o'zgartirmaydi — ular o'tkazib yuboriladi
      const lastAction = await tx.matchEvent.findFirst({
        where: { matchId, type: { in: ['POINT', 'CARD', 'DISQUALIFY'] } },
        orderBy: { seq: 'desc' },
      });
      if (!lastAction) {
        throw new BadRequestException('Bekor qilinadigan harakat yo‘q');
      }
      if (lastAction.type !== 'POINT') {
        throw new BadRequestException(
          "Oxirgi amal ochko emas (kartochka) — uni bekor qilib bo'lmaydi; zarur bo'lsa administratorga murojaat qiling",
        );
      }
      const lastPoint = lastAction;
      const { snapshot } = lastPoint.payload as unknown as {
        snapshot: PointSnapshot;
      };

      // O'yin shu ochko bilan tugagan bo'lsa — g'olibdan ballni qaytarib olamiz
      if (
        match.status === 'FINISHED' &&
        snapshot.status !== 'FINISHED' &&
        match.winnerId
      ) {
        // Keyingi bosqich o'yini boshlangan bo'lsa — rad (aks holda g'olib u yerda qolib ketadi)
        await this.assertNextNotStarted(tx, match);
        await this.unpropagateWinner(tx, match);
        await this.unpropagateLoser(tx, match);
        // Bir o'yinda bir NECHTA o'yinchi ball olishi mumkin va o'yin bir necha marta
        // "tugadi → undo" siklidan o'tishi mumkin. Shuning uchun shu o'yin jurnalining SOF
        // yig'indisi (MATCH_WIN + oldingi UNDO) har o'yinchi/izoh bo'yicha teskari qilinadi.
        const logged = await tx.playerPointsLog.findMany({
          where: { matchId, reason: { in: ['MATCH_WIN', 'UNDO'] } },
          select: { playerId: true, note: true, delta: true, exact: true },
        });
        for (const r of netReversal(logged)) {
          await applyPoints(tx, {
            playerId: r.playerId,
            delta: r.delta,
            exact: r.exact,
            reason: 'UNDO',
            matchId,
            tournamentId: match.tournamentId,
            note: r.note,
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
    isManager = false,
  ) {
    const updated = await this.prisma.$transaction(async (tx) => {
      const match = await this.lockMatch(tx, matchId);
      this.assertVerified(match, userId, isManager);
      if (match.status === 'FINISHED') {
        throw new BadRequestException("O'yin allaqachon yakunlangan");
      }
      const setCount = await tx.matchSet.count({ where: { matchId } });

      // Qoidalar 3.5.2.2–3.5.2.4: YELLOW — qoidabuzarlik qayd etildi.
      //  1-chi qoidabuzarlik: ogohlantirish (sariq);
      //  2-chi: raqibga 1 ochko (sariq + qizil birga);
      //  3-chi: raqibga 2 ochko (sariq + qizil birga);
      //  4-chi: o'yin to'xtatilib, bosh hakamga xabar beriladi (diskvalifikatsiya qarori).
      // RED (qo'lda) — bosh hakam qarori; faqat qayd etiladi, ochko berilmaydi.
      let penaltyPoints = 0;
      let storedType: 'YELLOW' | 'RED' = type;
      if (type === 'YELLOW') {
        const prior = await tx.matchCard.count({ where: { matchId, player } });
        if (prior >= 3) {
          throw new BadRequestException(
            "4-qoidabuzarlik: o'yinni to'xtating va bosh hakamga xabar bering (diskvalifikatsiya qarori) — 3.5.2.4",
          );
        }
        penaltyPoints = prior; // 0, 1, 2
        if (prior > 0) storedType = 'RED';
      }

      await tx.matchCard.create({
        data: {
          matchId,
          player,
          type: storedType,
          setNumber: setCount + 1,
          issuedByUserId: userId,
        },
      });

      let updatedMatch = await tx.match.update({
        where: { id: matchId },
        data: { seq: { increment: 1 } },
        include: this.publicInclude(),
      });
      await tx.matchEvent.create({
        data: {
          matchId,
          seq: updatedMatch.seq,
          type: 'CARD',
          payload: { player, cardType: storedType, penaltyPoints },
          actorUserId: userId,
        },
      });

      // Jarima ochkolari raqibga oddiy ochko sifatida (undo ham ishlaydi)
      const opponent: 1 | 2 = player === 1 ? 2 : 1;
      for (let i = 0; i < penaltyPoints; i++) {
        if (updatedMatch.status === 'FINISHED') break;
        updatedMatch = await this.pointTx(tx, matchId, opponent, userId, isManager);
      }
      return updatedMatch;
    });

    return this.emitAndReturn(updated);
  }

  /**
   * Taym-aut (3.4.4.2): har o'yinchi o'yin davomida BIR marta, 1 daqiqagacha. Faqat o'yin davomida
   * (ochkolar orasida) olinadi; ikkala tomon bir vaqtda so'rasa ham ikkalasi bittadan sarflaydi.
   */
  async timeout(matchId: string, player: 1 | 2, userId: string, isManager = false) {
    const updated = await this.prisma.$transaction(async (tx) => {
      const match = await this.lockMatch(tx, matchId);
      this.assertVerified(match, userId, isManager);
      if (match.status === 'FINISHED') {
        throw new BadRequestException("O'yin allaqachon yakunlangan");
      }
      const used = player === 1 ? match.timeoutP1Used : match.timeoutP2Used;
      if (used) {
        throw new BadRequestException("Bu o'yinchi taym-autni allaqachon olgan (o'yinda bir marta)");
      }
      const updatedMatch = await tx.match.update({
        where: { id: matchId },
        data: {
          ...(player === 1 ? { timeoutP1Used: true } : { timeoutP2Used: true }),
          timeoutPlayer: player,
          timeoutUntil: new Date(Date.now() + 60_000),
          seq: { increment: 1 },
        },
        include: this.publicInclude(),
      });
      await tx.matchEvent.create({
        data: {
          matchId,
          seq: updatedMatch.seq,
          type: 'TIMEOUT',
          payload: { player },
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
    isManager = false,
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
      this.assertVerified(match, userId, isManager);
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
        hasThirdPlace: !!match.loserNextMatchId,
        winnerId,
        // Diskvalifikatsiya qilingan o'yinchi finalda ishtirok ballini olmaydi
        loserId: null,
      });
      await this.propagateWinner(tx, match, winnerId);
      // Oddiy yakun bilan bir xil: yarim final yutqazgani 3-o'rin o'yiniga o'tadi — aks holda u
      // o'yin bitta o'yinchi bilan qotib qoladi (keyin hakam uni o'sha o'yinda hal qiladi)
      await this.propagateLoser(tx, match, disqualifiedId);

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

  /**
   * Nizom (rasmiy) hisobi. ҒР/ЮР — musobaqadan OLDINGI reyting: joriy ball minus shu
   * musobaqada yozilgan jurnal. Texnik g'alaba / raqibsiz (loserId yo'q) — ball yo'q (21-band).
   * Butun ball: yig'indiga yaxlitlanadi (xato yig'ilmaydi), `exact` jurnalda saqlanadi.
   */
  private async awardOfficial(
    tx: Tx,
    args: {
      matchId: string;
      tournamentId: string;
      stage: MatchStage;
      hasThirdPlace?: boolean;
      winnerId: string;
      loserId: string | null;
    },
    cfg: { k: number },
  ): Promise<number> {
    if (!args.loserId) return 0;

    const preRating = async (playerId: string): Promise<number> => {
      const [p, logged] = await Promise.all([
        tx.player.findUniqueOrThrow({
          where: { id: playerId },
          select: { rankingPoints: true },
        }),
        tx.playerPointsLog.aggregate({
          where: { playerId, tournamentId: args.tournamentId },
          _sum: { delta: true },
        }),
      ]);
      return p.rankingPoints - (logged._sum.delta ?? 0);
    };

    const [gr, yr] = await Promise.all([
      preRating(args.winnerId),
      preRating(args.loserId),
    ]);
    // Nizom 28: reyting tizimidan chiqarilgan (INACTIVE) sportchi ball olmaydi va yo'qotmaydi
    const inactive = new Set(
      (
        await tx.player.findMany({
          where: { id: { in: [args.winnerId, args.loserId] }, status: 'INACTIVE' },
          select: { id: true },
        })
      ).map((p) => p.id),
    );
    const exact = matchExactPoints({
      winnerRating: gr,
      loserRating: yr,
      k: cfg.k,
    });

    // Bonus bosqichlarida: musobaqa bo'yicha lock (qo'lda `?apply=1` bilan poyga bo'lmasin).
    // O'yinchi qatorlari qulflanishidan OLDIN olinadi — deadlock bo'lmasligi uchun.
    const bonusStage =
      args.stage === 'FINAL' ||
      args.stage === 'THIRD_PLACE' ||
      args.stage === 'QUARTERFINAL' ||
      (args.stage === 'SEMIFINAL' && !args.hasThirdPlace);
    if (bonusStage) await lockTournamentRating(tx, args.tournamentId);

    let winnerDelta = 0;
    const sides: Array<[string, number, string]> = [
      [args.winnerId, exact.winner, "Nizom: g'alaba"],
      [args.loserId, exact.loser, 'Nizom: mag‘lubiyat'],
    ];
    for (const [playerId, exactDelta, note] of sides) {
      const sums = await tx.playerPointsLog.aggregate({
        where: { playerId, tournamentId: args.tournamentId, exact: { not: null } },
        _sum: { exact: true, delta: true },
      });
      const delta = wholeDelta({
        exactTotalAfter: (sums._sum.exact ?? 0) + exactDelta,
        wholeSoFar: sums._sum.delta ?? 0,
      });
      if (inactive.has(playerId)) continue;
      if (delta === 0 && exactDelta === 0) continue;
      // Jurnalga HAQIQATDA qo'llangan delta yoziladi (0 chegarasi kesgan bo'lsa ham)
      const applied = await applyPoints(tx, {
        playerId,
        delta,
        exact: exactDelta,
        reason: 'MATCH_WIN',
        matchId: args.matchId,
        tournamentId: args.tournamentId,
        note,
      });
      if (playerId === args.winnerId) winnerDelta = applied;
    }

    // 1–8-o'rin bonuslari (Б) — o'rin aniq bo'lgan zahoti beriladi (efirda reyting yangilanishi shu bilan ko'rinadi):
    // final: 1/2; 3-o'rin o'yini: 3/4; chorak final yutqazgani: 5; yarim final yutqazgani — 3-o'rin o'yini bo'lmasa 3.
    const places: Array<[string, number]> = [];
    if (args.stage === 'FINAL') places.push([args.winnerId, 1], [args.loserId, 2]);
    else if (args.stage === 'THIRD_PLACE') places.push([args.winnerId, 3], [args.loserId, 4]);
    else if (args.stage === 'QUARTERFINAL') places.push([args.loserId, 5]);
    else if (args.stage === 'SEMIFINAL' && !args.hasThirdPlace) places.push([args.loserId, 3]);
    // Bonusi allaqachon amalda bo'lgan (masalan qo'lda `?apply=1`) o'yinchiga qayta berilmaydi
    const hasBonus = places.length
      ? await playersWithBonus(tx, args.tournamentId)
      : new Set<string>();
    for (const [playerId, place] of places) {
      if (inactive.has(playerId) || hasBonus.has(playerId)) continue;
      const bonus = placeBonus(place, cfg.k);
      if (bonus <= 0) continue;
      const applied = await applyPoints(tx, {
        playerId,
        delta: bonus,
        reason: 'MATCH_WIN',
        matchId: args.matchId,
        tournamentId: args.tournamentId,
        note: bonusNote(place),
      });
      if (playerId === args.winnerId) winnerDelta += applied;
    }
    return winnerDelta;
  }

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
      /** Yarim finaldan yutqazgan 3-o'rin o'yiniga o'tadimi (bonus 3/4 ni ajratish uchun) */
      hasThirdPlace?: boolean;
      winnerId: string;
      loserId: string | null;
    },
  ): Promise<number> {
    const tournament = await tx.tournament.findUnique({
      where: { id: args.tournamentId },
      include: {
        level: { include: { pointsRules: true } },
        ageCategory: { select: { code: true } },
      },
    });

    // Rasmiy Nizom: 1–3-formulalar (K · МРБ). Eski qat'iy ballar faqat LEGACY rejimda.
    if (tournament?.level.ratingMode === 'OFFICIAL') {
      return this.awardOfficial(tx, args, {
        k: tournamentK(tournament.level.ratingK, tournament.ageCategory?.code),
      });
    }

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
      // Sof yig'indi bo'yicha: undo qilingan o'yindagi ishtirok balli "berilgan" hisoblanmaydi
      const already = await tx.playerPointsLog.groupBy({
        by: ['playerId'],
        where: {
          tournamentId: args.tournamentId,
          playerId: { in: bothPlayers },
          note: RULE_LABEL_UZ.PARTICIPATION,
        },
        _sum: { delta: true },
      });
      const has = new Set(
        already.filter((a) => (a._sum.delta ?? 0) > 0).map((a) => a.playerId),
      );
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

    let total = 0;
    for (const award of awards) {
      total += await applyPoints(tx, {
        playerId: award.playerId,
        delta: award.points,
        reason: 'MATCH_WIN',
        matchId: args.matchId,
        tournamentId: args.tournamentId,
        note: RULE_LABEL_UZ[award.key],
      });
    }

    return total;
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

  /** Yarim final yutqazgani — 3-o'rin uchun o'yin slotiga (agar bunday o'yin bor bo'lsa) */
  private async propagateLoser(
    tx: Tx,
    match: { loserNextMatchId: string | null; loserNextMatchSlot: number | null },
    loserId: string | null,
  ) {
    if (!match.loserNextMatchId || !match.loserNextMatchSlot || !loserId) return;
    await tx.match.update({
      where: { id: match.loserNextMatchId },
      data: match.loserNextMatchSlot === 1 ? { player1Id: loserId } : { player2Id: loserId },
    });
  }

  private async unpropagateLoser(
    tx: Tx,
    match: { loserNextMatchId: string | null; loserNextMatchSlot: number | null },
  ) {
    if (!match.loserNextMatchId || !match.loserNextMatchSlot) return;
    const next = await tx.match.findUnique({ where: { id: match.loserNextMatchId }, select: { status: true } });
    if (next?.status !== 'SCHEDULED') return;
    await tx.match.update({
      where: { id: match.loserNextMatchId },
      data: match.loserNextMatchSlot === 1 ? { player1Id: null } : { player2Id: null },
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

  /**
   * Hisob kiritishga ruxsat: o'yin kod bilan tasdiqlangan VA foydalanuvchi shu o'yinning
   * hakami (kodni kiritgan yoki tayinlangan yetakchi/yordamchi). `match.manage` — istisno.
   */
  private assertVerified(
    match: {
      refereeVerifiedAt: Date | null;
      verifiedByUserId: string | null;
      refereeUserId: string | null;
      assistantUserId: string | null;
    },
    userId: string,
    isManager: boolean,
  ) {
    if (!match.refereeVerifiedAt) {
      throw new ForbiddenException('Avval hakam kodini tasdiqlang');
    }
    if (isManager) return;
    const allowed = [
      match.verifiedByUserId,
      match.refereeUserId,
      match.assistantUserId,
    ];
    if (!allowed.includes(userId)) {
      throw new ForbiddenException(
        'Bu o‘yinni boshqa hakam olib boryapti — avval hakam kodini kiriting',
      );
    }
  }

  /**
   * Undo o'yin natijasini bekor qilsa: keyingi bosqich (g'olib/yutqazgan o'tgan) o'yini hali
   * boshlanmagan bo'lishi shart. Qatorlar qulflanadi — tekshiruv va slotni tozalash orasida u
   * o'yin boshlanib qolmasin (tartib doim oldingi raund → keyingi, shuning uchun deadlock yo'q).
   */
  private async assertNextNotStarted(
    tx: Tx,
    match: { nextMatchId: string | null; loserNextMatchId: string | null },
  ) {
    for (const id of [match.nextMatchId, match.loserNextMatchId]) {
      if (!id) continue;
      const rows = await tx.$queryRaw<Array<{ status: string }>>`
        SELECT status::text AS status FROM matches WHERE id = ${id} FOR UPDATE`;
      if (rows.length && rows[0].status !== 'SCHEDULED') {
        throw new BadRequestException(
          "Keyingi bosqich o'yini allaqachon boshlangan — bu o'yin natijasini bekor qilib bo'lmaydi (administratorga murojaat qiling)",
        );
      }
    }
  }

  private genCode(): string {
    return newRefereeCode();
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
      referee: { select: { firstName: true, lastName: true } },
      assistant: { select: { firstName: true, lastName: true } },
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
    raw: Prisma.MatchGetPayload<{
      include: ReturnType<MatchesService['publicInclude']>;
    }>,
  ) {
    const board = raw.status === 'FINISHED' ? null : this.boardOf(raw.id);
    const m = board
      ? {
          ...raw,
          status: 'LIVE' as const,
          currentSetP1: board.points[0],
          currentSetP2: board.points[1],
          player1SetsWon: board.setsWon[0],
          player2SetsWon: board.setsWon[1],
          sets: board.sets.map((s, i) => ({ id: `board-${i}`, matchId: raw.id, setNumber: i + 1, p1Points: s[0], p2Points: s[1] })),
        }
      : raw;
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
      boardCourt: board?.court ?? null,
      scheduledAt: m.scheduledAt,
      bestOf: m.bestOf,
      seq: m.seq,
      server: live ? serverSlot(state) : null,
      pointAlert: live ? pointAlert(state) : null,
      sideChange: live ? sideChangeDue(state) : false,
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
      timeout: {
        p1Used: m.timeoutP1Used,
        p2Used: m.timeoutP2Used,
        activePlayer: m.timeoutUntil && m.timeoutUntil.getTime() > Date.now() ? m.timeoutPlayer : null,
        activeUntil: m.timeoutUntil && m.timeoutUntil.getTime() > Date.now() ? m.timeoutUntil : null,
        // Mijoz soati server soatidan farq qilsa ham hisoblagich to'g'ri ishlashi uchun qolgan vaqt (ms)
        remainingMs: m.timeoutUntil ? Math.max(0, m.timeoutUntil.getTime() - Date.now()) : 0,
      },
      winnerId: m.winnerId,
      winnerInfo,
      refereeVerified: m.refereeVerifiedAt !== null,
      disqualifiedPlayerId: m.disqualifiedPlayerId,
      disqualificationReason: m.disqualificationReason,
      disqualificationAudioUrl: m.disqualificationAudioUrl,
      // Faqat ism — id/email ommaga chiqmaydi
      referee: m.referee ? `${m.referee.firstName} ${m.referee.lastName}` : null,
      assistant: m.assistant ? `${m.assistant.firstName} ${m.assistant.lastName}` : null,
    };
  }

  private emitAndReturn(
    m: Prisma.MatchGetPayload<{
      include: ReturnType<MatchesService['publicInclude']>;
    }>,
  ) {
    const payload = this.toPublic(m);
    this.memoStore.clear(); // yangi holat darhol ko'rinsin
    this.live.emitScoreUpdate(m.id, m.tournamentId, payload);
    // O'yin tugadi: Telegram guruhiga natija va rasmlar (fonda; xato o'yinga ta'sir qilmaydi)
    if (m.status === 'FINISHED' && m.winnerId) {
      this.telegram.notifyFinished(m.id, m.seq);
      // Keyingi bosqichda yangi juftliklar aniq bo'ldi — hakami yo'q o'yinlarga tayinlash (fonda)
      this.assignment.autoAssignInBackground(m.tournamentId);
    }
    return payload;
  }
}
