import { describe, expect, it } from 'vitest';
import { KANA_CONFIG } from '../ageConfig';
import { resample, SAMPLES, strokeMatch, type Point } from './strokeMatch';

// Nét ngang chuẩn từ trái sang phải giữa khung.
const ref: Point[] = [
  [20, 50],
  [50, 50],
  [90, 50],
];
const shift = (pts: Point[], dx: number, dy: number): Point[] => pts.map(([x, y]) => [x + dx, y + dy]);

describe('resample', () => {
  it('lấy đủ số điểm cách đều, giữ điểm đầu và cuối', () => {
    const pts = resample(ref);
    expect(pts).toHaveLength(SAMPLES);
    expect(pts[0]).toEqual([20, 50]);
    expect(pts.at(-1)![0]).toBeCloseTo(90);
    expect(pts[1]![0]).toBeCloseTo(20 + 70 / (SAMPLES - 1));
  });

  it('đường dài 0 thì lặp lại điểm đầu; điểm trùng liền nhau không làm hỏng phép chia', () => {
    expect(resample([[5, 5]], 3)).toEqual([
      [5, 5],
      [5, 5],
      [5, 5],
    ]);
    const pts = resample(
      [
        [0, 0],
        [0, 0],
        [10, 0],
      ],
      3,
    );
    expect(pts.map(([x]) => x)).toEqual([0, 5, 10]);
  });
});

describe('strokeMatch', () => {
  const tol = KANA_CONFIG.choi.tolerance;

  it('nét đúng (kể cả hơi lệch, nhiều điểm hơn) thì qua', () => {
    expect(strokeMatch(ref, ref, tol)).toEqual({ ok: true, reason: null });
    const wobbly: Point[] = Array.from({ length: 30 }, (_, i) => [20 + (70 * i) / 29, 50 + (i % 2 ? 3 : -3)]);
    expect(strokeMatch(wobbly, ref, tol).ok).toBe(true);
  });

  it('chạm một chấm thì chưa phải nét', () => {
    expect(strokeMatch([[20, 50]], ref, tol)).toEqual({ ok: false, reason: 'shape' });
  });

  it('vẽ ngược chiều thì báo hướng', () => {
    expect(strokeMatch([...ref].reverse(), ref, tol)).toEqual({ ok: false, reason: 'direction' });
  });

  it('bắt đầu xa chấm đầu thì báo điểm đầu', () => {
    expect(strokeMatch(shift(ref, 0, 40), ref, tol)).toEqual({ ok: false, reason: 'start' });
  });

  it('đầu đúng nhưng dừng sớm / đi lạc cuối nét thì báo hướng', () => {
    const short: Point[] = [
      [20, 50],
      [45, 50],
    ];
    expect(strokeMatch(short, ref, tol)).toEqual({ ok: false, reason: 'direction' });
  });

  it('đầu cuối đúng nhưng đường đi lệch xa thì báo hình dạng', () => {
    const detour: Point[] = [
      [20, 50],
      [55, 100],
      [90, 50],
    ];
    expect(strokeMatch(detour, ref, tol)).toEqual({ ok: false, reason: 'shape' });
  });

  it('ngưỡng theo nhóm tuổi: Mầm dễ hơn Cây', () => {
    const off = shift(ref, 0, 14);
    expect(strokeMatch(off, ref, KANA_CONFIG.mam.tolerance).ok).toBe(true);
    expect(strokeMatch(off, ref, KANA_CONFIG.cay.tolerance).ok).toBe(false);
  });
});
