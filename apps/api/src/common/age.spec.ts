import { birthDateFloor } from './age';

describe('yosh segmenti (kumulyativ)', () => {
  const now = new Date('2026-11-01T00:00:00Z');
  it('U-13: 13 yosh va kichiklar (2013 va keyin tug‘ilganlar)', () => {
    expect(birthDateFloor(13, now)?.toISOString().slice(0, 10)).toBe('2013-01-01');
  });
  it('U-15 U-13 ni to‘liq qamrab oladi (chegarasi oldinroq)', () => {
    expect(birthDateFloor(15, now)!.getTime()).toBeLessThan(birthDateFloor(13, now)!.getTime());
  });
  it('Kattalar — cheklovsiz', () => {
    expect(birthDateFloor(null, now)).toBeUndefined();
    expect(birthDateFloor(undefined, now)).toBeUndefined();
  });
});
