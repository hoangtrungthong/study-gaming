// Kiểm mục 2a của checklist DoD (.claude/skills/dod-report/SKILL.md): mỗi file code bị đổi so với base phải đạt
// 100% dòng (statement) trong clover. Chép theo scripts/coverage-changed.mjs của medicine-management.
//
// Dùng (ở gốc repo, sau `pnpm -r test:coverage`):
//   node scripts/coverage-changed.mjs [base] [tiền tố ...]   (mặc định base: main)
// Có tiền tố (vd. `apps/game/`) thì chỉ xét file bắt đầu bằng tiền tố đó.
// Thoát 0 khi mọi file đạt 100%, 1 khi có file thiếu hoặc không có trong clover, 2 khi lỗi đầu vào.

import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const CLOVERS = ['apps/game/coverage/clover.xml', 'packages/content/coverage/clover.xml'];

// File phải đo: code ứng dụng, bỏ test, khai báo kiểu và đồ dùng cho test.
const MEASURED = /^(apps\/game\/src\/.*\.(ts|vue)|packages\/content\/src\/.*\.ts)$/;
const SKIPPED = /(\.test\.ts$|\.d\.ts$|\/test\/)/;
// File bỏ đo có lý do (`/* v8 ignore file -- lý do */`, được E2E phủ) không có dòng nào trong clover.
const IGNORED_FILE = /\/\*\s*v8 ignore file\b/;

const ROOT_DIRS = ['apps', 'packages'];

const base = process.argv[2] ?? 'main';
const prefixes = process.argv.slice(3);

const git = (args) =>
  execSync(`git ${args}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
    .split('\n')
    .filter(Boolean);

let changed;
try {
  git(`rev-parse --verify --quiet ${base}`);
  changed = new Set([
    ...git(`diff --name-only --diff-filter=d ${base}...HEAD`),
    ...git('diff --name-only --diff-filter=d HEAD'),
    ...git('ls-files --others --exclude-standard'),
  ]);
} catch {
  console.error(`Không tìm thấy nhánh base '${base}'.`);
  process.exit(2);
}

const targets = [...changed]
  .filter((f) => MEASURED.test(f) && !SKIPPED.test(f))
  .filter((f) => prefixes.length === 0 || prefixes.some((prefix) => f.startsWith(prefix)))
  .filter((f) => !IGNORED_FILE.test(readFileSync(f, 'utf8')))
  .sort();
if (targets.length === 0) {
  console.log(`Không có file code nào cần đo so với ${base}.`);
  process.exit(0);
}

/** Rút đường dẫn trong clover (tuyệt đối, Windows hay tương đối) về dạng `apps/...` / `packages/...`. */
const relativePath = (name) => {
  const path = name.replace(/\\/g, '/');
  for (const dir of ROOT_DIRS) {
    const pos = path.lastIndexOf(`/${dir}/`);
    if (pos !== -1) return path.slice(pos + 1);
  }
  return path.replace(/^\/+/, '');
};

/** Clover của Vitest ghi đường dẫn tương đối theo gói; ghép lại với thư mục gói. */
const withPackage = (cloverFile, path) => {
  if (ROOT_DIRS.some((dir) => path.startsWith(`${dir}/`))) return path;
  return `${cloverFile.replace(/coverage\/clover\.xml$/, '')}${path}`;
};

/** @returns {Map<string, {total: number, uncovered: number[]}>} */
const readClover = (file) => {
  const result = new Map();
  const xml = readFileSync(file, 'utf8');
  for (const [, attrs, body] of xml.matchAll(/<file\b([^>]*)>([\s\S]*?)<\/file>/g)) {
    const name = /\bpath="([^"]+)"/.exec(attrs)?.[1] ?? /\bname="([^"]+)"/.exec(attrs)?.[1];
    if (!name) continue;
    const stats = { total: 0, uncovered: [] };
    for (const [, line] of body.matchAll(/<line\b([^>]*)\/>/g)) {
      if (!/\btype="stmt"/.test(line)) continue;
      stats.total++;
      if (/\bcount="0"/.test(line)) stats.uncovered.push(Number(/\bnum="(\d+)"/.exec(line)[1]));
    }
    result.set(withPackage(file, relativePath(name)), stats);
  }
  return result;
};

/** [3, 4, 5, 9] → "3-5, 9" */
const ranges = (lines) => {
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const start = lines[i];
    while (lines[i + 1] === lines[i] + 1) i++;
    out.push(start === lines[i] ? `${start}` : `${start}-${lines[i]}`);
  }
  return out.join(', ');
};

const coverage = new Map();
for (const file of CLOVERS) {
  if (existsSync(file)) for (const [path, stats] of readClover(file)) coverage.set(path, stats);
}

let failed = 0;
console.log(`| File | Phủ / tổng | % | Dòng chưa phủ |\n|---|---|---|---|`);
for (const path of targets) {
  const stats = coverage.get(path);
  if (!stats) {
    console.log(`| \`${path}\` | – | **không có trong clover** | chưa có test nào nạp file này |`);
    failed++;
    continue;
  }
  const covered = stats.total - stats.uncovered.length;
  const percent = stats.total === 0 ? 100 : (100 * covered) / stats.total;
  if (stats.uncovered.length > 0) failed++;
  const shown = stats.uncovered.length > 0 ? `**${percent.toFixed(2)}%**` : '100%';
  console.log(
    `| \`${path}\` | ${covered} / ${stats.total} | ${shown} | ${ranges(stats.uncovered.sort((a, b) => a - b))} |`,
  );
}

const missing = CLOVERS.filter((file) => !existsSync(file));
if (missing.length > 0) console.log(`\nKhông thấy clover: ${missing.join(', ')} (bỏ qua nếu gói đó không bị đổi).`);
console.log(
  failed === 0 ? '\nĐạt: mọi file bị đổi phủ 100%.' : `\nChưa đạt: ${failed} / ${targets.length} file dưới 100%.`,
);
process.exit(failed === 0 ? 0 : 1);
