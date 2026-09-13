// reference/ (WTT) va current/ (bizniki) skrinshotlarni yonma-yon compare.html
// faylga chiqaradi — har dizayn iteratsiyasida ko'zdan kechirish uchun.
// Bu fayl gitignored; WTT skrinshotlari faqat lokal dizayn o'lchovi.
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(readFileSync(join(__dirname, 'pages.json'), 'utf8'));

const rows = [];
for (const page of config.pages) {
  for (const width of config.widths) {
    const ref = join('reference', page.name, `${width}.png`);
    const cur = join('current', page.name, `${width}.png`);
    const refExists = existsSync(join(__dirname, ref));
    const curExists = existsSync(join(__dirname, cur));
    if (!refExists && !curExists) continue;
    rows.push(`
      <section>
        <h2>${page.name} — ${width}px</h2>
        <div class="pair">
          <figure>
            <figcaption>WTT (reference)</figcaption>
            ${refExists ? `<img src="${ref}" loading="lazy">` : '<p class="missing">yo‘q</p>'}
          </figure>
          <figure>
            <figcaption>UZTT (current)</figcaption>
            ${curExists ? `<img src="${cur}" loading="lazy">` : '<p class="missing">yo‘q</p>'}
          </figure>
        </div>
      </section>`);
  }
}

const html = `<!doctype html>
<meta charset="utf-8">
<title>UZTT vs WTT — visual parity</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 20px; background: #f4f5f8; }
  h2 { position: sticky; top: 0; background: #f4f5f8; padding: 8px 0; }
  .pair { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  figure { margin: 0; background: #fff; border: 1px solid #ddd; border-radius: 8px; overflow: auto; max-height: 85vh; }
  figcaption { font-weight: 600; padding: 8px 12px; border-bottom: 1px solid #eee; position: sticky; top: 0; background: #fff; }
  img { width: 100%; display: block; }
  .missing { padding: 30px; color: #999; text-align: center; }
</style>
${rows.join('\n')}`;

writeFileSync(join(__dirname, 'compare.html'), html);
console.log(`compare.html tayyor (${rows.length} ta juftlik)`);
