import { isoWeekLabel, movementOf, rankWithin } from './ranking.util';

describe('isoWeekLabel', () => {
  it('yil o‘rtasidagi oddiy sanani to‘g‘ri haftaga soladi', () => {
    // 2026-08-11 — seshanba, ISO bo'yicha 33-hafta
    expect(isoWeekLabel(new Date(2026, 7, 11))).toBe('2026-W33');
  });

  it('hafta raqamini ikki xonali qilib to‘ldiradi', () => {
    expect(isoWeekLabel(new Date(2026, 0, 8))).toBe('2026-W02');
  });

  it('yil boshidagi kunlarni oldingi yilning oxirgi haftasiga qo‘shadi', () => {
    // 2027-01-01 — juma; ISO qoidasi bo'yicha bu 2026-yilning 53-haftasi
    expect(isoWeekLabel(new Date(2027, 0, 1))).toBe('2026-W53');
  });

  it('yil oxiridagi kunlarni keyingi yilning 1-haftasiga qo‘shadi', () => {
    // 2025-12-29 — dushanba, 2026-yilning 1-haftasi boshlanadi
    expect(isoWeekLabel(new Date(2025, 11, 29))).toBe('2026-W01');
  });
});

describe('rankWithin', () => {
  const e = (playerId: string, points: number, rank: number) => ({
    playerId,
    points,
    rank,
  });

  it('ball bo‘yicha kamayish tartibida o‘rin beradi', () => {
    const ranks = rankWithin([e('a', 100, 5), e('b', 300, 1), e('c', 200, 3)]);
    expect(ranks.get('b')).toBe(1);
    expect(ranks.get('c')).toBe(2);
    expect(ranks.get('a')).toBe(3);
  });

  it('teng ballda bir xil o‘rin beradi, keyingisi sonini o‘tkazib yuboradi', () => {
    const ranks = rankWithin([e('a', 500, 1), e('b', 500, 2), e('c', 100, 3)]);
    expect(ranks.get('a')).toBe(1);
    expect(ranks.get('b')).toBe(1);
    expect(ranks.get('c')).toBe(3);
  });

  it('teng ballda kesimdagi eski o‘rinni saqlaydi (barqaror tartib)', () => {
    const ranks = rankWithin([e('late', 500, 9), e('early', 500, 2)]);
    // Ikkalasi ham 1-o'rin, lekin tartibi eski o'ringa qarab barqaror
    expect(ranks.get('early')).toBe(1);
    expect(ranks.get('late')).toBe(1);
  });

  it('bo‘sh ro‘yxatda bo‘sh xarita qaytaradi', () => {
    expect(rankWithin([]).size).toBe(0);
  });
});

describe('o‘rin qo‘yish qoidasi jonli jadval va kesimda bir xil', () => {
  // Regressiya: jonli jadval ketma-ket raqam (32, 33), kesim esa teng o'rin
  // (32, 32) bergani uchun teng ballli o'yinchi hech narsa o'zgarmagan holda
  // "▼1" ko'rinardi — va hech kim ko'tarilmasdi.
  it('hech narsa o‘zgarmagan bo‘lsa, teng ballda ham hamma movement = 0', () => {
    const table = [
      { playerId: 'a', points: 700, rank: 1 },
      { playerId: 'b', points: 522, rank: 2 },
      { playerId: 'c', points: 522, rank: 3 }, // teng ball
      { playerId: 'd', points: 480, rank: 4 },
    ];

    const current = rankWithin(table);
    const snapshot = rankWithin(table);

    for (const row of table) {
      expect(
        movementOf(current.get(row.playerId)!, snapshot.get(row.playerId)),
      ).toBe(0);
    }
    // Teng ballli ikkisi bir xil o'rinda turadi
    expect(current.get('b')).toBe(current.get('c'));
    expect(current.get('d')).toBe(4);
  });

  it('ball o‘zgarganda haqiqiy harakat ko‘rinadi', () => {
    const before = rankWithin([
      { playerId: 'a', points: 700, rank: 1 },
      { playerId: 'b', points: 500, rank: 2 },
      { playerId: 'c', points: 300, rank: 3 },
    ]);
    // c ball to'pladi va yuqoriga chiqdi
    const after = rankWithin([
      { playerId: 'c', points: 900, rank: 1 },
      { playerId: 'a', points: 700, rank: 2 },
      { playerId: 'b', points: 500, rank: 3 },
    ]);

    expect(movementOf(after.get('c')!, before.get('c'))).toBe(2); // ▲2
    expect(movementOf(after.get('a')!, before.get('a'))).toBe(-1); // ▼1
    expect(movementOf(after.get('b')!, before.get('b'))).toBe(-1); // ▼1
  });
});

describe('movementOf', () => {
  it('yuqoriga ko‘tarilishni musbat ko‘rsatadi', () => {
    expect(movementOf(3, 7)).toBe(4);
  });

  it('pastga tushishni manfiy ko‘rsatadi', () => {
    expect(movementOf(9, 4)).toBe(-5);
  });

  it('o‘rin o‘zgarmasa nolga teng', () => {
    expect(movementOf(5, 5)).toBe(0);
  });

  it('oldingi kesimda bo‘lmagan o‘yinchida null (yangi)', () => {
    expect(movementOf(12, undefined)).toBeNull();
  });
});
