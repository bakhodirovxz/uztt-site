import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { assignReferees, AsgMatch, AsgReferee } from './assignment.engine';
import { TableAssignService } from './table-assign.service';

@Injectable()
export class AssignmentService implements OnModuleDestroy {
  private readonly log = new Logger(AssignmentService.name);
  /** Bir turnirda bir vaqtda ikki marta ishlamasin */
  private readonly running = new Set<string>();

  /** Fonda ishlayotgan tayinlashlar — ilova yopilganda tugashi kutiladi (yarim yo'lda uzilib qolmasin) */
  private readonly pending = new Set<Promise<void>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly tables: TableAssignService,
  ) {}

  async onModuleDestroy() {
    await Promise.allSettled([...this.pending]);
  }

  /** O'yin tugaganda chaqiriladi: javobni kutdirmaydi, lekin yo'qolib ham ketmaydi */
  autoAssignInBackground(tournamentId: string): void {
    const p: Promise<void> = this.autoAssign(tournamentId).finally(() => this.pending.delete(p));
    this.pending.add(p);
  }

  /** Tayinlanishi mumkin bo'lgan hakamlar: tasdiqlangan, band emas, REFEREE roli bor */
  private async pool(): Promise<AsgReferee[]> {
    const rows = await this.prisma.refereeProfile.findMany({
      where: { status: 'APPROVED', available: true, user: { status: 'ACTIVE', roles: { some: { role: { code: 'REFEREE' } } } } },
      select: { userId: true, region: true, category: true },
    });
    const own = await this.prisma.player.findMany({
      where: { userId: { in: rows.map((r) => r.userId) } },
      select: { id: true, userId: true },
    });
    const ownMap = new Map(own.map((p) => [p.userId!, p.id]));
    return rows.map((r) => ({ userId: r.userId, region: r.region, category: r.category, ownPlayerId: ownMap.get(r.userId) ?? null }));
  }

  private async loadMatches(tournamentId: string): Promise<AsgMatch[]> {
    const ms = await this.prisma.match.findMany({
      where: { tournamentId },
      select: {
        id: true, stage: true, scheduledAt: true, tableNumber: true, status: true, refereeVerifiedAt: true,
        player1Id: true, player2Id: true, refereeUserId: true, assistantUserId: true,
        player1: { select: { region: true } }, player2: { select: { region: true } },
      },
    });
    return ms.map((m) => ({
      id: m.id,
      stage: m.stage,
      scheduledAt: m.scheduledAt,
      tableNumber: m.tableNumber,
      playerIds: [m.player1Id, m.player2Id],
      playerRegions: [m.player1?.region ?? null, m.player2?.region ?? null],
      refereeUserId: m.refereeUserId,
      assistantUserId: m.assistantUserId,
      locked: m.status !== 'SCHEDULED' || !!m.refereeVerifiedAt,
    }));
  }

  /** Turnirdagi barcha o'yinlarga hakam tayinlash. dryRun — faqat natijani ko'rsatadi, yozmaydi. */
  async assignTournament(tournamentId: string, opts: { dryRun?: boolean; onlyUnassigned?: boolean; needAssistant?: boolean } = {}) {
    const t = await this.prisma.tournament.findUnique({ where: { id: tournamentId }, select: { id: true } });
    if (!t) throw new NotFoundException('Musobaqa topilmadi');
    const [matches, referees] = await Promise.all([this.loadMatches(tournamentId), this.pool()]);
    if (!referees.length) throw new BadRequestException('Tasdiqlangan hakamlar yo‘q');
    const results = assignReferees(matches, referees, {
      onlyUnassigned: opts.onlyUnassigned ?? true,
      needAssistant: opts.needAssistant ?? true,
    });
    if (!opts.dryRun) {
      const now = new Date();
      await this.prisma.$transaction(
        results
          .filter((r) => r.refereeUserId)
          .map((r) =>
            this.prisma.match.update({
              where: { id: r.matchId },
              data: { refereeUserId: r.refereeUserId, assistantUserId: r.assistantUserId, refereeAssignedAt: now, seq: { increment: 1 } },
            }),
          ),
      );
    }
    return {
      dryRun: !!opts.dryRun,
      assigned: results.filter((r) => r.refereeUserId).length,
      unassigned: results.filter((r) => !r.refereeUserId).length,
      results,
    };
  }

  /** Qo'lda tayinlash / almashtirish. null yuborilsa tayin olib tashlanadi. */
  async setManual(matchId: string, referee: string | null, assistant: string | null) {
    const m = await this.prisma.match.findUnique({
      where: { id: matchId },
      select: { id: true, status: true, player1Id: true, player2Id: true, tournamentId: true, scheduledAt: true },
    });
    if (!m) throw new NotFoundException('O‘yin topilmadi');
    if (m.status === 'FINISHED') throw new BadRequestException('Tugagan o‘yinga hakam tayinlanmaydi');
    if (referee && referee === assistant) throw new BadRequestException('Yetakchi va yordamchi hakam bitta odam bo‘lolmaydi');
    if (assistant && !referee) throw new BadRequestException('Avval yetakchi hakamni tanlang');

    const ids = [referee, assistant].filter((x): x is string => !!x);
    if (ids.length) {
      const pool = await this.pool();
      const ok = new Map(pool.map((p) => [p.userId, p]));
      for (const id of ids) {
        const p = ok.get(id);
        if (!p) throw new BadRequestException('Tanlangan foydalanuvchi tasdiqlangan hakam emas');
        if (p.ownPlayerId && (p.ownPlayerId === m.player1Id || p.ownPlayerId === m.player2Id)) {
          throw new BadRequestException('Ishtirokchi o‘z o‘yinida hakam bo‘la olmaydi (4.6.1.1)');
        }
      }
      // Bir vaqtda boshqa o'yinda emasligini tekshirish (ogohlantirish emas, rad)
      if (m.scheduledAt) {
        const from = new Date(m.scheduledAt.getTime() - 45 * 60_000);
        const to = new Date(m.scheduledAt.getTime() + 45 * 60_000);
        const clash = await this.prisma.match.findFirst({
          where: {
            id: { not: matchId },
            scheduledAt: { gt: from, lt: to },
            status: { not: 'FINISHED' },
            OR: [{ refereeUserId: { in: ids } }, { assistantUserId: { in: ids } }],
          },
          select: { id: true },
        });
        if (clash) throw new BadRequestException('Hakam shu vaqtda boshqa o‘yinga tayinlangan');
      }
    }
    return this.prisma.match.update({
      where: { id: matchId },
      data: { refereeUserId: referee, assistantUserId: assistant, refereeAssignedAt: referee ? new Date() : null, seq: { increment: 1 } },
      select: { id: true, refereeUserId: true, assistantUserId: true, refereeAssignedAt: true },
    });
  }

  /** Setka/guruh yaratilgandan va o'yinlar tugagach chaqiriladi; xato asosiy jarayonga ta'sir qilmaydi. */
  async autoAssign(tournamentId: string): Promise<void> {
    if (this.running.has(tournamentId)) return;
    this.running.add(tournamentId);
    try {
      // Qura tashlangan yoki yangi juftlik chiqqan: avval stol (xato bo'lsa hakam tayinlash to'xtamasin)
      await this.tables.fill(tournamentId).catch((e) => this.log.warn(`Stollar: ${String(e)}`));
      // Juftligi aniq bo'lgan, hakami yo'q o'yinlar (TBD o'yinlar engine'da ham o'tkazib yuboriladi)
      const pending = await this.prisma.match.count({
        where: {
          tournamentId,
          status: 'SCHEDULED',
          refereeUserId: null,
          player1Id: { not: null },
          player2Id: { not: null },
        },
      });
      if (!pending) return;
      await this.assignTournament(tournamentId, { onlyUnassigned: true });
    } catch (e) {
      // "Hakamlar yo'q" — normal holat, shovqin qilmaymiz
      if (!(e instanceof BadRequestException)) this.log.warn(`autoAssign(${tournamentId}): ${(e as Error).message}`);
    } finally {
      this.running.delete(tournamentId);
    }
  }

  /** Hakam uchun: unga tayinlangan (yoki yordamchi) hali tugamagan o'yinlar */
  mine(userId: string) {
    return this.prisma.match.findMany({
      where: { status: { not: 'FINISHED' }, OR: [{ refereeUserId: userId }, { assistantUserId: userId }] },
      orderBy: [{ scheduledAt: 'asc' }, { tableNumber: 'asc' }],
      select: {
        id: true, stage: true, tableNumber: true, scheduledAt: true, status: true, tournamentId: true,
        player1: { select: { id: true, firstName: true, lastName: true } }, player2: { select: { id: true, firstName: true, lastName: true } },
        refereeUserId: true, assistantUserId: true,
      },
      take: 100,
    });
  }

  /** Admin paneli uchun: musobaqadagi hakamlar ro'yxati va yuklamasi */
  async overview(tournamentId: string) {
    const [matches, pool] = await Promise.all([
      this.prisma.match.findMany({
        where: { tournamentId },
        orderBy: [{ scheduledAt: 'asc' }, { tableNumber: 'asc' }],
        select: {
          id: true, stage: true, tableNumber: true, scheduledAt: true, status: true,
          refereeUserId: true, assistantUserId: true,
          player1: { select: { firstName: true, lastName: true } }, player2: { select: { firstName: true, lastName: true } },
        },
        take: 2000,
      }),
      this.prisma.refereeProfile.findMany({
        where: { status: 'APPROVED' },
        select: { userId: true, region: true, category: true, available: true, user: { select: { firstName: true, lastName: true } } },
      }),
    ]);
    const load = new Map<string, number>();
    for (const m of matches) for (const u of [m.refereeUserId, m.assistantUserId]) if (u) load.set(u, (load.get(u) ?? 0) + 1);
    return {
      matches,
      referees: pool.map((r) => ({ userId: r.userId, name: `${r.user.firstName} ${r.user.lastName}`, region: r.region, category: r.category, available: r.available, load: load.get(r.userId) ?? 0 })),
    };
  }
}
