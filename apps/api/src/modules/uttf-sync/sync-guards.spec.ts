import { ConflictException } from '@nestjs/common';
import { SyncLock } from './sync-lock';
import { imageFormatOf, readLimited } from './uttf-content.service';

describe('SyncLock', () => {
  it('bir bo\'limda ikkinchi parallel ishga tushirish 409 oladi, tugagach qulf ochiladi', async () => {
    const lock = new SyncLock();
    let release!: () => void;
    const first = lock.run('photos', () => new Promise<string>((r) => (release = () => r('ok'))));
    await expect(lock.run('photos', async () => 'x')).rejects.toBeInstanceOf(ConflictException);
    // boshqa bo'lim bloklanmaydi
    await expect(lock.run('news', async () => 'n')).resolves.toBe('n');
    release();
    await expect(first).resolves.toBe('ok');
    await expect(lock.run('photos', async () => 'again')).resolves.toBe('again');
  });

  it('xato bo\'lsa ham qulf ochiladi', async () => {
    const lock = new SyncLock();
    await expect(lock.run('clubs', async () => { throw new Error('boom'); })).rejects.toThrow('boom');
    expect(lock.isRunning('clubs')).toBe(false);
  });
});

describe('imageFormatOf', () => {
  it('jpeg/png/webp ni taniydi, svg va boshqalarni rad etadi', () => {
    expect(imageFormatOf(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]))).toBe('jpeg');
    expect(imageFormatOf(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe('png');
    expect(imageFormatOf(Buffer.from('RIFF\0\0\0\0WEBPVP8 ', 'latin1'))).toBe('webp');
    expect(imageFormatOf(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBeNull();
    expect(imageFormatOf(Buffer.from('II*\0'))).toBeNull(); // TIFF
    expect(imageFormatOf(Buffer.alloc(0))).toBeNull();
  });
});

describe('readLimited', () => {
  it('Content-Length chegaradan katta bo\'lsa o\'qimaydi', async () => {
    const res = new Response('x'.repeat(10), { headers: { 'content-length': '999999' } });
    expect(await readLimited(res, 100)).toBeNull();
  });

  it('oqim chegaradan oshsa uzadi (Content-Length yo\'q)', async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        for (let i = 0; i < 10; i++) c.enqueue(new Uint8Array(50));
        c.close();
      },
    });
    expect(await readLimited(new Response(stream), 200)).toBeNull();
  });

  it('chegaradagi tanani to\'liq qaytaradi', async () => {
    const buf = await readLimited(new Response(new Uint8Array(150)), 200);
    expect(buf?.length).toBe(150);
  });
});
