import { createHash } from 'crypto';
import { playerSlugBase, playerSlugCandidates, playerSlugSuffix } from './player-slug';

describe('player slug (PINFL\'siz)', () => {
  const id = '3f2b9c1e-0000-4000-8000-000000000001';

  it('suffiks migratsiya formulasi bilan bir xil: left(md5(id || \'uztt-slug\'), n)', () => {
    const md5 = createHash('md5').update(`${id}uztt-slug`).digest('hex');
    expect(playerSlugSuffix(id, 5)).toBe(md5.slice(0, 5));
    expect(playerSlugSuffix(id, 8)).toBe(md5.slice(0, 8));
  });

  it('nomzodlar uzayib boradi (5, 8, 12, 32) va PINFL raqamlarini o\'z ichiga olmaydi', () => {
    const pinfl = '12345678901234';
    const c = playerSlugCandidates("Qo'chqorov Aziz Sobirovich", id);
    expect(c.map((s) => s.split('-').pop()!.length)).toEqual([5, 8, 12, 32]);
    expect(c[0].startsWith('qochqorov-aziz-sobirovich-')).toBe(true);
    for (const s of c) {
      expect(s).not.toContain(pinfl.slice(0, 5));
      expect(s).not.toContain(pinfl.slice(-5));
    }
  });

  it('bo\'sh/belgisiz ism — "oyinchi"', () => {
    expect(playerSlugBase('!!!')).toBe('oyinchi');
    expect(playerSlugBase('Ali  Valiyev')).toBe('ali-valiyev');
  });
});
