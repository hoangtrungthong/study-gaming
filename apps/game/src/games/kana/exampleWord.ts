import { toHiragana } from 'wanakana';
import type { LearnItem } from '@study/content';

/**
 * Từ ví dụ cho một chữ kana (Yêu cầu 7.2): từ đầu tiên trong bộ từ có cách đọc (`reading`, không có thì `term`)
 * bắt đầu bằng chữ đó. Hiragana và katakana coi như nhau (ア khớp あめ). Không có từ nào thì trả `undefined`.
 */
export function exampleWord(items: readonly LearnItem[], char: string): LearnItem | undefined {
  const kana = toHiragana(char);
  return items.find((item) => toHiragana(item.reading ?? item.term).startsWith(kana));
}
