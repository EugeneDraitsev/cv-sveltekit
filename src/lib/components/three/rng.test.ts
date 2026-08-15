import { describe, expect, it } from 'vitest';

import { chance, mulberry32, pick, pickWeighted, range, rangeInt } from './rng';

describe('seeded random helpers', () => {
  it('replays the same sequence for a seed', () => {
    const first = mulberry32(123456);
    const second = mulberry32(123456);

    expect(Array.from({ length: 20 }, () => first())).toEqual(
      Array.from({ length: 20 }, () => second()),
    );
  });

  it('keeps its first values stable as a generation contract', () => {
    const rng = mulberry32(123456);
    expect(Array.from({ length: 5 }, () => rng())).toEqual([
      0.38233304349705577, 0.7972629074938595, 0.9965302373748273, 0.16001168475486338,
      0.20857197884470224,
    ]);
  });

  it('respects sampling bounds', () => {
    const rng = mulberry32(42);
    for (let index = 0; index < 500; index += 1) {
      expect(range(rng, -4, 9)).toBeGreaterThanOrEqual(-4);
      expect(range(rng, -4, 9)).toBeLessThan(9);
      expect(rangeInt(rng, 3, 7)).toBeGreaterThanOrEqual(3);
      expect(rangeInt(rng, 3, 7)).toBeLessThanOrEqual(7);
    }
  });

  it('handles deterministic choices', () => {
    expect(chance(() => 0.2, 0.3)).toBe(true);
    expect(chance(() => 0.4, 0.3)).toBe(false);
    expect(pick(() => 0.99, ['a', 'b', 'c'])).toBe('c');
    expect(
      pickWeighted(
        () => 0.8,
        [
          ['common', 9],
          ['rare', 1],
        ],
      ),
    ).toBe('common');
  });
});
