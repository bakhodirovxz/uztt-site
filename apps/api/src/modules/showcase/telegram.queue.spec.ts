import { TelegramService } from './telegram.service';

/** Navbat va dublikat himoyasi: tarmoqqa chiqmasdan (fetch soxta) tekshiriladi */
describe('TelegramService navbati', () => {
  const env: Record<string, string> = { TELEGRAM_BOT_TOKEN: 'TKN', TELEGRAM_CHAT_ID: '-1', TELEGRAM_EVENTS: 'news', TELEGRAM_QUEUE_MAX: '3' };
  const config = { get: (k: string) => env[k] } as never;
  let calls: string[];
  const realFetch = global.fetch;

  beforeEach(() => {
    calls = [];
    global.fetch = jest.fn(async (_url: unknown, init?: { body?: unknown }) => {
      calls.push(String(init?.body ?? ''));
      return new Response('{}', { status: 200 });
    }) as unknown as typeof fetch;
  });
  afterEach(() => {
    global.fetch = realFetch;
    jest.useRealTimers();
  });

  const flush = async () => {
    for (let i = 0; i < 20; i++) await Promise.resolve();
  };

  it('navbat chegarasidan oshganda eng eskilari tashlanadi', async () => {
    const t = new TelegramService(config, {} as never, {} as never);
    // birinchi e'lon darhol yuborila boshlaydi; qolganlari navbatda kutadi
    for (let i = 0; i < 6; i++) t.announce('news', `xabar-${i}`);
    await new Promise((r) => setTimeout(r, 50));
    const sent = calls.map((b) => JSON.parse(b).text as string);
    expect(sent).toContain('xabar-0');
    expect(sent).toContain('xabar-5');
    expect(sent.length).toBeLessThanOrEqual(4); // 1 ta jarayonda + 3 ta navbat
  });

  it('10 daqiqadan ortiq navbatda turgan e\'lon yuborilmaydi', async () => {
    const t = new TelegramService(config, {} as never, {} as never);
    const now = Date.now();
    const spy = jest.spyOn(Date, 'now');
    spy.mockReturnValue(now);
    // birinchisi "osilib" qoladi — keyingilari navbatda eskiradi
    let release!: () => void;
    (global.fetch as jest.Mock).mockImplementationOnce(
      () => new Promise((r) => (release = () => r(new Response('{}', { status: 200 })))),
    );
    t.announce('news', 'birinchi');
    t.announce('news', 'eskiradi');
    await flush();
    spy.mockReturnValue(now + TelegramService.MAX_AGE_MS + 1000);
    release();
    await new Promise((r) => setTimeout(r, 20));
    spy.mockRestore();
    expect(calls.some((b) => b.includes('eskiradi'))).toBe(false);
  });

  it('natija kaliti o\'yin + g\'olib + geymlarga bog\'liq', () => {
    const a = TelegramService.resultKey({ matchId: 'm', winnerSlot: 1, games: [[11, 5], [11, 7], [11, 9]] });
    const b = TelegramService.resultKey({ matchId: 'm', winnerSlot: 1, games: [[11, 5], [11, 7], [12, 10]] });
    expect(a).not.toBe(b);
    expect(a).toBe(TelegramService.resultKey({ matchId: 'm', winnerSlot: 1, games: [[11, 5], [11, 7], [11, 9]] }));
  });
});
