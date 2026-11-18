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
