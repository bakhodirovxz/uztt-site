/**
 * Tekshiruv uchun yaratilgan sinov musobaqalarini va ular bergan ballarni
 * tozalaydi: ballar o'yinchilardan qaytariladi, jurnal yozuvlari va
 * musobaqaning o'zi (o'yinlari bilan birga) o'chiriladi.
 *
 *   ts-node --transpile-only scripts/cleanup-test-tournaments.ts "<nom bo'lagi>"
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const patterns = process.argv.slice(2);
if (patterns.length === 0) {
  console.error('Nom bo\'lagini bering, masalan: "sinovi"');
  process.exit(1);
}

async function main() {
  const tournaments = await prisma.tournament.findMany({
    where: { OR: patterns.map((p) => ({ name: { contains: p } })) },
    select: { id: true, name: true },
  });
  if (tournaments.length === 0) {
    console.log('Mos musobaqa topilmadi');
    return;
  }

  for (const t of tournaments) {
    const awarded = await prisma.playerPointsLog.groupBy({
      by: ['playerId'],
      where: { tournamentId: t.id },
      _sum: { delta: true },
    });

    await prisma.$transaction(async (tx) => {
      for (const row of awarded) {
        const delta = row._sum.delta ?? 0;
        if (delta === 0) continue;
        const player = await tx.player.findUnique({
          where: { id: row.playerId },
          select: { rankingPoints: true },
        });
        await tx.player.update({
          where: { id: row.playerId },
          data: {
            rankingPoints: Math.max(0, (player?.rankingPoints ?? 0) - delta),
          },
        });
      }
      await tx.playerPointsLog.deleteMany({ where: { tournamentId: t.id } });
      // O'yinlar tournament bilan kaskad o'chadi
      await tx.tournament.delete({ where: { id: t.id } });
    });

    console.log(
      `  "${t.name}" o'chirildi — ${awarded.length} o'yinchidan ballar qaytarildi`,
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
