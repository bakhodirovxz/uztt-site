import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { planTables } from './table-plan';

/** Musobaqaning stol sozlamasi bo'yicha o'yinlarga stol belgilaydi (table-plan.ts) */
@Injectable()
export class TableAssignService {
  private readonly log = new Logger(TableAssignService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Stolsiz o'yinlarni to'ldiradi; adminning qo'lda qo'ygan stoli saqlanadi.
   * all: boshlanmagan hamma o'yin qaytadan taqsimlanadi. Kodi tasdiqlangan yoki boshlangan o'yin
   * ikkala holatda ham ko'chirilmaydi: planshet shu stolda turibdi.
   */
  async fill(tournamentId: string, opts: { all?: boolean } = {}): Promise<{ assigned: number }> {
    const t = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { tableCount: true, mainTables: true },
    });
    if (!t?.tableCount) return { assigned: 0 };

    const rows = await this.prisma.match.findMany({
      where: { tournamentId, status: { not: 'FINISHED' } },
      orderBy: [{ scheduledAt: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true, stage: true, status: true, tableNumber: true, refereeVerifiedAt: true,
        player1: { select: { rankingPoints: true } },
        player2: { select: { rankingPoints: true } },
      },
    });
    const plan = planTables(
      rows.map((m) => ({
        id: m.id,
        stage: m.stage,
        rating: (m.player1?.rankingPoints ?? 0) + (m.player2?.rankingPoints ?? 0),
        table: opts.all && m.status === 'SCHEDULED' && !m.refereeVerifiedAt ? null : m.tableNumber,
      })),
      { tableCount: t.tableCount, mainTables: t.mainTables },
    );
    const updates = [...plan].filter(([id, table]) => rows.find((m) => m.id === id)?.tableNumber !== table);
    if (updates.length) {
      await this.prisma.$transaction(
        updates.map(([id, tableNumber]) => this.prisma.match.update({ where: { id }, data: { tableNumber } })),
      );
      this.log.log(`Stollar: ${tournamentId} — ${updates.length} ta o'yin`);
    }
    return { assigned: updates.length };
  }
}
