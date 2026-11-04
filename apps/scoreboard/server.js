// Stol tennisi scoreboard serveri (ko'p stolli) — paket o'rnatish shart emas. Ishga tushirish: node server.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const zlib = require('zlib');
const crypto = require('crypto');
const rating = require('./lib/rating');
const playersdb = require('./lib/playersdb');

const PORT = process.env.PORT || 3100; // 3000 emas: boshqa dasturlar/eski versiya bilan to'qnashmasligi uchun
const VERSION = 6; // sahifalar shu raqamni tekshiradi: eski server ishlab tursa, aniq xabar chiqadi
const PUB = path.join(__dirname, 'public');
const PHOTOS = path.join(PUB, 'players');
const ADS_DIR = path.join(PUB, 'ads');
// Ma'lumot fayllari: standart — shu papka; prod konteynerida SB_DATA_DIR (kod bilan birga o'chib ketmasin)
const DATA_DIR = process.env.SB_DATA_DIR || __dirname;
const SAVE = path.join(DATA_DIR, 'state.json');
const DATA = path.join(DATA_DIR, 'data.json'); // o'yinchilar ro'yxati va qura (o'yinlar jadvali)
const HIST = path.join(DATA_DIR, 'history.json'); // tugagan o'yinlar + reyting o'zgarishlari (statistika shundan hisoblanadi)
const ADSF = path.join(DATA_DIR, 'ads.json'); // overlay reklamalari
const TIMEOUT_MS = 60000;
const COURT_COUNT = Math.max(1, Math.min(32, parseInt(process.env.COURTS || '10', 10) || 10)); // nechta stol (planshet/overlay) doim tayyor turadi
// Faqat 1..COURT_COUNT stollar ("01", "a", "x-1" kabi ixtiyoriy kalitlar xotira va efirni to'ldirmasin)
const validCourt = (id) => typeof id === 'string' && /^[1-9]\d?$/.test(id) && +id <= COURT_COUNT;
// Standart: faqat shu kompyuterdan (127.0.0.1). Zal tarmog'idagi planshetlar uchun SB_HOST=0.0.0.0 + SB_ADMIN_TOKEN.
const HOST = process.env.SB_HOST || '127.0.0.1';
const SELF_HOST = HOST === '0.0.0.0' || HOST === '::' ? '127.0.0.1' : HOST; // natija rasmi uchun o'z-o'ziga murojaat
// Ixtiyoriy kirish kaliti: berilsa, boshqaruv sahifalari va o'zgartiruvchi so'rovlar faqat shu kalit bilan
const ADMIN_TOKEN = String(process.env.SB_ADMIN_TOKEN || '').trim();
fs.mkdirSync(ADS_DIR, { recursive: true });

// ===== Fayllarni xavfsiz yozish: avval vaqtinchalik fayl, keyin almashtirish (o'chib qolsa fayl buzilmaydi) =====
function writeJsonAtomic(file, obj, cb) {
  const tmp = file + '.tmp';
  fs.writeFile(tmp, JSON.stringify(obj), (err) => {
    if (err) return cb && cb(err);
    fs.rename(tmp, file, (err2) => {
      if (err2) { // Windows: fayl band bo'lsa to'g'ridan-to'g'ri yozib ko'ramiz
        return fs.writeFile(file, JSON.stringify(obj), (e3) => cb && cb(e3));
      }
      cb && cb(null);
    });
  });
}
function writeJsonSync(file, obj) {
  try { fs.writeFileSync(file + '.tmp', JSON.stringify(obj)); fs.renameSync(file + '.tmp', file); } catch (e) { fs.writeFileSync(file, JSON.stringify(obj)); }
}
function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) {
    try { return JSON.parse(fs.readFileSync(file + '.tmp', 'utf8')); } catch (e2) { return fallback; }
  }
}

let data = Object.assign({ players: [], matches: [] }, readJson(DATA, {}));
const pdb = playersdb.create(DATA_DIR, PHOTOS);

// ===== Umumiy sozlamalar (hamma stollar uchun) =====
const defaultMeta = () => ({
  title1: 'PREZIDENT OLIMPIADASI 2026', title2: 'STOL TENNISI',
  introOn: true, introS: 22, // o'yinchilar statistikasi: yoqilgan, necha soniya
  ratingOn: true, ratingS: 14, ratingDelayS: 4, // o'yindan keyin reyting yangilanishi animatsiyasi
  ratingK: 1, loserNonPositive: true, loserNoDeduct: true, // К koeffitsienti; mag'lubga musbat ball berilmasin; mag'lubdan ball ayirilmasin
});

const defaults = (id) => ({
  table: 'TABLE ' + String(id).toUpperCase(),
  category: '', // masalan: MEN'S TEAMS
  round: '', // masalan: PRELIMINARY ROUND 3
  // ITTF: 11 ball, 2 ball farq, har 2 ballda uzatish. bestOf: 5 yoki 7 geymdan iborat o'yin
  settings: { pointsToWin: 11, winBy: 2, bestOf: 5, setsToWin: 3, serveEvery: 2 },
  players: [
    { name: 'PLAYER 1', given: '', country: '', points: 0, sets: 0, uids: [] },
    { name: 'PLAYER 2', given: '', country: '', points: 0, sets: 0, uids: [] },
  ],
  showTie: false, // jamoaviy uchrashuv hisobi (IRQ 0-1 KAZ)
  tie: [0, 0],
  active: false, // TV da ko'rinadimi
  sets: [],
  server: null,
  starter: null,
  winner: null,
  swapped: false, // faqat planshet: o'yinchilar stol atrofida joylashuvi
  overlay: true,
  timeouts: [false, false],
  timeout: null, // { side, until }
  endsNote: null, // 'game' | 'decider'
  deciderDone: false,
  startedAt: null, // o'yin boshlangan vaqt
  referee: '',
  cards: [{ y: 0, r: 0 }, { y: 0, r: 0 }], // sariq / qizil kartochkalar
  reported: false, // natija Telegramga yuborilganmi
  finishedAt: null, // o'yin tugagan vaqt (TV g'olibni biroz ko'rsatib, keyin olib tashlaydi)
  intro: null, // o'yin oldidan o'yinchilar statistikasi { from, until, type, sides }
  rating: null, // o'yin tugagach reyting yangilanishi { key, from, until, type, k, sides }
  histId: null, // tarix yozuvi kaliti
});

let meta = defaultMeta();
let courts = {};
{
  const saved = readJson(SAVE, null);
  if (saved && saved.courts) {
    // eski holatda ruxsat etilmagan stol kalitlari bo'lsa — tashlab yuboriladi
    courts = Object.fromEntries(Object.entries(saved.courts).filter(([k]) => validCourt(k)));
    meta = Object.assign(defaultMeta(), saved.meta || {});
    // eski standart sarlavha (ITTF-ATTU ...) saqlanib qolgan bo'lsa, yangisiga almashtiramiz
    if (/ITTF|ATTU|Tashkent 2026/i.test((meta.title1 || '') + (meta.title2 || ''))) { const d = defaultMeta(); meta.title1 = d.title1; meta.title2 = d.title2; }
  }
}

// ===== Tarix (tugagan o'yinlar) va reyting daftari =====
let hist = Object.assign({ history: [], ledger: [] }, readJson(HIST, {}));
let statIdx = new Map(); // uid -> { played, won, lost }
let ledIdx = { Y: new Map(), D: new Map(), A: new Map() }; // tur -> uid -> jami o'zgarish
function rebuildIdx() {
  statIdx = new Map();
  hist.history.forEach((h) => {
    if (h.winner === null || h.winner === undefined) return;
    [0, 1].forEach((i) => (h.sides[i].uids || []).forEach((u) => {
      const s = statIdx.get(u) || { played: 0, won: 0, lost: 0 };
      s.played++; if (h.winner === i) s.won++; else s.lost++;
      statIdx.set(u, s);
    }));
  });
  ledIdx = { Y: new Map(), D: new Map(), A: new Map() };
  hist.ledger.forEach((l) => l.changes.forEach((ch) => {
    const m = ledIdx[l.type]; m.set(ch.uid, rating.r2((m.get(ch.uid) || 0) + ch.delta));
  }));
}
rebuildIdx();
let histTimer = null;
function persistHist() { clearTimeout(histTimer); histTimer = setTimeout(() => writeJsonAtomic(HIST, hist), 200); }
function dropEntries(key) {
  const n = hist.history.length + hist.ledger.length;
  hist.history = hist.history.filter((h) => h.key !== key);
  hist.ledger = hist.ledger.filter((l) => l.key !== key);
  if (n !== hist.history.length + hist.ledger.length) { rebuildIdx(); persistHist(); }
}

const liveRating = (uid, type) => {
  const r = pdb.byId.get(uid);
  return rating.r2(((r && r[type]) || 0) + (ledIdx[type].get(uid) || 0));
};
// Reytingdagi o'rin: saytdagi rasmiy o'rin (uttf.uz) asos qilinadi, o'yin natijalari ta'sirida u siljiydi
const rankNow = (uid, type, pts) => {
  const r = pdb.byId.get(uid), base = (r && r[type]) || 0;
  const raw = pdb.rankOf(type, pts, base);
  const official = r && r['k' + type];
  if (!raw || !official || !base) return raw;
  return Math.max(1, raw + (official - pdb.rankOf(type, base, base)));
};

// Bitta o'yinchi kartochkasi (TV/overlay uchun): rasm, reyting, o'rin, yosh, hudud, statistika
function personCard(uid, type, fallback) {
  const r = pdb.byId.get(uid);
  if (!r) return Object.assign({ id: '', photo: '', rating: 0, rank: 0, age: 0, region: '', club: '', played: 0, won: 0, lost: 0 }, fallback || {});
  const pts = liveRating(uid, type);
  const st = statIdx.get(uid) || { played: 0, won: 0, lost: 0 };
  const t = r.fio.split(/\s+/);
  return Object.assign({
    id: uid, name: t[0] || '', given: t[1] || '', photo: pdb.photo(r), rating: pts, rank: rankNow(uid, type, pts),
    age: r.age || 0, region: r.rg || '', club: r.cl || '', played: st.played, won: st.won, lost: st.lost,
  }, fallback || {});
}

// tomon (p) dagi k-o'yinchi uchun kartochka; juftlikda ism bazadan olinadi, yakkalikda — ro'yxatdagi yozuv
function cardFor(p, k, type) {
  const doubles = /\s\/\s/.test(p.name);
  const names = doubles ? p.name.split(/\s\/\s/) : [p.name];
  const uid = (p.uids || [])[k];
  const fb = uid ? (doubles ? {} : { name: p.name, given: p.given }) : { name: (names[k] || '').trim(), given: doubles ? '' : p.given };
  return Object.assign(personCard(uid, type, fb), { country: p.country });
}
const sideSize = (p) => (/\s\/\s/.test(p.name) ? 2 : 1);
const ratingTypeOf = (c) => rating.ratingType(c.category, c.players.some((p) => /\s\/\s/.test(p.name)) ? 2 : 1);

function makeIntro(c) {
  if (!meta.introOn || !meta.introS) { c.intro = null; return; }
  const type = ratingTypeOf(c);
  const now = Date.now();
  const sides = c.players.map((p) => {
    const list = Array.from({ length: sideSize(p) }, (_, k) => cardFor(p, k, type));
    return { country: p.country, name: p.name, given: p.given, list };
  });
  c.intro = { from: now, until: now + meta.introS * 1000, type, sides };
}

// Tugagan o'yinni tarixga yozadi va (imkon bo'lsa) reyting ballarini hisoblaydi
function finalize(id, c) {
  const key = id + '-' + c.finishedAt;
  lastCardKey = key;
  if (c.histId === key && hist.history.some((h) => h.key === key)) return;
  dropEntries(key);
  const type = ratingTypeOf(c);
  const w = c.winner, l = 1 - w;
  const entry = {
    key, ts: c.finishedAt, court: id, table: c.table, category: c.category, round: c.round, type,
    sides: c.players.map((p) => ({ name: p.name, given: p.given, country: p.country, uids: (p.uids || []).slice(0, 2), sets: p.sets })),
    sets: c.sets.map((s) => s.slice()), winner: w, tie: c.showTie ? c.tie.slice() : null,
    walkover: c.sets.length === 0 && c.players[0].points + c.players[1].points === 0,
  };
  hist.history.push(entry);
  if (hist.history.length > 3000) hist.history.shift();

  let rs = null;
  const uidsW = c.players[w].uids || [], uidsL = c.players[l].uids || [];
  const need = (list, nm) => list.length >= (/\s\/\s/.test(nm) ? 2 : 1);
  if (meta.ratingOn && !entry.walkover && need(uidsW, c.players[w].name) && need(uidsL, c.players[l].name)) {
    const side = (uids) => { const v = uids.map((u) => liveRating(u, type)); return rating.r2(v.reduce((a, b) => a + b, 0) / v.length); };
    const gr = side(uidsW), yr = side(uidsL);
    const ratingK = Number.isFinite(c.siteK) ? c.siteK : meta.ratingK; // sayt o'yini: musobaqaning K si
    const d = rating.matchDelta(gr, yr, { k: ratingK, loserNonPositive: meta.loserNonPositive, loserNoDeduct: meta.loserNoDeduct });
    const changes = [];
    const sidesOut = [w, l].map((s) => {
      const isW = s === w, uids = (isW ? uidsW : uidsL);
      const list = uids.map((u, k) => {
        const before = liveRating(u, type);
        const after = Math.max(0, rating.r2(before + (isW ? d.win : d.lose)));
        const eff = rating.r2(after - before);
        const rankBefore = rankNow(u, type, before), rankAfter = rankNow(u, type, after);
        changes.push({ uid: u, delta: eff });
        return Object.assign(cardFor(c.players[s], k, type), { before, after, delta: eff, rankBefore, rankAfter });
      });
      return { won: isW, idx: s, country: c.players[s].country, name: c.players[s].name, given: c.players[s].given, sets: c.players[s].sets, list };
    });
    hist.ledger.push({ key, ts: c.finishedAt, type, k: ratingK, gr, yr, changes });
    entry.rating = { gr, yr, win: d.win, lose: d.lose };
    const from = c.finishedAt + (meta.ratingDelayS || 0) * 1000;
    rs = { key, from, until: from + meta.ratingS * 1000, type, k: ratingK, gr, yr, sides: sidesOut };
  }
  c.histId = key;
  c.rating = rs;
  // Telegramga yuboriladigan natija kartochkasi (o'yin tugagan paytdagi holat; keyingi o'yin boshlansa ham o'zgarmaydi)
  cards.set(key, {
    key, ts: c.finishedAt, meta: { title1: meta.title1, title2: meta.title2 }, table: c.table, category: c.category, round: c.round,
    players: c.players.map((p) => ({ name: p.name, given: p.given, country: p.country, sets: p.sets })), sets: entry.sets, winner: w,
    tie: c.showTie ? c.tie.slice() : null, rating: rs,
    sides: c.players.map((p, s) => ({ won: s === w, idx: s, list: Array.from({ length: sideSize(p) }, (_, k) => cardFor(p, k, type)) })),
  });
  if (cards.size > 300) cards.delete(cards.keys().next().value);
  rebuildIdx();
  persistHist();
}

// Holatni tarix/reyting bilan moslash (har amaldan keyin)
function reconcile(id, oldKey) {
  const c = getCourt(id);
  if (oldKey && c.histId !== oldKey) dropEntries(oldKey); // "bekor qilish" o'yin tugashini qaytardi
  if (c.winner !== null && c.finishedAt) finalize(id, c);
}

// ===== Telegram =====
// telegram.json  {"token":"BOT_TOKEN","chat_id":"-100123..."}  (yoki TG_TOKEN / TG_CHAT muhit o'zgaruvchilari)
function tgConf() {
  const c = readJson(path.join(DATA_DIR, 'telegram.json'), {});
  const token = String(process.env.TG_TOKEN || c.token || '').trim();
  const chat = String(process.env.TG_CHAT || c.chat_id || '').trim();
  return token && chat ? { token, chat } : null;
}
const TG_PLAIN = !!process.env.TG_API_PLAIN; // sinov uchun: soxta Telegram serveriga oddiy http bilan ulanish
const tgRequest = (opt, cb) => (TG_PLAIN ? http : https).request(Object.assign({ hostname: process.env.TG_API_HOST || 'api.telegram.org', port: process.env.TG_API_PORT || (TG_PLAIN ? 80 : 443) }, opt), cb);
let tgLastError = '';
function tgSend(text, tries) {
  const conf = tgConf();
  if (!conf) { console.log("Telegram: sozlanmagan (telegram.json da token va chat_id bo'sh)"); return Promise.resolve(false); }
  return new Promise((resolve) => {
    const body = JSON.stringify({ chat_id: conf.chat, text });
    const req = tgRequest({ path: '/bot' + conf.token + '/sendMessage', method: 'POST', timeout: 15000,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body) } }, (r) => {
      let out = '';
      r.on('data', (d) => { out += d; });
      r.on('end', () => {
        if (r.statusCode === 200) { console.log('Telegram: yuborildi'); return resolve(true); }
        // guruh "supergroup"ga aylansa Telegram yangi chat_id beradi: faylga o'zimiz yozib, qayta yuboramiz
        try {
          const j = JSON.parse(out);
          if (r.statusCode === 400 && j.parameters && j.parameters.migrate_to_chat_id && !process.env.TG_CHAT) {
            const f = path.join(DATA_DIR, 'telegram.json');
            const cur = JSON.parse(fs.readFileSync(f, 'utf8'));
            cur.chat_id = String(j.parameters.migrate_to_chat_id);
            fs.writeFileSync(f, JSON.stringify(cur, null, 2) + '\n');
            console.log('Telegram: guruh yangilandi, yangi chat_id ' + cur.chat_id + ' telegram.json ga yozildi, qayta yuborilmoqda');
            return tgSend(text, (tries || 1) + 1).then(resolve);
          }
        } catch (e) { /* oddiy xato */ }
        tgLastError = 'Telegram javobi ' + r.statusCode + ': ' + out.slice(0, 300);
        console.log('Telegram xato ' + r.statusCode + ': ' + out.slice(0, 200));
        if ((tries || 1) < 3 && r.statusCode >= 500) setTimeout(() => tgSend(text, (tries || 1) + 1).then(resolve), 5000); else resolve(false);
      });
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', (e) => {
      tgLastError = 'Telegramga ulanib bo\'lmadi (internet yo\'qmi?): ' + e.message;
      console.log('Telegram ulanmadi: ' + e.message);
      if ((tries || 1) < 3) setTimeout(() => tgSend(text, (tries || 1) + 1).then(resolve), 5000); else resolve(false);
    });
    req.end(body);
  });
}
const pname = (p) => (p.name + (p.given ? ' ' + p.given : '') + (p.country ? ' (' + p.country + ')' : '')).trim();
const sgn = (x) => (x > 0 ? '+' : '') + x;
function resultText(c) {
  const [a, b] = c.players;
  const head = [c.table, c.category, c.round].filter(Boolean).join(' · ');
  let t = '🏓 ' + head + '\n\n' + pname(a) + '  ' + a.sets + ' – ' + b.sets + '  ' + pname(b);
  if (c.sets.length) t += '\nGeymlar: ' + c.sets.map((x) => x[0] + '-' + x[1]).join(', ');
  t += '\n🏆 G\'olib: ' + pname(c.players[c.winner]);
  if (c.showTie) t += '\nJamoa hisobi: ' + a.country + ' ' + c.tie[0] + '-' + c.tie[1] + ' ' + b.country;
  if (c.rating) {
    t += '\n\n📈 Reyting:';
    c.rating.sides.forEach((s) => s.list.forEach((p) => { t += '\n' + (s.won ? '▲ ' : '▼ ') + (p.name + ' ' + (p.given || '')).trim() + ': ' + p.before + ' → ' + p.after + ' (' + sgn(p.delta) + ')'; }));
  }
  return t;
}
// Prod saytda (SB_PUBLIC=1) sayt o'yini faqat hakam kodi tasdiqlangach boshlanadi: /referee -> kod -> /control?site=ID.
// Zal kompyuterida kod ekrani yo'q, u yerda ro'yxatdan boshlash o'zgarmaydi.
const REQUIRE_CODE = process.env.SB_PUBLIC === '1';
let siteBridge = null;

/** Hakam panelidan kelgan o'yinni stolda boshlaydi. retry: planshet birozdan keyin qayta so'raydi */
function startSiteMatch(court, siteId) {
  const c = getCourt(court);
  if (siteId && c.siteId === siteId) return { ok: true }; // planshet qayta ochildi: o'yin shu stolda davom etadi
  const id = data.matches.findIndex((m) => m.siteId === siteId);
  const m = data.matches[id];
  if (!m || (REQUIRE_CODE && !m.verified)) {
    if (siteBridge) siteBridge.pull(); // kod hozirgina tasdiqlangan: ro'yxat 15 soniyani kutmasin
    return { ok: false, retry: true, error: "O'yin ma'lumoti saytdan kelmadi" };
  }
  const other = Object.keys(courts).find((k) => k !== String(court) && courts[k].siteId === siteId && courts[k].winner === null);
  if (other) return { ok: false, error: "Bu o'yin " + other + '-stolda ketmoqda' };
  if (c.winner === null && (c.active || c.sets.length || c.players[0].points + c.players[1].points)) {
    return { ok: false, error: court + "-stolda boshqa o'yin ketmoqda. Avval uni yakunlang" };
  }
  if (c.winner !== null && c.siteId && !c.sitePosted && c.sets.length && c.siteRejected !== JSON.stringify(c.sets)) {
    return { ok: false, retry: true, error: 'Oldingi natija saytga yuborilmoqda' }; // yangi o'yin uni bosib ketmasin
  }
  const t = String(m.table || '').trim();
  apply(court, {
    type: 'start', referee: '', table: /^\d+$/.test(t) ? 'TABLE ' + t : t || 'TABLE ' + court,
    category: m.category || '', round: m.round || '',
    players: m.p.map((p) => ({ name: p.name, given: p.given || '', country: p.country || '', uids: p.uid ? [p.uid] : [] })),
    settings: m.bestOf ? { bestOf: m.bestOf } : undefined,
  });
  m.done = true;
  data.started = data.started || {};
  data.started[siteId] = true;
  c.siteId = siteId; c.sitePosted = false; c.siteRejected = undefined; c.siteK = m.k;
  saveData();
  return { ok: true, started: true };
}

function reportFinished() {
  Object.keys(courts).forEach((id) => {
    const c = getCourt(id);
    if (c.winner !== null && !c.reported) {
      c.reported = true;
      console.log('Telegram: ' + id + '-stol natijasi yuborilmoqda...');
      const key = c.histId;
      tgSend(resultText(c)).then(() => sendCardPhotos(key)); // avval matn, keyin 1920x1080 va 1080x1920 rasm
    }
  });
}

// ===== Natija rasmi: kartochka sahifasini (/card) brauzer (Edge/Chrome) bilan rasmga olamiz =====
function findBrowser() {
  const cands = [process.env.BROWSER_PATH,
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    (process.env.LOCALAPPDATA || '') + '\\Google\\Chrome\\Application\\chrome.exe',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'];
  return cands.find((p) => p && fs.existsSync(p)) || null;
}
let cardActive = 0; const cardWait = [];
const limited = (fn) => new Promise((res) => {
  const run = () => { cardActive++; fn().then(res, () => res(null)).then(() => { cardActive--; const n = cardWait.shift(); if (n) n(); }); };
  cardActive < 2 ? run() : cardWait.push(run);
});
function pngSize(file) { const b = fs.readFileSync(file); return b.readUInt32BE(16) + 'x' + b.readUInt32BE(20); }
function renderCard(key, fmt) {
  return limited(() => new Promise((resolve) => {
    const bin = findBrowser();
    if (!bin) { console.log("Telegram rasm: Edge/Chrome topilmadi (BROWSER_PATH ni belgilang) — faqat matn yuboriladi"); return resolve(null); }
    const [w, h] = fmt === 'v' ? [1080, 1920] : [1920, 1080];
    const out = path.join(os.tmpdir(), 'sbcard-' + key.replace(/[^\w-]/g, '') + '-' + fmt + '.png');
    const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'sbshot-'));
    try { fs.unlinkSync(out); } catch (e) { /* yo'q */ }
    const args = ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1', '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--disable-sync', '--disable-component-update', '--disable-default-apps', '--disable-extensions', '--user-data-dir=' + prof,
      '--window-size=' + w + ',' + h, '--virtual-time-budget=8000', '--screenshot=' + out];
    // konteynerda sandbox ishlamaydi; faqat o'zimizning /card sahifasi ochiladi
    if ((process.getuid && process.getuid() === 0) || process.env.BROWSER_NO_SANDBOX) args.push('--no-sandbox', '--disable-dev-shm-usage');
    args.push('http://' + SELF_HOST + ':' + PORT + '/card?key=' + encodeURIComponent(key) + '&fmt=' + fmt + '&feed=0');
    const { spawn } = require('child_process');
    const p = spawn(bin, args, { stdio: 'ignore', windowsHide: true });
    const timer = setTimeout(() => p.kill(), 40000);
    const done = () => { clearTimeout(timer); fs.rm(prof, { recursive: true, force: true }, () => {}); resolve(fs.existsSync(out) && fs.statSync(out).size > 5000 ? out : null); };
    p.on('exit', done); p.on('error', () => { console.log('Telegram rasm: brauzer ishga tushmadi'); done(); });
  }));
}
function tgPhoto(file, caption, tries) {
  const conf = tgConf();
  if (!conf) return Promise.resolve(false);
  return new Promise((resolve) => {
    const b = '----sb' + crypto.randomBytes(8).toString('hex');
    const part = (name, val) => Buffer.from('--' + b + '\r\nContent-Disposition: form-data; name="' + name + '"\r\n\r\n' + val + '\r\n');
    const body = Buffer.concat([part('chat_id', conf.chat), part('caption', String(caption || '').slice(0, 1000)),
      Buffer.from('--' + b + '\r\nContent-Disposition: form-data; name="photo"; filename="' + path.basename(file) + '"\r\nContent-Type: image/png\r\n\r\n'), fs.readFileSync(file), Buffer.from('\r\n--' + b + '--\r\n')]);
    const req = tgRequest({ path: '/bot' + conf.token + '/sendPhoto', method: 'POST', timeout: 60000, headers: { 'Content-Type': 'multipart/form-data; boundary=' + b, 'Content-Length': body.length } }, (r) => {
      let out = ''; r.on('data', (d) => { out += d; });
      r.on('end', () => {
        if (r.statusCode === 200) { console.log('Telegram: rasm yuborildi (' + path.basename(file) + ', ' + pngSize(file) + ')'); return resolve(true); }
        tgLastError = 'Telegram rasm javobi ' + r.statusCode + ': ' + out.slice(0, 300); console.log(tgLastError);
        if ((tries || 1) < 3) setTimeout(() => tgPhoto(file, caption, (tries || 1) + 1).then(resolve), 4000); else resolve(false);
      });
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', (e) => { tgLastError = "Telegramga rasm yuborib bo'lmadi: " + e.message; if ((tries || 1) < 3) setTimeout(() => tgPhoto(file, caption, (tries || 1) + 1).then(resolve), 4000); else resolve(false); });
    req.end(body);
  });
}
function cardText(card) {
  const [a, b] = card.players;
  let t = '🏓 ' + [card.table, card.category, card.round].filter(Boolean).join(' · ') + '\n' + pname(a) + '  ' + a.sets + ' – ' + b.sets + '  ' + pname(b) + '\n🏆 ' + pname(card.players[card.winner]);
  if (card.sets.length) t += '\n' + card.sets.map((x) => x[0] + '-' + x[1]).join(', ');
  return t;
}
async function sendCardPhotos(key) {
  const card = cards.get(key);
  if (!card || !tgConf()) return false;
  let okAll = true;
  for (const fmt of ['h', 'v']) { // 1920x1080 va 1080x1920
    const file = await renderCard(key, fmt);
    if (!file) { okAll = false; continue; }
    const sent = await tgPhoto(file, cardText(card) + (fmt === 'h' ? '\n(1920×1080)' : '\n(1080×1920)'));
    okAll = okAll && sent;
    fs.unlink(file, () => {});
  }
  return okAll;
}

const cards = new Map(); // key -> natija kartochkasi
let lastCardKey = null;
const undo = {};
const clients = {}; // court id -> Set(res)
const allClients = new Map(); // res -> filtr (TV/overlay/planshet)

function getCourt(id) {
  if (!courts[id]) courts[id] = defaults(id);
  const c = courts[id];
  const d = defaults(id);
  for (const k of Object.keys(d)) if (c[k] === undefined) c[k] = d[k];
  c.players.forEach((p) => { if (p.given === undefined) p.given = ''; if (!Array.isArray(p.uids)) p.uids = []; });
  if (!c.settings.bestOf) c.settings.bestOf = c.settings.setsToWin * 2 - 1;
  return c;
}

const snapshot = (id) => JSON.stringify(Object.assign({}, getCourt(id), { now: Date.now(), version: VERSION }));

// ===== Reklamalar (overlay uchun) =====
let ads = Object.assign({ settings: { enabled: true, whenLive: false, liveEveryS: 60 }, items: [] }, readJson(ADSF, {}));
ads.settings = Object.assign({ enabled: true, whenLive: false, liveEveryS: 60 }, ads.settings);
const persistAds = () => writeJsonAtomic(ADSF, ads);
const ADS_PUBLIC = () => ({ settings: ads.settings, items: ads.items.filter((a) => a.enabled && AD_EXT[path.extname(a.file).toLowerCase()] && fs.existsSync(path.join(PUB, a.file))) });

// Mijozga mos qisqartirilgan holat: planshet faqat o'z stolini oladi (courts=3), reklama ma'lumoti faqat overlay'ga (ads=1)
const snapCache = new Map();
function allSnapshot(f) {
  f = f || { courts: null, ads: true };
  const key = (f.courts ? [...f.courts].sort().join(',') : '*') + (f.ads ? '+a' : '');
  if (snapCache.has(key)) return snapCache.get(key);
  const out = {};
  for (let i = 1; i <= COURT_COUNT; i++) getCourt(String(i)); // planshet/overlay uchun hamma stol doim bor
  const now = Date.now();
  Object.keys(courts).forEach((id) => {
    if (f.courts && !f.courts.has(id)) return;
    const c = getCourt(id);
    // o'yinchi statistikasi vaqti o'tgach, katta intro obyektini yubormaymiz
    out[id] = c.intro && now > c.intro.until + 3000 ? Object.assign({}, c, { intro: null }) : c;
  });
  const o = { now, version: VERSION, meta, courtCount: COURT_COUNT, courts: out };
  if (f.ads) o.ads = ADS_PUBLIC();
  const str = JSON.stringify(o);
  snapCache.set(key, str);
  return str;
}
const parseFilter = (url) => ({ courts: url.searchParams.get('courts') ? new Set(url.searchParams.get('courts').split(',').slice(0, 32).map((x) => x.trim()).filter(validCourt)) : null, ads: url.searchParams.get('ads') !== '0' });

let saveTimer = null;
function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => writeJsonAtomic(SAVE, { meta, courts }), 200);
}

const dirtyCourts = new Set(); let flushTimer = null;
function flush() {
  flushTimer = null;
  snapCache.clear();
  dirtyCourts.forEach((id) => { const d = 'data: ' + snapshot(id) + '\n\n'; (clients[id] || new Set()).forEach((res) => res.write(d)); });
  dirtyCourts.clear();
  allClients.forEach((f, res) => res.write('data: ' + allSnapshot(f) + '\n\n'));
}
// bir necha amal ketma-ket kelsa, 50 ms ichida bitta yangilanishga jamlanadi (tarmoq va protsessorni tejaydi)
function broadcast(id) {
  if (id) dirtyCourts.add(id);
  if (!flushTimer) flushTimer = setTimeout(flush, 50);
}

const num = (v, min, max, fallback) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};
const str = (v, n) => String(v).slice(0, n);

function afterPoint(c) {
  const [a, b] = c.players;
  const s = c.settings;
  const wins = (x, y) => x.points >= s.pointsToWin && x.points - y.points >= s.winBy;
  const setWinner = wins(a, b) ? 0 : wins(b, a) ? 1 : null;
  if (setWinner !== null) {
    c.players[setWinner].sets++;
    c.sets.push([a.points, b.points]);
    a.points = 0;
    b.points = 0;
    if (c.players[setWinner].sets >= s.setsToWin) {
      c.winner = setWinner;
      c.finishedAt = Date.now();
    } else {
      // geymdan keyin o'yinchilar tomon almashadi; avval qabul qilgan o'yinchi birinchi uzatadi
      c.swapped = !c.swapped;
      c.endsNote = 'game';
      if (c.starter !== null) {
        c.starter = 1 - c.starter;
        c.server = c.starter;
      }
    }
  } else {
    // hal qiluvchi geymda birinchi o'yinchi 5 ballga yetganda tomon almashadi
    const decider = a.sets === s.setsToWin - 1 && b.sets === s.setsToWin - 1;
    if (decider && !c.deciderDone && Math.max(a.points, b.points) >= 5) {
      c.deciderDone = true;
      c.swapped = !c.swapped;
      c.endsNote = 'decider';
    }
    if (c.server !== null && s.serveEvery > 0) {
      const total = a.points + b.points;
      const deuce = a.points >= s.pointsToWin - 1 && b.points >= s.pointsToWin - 1;
      if (deuce || total % s.serveEvery === 0) c.server = 1 - c.server;
    }
  }
}

const cleanUids = (u) => (Array.isArray(u) ? u.map((x) => String(x)).filter((x) => /^[\w-]{1,24}$/.test(x)).slice(0, 2) : []);

function setInfo(c, a) {
  if (typeof a.table === 'string') c.table = str(a.table, 30);
  if (typeof a.category === 'string') c.category = str(a.category, 40);
  if (typeof a.round === 'string') c.round = str(a.round, 40);
  if (typeof a.referee === 'string') c.referee = str(a.referee, 60);
  (a.players || []).slice(0, 2).forEach((p, i) => {
    if (typeof p.name === 'string') c.players[i].name = str(p.name, 60);
    if (typeof p.given === 'string') c.players[i].given = str(p.given, 40);
    if (typeof p.country === 'string') c.players[i].country = str(p.country.toUpperCase(), 3);
    if (typeof p.name === 'string') c.players[i].uids = cleanUids(p.uids); // o'yinchi almashsa, eski bog'lanish qolmasin
  });
  if (typeof a.showTie === 'boolean') c.showTie = a.showTie;
  if (Array.isArray(a.tie)) c.tie = [num(a.tie[0], 0, 3, c.tie[0]), num(a.tie[1], 0, 3, c.tie[1])];
  if (a.settings) {
    const s = c.settings;
    s.pointsToWin = num(a.settings.pointsToWin, 1, 100, s.pointsToWin);
    s.winBy = num(a.settings.winBy, 1, 10, s.winBy);
    if (a.settings.bestOf !== undefined) {
      s.bestOf = num(a.settings.bestOf, 1, 9, s.bestOf);
      if (s.bestOf % 2 === 0) s.bestOf += 1;
      s.setsToWin = (s.bestOf + 1) / 2;
    }
    s.serveEvery = num(a.settings.serveEvery, 0, 10, s.serveEvery);
  }
}

function resetMatch(c) {
  c.players.forEach((p) => { p.points = 0; p.sets = 0; });
  c.sets = [];
  c.winner = null;
  c.finishedAt = null;
  c.reported = false;
  c.startedAt = null;
  c.cards = [{ y: 0, r: 0 }, { y: 0, r: 0 }];
  c.server = null;
  c.starter = null;
  c.swapped = false;
  c.timeouts = [false, false];
  c.timeout = null;
  c.endsNote = null;
  c.deciderDone = false;
  c.intro = null;
  c.rating = null;
  c.histId = null; // tarix yozuvi saqlanib qoladi (statistika uchun)
}

const SNAP = new Set(['card', 'walkover', 'finish', 'point', 'minus', 'set', 'start', 'serve', 'swap', 'newmatch', 'resetall', 'timeout', 'tv']);

function apply(id, a) {
  if (a.type === 'meta') {
    if (typeof a.title1 === 'string') meta.title1 = str(a.title1, 80);
    if (typeof a.title2 === 'string') meta.title2 = str(a.title2, 80);
    return;
  }
  if (a.type === 'settings') { // admin: statistika / reyting sozlamalari
    if (typeof a.introOn === 'boolean') meta.introOn = a.introOn;
    if (a.introS !== undefined) meta.introS = num(a.introS, 5, 60, meta.introS);
    if (typeof a.ratingOn === 'boolean') meta.ratingOn = a.ratingOn;
    if (a.ratingS !== undefined) meta.ratingS = num(a.ratingS, 5, 60, meta.ratingS);
    if (a.ratingDelayS !== undefined) meta.ratingDelayS = num(a.ratingDelayS, 0, 30, meta.ratingDelayS);
    if (a.ratingK !== undefined) { const k = parseFloat(a.ratingK); if (Number.isFinite(k) && k > 0 && k <= 10) meta.ratingK = k; }
    if (typeof a.loserNonPositive === 'boolean') meta.loserNonPositive = a.loserNonPositive;
    if (typeof a.loserNoDeduct === 'boolean') meta.loserNoDeduct = a.loserNoDeduct;
    return;
  }
  const c = getCourt(id);
  if (a.type === 'undo') {
    const stack = undo[id] || [];
    if (!stack.length) return;
    const oldKey = c.histId;
    const prev = JSON.parse(stack.pop());
    prev.overlay = c.overlay;
    courts[id] = prev;
    reconcile(id, oldKey);
    return;
  }
  if (SNAP.has(a.type)) {
    (undo[id] = undo[id] || []).push(JSON.stringify(c));
    if (undo[id].length > 300) undo[id].shift();
  }
  const side = a.side === 1 ? 1 : 0;
  const before = SNAP.has(a.type) ? JSON.stringify(c) : null;
  switch (a.type) {
    case 'point':
      if (c.winner !== null) { undo[id].pop(); return; }
      // o'yin boshlanganda stol TV ga o'zi chiqadi
      if (!c.active && c.sets.length === 0 && c.players[0].points + c.players[1].points === 0) c.active = true;
      if (!c.startedAt) c.startedAt = Date.now();
      c.endsNote = null;
      c.timeout = null;
      c.intro = null; // ball berish boshlandi: o'yinchilar statistikasi avtomatik yopiladi
      c.players[side].points++;
      afterPoint(c);
      break;
    case 'minus':
      if (c.players[side].points > 0) c.players[side].points--;
      break;
    case 'set':
      setInfo(c, a);
      break;
    case 'start': // yangi o'yin: ma'lumotlarni saqlash + hisobni nollash + TV ga chiqarish + o'yinchilar statistikasi
      setInfo(c, a);
      resetMatch(c);
      c.startedAt = Date.now();
      c.active = true;
      makeIntro(c);
      break;
    case 'introshow': // hakam statistikani qayta ko'rsatadi
      if (c.winner === null && c.sets.length === 0 && c.players[0].points + c.players[1].points === 0) { c.active = true; makeIntro(c); }
      break;
    case 'introhide':
      c.intro = null;
      break;
    case 'card': { // sariq: ogohlantirish (belgi); qizil: raqibga +1 ball
      if (c.winner !== null) break;
      const cd = c.cards[side];
      if (a.color === 'y') cd.y = cd.y ? 0 : 1;
      else if (a.color === 'r') { cd.r++; c.endsNote = null; c.intro = null; c.players[1 - side].points++; afterPoint(c); }
      break;
    }
    case 'walkover': // texnik g'alaba: side g'olib
      if (c.winner !== null) break;
      c.winner = side;
      c.finishedAt = Date.now();
      c.active = true;
      c.intro = null;
      break;
    case 'finish': { // hakam "O'yinni yakunlash"ni bosdi: ko'p geym yutgan g'olib (teng bo'lsa — joriy ball bo'yicha)
      if (c.winner !== null) break;
      const [p0, p1] = c.players;
      const w = p0.sets !== p1.sets ? (p0.sets > p1.sets ? 0 : 1) : p0.points !== p1.points ? (p0.points > p1.points ? 0 : 1) : null;
      if (w === null) break;
      if (p0.points + p1.points > 0) { c.sets.push([p0.points, p1.points]); if (p0.points !== p1.points && (p0.points > p1.points ? 0 : 1) === w && p0.sets === p1.sets) c.players[w].sets++; p0.points = 0; p1.points = 0; }
      c.winner = w;
      c.finishedAt = Date.now();
      c.active = true;
      c.intro = null;
      break;
    }
    case 'tv':
      c.active = a.on === undefined ? !c.active : !!a.on;
      break;
    case 'serve':
      c.server = a.side === null || a.side === undefined ? null : side;
      c.starter = c.server;
      break;
    case 'swap':
      c.swapped = !c.swapped;
      c.endsNote = null;
      break;
    case 'timeout':
      if (c.winner === null && !c.timeouts[side]) {
        c.timeouts[side] = true;
        c.timeout = { side, until: Date.now() + TIMEOUT_MS };
      }
      break;
    case 'endtimeout':
      c.timeout = null;
      break;
    case 'overlay':
      c.overlay = !c.overlay;
      break;
    case 'newmatch': // hisobni nollash va TV dan olib tashlash (ismlar qoladi)
      resetMatch(c);
      c.active = false;
      break;
    case 'resetall':
      courts[id] = defaults(id);
      break;
  }
  // hech narsa o'zgarmagan bo'lsa (masalan, 2-taym-aut), bekor qilish ro'yxatiga qo'shilmasin
  if (before !== null && JSON.stringify(getCourt(id)) === before) undo[id].pop();
  reconcile(id);
}

// ===== Qura: o'yinchilarni bazaga bog'lash =====
const keyOf = (p) => pdb.norm((p.name || '') + ' ' + (p.given || ''));
function linkPlayers(list, prev) {
  const prevUid = new Map();
  (prev || []).forEach((p) => { if (p.uid) prevUid.set(keyOf(p), p.uid); });
  const amb = [];
  list.forEach((p, i) => {
    if (p.uid && !pdb.byId.has(p.uid)) delete p.uid;
    if (!p.uid && prevUid.has(keyOf(p))) p.uid = prevUid.get(keyOf(p));
    if (!p.uid) {
      const m = pdb.match(p);
      if (m.row) p.uid = m.row.id; else if (m.amb) amb.push(i);
    }
    if (p.uid) { const r = pdb.byId.get(p.uid); if (r && !p.country) p.country = 'UZB'; }
  });
  return amb;
}
function relinkMatches() {
  const byKey = new Map();
  data.players.forEach((p) => byKey.set(keyOf(p), p));
  data.matches.forEach((m) => { m.p = m.p.map((q) => { const f = byKey.get(keyOf(q)); return f ? Object.assign({}, q, { uid: f.uid || q.uid, country: q.country || f.country }) : q; }); });
}
const saveData = () => writeJsonAtomic(DATA, data);

// ===== Ommaviy ma'lumot (/live sahifasi) =====
function publicData() {
  const live = {};
  Object.keys(courts).forEach((id) => { const c = courts[id]; if (c.active) live[id] = { table: c.table, category: c.category, round: c.round, players: c.players.map((p) => ({ name: p.name, given: p.given, country: p.country, sets: p.sets, points: p.points })), sets: c.sets, winner: c.winner, settings: c.settings, server: c.server, tie: c.showTie ? c.tie : null }; });
  const tour = data.players.filter((p) => p.uid).map((p) => {
    const t = 'Y', pts = liveRating(p.uid, t), r = pdb.byId.get(p.uid), st = statIdx.get(p.uid) || { played: 0, won: 0, lost: 0 };
    return { uid: p.uid, name: p.name, given: p.given, country: p.country, region: (r && r.rg) || p.region || '', photo: pdb.photo(r), rating: pts, delta: ledIdx[t].get(p.uid) || 0, rank: rankNow(p.uid, t, pts), played: st.played, won: st.won, lost: st.lost, sex: p.sex || (r && r.sx) || '' };
  }).sort((a, b) => b.rating - a.rating);
  return {
    now: Date.now(), meta: { title1: meta.title1, title2: meta.title2 }, live,
    schedule: data.matches.map((m, i) => ({ i, table: m.table, category: m.category, round: m.round, p: m.p.map((q) => ({ name: q.name, given: q.given, country: q.country })), done: !!m.done })),
    results: hist.history.slice(-300).reverse().map((h) => ({ key: h.key, ts: h.ts, table: h.table, category: h.category, round: h.round, sides: h.sides.map((s) => ({ name: s.name, given: s.given, country: s.country, sets: s.sets })), sets: h.sets, winner: h.winner, rating: h.rating || null })),
    players: tour,
  };
}

// ===== HTTP =====
const PAGES = { '/card': 'card.html', '/': 'index.html', '/control': 'control.html', '/tv': 'tv.html', '/overlay': 'overlay.html', '/admin': 'admin.html', '/live': 'live.html' };
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.gif': 'image/gif',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.ico': 'image/x-icon',
};
// .svg ataylab YO'Q: SVG ichida skript bo'lishi mumkin — sayt domeni orqali ochilsa saqlangan XSS bo'ladi
const AD_EXT = { '.png': 'image', '.jpg': 'image', '.jpeg': 'image', '.webp': 'image', '.gif': 'image', '.mp4': 'video', '.webm': 'video' };
const gzCache = new Map();

function sendFile(req, res, full, url) {
  const st = fs.statSync(full);
  const ext = path.extname(full).toLowerCase();
  const uploaded = url.pathname.startsWith('/ads/') || url.pathname.startsWith('/players/'); // tashqaridan kelgan fayllar
  const immutable = url.pathname.startsWith('/flags/') || uploaded;
  const etag = '"' + st.size.toString(36) + '-' + Math.floor(st.mtimeMs).toString(36) + '"';
  const headers = { 'Content-Type': TYPES[ext] || 'application/octet-stream', ETag: etag, 'Cache-Control': immutable ? 'public, max-age=86400' : 'no-cache', 'X-Content-Type-Options': 'nosniff' };
  // Yuklangan fayl to'g'ridan-to'g'ri ochilsa ham skript ishlamaydi (alohida, sandbox qilingan kelib chiqish)
  if (uploaded) headers['Content-Security-Policy'] = 'sandbox';
  if (req.headers['if-none-match'] === etag) { res.writeHead(304, headers); return res.end(); }
  const textual = ['.html', '.js', '.css', '.json', '.svg'].includes(ext);
  const wantsGz = textual && /\bgzip\b/.test(req.headers['accept-encoding'] || '') && st.size > 800;
  if (ext === '.mp4' || ext === '.webm') { // video: bo'laklab uzatish (Range)
    const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
    if (m) {
      const start = m[1] ? parseInt(m[1], 10) : 0, end = m[2] ? Math.min(parseInt(m[2], 10), st.size - 1) : st.size - 1;
      res.writeHead(206, Object.assign(headers, { 'Content-Range': 'bytes ' + start + '-' + end + '/' + st.size, 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1 }));
      return fs.createReadStream(full, { start, end }).pipe(res);
    }
    headers['Accept-Ranges'] = 'bytes'; headers['Content-Length'] = st.size;
  }
  if (wantsGz) {
    let g = gzCache.get(full);
    if (!g || g.etag !== etag) { g = { etag, buf: zlib.gzipSync(fs.readFileSync(full)) }; gzCache.set(full, g); }
    headers['Content-Encoding'] = 'gzip'; headers['Content-Length'] = g.buf.length; headers.Vary = 'Accept-Encoding';
    res.writeHead(200, headers);
    return res.end(g.buf);
  }
  res.writeHead(200, headers);
  fs.createReadStream(full).pipe(res);
}

function readBody(req, limit, cb) {
  let body = '', over = false;
  req.on('data', (d) => { body += d; if (body.length > limit) { over = true; req.destroy(); } });
  req.on('end', () => { if (!over) cb(body); });
}
const json = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(obj)); };

// Bog'lash oynasi (admin) uchun faqat kerakli maydonlar: id, F.I.O., hudud, yosh (adashlarni ajratish uchun), reyting.
// Klub, rasm, jins va boshqa reyting turlari qaytarilmaydi.
const pickView = (r) => (r ? { id: r.id, fio: r.fio, region: r.rg || '', age: r.age || 0, Y: r.Y || 0 } : null);

// ===== Kirish kaliti (SB_ADMIN_TOKEN) =====
// Kalit berilsa: barcha GET bo'lmagan so'rovlar va quyidagi boshqaruv yo'llari faqat kalit bilan.
// Kalit uchta yo'l bilan keladi: `x-sb-token` sarlavhasi, `sb_token` cookie yoki bir martalik `?token=`
// (planshetda /control?court=1&token=... ochiladi — server cookie qo'yadi va manzildan kalitni olib tashlaydi).
// TV, overlay, /live, /card va ommaviy JSON (o'qish uchun) kalitsiz ishlaydi.
const PROTECTED_GET = new Set(['/control', '/admin', '/api/data', '/api/data/check', '/api/settings', '/api/telegram-test', '/api/pdb/search', '/api/pdb/link', '/api/ads']);
const TOKEN_COOKIE = 'sb_token';
function sameToken(t) {
  if (!ADMIN_TOKEN || typeof t !== 'string' || !t) return false;
  const a = Buffer.from(t), b = Buffer.from(ADMIN_TOKEN);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function cookieToken(req) {
  const m = /(?:^|;\s*)sb_token=([^;]*)/.exec(req.headers.cookie || '');
  if (!m) return '';
  try { return decodeURIComponent(m[1]); } catch (e) { return ''; }
}
const authorized = (req) => !ADMIN_TOKEN || sameToken(req.headers['x-sb-token']) || sameToken(cookieToken(req));
function deny(req, res, url) {
  if (url.pathname.startsWith('/api/')) return json(res, 401, { ok: false, error: 'Kirish kaliti kerak (SB_ADMIN_TOKEN)' });
  res.writeHead(401, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
  return res.end("Kirish kaliti kerak. Sahifani bir marta ?token=KALIT bilan oching, masalan: /control?court=1&token=KALIT");
}
/** true — so'rovga javob berildi (rad etildi yoki yo'naltirildi) */
function guard(req, res, url) {
  if (!ADMIN_TOKEN) return false;
  const q = url.searchParams.get('token');
  if (q !== null) {
    if (!sameToken(q)) { deny(req, res, url); return true; }
    url.searchParams.delete('token');
    const cookie = TOKEN_COOKIE + '=' + encodeURIComponent(ADMIN_TOKEN) + '; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000';
    if (req.method === 'GET' || req.method === 'HEAD') {
      // kalit manzilda (tarix, skrinshot, Referer) qolmasin
      res.writeHead(302, { Location: url.pathname + url.search, 'Set-Cookie': cookie, 'Cache-Control': 'no-store' });
      res.end();
      return true;
    }
    res.setHeader('Set-Cookie', cookie);
    return false;
  }
  const mutating = req.method !== 'GET' && req.method !== 'HEAD';
  if ((mutating || PROTECTED_GET.has(url.pathname)) && !authorized(req)) { deny(req, res, url); return true; }
  return false;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (guard(req, res, url)) return;
  const court = url.searchParams.get('court') || '1';
  const needsCourt = url.pathname === '/api/action' || url.pathname === '/api/state' || ((url.pathname === '/sb/events' || url.pathname === '/events') && url.searchParams.get('all') !== '1');
  if (needsCourt && !validCourt(court)) return json(res, 400, { ok: false, error: 'Stol raqami 1..' + COURT_COUNT + ' oralig\'ida bo\'lishi kerak' });

  // /sb/events — jonli oqim (sayt orqali ham shu yo'l); /events — eski to'g'ridan-to'g'ri ulanishlar uchun
  if (url.pathname === '/sb/events' || url.pathname === '/events') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no', 'Access-Control-Allow-Origin': '*' });
    res.write('retry: 1000\n\n');
    if (url.searchParams.get('all') === '1') {
      const f = parseFilter(url);
      res.write('data: ' + allSnapshot(f) + '\n\n');
      allClients.set(res, f);
      req.on('close', () => allClients.delete(res));
    } else {
      res.write('data: ' + snapshot(court) + '\n\n');
      (clients[court] = clients[court] || new Set()).add(res);
      req.on('close', () => clients[court].delete(res));
    }
    return;
  }

  if (url.pathname === '/api/action' && req.method === 'POST') {
    return readBody(req, 1e5, (body) => {
      try {
        const act = JSON.parse(body);
        if (act.type === 'startsite') {
          const r = startSiteMatch(court, String(act.siteId || ''));
          if (r.started) { persist(); broadcast(court); }
          return json(res, r.ok ? 200 : 409, r);
        }
        if (REQUIRE_CODE && act.type === 'start' && Number.isInteger(act.matchId) && data.matches[act.matchId] && data.matches[act.matchId].siteId) {
          return json(res, 403, { ok: false, error: "Sayt o'yini hakam paneli orqali, kod bilan boshlanadi" });
        }
        apply(court, act);
        if (act.type === 'start' && Number.isInteger(act.matchId) && data.matches[act.matchId]) {
          data.matches[act.matchId].done = true;
          const sid = data.matches[act.matchId].siteId; // sayt o'yini: natija tugagach saytga yuboriladi
          const cc = getCourt(court);
          cc.siteId = sid || undefined; cc.sitePosted = false;
          if (sid) { data.started = data.started || {}; data.started[sid] = true; }
          saveData();
        } else if (act.type === 'start' || act.type === 'newmatch') { const cc = getCourt(court); cc.siteId = undefined; cc.sitePosted = false; }
        reportFinished();
        persist();
        broadcast(court);
        json(res, 200, { ok: true });
      } catch (e) {
        console.log('Amal xatosi:', e.message);
        json(res, 400, { ok: false });
      }
    });
  }

  if (url.pathname === '/api/data' && req.method === 'POST') {
    return readBody(req, 5e6, (body) => {
      try {
        const d = JSON.parse(body);
        if (!Array.isArray(d.players) || !Array.isArray(d.matches)) throw new Error('bad');
        const players = d.players.slice(0, 2000);
        const amb = linkPlayers(players, data.players);
        data = { players, matches: d.matches.slice(0, 2000) };
        relinkMatches();
        saveData();
        const miss = players.filter((p) => !p.uid).length;
        json(res, 200, { ok: true, linked: players.length - miss, unlinked: miss, ambiguous: amb.length });
      } catch (e) { json(res, 400, { ok: false }); }
    });
  }
  if (url.pathname === '/api/data') return json(res, 200, REQUIRE_CODE ? Object.assign({ requireCode: true }, data) : data);

  // admin: bazaga bog'lanmagan o'yinchilar va nomzodlar
  if (url.pathname === '/api/data/check') {
    const out = data.players.map((p, i) => {
      const r = p.uid ? pdb.byId.get(p.uid) : null;
      const o = { i, name: p.name, given: p.given || '', country: p.country || '', uid: p.uid || '', linked: !!r };
      if (!r) { const m = pdb.match(p); o.cands = (m.amb || []).map(pickView); }
      return o;
    });
    return json(res, 200, { total: out.length, players: out, dbSize: pdb.size });
  }
  if (url.pathname === '/api/pdb/search') {
    const q = (url.searchParams.get('q') || '').slice(0, 60);
    return json(res, 200, q.trim().length < 2 ? [] : pdb.search(q, 15).map(pickView));
  }
  if (url.pathname === '/api/pdb/link' && req.method === 'POST') {
    return readBody(req, 1e4, (body) => {
      try {
        const b = JSON.parse(body);
        const p = data.players[b.i];
        if (!p) throw new Error('yo\'q');
        if (b.uid === '') delete p.uid; else if (pdb.byId.has(b.uid)) p.uid = b.uid; else throw new Error('baza');
        relinkMatches();
        saveData();
        json(res, 200, { ok: true });
      } catch (e) { json(res, 400, { ok: false }); }
    });
  }

  // admin: statistika / reyting sozlamalari
  if (url.pathname === '/api/settings') {
    if (req.method === 'POST') {
      return readBody(req, 1e4, (body) => {
        try { apply('1', Object.assign(JSON.parse(body), { type: 'settings' })); persist(); broadcast(); json(res, 200, { ok: true, meta }); } catch (e) { json(res, 400, { ok: false }); }
      });
    }
    return json(res, 200, meta);
  }

  // admin: reklamalar
  if (url.pathname === '/api/ads' && req.method === 'GET') return json(res, 200, ads);
  if (url.pathname === '/api/ads/upload' && req.method === 'POST') {
    const name = path.basename(url.searchParams.get('name') || 'ad');
    const ext = path.extname(name).toLowerCase();
    if (!AD_EXT[ext]) return json(res, 400, { ok: false, error: 'Fayl turi mos emas (png, jpg, webp, gif, mp4, webm)' });
    const limit = AD_EXT[ext] === 'video' ? 150e6 : 25e6;
    const id = crypto.randomBytes(5).toString('hex');
    const file = 'ads/' + id + ext;
    const out = fs.createWriteStream(path.join(PUB, file));
    let size = 0, bad = false;
    req.on('data', (d) => { size += d.length; if (size > limit && !bad) { bad = true; req.unpipe(out); out.destroy(); req.resume(); } });
    req.pipe(out);
    out.on('close', () => {
      if (bad) { fs.unlink(path.join(PUB, file), () => {}); return json(res, 413, { ok: false, error: 'Fayl juda katta (rasm 25 MB, video 150 MB gacha)' }); }
      const item = { id, type: AD_EXT[ext], file: '/' + file, title: str(url.searchParams.get('title') || name.replace(/\.[^.]+$/, ''), 80), durationS: num(url.searchParams.get('dur'), 3, 120, 10), enabled: true, courts: '', created: Date.now() };
      ads.items.push(item);
      persistAds(); broadcast();
      json(res, 200, { ok: true, item });
    });
    out.on('error', () => json(res, 500, { ok: false }));
    return;
  }
  if (url.pathname === '/api/ads/update' && req.method === 'POST') {
    return readBody(req, 1e4, (body) => {
      try {
        const b = JSON.parse(body);
        if (b.settings) {
          if (typeof b.settings.enabled === 'boolean') ads.settings.enabled = b.settings.enabled;
          if (typeof b.settings.whenLive === 'boolean') ads.settings.whenLive = b.settings.whenLive;
          if (b.settings.liveEveryS !== undefined) ads.settings.liveEveryS = num(b.settings.liveEveryS, 15, 600, ads.settings.liveEveryS);
        }
        const it = ads.items.find((x) => x.id === b.id);
        if (it) {
          if (typeof b.enabled === 'boolean') it.enabled = b.enabled;
          if (typeof b.title === 'string') it.title = str(b.title, 80);
          if (b.durationS !== undefined) it.durationS = num(b.durationS, 3, 120, it.durationS);
          if (typeof b.courts === 'string') it.courts = b.courts.replace(/[^\d,]/g, '').slice(0, 40);
          if (b.move === -1 || b.move === 1) {
            const i = ads.items.indexOf(it), j = i + b.move;
            if (j >= 0 && j < ads.items.length) { ads.items[i] = ads.items[j]; ads.items[j] = it; }
          }
        }
        persistAds(); broadcast();
        json(res, 200, { ok: true, ads });
      } catch (e) { json(res, 400, { ok: false }); }
    });
  }
  if (url.pathname === '/api/ads/delete' && req.method === 'POST') {
    return readBody(req, 1e4, (body) => {
      try {
        const b = JSON.parse(body);
        const it = ads.items.find((x) => x.id === b.id);
        if (it) { ads.items = ads.items.filter((x) => x !== it); fs.unlink(path.join(PUB, it.file), () => {}); }
        persistAds(); broadcast();
        json(res, 200, { ok: true, ads });
      } catch (e) { json(res, 400, { ok: false }); }
    });
  }

  if (url.pathname === '/card') { // natija rasmi uchun sahifa: kartochka ma'lumoti sahifaning ichiga joylanadi (so'rovsiz, aniq chiziladi)
    const k = url.searchParams.get('key') === 'last' ? lastCardKey : url.searchParams.get('key');
    const cd = cards.get(k);
    const html = fs.readFileSync(path.join(PUB, 'card.html'), 'utf8').replace('/*CARD_JSON*/null', cd ? JSON.stringify(cd).replace(/</g, '\\u003c') : 'null');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    return res.end(html);
  }
  if (url.pathname === '/api/card') {
    const k = url.searchParams.get('key') === 'last' ? lastCardKey : url.searchParams.get('key');
    const cd = cards.get(k);
    return cd ? json(res, 200, cd) : json(res, 404, { ok: false });
  }
  if (url.pathname === '/api/public') { res.setHeader('Access-Control-Allow-Origin', '*'); return json(res, 200, publicData()); }
  if (url.pathname === '/api/history') return json(res, 200, hist.history);

  if (url.pathname === '/api/telegram-test' && url.searchParams.get('photo')) {
    tgLastError = '';
    if (!tgConf()) { res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end("telegram.json topilmadi yoki bo'sh"); }
    if (!lastCardKey || !cards.has(lastCardKey)) { res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end("Hali tugagan o'yin yo'q: avval bitta o'yinni tugating"); }
    sendCardPhotos(lastCardKey).then((ok) => { res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end(ok ? "Ikkala rasm (1920x1080 va 1080x1920) yuborildi — Telegramni tekshiring" : 'Yuborilmadi. ' + (tgLastError || findBrowser() ? tgLastError : "Edge/Chrome topilmadi (BROWSER_PATH)")); });
    return;
  }
  if (url.pathname === '/api/telegram-test') {
    tgLastError = '';
    const ok = !!tgConf();
    (ok ? tgSend('✅ Scoreboard: Telegram ulandi') : Promise.resolve(false)).then((sent) => {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(!ok ? 'telegram.json topilmadi yoki bo\'sh (token va chat_id kerak)' : sent ? 'Yuborildi — Telegramni tekshiring' : 'Yuborilmadi. ' + tgLastError + '  [chat_id: ' + (tgConf() || {}).chat + ']');
    });
    return;
  }
  if (url.pathname === '/api/state') { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(snapshot(court)); }
  if (url.pathname === '/api/all') { snapCache.clear(); res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' }); return res.end(allSnapshot()); }

  let file;
  try { file = PAGES[url.pathname] || decodeURIComponent(url.pathname.slice(1)); } catch (e) { res.writeHead(400); return res.end('Xato'); }
  const full = path.join(PUB, path.normalize(file));
  if (!full.startsWith(PUB + path.sep) || !fs.existsSync(full) || fs.statSync(full).isDirectory()) {
    res.writeHead(404);
    return res.end('Topilmadi');
  }
  sendFile(req, res, full, url);
});

// ulanishlarni uzoqroq ushlab turamiz: planshetlar har bosishda qayta ulanmasin (standart 5 s juda qisqa)
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;
server.maxConnections = 2000;

// har 4 soniyada hamma oynaga to'liq holat yuboriladi: ham "yurak urishi", ham yo'qolgan xabarni tuzatadi
const pingAll = () => {
  Object.values(clients).forEach((set) => set.forEach((r) => r.write(': ping\n\n')));
  if (allClients.size) {
    snapCache.clear();
    allClients.forEach((f, r) => r.write('data: ' + allSnapshot(f) + '\n\n'));
  }
};
setInterval(pingAll, 4000);

process.on('uncaughtException', (e) => console.log('KUTILMAGAN XATO (server ishlashda davom etadi):', e && e.stack || e));

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.log('\nXATO: ' + PORT + '-port band. Scoreboard serveri allaqachon ishlayotgan bo\'lishi mumkin.');
    console.log('Eski qora (konsol) oynani yoping va qayta urinib ko\'ring, yoki boshqa port: set PORT=3101 & node server.js');
  } else console.log('XATO:', e.message);
  process.exit(1);
});

// o'yinchilar ro'yxati bazaga hali bog'lanmagan bo'lsa (eski data.json), ishga tushganda bir marta bog'laymiz
if (data.players.length && data.players.some((p) => p.uid === undefined)) { linkPlayers(data.players, []); relinkMatches(); saveData(); }

if (require.main === module) {
  server.listen(PORT, HOST, () => {
    siteBridge = require('./site-bridge').start({ getData: () => data, linkPlayers, relinkMatches, saveData, courts: () => courts, persist });
    const lan = HOST !== '127.0.0.1' && HOST !== 'localhost' && HOST !== '::1';
    const ips = !lan ? [] : HOST === '0.0.0.0' || HOST === '::'
      ? Object.values(os.networkInterfaces()).flat().filter((i) => i.family === 'IPv4' && !i.internal).map((i) => i.address)
      : [HOST];
    console.log('Scoreboard ishga tushdi. ' + HOST + ':' + PORT);
    if (!lan) console.log('Faqat shu kompyuterdan ochiladi (127.0.0.1). Zal tarmog\'i uchun: SB_HOST=0.0.0.0 va SB_ADMIN_TOKEN=<uzun kalit>');
    if (ADMIN_TOKEN) console.log('Kirish kaliti yoqilgan: planshetda bir marta /control?court=1&token=<kalit> oching (admin: /admin?token=<kalit>)');
    else if (lan) console.log('\n!!! DIQQAT: tarmoqqa ochiq, lekin SB_ADMIN_TOKEN berilmagan — zal Wi-Fi\'dagi istalgan qurilma hisobni o\'zgartira oladi !!!\n');
    console.log('O\'yinchilar bazasi: ' + pdb.size + ' ta, rasmlar: ' + (fs.existsSync(PHOTOS) ? fs.readdirSync(PHOTOS).length : 0) + ' ta');
    console.log(tgConf() ? 'Telegram: sozlangan (test: http://localhost:' + PORT + '/api/telegram-test)' : "Telegram: SOZLANMAGAN — telegram.json ga token va chat_id yozing");
    (ips.length ? ips : ['localhost']).forEach((ip) => {
      console.log('  Planshet (har stolga o\'z raqami): http://' + ip + ':' + PORT + '/control?court=1  ... court=8');
      console.log('  TV (hamma faol o\'yinlar)        : http://' + ip + ':' + PORT + '/tv');
      console.log('  Overlay (stol bo\'yicha)         : http://' + ip + ':' + PORT + '/overlay?court=1');
      console.log('  Ommaviy sahifa (tomoshabin)      : http://' + ip + ':' + PORT + '/live');
      console.log('  Admin (qura, reklama, sozlama)   : http://' + ip + ':' + PORT + '/admin');
    });
  });
}
module.exports = { server, apply, getCourt, courts, hist, ads, rating, pdb };
