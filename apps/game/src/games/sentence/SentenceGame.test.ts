import { describe, expect, it } from 'vitest';
import type { Sentence } from '@study/content';
import { SENTENCE_CONFIG } from '../ageConfig';
import { seededRng } from '../random';
import { SentenceGame } from './SentenceGame';

const s = (id: string, chunks: string[], extra: Partial<Sentence> = {}): Sentence => ({
  id,
  chunks,
  textVi: id,
  ...extra,
});

/** Đặt các khối theo đúng `order` (chữ) vào các chỗ. */
function fill(g: SentenceGame, order: readonly string[]) {
  const used = new Set<number>();
  order.forEach((text, slot) => {
    const piece = g.pieces.findIndex((p, i) => p.text === text && !used.has(i));
    used.add(piece);
    g.place(piece, slot);
  });
}

const one = (sentence: Sentence, age: 'mam' | 'choi' | 'cay' = 'choi', seed = 1) =>
  new SentenceGame([sentence], SENTENCE_CONFIG[age], seededRng(seed));

describe('SentenceGame', () => {
  it('chọn câu theo nhóm tuổi: lọc số khối, lấy đủ số câu, thiếu thì dùng câu có', () => {
    const pool = [
      s('a', ['1', '2']),
      s('b', ['1', '2', '3']),
      s('c', ['1', '2', '3', '4']),
      s('d', ['x', 'y']),
      s('e', ['p', 'q', 'r']),
      s('f', ['m', 'n']),
    ];
    const mam = new SentenceGame(pool, SENTENCE_CONFIG.mam, seededRng(3));
    expect(mam.sentences).toHaveLength(4);
    expect(mam.sentences.every((x) => x.chunks.length <= 3)).toBe(true);
    const choi = new SentenceGame(pool, SENTENCE_CONFIG.choi, seededRng(3));
    expect(choi.sentences).toHaveLength(5);
    expect(new SentenceGame(pool.slice(0, 2), SENTENCE_CONFIG.cay).sentences).toHaveLength(2);
    // Không câu nào đủ ngắn: vẫn chơi bằng câu có sẵn.
    expect(new SentenceGame([s('long', ['1', '2', '3', '4'])], SENTENCE_CONFIG.mam).sentences).toHaveLength(1);
  });

  it('khay là các khối đã xáo, không bao giờ đúng thứ tự sẵn; số chỗ bằng số khối', () => {
    for (let seed = 0; seed < 30; seed++) {
      const g = one(s('a', ['I', 'like', 'apples']), 'choi', seed);
      expect(g.slots).toEqual([null, null, null]);
      expect(g.tray).toEqual([true, true, true]);
      expect(g.pieces.map((p) => p.text).sort()).toEqual(['I', 'apples', 'like']);
      expect(g.pieces.map((p) => p.text)).not.toEqual(['I', 'like', 'apples']);
    }
  });

  it('nhóm Cây có thêm 1 khối nhiễu khi câu có; nhóm khác thì không', () => {
    const withD = s('a', ['本を', 'よみます'], { readings: ['ほんを', null], distractors: ['たべます'] });
    const cay = one(withD, 'cay');
    expect(cay.pieces).toHaveLength(3);
    expect(cay.pieces.find((p) => p.chunk === null)).toEqual({ text: 'たべます', reading: null, chunk: null });
    expect(cay.pieces.find((p) => p.text === '本を')!.reading).toBe('ほんを');
    expect(cay.slots).toHaveLength(2);
    expect(one(withD, 'choi').pieces).toHaveLength(2);
    expect(one(s('b', ['a', 'b']), 'cay').pieces).toHaveLength(2);
  });

  it('khối nhiễu đứng đầu khay vẫn không làm câu tự đúng sẵn', () => {
    for (let seed = 0; seed < 40; seed++) {
      const g = one(s('a', ['x', 'y'], { distractors: ['z'] }), 'cay', seed);
      expect(g.pieces.filter((p) => p.chunk !== null).map((p) => p.text)).toEqual(['y', 'x']);
    }
  });

  it('đặt, chuyển chỗ, đẩy khối cũ về khay, gỡ về khay; bỏ qua chỉ số sai', () => {
    const g = one(s('a', ['a', 'b', 'c']));
    g.place(0, 0);
    expect(g.slots).toEqual([0, null, null]);
    expect(g.tray[0]).toBe(false);
    g.place(0, 2); // chuyển chỗ
    expect(g.slots).toEqual([null, null, 0]);
    g.place(0, 2); // cùng chỗ: không đổi
    expect(g.slotOf(0)).toBe(2);
    g.place(1, 2); // chỗ có khối: khối cũ về khay
    expect(g.slots).toEqual([null, null, 1]);
    expect(g.tray[0]).toBe(true);
    g.place(9, 0);
    g.place(0, 5);
    g.place(0, -1);
    expect(g.slots).toEqual([null, null, 1]);
    g.remove(0); // chỗ trống: không làm gì
    g.remove(7);
    g.remove(2);
    expect(g.slots).toEqual([null, null, null]);
    expect(g.tray).toEqual([true, true, true]);
    expect(g.full).toBe(false);
  });

  it('xếp đúng thứ tự chuẩn thì đúng, đúng ngay lần đầu; sang câu mới rồi hết', () => {
    const g = new SentenceGame([s('a', ['a', 'b']), s('b', ['c', 'd'])], SENTENCE_CONFIG.choi, seededRng(2));
    const first = g.current!;
    fill(g, first.chunks);
    expect(g.full).toBe(true);
    expect(g.allCorrect()).toBe(true);
    expect(g.submit()).toEqual({ ok: true, wrongSlots: [] });
    expect(g.firstTry).toEqual([first.id]);
    g.next();
    expect(g.index).toBe(1);
    fill(g, g.current!.chunks);
    expect(g.submit().ok).toBe(true);
    g.next();
    expect(g.done).toBe(true);
    expect(g.current).toBeUndefined();
    expect(g.slots).toEqual([]);
    expect(g.full).toBe(false);
    g.next();
    expect(g.index).toBe(2);
  });

  it('thứ tự trong accept cũng đúng', () => {
    const g = one(
      s('a', ['きのう', 'りんごを', 'たべました'], { accept: [['りんごを', 'きのう', 'たべました'], ['x']] }),
    );
    fill(g, ['りんごを', 'きのう', 'たべました']);
    expect(g.submit().ok).toBe(true);
  });

  it('sai thì báo chỗ sai, khối sai về khay, tính lỗi; câu đó vào danh sách sai, không phải đúng lần đầu', () => {
    const g = one(s('a', ['a', 'b', 'c']));
    fill(g, ['a', 'c', 'b']);
    expect(g.submit()).toEqual({ ok: false, wrongSlots: [1, 2] });
    expect(g.slots[0]).not.toBeNull();
    expect(g.slots.slice(1)).toEqual([null, null]);
    expect(g.mistakes).toBe(1);
    expect(g.sentenceMistakes).toBe(1);
    // Chỗ trống cũng là sai.
    expect(g.submit().wrongSlots).toEqual([1, 2]);
    expect(g.wrong).toEqual(['a']);
    fill(g, ['a', 'b', 'c']);
    expect(g.submit().ok).toBe(true);
    expect(g.firstTry).toEqual([]);
    expect(g.mistakes).toBe(2);
  });

  it('khối nhiễu đặt vào chỗ là sai', () => {
    const g = one(s('a', ['x', 'y'], { distractors: ['z'] }), 'cay');
    fill(g, ['x', 'z']);
    expect(g.submit()).toEqual({ ok: false, wrongSlots: [1] });
    expect(g.tray[g.pieces.findIndex((p) => p.text === 'z')]).toBe(true);
  });

  it('hai khối cùng chữ: đổi chỗ cho nhau vẫn đúng', () => {
    const g = one(s('a', ['ne', 'ne', 'yo']));
    const nes = g.pieces.flatMap((p, i) => (p.text === 'ne' ? [i] : []));
    g.place(nes[1]!, 0);
    g.place(nes[0]!, 1);
    g.place(
      g.pieces.findIndex((p) => p.text === 'yo'),
      2,
    );
    expect(g.submit().ok).toBe(true);
  });

  it('Đèn Pin đặt đúng một khối vào chỗ trống / sai đầu tiên; đã dùng thì không tính đúng lần đầu', () => {
    const g = one(s('a', ['a', 'b', 'c']));
    expect(g.placeOneCorrect()).toBe(0);
    expect(g.pieces[g.slots[0]!]!.text).toBe('a');
    // Chỗ 1 đang sai ('c'), khối đúng 'b' nằm trong khay.
    g.place(
      g.pieces.findIndex((p) => p.text === 'c'),
      1,
    );
    expect(g.placeOneCorrect()).toBe(1);
    expect(g.pieces[g.slots[1]!]!.text).toBe('b');
    expect(g.placeOneCorrect()).toBe(2);
    expect(g.placeOneCorrect()).toBeNull();
    expect(g.submit().ok).toBe(true);
    expect(g.firstTry).toEqual([]);
  });

  it('Đèn Pin lấy khối đang nằm sai chỗ khi khay không còn khối cần', () => {
    const g = one(s('a', ['a', 'b']));
    fill(g, ['b', 'a']);
    expect(g.placeOneCorrect()).toBe(0);
    expect(g.pieces[g.slots[0]!]!.text).toBe('a');
    expect(g.slots[1]).toBeNull();
  });

  it('Đèn Pin theo thứ tự accept khớp nhiều hơn; accept có chữ lạ (dữ liệu sai) thì không đặt', () => {
    const g = one(s('a', ['a', 'b', 'c'], { accept: [['b', 'a', 'c']] }));
    g.place(
      g.pieces.findIndex((p) => p.text === 'b'),
      0,
    );
    expect(g.placeOneCorrect()).toBe(1);
    expect(g.pieces[g.slots[1]!]!.text).toBe('a');

    const bad = one(s('b', ['a', 'b', 'c'], { accept: [['a', 'c', 'x']] }));
    fill(bad, ['a', 'c']);
    expect(bad.placeOneCorrect()).toBeNull();
  });
});
