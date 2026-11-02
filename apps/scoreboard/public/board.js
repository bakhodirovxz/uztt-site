// Umumiy scoreboard chizish funksiyalari (TV va overlay uchun). common.js va flags.js dan keyin ulanadi.
const natural = (a, b) => (/^\d+$/.test(a) && /^\d+$/.test(b) ? a - b : a.localeCompare(b));

// tugagan o'yin g'olib bilan ?hide=60 soniya ko'rinib turadi, keyin umumiy ro'yxatdan o'zi olib tashlanadi
const HIDE_S = parseInt(Q.get('hide') || '60', 10);
const finishedLongAgo = (c) => c.winner !== null && c.finishedAt && (Date.now() - c._off - c.finishedAt) > HIDE_S * 1000;

function boardNameHtml(p) {
  const n = p.name.length;
  const cls = n >= 19 ? ' xxs' : n >= 15 ? ' xs' : n >= 11 ? ' sm' : '';
  return '<div class="nm' + cls + '"><b>' + esc(p.name) + '</b>' + (p.given ? '<span>' + esc(p.given) + '</span>' : '') + '</div>';
}

function boardPanel(s) {
  const ps = pointStatus(s);
  const left = timeoutLeft(s);
  let pill = '';
  if (s.winner !== null) pill = '<span class="pill" style="background:#1a7f4b">WINNER</span>';
  else if (s.timeout && left > 0) pill = '<span class="pill">TIME-OUT ' + fmtTime(left) + '</span>';
  const ghosts = s.settings.bestOf === 5 ? 2 : 0;
  let rows = '';
  [0, 1].forEach((i) => {
    const p = s.players[i];
    let boxes = '';
    for (let g = 0; g < s.settings.bestOf; g++) {
      const c = gameCell(s, i, g);
      boxes += '<div class="box' + (c.kind === 'live' ? ' live' : '') + '">' + c.v + '</div>';
    }
    for (let g = 0; g < ghosts; g++) boxes += '<div class="box ghost">+</div>';
    const f = flag(p.country);
    const badge = ps && ps.p === i ? '<span class="bd' + (ps.text === 'MATCH POINT' ? ' match' : '') + '">' + ps.text + '</span>' : '';
    rows += '<div class="pname' + (badge ? ' hasbd' : '') + '"><span class="sv' + (s.server === i && s.winner === null ? ' on' : '') + '"></span>' + (f || '<span class="flag-ph"></span>') + boardNameHtml(p) + badge + '</div>'
      + '<div class="boxes">' + boxes + '</div>'
      + '<div class="wins' + (s.winner === i ? ' won' : '') + '">' + p.sets + '</div>';
  });
  const tl = tieLabel(s);
  const tie = tl ? '<div class="tie"><span>' + esc(tl) + '</span></div>' : '';
  return '<section class="panel"><div class="ptitle">' + esc(matchTitle(s)) + pill + '</div><div class="pbody">' + rows + tie + '</div><div class="cell-gap"></div></section>';
}

function boardLayout(n, anyTie, W, H) {
  const availW = W * 0.94, availH = H * 0.79;
  const ph = 2.6 + 11.3 + (anyTie ? 2.2 : 0) + 1.2; // panel balandligi (u)
  let best = null;
  [1, 2, 3].forEach((cols) => {
    if (cols > n) return;
    const rows = Math.ceil(n / cols);
    const gap = W * 0.025;
    const u = Math.min((availW - (cols - 1) * gap) / cols / 69, availH / (rows * ph), n <= 2 ? 24 : 20);
    if (!best || u > best.u + 0.05) best = { cols, rows, u, gap };
  });
  return best;
}

// root ichidagi .t1 .t2 .grid larni to'ldiradi; list — chiziladigan stollar (state obyektlari)
function renderBoard(root, meta, list) {
  root.querySelector('.t1').textContent = meta.title1;
  root.querySelector('.t2').textContent = meta.title2;
  const g = root.querySelector('.grid');
  if (!list.length) {
    if (g._sig === 'empty') return;
    g._sig = 'empty';
    g.style.gridTemplateRows = '';
    g.style.columnGap = '';
    g.innerHTML = '<div class="empty">NEXT MATCHES WILL APPEAR HERE</div>';
    return;
  }
  // o'lcham: butun ekran (TV) yoki root elementning o'zi (overlayda 800x600 oyna)
  const W = root === document.body ? innerWidth : root.clientWidth, H = root === document.body ? innerHeight : root.clientHeight;
  const L = boardLayout(list.length, list.some((s) => s.showTie), W, H);
  const html = list.map(boardPanel).join('');
  const sig = L.u + '|' + L.rows + '|' + L.gap + '|' + html;
  if (g._sig === sig) return; // o'zgarmagan bo'lsa DOM ni qayta qurmaymiz (bayroqlar miltillamaydi, protsessor tejaladi)
  g._sig = sig;
  g.style.setProperty('--u', L.u + 'px');
  g.style.gridTemplateRows = 'repeat(' + L.rows + ', auto)';
  g.style.columnGap = L.gap + 'px';
  g.innerHTML = html;
}

// Taym-aut: TV va overlayda KATTA, uzoqdan ko'rinadigan hisoblagich (markazda)
function showBigTimeout(list) {
  let el = document.getElementById('tobig');
  const t = (list || []).find((c) => c.winner === null && c.timeout && timeoutLeft(c) > 0);
  if (!t) { if (el) el.classList.remove('on'); return; }
  if (!el) { el = document.createElement('div'); el.id = 'tobig'; document.body.appendChild(el); }
  const multi = (list || []).filter((c) => c.timeout).length > 1;
  el.innerHTML = '<div class="tb-t">TIME-OUT' + (multi ? ' · ' + esc(t.table) : '') + '</div><div class="tb-n">' + esc(t.players[t.timeout.side].name) + '</div><div class="tb-c">' + fmtTime(timeoutLeft(t)) + '</div>';
  el.classList.add('on');
}
