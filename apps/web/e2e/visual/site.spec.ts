import { expect, test } from '@playwright/test';

/**
 * Sahifa "qiyofasi" baseline'i: keyingi o'zgarishlar layoutni buzmasligini
 * qo'riqlaydi. Jonli hisob va sanalar kabi o'zgaruvchan joylar maskalanadi —
 * aks holda har yugurishda test qizarardi.
 */
const PAGES: Array<{ name: string; path: string }> = [
  { name: 'home', path: '/' },
  { name: 'events', path: '/musobaqalar' },
  { name: 'rankings', path: '/reyting' },
  { name: 'players', path: '/oyinchilar' },
  { name: 'compare', path: '/oyinchilar/taqqoslash' },
  { name: 'news', path: '/yangiliklar' },
  { name: 'videos', path: '/videos' },
  { name: 'galleries', path: '/galereya' },
  { name: 'about', path: '/federatsiya' },
  { name: 'contact', path: '/aloqa' },
  { name: 'privacy', path: '/sahifa/privacy' },
  { name: 'login', path: '/login' },
  { name: 'signup', path: '/signup' },
];

for (const page of PAGES) {
  test(`${page.name} — vizual`, async ({ page: browserPage }) => {
    await browserPage.goto(page.path, { waitUntil: 'networkidle' });

    // Jonli va vaqtga bog'liq bloklar maskalanadi
    const dynamic = [
      browserPage.locator('[data-live]'),
      browserPage.locator('.live-ticker'),
      browserPage.locator('time'),
    ];

    await expect(browserPage).toHaveScreenshot(`${page.name}.png`, {
      fullPage: true,
      mask: dynamic,
    });
  });
}

test('gorizontal skroll yo‘q (mobil va desktop)', async ({ page }) => {
  for (const path of ['/', '/reyting', '/oyinchilar', '/musobaqalar']) {
    await page.goto(path, { waitUntil: 'networkidle' });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    expect(overflow, `${path} sahifasida gorizontal skroll bor`).toBe(false);
  }
});
