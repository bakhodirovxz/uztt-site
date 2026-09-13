import { defineConfig, devices } from '@playwright/test';

/**
 * Vizual regressiya testlari.
 * Sayt allaqachon ishlab turgan bo'lishi kerak (Docker yoki `pnpm dev:web`).
 * Manzilni o'zgartirish: PLAYWRIGHT_BASE_URL=http://localhost:3100
 *
 * Baseline yangilash: pnpm --filter @uztt/web test:visual:update
 */
export default defineConfig({
  testDir: './e2e',
  outputDir: './e2e/.artifacts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : [['list']],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3100',
    // Animatsiyalar skrinshotni beqaror qiladi
    launchOptions: { args: ['--force-prefers-reduced-motion'] },
  },
  expect: {
    toHaveScreenshot: {
      // Shrift renderi va anti-aliasing bo'yicha kichik farqlar kechiriladi
      maxDiffPixelRatio: 0.02,
      animations: 'disabled',
      caret: 'hide',
    },
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
});
