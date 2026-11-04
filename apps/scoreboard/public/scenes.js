// To'liq ekranli sahnalar (TV va overlay uchun): 1) o'yin oldidan o'yinchilar statistikasi, 2) o'yindan keyin reyting yangilanishi.
// Sahna vaqti serverda belgilanadi (c.intro.from/until, c.rating.from/until) — hamma ekranlar bir vaqtda ko'rsatadi.
// common.js va flags.js dan keyin ulanadi.
const Scenes = (() => {
  const LANG = (Q.get('lang') === 'uz') ? 'uz' : 'en';
  const L = {
    en: { prof: 'PLAYER PROFILES', upd: 'RATING UPDATE', rating: 'RATING', age: 'AGE', reg: 'REGION', club: 'CLUB', pl: 'PLAYED', won: 'WON', lost: 'LOST', winner: 'WINNER', lb: 'RANKING', res: 'MATCH RESULT', game: 'GAME', rank: 'RANK', pts: 'pts', new: 'unranked' },
    uz: { prof: "O'YINCHILAR", upd: 'REYTING YANGILANDI', rating: 'REYTING', age: 'YOSH', reg: 'HUDUD', club: 'KLUB', pl: "O'YIN", won: 'YUTUQ', lost: 'YUTQAZ', winner: "G'OLIB", lb: 'REYTING JADVALI', res: 'NATIJA', game: 'GEYM', rank: "O'RIN", pts: 'ball', new: "reytingsiz" },
  }[LANG];
  let el = null, cur = null, raf = 0, hideT = 0, anim = [];
  const srv = (c) => Date.now() - (c._off || 0);

  function mount(root, opt) {
    CLEAR = !!(opt && opt.clear);
    el = document.createElement('div');
    el.className = 'scene tvbg' + (opt && opt.big ? ' big' : '');
    (root || document.body).appendChild(el);
    return el;
  }

  // Hozir ko'rsatilishi kerak bo'lgan sahna (eng oxirgi boshlanganlari ustun) yoki null
  function pick(courts, opt) {
    opt = opt || {};
    if (Q.get('scenes') === '0') return null;
    let best = null;
    Object.entries(courts).forEach(([id, c]) => {
      if (opt.only && id !== opt.only) return;
      if (opt.filter && !opt.filter.includes(id)) return;
      const t = srv(c);
      if (c.intro && t >= c.intro.from && t < c.intro.until) {
        if (!best || c.intro.from > best.from) best = { kind: 'intro', meta: opt.meta, key: 'i' + id + '-' + c.intro.from, id, c, from: c.intro.from, until: c.intro.until, off: c._off };
      }
      if (c.rating && c.winner !== null && t >= c.rating.from && t < c.rating.until) {
        if (!best || c.rating.from > best.from) best = { kind: 'rating', meta: opt.meta, key: 'r' + id + '-' + c.rating.key, id, c, from: c.rating.from, until: c.rating.until, off: c._off };
      }
    });
    return best;
  }

  const initials = (p) => esc(((p.name || '?').trim()[0] || '?') + ((p.given || '').trim()[0] || ''));
  function photo(p) {
    return '<div class="pph"><span class="ini">' + initials(p) + '</span>' + (p.photo ? '<img src="' + esc(p.photo) + '" alt="" onerror="this.remove()">' : '') + '</div>';
  }
  function nameBlock(p) {
    const f = p.country ? flag(p.country) : '';
    const n = ((p.name || '') + ' ' + (p.given || '')).length;
    return '<div class="phead' + (n > 26 ? ' xs' : n > 20 ? ' sm' : '') + '">' + f + '<b>' + esc(p.name) + '</b>' + (p.given ? '<span>' + esc(p.given) + '</span>' : '') + '</div>';
  }
  const fmt = (v) => (Math.round(v * 100) / 100).toFixed(2);

  function introCard(p) {
    const chips = [];
    if (p.age) chips.push('<span><i>' + L.age + '</i>' + p.age + '</span>');
    if (p.region) chips.push('<span><i>' + L.reg + '</i>' + esc(p.region) + '</span>');
    return '<div class="pcard">' + nameBlock(p) + photo(p) + '<div class="pinfo">'
      + '<div class="pchips">' + chips.join('') + '</div>'
      + '<div class="prt"><div class="rl">' + L.rating + '</div><div class="rv cnt" data-to="' + (p.rating || 0) + '" data-from="0" data-dec="2">' + fmt(p.rating || 0) + '</div>'
      + (p.rank ? '<div class="rk">#' + p.rank + '</div>' : '<div class="rk none">' + L.new + '</div>') + '</div>'
      + '<div class="pst"><div><b class="cnt" data-to="' + p.played + '" data-from="0" data-dec="0">' + p.played + '</b><span>' + L.pl + '</span></div>'
      + '<div class="w"><b class="cnt" data-to="' + p.won + '" data-from="0" data-dec="0">' + p.won + '</b><span>' + L.won + '</span></div>'
      + '<div class="l"><b class="cnt" data-to="' + p.lost + '" data-from="0" data-dec="0">' + p.lost + '</b><span>' + L.lost + '</span></div></div>'
      + '</div></div>';
  }

  function ratingCard(p, won) {
    const d = p.delta;
    const dTxt = (d > 0 ? '+' : d < 0 ? '−' : '') + fmt(Math.abs(d));
    let rk;
    if (p.rankAfter && p.rankBefore && p.rankAfter !== p.rankBefore) {
      const up = p.rankAfter < p.rankBefore;
      rk = '<div class="rkc ' + (up ? 'up' : 'dn') + '"><span class="from">#' + p.rankBefore + '</span><span class="arr">' + (up ? '▲' : '▼') + '</span><span class="to">#' + p.rankAfter + '</span><em>' + (up ? '+' : '−') + Math.abs(p.rankBefore - p.rankAfter) + '</em></div>';
    } else if (p.rankAfter && !p.rankBefore) rk = '<div class="rkc up"><span class="from">—</span><span class="arr">▲</span><span class="to">#' + p.rankAfter + '</span></div>';
    else rk = '<div class="rkc"><span class="to">' + (p.rankAfter ? '#' + p.rankAfter : '—') + '</span></div>';
    return '<div class="pcard' + (won ? ' won' : '') + '">' + nameBlock(p) + photo(p) + '<div class="pinfo">'
      + (won ? '<div class="wtag">' + L.winner + '</div>' : '')
      + '<div class="prt big"><div class="rl">' + L.rating + '</div><div class="rv cnt" data-from="' + p.before + '" data-to="' + p.after + '" data-dec="2" data-delay="900" data-dur="2400">' + fmt(p.before) + '</div></div>'
      + '<div class="dchip ' + (d > 0 ? 'pos' : d < 0 ? 'neg' : '') + '">' + dTxt + '</div>'
      + rk + '</div></div>';
  }


  // ===== "Tale of the Tape" ko'rinishi: chapda/o'ngda o'yinchi (rasm + bayroq + ism plashkasi), o'rtada statistika paneli =====
  let CLEAR = false;
  const val = (list, f) => list.map(f).join(' / ');
  function tapePlayer(p, side) {
    const fu = p.country ? flagUrl(p.country) : '';
    const n = (p.name || '').length;
    const rec = (p.played || p.won || p.lost) ? p.won + '-' + p.lost : '';
    return '<div class="tp-pl ' + side + '">'
      + '<div class="tp-flag"' + (fu ? ' style="background-image:url(' + fu + ')"' : '') + '></div>'
      + '<div class="tp-ph"><span class="ini">' + initials(p) + '</span>' + (p.photo ? '<img src="' + esc(p.photo) + '" alt="" onerror="this.remove()">' : '') + '</div>'
      + '<div class="tp-plate"><div class="tpi">' + (p.rank ? '<i class="tp-rk">' + p.rank + '</i>' : '') + (p.given ? '<small>' + esc(p.given) + '</small>' : '') + '<b class="' + (n > 13 ? 'xs' : n > 10 ? 'sm' : '') + '">' + esc(p.name) + '</b></div></div>'
      + '<div class="tp-rec">' + (fu ? '<img src="' + fu + '" alt="">' : '') + (rec ? '<span>' + rec + '</span>' : '') + '<em>' + (p.rating ? fmt(p.rating) : '—') + '</em></div>'
      + '</div>';
  }
  function tapeHtml(c, meta) {
    const s = c.intro.sides;
    const rows = [
      [L.age, (l) => val(l, (p) => p.age || '–')],
      [L.rating, (l) => val(l, (p) => (p.rating ? fmt(p.rating) : '–'))],
      [L.rank, (l) => val(l, (p) => (p.rank ? '#' + p.rank : '–'))],
      [L.reg, (l) => { const r = [...new Set(l.map((p) => p.region || '–'))]; return r.map(esc).join(' / '); }],
      [L.pl, (l) => val(l, (p) => p.played)],
      [L.won, (l) => val(l, (p) => p.won)],
      [L.lost, (l) => val(l, (p) => p.lost)],
    ];
    const two = s[0].list.length > 1 || s[1].list.length > 1;
    const sub = [c.category, c.round].filter(Boolean).join(' · ');
    return '<div class="tp' + (two ? ' two' : '') + '">'
      + '<div class="tp-side L">' + s[0].list.map((p) => tapePlayer(p, 'L')).join('') + '</div>'
      + '<div class="tp-center"><div class="tp-tab">' + esc(meta && meta.title1 ? meta.title1 : c.table) + '</div>'
      + '<div class="tp-head"><b>' + L.prof + '</b><i>' + esc(sub) + '</i><u>' + esc(c.table) + '</u></div>'
      + rows.map((r, i) => {
        const a = r[1](s[0].list), b = r[1](s[1].list);
        const long = a.length > 11 || b.length > 11;
        return '<div class="tp-row" style="animation-delay:' + (0.5 + i * 0.09) + 's"><span class="' + (long ? 'lg' : '') + '">' + a + '</span><em>' + r[0] + '</em><span class="' + (long ? 'lg' : '') + '">' + b + '</span></div>';
      }).join('')
      + '</div>'
      + '<div class="tp-side R">' + s[1].list.map((p) => tapePlayer(p, 'R')).join('') + '</div></div>';
  }

  // ===== O'yin tugagach: xuddi shu ko'rinishda reyting yangilanishi =====
  const sgn = (d) => (d > 0 ? '+' : d < 0 ? '−' : '') + fmt(Math.abs(d));
  function rankChange(p) {
    const a = p.rankBefore, b = p.rankAfter;
    if (b && a && b < a) return '<span class="rkch up"><s>#' + a + '</s><b>▲</b>#' + b + '</span>';
    if (b && a && b > a) return '<span class="rkch dn"><s>#' + a + '</s><b>▼</b>#' + b + '</span>';
    if (b && !a) return '<span class="rkch up"><s>—</s><b>▲</b>#' + b + '</span>';
    return '<span class="rkch">' + (b ? '#' + b : '—') + '</span>';
  }
  function tapeRatingHtml(c, meta) {
    const sides = c.rating.sides.slice().sort((x, y) => x.idx - y.idx);
    const view = (sd) => sd.list.map((p) => Object.assign({}, p, { rating: p.after, rank: p.rankAfter, played: 0, won: 0, lost: 0 }));
    const two = sides[0].list.length > 1 || sides[1].list.length > 1;
    const plr = (sd, side) => view(sd).map((p) => tapePlayer(p, side).replace('<div class="tp-rec">', '<div class="tp-rec">' + '').replace(/<div class="tp-rec">[\s\S]*<\/div>$/, '<div class="tp-rec">' + (p.country && flagUrl(p.country) ? '<img src="' + flagUrl(p.country) + '" alt="">' : '') + '<em class="' + (p.delta > 0 ? 'g' : p.delta < 0 ? 'r' : '') + '">' + sgn(p.delta) + '</em><small>' + fmt(p.before) + ' → ' + fmt(p.after) + '</small></div></div>')
      .replace('<div class="tp-ph">', (sd.won ? '<div class="tp-win">' + L.winner + '</div>' : '') + '<div class="tp-ph">')).join('');
    const joinV = (sd, f) => sd.list.map(f).join(' / ');
    const cnt = (p) => '<span class="cnt" data-from="' + p.before + '" data-to="' + p.after + '" data-dec="2" data-delay="700" data-dur="2300">' + fmt(p.before) + '</span>';
    const chip = (p) => '<span class="tp-chip ' + (p.delta > 0 ? 'pos' : p.delta < 0 ? 'neg' : '') + '">' + sgn(p.delta) + '</span>';
    const rows = [
      [L.rating, (sd) => joinV(sd, cnt), 0],
      ['+ / −', (sd) => joinV(sd, chip), 1],
      [L.rank, (sd) => joinV(sd, rankChange), 2],
    ];
    const all = [];
    sides.forEach((sd) => sd.list.forEach((p) => all.push(Object.assign({}, p, { win: sd.won }))));
    all.sort((x, y) => y.after - x.after);
    const lb = all.map((p, i) => {
      const up = p.rankAfter && (!p.rankBefore || p.rankAfter < p.rankBefore), dn = p.rankBefore && p.rankAfter > p.rankBefore;
      return '<div class="tp-lbr' + (p.win ? ' w' : '') + '" style="animation-delay:' + (3.6 + i * 0.15) + 's"><i>' + (p.rankAfter || '–') + '</i><u class="' + (up ? 'up' : dn ? 'dn' : '') + '">' + (up ? '▲' : dn ? '▼' : '–') + '</u>'
        + '<span>' + (p.country && flagUrl(p.country) ? '<img src="' + flagUrl(p.country) + '" alt="">' : '') + '<b>' + esc(p.name) + '</b></span><em class="cnt" data-from="' + p.before + '" data-to="' + p.after + '" data-dec="2" data-delay="700" data-dur="2300">' + fmt(p.before) + '</em></div>';
    }).join('');
    const sc = c.players[0].sets + ' – ' + c.players[1].sets;
    const games = c.sets || [];
    const gameRow = (i) => '<div class="tp-setr' + (c.players[i].sets > c.players[1 - i].sets ? ' w' : '') + '"><b>' + esc(c.players[i].name) + '</b>' + games.map((g) => '<span class="' + (g[i] > g[1 - i] ? 'gw' : '') + '">' + g[i] + '</span>').join('') + '</div>';
    const gamesHtml = games.length ? '<div class="tp-sets" style="--n:' + games.length + '"><div class="tp-setn"><i></i>' + games.map((g, i) => '<i>' + (i + 1) + '</i>').join('') + '</div>' + gameRow(0) + gameRow(1) + '</div>' : '';
    return '<div class="tp rt' + (two ? ' two' : '') + '">'
      + '<div class="tp-side L">' + plr(sides[0], 'L') + '</div>'
      + '<div class="tp-center"><div class="tp-tab">' + esc(meta && meta.title1 ? meta.title1 : c.table) + '</div>'
      + '<div class="tp-head"><b>' + L.upd + '</b><i>' + esc([c.category, c.round].filter(Boolean).join(' · ')) + '</i><u class="sc">' + esc(sc) + '</u></div>' + gamesHtml
      + rows.map((r, i) => '<div class="tp-row" style="animation-delay:' + (0.4 + i * 0.1) + 's"><span class="' + (two ? 'lg' : '') + '">' + r[1](sides[0]) + '</span><em>' + r[0] + '</em><span class="' + (two ? 'lg' : '') + '">' + r[1](sides[1]) + '</span></div>').join('')
      + '<div class="tp-lb"><div class="tp-lbh">' + L.lb + '</div>' + lb + '</div></div>'
      + '<div class="tp-side R">' + plr(sides[1], 'R') + '</div></div>';
  }

  function sideHtml(list, fn) {
    return '<div class="sc-side' + (list.length > 1 ? ' two' : '') + '">' + list.map(fn).join('') + '</div>';
  }

  function build(cand) {
    const c = cand.c;
    const title = matchTitle(c);
    let body;
    if (cand.kind === 'intro') {
      body = tapeHtml(c, cand.meta);
    } else {
      body = tapeRatingHtml(c, cand.meta);
    }
    const remain = Math.max(1, cand.until - srv(c));
    el.classList.toggle('clear', !!CLEAR);
    el.innerHTML = '<div class="sc-wrap ' + cand.kind + '">' + body + '</div><div class="sc-bar"><i style="animation-duration:' + remain + 'ms"></i></div>';
    // juftlikda rasm kichikroq
    
    startAnim();
  }

  function startAnim() {
    cancelAnimationFrame(raf);
    const t0 = performance.now();
    anim = Array.from(el.querySelectorAll('.cnt')).map((n) => ({ n, from: parseFloat(n.dataset.from), to: parseFloat(n.dataset.to), dec: parseInt(n.dataset.dec, 10), delay: parseInt(n.dataset.delay || '350', 10), dur: parseInt(n.dataset.dur || '1600', 10) }));
    anim.forEach((a) => { a.n.textContent = a.dec ? a.from.toFixed(a.dec) : String(Math.round(a.from)); });
    const tick = (now) => {
      let live = false;
      anim.forEach((a) => {
        const k = Math.min(1, Math.max(0, (now - t0 - a.delay) / a.dur));
        if (k < 1) live = true;
        const e = 1 - Math.pow(1 - k, 3); // easeOutCubic
        const v = a.from + (a.to - a.from) * e;
        a.n.textContent = a.dec ? v.toFixed(a.dec) : String(Math.round(v));
      });
      if (live) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }

  // ===== Telegram uchun natija kartochkasi (animatsiyasiz, yakuniy holat) =====
  function tapeResultHtml(card, meta) {
    const sides = card.sides.slice().sort((x, y) => x.idx - y.idx);
    const view = (sd) => sd.list.map((p) => Object.assign({}, p, { played: 0, won: 0, lost: 0 }));
    const two = sides[0].list.length > 1 || sides[1].list.length > 1;
    const plr = (sd, side) => view(sd).map((p) => tapePlayer(p, side)
      .replace(/<div class="tp-rec">[\s\S]*<\/div>$/, '<div class="tp-rec">' + (p.country && flagUrl(p.country) ? '<img src="' + flagUrl(p.country) + '" alt="">' : '') + '<span>' + card.players[sd.idx].sets + '</span></div></div>')
      .replace('<div class="tp-ph">', (sd.won ? '<div class="tp-win">' + L.winner + '</div>' : '') + '<div class="tp-ph">')).join('');
    const sc = card.players[0].sets + ' – ' + card.players[1].sets;
    const rows = card.sets.map((g, i) => '<div class="tp-row"><span class="' + (g[0] > g[1] ? 'gw' : '') + '">' + g[0] + '</span><em>' + L.game + ' ' + (i + 1) + '</em><span class="' + (g[1] > g[0] ? 'gw' : '') + '">' + g[1] + '</span></div>').join('');
    return '<div class="tp rt' + (two ? ' two' : '') + '">'
      + '<div class="tp-side L">' + plr(sides[0], 'L') + '</div>'
      + '<div class="tp-center"><div class="tp-tab">' + esc(meta && meta.title1 ? meta.title1 : card.table) + '</div>'
      + '<div class="tp-head"><b>' + L.res + '</b><i>' + esc([card.category, card.round].filter(Boolean).join(' · ')) + '</i><u class="sc">' + esc(sc) + '</u></div>' + rows
      + (card.tie ? '<div class="tp-row"><span>' + card.tie[0] + '</span><em>' + esc(card.players[0].country || '') + ' / ' + esc(card.players[1].country || '') + '</em><span>' + card.tie[1] + '</span></div>' : '') + '</div>'
      + '<div class="tp-side R">' + plr(sides[1], 'R') + '</div></div>';
  }
  function renderCard(root, card) {
    const pseudo = { table: card.table, category: card.category, round: card.round, players: card.players, sets: card.sets, rating: card.rating };
    root.classList.add('static');
    root.innerHTML = '<div class="sc-wrap">' + (card.rating ? tapeRatingHtml(pseudo, card.meta) : tapeResultHtml(card, card.meta)) + '</div>';
    root.querySelectorAll('.cnt').forEach((n) => { const d = parseInt(n.dataset.dec, 10), v = parseFloat(n.dataset.to); n.textContent = d ? v.toFixed(d) : String(Math.round(v)); });
  }

  function update(cand) {
    if (!el) return false;
    if (!cand) {
      if (cur !== null) {
        cur = null;
        el.classList.remove('show');
        clearTimeout(hideT);
        hideT = setTimeout(() => { if (cur === null) { el.classList.remove('on'); el.innerHTML = ''; cancelAnimationFrame(raf); } }, 500);
      }
      return false;
    }
    if (cur !== cand.key) {
      cur = cand.key;
      clearTimeout(hideT);
      build(cand);
      el.classList.add('on');
      void el.offsetWidth;
      el.classList.add('show');
    }
    return true;
  }
  return { mount, pick, update, renderCard };
})();
