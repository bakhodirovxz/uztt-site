// Docker'siz - API va Web serverlarni ishga tushiradi ("dockersiz-ornatish.bat"
// dan keyin ishlatiladi). Bu oynani yopish serverlarni ham to'xtatadi.

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
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

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (answer) => { rl.close(); resolve(answer); }));
}

async function main() {
  const rootEnv = loadEnvFile(path.join(ROOT, '.env'));
  const pgPassword = await ask('PostgreSQL "postgres" foydalanuvchi parolini kiriting: ');

  const apiEnv = {
    ...process.env,
    NODE_ENV: 'production',
    PORT: '4000',
    DATABASE_URL: `postgresql://postgres:${pgPassword}@localhost:5432/uztt_local?schema=public`,
    JWT_SECRET: rootEnv.JWT_SECRET,
    JWT_REFRESH_SECRET: rootEnv.JWT_REFRESH_SECRET,
    JWT_ACCESS_TTL: rootEnv.JWT_ACCESS_TTL || '15m',
    JWT_REFRESH_TTL: rootEnv.JWT_REFRESH_TTL || '30d',
    DATA_ENCRYPTION_KEY: rootEnv.DATA_ENCRYPTION_KEY,
    DATA_ENCRYPTION_KEY_ID: rootEnv.DATA_ENCRYPTION_KEY_ID || 'k1',
    WEB_ORIGIN: 'http://localhost:3000',
    SEED_ON_BOOT: '0',
  };

  const webEnv = {
    ...process.env,
    NODE_ENV: 'production',
    PORT: '3000',
    NEXT_PUBLIC_API_URL: 'http://localhost:4000',
  };

  console.log('\n[1/2] API ishga tushirilmoqda (port 4000)...');
  const api = spawn('node', ['dist/src/main.js'], {
    cwd: path.join(ROOT, 'apps', 'api'),
    env: apiEnv,
    stdio: 'inherit',
    shell: true,
  });
  api.on('exit', (code) => {
    if (code !== 0 && code !== null) console.error(`API to'xtadi (kod: ${code})`);
  });

  setTimeout(() => {
    console.log('\n[2/2] Web ishga tushirilmoqda (port 3000)...');
    const web = spawn('npm', ['run', 'start'], {
      cwd: path.join(ROOT, 'apps', 'web'),
      env: webEnv,
      stdio: 'inherit',
      shell: true,
    });
    web.on('exit', (code) => {
      if (code !== 0 && code !== null) console.error(`Web to'xtadi (kod: ${code})`);
    });
    setTimeout(() => {
      console.log('\nTayyor: http://localhost:3000 (brauzerda qolda oching)');
    }, 6000);
  }, 6000);

  process.on('SIGINT', () => {
    api.kill();
    process.exit(0);
  });
}

main();
