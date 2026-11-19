import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  buildKanaList,
  charFromFileName,
  formatKanaFile,
  kanaFromSvg,
  pathToPolyline,
  roundStroke,
  sampleCubic,
  strokePaths,
  tokenizePath,
  type Point,
} from './kanjivg';
import { validateKanaStrokes } from './validate';

const close = (a: Point | undefined, b: Point) => {
  expect(a![0]).toBeCloseTo(b[0], 5);
  expect(a![1]).toBeCloseTo(b[1], 5);
};

// SVG mẫu nhỏ theo dạng file KanjiVG: nét 2 đứng trước nét 1 trong file để kiểm sắp theo số nét.
const sample = `<svg viewBox="0 0 109 109"><g id="kvg:StrokePaths_03042">
  <path id="kvg:03042-s2" d="M10,10L20,10l0,10"/>
  <path id="kvg:03042-s1" d="M0,0c0,0,10,0,10,0"/>
</g></svg>`;

describe('tách path KanjiVG', () => {
  it('tách lệnh và số, kể cả số dính dấu trừ và số bắt đầu bằng dấu chấm', () => {
    expect(tokenizePath('M31.01,33c0.88,0.88-2.75.5 1e1,2')).toEqual([
      'M',
      31.01,
      33,
      'c',
      0.88,
      0.88,
      -2.75,
      0.5,
      10,
      2,
    ]);
  });

  it('báo lỗi khi gặp lệnh không hỗ trợ', () => {
    expect(() => tokenizePath('M0,0Z')).toThrow('Lệnh path không hỗ trợ: "Z"');
  });

  it('lấy mẫu đường cong bậc ba theo độ dài, kết thúc đúng điểm cuối', () => {
    const pts = sampleCubic([0, 0], [10, 0], [20, 0], [30, 0]);
    expect(pts).toHaveLength(10);
    close(pts.at(-1), [30, 0]);
    // Đường cong rất ngắn vẫn có ít nhất 1 điểm.
    expect(sampleCubic([0, 0], [0, 0], [0, 0], [0.1, 0])).toHaveLength(1);
  });

  it('M/L tuyệt đối và tương đối; cặp số lặp sau M là L', () => {
    expect(pathToPolyline('M1,2L3,4l1,1')).toEqual([
      [1, 2],
      [3, 4],
      [4, 5],
    ]);
    expect(pathToPolyline('m1,2 1,1')).toEqual([
      [1, 2],
      [2, 3],
    ]);
    expect(pathToPolyline('M1,2 5,5')).toEqual([
      [1, 2],
      [5, 5],
    ]);
  });

  it('C/c lặp tham số, toạ độ tương đối tính từ đầu mỗi đoạn', () => {
    const abs = pathToPolyline('M0,0C0,0,30,0,30,0');
    close(abs.at(-1), [30, 0]);
    const rel = pathToPolyline('M10,10c0,0,3,0,3,0 0,0,0,3,0,3');
    close(rel.at(-1), [13, 13]);
  });

  it('S/s lấy điểm điều khiển đối xứng; S đứng sau M dùng điểm hiện tại', () => {
    const smooth = pathToPolyline('M0,0C0,10,10,10,10,0S20,-10,20,0');
    close(smooth.at(-1), [20, 0]);
    const sOnly = pathToPolyline('M0,0s5,5,10,0');
    close(sOnly.at(-1), [10, 0]);
    const rel = pathToPolyline('M0,0c0,0,5,0,5,0s5,0,5,0');
    close(rel.at(-1), [10, 0]);
  });

  it('báo lỗi path thiếu số hoặc không bắt đầu bằng lệnh', () => {
    expect(() => pathToPolyline('M1')).toThrow('Thiếu số');
    expect(() => pathToPolyline('1,2')).toThrow('Path phải bắt đầu bằng lệnh');
  });

  it('lấy các path theo thứ tự nét; path thiếu d thì báo lỗi; path không số nét giữ thứ tự file', () => {
    expect(strokePaths(sample)).toEqual(['M0,0c0,0,10,0,10,0', 'M10,10L20,10l0,10']);
    expect(strokePaths('<path d="M0,0L1,1"/><path d="M2,2L3,3"/>')).toEqual(['M0,0L1,1', 'M2,2L3,3']);
    expect(() => strokePaths('<path id="x-s1"/>')).toThrow('Thẻ path thiếu d');
  });

  it('làm tròn 1 chữ số, giữ trong khung, bỏ điểm trùng, luôn đủ 2 điểm', () => {
    expect(
      roundStroke([
        [1.04, 2.06],
        [1.01, 2.1],
        [-3, 120],
      ]),
    ).toEqual([
      [1, 2.1],
      [0, 109],
    ]);
    expect(roundStroke([[5, 5]])).toEqual([
      [5, 5],
      [5, 5],
    ]);
  });
});

describe('dựng dữ liệu kana', () => {
  it('đổi một SVG thành KanaStrokes có romaji', () => {
    const k = kanaFromSvg('あ', sample);
    expect(k.char).toBe('あ');
    expect(k.romaji).toBe('a');
    expect(k.strokes).toHaveLength(2);
    expect(k.strokes[1]).toEqual([
      [10, 10],
      [20, 10],
      [20, 20],
    ]);
    expect(validateKanaStrokes(k)).toEqual([]);
  });

  it('tên file ra chữ; tên sai thì báo lỗi', () => {
    expect(charFromFileName('03042.svg')).toBe('あ');
    expect(charFromFileName('030a2.svg')).toBe('ア');
    expect(() => charFromFileName('abc.svg')).toThrow('Tên file KanjiVG không đúng');
  });

  it('sắp theo mã chữ, file ghi kèm giấy phép, mỗi chữ một dòng', () => {
    const list = buildKanaList([
      { file: '030a2.svg', svg: sample },
      { file: '03042.svg', svg: sample },
    ]);
    expect(list.map((k) => `${k.char}${k.romaji}`)).toEqual(['あa', 'アa']);
    const text = formatKanaFile(list);
    const parsed = JSON.parse(text);
    expect(parsed.license).toContain('CC BY-SA 3.0');
    expect(parsed.kana).toEqual(list);
    expect(text.split('\n').filter((l) => l.includes('"char"'))).toHaveLength(2);
  });
});

describe('dữ liệu nét thật', () => {
  const vendor = new URL('../vendor/kanjivg/', import.meta.url);
  const files = readdirSync(vendor)
    .filter((f) => f.endsWith('.svg'))
    .map((file) => ({ file, svg: readFileSync(new URL(file, vendor), 'utf8') }));

  it('có đủ 46 hiragana + 46 katakana cơ bản', () => {
    expect(files).toHaveLength(92);
  });

  it('data/kana-strokes.json đúng bằng kết quả dựng lại từ vendor (đã chạy pnpm kana-strokes)', () => {
    const json = readFileSync(new URL('../data/kana-strokes.json', import.meta.url), 'utf8');
    expect(json).toBe(formatKanaFile(buildKanaList(files)));
  });
});
