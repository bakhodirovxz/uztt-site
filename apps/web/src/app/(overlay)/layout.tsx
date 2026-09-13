import '@/styles/globals.css';

/**
 * OBS overlay uchun alohida root layout: header/footer/shrift yuklamalarisiz,
 * shaffof fon (body[data-overlay]) — Browser Source'da faqat overlay ko'rinadi.
 */
export default function OverlayLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="uz">
      <body data-overlay="true">{children}</body>
    </html>
  );
}
