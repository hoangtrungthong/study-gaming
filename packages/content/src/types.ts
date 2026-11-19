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

/** Các trò chơi (kịch bản mục 5). `match` = Ghép Đôi (G1), `rain` = Mưa Chữ (W2). */
export type GameKind = 'match' | 'rain' | 'star' | 'sentence' | 'listen' | 'memory' | 'write' | 'kana' | 'maze';

/** Một vùng (chương) của đảo, mã `<môn>-r<số>`. */
export interface Region {
  id: string;
  subject: Subject;
  order: number;
  titleVi: string;
  titleTarget: string;
  levels: Level[];
}

/** Một màn: một trò với một tập nội dung, mã `<vùng>-l<số>`. */
export interface Level {
  id: string;
  game: GameKind;
  /** Id `LearnItem` (Ghép Đôi, Mưa Chữ, Hứng Sao, Nghe Chọn, Lật Thẻ, Viết Lại Từ). */
  items?: string[];
  /** Id `Sentence` (Xếp Câu, Nghe Chọn bằng câu). */
  sentences?: string[];
  /** Các chữ kana để tô (Vẽ Kana). */
  kana?: string[];
  /** Id `MazeLevel` (Đưa Bit Về Nhà). */
  maze?: string;
  /** Từ mới của màn: có thì sau trò chính chuyển sang Viết Lại Từ với các từ này. */
  newWords?: string[];
}

/** Một câu cho Xếp Câu, chia thành các khối. */
export interface Sentence {
  id: string;
  chunks: string[];
  /** Tiếng Nhật: cách đọc かな của từng khối có kanji (`null` khi khối không có kanji). */
  readings?: (string | null)[];
  textVi: string;
  emoji?: string;
  /** Các thứ tự khối khác cũng đúng. */
  accept?: string[][];
  /** Khối nhiễu (nhóm Cây). */
  distractors?: string[];
}

/** Bộ câu của một môn. */
export interface SentenceDeck {
  subject: Subject;
  sentences: Sentence[];
}

/** Nét của một chữ kana: mỗi nét là dãy điểm đã lấy mẫu, toạ độ trong khung 0–109. */
export interface KanaStrokes {
  char: string;
  romaji: string;
  strokes: [number, number][][];
}

export type BlockKind = 'forward' | 'left' | 'right' | 'repeat';

/** Một khối lệnh trong chương trình. `repeat` chứa khối con. */
export type Block =
  { kind: 'forward' } | { kind: 'left' } | { kind: 'right' } | { kind: 'repeat'; times: number; body: Block[] };

/** Một mê cung cho Đưa Bit Về Nhà. */
export interface MazeLevel {
  id: string;
  /** `#` tường · `.` đường · `S` Bit kèm hướng ở ô kế bên trong chuỗi `dir` · `H` nhà. */
  grid: string[];
  /** Hướng xuất phát của Bit: `^` lên, `>` phải, `v` xuống, `<` trái. */
  dir: '^' | '>' | 'v' | '<';
  blocks: BlockKind[];
  maxBlocks: number;
  /** Số khối của lời giải ngắn nhất (validateMaze kiểm). */
  optimal: number;
  /** Lời giải mẫu, bắt buộc khi có khối lặp (validateMaze chạy để chắc tới nhà và đúng `optimal`). */
  solution?: Block[];
  hintVi: string;
}
