import { createHash } from 'crypto';
import { hashRefereeCode, newRefereeCode, sealedRefereeCodeHash } from './referee-code';

describe('referee-code', () => {
  it('6 xonali kod (100000–999999)', () => {
    for (let i = 0; i < 200; i++) {
      const c = newRefereeCode();
      expect(c).toMatch(/^[1-9]\d{5}$/);
    }
  });

  it('hash CryptoService.sha256 bilan bir xil (sha256 hex) — mavjud kodlar ishlayveradi', () => {
    expect(hashRefereeCode('123456')).toBe(createHash('sha256').update('123456').digest('hex'));
  });

  it('yopiq hash — 64 belgili hex', () => {
    expect(sealedRefereeCodeHash()).toMatch(/^[0-9a-f]{64}$/);
  });
});
