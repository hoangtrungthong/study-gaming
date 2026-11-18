import { isKanaOnly, primaryAnswer } from './answer';
import type { Deck } from './types';

const KANJI = /[一-龯㐀-䶿]/;

/** Trả về danh sách lỗi của một bộ bài; rỗng là hợp lệ. */
export function validateDeck(deck: Deck): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();

  if (deck.items.length < 6) errors.push(`${deck.subject}: cần ít nhất 6 từ cho một màn Ghép Đôi`);

  for (const item of deck.items) {
    const where = `${deck.subject}/${item.id}`;
    if (ids.has(item.id)) errors.push(`${where}: trùng id`);
    ids.add(item.id);
    if (!item.id.startsWith(`${deck.subject}-`)) errors.push(`${where}: id phải bắt đầu bằng "${deck.subject}-"`);
    for (const field of ['term', 'emoji', 'meaningVi'] as const) {
      if (!item[field]?.trim()) errors.push(`${where}: thiếu ${field}`);
    }
    if (Boolean(item.example) !== Boolean(item.exampleVi)) {
      errors.push(`${where}: example và exampleVi phải đi cùng nhau`);
    }

    if (deck.subject === 'ja') {
      const hasKanji = KANJI.test(item.term);
      if (hasKanji && !item.reading) errors.push(`${where}: từ có kanji phải có reading bằng かな`);
      if (hasKanji && !item.hanViet) errors.push(`${where}: từ có kanji phải có hanViet`);
      if (!isKanaOnly(primaryAnswer(item))) errors.push(`${where}: đáp án phải chỉ gồm かな/カナ`);
    } else if (item.reading || item.hanViet) {
      errors.push(`${where}: reading/hanViet chỉ dùng cho tiếng Nhật`);
    }
  }
  return errors;
}
