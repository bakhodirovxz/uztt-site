// players-db.json nusxasini serverga yuklashdan oldin tozalaydi: PINFL ko'rinishidagi id
// tasodifiy UUID bilan almashadi (undan PINFL'ni qayta chiqarib bo'lmaydi). Asl fayl o'zgarmaydi.
// Ishlatish: node scripts/sanitize-pdb.js <kirish.json> <chiqish.json>
const fs = require('fs');
const crypto = require('crypto');

const [src, dst] = process.argv.slice(2);
if (!src || !dst) {
  console.error('Ishlatish: node scripts/sanitize-pdb.js <kirish.json> <chiqish.json>');
  process.exit(1);
}
const db = JSON.parse(fs.readFileSync(src, 'utf8'));
let changed = 0;
for (const r of db.players) {
  if (/\d{14}/.test(String(r.id))) {
    r.id = crypto.randomUUID();
    changed++;
  }
}
const left = db.players.filter((r) => /\d{14}/.test(JSON.stringify(r))).length;
if (left) {
  console.error(left + ' ta yozuvda hali 14 xonali raqam bor — fayl yozilmadi');
  process.exit(1);
}
fs.writeFileSync(dst, JSON.stringify(db));
console.log('Jami ' + db.players.length + ', almashtirildi ' + changed);
