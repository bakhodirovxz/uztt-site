// Serverdan nusxalangan o'yinchi rasmlarini lokal bazaga bog'laydi va kichik nusxalarini yaratadi.
// Oldin: serverdagi apps/web/public/uttf-import/players papkasini shu loyihadagi xuddi shu yo'lga ko'chiring.
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'apps', 'web', 'public', 'uttf-import', 'players');
const map = JSON.parse(readFileSync(join(root, 'demo-data', 'photo-map.json'), 'utf8')); // pinfl -> photoId
const files = new Map(readdirSync(dir).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).map((f) => [f.replace(/\.[^.]+$/, ''), f]));
console.log(`Papkada ${files.size} ta rasm topildi.`);

const sharp = createRequire(join(root, 'apps', 'api', 'package.json'))('sharp');
const thumbDir = join(dir, 'thumb');
mkdirSync(thumbDir, { recursive: true });
const client = new pg.Client({ connectionString: process.env.DATABASE_URL ?? 'postgresql://uztt:uztt_local@127.0.0.1:54329/uztt' });
await client.connect();
let linked = 0, thumbs = 0;
for (const [pinfl, photoId] of Object.entries(map)) {
  const file = files.get(photoId);
  if (!file) continue;
  await client.query('UPDATE players SET photo_url = $1 WHERE license_number = $2', [`/uttf-import/players/${file}`, pinfl]);
  linked++;
  const dst = join(thumbDir, `${photoId}.webp`);
  if (!existsSync(dst)) {
    await sharp(join(dir, file), { limitInputPixels: 40_000_000 }).rotate().resize(96, 96, { fit: 'cover', position: sharp.strategy.attention }).webp({ quality: 70 }).toFile(dst);
    thumbs++;
  }
}
await client.end();
console.log(`Bog'landi: ${linked} o'yinchi, yangi kichik nusxa: ${thumbs}. Saytni yangilang (F5).`);
