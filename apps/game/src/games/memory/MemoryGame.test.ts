import { describe, expect, it } from 'vitest';
import { decks } from '@study/content';
import { seededRng } from '../random';
import { MemoryGame, memoryStars } from './MemoryGame';

const pool = decks.en.items;

/** Chỉ số thẻ từ / thẻ nghĩa của một mục. */
const indexOf = (g: MemoryGame, id: string, face: 'term' | 'meaning') =>
  g.cards.findIndex((c) => c.item.id === id && c.face === face);

/** Hai thẻ thuộc hai mục khác nhau. */
const mismatchPair = (g: MemoryGame): [number, number] => [
  indexOf(g, g.items[0]!.id, 'term'),
  indexOf(g, g.items[1]!.id, 'meaning'),
];

function solve(g: MemoryGame) {
  for (const item of g.items) {
    g.flip(indexOf(g, item.id, 'term'));
    g.flip(indexOf(g, item.id, 'meaning'));
  }
}

describe('MemoryGame', () => {
  it('mỗi từ có một thẻ từ và một thẻ nghĩa', () => {
    const g = new MemoryGame(pool, 6, seededRng(1));
    expect(g.pairs).toBe(6);
    expect(g.cards).toHaveLength(12);
    for (const item of g.items) {
      expect(
        g.cards
          .filter((c) => c.item.id === item.id)
          .map((c) => c.face)
          .sort(),
      ).toEqual(['meaning', 'term']);
    }
  });

  it('không lấy quá số từ có trong bộ', () => {
    expect(new MemoryGame(pool.slice(0, 2), 8).cards).toHaveLength(4);
  });

  it('lật hai thẻ cùng từ thì ghép cặp, xong hết thì done', () => {
    const g = new MemoryGame(pool, 3, seededRng(2));
    const id = g.items[0]!.id;
    expect(g.flip(indexOf(g, id, 'meaning'))).toBe('first');
    expect(g.faceUp).toHaveLength(1);
    expect(g.flip(indexOf(g, id, 'term'))).toBe('match');
    expect(g.faceUp).toEqual([]);
    expect(g.isMatched(indexOf(g, id, 'term'))).toBe(true);
    expect(g.done).toBe(false);
    solve(g);
    expect(g.done).toBe(true);
    expect(g.mistakes).toBe(0);
    expect(g.firstTry).toEqual(g.items.map((i) => i.id));
    expect(g.wrong).toEqual([]);
  });

  it('lật sai thì tính lỗi, không lật được thẻ thứ ba tới khi úp lại', () => {
    const g = new MemoryGame(pool, 3, seededRng(3));
    const [a, b] = mismatchPair(g);
    g.flip(a);
    expect(g.flip(b)).toBe('mismatch');
    expect(g.mistakes).toBe(1);
    expect(g.faceUp).toEqual([a, b]);
    const third = indexOf(g, g.items[2]!.id, 'term');
    expect(g.flip(third)).toBe('ignored');
    g.hideMismatch();
    expect(g.faceUp).toEqual([]);
    expect(g.flip(third)).toBe('first');
    // Chỉ úp khi đang có hai thẻ ngửa.
    g.hideMismatch();
    expect(g.faceUp).toEqual([third]);
  });

  it('bỏ qua thẻ đang ngửa, thẻ đã ghép và chỉ số lạ', () => {
    const g = new MemoryGame(pool, 3, seededRng(4));
    const id = g.items[0]!.id;
    const t = indexOf(g, id, 'term');
    g.flip(t);
    expect(g.flip(t)).toBe('ignored');
    g.flip(indexOf(g, id, 'meaning'));
    expect(g.flip(t)).toBe('ignored');
    expect(g.flip(99)).toBe('ignored');
    expect(g.isMatched(99)).toBe(false);
  });

  it('firstTry / wrong theo các từ từng lật sai', () => {
    const g = new MemoryGame(pool, 3, seededRng(5));
    const [a, b] = mismatchPair(g);
    g.flip(a);
    g.flip(b);
    g.hideMismatch();
    solve(g);
    const [x, y, z] = g.items.map((i) => i.id);
    expect(g.wrong).toEqual([x, y]);
    expect(g.firstTry).toEqual([z]);
  });

  it('Đèn Pin chỉ một cặp chưa ghép, ưu tiên cặp chưa có thẻ ngửa', () => {
    const g = new MemoryGame(pool, 2, seededRng(6));
    const [first, second] = g.items;
    expect(g.revealPair()).toEqual([indexOf(g, first!.id, 'term'), indexOf(g, first!.id, 'meaning')]);
    g.flip(indexOf(g, first!.id, 'term'));
    expect(g.revealPair()).toEqual([indexOf(g, second!.id, 'term'), indexOf(g, second!.id, 'meaning')]);
    g.flip(indexOf(g, first!.id, 'meaning'));
    // Cặp cuối có một thẻ đang ngửa: vẫn soi cặp đó.
    g.flip(indexOf(g, second!.id, 'meaning'));
    expect(g.revealPair()).toEqual([indexOf(g, second!.id, 'term'), indexOf(g, second!.id, 'meaning')]);
    g.flip(indexOf(g, second!.id, 'term'));
    expect(g.revealPair()).toBeNull();
  });

  it('sao theo CC-15: 3 khi không sai, 2 khi sai ≤ số cặp, còn lại 1; dùng Đèn Pin tối đa 2', () => {
    expect(memoryStars(0, 6)).toBe(3);
    expect(memoryStars(1, 6)).toBe(2);
    expect(memoryStars(6, 6)).toBe(2);
    expect(memoryStars(7, 6)).toBe(1);
    expect(memoryStars(0, 6, true)).toBe(2);
    expect(memoryStars(7, 6, true)).toBe(1);

    const g = new MemoryGame(pool, 3, seededRng(7));
    expect(g.stars()).toBe(3);
    expect(g.stars(true)).toBe(2);
    const [a, b] = mismatchPair(g);
    for (let i = 0; i < 4; i++) {
      g.flip(a);
      g.flip(b);
      g.hideMismatch();
    }
    expect(g.stars()).toBe(1);
  });
});
