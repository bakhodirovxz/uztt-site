import { toPoints } from './points';

describe('toPoints (reglament: butun, 0 dan kam emas)', () => {
  it.each([
    [59.2, 59],
    [59.5, 60],
    [59.49, 59],
    [700.04, 700],
    [-3.2, 0],
    [-0.4, 0],
    [0, 0],
    [null, 0],
    [undefined, 0],
    [NaN, 0],
    [Infinity, 0],
  ])('%p → %p', (input, expected) => {
    expect(toPoints(input as number)).toBe(expected);
  });
});
