// Rasmiy Nizom (O'zSTF, "Sportchilarga reyting ballari berish tartibi") bo'yicha O'YIN uchun reyting ballari (МРБ).
// DIQQAT: bu fayl `uztt-site/apps/api/.../rating.engine.ts` dagi 2- va 3-formulalarning qisqa nusxasi.
// Formulalar o'sha loyihaning hisobot yozuvlaridan tiklangan; Nizomning o'zi bilan solishtirib tasdiqlang.
//
//  G'olib (2-formula):  ΔG = (100 − (GR − YR)) / 10        GR − YR > 100 bo'lsa ball yo'q (0)
//  Mag'lub (3-formula): ΔY = −(100 − (GR − YR)) / 20       (pastki chegarasi hujjatda yo'q)
//  20-band: reytinglari teng bo'lsa g'olibga +10, mag'lubga −10.
//  Ayirish o'chirilgan bo'lsa (loserNoDeduct, standart) mag'lubning balli o'zgarmaydi — faqat g'olib ball oladi.
//  GR — g'olibning, YR — mag'lubning o'yin oldidagi reytingi.
//  Yakuniy 1-formula (Р = ЖР + К·МРБ − Ж + Б): bu yerda faqat К·МРБ qismi (o'yin natijasi) hisoblanadi;
//  Б (o'rin bonusi) va Ж (jarima) musobaqa tugagach saytda qo'llanadi.

const r2 = (x) => Math.round(x * 100) / 100;

function winnerGain(gr, yr) {
  if (gr === yr) return 10;
  const d = gr - yr;
  return d > 100 ? 0 : r2((100 - d) / 10);
}

// opts.loserNonPositive — true bo'lsa mag'lubga hech qachon musbat ball berilmaydi (efirda g'alati ko'rinmasligi uchun)
function loserChange(gr, yr, opts) {
  if (opts && opts.loserNoDeduct) return 0; // mag'lubdan ball ayirilmaydi
  if (gr === yr) return -10;
  let v = r2(-(100 - (gr - yr)) / 20);
  if (opts && opts.loserNonPositive && v > 0) v = 0;
  return v;
}

function matchDelta(gr, yr, opts) {
  const k = opts && Number.isFinite(opts.k) ? opts.k : 1;
  return { win: r2(winnerGain(gr, yr) * k), lose: r2(loserChange(gr, yr, opts) * k) };
}

// kategoriya matnidan reyting turi: Y (yakkalik) / D (juftlik) / A (aralash juftlik)
function ratingType(category, nPlayersPerSide) {
  const c = String(category || '').toUpperCase();
  if (/MIX|ARALASH|АРАЛАШ/.test(c)) return 'A';
  if (/DOUBLE|JUFT|ЖУФТ/.test(c) || nPlayersPerSide === 2) return 'D';
  return 'Y';
}

module.exports = { winnerGain, loserChange, matchDelta, ratingType, r2 };
