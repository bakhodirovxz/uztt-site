// Sayt (stoltennis.uz / lokal sayt) bilan ko'prik. SITE_URL va SB_SECRET berilmasa — hech narsa qilmaydi.
//  1) har 15 soniyada saytdan ayni paytdagi musobaqa o'yinlarini oladi (qura ro'yxatiga);
//  2) o'yin tugagach geymlar hisobini saytga yuboradi (sayt guruh, setka va reytingni o'zi yangilaydi).
// SITE_URL: sayt manzili, "/api" bilan yoki "/api"siz — ikkalasi ham ishlaydi
//   (https://stoltennis.uz  yoki  https://stoltennis.uz/api  ->  https://stoltennis.uz/api/sb/...).
function apiBase(site) {
  const s = String(site || '').trim().replace(/\/+$/, '');
  if (!s) return '';
  return /\/api$/i.test(s) ? s : s + '/api';
}
const API = apiBase(process.env.SITE_URL);
const SECRET = process.env.SB_SECRET || '';
const ORIGIN = process.env.SITE_ORIGIN || 'http://localhost:3000';

/** Sayt javobi: faqat o'yin saytda haqiqatan TUGAGAN bo'lsa muvaffaqiyat */
function resultAccepted(status, body) {
  if (status < 200 || status >= 300 || !body) return false;
  return body.finished === true || body.already === true;
}

function start(api) {
  if (!API || !SECRET) { console.log('Sayt bilan ulanish: o\'chiq (SITE_URL / SB_SECRET berilmagan)'); return; }
  console.log('Sayt bilan ulanish: ' + API + '/sb');
  const headers = { 'x-sb-secret': SECRET, Origin: ORIGIN, 'Content-Type': 'application/json' };
  let lastKey = '';
  let pulling = false, pushing = false; // oldingi aylanish tugamagan bo'lsa, ustma-ust ishga tushmasin
  async function pull() {
    if (pulling) return;
    pulling = true;
    try {
      const r = await fetch(API + '/sb/export', { headers, signal: AbortSignal.timeout(10000) });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const d = await r.json();
      if (d.title) api.setTitle(d.title);
      const data = api.getData();
      data.started = data.started || {};
      const matches = d.matches.map((m) => Object.assign({}, m, { done: !!(m.done || data.started[m.siteId]) }));
      const key = JSON.stringify(matches);
      if (key === lastKey) return;
      lastKey = key;
      const seen = new Map();
      matches.forEach((m) => m.p.forEach((q) => { const k = q.name + '|' + q.given; if (!seen.has(k)) seen.set(k, Object.assign({}, q)); }));
      const players = [...seen.values()];
      api.linkPlayers(players, data.players);
      data.players = players;
      data.matches = matches;
      api.relinkMatches();
      api.saveData();
      console.log('Sayt: ' + matches.length + ' ta o\'yin olindi');
    } catch (e) {
      console.log('Sayt bilan ulanib bo\'lmadi (' + e.message + ') — keyinroq qayta uriniladi');
    } finally { pulling = false; }
  }
  async function push() {
    if (pushing) return;
    pushing = true;
    try {
      const courts = api.courts();
      for (const id of Object.keys(courts)) {
        const c = courts[id];
        if (c.winner === null || !c.siteId || c.sitePosted) continue;
        if (!c.sets.length) continue; // texnik g'alaba (hisobsiz) — qo'lda kiritiladi
        const setsKey = JSON.stringify(c.sets);
        if (c.siteRejected === setsKey) continue; // sayt shu hisobni rad etgan — hisob o'zgarmaguncha qayta yuborilmaydi
        try {
          const r = await fetch(API + '/sb/result', { method: 'POST', headers, body: JSON.stringify({ siteId: c.siteId, sets: c.sets }), signal: AbortSignal.timeout(30000) });
          const body = await r.json().catch(() => null);
          if (resultAccepted(r.status, body)) {
            c.sitePosted = true;
            c.siteRejected = undefined;
            api.persist();
            console.log('Sayt: ' + id + '-stol natijasi yozildi');
            lastKey = ''; // ro'yxat yangilansin
          } else if (r.status === 422 || r.status === 409 || (r.ok && body && body.finished === false)) {
            // Qayta urinish foyda bermaydi (hisob sayt qoidalariga mos emas yoki o'yin saytda boshlangan)
            c.siteRejected = setsKey;
            api.persist();
            console.log('Sayt: ' + id + '-stol natijasi QABUL QILINMADI — saytda qo\'lda kiriting. ' + ((body && body.message) || ('HTTP ' + r.status)));
          } else {
            throw new Error('HTTP ' + r.status);
          }
        } catch (e) { console.log('Sayt: natijani yuborib bo\'lmadi (' + e.message + ') — qayta uriniladi'); }
      }
    } finally { pushing = false; }
  }
  // Jonli hisob: saytning jonli ro'yxati va ekranlari uchun. O'zgarganda darrov, o'zgarmasa 20 soniyada bir
  let liveKey = null, liveAt = 0, livePushing = false;
  async function pushLive() {
    if (livePushing) return;
    const courts = api.courts();
    const matches = Object.keys(courts).filter((id) => courts[id].siteId && courts[id].winner === null).map((id) => {
      const c = courts[id];
      return { siteId: c.siteId, court: String(id), points: [c.players[0].points, c.players[1].points], setsWon: [c.players[0].sets, c.players[1].sets], sets: c.sets };
    });
    const body = JSON.stringify({ matches });
    if (body === liveKey && Date.now() - liveAt < 20000) return;
    livePushing = true;
    try {
      const r = await fetch(API + '/sb/live', { method: 'POST', headers, body, signal: AbortSignal.timeout(5000) });
      if (r.ok) { liveKey = body; liveAt = Date.now(); }
    } catch (e) { /* keyingi aylanishda qayta yuboriladi */ } finally { livePushing = false; }
  }
  pull(); setInterval(pull, 15000); setInterval(push, 4000); setInterval(pushLive, 1000);
  return { pull };
}
module.exports = { start, apiBase, resultAccepted };
