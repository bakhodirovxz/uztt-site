const Q = new URLSearchParams(location.search);
const COURT = Q.get('court') || '1';

// Server versiyasini tekshirish: eski server ishlab tursa, sahifa buzilib qolmasdan aniq xabar ko'rsatadi
const EXPECTED_VERSION = 6;
function versionBad(d) {
  const old = document.getElementById('verr');
  if (d && d.version === EXPECTED_VERSION) { if (old) old.remove(); return false; }
  if (!old) {
    const x = document.createElement('div');
    x.id = 'verr';
    x.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#7f1d1d;color:#fff;display:flex;align-items:center;justify-content:center;text-align:center;font:600 28px system-ui,sans-serif;padding:30px;line-height:1.5';
    x.innerHTML = 'Server ESKI versiyada ishlayapti.<br><br>Eski qora (konsol) oynani yoping va<br>Desktop\\scoreboard\\start.bat ni qayta ishga tushiring.<br><br><span style="font-size:20px;font-weight:400">Keyin shu sahifani yangilang (F5)</span>';
    document.body.appendChild(x);
  }
  return true;
}

// ===== Yagona umumiy oqim =====
// Brauzer bitta sayt uchun faqat ~6 ta ulanish ochadi. Har sahifa alohida SSE ochsa (overlay 2 ta edi), ko'p oyna ochilganda
// POST so'rovlar navbatda qolib, hammasi "qotib" qoladi. Shuning uchun bitta brauzerdagi hamma sahifalar 1 ta ulanishni
// bo'lishadi (Web Locks + BroadcastChannel); mumkin bo'lmasa har sahifa o'zi 1 ta ulanish ochadi.
// Har sahifa faqat o'ziga kerakli ma'lumotni oladi: planshet — o'z stoli, overlay — reklama bilan, TV — o'z stollari
const FEED_URL = '/events?all=1' + (location.pathname === '/control' ? '&courts=' + encodeURIComponent(COURT) + '&ads=0'
  : location.pathname === '/overlay' ? '&ads=1' : (Q.get('courts') && location.pathname === '/tv' ? '&courts=' + encodeURIComponent(Q.get('courts')) + '&ads=0' : '&ads=0'));
const Feed = (() => {
  if (Q.get('feed') === '0') return { sub: () => {} }; // ?feed=0 — jonli ulanishsiz (natija rasmi uchun)
  const subs = [];
  let last = null, es = null, bc = null, lastAt = Date.now(), got = false;
  const deliver = (raw, at) => { got = true; last = { raw, at }; subs.forEach((f) => f(raw, at)); };
  function openES() {
    if (es) return;
    es = new EventSource(FEED_URL);
    es.onmessage = (e) => {
      const at = Date.now();
      lastAt = at;
      deliver(e.data, at);
      if (bc) bc.postMessage({ t: 'data', raw: e.data, at });
    };
  }
  try {
    if (Q.get('share') !== '0' && window.BroadcastChannel && navigator.locks) { // ?share=0 — ulanishni bo'lishmaslik (har sahifa o'ziniki)
      bc = new BroadcastChannel('sb-feed-' + FEED_URL);
      bc.onmessage = (e) => {
        const m = e.data;
        if (m.t === 'data') { lastAt = Date.now(); deliver(m.raw, m.at); }
        else if (m.t === 'req' && es && last) bc.postMessage({ t: 'data', raw: last.raw, at: last.at });
      };
      navigator.locks.request('sb-leader-' + FEED_URL, () => { openES(); return new Promise(() => {}); });
      bc.postMessage({ t: 'req' });
      // yetakchi oyna "muzlab" qolsa (brauzer fon oynani to'xtatsa) — o'zimiz ulanamiz
      // (boshida 3 soniya ichida ma'lumot kelmasa — bo'lishish ishlamayapti, o'zimiz ulanamiz)
      setInterval(() => { if (!es && Date.now() - lastAt > (got ? 10000 : 3000)) openES(); }, 1000);
    } else openES();
  } catch (e) { bc = null; openES(); }
  return { sub: (f) => { subs.push(f); if (last) f(last.raw, last.at); } };
})();

// har xabarda server vaqti ("now") o'zgaradi: o'yin holati o'zgarmagan bo'lsa qayta chizmaymiz
const feedKey = (raw) => raw.replace(/^\{"now":\d+,/, '{');

// Bitta stol uchun (planshet, overlay)
function connect(render, onStatus) {
  let last = null, lastKey = '';
  Feed.sub((raw, at) => {
    const key = feedKey(raw);
    const d = JSON.parse(raw);
    if (versionBad(d)) { last = null; lastKey = ''; return; }
    const c = d.courts[COURT];
    if (!c) return;
    if (last && key === lastKey) { last._off = at - d.now; return; }
    lastKey = key;
    last = Object.assign({}, c, { now: d.now, version: d.version });
    last._off = at - d.now; // server va brauzer soati farqi
    render(last);
    onStatus && onStatus(true);
  });
  // taym-aut hisoblagichi uchun har 0.5 soniyada qayta chizish
  setInterval(() => { if (last && last.timeout) render(last); }, 500);
}

// Hamma stollar uchun (TV): render({ meta, courts: {id: court} })
function connectAll(render, onStatus) {
  let last = null, lastKey = '';
  Feed.sub((raw, at) => {
    const key = feedKey(raw);
    const d = JSON.parse(raw);
    if (versionBad(d)) { last = null; lastKey = ''; return; }
    const off = at - d.now;
    if (last && key === lastKey) { Object.values(last.courts).forEach((c) => { c._off = off; }); return; }
    lastKey = key;
    last = d;
    Object.values(d.courts).forEach((c) => { c._off = off; });
    render(d);
    onStatus && onStatus(true);
  });
  setInterval(() => { if (last && Object.values(last.courts).some((c) => c.timeout || (c.active && c.winner !== null))) render(last); }, 500);
}

function act(a) {
  return fetch('/api/action?court=' + encodeURIComponent(COURT), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(a),
  });
}

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// IOC (3 harfli) kod -> ISO-2 (bayroq fayli nomi). 2 harfli ISO kodni ham qabul qiladi.
const IOC = {
  AFG: 'af', ALB: 'al', ALG: 'dz', AND: 'ad', ANG: 'ao', ARG: 'ar', ARM: 'am', AUS: 'au', AUT: 'at', AZE: 'az', BAH: 'bs', BRN: 'bh', BAN: 'bd', BAR: 'bb',
  BLR: 'by', BEL: 'be', BHU: 'bt', BOL: 'bo', BIH: 'ba', BRA: 'br', BRU: 'bn', BUL: 'bg', CAM: 'kh', CMR: 'cm', CAN: 'ca', CHI: 'cl', CHN: 'cn', COL: 'co',
  CRC: 'cr', CRO: 'hr', CUB: 'cu', CYP: 'cy', CZE: 'cz', DEN: 'dk', DOM: 'do', ECU: 'ec', EGY: 'eg', ESA: 'sv', EST: 'ee', ETH: 'et', FIJ: 'fj', FIN: 'fi',
  FRA: 'fr', GEO: 'ge', GER: 'de', GHA: 'gh', GBR: 'gb', GRE: 'gr', GUA: 'gt', GUM: 'gu', HKG: 'hk', HUN: 'hu', ISL: 'is', IND: 'in', INA: 'id', IRI: 'ir',
  IRQ: 'iq', IRL: 'ie', ISR: 'il', ITA: 'it', JAM: 'jm', JPN: 'jp', JOR: 'jo', KAZ: 'kz', KEN: 'ke', KOR: 'kr', PRK: 'kp', KUW: 'kw', KGZ: 'kg', LAO: 'la',
  LAT: 'lv', LBN: 'lb', LBA: 'ly', LTU: 'lt', LUX: 'lu', MAC: 'mo', MAS: 'my', MDV: 'mv', MLT: 'mt', MEX: 'mx', MDA: 'md', MON: 'mc', MGL: 'mn', MNE: 'me',
  MAR: 'ma', MYA: 'mm', NEP: 'np', NED: 'nl', NZL: 'nz', NGR: 'ng', MKD: 'mk', NOR: 'no', OMA: 'om', PAK: 'pk', PLE: 'ps', PAN: 'pa', PAR: 'py', PER: 'pe',
  PHI: 'ph', PNG: 'pg', POL: 'pl', POR: 'pt', PUR: 'pr', QAT: 'qa', ROU: 'ro', RUS: 'ru', KSA: 'sa', SRB: 'rs', SGP: 'sg', SVK: 'sk', SLO: 'si', RSA: 'za',
  ESP: 'es', SRI: 'lk', SUD: 'sd', SWE: 'se', SUI: 'ch', SYR: 'sy', TPE: 'tw', TJK: 'tj', TAN: 'tz', THA: 'th', TLS: 'tl', TGA: 'to', TTO: 'tt', TUN: 'tn',
  TUR: 'tr', TKM: 'tm', UGA: 'ug', UKR: 'ua', UAE: 'ae', URU: 'uy', USA: 'us', UZB: 'uz', VEN: 've', VIE: 'vn', YEM: 'ye', ZAM: 'zm', ZIM: 'zw',
  ENG: 'gb-eng', SCO: 'gb-sct', WAL: 'gb-wls',
};

function flagUrl(code) {
  code = (code || '').trim().toUpperCase();
  if (!code) return '';
  const iso = code.length === 3 ? IOC[code] : code.toLowerCase();
  if (!iso || !window.FLAGS || !window.FLAGS[iso]) return '';
  return '/flags/' + iso + '.svg'; // brauzer keshlaydi (internet kerak emas — fayllar shu serverda)
}

function flag(code) {
  const u = flagUrl(code);
  return u ? '<img class="flag" src="' + u + '" alt="">' : '';
}

// planshetda o'yinchilarning stol atrofidagi joylashuvi (tomon almashganda o'zgaradi).
// TV va overlayda tartib doim bir xil: 1-o'yinchi tepada.
const order = (s) => (s.swapped ? [1, 0] : [0, 1]);

// Keyingi ball geymni (yoki o'yinni) hal qiladimi? -> { p: o'yinchi indeksi, text } | null
function pointStatus(s) {
  if (s.winner !== null) return null;
  const pts = s.settings.pointsToWin, wb = s.settings.winBy;
  for (let i = 0; i < 2; i++) {
    const me = s.players[i], op = s.players[1 - i];
    if (me.points + 1 >= pts && me.points + 1 - op.points >= wb) {
      return { p: i, text: me.sets === s.settings.setsToWin - 1 ? 'MATCH POINT' : 'GAME POINT' };
    }
  }
  return null;
}

// Taym-aut qolgan soniyalari (faol bo'lmasa 0)
function timeoutLeft(s) {
  if (!s.timeout) return 0;
  return Math.max(0, Math.ceil((s.timeout.until + s._off - Date.now()) / 1000));
}

const fmtTime = (sec) => Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');

// "TABLE 3 - MEN'S TEAMS - PRELIMINARY ROUND 3"
const matchTitle = (s) => [s.table, s.category, s.round].filter(Boolean).join(' - ').toUpperCase();

// Jamoaviy hisob yorlig'i: "IRQ 0-1 KAZ"
function tieLabel(s) {
  if (!s.showTie) return '';
  const a = s.players[0].country || 'P1', b = s.players[1].country || 'P2';
  return a + ' ' + s.tie[0] + '-' + s.tie[1] + ' ' + b;
}

// Geymlar jadvali uchun katak qiymatlari: i-o'yinchining g-geymdagi ko'rsatkichi
// (tugagan geym yakuniy hisobi, joriy geym — jonli ball, qolganlari bo'sh)
function gameCell(s, i, g) {
  if (g < s.sets.length) return { v: s.sets[g][i], kind: 'done' };
  if (g === s.sets.length && s.winner === null) return { v: s.players[i].points, kind: 'live' };
  return { v: '', kind: 'empty' };
}
