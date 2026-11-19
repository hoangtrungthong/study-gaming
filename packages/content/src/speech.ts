import { phrases } from './phrases';
import type {
  Deck,
  KanaStrokes,
  LearnItem,
  MazeLevel,
  SentenceDeck,
  Sentence,
  SpeechLang,
  SpeechSegment,
} from './types';

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

/** Câu gốc (tiếng Nhật đọc theo かな của từng khối) + dòng dịch tiếng Việt. */
export function sentenceSegments(deck: Deck, s: Sentence): SpeechSegment[] {
  const sep = deck.termLang === 'ja' ? '' : ' ';
  const text = s.chunks.map((c, i) => s.readings?.[i] ?? c).join(sep);
  return [{ lang: deck.termLang, text }, translationSegment(s.textVi)];
}

/** Đọc riêng một khối của câu. */
export function chunkSegment(deck: Deck, s: Sentence, index: number): SpeechSegment {
  return { lang: deck.termLang, text: s.readings?.[index] ?? s.chunks[index] ?? '' };
}

/** Tên một chữ kana (giọng Nhật). */
export function kanaSegment(char: string): SpeechSegment {
  return { lang: 'ja', text: char };
}

/**
 * Các chữ khác nhau (viết thường, chỉ chữ) trong đáp án của bộ, theo thứ tự: Đèn Pin của Viết Lại Từ đọc riêng chữ vừa hiện.
 * Tiếng Anh / IT lấy từ `term`; tiếng Nhật lấy từng かな / カナ của cách đọc (`reading ?? term`), kể cả ー và chữ nhỏ.
 */
export function termLetters(deck: Deck): string[] {
  const answer = (item: Deck['items'][number]) => (deck.termLang === 'ja' ? (item.reading ?? item.term) : item.term);
  const letters = new Set(
    deck.items.flatMap((item) => [...answer(item).toLowerCase()].filter((c) => /\p{L}/u.test(c))),
  );
  return [...letters].sort();
}

/** Nội dung thêm ngoài bộ từ cần tạo sẵn âm thanh. */
export interface ExtraSpeech {
  sentenceDecks?: { deck: Deck; sentences: SentenceDeck }[];
  mazes?: MazeLevel[];
  kana?: KanaStrokes[];
}

/** Mọi đoạn cần tạo sẵn âm thanh, không trùng, theo thứ tự ổn định. */
export function collectSpeech(decks: Deck[], extra: ExtraSpeech = {}): SpeechSegment[] {
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
  // Đèn Pin của Viết Lại Từ đọc riêng chữ cái vừa hiện.
  for (const deck of decks) termLetters(deck).forEach((text) => add({ lang: deck.termLang, text }));
  for (const { deck, sentences } of extra.sentenceDecks ?? []) {
    for (const sentence of sentences.sentences) {
      sentenceSegments(deck, sentence).forEach(add);
      sentence.chunks.forEach((_, i) => add(chunkSegment(deck, sentence, i)));
      for (const d of sentence.distractors ?? []) add({ lang: deck.termLang, text: d });
    }
  }
  for (const maze of extra.mazes ?? []) add(viSegment(maze.hintVi));
  for (const k of extra.kana ?? []) add(kanaSegment(k.char));
  return [...seen.values()];
}

export const speechLangs: SpeechLang[] = ['vi', 'en', 'ja'];
