import { describe, expect, it } from 'vitest';
import {
  acceptedAnswers,
  expandLongVowels,
  isCorrectAnswer,
  normalizeJapanese,
  normalizeLatin,
  romajiPreview,
} from './answer';
import type { LearnItem } from './types';

const item = (over: Partial<LearnItem>): LearnItem => ({
  id: 'x-1',
  term: 'apple',
  emoji: '🍎',
  meaningVi: 'táo',
  ...over,
});

describe('normalizeLatin', () => {
  it('bỏ hoa thường, dấu câu và khoảng trắng thừa', () => {
    expect(normalizeLatin('  Thank   You! ')).toBe('thank you');
  });
  it('đổi dấu nháy cong thành nháy thẳng', () => {
    expect(normalizeLatin('I’m')).toBe("i'm");
  });
  it('đổi chữ toàn độ rộng về thường', () => {
    expect(normalizeLatin('ＣＰＵ')).toBe('cpu');
  });
});

describe('normalizeJapanese', () => {
  it.each([
    ['futatsu', 'ふたつ'],
    ['futatu', 'ふたつ'],
    ['ふたつ', 'ふたつ'],
    ['フタツ', 'ふたつ'],
    ['ﾌﾀﾂ', 'ふたつ'],
    ['FUTATSU', 'ふたつ'],
    ['hon', 'ほん'],
    ['shi', 'し'],
    ['si', 'し'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeJapanese(input)).toBe(expected);
  });

  it('kéo dài nguyên âm cho cả katakana, romaji và dấu gạch', () => {
    expect(normalizeJapanese('コーヒー')).toBe('こおひい');
    expect(normalizeJapanese('koohii')).toBe('こおひい');
    expect(normalizeJapanese('ko-hi-')).toBe('こおひい');
  });

  it('bỏ khoảng trắng và dấu câu', () => {
    expect(normalizeJapanese('あり が とう。')).toBe('ありがとう');
  });
});

describe('expandLongVowels', () => {
  it('giữ nguyên ー đứng đầu', () => {
    expect(expandLongVowels('ーあ')).toBe('ーあ');
  });
});

describe('isCorrectAnswer', () => {
  it('tiếng Nhật: đáp án là reading, nhận romaji và かな', () => {
    const mizu = item({ id: 'ja-mizu', term: '水', reading: 'みず' });
    expect(isCorrectAnswer('ja', mizu, 'mizu')).toBe(true);
    expect(isCorrectAnswer('ja', mizu, 'みず')).toBe(true);
    expect(isCorrectAnswer('ja', mizu, 'ミズ')).toBe(true);
    expect(isCorrectAnswer('ja', mizu, '水')).toBe(false);
    expect(isCorrectAnswer('ja', mizu, 'mizuu')).toBe(false);
  });

  it('tiếng Nhật: nhận cả kiểu gõ ん bằng `nn` (bộ gõ) lẫn `n` (Hepburn)', () => {
    const ringo = item({ id: 'ja-r', term: 'りんご' });
    const sensei = item({ id: 'ja-s', term: '先生', reading: 'せんせい' });
    const hon = item({ id: 'ja-h', term: '本', reading: 'ほん' });
    for (const typed of ['ringo', 'rinngo']) expect(isCorrectAnswer('ja', ringo, typed)).toBe(true);
    for (const typed of ['sensei', 'sennsei']) expect(isCorrectAnswer('ja', sensei, typed)).toBe(true);
    for (const typed of ['hon', 'honn']) expect(isCorrectAnswer('ja', hon, typed)).toBe(true);
    expect(isCorrectAnswer('ja', ringo, 'rinnngo')).toBe(false);
  });

  it('xem trước theo kiểu bộ gõ khớp với cách chấm', () => {
    expect(romajiPreview('rinngo')).toBe('りんご');
    expect(romajiPreview('konnnichiha')).toBe('こんにちは');
  });

  it('tiếng Nhật: nhận cách gõ thay thế (こんにちわ)', () => {
    const hi = item({ id: 'ja-k', term: 'こんにちは', accept: ['こんにちわ'] });
    expect(isCorrectAnswer('ja', hi, 'konnichiha')).toBe(true);
    expect(isCorrectAnswer('ja', hi, 'konnichiwa')).toBe(true);
  });

  it('tiếng Anh/IT: không phân biệt hoa thường, nhận accept', () => {
    const cpu = item({ term: 'CPU' });
    expect(isCorrectAnswer('it', cpu, 'cpu')).toBe(true);
    const ty = item({ term: 'thank you', accept: ['thanks'] });
    expect(isCorrectAnswer('en', ty, 'Thanks')).toBe(true);
    expect(isCorrectAnswer('en', ty, 'thank')).toBe(false);
  });

  it('chuỗi rỗng không bao giờ đúng', () => {
    expect(isCorrectAnswer('en', item({}), '   ')).toBe(false);
  });
});

describe('acceptedAnswers', () => {
  it('bỏ trùng sau khi chuẩn hoá', () => {
    expect(acceptedAnswers('ja', item({ term: 'ねこ', accept: ['ネコ', 'neko'] }))).toEqual(['ねこ']);
  });
});

describe('romajiPreview', () => {
  it('đổi romaji sang かな khi đang gõ, giữ n cuối', () => {
    expect(romajiPreview('futa')).toBe('ふた');
    expect(romajiPreview('hon')).toBe('ほn');
  });
  it('giữ nguyên chữ đã là かな', () => {
    expect(romajiPreview('ねこ')).toBe('ねこ');
  });
});
