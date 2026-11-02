import { headBox } from './avatar-crop';

/** Sun'iy alfa niqobi: doira bosh + keng gavda (qo'llar yon tomonga chiqqan) */
function figure(width: number, height: number, head: { cx: number; top: number; r: number }, body: { top: number; left: number; right: number }) {
  const a = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const inHead = (x - head.cx) ** 2 + (y - (head.top + head.r)) ** 2 <= head.r ** 2;
      const inBody = y >= body.top && x >= body.left && x <= body.right;
      if (inHead || inBody) a[y * width + x] = 255;
    }
  }
  return a;
}

describe('avatar: bosh atrofida kesish', () => {
  it('boshni markazga oladi, gavdaning kengligiga aldanmaydi', () => {
    // 450×600, bosh markazi x=200 (o'ngga qo'llar chiqib turadi), radius 70
    const a = figure(450, 600, { cx: 200, top: 10, r: 70 }, { top: 180, left: 40, right: 440 });
    const box = headBox(a, 450, 600)!;
    expect(box).not.toBeNull();
    // kvadrat markazi bosh markaziga yaqin (gavda markazi 240 bo'lardi)
    expect(Math.abs(box.left + box.size / 2 - 200)).toBeLessThan(15);
    // bosh kadrning yuqori qismida, kadr bosh + yelkani qamraydi (butun gavdani emas)
    expect(box.top).toBeLessThanOrEqual(10);
    expect(box.size).toBeGreaterThan(140);
    expect(box.size).toBeLessThan(450);
  });

  it('kvadrat rasm chegarasidan chiqmaydi', () => {
    const a = figure(300, 400, { cx: 20, top: 0, r: 60 }, { top: 120, left: 0, right: 299 });
    const box = headBox(a, 300, 400)!;
    expect(box.left).toBeGreaterThanOrEqual(0);
    expect(box.top).toBeGreaterThanOrEqual(0);
    expect(box.left + box.size).toBeLessThanOrEqual(300);
    expect(box.top + box.size).toBeLessThanOrEqual(400);
  });

  it("to'liq shaffof (bo'sh) rasmda bosh yo'q — null (chaqiruvchi oddiy kesishga o'tadi)", () => {
    expect(headBox(new Uint8Array(100 * 100), 100, 100)).toBeNull();
  });
});
