import { PrismaService } from '../src/prisma/prisma.service';
import { addPlayerPoints } from '../src/common/points';

/** Bazaga to'g'ridan-to'g'ri: ball hech qachon minusga tushmaydi va butun bo'ladi. */
describe('Ball xavfsizligi (e2e, DB)', () => {
  const prisma = new PrismaService();
  let id: string;

  beforeAll(async () => {
    await prisma.$connect();
    const p = await prisma.player.create({
      data: {
        slug: `ball-test-${Date.now()}`,
        firstName: 'Ball',
        lastName: 'Test',
        gender: 'MALE',
        region: 'Test',
        rankingPoints: 5,
      },
    });
    id = p.id;
  });

  afterAll(async () => {
    await prisma.player.delete({ where: { id } });
    await prisma.$disconnect();
  });

  const pts = async () =>
    (await prisma.player.findUniqueOrThrow({ where: { id } })).rankingPoints;

  it('undo ballni minusga tushirmaydi (5 - 20 → 0)', async () => {
    await prisma.$transaction((tx) => addPlayerPoints(tx, id, -20));
    expect(await pts()).toBe(0);
  });

  it('kasr delta butunga yaxlitlanadi (+3.6 → +4)', async () => {
    await prisma.$transaction((tx) => addPlayerPoints(tx, id, 3.6));
    expect(await pts()).toBe(4);
  });

  it('bazaning CHECK cheklovi to‘g‘ridan-to‘g‘ri minusni rad etadi', async () => {
    await expect(
      prisma.player.update({ where: { id }, data: { rankingPoints: -1 } }),
    ).rejects.toThrow();
  });
});
