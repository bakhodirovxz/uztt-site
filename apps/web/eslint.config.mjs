// eslint-config-next 16 to'g'ridan-to'g'ri flat config eksport qiladi —
// FlatCompat orqali eski formatda yuklash eslint 9 da "circular structure"
// xatosini berardi (shu sababli lint umuman ishlamay turgan edi).
import coreWebVitals from 'eslint-config-next/core-web-vitals';
import typescript from 'eslint-config-next/typescript';

const config = [
  ...coreWebVitals,
  ...typescript,
  {
    rules: {
      // O'zbek tilida apostrof matnning bir qismi (o'yin, bo'lsa) — uni har
      // safar &apos; ga aylantirish matnni o'qib bo'lmas holga keltiradi.
      'react/no-unescaped-entities': 'off',
      // Panel sahifalarida "mount'da yuklash" pattern'i keng ishlatilgan.
      // Xato emas, lekin async callback ichiga ko'chirish rejalashtirilgan —
      // shu sababli hozircha ogohlantirish darajasida.
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
  {
    ignores: ['.next/**', 'node_modules/**', 'e2e/.artifacts/**'],
  },
];

export default config;
