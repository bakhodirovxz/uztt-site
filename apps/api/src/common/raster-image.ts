import { BadRequestException } from '@nestjs/common';

/**
 * Rasm turi fayl mazmunidan tekshiriladi: mimetype'ni yuklovchi o'zi yozadi. Prod server CPU sababli sharp 0.34
 * da qolgan (pnpm-workspace.yaml) va uning librsvg/libheif qismlarida ma'lum zaifliklar bor, shuning uchun
 * SVG va HEIC sharp'ga umuman yetib bormaydi.
 */
export function assertRasterImage(b: Buffer): void {
  const brand = b.subarray(8, 12).toString('latin1');
  const ok =
    (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) ||
    b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) ||
    (b.subarray(0, 4).toString('latin1') === 'RIFF' && brand === 'WEBP') ||
    (b.subarray(4, 8).toString('latin1') === 'ftyp' && (brand === 'avif' || brand === 'avis'));
  if (!ok) throw new BadRequestException('Faqat JPEG/PNG/WebP/AVIF');
}
