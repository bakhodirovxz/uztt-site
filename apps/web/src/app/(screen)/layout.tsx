import '@/styles/globals.css';

/**
 * Zal monitori uchun alohida root layout: header/footer yo'q,
 * to'liq ekran qora fon — proyektor/televizorga chiqarish uchun.
 */
export default function ScreenLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="uz">
      {/*
        `data-screen` kerak: globals.css dagi `body { background: ... }`
        qoidasi Tailwind utilitasidan ustun turadi (u layer'dan tashqarida
        yozilgan), shuning uchun `bg-broadcast-bg` classi yolg'iz o'zi
        ishlamaydi — zal ekrani yorug' fonda chiqib qolgan edi. Overlay'dagi
        `data-overlay` patternining aynan o'zi.
      */}
      <body data-screen="true" className="overflow-hidden bg-broadcast-bg">
        {children}
      </body>
    </html>
  );
}
