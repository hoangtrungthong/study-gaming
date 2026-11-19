import { describe, expect, it } from 'vitest';
import type { LearnItem } from '@study/content';
import { seededRng } from '../random';
import { REVEAL_ALL_AFTER, REVEAL_FIRST_AFTER, WRITE_ROUNDS, WriteGame } from './WriteGame';

const item = (id: string, term: string, reading?: string): LearnItem => ({
  id,
  term,
  ...(reading ? { reading } : {}),
  emoji: '⭐',
  meaningVi: id,
});

const en = [item('en-cat', 'cat'), item('en-dog', 'dog'), item('en-sun', 'sun')];
const states = (g: WriteGame, input: string) => g.boxes(input).map((b) => b.state);

describe('WriteGame', () => {
  it('lấy tối đa số từ theo nhóm tuổi, không trùng, và không vượt số từ của màn', () => {
    expect(WRITE_ROUNDS).toEqual({ mam: 3, choi: 4, cay: 5 });
    expect([REVEAL_FIRST_AFTER, REVEAL_ALL_AFTER]).toEqual([2, 3]);
    const g = new WriteGame('en', en, 2, 'recall', seededRng(1));
    expect(g.rounds).toHaveLength(2);
    expect(new Set(g.rounds.map((i) => i.id)).size).toBe(2);
    expect(g.mode).toBe('recall');
    expect(new WriteGame('en', en, 10, 'copy', seededRng(1)).rounds).toHaveLength(3);
  });

  it('gõ đúng không phân biệt hoa thường và khoảng trắng; ô trống thì bỏ qua', () => {
    const g = new WriteGame('en', en, 3, 'copy', seededRng(2));
    expect(g.check('   ')).toBe('ignored');
    expect(g.check(` ${g.item.term.toUpperCase()} `)).toBe('correct');
    expect(g.solved).toBe(true);
    // Đã đúng thì gõ nữa cũng không tính.
    expect(g.check('xyz')).toBe('ignored');
    expect(g.firstTry).toEqual([g.item.id]);
  });

  it('ô chữ: mỗi chữ một ô, gõ đúng thì xanh, sai thì đỏ; mức Chép hiện chữ mờ, mức Nhớ thì không', () => {
    const copy = new WriteGame('en', [item('en-cat', 'Cat')], 1, 'copy');
    expect(copy.chars).toEqual(['C', 'a', 't']);
    expect(copy.boxes('cx')).toEqual([
      { char: 'C', state: 'ok', typed: 'c', ghost: true },
      { char: 'a', state: 'bad', typed: 'x', ghost: true },
      { char: 't', state: 'empty', typed: '', ghost: true },
    ]);
    const recall = new WriteGame('en', [item('en-thanks', 'thank you')], 1, 'recall');
    expect(recall.boxes('')[0]!.ghost).toBe(false);
    // Khoảng trắng giữa hai từ là ô trống riêng, không chấm.
    expect(states(recall, 'thank')).toEqual(['ok', 'ok', 'ok', 'ok', 'ok', 'space', 'empty', 'empty', 'empty']);
  });

  it('ô chữ tiếng Nhật: mỗi かな một ô; nhận romaji (bộ gõ và Hepburn), カナ và dấu kéo dài', () => {
    const neko = new WriteGame('ja', [item('ja-neko', 'ねこ')], 1, 'copy');
    // `n` cuối còn chờ gõ tiếp, chưa thành chữ.
    expect(states(neko, 'n')).toEqual(['empty', 'empty']);
    expect(states(neko, 'ne')).toEqual(['ok', 'empty']);
    expect(states(neko, 'nek')).toEqual(['ok', 'empty']);
    expect(states(neko, 'neka')).toEqual(['ok', 'bad']);
    expect(neko.boxes('neka')[1]!.typed).toBe('か');
    const hello = new WriteGame('ja', [item('ja-konnichiwa', 'こんにちは')], 1, 'recall');
    expect(states(hello, 'konnichiha')).toEqual(['ok', 'ok', 'ok', 'ok', 'ok']);
    expect(states(hello, 'konnnichiha')).toEqual(['ok', 'ok', 'ok', 'ok', 'ok']);
    const coffee = new WriteGame('ja', [item('ja-koohii', 'コーヒー')], 1, 'recall');
    expect(states(coffee, 'koohii')).toEqual(['ok', 'ok', 'ok', 'ok']);
    expect(states(coffee, 'こーひー')).toEqual(['ok', 'ok', 'ok', 'ok']);
  });

  it('gõ sai thì đếm lỗi từng từ và cả lượt, ghi id sai một lần; sai 2 lần hiện chữ đầu, 3 lần hiện cả từ', () => {
    const g = new WriteGame('en', en, 3, 'recall', seededRng(3));
    const first = g.item;
    expect(g.check('zzz')).toBe('wrong');
    expect(g.revealCount).toBe(0);
    expect(g.check('yyy')).toBe('wrong');
    expect(g.revealCount).toBe(1);
    expect(g.boxes('')[0]).toMatchObject({ state: 'empty', ghost: true });
    expect(g.boxes('')[1]!.ghost).toBe(false);
    expect(g.check('xxx')).toBe('wrong');
    expect(g.revealCount).toBe(3);
    expect(g.canHint).toBe(false);
    expect(g.roundMistakes).toBe(3);
    expect(g.wrong).toEqual([first.id]);
    expect(g.check(first.term)).toBe('correct');
    expect(g.firstTry).toEqual([]);
    expect(g.next()).toBe(true);
    expect(g.roundMistakes).toBe(0);
    expect(g.revealCount).toBe(0);
    expect(g.check('zzz')).toBe('wrong');
    expect(g.mistakes).toBe(4);
  });

  it('tiếng Nhật nhận かな, カナ và romaji (cả kiểu bộ gõ nn); từ có kanji gõ cách đọc', () => {
    const ringo = [item('ja-ringo', 'りんご')];
    expect(new WriteGame('ja', ringo, 1, 'copy').check('りんご')).toBe('correct');
    expect(new WriteGame('ja', ringo, 1, 'copy').check('リンゴ')).toBe('correct');
    expect(new WriteGame('ja', ringo, 1, 'copy').check('ringo')).toBe('correct');
    expect(new WriteGame('ja', ringo, 1, 'copy').check('rinngo')).toBe('correct');
    expect(new WriteGame('ja', ringo, 1, 'copy').check('ringa')).toBe('wrong');
    const g = new WriteGame('ja', [item('ja-mizu', '水', 'みず')], 1, 'recall');
    expect(g.answer).toBe('みず');
    expect(g.chars).toEqual(['み', 'ず']);
    expect(g.check('水')).toBe('wrong');
    expect(g.check('mizu')).toBe('correct');
  });

  it('Đèn Pin hiện chữ tiếp theo sau phần đã gõ đúng, nhảy qua khoảng trắng; hết chữ thì thôi', () => {
    const g = new WriteGame('en', [item('en-thanks', 'thank you'), item('en-cat', 'cat')], 2, 'recall', seededRng(4));
    while (g.item.id !== 'en-thanks') {
      g.check(g.item.term);
      g.next();
    }
    expect(g.hint('')).toBe('t');
    expect(g.revealCount).toBe(1);
    // Đã gõ đúng `tha` thì gợi ý chữ thứ 4.
    expect(g.hint('tha')).toBe('n');
    expect(g.revealCount).toBe(4);
    expect(g.hint('')).toBe('k');
    // Ô kế tiếp là khoảng trắng thì hiện luôn chữ sau nó.
    expect(g.hint('')).toBe('y');
    expect(g.revealCount).toBe(7);
    expect(g.hint('thank you')).toBe('u');
    expect(g.canHint).toBe(false);
    expect(g.hint('')).toBeNull();
    expect(g.check('thank you')).toBe('correct');
    expect(g.firstTry).not.toContain('en-thanks');
  });

  it('chỉ sang từ sau khi đã đúng; từ cuối đúng thì xong', () => {
    const g = new WriteGame('en', en.slice(0, 2), 2, 'copy', seededRng(5));
    expect(g.next()).toBe(false);
    g.check(g.item.term);
    expect(g.done).toBe(false);
    expect(g.next()).toBe(true);
    expect(g.index).toBe(1);
    g.check(g.item.term);
    expect(g.done).toBe(true);
    expect(g.canHint).toBe(false);
    expect(g.next()).toBe(false);
    expect(g.firstTry).toHaveLength(2);
  });
});
