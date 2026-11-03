import { isInternalRequest } from './throttle-skip';

describe('isInternalRequest', () => {
  it('Docker tarmog\'idan XFF\'siz kelgan so\'rov ichki', () => {
    expect(isInternalRequest({ ip: '172.18.0.5', headers: {} })).toBe(true);
    expect(isInternalRequest({ ip: '::ffff:172.18.0.5', headers: {} })).toBe(true);
  });

  it('nginx orqali kelgan so\'rov ichki emas, IP si ichki ko\'rinsa ham', () => {
    expect(isInternalRequest({ ip: '172.18.0.1', headers: { 'x-forwarded-for': '203.0.113.9' } })).toBe(false);
  });

  it('tashqi IP ichki emas', () => {
    expect(isInternalRequest({ ip: '203.0.113.9', headers: {} })).toBe(false);
    expect(isInternalRequest({ ip: '172.32.0.1', headers: {} })).toBe(false);
  });
});
