import { assertRasterImage } from './raster-image';

const riff = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP')]);
const ftyp = (brand: string) => Buffer.concat([Buffer.alloc(4), Buffer.from('ftyp'), Buffer.from(brand)]);

describe('assertRasterImage', () => {
  it('JPEG, PNG, WebP va AVIF o\'tadi', () => {
    expect(() => assertRasterImage(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).not.toThrow();
    expect(() => assertRasterImage(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).not.toThrow();
    expect(() => assertRasterImage(riff)).not.toThrow();
    expect(() => assertRasterImage(ftyp('avif'))).not.toThrow();
  });

  it('SVG, HEIC va bo\'sh fayl rad etiladi', () => {
    expect(() => assertRasterImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toThrow();
    expect(() => assertRasterImage(ftyp('heic'))).toThrow();
    expect(() => assertRasterImage(Buffer.alloc(0))).toThrow();
  });
});
