/** Môn học: tiếng Anh, tiếng Nhật, IT. */
export type Subject = 'en' | 'ja' | 'it';

/** Ngôn ngữ của một đoạn được đọc to. */
export type SpeechLang = 'vi' | 'en' | 'ja';

export type AgeGroup = 'mam' | 'choi' | 'cay';

export interface LearnItem {
  /** Duy nhất trong toàn bộ nội dung, dạng `<môn>-<slug>`. */
  id: string;
  /** Từ/thuật ngữ đang học, hiển thị to nhất. */
  term: string;
  /** Tiếng Nhật: cách đọc bằng かな. Dùng để đọc to và làm đáp án khi gõ. */
  reading?: string;
  /** Tiếng Nhật: âm Hán Việt của chữ kanji, ví dụ "THỰC". */
  hanViet?: string;
  emoji: string;
  meaningVi: string;
  /** Giải thích ngắn bằng tiếng Việt, được đọc to sau khi trả lời. */
  explainVi?: string;
  example?: string;
  exampleVi?: string;
  /** Các cách gõ khác cũng được chấp nhận. */
  accept?: string[];
}

export interface Deck {
  subject: Subject;
  titleVi: string;
  /** Tên đảo bằng ngôn ngữ đang học. */
  titleTarget: string;
  /** Ngôn ngữ của `term` khi đọc to (IT dùng tiếng Anh). */
  termLang: SpeechLang;
  items: LearnItem[];
}

export interface SpeechSegment {
  lang: SpeechLang;
  text: string;
  /** Dòng dịch / giải thích tiếng Việt của nội dung: bị bỏ khi người học tắt tiếng Việt. */
  translation?: boolean;
}
