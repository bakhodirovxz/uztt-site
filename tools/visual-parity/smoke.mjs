// i18n smoke-test: har sahifa 3 tilda ochiladi, to'g'ri sarlavha ko'rinadi,
// konsolda xato yo'q. API'siz ham ishlaydi (sahifalar bo'sh holatga chidamli).
// Ishlatish: node smoke.mjs [baseUrl]
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://localhost:3100';

// [yo'l, sahifada kutilgan matn] — har til uchun
const CHECKS = [
  { paths: { uz: '/', ru: '/ru', en: '/en' }, expect: { uz: 'stol tennisi', ru: 'теннис', en: 'table tennis' } },
  { paths: { uz: '/musobaqalar', ru: '/ru/sorevnovaniya', en: '/en/events' }, expect: { uz: 'Musobaqalar', ru: 'Соревнования', en: 'Events' } },
  { paths: { uz: '/reyting', ru: '/ru/reyting', en: '/en/rankings' }, expect: { uz: 'Milliy reyting', ru: 'Национальный рейтинг', en: 'National rankings' } },
  { paths: { uz: '/oyinchilar', ru: '/ru/igroki', en: '/en/players' }, expect: { uz: "O'yinchilar", ru: 'Игроки', en: 'Players' } },
  { paths: { uz: '/yangiliklar', ru: '/ru/novosti', en: '/en/news' }, expect: { uz: 'Yangiliklar', ru: 'Новости', en: 'News' } },
  { paths: { uz: '/videos', ru: '/ru/videos', en: '/en/videos' }, expect: { uz: 'Videolar', ru: 'Видео', en: 'Videos' } },
  { paths: { uz: '/galereya', ru: '/ru/galereya', en: '/en/galleries' }, expect: { uz: 'Fotogalereya', ru: 'Фотогалерея', en: 'Photo gallery' } },
  { paths: { uz: '/federatsiya', ru: '/ru/federaciya', en: '/en/about' }, expect: { uz: 'Federatsiya', ru: 'Федерация', en: 'Federation' } },
  { paths: { uz: '/aloqa', ru: '/ru/kontakty', en: '/en/contact' }, expect: { uz: 'Aloqa', ru: 'Контакты', en: 'Contact' } },
  { paths: { uz: '/search', ru: '/ru/search', en: '/en/search' }, expect: { uz: 'Qidiruv', ru: 'Поиск', en: 'Search' } },
  { paths: { uz: '/login', ru: '/ru/login', en: '/en/login' }, expect: { uz: 'kirish', ru: 'Вход', en: 'Sign in' } },
  { paths: { uz: '/signup', ru: '/ru/signup', en: '/en/signup' }, expect: { uz: "ro'yxatdan o'tish", ru: 'Регистрация', en: 'Register' } },
];

const browser = await chromium.launch();
const page = await (await browser.newContext()).newPage();

let passed = 0;
let failed = 0;
const consoleErrors = [];
page.on('pageerror', (e) => consoleErrors.push(String(e).slice(0, 120)));

for (const check of CHECKS) {
  for (const locale of ['uz', 'ru', 'en']) {
    const url = BASE + check.paths[locale];
    try {
      const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20_000 });
      const status = res?.status() ?? 0;
      const body = await page.textContent('body');
      const htmlLang = await page.getAttribute('html', 'lang');
      const okStatus = status === 200;
      const okText = body?.toLowerCase().includes(check.expect[locale].toLowerCase());
      const okLang = htmlLang === locale;
      if (okStatus && okText && okLang) {
        passed++;
      } else {
        failed++;
        console.log(
          `XATO ${url} -> status:${status} lang:${htmlLang} matn:"${check.expect[locale]}" ${okText ? 'bor' : "YO'Q"}`,
        );
      }
    } catch (e) {
      failed++;
      console.log(`XATO ${url} -> ${String(e).slice(0, 100)}`);
    }
  }
}

await browser.close();
console.log(`\nNatija: ${passed} o'tdi, ${failed} yiqildi (jami ${passed + failed})`);
if (consoleErrors.length) {
  console.log('Sahifa JS xatolari:', [...new Set(consoleErrors)].slice(0, 5));
}
process.exit(failed > 0 ? 1 : 0);
