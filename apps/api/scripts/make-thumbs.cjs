// Import qilingan o'yinchi rasmlaridan 96×96 WebP kichik nusxalar yaratadi: players/thumb/<id>.webp
// Ishlatish: node scripts/make-thumbs.cjs [papka]   (standart: ../web/public/uttf-import/players)
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const dir = path.resolve(process.argv[2] || path.join(__dirname, '../../web/public/uttf-import/players'));
const out = path.join(dir, 'thumb');
fs.mkdirSync(out, { recursive: true });
(async () => {
  let n = 0;
  for (const f of fs.readdirSync(dir)) {
    if (!/\.(jpe?g|png|webp)$/i.test(f)) continue;
    const id = f.replace(/\.[^.]+$/, '');
    const dst = path.join(out, `${id}.webp`);
    if (fs.existsSync(dst) && fs.statSync(dst).mtimeMs >= fs.statSync(path.join(dir, f)).mtimeMs) continue;
    await sharp(path.join(dir, f), { limitInputPixels: 40_000_000 }).rotate().resize(96, 96, { fit: 'cover', position: sharp.strategy.attention }).webp({ quality: 70 }).toFile(dst);
    n++;
  }
  console.log(`${n} ta kichik nusxa yaratildi → ${out}`);
})();
