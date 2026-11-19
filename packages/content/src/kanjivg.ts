import { toRomaji } from 'wanakana';
import type { KanaStrokes } from './types';

/** Điểm trong khung 109×109 của KanjiVG (cũng là khung của `KanaStrokes`). */
export type Point = [number, number];

/** Cạnh khung toạ độ của KanjiVG. */
export const KANJIVG_BOX = 109;

/** Khoảng cách giữa hai điểm lấy mẫu trên đường cong, theo đơn vị khung 109. */
const SAMPLE_STEP = 3;

const TOKEN = /([MmCcSsLl])|([-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?)|([^\s,])/g;

/** Tách chuỗi `d` của `<path>` thành lệnh và số. Lệnh ngoài M/C/S/L (cả chữ thường) thì báo lỗi. */
export function tokenizePath(d: string): (string | number)[] {
  const tokens: (string | number)[] = [];
  for (const m of d.matchAll(TOKEN)) {
    if (m[3]) throw new Error(`Lệnh path không hỗ trợ: "${m[3]}"`);
    tokens.push(m[1] ?? Number(m[2]));
  }
  return tokens;
}

const dist = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]);

function cubicAt(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const e = t * t * t;
  return [a * p0[0] + b * p1[0] + c * p2[0] + e * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + e * p3[1]];
}

/** Lấy mẫu đường cong bậc ba thành các điểm cách nhau khoảng `SAMPLE_STEP` (không gồm điểm đầu). */
export function sampleCubic(p0: Point, p1: Point, p2: Point, p3: Point): Point[] {
  let length = 0;
  let prev = p0;
  for (let i = 1; i <= 8; i++) {
    const q = cubicAt(p0, p1, p2, p3, i / 8);
    length += dist(prev, q);
    prev = q;
  }
  const n = Math.max(1, Math.ceil(length / SAMPLE_STEP));
  return Array.from({ length: n }, (_, i) => cubicAt(p0, p1, p2, p3, (i + 1) / n));
}

/** Đổi chuỗi `d` của một nét thành đường gấp khúc (chưa làm tròn). */
export function pathToPolyline(d: string): Point[] {
  const tokens = tokenizePath(d);
  const points: Point[] = [];
  let cur: Point = [0, 0];
  let lastCtrl: Point | null = null;
  let cmd = '';
  let i = 0;
  const num = (): number => {
    const v = tokens[i++];
    if (typeof v !== 'number') throw new Error(`Thiếu số trong path "${d}"`);
    return v;
  };
  while (i < tokens.length) {
    const t = tokens[i];
    if (typeof t === 'string') {
      cmd = t;
      i++;
    } else if (!cmd) {
      throw new Error(`Path phải bắt đầu bằng lệnh: "${d}"`);
    }
    const rel = cmd === cmd.toLowerCase();
    // Toạ độ tương đối tính từ điểm đầu của đoạn (`cur` chỉ đổi khi xong đoạn).
    const pt = (): Point => {
      const x = num();
      const y = num();
      return rel ? [cur[0] + x, cur[1] + y] : [x, y];
    };
    const upper = cmd.toUpperCase();
    if (upper === 'M' || upper === 'L') {
      cur = pt();
      points.push(cur);
      lastCtrl = null;
      // Cặp số lặp lại sau M là lệnh L (chuẩn SVG).
      if (upper === 'M') cmd = rel ? 'l' : 'L';
    } else {
      // S: điểm điều khiển đầu là ảnh đối xứng của điểm điều khiển cuối đoạn cong trước.
      const c1: Point = upper === 'C' ? pt() : lastCtrl ? [2 * cur[0] - lastCtrl[0], 2 * cur[1] - lastCtrl[1]] : cur;
      const c2 = pt();
      const end = pt();
      points.push(...sampleCubic(cur, c1, c2, end));
      lastCtrl = c2;
      cur = end;
    }
  }
  return points;
}

/** Các chuỗi `d` của nét theo thứ tự nét (`id="…-s1"`, `-s2`…). */
export function strokePaths(svg: string): string[] {
  const strokes = [...svg.matchAll(/<path\b[^>]*>/g)].map(([tag]) => {
    const d = /\sd="([^"]+)"/.exec(tag)?.[1];
    if (!d) throw new Error(`Thẻ path thiếu d: ${tag}`);
    return { d, n: Number(/-s(\d+)"/.exec(tag)?.[1] ?? 0) };
  });
  return strokes.sort((a, b) => a.n - b.n).map((s) => s.d);
}

const clamp = (v: number) => Math.min(KANJIVG_BOX, Math.max(0, Math.round(v * 10) / 10));

/** Làm tròn 1 chữ số thập phân, giữ trong khung, bỏ điểm trùng liền nhau; mỗi nét luôn có ít nhất 2 điểm. */
export function roundStroke(points: Point[]): Point[] {
  const out: Point[] = [];
  for (const [x, y] of points) {
    const p: Point = [clamp(x), clamp(y)];
    const last = out.at(-1);
    if (!last || last[0] !== p[0] || last[1] !== p[1]) out.push(p);
  }
  if (out.length === 1) out.push([...out[0]!]);
  return out;
}

/** Dữ liệu nét của một chữ từ file SVG KanjiVG. */
export function kanaFromSvg(char: string, svg: string): KanaStrokes {
  return {
    char,
    romaji: toRomaji(char),
    strokes: strokePaths(svg).map((d) => roundStroke(pathToPolyline(d))),
  };
}

/** Tên file KanjiVG (`03042.svg`) → chữ (`あ`). */
export function charFromFileName(file: string): string {
  const m = /^([0-9a-f]{5})\.svg$/.exec(file);
  if (!m) throw new Error(`Tên file KanjiVG không đúng: ${file}`);
  return String.fromCodePoint(parseInt(m[1]!, 16));
}

/** Dựng danh sách kana từ các file SVG, theo thứ tự mã chữ (hiragana theo bảng gojūon, rồi katakana). */
export function buildKanaList(files: { file: string; svg: string }[]): KanaStrokes[] {
  return files
    .map(({ file, svg }) => kanaFromSvg(charFromFileName(file), svg))
    .sort((a, b) => a.char.codePointAt(0)! - b.char.codePointAt(0)!);
}

/** Ghi công bắt buộc theo giấy phép CC BY-SA 3.0 của KanjiVG, nằm ngay trong file dữ liệu sinh ra. */
export const KANJIVG_ATTRIBUTION =
  'Stroke data derived from KanjiVG (https://kanjivg.tagaini.net), copyright Ulrich Apel, ' +
  'licensed under CC BY-SA 3.0 (https://creativecommons.org/licenses/by-sa/3.0/). ' +
  'This file is distributed under the same licence.';

/** Nội dung `data/kana-strokes.json`: mỗi chữ một dòng để diff dễ đọc. */
export function formatKanaFile(kana: KanaStrokes[]): string {
  const lines = kana.map((k) => `    ${JSON.stringify(k)}`).join(',\n');
  return `{\n  "license": ${JSON.stringify(KANJIVG_ATTRIBUTION)},\n  "kana": [\n${lines}\n  ]\n}\n`;
}
