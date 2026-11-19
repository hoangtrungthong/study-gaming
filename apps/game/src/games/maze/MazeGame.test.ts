import { describe, expect, it } from 'vitest';
import { mazes, parseMaze, type MazeLevel } from '@study/content';
import { MAX_TIMES, MazeGame, MIN_TIMES, mazeStars, solvePlain } from './MazeGame';

const maze = (id: string) => mazes.find((m) => m.id === id)!;
const F = { kind: 'forward' } as const;
const R = { kind: 'right' } as const;
const L = { kind: 'left' } as const;

/** Mê cung không tới được nhà (tường chắn giữa). */
const blocked: MazeLevel = {
  id: 'x-blocked',
  grid: ['S#H'],
  dir: '>',
  blocks: ['forward', 'left', 'right'],
  maxBlocks: 4,
  optimal: 1,
  hintVi: 'Không có đường.',
};

describe('mazeStars', () => {
  it('3 sao khi tới nhà lần chạy đầu với số khối ≤ tối ưu, 2 sao trong 3 lần chạy, còn lại 1; Đèn Pin tối đa 2', () => {
    expect(mazeStars(1, 5, 5)).toBe(3);
    expect(mazeStars(1, 6, 5)).toBe(2);
    expect(mazeStars(3, 5, 5)).toBe(2);
    expect(mazeStars(4, 5, 5)).toBe(1);
    expect(mazeStars(1, 5, 5, true)).toBe(2);
    expect(mazeStars(4, 5, 5, true)).toBe(1);
  });
});

describe('solvePlain', () => {
  it('tìm chương trình ngắn nhất chỉ gồm đi tới / rẽ', () => {
    const map = parseMaze(maze('it-m-01'));
    expect(solvePlain(map, true)).toEqual([F, F, R, F, F]);
    expect(solvePlain(map, false)).toEqual([F, F, L, L, L, F, F]);
  });

  it('không tới được nhà thì trả null', () => {
    expect(solvePlain(parseMaze(blocked), true)).toBeNull();
  });
});

describe('MazeGame', () => {
  it('thêm khối vào cuối, vào thân khối lặp và trước một vị trí; khối lặp mặc định 2 lần', () => {
    const g = new MazeGame(maze('it-m-02'), false);
    expect(g.add('forward')).toBe('ok');
    expect(g.add('repeat')).toBe('ok');
    expect(g.add('forward', [1])).toBe('ok');
    expect(g.add('right', [], 0)).toBe('ok');
    expect(g.program).toEqual([R, F, { kind: 'repeat', times: MIN_TIMES, body: [F] }]);
    expect(g.blockCount).toBe(4);
    expect(g.blockAt([2, 0])).toEqual(F);
    expect(g.blockAt([0, 0])).toBeUndefined();
    expect(g.blockAt([9])).toBeUndefined();
  });

  it('từ chối khối không có trong khay, chỗ thả không phải khối lặp, lặp lồng và quá số khối', () => {
    const g1 = new MazeGame(maze('it-m-01'), false);
    expect(g1.add('repeat')).toBe('notAllowed');
    for (let i = 0; i < 6; i++) expect(g1.add('forward')).toBe('ok');
    expect(g1.add('forward')).toBe('tooMany');
    expect(g1.add('left', [0])).toBe('badTarget');

    const g2 = new MazeGame(maze('it-m-02'), false);
    g2.add('repeat');
    expect(g2.add('repeat', [0])).toBe('nested');
    const g3 = new MazeGame(maze('it-m-02'), true);
    g3.add('repeat');
    expect(g3.add('repeat', [0])).toBe('ok');
  });

  it('chuyển khối để đổi thứ tự hoặc cho vào khối lặp', () => {
    const g = new MazeGame(maze('it-m-02'), false);
    g.add('forward');
    g.add('right');
    g.add('repeat');
    expect(g.move([1], [], 0)).toBe('ok');
    expect(g.program.map((b) => b.kind)).toEqual(['right', 'forward', 'repeat']);
    expect(g.move([0], [2])).toBe('ok');
    expect(g.program).toEqual([F, { kind: 'repeat', times: 2, body: [R] }]);
    expect(g.move([0], [], 1)).toBe('ok');
    expect(g.program.map((b) => b.kind)).toEqual(['forward', 'repeat']);
    expect(g.move([0])).toBe('ok');
    expect(g.program.map((b) => b.kind)).toEqual(['repeat', 'forward']);
    // Đặt vào đúng chỗ cũ: không đổi gì.
    expect(g.move([0], [], 0)).toBe('ok');
    expect(g.program.map((b) => b.kind)).toEqual(['repeat', 'forward']);
    expect(g.move([0], [0])).toBe('badTarget');
    expect(g.move([5])).toBe('badTarget');
    expect(g.move([1], [1])).toBe('badTarget');
    g.add('repeat');
    expect(g.move([2], [0])).toBe('nested');
    const nested = new MazeGame(maze('it-m-02'), true);
    nested.add('repeat');
    nested.add('repeat');
    expect(nested.move([1], [0])).toBe('ok');
    expect(nested.blockCount).toBe(2);
  });

  it('đổi chỗ với khối kề bên trong cùng danh sách; tìm đường dẫn theo đối tượng khối', () => {
    const g = new MazeGame(maze('it-m-02'), false);
    g.add('forward');
    g.add('repeat');
    g.add('left', [1]);
    g.add('right', [1]);
    expect(g.shift([0], 1)).toBe(true);
    expect(g.program.map((b) => b.kind)).toEqual(['repeat', 'forward']);
    expect(g.shift([0, 1], -1)).toBe(true);
    expect(g.blockAt([0])).toMatchObject({ body: [R, L] });
    expect(g.shift([0], -1)).toBe(false);
    expect(g.shift([1], 1)).toBe(false);
    expect(g.shift([0, 0, 0], 1)).toBe(false);
    expect(g.shift([5], 1)).toBe(false);
    expect(g.shift([], 1)).toBe(false);

    const repeat = g.blockAt([0])!;
    const left = g.blockAt([0, 1])!;
    expect(g.pathOf(repeat)).toEqual([0]);
    expect(g.pathOf(left)).toEqual([0, 1]);
    g.shift([0], 1);
    expect(g.pathOf(repeat)).toEqual([1]);
    expect(g.pathOf(left)).toEqual([1, 1]);
    g.remove([1]);
    expect(g.pathOf(repeat)).toBeNull();
  });

  it('trace chỉ tính bước, record mới ghi lần chạy; chưa record thì chưa thắng', () => {
    const g = new MazeGame(maze('it-m-01'), false);
    ['forward', 'forward', 'right', 'forward', 'forward'].forEach((k) => g.add(k as 'forward'));
    const result = g.trace();
    expect(result.outcome).toBe('home');
    expect(g).toMatchObject({ attempts: 0, won: false, winBlocks: 0 });
    expect(g.record(result)).toBe(result);
    expect(g).toMatchObject({ attempts: 1, mistakes: 0, won: true, winBlocks: 5 });
    expect(g.stars).toBe(3);
  });

  it('xoá, xoá hết và đổi số lần lặp trong khoảng 2–9', () => {
    const g = new MazeGame(maze('it-m-02'), false);
    g.add('repeat');
    g.add('forward', [0]);
    expect(g.setTimes([0], 20)).toBe(true);
    expect(g.blockAt([0])).toMatchObject({ times: MAX_TIMES });
    g.setTimes([0], 0);
    expect(g.blockAt([0])).toMatchObject({ times: MIN_TIMES });
    expect(g.setTimes([0, 0], 3)).toBe(false);
    expect(g.remove([0, 0])).toBe(true);
    expect(g.remove([0, 0])).toBe(false);
    expect(g.remove([])).toBe(false);
    expect(g.remove([3, 0])).toBe(false);
    g.clear();
    expect(g.program).toEqual([]);
  });

  it('chạy: đụng tường, chưa tới nhà, tới nhà; tính lần chạy, lần sai và sao', () => {
    const g = new MazeGame(maze('it-m-01'), false);
    ['forward', 'forward', 'forward'].forEach((k) => g.add(k as 'forward'));
    const wall = g.run();
    expect(wall.outcome).toBe('wall');
    expect(wall.failedAt).toEqual([2]);
    g.remove([2]);
    expect(g.run().outcome).toBe('notHome');
    g.add('right');
    g.add('forward');
    g.add('forward');
    const home = g.run();
    expect(home.outcome).toBe('home');
    expect(home.steps.at(-1)).toMatchObject({ x: 2, y: 2 });
    expect(g).toMatchObject({ attempts: 3, mistakes: 2, won: true, winBlocks: 5 });
    expect(g.stars).toBe(2);
    // Chạy lại sau khi thắng không tính thêm.
    g.run();
    expect(g.attempts).toBe(3);
  });

  it('lần chạy bị dừng giữa chừng vẫn tính lần chạy; sẽ không tới nhà thì tính lần sai; sẽ tới nhà thì không thắng', () => {
    const g = new MazeGame(maze('it-m-01'), false);
    ['forward', 'forward', 'forward'].forEach((k) => g.add(k as 'forward'));
    g.abort(g.trace());
    expect(g).toMatchObject({ attempts: 1, mistakes: 1, won: false });
    g.remove([2]);
    ['right', 'forward', 'forward'].forEach((k) => g.add(k as 'forward'));
    const home = g.trace();
    expect(home.outcome).toBe('home');
    g.abort(home);
    expect(g).toMatchObject({ attempts: 2, mistakes: 1, won: false, winBlocks: 0 });
    // Chạy hết lần sau: thắng nhưng không còn là lần chạy đầu, nên không 3 sao dù đúng số khối tối ưu.
    g.run();
    expect(g).toMatchObject({ attempts: 3, mistakes: 1, won: true, winBlocks: 5 });
    expect(g.stars).toBe(2);
    // Đã thắng thì dừng giữa chừng không tính thêm.
    g.abort(home);
    expect(g.attempts).toBe(3);
  });

  it('3 sao khi đúng ngay lần đầu với số khối tối ưu; dùng khối lặp ở mê cung có lời giải mẫu', () => {
    const g = new MazeGame(maze('it-m-03'), false);
    g.add('repeat');
    ['forward', 'right', 'forward', 'left'].forEach((k) => g.add(k as 'forward', [0]));
    g.setTimes([0], 5);
    expect(g.run().outcome).toBe('home');
    expect(g.stars).toBe(3);
  });

  it('Đèn Pin chỉ khối tiếp theo theo lời giải mẫu: thiếu, sai số lần, thân lặp, khối thừa, đã khớp', () => {
    const g = new MazeGame(maze('it-m-02'), false);
    expect(g.nextHint()).toEqual({ path: [0], block: maze('it-m-02').solution![0] });
    expect(g.usedHint).toBe(false);
    g.add('repeat');
    expect(g.nextHint()!.path).toEqual([0]);
    g.setTimes([0], 4);
    expect(g.nextHint()).toEqual({ path: [0, 0], block: F });
    g.add('forward', [0]);
    g.add('left', [0]);
    expect(g.nextHint()).toEqual({ path: [0, 1], block: null });
    g.remove([0, 1]);
    g.add('left');
    expect(g.hint()).toEqual({ path: [1], block: R });
    expect(g.usedHint).toBe(true);
    g.remove([1]);
    g.add('right');
    g.add('repeat');
    g.setTimes([2], 4);
    g.add('forward', [2]);
    const fresh = new MazeGame(maze('it-m-02'), false);
    fresh.program = structuredClone(g.program);
    expect(fresh.hint()).toBeNull();
    expect(fresh.usedHint).toBe(false);
  });

  it('mê cung không có lời giải mẫu thì Đèn Pin dùng đường ngắn nhất; không tới được nhà thì không có gợi ý', () => {
    const g = new MazeGame(maze('it-m-01'), false);
    expect(g.nextHint()).toEqual({ path: [0], block: F });
    expect(new MazeGame(blocked, false).nextHint()).toBeNull();
  });
});
