import { describe, expect, it } from 'vitest';
import { decks, type LearnItem } from '@study/content';
import { seededRng } from '../random';
import { ListenGame } from './ListenGame';

const pool = decks.en.items.slice(0, 8);
const item = (id: string, emoji: string): LearnItem => ({ id, term: id, emoji, meaningVi: id });

describe('ListenGame', () => {
  it('đủ số đề, mỗi đề có đáp án trong các lựa chọn, không trùng emoji', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const g = new ListenGame(pool, { rounds: 5, options: 4 }, seededRng(seed));
      expect(g.rounds).toHaveLength(5);
      for (const r of g.rounds) {
        expect(r.options).toHaveLength(4);
        expect(r.options.map((o) => o.id)).toContain(r.answer.id);
        expect(new Set(r.options.map((o) => o.emoji)).size).toBe(4);
      }
    }
  });

  it('nhiễu không mang emoji của đáp án và không trùng emoji với nhau', () => {
    const p = [item('a', '🍎'), item('b', '🍎'), item('c', '🐱'), item('d', '🐱'), item('e', '🐶')];
    for (let seed = 1; seed <= 20; seed++) {
      const g = new ListenGame(p, { rounds: 5, options: 3 }, seededRng(seed));
      for (const r of g.rounds) {
        const emojis = r.options.map((o) => o.emoji);
        expect(new Set(emojis).size).toBe(emojis.length);
        expect(r.options).toHaveLength(3);
      }
    }
  });

  it('lấy nhiễu từ kho riêng khi được truyền vào', () => {
    const g = new ListenGame([item('a', '🍎')], { rounds: 1, options: 3 }, seededRng(1), [
      item('a', '🍎'),
      item('x', '🍎'),
      item('y', '🐱'),
      item('z', '🐶'),
    ]);
    expect(g.round.options.map((o) => o.id).sort()).toEqual(['a', 'y', 'z']);
  });

  it('màn ít từ hơn số đề thì lặp lại, không có hai đề liền nhau trùng từ', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const g = new ListenGame(pool.slice(0, 3), { rounds: 10, options: 3 }, seededRng(seed));
      expect(g.rounds).toHaveLength(10);
      g.rounds.forEach((r, i) => i > 0 && expect(r.answer.id).not.toBe(g.rounds[i - 1]!.answer.id));
    }
    expect(new ListenGame([], { rounds: 3, options: 3 }).rounds).toEqual([]);
    expect(new ListenGame([item('a', '🍎')], { rounds: 2, options: 3 }).rounds).toHaveLength(2);
  });

  it('chọn sai thì loại lựa chọn đó, tính lỗi; chọn đúng thì xong đề', () => {
    const g = new ListenGame(pool, { rounds: 2, options: 4 }, seededRng(2));
    const answer = g.round.answer.id;
    const wrong = g.round.options.filter((o) => o.id !== answer).map((o) => o.id);
    expect(g.choose(wrong[0]!)).toBe('wrong');
    expect(g.disabled.has(wrong[0]!)).toBe(true);
    expect(g.choose(wrong[0]!)).toBe('ignored');
    expect(g.choose('khong-co')).toBe('ignored');
    expect(g.choose(wrong[1]!)).toBe('wrong');
    expect(g.mistakes).toBe(2);
    expect(g.wrong).toEqual([answer]);
    expect(g.choose(answer)).toBe('correct');
    expect(g.solved).toBe(true);
    expect(g.firstTry).toEqual([]);
    expect(g.choose(wrong[2]!)).toBe('ignored');
    expect(g.done).toBe(false);
  });

  it('next chỉ chạy khi đã đúng; đúng ngay lần đầu thì vào firstTry; đề cuối đúng là xong', () => {
    const g = new ListenGame(pool, { rounds: 2, options: 4 }, seededRng(3));
    expect(g.next()).toBe(false);
    const wrongId = g.round.options.find((o) => o.id !== g.round.answer.id)!.id;
    g.choose(wrongId);
    g.choose(g.round.answer.id);
    expect(g.next()).toBe(true);
    expect(g.index).toBe(1);
    expect(g.solved).toBe(false);
    expect(g.disabled.size).toBe(0);
    g.choose(g.round.answer.id);
    expect(g.firstTry).toEqual([g.round.answer.id]);
    expect(g.done).toBe(true);
    expect(g.next()).toBe(false);
  });

  it('một từ sai ở hai đề chỉ ghi vào wrong một lần', () => {
    const p = [item('a', '🍎'), item('b', '🐱')];
    const g = new ListenGame(p, { rounds: 3, options: 2 }, seededRng(1));
    for (let i = 0; i < 3; i++) {
      g.choose(g.round.options.find((o) => o.id !== g.round.answer.id)!.id);
      g.choose(g.round.answer.id);
      g.next();
    }
    expect(g.wrong.sort()).toEqual(['a', 'b']);
    expect(g.mistakes).toBe(3);
  });

  it('Đèn Pin loại một lựa chọn sai, không bao giờ loại đáp án, hết thì trả null', () => {
    const g = new ListenGame(pool, { rounds: 1, options: 4 }, seededRng(4));
    const answer = g.round.answer.id;
    const removed: string[] = [];
    expect(g.canEliminate).toBe(true);
    for (let i = 0; i < 3; i++) {
      const id = g.eliminateWrong();
      expect(id).not.toBeNull();
      expect(id).not.toBe(answer);
      removed.push(id!);
    }
    expect(new Set(removed).size).toBe(3);
    expect(g.canEliminate).toBe(false);
    expect(g.eliminateWrong()).toBeNull();
    expect(g.mistakes).toBe(0);
    g.choose(answer);
    expect(g.firstTry).toEqual([answer]);
    expect(g.eliminateWrong()).toBeNull();
    expect(g.canEliminate).toBe(false);
  });

  it('từ lặp lại: đúng ngay rồi lượt sau sai thì bỏ khỏi firstTry; mỗi từ chỉ một lần', () => {
    const p = [item('a', '🍎'), item('b', '🐱'), item('c', '🐶')];
    const g = new ListenGame(p, { rounds: 6, options: 2 }, seededRng(3));
    const seen: Record<string, number> = {};
    let missedOnce = '';
    while (!g.done) {
      const answer = g.round.answer.id;
      seen[answer] = (seen[answer] ?? 0) + 1;
      // Lần thứ hai gặp một từ đã đúng ngay: cố tình chọn sai.
      if (!missedOnce && seen[answer] === 2 && g.firstTry.includes(answer)) {
        g.choose(g.round.options.find((o) => o.id !== answer)!.id);
        missedOnce = answer;
      }
      g.choose(answer);
      if (g.done) break;
      g.next();
    }
    expect(missedOnce).not.toBe('');
    expect(g.firstTry).not.toContain(missedOnce);
    expect(g.wrong).toEqual([missedOnce]);
    expect(new Set(g.firstTry).size).toBe(g.firstTry.length);
  });
});
