// Import qilingan o'yinchi rasmlaridan avatar uchun kvadrat WebP kichik nusxalar: players/thumb/<id>.webp
//
// Kesish yuzga qaratilgan (bosh + yelka) — src/common/avatar-crop.ts dagi avatarThumb(),
// yangi yuklangan rasmlar bilan AYNAN bir xil algoritm. Shuning uchun skript build qilingan
// dist/ dan foydalanadi: avval `pnpm build` (Docker image ichida dist tayyor).
//
// Ishlatish:
//   node scripts/make-thumbs.cjs [papka] [--force]
//   papka standart: ../web/public/uttf-import/players
//   --force: mavjud nusxalarni ham qayta yaratadi (kesish algoritmi o'zgarganda)
//
// Serverda (image ichida, rasmlar papkasini ulab):
//   docker run --rm --user 0 -v /opt/uztt/apps/web/public/uttf-import/players:/players \
//     -w /app --entrypoint node uztt-prod-api:latest scripts/make-thumbs.cjs /players --force
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const force = args.includes('--force');
const dirArg = args.find((a) => !a.startsWith('--'));
const dir = path.resolve(dirArg || path.join(__dirname, '../../web/public/uttf-import/players'));
const out = path.join(dir, 'thumb');

let avatarThumb;
try {
  ({ avatarThumb } = require(path.join(__dirname, '..', 'dist', 'src', 'common', 'avatar-crop.js')));
} catch {
  console.error("dist/src/common/avatar-crop.js topilmadi — avval API ni build qiling (pnpm --filter @uztt/api build).");
  process.exit(2);
}

fs.mkdirSync(out, { recursive: true });
(async () => {
  let n = 0;
  const failed = [];
  for (const f of fs.readdirSync(dir)) {
    if (!/\.(jpe?g|png|webp)$/i.test(f)) continue;
    const id = f.replace(/\.[^.]+$/, '');
    const src = path.join(dir, f);
    const dst = path.join(out, `${id}.webp`);
    if (!force && fs.existsSync(dst) && fs.statSync(dst).mtimeMs >= fs.statSync(src).mtimeMs) continue;
    // Bitta buzuq fayl (prod'da shunday fayllar bor) butun jarayonni to'xtatmasin:
    // u o'tkazib yuboriladi, sayt esa uning o'rniga asl rasmni/bosh harflarni ko'rsatadi.
    try {
      fs.writeFileSync(dst, await avatarThumb(src));
      n++;
    } catch (e) {
      failed.push(`${f}: ${String(e.message).split('\n')[0]}`);
    }
  }
  console.log(`${n} ta kichik nusxa yaratildi → ${out}`);
  if (failed.length) {
    console.log(`${failed.length} ta fayl o'qilmadi (o'tkazib yuborildi):`);
    for (const x of failed.slice(0, 20)) console.log('  ' + x);
  }
})();
