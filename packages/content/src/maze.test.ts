import { describe, expect, it } from 'vitest';
import {
  countBlocks,
  isWall,
  parseMaze,
  REPEAT_TIMES,
  runMaze,
  shortestPlainProgram,
  shortestProgram,
  shortestProgramWithin,
} from './maze';
import { mazes } from './regions';
import type { Block, MazeLevel } from './types';

const F: Block = { kind: 'forward' };
const L: Block = { kind: 'left' };
const R: Block = { kind: 'right' };
const rep = (times: number, ...body: Block[]): Block => ({ kind: 'repeat', times, body });

const maze = (over: Partial<MazeLevel> = {}): MazeLevel => ({
  id: 'm',
  grid: ['S..#', '##.#', '##H#', '####'],
  dir: '>',
  blocks: ['forward', 'left', 'right'],
  maxBlocks: 6,
  optimal: 5,
  hintVi: 'x',
  ...over,
});

describe('parseMaze', () => {
  it('đọc tường, điểm xuất phát với hướng, nhà', () => {
    const map = parseMaze(maze());
    expect(map.start).toEqual({ x: 0, y: 0, dir: 1 });
    expect(map.home).toEqual({ x: 2, y: 2 });
    expect(map.width).toBe(4);
    expect(isWall(map, 3, 0)).toBe(true);
    expect(isWall(map, 1, 0)).toBe(false);
    expect(isWall(map, -1, 0)).toBe(true);
    expect(isWall(map, 0, 9)).toBe(true);
  });

  it('hướng xuất phát theo ký hiệu', () => {
    expect(parseMaze(maze({ dir: '^' })).start.dir).toBe(0);
    expect(parseMaze(maze({ dir: 'v' })).start.dir).toBe(2);
    expect(parseMaze(maze({ dir: '<' })).start.dir).toBe(3);
  });

  it('báo lỗi khi thiếu S hoặc H', () => {
    expect(() => parseMaze(maze({ grid: ['....'] }))).toThrow('thiếu S hoặc H');
  });
});

describe('runMaze', () => {
  const map = parseMaze(maze());

  it('tới nhà: dừng ngay ở bước tới nhà, ghi đường dẫn khối', () => {
    const run = runMaze(map, [F, F, R, F, F, F]);
    expect(run.outcome).toBe('home');
    expect(run.steps).toHaveLength(5);
    expect(run.steps.at(-1)).toEqual({ path: [4], x: 2, y: 2, dir: 2 });
  });

  it('đụng tường: dừng, ghi khối lỗi', () => {
    const run = runMaze(map, [F, F, F]);
    expect(run.outcome).toBe('wall');
    expect(run.failedAt).toEqual([2]);
    expect(run.steps).toHaveLength(2);
  });

  it('hết lệnh mà chưa tới nhà', () => {
    expect(runMaze(map, [F]).outcome).toBe('notHome');
    expect(runMaze(map, []).outcome).toBe('notHome');
  });

  it('rẽ trái và rẽ phải đổi hướng đúng', () => {
    const run = runMaze(map, [L, R, R]);
    expect(run.steps.map((s) => s.dir)).toEqual([0, 1, 2]);
  });

  it('khối lặp và lặp lồng; đường dẫn chỉ tới khối con', () => {
    const stairs = parseMaze(mazes.find((m) => m.id === 'it-m-03')!);
    const run = runMaze(stairs, [rep(5, F, R, F, L)]);
    expect(run.outcome).toBe('home');
    expect(run.steps[0]!.path).toEqual([0, 0]);
    const nested = runMaze(parseMaze(mazes.find((m) => m.id === 'it-m-02')!), [rep(2, rep(4, F), R)]);
    expect(nested.outcome).toBe('home');
    expect(nested.steps[0]!.path).toEqual([0, 0, 0]);
  });

  it('chặn chương trình chạy quá dài', () => {
    const open = parseMaze(maze({ grid: ['S.', '..', '.H'], dir: '>' }));
    expect(runMaze(open, [rep(1000, L)]).outcome).toBe('tooLong');
  });
});

describe('countBlocks', () => {
  it('khối lặp tính 1 cộng khối con', () => {
    expect(countBlocks([F, rep(3, F, L), R])).toBe(5);
    expect(countBlocks([])).toBe(0);
  });
});

describe('shortestPlainProgram', () => {
  it('lời giải ngắn nhất chỉ dùng đi tới / rẽ', () => {
    const map = parseMaze(maze());
    expect(shortestPlainProgram(map, true)).toBe(5);
    expect(shortestPlainProgram(map, false)).toBe(7); // rẽ phải = rẽ trái 3 lần
  });
  it('không tới được nhà thì trả null', () => {
    expect(shortestPlainProgram(parseMaze(maze({ grid: ['S#H'] })), true)).toBeNull();
  });
});

describe('shortestProgram', () => {
  const loop = ['forward', 'left', 'right', 'repeat'] as const;

  it('không có khối lặp thì bằng lời giải ngắn nhất chỉ đi tới / rẽ', () => {
    const map = parseMaze(maze());
    expect(shortestProgram(map, ['forward', 'left', 'right'])).toEqual({ blocks: 5, program: [F, F, R, F, F] });
    expect(shortestProgram(map, ['forward', 'left'])!.blocks).toBe(7);
  });

  it('dùng khối lặp khi ngắn hơn; Bit dừng ngay khi tới nhà giữa chừng khối lặp', () => {
    const square = parseMaze(mazes.find((m) => m.id === 'it-m-05')!);
    expect(shortestProgram(square, [...loop])).toEqual({ blocks: 6, program: [rep(3, F, F, F, F, R)] });
    // Hành lang dài: lặp đi tới, số lần trong khoảng game cho chọn.
    const hall = parseMaze(maze({ grid: ['S........H'], dir: '>' }));
    expect(shortestProgram(hall, [...loop])).toEqual({ blocks: 2, program: [rep(REPEAT_TIMES.max, F)] });
    // Không có rẽ phải: không lặp cần 7 khối (rẽ phải = rẽ trái 3 lần); khối lặp gộp các lần rẽ còn 5.
    const turn = parseMaze(maze({ grid: ['S.', '#H'], dir: '<' }));
    expect(shortestProgram(turn, ['forward', 'left'])!.blocks).toBe(7);
    expect(shortestProgram(turn, ['forward', 'left', 'repeat'])).toEqual({ blocks: 5, program: [rep(2, L, L, F, L)] });
  });

  it('thân lặp bị giới hạn thì có thể chưa tối ưu; shortestProgram tăng dần tới khi chắc chắn', () => {
    const square = parseMaze(mazes.find((m) => m.id === 'it-m-05')!);
    expect(shortestProgramWithin(square, [...loop], 1)!.blocks).toBe(8);
    expect(shortestProgramWithin(square, [...loop], 5)!.blocks).toBe(6);
  });

  it('không tới được nhà thì trả null', () => {
    expect(shortestProgram(parseMaze(maze({ grid: ['S#H'] })), [...loop])).toBeNull();
    expect(shortestProgram(parseMaze(maze({ grid: ['S#H'] })), ['forward', 'left'])).toBeNull();
  });

  it('optimal của mọi mê cung thật đúng bằng chương trình ngắn nhất, lời giải mẫu cũng ngắn nhất', () => {
    for (const m of mazes) {
      const best = shortestProgram(parseMaze(m), m.blocks);
      expect(best?.blocks, m.id).toBe(m.optimal);
      expect(best!.blocks, m.id).toBeLessThanOrEqual(m.maxBlocks);
      if (m.solution) expect(countBlocks(m.solution), m.id).toBe(m.optimal);
    }
  });
});
