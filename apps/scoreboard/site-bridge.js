// Sayt (stoltennis.uz / lokal sayt) bilan ko'prik. SITE_URL va SB_SECRET berilmasa — hech narsa qilmaydi.
//  1) har 15 soniyada saytdan ayni paytdagi musobaqa o'yinlarini oladi (qura ro'yxatiga);
//  2) o'yin tugagach geymlar hisobini saytga yuboradi (sayt guruh, setka va reytingni o'zi yangilaydi).
const SITE = (process.env.SITE_URL || '').replace(/\/$/, '');
const SECRET = process.env.SB_SECRET || '';
const ORIGIN = process.env.SITE_ORIGIN || 'http://localhost:3000';

function start(api) {
  if (!SITE || !SECRET) { console.log('Sayt bilan ulanish: o\'chiq (SITE_URL / SB_SECRET berilmagan)'); return; }
  const headers = { 'x-sb-secret': SECRET, Origin: ORIGIN, 'Content-Type': 'application/json' };
  let lastKey = '';
  async function pull() {
    try {
      const r = await fetch(SITE + '/sb/export', { headers, signal: AbortSignal.timeout(10000) });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const d = await r.json();
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
    } catch (e) { console.log('Sayt bilan ulanib bo\'lmadi (' + e.message + ') — keyinroq qayta uriniladi'); }
  }
  async function push() {
    const courts = api.courts();
    for (const id of Object.keys(courts)) {
      const c = courts[id];
      if (c.winner === null || !c.siteId || c.sitePosted) continue;
      if (!c.sets.length) continue; // texnik g'alaba (hisobsiz) — qo'lda kiritiladi
      try {
        const r = await fetch(SITE + '/sb/result', { method: 'POST', headers, body: JSON.stringify({ siteId: c.siteId, sets: c.sets }), signal: AbortSignal.timeout(30000) });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        c.sitePosted = true;
        api.persist();
        console.log('Sayt: ' + id + '-stol natijasi yozildi');
        lastKey = ''; // ro'yxat yangilansin
      } catch (e) { console.log('Sayt: natijani yuborib bo\'lmadi (' + e.message + ') — qayta uriniladi'); }
    }
  }
  pull(); setInterval(pull, 15000); setInterval(push, 4000);
}
module.exports = { start };
