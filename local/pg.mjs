// Lokal PostgreSQL (o'rnatish shart emas). Ma'lumotlar: local/pgdata (o'chirmasangiz saqlanadi).
// Ishga tushirish: node local/pg.mjs   (to'xtatish: oyna yoping yoki Ctrl+C)
import EmbeddedPostgres from 'embedded-postgres';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const dataDir = join(dir, 'pgdata');
const PORT = Number(process.env.LOCAL_PG_PORT || 54329);
const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: 'uztt',
  password: 'uztt_local',
  port: PORT,
  persistent: true,
  // Windows'da initdb standart kodirovkasi WIN1252 bo'lib qoladi — migratsiyalardagi ▲▼ kabi belgilar yuklanmaydi.
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  postgresFlags: ['-c', 'max_connections=100'],
});

if (!existsSync(join(dataDir, 'PG_VERSION'))) await pg.initialise();
await pg.start();
try {
  await pg.createDatabase('uztt');
} catch (e) {
  if (!String(e?.message).includes('already exists')) console.log('db:', e.message);
}
console.log(`PG_READY port=${PORT}`);

const stop = async () => {
  try { await pg.stop(); } catch { /* yopilish paytidagi xato muhim emas */ } finally { process.exit(0); }
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
setInterval(() => {}, 1 << 30);
