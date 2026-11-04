// Yuklama sinovi: real tomoshabinni taqlid qiladi. Faqat o'qiydi, bazaga yozmaydi.
//   node viewers.mjs <url> <tomoshabinlar> <soniya> [tv_soni]
// Har tomoshabin: bosh sahifani ochadi, keyin har 10 soniyada jonli ro'yxatni so'raydi, socket.io ga ulanib turadi.
// tv_soni: TV/overlay kabi /sb/events oqimini ochiq tutadigan ekranlar.
const [, , BASE = 'https://stoltennis.uz', N = '100', SEC = '60', TVS = '0'] = process.argv;
const viewers = Number(N), seconds = Number(SEC), tvs = Number(TVS);
const times = [];
const errors = new Map();
let ok = 0, sockets = 0, socketFail = 0, sse = 0, sseFail = 0;
const stopAt = Date.now() + seconds * 1000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const note = (e) => errors.set(e, (errors.get(e) || 0) + 1);

async function hit(path) {
  const t0 = performance.now();
  try {
    const r = await fetch(BASE + path, { signal: AbortSignal.timeout(15000), headers: { 'User-Agent': 'uztt-load-test' } });
    await r.arrayBuffer();
    if (r.status >= 400) note(path.split('?')[0] + ' ' + r.status);
    else { ok++; times.push(performance.now() - t0); }
  } catch (e) {
    note(path.split('?')[0] + ' ' + (e.cause?.code || e.name));
  }
}

async function viewer(i) {
  await sleep(Math.random() * Math.min(45000, seconds * 500)); // hamma birdan kirmaydi
  const ws = openSocket();
  await hit('/');
  await hit('/api/matches/live');
  while (Date.now() < stopAt) {
    await sleep(10000 * (0.9 + Math.random() * 0.2));
    if (Date.now() >= stopAt) break;
    await hit('/api/matches/live');
    if (i % 5 === 0) await hit('/reyting'); // har beshinchi tomoshabin sahifa almashtiradi
  }
  try { ws && ws.close(); } catch {}
}

function openSocket() {
  try {
    const ws = new WebSocket(BASE.replace(/^http/, 'ws') + '/socket.io/?EIO=4&transport=websocket');
    ws.onopen = () => { sockets++; ws.send('40'); };
    ws.onmessage = (e) => { if (e.data === '2') ws.send('3'); };
    ws.onerror = () => { socketFail++; };
    return ws;
  } catch { socketFail++; return null; }
}

async function tv() {
  try {
    const r = await fetch(BASE + '/sb/events?all=1&ads=0', { signal: AbortSignal.timeout(seconds * 1000), headers: { 'User-Agent': 'uztt-load-test' } });
    if (r.status >= 400) { sseFail++; note('/sb/events ' + r.status); return; }
    sse++;
    for await (const _ of r.body) if (Date.now() >= stopAt) break;
  } catch (e) {
    if (e.name !== 'TimeoutError' && e.name !== 'AbortError') { sseFail++; note('/sb/events ' + (e.cause?.code || e.name)); }
  }
}

await Promise.all([...Array.from({ length: viewers }, (_, i) => viewer(i)), ...Array.from({ length: tvs }, tv)]);
times.sort((a, b) => a - b);
const pct = (p) => (times.length ? Math.round(times[Math.min(times.length - 1, Math.floor(times.length * p))]) : 0);
const failed = [...errors.values()].reduce((a, b) => a + b, 0);
console.log(JSON.stringify({
  viewers, tvs, seconds, requests: ok + failed, ok, failed, errorPct: +(100 * failed / Math.max(1, ok + failed)).toFixed(2),
  ms: { p50: pct(0.5), p95: pct(0.95), p99: pct(0.99), max: pct(1) }, sockets, socketFail, sse, sseFail, errors: Object.fromEntries(errors),
}));
process.exit(0);
