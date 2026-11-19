// Sinh data/kana-strokes.json từ file SVG KanjiVG trong vendor/kanjivg (giấy phép CC BY-SA 3.0, xem README ở đó).
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildKanaList, formatKanaFile } from '../src/kanjivg';
import { validateKanaStrokes } from '../src/validate';

const dir = fileURLToPath(new URL('../vendor/kanjivg/', import.meta.url));
const out = fileURLToPath(new URL('../data/kana-strokes.json', import.meta.url));

const files = readdirSync(dir)
  .filter((f) => f.endsWith('.svg'))
  .map((file) => ({ file, svg: readFileSync(`${dir}${file}`, 'utf8') }));
const kana = buildKanaList(files);
const errors = kana.flatMap(validateKanaStrokes);
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
writeFileSync(out, formatKanaFile(kana), 'utf8');
console.log(`Đã ghi ${kana.length} chữ kana vào ${out}`);
