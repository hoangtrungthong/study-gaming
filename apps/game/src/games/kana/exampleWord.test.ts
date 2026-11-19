import { describe, expect, it } from 'vitest';
import { decks, type LearnItem } from '@study/content';
import { exampleWord } from './exampleWord';

const item = (id: string, term: string, reading?: string): LearnItem =>
  ({ id, term, reading, meaningVi: id, emoji: '' }) as LearnItem;

describe('exampleWord', () => {
  it('lấy từ đầu tiên có cách đọc bắt đầu bằng chữ kana', () => {
    expect(exampleWord(decks.ja.items, 'あ')?.term).toBe('ありがとう');
    expect(exampleWord(decks.ja.items, 'い')?.term).toBe('いぬ');
  });

  it('dùng reading khi có (kanji), không thì term', () => {
    const items = [item('a', '水', 'みず'), item('b', 'みかん')];
    expect(exampleWord(items, 'み')?.id).toBe('a');
    expect(exampleWord(items, '水')).toBeUndefined();
  });

  it('coi hiragana và katakana như nhau', () => {
    const items = [item('tv', 'テレビ'), item('neko', 'ねこ')];
    expect(exampleWord(items, 'て')?.id).toBe('tv');
    expect(exampleWord(items, 'ネ')?.id).toBe('neko');
  });

  it('không có từ nào thì trả undefined', () => {
    expect(exampleWord(decks.ja.items, 'ん')).toBeUndefined();
    expect(exampleWord([], 'あ')).toBeUndefined();
  });
});
