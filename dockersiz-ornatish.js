// Docker'siz vaqtinchalik test uchun bir martalik o'rnatish.
// Talab: Node.js va PostgreSQL (native, Windows uchun) allaqachon
// o'rnatilgan bo'lishi kerak, "psql" va "createdb" buyruqlari PATH'da
// ishlashi kerak.

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const readline = require('readline');

const ROOT = __dirname;

function loadEnvFile(filePath) {
  const env = {};
  if (!fs.existsSync(filePath)) return env;
  const content = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function run(cmd, opts = {}) {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { stdio: 'inherit', shell: true, ...opts });
}

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (answer) => { rl.close(); resolve(answer); }));
}

async function main() {
  const envPath = path.join(ROOT, '.env');
  if (!fs.existsSync(envPath)) {
    console.error('XATO: .env fayli topilmadi. Uni eski noutbukdan nusxalang (yashirin fayl bolishi mumkin).');
    process.exit(1);
  }
  const rootEnv = loadEnvFile(envPath);
  if (!rootEnv.DATA_ENCRYPTION_KEY || !rootEnv.JWT_SECRET) {
    console.error('XATO: .env faylida DATA_ENCRYPTION_KEY yoki JWT_SECRET topilmadi.');
    process.exit(1);
  }

  console.log('[1/6] pnpm ornatilmoqda...');
  run('npm install -g pnpm');

  console.log('\n[2/6] Bogliqliklar ornatilmoqda (bir necha daqiqa ketishi mumkin)...');
  run('pnpm install', { cwd: ROOT });

  console.log('\n[3/6] Prisma client generatsiya qilinmoqda...');
  run('pnpm exec prisma generate', { cwd: path.join(ROOT, 'apps', 'api') });

  console.log('\n[4/6] Build qilinmoqda (API + Web)...');
  run('pnpm run build', { cwd: path.join(ROOT, 'apps', 'api') });
  run('pnpm run build', { cwd: path.join(ROOT, 'apps', 'web') });

  console.log('\n[5/6] Mahalliy baza tayyorlanmoqda...');
  const pgPassword = await ask('PostgreSQL ornatishda bergan "postgres" foydalanuvchi parolini kiriting: ');
  const pgEnv = { ...process.env, PGPASSWORD: pgPassword };

  try {
    run('createdb -U postgres uztt_local', { env: pgEnv });
  } catch (e) {
    console.log('  (baza allaqachon mavjud bolishi mumkin, davom etamiz)');
  }

  const dumpPath = path.join(ROOT, 'zaxira-nusxa.sql');
  if (fs.existsSync(dumpPath)) {
    console.log('  Malumotlar zaxiradan tiklanmoqda...');
    run(`psql -U postgres -d uztt_local -f "${dumpPath}"`, { env: pgEnv });
  } else {
    console.log('  zaxira-nusxa.sql topilmadi - bosh sxema yaratiladi (prisma migrate deploy)...');
    run('pnpm exec prisma migrate deploy', {
      cwd: path.join(ROOT, 'apps', 'api'),
      env: {
        ...pgEnv,
        DATABASE_URL: `postgresql://postgres:${pgPassword}@localhost:5432/uztt_local?schema=public`,
      },
    });
  }

  console.log('\n[6/6] Yuklangan fayllar tiklanmoqda (agar mavjud bolsa)...');
  const uploadsTar = path.join(ROOT, 'uploads-zaxira.tar.gz');
  const uploadsDir = path.join(ROOT, 'apps', 'api', 'uploads');
  if (fs.existsSync(uploadsTar)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    run(`tar -xzf "${uploadsTar}" -C "${uploadsDir}"`);
  } else {
    console.log('  uploads-zaxira.tar.gz topilmadi - otkazib yuborildi.');
  }

  console.log('\n============================================================');
  console.log('  Ornatish tugadi. Endi "dockersiz-ishga-tushirish.bat" ni ishga tushiring.');
  console.log('============================================================');
}

main().catch((e) => {
  console.error('\nXATO:', e.message);
  process.exit(1);
});
