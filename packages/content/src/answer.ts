import { isKana, toHiragana, toRomaji } from 'wanakana';
import type { LearnItem, Subject } from './types';

const KANA_VOWEL: Record<string, string> = { a: 'あ', i: 'い', u: 'う', e: 'え', o: 'お' };

/** Thay dấu kéo dài ー bằng nguyên âm của chữ đứng trước: こーひー → こおひい, コー → コお. */
export function expandLongVowels(kana: string): string {
  let out = '';
  for (const ch of kana) {
    if (ch === 'ー' && out.length > 0) {
      const vowel = KANA_VOWEL[toRomaji(out.slice(-1)).slice(-1)];
      out += vowel ?? ch;
    } else {
      out += ch;
    }
  }
  return out;
}

/** Chuẩn hoá chữ Latin: không phân biệt hoa thường, bỏ dấu câu và khoảng trắng thừa. */
export function normalizeLatin(input: string): string {
  return input
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .replace(/[.,!?;:]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Chuẩn hoá tiếng Nhật về hiragana để so sánh: nhận romaji (`futatsu`),
 * hiragana, katakana (kể cả nửa độ rộng) và dấu kéo dài.
 */
export function normalizeJapanese(input: string): string {
  return japaneseReadings(input)[0]!;
}

/**
 * Các cách hiểu của chuỗi tiếng Nhật người học gõ. Romaji có hai kiểu gõ ん:
 * kiểu bộ gõ (`nn`: `rinngo` → りんご) và kiểu Hepburn (`n` trước phụ âm: `konnichiha` → こんにちは).
 * Nhận cả hai, nên trả về một hoặc hai cách đọc.
 */
export function japaneseReadings(input: string): string[] {
  const text = input
    .normalize('NFKC')
    .replace(/\s+/g, '')
    .replace(/[。、！？!?.,]/g, '')
    .toLowerCase();
  // Với かな/カナ thì tự kéo dài ー, vì wanakana đổi コーヒー thành こうひい, lệch với romaji `koohii` → こおひい.
  const finish = (kana: string) => toHiragana(expandLongVowels(kana));
  if (!/[a-z-]/.test(text)) return [finish(text)];
  const hepburn = finish(toHiragana(text));
  // Kiểu bộ gõ: `n` đứng cuối vẫn là ん.
  const ime = finish(toHiragana(text, { IMEMode: true }).replace(/n$/, 'ん'));
  return [...new Set([hepburn, ime])];
}

export function normalizeAnswer(subject: Subject, input: string): string {
  return subject === 'ja' ? normalizeJapanese(input) : normalizeLatin(input);
}

/** Đáp án người học phải gõ: tiếng Nhật dùng cách đọc かな, môn khác dùng chính từ đó. */
export function primaryAnswer(item: LearnItem): string {
  return item.reading ?? item.term;
}

export function acceptedAnswers(subject: Subject, item: LearnItem): string[] {
  const all = [primaryAnswer(item), ...(item.accept ?? [])];
  return [...new Set(all.map((a) => normalizeAnswer(subject, a)))];
}

export function isCorrectAnswer(subject: Subject, item: LearnItem, input: string): boolean {
  const typed = subject === 'ja' ? japaneseReadings(input) : [normalizeLatin(input)];
  const accepted = acceptedAnswers(subject, item);
  return typed.some((t) => t !== '' && accepted.includes(t));
}

/**
 * Xem trước khi gõ romaji, theo kiểu bộ gõ: `futa` → `ふた`, `rinngo` → `りんご`.
 * Giữ nguyên chữ `n` cuối để người gõ còn gõ tiếp `na`, `ni`…
 */
export function romajiPreview(input: string): string {
  if (!/[a-z]/i.test(input)) return input;
  return toHiragana(input.toLowerCase(), { IMEMode: true });
}

export function isKanaOnly(text: string): boolean {
  return isKana(text.replace(/\s+/g, ''));
}
