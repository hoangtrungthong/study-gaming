import { describe, expect, it } from 'vitest';
import { decks, subjects } from './decks';
import { cardSegments, collectSpeech, speechKey } from './speech';
import { validateDeck } from './validate';
import { phrases } from './phrases';
import type { Deck } from './types';

describe('nội dung bài học', () => {
  it.each(subjects)('bộ %s hợp lệ', (subject) => {
    expect(validateDeck(decks[subject])).toEqual([]);
  });

  it('id không trùng giữa các môn', () => {
    const ids = subjects.flatMap((s) => decks[s].items.map((i) => i.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('validateDeck', () => {
  const base: Deck = {
    subject: 'ja',
    titleVi: 't',
    titleTarget: 't',
    termLang: 'ja',
    items: Array.from({ length: 6 }, (_, i) => ({ id: `ja-${i}`, term: 'ねこ', emoji: '🐱', meaningVi: 'mèo' })),
  };

  it('báo lỗi kanji thiếu reading và hanViet', () => {
    const deck = { ...base, items: [...base.items, { id: 'ja-k', term: '水', emoji: '💧', meaningVi: 'nước' }] };
    const errors = validateDeck(deck);
    expect(errors).toContain('ja/ja-k: từ có kanji phải có reading bằng かな');
    expect(errors).toContain('ja/ja-k: từ có kanji phải có hanViet');
  });

  it('báo lỗi trùng id, sai tiền tố, thiếu ví dụ dịch', () => {
    const deck = {
      ...base,
      items: [
        ...base.items,
        { id: 'ja-0', term: 'いぬ', emoji: '🐶', meaningVi: 'chó', example: 'いぬ' },
        { id: 'en-x', term: 'いぬ', emoji: '🐶', meaningVi: 'chó' },
      ],
    };
    const errors = validateDeck(deck);
    expect(errors).toContain('ja/ja-0: trùng id');
    expect(errors).toContain('ja/ja-0: example và exampleVi phải đi cùng nhau');
    expect(errors).toContain('ja/en-x: id phải bắt đầu bằng "ja-"');
  });

  it('báo lỗi bộ quá ít từ', () => {
    expect(validateDeck({ ...base, items: base.items.slice(0, 2) })).toContain(
      'ja: cần ít nhất 6 từ cho một màn Ghép Đôi',
    );
  });

  it('báo lỗi reading ở môn không phải tiếng Nhật', () => {
    const deck: Deck = {
      ...base,
      subject: 'en',
      termLang: 'en',
      items: base.items.map((i, n) => ({ ...i, id: `en-${n}`, reading: 'x' })),
    };
    expect(validateDeck(deck)[0]).toBe('en/en-0: reading/hanViet chỉ dùng cho tiếng Nhật');
  });
});

describe('giọng đọc', () => {
  it('thẻ kanji đọc theo かな rồi mới đến nghĩa và Hán Việt', () => {
    const mizu = decks.ja.items.find((i) => i.id === 'ja-mizu')!;
    const segs = cardSegments(decks.ja, mizu);
    expect(segs.slice(0, 3)).toEqual([
      { lang: 'ja', text: 'みず' },
      { lang: 'vi', text: 'nước', translation: true },
      { lang: 'vi', text: 'Âm Hán Việt là thủy', translation: true },
    ]);
  });

  it('thuật ngữ IT đọc bằng giọng tiếng Anh', () => {
    const cpu = decks.it.items[0]!;
    expect(cardSegments(decks.it, cpu)[0]).toEqual({ lang: 'en', text: 'CPU' });
  });

  it('danh sách cần tạo âm thanh không trùng và có đủ câu cố định', () => {
    const all = collectSpeech(subjects.map((s) => decks[s]));
    const keys = all.map(speechKey);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toContain(`vi|${phrases.correct}`);
    expect(keys).not.toContain(`vi|${phrases.hanVietPrefix}`);
    // Mọi đoạn của mọi thẻ đều có trong danh sách.
    for (const s of subjects) {
      for (const item of decks[s].items) {
        for (const seg of cardSegments(decks[s], item)) expect(keys).toContain(speechKey(seg));
      }
    }
  });
});
