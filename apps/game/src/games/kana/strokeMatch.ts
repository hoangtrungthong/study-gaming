/** Điểm trong khung 109×109 (khung của KanjiVG và của bảng vẽ). */
export type Point = [number, number];

/** Cạnh khung toạ độ. */
export const BOX = 109;

/** Số điểm lấy mẫu lại cho cả nét vẽ và nét chuẩn trước khi so (CC-10). */
export const SAMPLES = 16;

export type StrokeReason = 'start' | 'direction' | 'shape';

export interface StrokeCheck {
  ok: boolean;
  reason: StrokeReason | null;
}

const dist = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** Lấy mẫu lại đường gấp khúc thành `n` điểm cách đều theo độ dài. Đường dài 0 thì lặp lại điểm đầu. */
export function resample(points: readonly Point[], n = SAMPLES): Point[] {
  const lengths = [0];
  for (let i = 1; i < points.length; i++) lengths.push(lengths[i - 1]! + dist(points[i - 1]!, points[i]!));
  const total = lengths.at(-1)!;
  if (total === 0) return Array.from({ length: n }, () => [...points[0]!] as Point);
  const out: Point[] = [];
  let seg = 1;
  for (let k = 0; k < n; k++) {
    const target = (total * k) / (n - 1);
    while (seg < points.length - 1 && lengths[seg]! < target) seg++;
    const a = points[seg - 1]!;
    const b = points[seg]!;
    const span = lengths[seg]! - lengths[seg - 1]!;
    const t = span === 0 ? 0 : (target - lengths[seg - 1]!) / span;
    out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }
  return out;
}

/**
 * Chấm một nét vẽ so với nét chuẩn (CC-10): điểm đầu gần điểm đầu chuẩn, điểm cuối gần điểm cuối chuẩn (đúng hướng),
 * khoảng cách trung bình sau khi lấy mẫu lại nhỏ hơn ngưỡng. Ngưỡng là phần cạnh khung (`KANA_CONFIG.tolerance`).
 */
export function strokeMatch(user: readonly Point[], expected: readonly Point[], tolerance: number): StrokeCheck {
  // Chạm một chấm (không kéo) thì chưa phải nét.
  if (user.length < 2) return { ok: false, reason: 'shape' };
  const limit = tolerance * BOX;
  const a = resample(user);
  const b = resample(expected);
  const aStart = a[0]!;
  const aEnd = a.at(-1)!;
  const bStart = b[0]!;
  const bEnd = b.at(-1)!;
  if (dist(aStart, bStart) > limit) {
    // Vẽ ngược chiều: đầu nét vẽ nằm ở cuối nét chuẩn và ngược lại.
    const reversed = dist(aStart, bEnd) <= limit && dist(aEnd, bStart) <= limit;
    return { ok: false, reason: reversed ? 'direction' : 'start' };
  }
  if (dist(aEnd, bEnd) > limit) return { ok: false, reason: 'direction' };
  const mean = a.reduce((sum, p, i) => sum + dist(p, b[i]!), 0) / a.length;
  if (mean > limit) return { ok: false, reason: 'shape' };
  return { ok: true, reason: null };
}
