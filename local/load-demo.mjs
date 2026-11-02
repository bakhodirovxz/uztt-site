// Demo ma'lumotlarni lokal bazaga yuklaydi (BARCHA mavjud ma'lumotni almashtiradi!).
// Ishlatish: 4-demo.bat (baza ishlab turishi kerak: 2-start.bat)
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const data = JSON.parse(readFileSync(join(root, 'demo-data', process.env.DATA_FILE ?? 'real.json'), 'utf8'));
const client = new pg.Client({ connectionString: process.env.DATABASE_URL ?? 'postgresql://uztt:uztt_local@127.0.0.1:54329/uztt' });
await client.connect();
try {
  await client.query('BEGIN');
  // Tashqi kalit tartibini o'ylamaslik uchun triggerlar vaqtincha o'chadi (superuser)
  await client.query("SET LOCAL session_replication_role = 'replica'");
  const tables = Object.keys(data);
  await client.query(`TRUNCATE ${[...tables, 'refresh_tokens'].map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`);
  // Generatsiyalanadigan ustunlar (masalan qidiruv vektori) qo'lda yozilmaydi — baza o'zi hisoblaydi
  const { rows: cols } = await client.query(
    `SELECT table_name, column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND is_generated = 'NEVER' ORDER BY table_name, ordinal_position`,
  );
  const colsOf = new Map();
  for (const c of cols) colsOf.set(c.table_name, [...(colsOf.get(c.table_name) ?? []), `"${c.column_name}"`]);
  for (const t of tables) {
    const rows = data[t];
    // Faqat faylda bor ustunlar yoziladi — yangi (keyinroq qo'shilgan) ustunlar bazadagi standart qiymatni oladi
    const present = new Set(rows.length ? Object.keys(rows[0]).map((k) => `"${k}"`) : []);
    const list = (colsOf.get(t) ?? []).filter((c) => present.has(c)).join(', ');
    if (!rows.length || !list) continue;
    for (let i = 0; i < rows.length; i += 400) {
      await client.query(`INSERT INTO "${t}" (${list}) SELECT ${list} FROM json_populate_recordset(null::"${t}", $1::json)`, [JSON.stringify(rows.slice(i, i + 400))]);
    }
    if (rows.length) console.log(`${t}: ${rows.length}`);
  }
  await client.query('COMMIT');
  console.log('\nTAYYOR. API va saytni qayta ishga tushiring (3-stop.bat, so\'ng 2-start.bat).');
} catch (e) {
  await client.query('ROLLBACK').catch(() => {});
  console.error('XATO:', e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
