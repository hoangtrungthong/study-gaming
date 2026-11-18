import { describe, expect, it } from 'vitest';
import { sample, seededRng, shuffle } from './random';

describe('random', () => {
  it('shuffle giữ đủ phần tử và không đổi mảng gốc', () => {
    const src = [1, 2, 3, 4, 5];
    const out = shuffle(src, seededRng(1));
    expect([...out].sort()).toEqual(src);
    expect(src).toEqual([1, 2, 3, 4, 5]);
  });

  it('cùng hạt giống cho cùng kết quả', () => {
    expect(shuffle([1, 2, 3, 4, 5], seededRng(9))).toEqual(shuffle([1, 2, 3, 4, 5], seededRng(9)));
  });

  it('sample giới hạn số lượng trong khoảng hợp lệ', () => {
    expect(sample([1, 2, 3], 2, seededRng(2))).toHaveLength(2);
    expect(sample([1, 2, 3], 10)).toHaveLength(3);
    expect(sample([1, 2, 3], -1)).toHaveLength(0);
  });

  it('seededRng trả số trong [0, 1)', () => {
    const rng = seededRng(3);
    for (let i = 0; i < 100; i++) {
      const n = rng();
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(1);
    }
  });
});
