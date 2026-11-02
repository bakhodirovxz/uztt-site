import sharp from 'sharp';

/**
 * O'yinchi avatari (doira) uchun yuzga qaratilgan kvadrat kesish.
 *
 * Federatsiya rasmlari — shaffof fonli yarim gavdali portretlar (≈450×600,
 * qo'llar ko'pincha yon tomonga chiqib turadi). Oddiy `cover` yoki sharp'ning
 * `attention` strategiyasi butun gavdani yoki ko'ylakdagi logotipni tanlaydi:
 * 52 px doirada yuz ≈13 px bo'lib, ko'rinmay qoladi.
 *
 * Shaffof fon boshni aniq topishga imkon beradi: gavdaning yuqori qismidagi
 * qatorlarda shaffof bo'lmagan kenglik — bu bosh. Kvadrat boshning markaziga
 * va kengligiga qarab olinadi (bosh + yelka), shunda yuz kadrning ~yarmini
 * egallaydi.
 */

export interface CropBox {
  left: number;
  top: number;
  size: number;
}

/** Shaffoflik chegarasi: soch chetlaridagi yarim shaffof piksellar hisobga olinmaydi */
const OPAQUE = 40;
/** Bosh qidiriladigan qatorlar: gavda balandligining 4%–16% i (sochdan ko'z darajasigacha) */
const BAND_FROM = 0.04;
const BAND_TO = 0.16;
/** Kvadrat tomoni = bosh kengligi × shu koeffitsiyent (bosh + yelka) */
const HEAD_TO_FRAME = 2.1;
/** Boshning ustida qoldiriladigan bo'sh joy (kvadrat tomoniga nisbatan) */
const TOP_MARGIN = 0.08;

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * Alfa niqobidan bosh atrofidagi kvadratni topadi (sof funksiya — testlanadi).
 * `null` — niqobda bosh aniqlanmadi (shaffof fon yo'q yoki g'ayrioddiy shakl).
 */
export function headBox(alpha: Uint8Array, width: number, height: number): CropBox | null {
  let top = -1;
  let bottom = -1;
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      if (alpha[row + x] > OPAQUE) {
        if (top < 0) top = y;
        bottom = y;
        break;
      }
    }
  }
  if (top < 0) return null;
  const figH = bottom - top + 1;
  if (figH < 20) return null;

  const widths: number[] = [];
  const mids: number[] = [];
  const from = top + Math.round(figH * BAND_FROM);
  const to = top + Math.round(figH * BAND_TO);
  for (let y = from; y <= to; y++) {
    const row = y * width;
    let l = -1;
    let r = -1;
    for (let x = 0; x < width; x++) {
      if (alpha[row + x] > OPAQUE) {
        if (l < 0) l = x;
        r = x;
      }
    }
    if (l >= 0) {
      widths.push(r - l + 1);
      mids.push((l + r) / 2);
    }
  }
  if (widths.length < 3) return null;

  const headW = median(widths);
  const cx = median(mids);
  const maxSide = Math.min(width, height);
  const size = Math.max(
    Math.min(Math.round(headW * HEAD_TO_FRAME), maxSide),
    Math.min(Math.round(maxSide * 0.25), maxSide),
  );
  const left = Math.min(Math.max(0, Math.round(cx - size / 2)), width - size);
  const boxTop = Math.min(Math.max(0, Math.round(top - size * TOP_MARGIN)), height - size);
  return { left, top: boxTop, size };
}

/**
 * Kvadrat avatar (WebP). Shaffof fonli rasmda — bosh atrofida; aks holda
 * (oddiy foto) — yuqori qismdan kvadrat (portretda yuz odatda tepada).
 */
export async function avatarThumb(input: Buffer | string, size = 128): Promise<Buffer> {
  // EXIF bo'yicha aylantirilgan holatni bir marta qayd etamiz — alfa va kesish bir xil koordinatada
  const upright = await sharp(input, { limitInputPixels: 40_000_000 }).rotate().png().toBuffer();
  const meta = await sharp(upright).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;

  let box: CropBox | null = null;
  if (meta.hasAlpha && width > 0 && height > 0) {
    const alpha = await sharp(upright).extractChannel('alpha').raw().toBuffer();
    box = headBox(new Uint8Array(alpha.buffer, alpha.byteOffset, alpha.byteLength), width, height);
  }

  const img = sharp(upright);
  if (box) {
    img.extract({ left: box.left, top: box.top, width: box.size, height: box.size }).resize(size, size);
  } else {
    img.resize(size, size, { fit: 'cover', position: 'north' });
  }
  return img.webp({ quality: 78 }).toBuffer();
}
