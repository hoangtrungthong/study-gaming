import {
  countBlocks,
  isWall,
  parseMaze,
  runMaze,
  type Block,
  type BlockKind,
  type Dir,
  type MazeLevel,
  type MazeMap,
  type MazeRun,
} from '@study/content';
import { capForHint } from '../result';

/** Số lần của khối lặp: mặc định 2, chỉnh trong khoảng 2–9. */
export const MIN_TIMES = 2;
export const MAX_TIMES = 9;

export type EditResult = 'ok' | 'tooMany' | 'nested' | 'notAllowed' | 'badTarget';

/** Gợi ý của Đèn Pin: khối đúng cần đặt ở `path`; `block: null` nghĩa là khối ở `path` thừa, cần bỏ. */
export interface MazeHint {
  path: number[];
  block: Block | null;
}

/**
 * Sao theo CC-20: 3 khi tới nhà ngay lần chạy đầu với số khối ≤ tối ưu, 2 khi tới nhà trong 3 lần chạy, còn lại 1.
 * Đã dùng Đèn Pin thì tối đa 2 sao.
 */
export function mazeStars(attempts: number, blocks: number, optimal: number, usedHint = false): number {
  return capForHint(attempts === 1 && blocks <= optimal ? 3 : attempts <= 3 ? 2 : 1, usedHint);
}

const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];

/** Chương trình ngắn nhất chỉ gồm đi tới / rẽ: BFS trên trạng thái (x, y, hướng). `null` khi không tới được nhà. */
export function solvePlain(map: MazeMap, canTurnRight: boolean): Block[] | null {
  const id = (x: number, y: number, d: Dir) => `${x},${y},${d}`;
  const prev = new Map<string, { from: string; kind: BlockKind } | null>([
    [id(map.start.x, map.start.y, map.start.dir), null],
  ]);
  const queue: [number, number, Dir][] = [[map.start.x, map.start.y, map.start.dir]];
  while (queue.length > 0) {
    const [x, y, dir] = queue.shift()!;
    const here = id(x, y, dir);
    if (x === map.home.x && y === map.home.y) {
      const kinds: BlockKind[] = [];
      for (let p = prev.get(here); p; p = prev.get(p.from)) kinds.unshift(p.kind);
      return kinds.map((kind) => ({ kind }) as Block);
    }
    const next: [number, number, Dir, BlockKind][] = [[x, y, ((dir + 3) % 4) as Dir, 'left']];
    if (canTurnRight) next.push([x, y, ((dir + 1) % 4) as Dir, 'right']);
    const nx = x + DX[dir]!;
    const ny = y + DY[dir]!;
    if (!isWall(map, nx, ny)) next.push([nx, ny, dir, 'forward']);
    for (const [sx, sy, sd, kind] of next) {
      const k = id(sx, sy, sd);
      if (!prev.has(k)) {
        prev.set(k, { from: here, kind });
        queue.push([sx, sy, sd]);
      }
    }
  }
  return null;
}

function newBlock(kind: BlockKind): Block {
  return kind === 'repeat' ? { kind, times: MIN_TIMES, body: [] } : { kind };
}

/** So chương trình với lời giải: tìm chỗ sai / thiếu đầu tiên (đi sâu vào khối lặp đúng số lần). */
function firstDiff(program: Block[], solution: Block[], prefix: number[]): MazeHint | null {
  for (let i = 0; i < solution.length; i++) {
    const p = program[i];
    const s = solution[i]!;
    const path = [...prefix, i];
    if (!p || p.kind !== s.kind) return { path, block: s };
    if (p.kind === 'repeat' && s.kind === 'repeat') {
      if (p.times !== s.times) return { path, block: s };
      const inner = firstDiff(p.body, s.body, path);
      if (inner) return inner;
    }
  }
  return program.length > solution.length ? { path: [...prefix, solution.length], block: null } : null;
}

/** Luật trò Đưa Bit Về Nhà: soạn chương trình khối lệnh, chạy thử, tính sao. Hoạt ảnh do màn lo. */
export class MazeGame {
  readonly map: MazeMap;
  program: Block[] = [];
  /** Số lần bấm Chạy. */
  attempts = 0;
  /** Số lần chạy không tới nhà. */
  mistakes = 0;
  won = false;
  usedHint = false;
  /** Số khối của chương trình lúc tới nhà. */
  winBlocks = 0;
  private readonly solution: Block[];

  constructor(
    readonly maze: MazeLevel,
    private readonly nestedRepeat: boolean,
  ) {
    this.map = parseMaze(maze);
    this.solution = maze.solution ?? solvePlain(this.map, maze.blocks.includes('right')) ?? [];
  }

  get blockCount(): number {
    return countBlocks(this.program);
  }

  get stars(): number {
    return mazeStars(this.attempts, this.winBlocks, this.maze.optimal, this.usedHint);
  }

  /** Khối ở đường dẫn `path`, `undefined` khi không có. */
  blockAt(path: number[]): Block | undefined {
    let list = this.program;
    let block: Block | undefined;
    for (const i of path) {
      block = list[i];
      if (!block) return undefined;
      list = block.kind === 'repeat' ? block.body : [];
    }
    return block;
  }

  /** Danh sách nhận khối: chương trình (`[]`) hoặc thân khối lặp ở `into`. */
  private listAt(into: number[]): Block[] | null {
    if (into.length === 0) return this.program;
    const block = this.blockAt(into);
    return block?.kind === 'repeat' ? block.body : null;
  }

  /** Thêm khối vào cuối chương trình hoặc vào thân khối lặp `into`, trước vị trí `index` nếu có. */
  add(kind: BlockKind, into: number[] = [], index?: number): EditResult {
    if (!this.maze.blocks.includes(kind)) return 'notAllowed';
    const list = this.listAt(into);
    if (!list) return 'badTarget';
    if (kind === 'repeat' && into.length > 0 && !this.nestedRepeat) return 'nested';
    if (this.blockCount + 1 > this.maze.maxBlocks) return 'tooMany';
    list.splice(index ?? list.length, 0, newBlock(kind));
    return 'ok';
  }

  /** Chuyển khối ở `from` tới danh sách `into`, trước vị trí `index` nếu có (đổi thứ tự hoặc cho vào khối lặp). */
  move(from: number[], into: number[] = [], index?: number): EditResult {
    const block = this.blockAt(from);
    const list = this.listAt(into);
    // Không cho khối lặp chui vào chính nó.
    const intoSelf = from.length <= into.length && from.every((v, i) => into[i] === v);
    if (!block || !list || intoSelf) return 'badTarget';
    if (block.kind === 'repeat' && into.length > 0 && !this.nestedRepeat) return 'nested';
    const before = index === undefined ? undefined : list[index];
    if (before === block) return 'ok';
    this.remove(from);
    list.splice(before ? list.indexOf(before) : list.length, 0, block);
    return 'ok';
  }

  /** Đổi chỗ khối ở `path` với khối kề bên trong cùng danh sách (`delta` -1: lên, 1: xuống). */
  shift(path: number[], delta: -1 | 1): boolean {
    const list = this.listAt(path.slice(0, -1));
    const i = path.at(-1);
    if (!list || i === undefined || !list[i] || !list[i + delta]) return false;
    [list[i], list[i + delta]] = [list[i + delta]!, list[i]!];
    return true;
  }

  /** Đường dẫn hiện tại của một khối (tìm theo chính đối tượng khối), `null` khi khối không còn trong chương trình. */
  pathOf(block: Block, list: Block[] = this.program, prefix: number[] = []): number[] | null {
    for (const [i, b] of list.entries()) {
      if (b === block) return [...prefix, i];
      const inner = b.kind === 'repeat' ? this.pathOf(block, b.body, [...prefix, i]) : null;
      if (inner) return inner;
    }
    return null;
  }

  remove(path: number[]): boolean {
    const list = this.listAt(path.slice(0, -1));
    const i = path.at(-1);
    if (!list || i === undefined || !list[i]) return false;
    list.splice(i, 1);
    return true;
  }

  clear(): void {
    this.program = [];
  }

  /** Đổi số lần của khối lặp, giữ trong khoảng 2–9. */
  setTimes(path: number[], times: number): boolean {
    const block = this.blockAt(path);
    if (block?.kind !== 'repeat') return false;
    block.times = Math.min(MAX_TIMES, Math.max(MIN_TIMES, times));
    return true;
  }

  /** Các bước chương trình hiện tại sẽ đi, chưa tính lần chạy (màn phát hoạt ảnh xong mới `record`). */
  trace(): MazeRun {
    return runMaze(this.map, this.program);
  }

  /**
   * Ghi một lần chạy đã phát hết: tính lần chạy, lần sai, tới nhà thì thắng. Lần chạy bị dừng giữa chừng
   * (Về chỗ cũ) ghi bằng `abort`, nên trạng thái thắng chỉ chốt khi Bit thật sự về tới nhà trên màn.
   */
  record(result: MazeRun): MazeRun {
    if (this.won) return result;
    this.attempts++;
    if (result.outcome === 'home') {
      this.won = true;
      this.winBlocks = this.blockCount;
    } else {
      this.mistakes++;
    }
    return result;
  }

  /**
   * Ghi một lần chạy bị dừng giữa chừng (Về chỗ cũ): vẫn tính một lần chạy; nếu chạy hết sẽ không tới nhà thì
   * tính cả lần sai. Chạy hết sẽ tới nhà thì không thắng, nên lần thắng sau không còn là "đúng ngay lần đầu".
   */
  abort(result: MazeRun): void {
    if (this.won) return;
    this.attempts++;
    if (result.outcome !== 'home') this.mistakes++;
  }

  /** Chạy và ghi ngay (không hoạt ảnh); chạy sai không phạt, chương trình giữ nguyên để sửa. */
  run(): MazeRun {
    return this.record(this.trace());
  }

  /** Chỗ cần sửa tiếp theo so với lời giải (không tốn Đèn Pin). `null` khi chương trình đã khớp lời giải. */
  nextHint(): MazeHint | null {
    return firstDiff(this.program, this.solution, []);
  }

  /** Dùng Đèn Pin: đánh dấu đã dùng gợi ý rồi trả chỗ cần sửa tiếp theo. */
  hint(): MazeHint | null {
    const hint = this.nextHint();
    if (hint) this.usedHint = true;
    return hint;
  }
}
