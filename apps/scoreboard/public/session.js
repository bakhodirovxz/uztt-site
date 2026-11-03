// Sayt orqali ochilganda kirish tokeni 15 daqiqa yashaydi, planshet esa soatlab ochiq turadi.
// /api/* 401 qaytarsa sessiya yangilanib, so'rov bir marta qaytariladi; taymer ham uni oldindan yangilab turadi.
// Zal kompyuterida (saytsiz) /api/auth/refresh yo'q (404): hech narsa o'zgarmaydi.
(() => {
  const send = window.fetch.bind(window);
  let pending = null, off = false;
  const post = () => send('/api/auth/refresh', { method: 'POST' }).then((r) => {
    if (r.status === 404) off = true;
    return r.ok ? 'ok' : r.status === 401 ? 'expired' : 'error';
  }).catch(() => 'error');
  function refresh() {
    if (off) return Promise.resolve('error');
    if (pending) return pending;
    // token aylantiriladi: eski token qayta yuborilsa sessiya bekor bo'ladi, shuning uchun tablar navbat bilan (sayt ham shu qulfda)
    const run = navigator.locks ? navigator.locks.request('uztt-session', post) : post();
    pending = run.finally(() => { pending = null; });
    return pending;
  }
  window.fetch = async (input, init) => {
    const r = await send(input, init);
    const url = typeof input === 'string' ? input : input.url;
    if (r.status !== 401 || !url.startsWith('/api/')) return r;
    const s = await refresh();
    if (s === 'ok') return send(input, init);
    if (s === 'expired') location.assign('/login?next=' + encodeURIComponent(location.pathname + location.search));
    return r;
  };
  let lastAt = Date.now();
  const tick = () => { if (Date.now() - lastAt >= 600000) { lastAt = Date.now(); refresh(); } };
  setInterval(tick, 30000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
})();
