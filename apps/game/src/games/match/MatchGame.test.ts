import { describe, expect, it } from 'vitest';
import { decks } from '@study/content';
import { seededRng } from '../random';
import { MatchGame } from './MatchGame';

const pool = decks.en.items;

describe('MatchGame', () => {
  it('lấy đúng số cặp, hai cột cùng tập từ', () => {
    const g = new MatchGame(pool, 4, seededRng(1));
    expect(g.left).toHaveLength(4);
    expect(new Set(g.right.map((i) => i.id))).toEqual(new Set(g.left.map((i) => i.id)));
  });

  it('ghép đúng thì đánh dấu, ghép sai thì tính lỗi', () => {
    const g = new MatchGame(pool, 3, seededRng(2));
    const [a, b] = g.left;
    expect(g.selectRight(a!.id)).toBe('ignored'); // chưa chọn bên trái
    g.selectLeft(a!.id);
    expect(g.selectRight(b!.id)).toBe('wrong');
    expect(g.mistakes).toBe(1);
    expect(g.selectRight(a!.id)).toBe('match');
    expect(g.matched.has(a!.id)).toBe(true);
    expect(g.selected).toBeNull();
  });

  it('bỏ qua chọn lại từ đã ghép, từ lạ, và chạm lần hai để bỏ chọn', () => {
    const g = new MatchGame(pool, 3, seededRng(3));
    const a = g.left[0]!;
    g.selectLeft(a.id);
    g.selectLeft(a.id);
    expect(g.selected).toBeNull();
    g.selectLeft('khong-co');
    expect(g.selected).toBeNull();
    g.selectLeft(a.id);
    g.selectRight(a.id);
    expect(g.selectLeft(a.id)).toBe('ignored');
    expect(g.selected).toBeNull();
    g.selectLeft(g.left[1]!.id);
    expect(g.selectRight(a.id)).toBe('ignored');
  });

  it('xong màn và chấm sao theo số lần sai', () => {
    const play = (mistakes: number) => {
      const g = new MatchGame(pool, 3, seededRng(4));
      const wrongTarget = g.left[1]!.id;
      g.selectLeft(g.left[0]!.id);
      for (let i = 0; i < mistakes; i++) g.selectRight(wrongTarget);
      for (const item of g.left) {
        if (g.selected !== item.id) g.selectLeft(item.id);
        g.selectRight(item.id);
      }
      expect(g.done).toBe(true);
      return g.stars;
    };
    expect(play(0)).toBe(3);
    expect(play(2)).toBe(2);
    expect(play(3)).toBe(1);
  });

  it('không lấy quá số từ có trong bộ', () => {
    expect(new MatchGame(pool.slice(0, 2), 5).left).toHaveLength(2);
  });
});
