import { describe, expect, it } from 'vitest';
import type { KanaStrokes } from '@study/content';
import { KanaTrace } from './KanaTrace';
import type { Point } from './strokeMatch';

const h: Point[] = [
  [20, 30],
  [90, 30],
];
const v: Point[] = [
  [55, 10],
  [55, 100],
];
const a: KanaStrokes = { char: 'あ', romaji: 'a', strokes: [h, v] };
const i: KanaStrokes = { char: 'い', romaji: 'i', strokes: [v] };
const far: Point[] = [
  [0, 109],
  [5, 105],
];

describe('KanaTrace', () => {
  it('tô đúng thứ tự nét: ok → charDone → done; chữ không sai vào firstTry', () => {
    const g = new KanaTrace([a, i], 0.15);
    expect(g.current).toBe(a);
    expect(g.expected).toBe(h);
    expect(g.submitStroke(h)).toBe('ok');
    expect(g.strokeIndex).toBe(1);
    expect(g.submitStroke(v)).toBe('charDone');
    expect(g.current).toBe(i);
    expect(g.strokeIndex).toBe(0);
    expect(g.submitStroke(v)).toBe('done');
    expect(g.done).toBe(true);
    expect(g.current).toBeUndefined();
    expect(g.expected).toBeUndefined();
    expect(g.firstTry).toEqual(['あ', 'い']);
    expect(g.wrong).toEqual([]);
    expect(g.stars(false)).toBe(3);
    // Đã xong thì nộp thêm cũng không đổi gì.
    expect(g.submitStroke(v)).toBe('done');
  });

  it('nét sai: đếm lỗi theo chữ, giữ nguyên nét, ghi lý do; vẽ đúng thứ tự mới qua', () => {
    const g = new KanaTrace([a, i], 0.15);
    expect(g.submitStroke(v)).toBe('wrong');
    expect(g.lastReason).toBe('start');
    expect(g.submitStroke(far)).toBe('wrong');
    expect(g.strokeIndex).toBe(0);
    expect(g.mistakes).toBe(2);
    expect(g.mistakesFor('あ')).toBe(2);
    expect(g.mistakesFor('い')).toBe(0);
    g.submitStroke(h);
    expect(g.lastReason).toBeNull();
    g.submitStroke(v);
    g.submitStroke(v);
    expect(g.wrong).toEqual(['あ']);
    expect(g.firstTry).toEqual(['い']);
    expect(g.stars(false)).toBe(2);
  });

  it('Đèn Pin trả nét đang phải vẽ; xong thì -1; dùng gợi ý không được 3 sao', () => {
    const g = new KanaTrace([a], 0.15);
    expect(g.hint()).toBe(0);
    g.submitStroke(h);
    expect(g.hint()).toBe(1);
    g.submitStroke(v);
    expect(g.hint()).toBe(-1);
    expect(g.stars(true)).toBe(2);
  });

  it('nhiều nét sai thì 1 sao', () => {
    const g = new KanaTrace([i], 0.15);
    for (let n = 0; n < 3; n++) g.submitStroke(far);
    g.submitStroke(v);
    expect(g.stars(false)).toBe(1);
  });
});
