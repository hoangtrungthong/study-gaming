import { describe, expect, it } from 'vitest';
import { findKana, loadKanaStrokes } from './kana';
import { validateKanaStrokes } from './validate';

describe('dữ liệu nét kana', () => {
  it('nạp lazy được 92 chữ, chữ nào cũng hợp lệ', async () => {
    const kana = await loadKanaStrokes();
    expect(kana).toHaveLength(92);
    expect(kana.flatMap(validateKanaStrokes)).toEqual([]);
  });

  it('tìm chữ theo ký tự', async () => {
    const kana = await loadKanaStrokes();
    expect(findKana(kana, 'あ')?.romaji).toBe('a');
    expect(findKana(kana, 'ア')?.strokes).toHaveLength(2);
    expect(findKana(kana, 'x')).toBeUndefined();
  });
});
