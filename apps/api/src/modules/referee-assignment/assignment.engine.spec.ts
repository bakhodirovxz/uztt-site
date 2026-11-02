import { assignReferees, AsgMatch, AsgReferee } from './assignment.engine';

const t = (min: number) => new Date(Date.UTC(2026, 10, 1, 9, min));
const m = (id: string, o: Partial<AsgMatch> = {}): AsgMatch => ({
  id, stage: 'ROUND_1', scheduledAt: t(0), tableNumber: 1, playerIds: ['p1', 'p2'], playerRegions: ['Toshkent', 'Samarqand'],
  refereeUserId: null, assistantUserId: null, locked: false, ...o,
});
const r = (userId: string, o: Partial<AsgReferee> = {}): AsgReferee => ({ userId, region: null, category: 'FIRST', ownPlayerId: null, ...o });

describe('assignReferees', () => {
  it('ishtirokchi o‘z o‘yiniga hakam bo‘lmaydi', () => {
    const res = assignReferees([m('a')], [r('u1', { ownPlayerId: 'p1' }), r('u2')], { needAssistant: false });
    expect(res[0].refereeUserId).toBe('u2');
  });

  it('bir vaqtdagi ikki o‘yinga bitta hakam qo‘yilmaydi', () => {
    const res = assignReferees([m('a'), m('b', { tableNumber: 2 })], [r('u1'), r('u2')], { needAssistant: false });
    expect(new Set(res.map((x) => x.refereeUserId)).size).toBe(2);
  });

  it('vaqti kesishmasa bitta hakam ketma-ket o‘ynaydi', () => {
    const res = assignReferees([m('a'), m('b', { scheduledAt: t(60) })], [r('u1')], { needAssistant: false });
    expect(res.every((x) => x.refereeUserId === 'u1')).toBe(true);
  });

  it('hakam yetmasa sabab bilan null qaytadi', () => {
    const res = assignReferees([m('a'), m('b')], [r('u1')], { needAssistant: false });
    expect(res.filter((x) => x.refereeUserId === null)).toHaveLength(1);
    expect(res.find((x) => x.refereeUserId === null)?.reason).toBeTruthy();
  });

  it('yordamchi yetakchidan farqli va u ham band emas', () => {
    const res = assignReferees([m('a')], [r('u1'), r('u2')]);
    expect(res[0].refereeUserId).not.toBe(res[0].assistantUserId);
    expect(res[0].assistantUserId).toBeTruthy();
  });

  it('o‘z hududidagi o‘yinga qo‘ymaslikka urinadi (xolislik)', () => {
    const res = assignReferees([m('a')], [r('u1', { region: 'Toshkent' }), r('u2', { region: 'Buxoro' })], { needAssistant: false });
    expect(res[0].refereeUserId).toBe('u2');
  });

  it('final yuqori toifali hakamga beriladi', () => {
    const res = assignReferees(
      [m('f', { stage: 'FINAL' })],
      [r('low', { category: 'THIRD' }), r('hi', { category: 'NATIONAL' })],
      { needAssistant: false },
    );
    expect(res[0].refereeUserId).toBe('hi');
  });

  it('yuklama teng taqsimlanadi', () => {
    const ms = [0, 60, 120, 180].map((x, i) => m('m' + i, { scheduledAt: t(x) }));
    const res = assignReferees(ms, [r('u1'), r('u2')], { needAssistant: false });
    const c = res.reduce<Record<string, number>>((a, x) => ((a[x.refereeUserId!] = (a[x.refereeUserId!] ?? 0) + 1), a), {});
    expect(c.u1).toBe(2);
    expect(c.u2).toBe(2);
  });

  it('onlyUnassigned: mavjud tayinni o‘zgartirmaydi va hisobga oladi', () => {
    const res = assignReferees([m('a', { refereeUserId: 'u1' }), m('b')], [r('u1'), r('u2')], { needAssistant: false });
    expect(res).toHaveLength(1);
    expect(res[0].matchId).toBe('b');
    expect(res[0].refereeUserId).toBe('u2'); // u1 a da band
  });

  it('tugagan/boshlangan (locked) o‘yinga tegmaydi', () => {
    const res = assignReferees([m('a', { locked: true })], [r('u1')], { onlyUnassigned: false });
    expect(res).toHaveLength(0);
  });

  it('natija deterministik', () => {
    const ms = [m('a'), m('b', { scheduledAt: t(60) })];
    const rs = [r('u2'), r('u1')];
    expect(assignReferees(ms, rs)).toEqual(assignReferees(ms, rs));
  });
});
