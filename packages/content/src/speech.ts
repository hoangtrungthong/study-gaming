import { phrases } from './phrases';
import type { Deck, LearnItem, SpeechLang, SpeechSegment } from './types';

/** Đoạn đọc riêng từ đang học. Tiếng Nhật đọc theo かな để giọng máy không đọc sai kanji. */
export function termSegment(deck: Deck, item: LearnItem): SpeechSegment {
  return { lang: deck.termLang, text: item.reading ?? item.term };
}

export function viSegment(text: string): SpeechSegment {
  return { lang: 'vi', text };
}

/** Dòng tiếng Việt dịch hoặc giải thích nội dung (khác lời hướng dẫn của Tomo). */
export function translationSegment(text: string): SpeechSegment {
  return { lang: 'vi', text, translation: true };
}

export function hanVietText(hanViet: string): string {
  return `${phrases.hanVietPrefix} ${hanViet.toLocaleLowerCase('vi')}`;
}

/** Thứ tự Tomo đọc một thẻ kiến thức: từ → nghĩa → Hán Việt → ví dụ → dịch ví dụ → giải thích. */
export function cardSegments(deck: Deck, item: LearnItem): SpeechSegment[] {
  const out: SpeechSegment[] = [termSegment(deck, item), translationSegment(item.meaningVi)];
  if (item.hanViet) out.push(translationSegment(hanVietText(item.hanViet)));
  if (item.example) out.push({ lang: deck.termLang, text: item.example });
  if (item.exampleVi) out.push(translationSegment(item.exampleVi));
  if (item.explainVi) out.push(translationSegment(item.explainVi));
  return out;
}

export function speechKey(segment: SpeechSegment): string {
  return `${segment.lang}|${segment.text}`;
}

/** Mọi đoạn cần tạo sẵn âm thanh, không trùng, theo thứ tự ổn định. */
export function collectSpeech(decks: Deck[]): SpeechSegment[] {
  const seen = new Map<string, SpeechSegment>();
  const add = (s: SpeechSegment) => {
    if (s.text.trim() !== '' && !seen.has(speechKey(s))) seen.set(speechKey(s), { lang: s.lang, text: s.text });
  };
  for (const text of Object.values(phrases)) {
    if (text !== phrases.hanVietPrefix) add(viSegment(text));
  }
  for (const deck of decks) {
    for (const item of deck.items) cardSegments(deck, item).forEach(add);
  }
  return [...seen.values()];
}

export const speechLangs: SpeechLang[] = ['vi', 'en', 'ja'];
