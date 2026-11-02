// uttf.uz dan o'yinchi rasmlarini yuklab oladi (internet kerak) → apps/web/public/uttf-import/players
// Ishlatish: 5-rasmlar.bat. Mavjud fayllar qayta yuklanmaydi (to'xtab qolsa — davom ettiradi).
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'apps', 'web', 'public', 'uttf-import', 'players');
mkdirSync(dir, { recursive: true });
const BASE = process.env.UTTF_BASE ?? 'https://uttf.uz';
const map = JSON.parse(readFileSync(join(root, 'demo-data', 'photo-map.json'), 'utf8'));
const ids = [...new Set(Object.values(map))];
const have = new Set(readdirSync(dir).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).map((f) => f.replace(/\.[^.]+$/, '')));
const todo = ids.filter((id) => !have.has(id));
console.log(`Jami ${ids.length} ta rasm, mavjud ${have.size}, yuklanadi ${todo.length}.`);

/** Fayl turini mazmunidan aniqlaymiz (sarlavhaga ishonmaymiz) */
function ext(b) {
  if (b[0] === 0xff && b[1] === 0xd8) return 'jpg';
  if (b[0] === 0x89 && b[1] === 0x50) return 'png';
  if (b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP') return 'webp';
  return null;
}

let done = 0, failed = 0, firstErr = null, next = 0;
async function worker() {
  while (next < todo.length) {
    const id = todo[next++];
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await fetch(`${BASE}/api/table-tennis/files/get-file/${id}`, { signal: AbortSignal.timeout(30_000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buf = Buffer.from(await res.arrayBuffer());
        const e = ext(buf);
        if (!e || buf.length < 500) throw new Error('rasm emas');
        writeFileSync(join(dir, `${id}.${e}`), buf);
        done++;
        break;
      } catch (err) {
        if (attempt === 3) { failed++; firstErr ??= `${id}: ${err.message}`; }
        else await new Promise((r) => setTimeout(r, 800 * attempt));
      }
    }
    if ((done + failed) % 100 === 0) console.log(`  ${done + failed}/${todo.length} (xato: ${failed})`);
  }
}
await Promise.all(Array.from({ length: 6 }, worker));
console.log(`\nYuklandi: ${done}, xato: ${failed}.${firstErr ? ' Birinchi xato: ' + firstErr : ''}`);
if (failed) console.log('Xato bo\'lsa — 5-rasmlar.bat ni qayta ishga tushiring, yetishmaganlarini davom ettiradi.');
