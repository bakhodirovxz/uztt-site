/**
 * Musobaqadan OLDINGI reyting kesimini tiklaydi (audit izidan).
 *
 * Nega kerak: kesim musobaqadan keyin olinsa, taqqoslash uchun baza qolmaydi
 * va jadvalda ▲▼ umuman ko'rinmaydi. To'g'ri tartib — kesim musobaqa
 * boshlanishidan oldin olinadi. Bu skript ballar jurnalidan (PlayerPointsLog)
 * musobaqada berilgan ballarni ayirib, o'sha holatni qayta yaratadi.
 *
 *   ts-node --transpile-only scripts/pre-tournament-snapshot.ts <turnir-slug> [yorliq]
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const slug = process.argv[2] ?? 'ozbekiston-chempionati-2026';
const label = process.argv[3] ?? `${slug}-gacha`;

async function main() {
  const tournament = await prisma.tournament.findUnique({ where: { slug } });
  if (!tournament) throw new Error(`Musobaqa topilmadi: ${slug}`);

  const players = await prisma.player.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, rankingPoints: true, gender: true, ageCategoryId: true },
  });

  // Shu musobaqada berilgan ballar — ularni ayiramiz
  const awarded = await prisma.playerPointsLog.groupBy({
    by: ['playerId'],
    where: { tournamentId: tournament.id },
    _sum: { delta: true },
  });
  const awardedBy = new Map(awarded.map((a) => [a.playerId, a._sum.delta ?? 0]));

  const before = players
    .map((p) => ({
      ...p,
      points: Math.max(0, p.rankingPoints - (awardedBy.get(p.id) ?? 0)),
    }))
    .sort((a, b) => b.points - a.points);

  await prisma.$transaction(async (tx) => {
    await tx.rankingSnapshot.deleteMany({ where: { label } });
    await tx.rankingSnapshot.create({
      data: {
        label,
        isAuto: false,
        // Musobaqa boshlanishidan bir kun oldin — keyingi kesimlar undan yangi bo'ladi
        takenAt: new Date(tournament.startDate.getTime() - 86_400_000),
        entries: {
          create: before.map((p, i) => ({
            playerId: p.id,
            rank: i + 1,
            points: p.points,
            gender: p.gender,
            ageCategoryId: p.ageCategoryId,
          })),
        },
      },
    });
  });

  const moved = before.filter((p) => (awardedBy.get(p.id) ?? 0) > 0).length;
  console.log(
    `"${label}" kesimi yaratildi: ${before.length} o'yinchi, ` +
      `${moved} tasi shu musobaqada ball to'plagan`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
