import { describe, expect, it } from 'vitest';
import { decks } from './decks';
import { collectSpeech, speechKey, termLetters } from './speech';
import type { Deck } from './types';

describe('chữ cái cho Đèn Pin của Viết Lại Từ', () => {
  const deck: Deck = {
    subject: 'en',
    titleVi: 't',
    titleTarget: 't',
    termLang: 'en',
    items: [
      { id: 'en-a', term: 'Thank you', emoji: '🙏', meaningVi: 'cảm ơn' },
      { id: 'en-b', term: 'wi-fi 2', emoji: '📶', meaningVi: 'wifi' },
    ],
  };

  it('chữ cái khác nhau, viết thường, chỉ chữ cái, theo thứ tự chữ cái', () => {
    expect(termLetters(deck)).toEqual(['a', 'f', 'h', 'i', 'k', 'n', 'o', 't', 'u', 'w', 'y']);
    // Tiếng Nhật: từng かな của cách đọc, gồm chữ nhỏ và ー (Đèn Pin có thể hiện bất kỳ chữ nào của đáp án).
    const ja = termLetters(decks.ja);
    for (const item of decks.ja.items) for (const c of item.reading ?? item.term) expect(ja).toContain(c);
    expect(ja.some((c) => /\p{Script=Han}/u.test(c))).toBe(false);
  });

  it('danh sách âm thanh có mọi chữ cái của từ tiếng Anh / IT, giọng của bộ; tiếng Nhật không thêm', () => {
    const keys = collectSpeech([decks.en, decks.it, decks.ja]).map(speechKey);
    for (const d of [decks.en, decks.it]) {
      for (const item of d.items) {
        for (const c of item.term.toLowerCase().replace(/[^a-z]/g, '')) expect(keys).toContain(`${d.termLang}|${c}`);
      }
    }
    // Từ IT viết hoa (CPU) vẫn có chữ thường.
    expect(keys).toContain('en|c');
    expect(keys).not.toContain('en|C');
    expect(new Set(keys).size).toBe(keys.length);
  });
});
