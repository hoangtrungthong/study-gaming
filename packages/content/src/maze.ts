import type { Block, BlockKind, MazeLevel } from './types';

export type Dir = 0 | 1 | 2 | 3; // 0 lên, 1 phải, 2 xuống, 3 trái

export interface MazeMap {
  width: number;
  height: number;
  walls: Set<string>;
  start: { x: number; y: number; dir: Dir };
  home: { x: number; y: number };
}

export interface MazeStep {
  /** Đường dẫn tới khối đang chạy trong chương trình (chỉ số lồng nhau), để màn tô sáng. */
  path: number[];
  x: number;
  y: number;
  dir: Dir;
}

export type MazeOutcome = 'home' | 'wall' | 'notHome' | 'tooLong';

export interface MazeRun {
  steps: MazeStep[];
  outcome: MazeOutcome;
  /** Khối gây lỗi (đụng tường), để tô đỏ. */
  failedAt?: number[];
}

const DIRS: Record<MazeLevel['dir'], Dir> = { '^': 0, '>': 1, v: 2, '<': 3 };
const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];
/** Chặn vòng lặp quá dài (lặp lồng nhiều tầng). */
const MAX_STEPS = 500;

export const key = (x: number, y: number) => `${x},${y}`;

export function parseMaze(maze: MazeLevel): MazeMap {
  const walls = new Set<string>();
  let start: MazeMap['start'] | undefined;
  let home: MazeMap['home'] | undefined;
  maze.grid.forEach((row, y) => {
    [...row].forEach((cell, x) => {
      if (cell === '#') walls.add(key(x, y));
      if (cell === 'S') start = { x, y, dir: DIRS[maze.dir] };
      if (cell === 'H') home = { x, y };
    });
  });
  if (!start || !home) throw new Error(`Mê cung ${maze.id} thiếu S hoặc H`);
  return { width: maze.grid[0]?.length ?? 0, height: maze.grid.length, walls, start, home };
}

export function isWall(map: MazeMap, x: number, y: number): boolean {
  return x < 0 || y < 0 || x >= map.width || y >= map.height || map.walls.has(key(x, y));
}

/** Số khối của chương trình: mỗi khối tính 1, khối lặp tính 1 cộng các khối con. */
export function countBlocks(program: Block[]): number {
  return program.reduce((n, b) => n + 1 + (b.kind === 'repeat' ? countBlocks(b.body) : 0), 0);
}

/** Chạy chương trình, trả về từng bước để màn phát lại. Dừng ngay khi tới nhà hoặc đụng tường. */
export function runMaze(map: MazeMap, program: Block[]): MazeRun {
  let { x, y, dir } = map.start;
  const steps: MazeStep[] = [];
  let outcome: MazeOutcome | null = null;
  let failedAt: number[] | undefined;

  const exec = (blocks: Block[], prefix: number[]): void => {
    for (let i = 0; i < blocks.length && !outcome; i++) {
      const b = blocks[i]!;
      const path = [...prefix, i];
      if (b.kind === 'repeat') {
        for (let t = 0; t < b.times && !outcome; t++) exec(b.body, path);
        continue;
      }
      if (steps.length >= MAX_STEPS) {
        outcome = 'tooLong';
        return;
      }
      if (b.kind === 'left') dir = ((dir + 3) % 4) as Dir;
      else if (b.kind === 'right') dir = ((dir + 1) % 4) as Dir;
      else {
        const nx = x + DX[dir]!;
        const ny = y + DY[dir]!;
        if (isWall(map, nx, ny)) {
          outcome = 'wall';
          failedAt = path;
          return;
        }
        x = nx;
        y = ny;
      }
      steps.push({ path, x, y, dir });
      if (x === map.home.x && y === map.home.y) outcome = 'home';
    }
  };

  exec(program, []);
  return { steps, outcome: outcome ?? 'notHome', failedAt };
}

/**
 * Số khối của chương trình ngắn nhất chỉ dùng đi tới / rẽ (không lặp): BFS trên trạng thái (x, y, hướng).
 * Trả `null` khi không tới được nhà.
 */
export function shortestPlainProgram(map: MazeMap, canTurnRight: boolean): number | null {
  const startKey = `${map.start.x},${map.start.y},${map.start.dir}`;
  const dist = new Map<string, number>([[startKey, 0]]);
  const queue: [number, number, Dir][] = [[map.start.x, map.start.y, map.start.dir]];
  while (queue.length > 0) {
    const [x, y, dir] = queue.shift()!;
    const d = dist.get(`${x},${y},${dir}`)!;
    if (x === map.home.x && y === map.home.y) return d;
    const next: [number, number, Dir][] = [[x, y, ((dir + 3) % 4) as Dir]];
    if (canTurnRight) next.push([x, y, ((dir + 1) % 4) as Dir]);
    const nx = x + DX[dir]!;
    const ny = y + DY[dir]!;
    if (!isWall(map, nx, ny)) next.push([nx, ny, dir]);
    for (const s of next) {
      const k = `${s[0]},${s[1]},${s[2]}`;
      if (!dist.has(k)) {
        dist.set(k, d + 1);
        queue.push(s);
      }
    }
  }
  return null;
}

type PlainKind = 'forward' | 'left' | 'right';

export interface ShortestProgram {
  blocks: number;
  program: Block[];
}

type State = [x: number, y: number, dir: Dir];

interface Node {
  state: State;
  cost: number;
  done: boolean;
  prev?: { from: Node; block: Block };
}

/** Đi một khối thường từ một trạng thái: trả trạng thái mới, `null` khi đụng tường. */
function stepPlain(map: MazeMap, [x, y, dir]: State, kind: PlainKind): State | null {
  if (kind === 'left') return [x, y, ((dir + 3) % 4) as Dir];
  if (kind === 'right') return [x, y, ((dir + 1) % 4) as Dir];
  const nx = x + DX[dir]!;
  const ny = y + DY[dir]!;
  return isWall(map, nx, ny) ? null : [nx, ny, dir];
}

/** Mọi thân khối lặp dài 1..maxLen từ các khối thường; bỏ thân có "rẽ trái rồi rẽ phải" kề nhau (luôn có thân ngắn hơn). */
function repeatBodies(kinds: PlainKind[], maxLen: number): PlainKind[][] {
  const out: PlainKind[][] = [];
  let layer: PlainKind[][] = [[]];
  for (let len = 1; len <= maxLen; len++) {
    const next: PlainKind[][] = [];
    for (const body of layer) {
      for (const k of kinds) {
        const last = body[body.length - 1];
        if ((last === 'left' && k === 'right') || (last === 'right' && k === 'left')) continue;
        next.push([...body, k]);
      }
    }
    out.push(...next);
    layer = next;
  }
  return out;
}

/** Số lần lặp mà game cho chọn (`MIN_TIMES` / `MAX_TIMES` ở `apps/game/src/games/maze/MazeGame.ts`). */
export const REPEAT_TIMES = { min: 2, max: 9 } as const;

/**
 * Chương trình ít khối nhất dùng các khối của mê cung, khối lặp một tầng (không lặp lồng), lặp `REPEAT_TIMES` lần, thân
 * khối lặp dài tối đa `maxBody` khối thường. Dijkstra trên trạng thái (x, y, hướng): mỗi cạnh là một khối thường (giá 1)
 * hoặc một khối lặp (giá 1 + độ dài thân); tới nhà giữa chừng khối lặp là xong vì Bit dừng ngay khi tới nhà.
 * Trả `null` khi không tới được nhà.
 */
export function shortestProgramWithin(map: MazeMap, blocks: BlockKind[], maxBody: number): ShortestProgram | null {
  const kinds = (['forward', 'left', 'right'] as const).filter((k) => blocks.includes(k));
  const bodies = blocks.includes('repeat') ? repeatBodies(kinds, maxBody) : [];
  const sk = (s: State) => s.join(',');
  const start: State = [map.start.x, map.start.y, map.start.dir];
  const nodes = new Map<string, Node>([[sk(start), { state: start, cost: 0, done: false }]]);
  let best: { cost: number; from: Node; block: Block } | null = null;
  const atHome = (s: State) => s[0] === map.home.x && s[1] === map.home.y;
  const relax = (from: Node, cost: number, block: Block, to: State | 'home') => {
    if (to === 'home') {
      if (!best || cost < best.cost) best = { cost, from, block };
      return;
    }
    const node = nodes.get(sk(to));
    if (!node) nodes.set(sk(to), { state: to, cost, done: false, prev: { from, block } });
    else if (cost < node.cost) Object.assign(node, { cost, prev: { from, block } });
  };
  const limit = () => best?.cost ?? Infinity;

  for (;;) {
    let cur: Node | undefined;
    for (const n of nodes.values()) if (!n.done && (!cur || n.cost < cur.cost)) cur = n;
    if (!cur || cur.cost + 1 >= limit()) break;
    cur.done = true;
    for (const kind of kinds) {
      const to = stepPlain(map, cur.state, kind);
      if (to) relax(cur, cur.cost + 1, { kind }, atHome(to) ? 'home' : to);
    }
    for (const body of bodies) {
      const cost = cur.cost + 1 + body.length;
      if (cost >= limit()) continue;
      let s: State | null = cur.state;
      for (let t = 1; t <= REPEAT_TIMES.max && s; t++) {
        let home = false;
        for (let i = 0; i < body.length && s && !home; i++) {
          s = stepPlain(map, s, body[i]!);
          home = s !== null && atHome(s);
        }
        if (!s) break;
        const block: Block = {
          kind: 'repeat',
          times: Math.max(t, REPEAT_TIMES.min),
          body: body.map((kind) => ({ kind })),
        };
        if (home) {
          relax(cur, cost, block, 'home');
          break;
        }
        if (t >= REPEAT_TIMES.min) relax(cur, cost, block, s);
      }
    }
  }
  if (!best) return null;
  const found: { cost: number; from: Node; block: Block } = best;
  const program: Block[] = [found.block];
  for (let n: Node = found.from; n.prev; n = n.prev.from) program.unshift(n.prev.block);
  return { blocks: found.cost, program };
}

/**
 * Chương trình ngắn nhất thật sự (khối lặp một tầng). Tăng dần độ dài thân lặp `L`: kết quả `c` với thân ≤ `L` là tối ưu khi
 * `c ≤ L + 1`, vì chương trình nào dùng thân dài hơn cũng tốn ít nhất `L + 2` khối. Mê cung không có khối lặp chỉ cần BFS.
 */
export function shortestProgram(map: MazeMap, blocks: BlockKind[]): ShortestProgram | null {
  for (let maxBody = blocks.includes('repeat') ? 1 : 0; ; maxBody++) {
    const found = shortestProgramWithin(map, blocks, maxBody);
    if (!found || maxBody === 0 || found.blocks <= maxBody + 1) return found;
  }
}
