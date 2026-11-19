import type { AgeGroup } from '@study/content';

export interface RainConfig {
  /** Số hạt mưa tối đa cùng lúc. */
  maxDrops: number;
  /** Giây giữa hai lần sinh hạt mưa. */
  spawnEvery: number;
  /** Tốc độ rơi lúc đầu, tính bằng phần chiều cao khung chơi mỗi giây. */
  speed: number;
  /** Tốc độ tăng thêm mỗi phút chơi (0.3 = +30%/phút). */
  speedUpPerMinute: number;
  /** Số chậu hoa (mạng). */
  lives: number;
  /** Thời lượng một trận, giây. */
  duration: number;
}

export interface MatchConfig {
  /** Số cặp trong một màn Ghép Đôi. */
  pairs: number;
}

export const RAIN_CONFIG: Record<AgeGroup, RainConfig> = {
  mam: { maxDrops: 1, spawnEvery: 3, speed: 0.06, speedUpPerMinute: 0, lives: 5, duration: 90 },
  choi: { maxDrops: 2, spawnEvery: 2.5, speed: 0.09, speedUpPerMinute: 0.2, lives: 5, duration: 75 },
  cay: { maxDrops: 3, spawnEvery: 2, speed: 0.12, speedUpPerMinute: 0.3, lives: 5, duration: 60 },
};

export const MATCH_CONFIG: Record<AgeGroup, MatchConfig> = {
  mam: { pairs: 3 },
  choi: { pairs: 4 },
  cay: { pairs: 5 },
};

/** Hứng Sao (G2). */
export interface StarConfig {
  rounds: number;
  /** Số sao sai rơi cùng sao đúng. */
  wrongStars: number;
  /** Tốc độ rơi, phần chiều cao khung chơi mỗi giây. */
  speed: number;
}

/** Xếp Câu (G3). */
export interface SentenceConfig {
  /** Số khối tối đa của câu dùng cho nhóm này. */
  maxChunks: number;
  sentences: number;
  /** Có thêm 1 khối nhiễu. */
  distractor: boolean;
}

/** Nghe Chọn (G4): `picture` chỉ hình, `both` hình + chữ, `text` chỉ chữ. */
export interface ListenConfig {
  options: number;
  rounds: number;
  mode: 'picture' | 'both' | 'text';
}

/** Lật Thẻ Nhớ (G5). */
export interface MemoryConfig {
  pairs: number;
  /** Mili giây trước khi úp lại hai thẻ không khớp. */
  flipBackMs: number;
}

/** Viết Lại Từ (W1): mức mặc định khi chưa có dữ liệu tiến độ. */
export type WriteLevel = 'copy' | 'recall' | 'dictation';
export interface WriteConfig {
  defaultLevel: WriteLevel;
  /** Dùng bàn phím ảo chữ to thay bàn phím máy. */
  virtualKeyboard: boolean;
}

/** Vẽ Kana (J1). */
export interface KanaConfig {
  /** Ngưỡng sai lệch, tính theo phần cạnh khung (0,2 = 20%). */
  tolerance: number;
  /** Luôn hiện mũi tên (Cây chỉ hiện sau khi vẽ sai). */
  arrowsAlways: boolean;
}

/** Đưa Bit Về Nhà (I1). */
export interface MazeConfig {
  /** Mili giây mỗi bước khi phát lại chương trình. */
  stepMs: number;
  /** Cho phép khối lặp nằm trong khối lặp. */
  nestedRepeat: boolean;
}

export const STAR_CONFIG: Record<AgeGroup, StarConfig> = {
  mam: { rounds: 5, wrongStars: 1, speed: 0.08 },
  choi: { rounds: 8, wrongStars: 2, speed: 0.11 },
  cay: { rounds: 10, wrongStars: 3, speed: 0.14 },
};

export const SENTENCE_CONFIG: Record<AgeGroup, SentenceConfig> = {
  mam: { maxChunks: 3, sentences: 4, distractor: false },
  choi: { maxChunks: 5, sentences: 5, distractor: false },
  cay: { maxChunks: 8, sentences: 6, distractor: true },
};

export const LISTEN_CONFIG: Record<AgeGroup, ListenConfig> = {
  mam: { options: 3, rounds: 5, mode: 'picture' },
  choi: { options: 4, rounds: 8, mode: 'both' },
  cay: { options: 4, rounds: 10, mode: 'text' },
};

export const MEMORY_CONFIG: Record<AgeGroup, MemoryConfig> = {
  mam: { pairs: 3, flipBackMs: 1800 },
  choi: { pairs: 6, flipBackMs: 1200 },
  cay: { pairs: 8, flipBackMs: 1200 },
};

export const WRITE_CONFIG: Record<AgeGroup, WriteConfig> = {
  mam: { defaultLevel: 'copy', virtualKeyboard: true },
  choi: { defaultLevel: 'recall', virtualKeyboard: false },
  cay: { defaultLevel: 'recall', virtualKeyboard: false },
};

export const KANA_CONFIG: Record<AgeGroup, KanaConfig> = {
  mam: { tolerance: 0.2, arrowsAlways: true },
  choi: { tolerance: 0.15, arrowsAlways: true },
  cay: { tolerance: 0.1, arrowsAlways: false },
};

export const MAZE_CONFIG: Record<AgeGroup, MazeConfig> = {
  mam: { stepMs: 600, nestedRepeat: false },
  choi: { stepMs: 400, nestedRepeat: false },
  cay: { stepMs: 400, nestedRepeat: true },
};
