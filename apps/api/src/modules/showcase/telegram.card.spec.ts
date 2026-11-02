import sharp from 'sharp';
import { buildCardSvg, esc, renderCardPng, type CardData } from './telegram.card';

const base: CardData = {
  title: 'Prezident Olimpiadasi 2026',
  subtitle: 'Table 3 - FINAL',
  rating: true,
  games: [[11, 5], [7, 11], [11, 9]],
  players: [
    { name: "O'RINOVA", given: 'Mubinaxon', country: 'UZ', photo: null, won: false, sets: 1, before: 59.14, after: 59.14, delta: 0, rankBefore: 385, rankAfter: 385 },
    { name: 'TOSHNIYOZOVA', given: 'Munira', country: 'UZ', photo: null, won: true, sets: 2, before: 59.14, after: 69.14, delta: 10, rankBefore: 385, rankAfter: 321 },
  ],
};

describe('Telegram natija kartochkasi', () => {
  it('gorizontal PNG aynan 1920x1080', async () => {
    const png = await renderCardPng(base, 'h');
    const m = await sharp(png).metadata();
    expect([m.width, m.height, m.format]).toEqual([1920, 1080, 'png']);
  });
  it('vertikal PNG aynan 1080x1920', async () => {
    const png = await renderCardPng(base, 'v');
    const m = await sharp(png).metadata();
    expect([m.width, m.height]).toEqual([1080, 1920]);
  });
  it("reytingsiz (faqat natija) kartochka ham chiziladi", async () => {
    const png = await renderCardPng({ ...base, rating: false }, 'h');
    expect((await sharp(png).metadata()).width).toBe(1920);
  });
  it("matn XSS/SVG-injection'dan himoyalangan", () => {
    const evil = { ...base, players: [{ ...base.players[0], name: '"><script>alert(1)</script>' }, base.players[1]] } as CardData;
    const svg = buildCardSvg(evil, 'h');
    expect(svg).not.toContain('<script>');
    expect(esc('<&">')).toBe('&#60;&#38;&#34;&#62;');
  });
  it("rasm bo'lmasa bosh harflar chiqadi, kartochka bo'sh emas", async () => {
    const png = await renderCardPng(base, 'h');
    const { data } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
    const distinct = new Set<number>();
    for (let i = 0; i < data.length; i += 4 * 997) distinct.add(data[i]);
    expect(distinct.size).toBeGreaterThan(20);
  });
});
