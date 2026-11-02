// uttf.uz reyting bazasi (players-db.json): rasm, reyting, yosh, hudud + ism bo'yicha avtomatik moslashtirish.
const fs = require('fs');
const path = require('path');

const CY = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'j', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'x', ц: 's', ч: 'ch', ш: 'sh', щ: 'sh', ъ: '', ы: 'i', ь: '', э: 'e', ю: 'yu', я: 'ya', ў: 'o', қ: 'q', ғ: 'g', ҳ: 'x', ҷ: 'j' };
function norm(s) {
  s = String(s || '').toLowerCase();
  s = Array.from(s).map((ch) => (CY[ch] !== undefined ? CY[ch] : ch)).join('');
  s = s.replace(/[‘’`ʻʼ´]/g, "'").replace(/([og])'/g, '$1').replace(/kh/g, 'x').replace(/h/g, 'x').replace(/y/g, 'i');
  s = s.replace(/[^a-z ]/g, '').replace(/(.)\1+/g, '$1').replace(/\s+/g, ' ').trim();
  return s;
}

function create(dir, photosDir) {
  let rows = [];
  try { rows = JSON.parse(fs.readFileSync(path.join(dir, 'players-db.json'), 'utf8')).players || []; } catch (e) { rows = []; }
  const byId = new Map(), byKey = new Map(), bySn = new Map();
  rows.forEach((r) => {
    byId.set(r.id, r);
    const t = r.fio.split(/\s+/);
    r._sn = norm(t[0]); r._gn = norm(t[1] || '');
    const k = r._sn + '|' + r._gn;
    (byKey.get(k) || byKey.set(k, []).get(k)).push(r);
    (bySn.get(r._sn) || bySn.set(r._sn, []).get(r._sn)).push(r);
  });
  const ranked = (t) => rows.filter((r) => r[t] > 0).map((r) => r[t]).sort((a, b) => b - a);
  const sorted = { Y: ranked('Y'), D: ranked('D'), A: ranked('A') };

  const photoCache = new Map();
  function photo(r) {
    if (!r || !r.ph) return '';
    if (!photoCache.has(r.ph)) photoCache.set(r.ph, fs.existsSync(path.join(photosDir, r.ph + '.jpg')));
    return photoCache.get(r.ph) ? '/players/' + r.ph + '.jpg' : '';
  }

  // Ism bo'yicha yagona nomzod: { row } | { amb: [rows] } | {}
  function match(p) {
    const sn = norm(p.name), gn = norm(p.given);
    let c = byKey.get(sn + '|' + gn) || [];
    if (!c.length && gn) c = (bySn.get(sn) || []).filter((r) => r._gn.slice(0, 3) === gn.slice(0, 3));
    if (!c.length && !gn && sn.includes(' ')) { // "Familiya Ism" bitta maydonda yozilgan bo'lsa
      const t = sn.split(' ');
      c = byKey.get(t[0] + '|' + t[1]) || [];
    }
    if (c.length > 1 && p.sex) { const s = c.filter((r) => r.sx === p.sex); if (s.length) c = s; }
    if (c.length > 1 && p.region) { const rg = norm(p.region).slice(0, 4); const s = c.filter((r) => norm(r.rg).slice(0, 4) === rg); if (s.length) c = s; }
    if (c.length > 1) { const s = c.filter((r) => r.Y > 0); if (s.length === 1) c = s; else if (s.length) c = s.sort((a, b) => b.Y - a.Y).slice(0, 1).concat(s.length > 1 && s[0].Y === s[1].Y ? [s[1]] : []); }
    if (c.length === 1) return { row: c[0] };
    if (c.length > 1) return { amb: c.slice(0, 6) };
    return {};
  }

  function search(q, limit) {
    const t = norm(q).split(' ').filter(Boolean);
    if (!t.length) return [];
    const out = [];
    for (const r of rows) {
      const hay = r._sn + ' ' + r._gn;
      if (t.every((x) => hay.includes(x))) { out.push(r); if (out.length >= (limit || 20)) break; }
    }
    return out.sort((a, b) => (b.Y || 0) - (a.Y || 0));
  }

  const view = (r) => (r ? { id: r.id, fio: r.fio, region: r.rg || '', age: r.age || 0, club: r.cl || '', photo: photo(r), Y: r.Y || 0, D: r.D || 0, A: r.A || 0, sx: r.sx } : null);
  // jonli reytingdagi o'rin: boshqalardan nechtasi yuqori + 1
  function rankOf(type, pts, selfBase) {
    if (!(pts > 0)) return 0;
    const arr = sorted[type] || [];
    let lo = 0, hi = arr.length; // arr kamayuvchi; pts dan katta elementlar soni
    while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m] > pts) lo = m + 1; else hi = m; }
    return lo + 1 - (selfBase > pts ? 1 : 0);
  }
  return { rows, byId, match, search, view, photo, rankOf, norm, size: rows.length };
}

module.exports = { create, norm };
