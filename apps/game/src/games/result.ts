import { ISLAND_LEVEL_SUFFIX, type GameKind, type Level } from '@study/content';

/** Kết quả một lượt chơi, phát qua sự kiện `finish` để `mvp-progress` lưu. */
export interface LevelResult {
  levelId?: string;
  game: GameKind;
  stars: number;
  /** Id mục (từ / câu / kana / mê cung) trả lời đúng ngay lần đầu. */
  firstTry: string[];
  /** Id mục từng trả lời sai, dùng cho ôn tập sau này. */
  wrong: string[];
  /** Đã dùng Đèn Pin (gợi ý) trong lượt này: không được 3 sao. */
  usedHint: boolean;
  /** Id mục làm đúng nhờ Đèn Pin (không vào `firstTry`, cũng không phải sai), vd. cặp Ghép Đôi được chỉ. */
  hinted?: string[];
}

/**
 * Sao dùng chung cho các trò: 3 khi không sai lần nào, 2 khi sai tối đa 2 lần hoặc tối đa 20% số mục, còn lại 1.
 * Đã dùng gợi ý thì tối đa 2 sao.
 */
export function starsByMistakes(mistakes: number, total: number, usedHint = false): number {
  return capForHint(mistakes === 0 ? 3 : mistakes <= 2 || mistakes <= total * 0.2 ? 2 : 1, usedHint);
}

/** Đã dùng Đèn Pin thì tối đa 2 sao. */
export function capForHint(stars: number, usedHint: boolean): number {
  return usedHint ? Math.min(stars, 2) : stars;
}

/** `levelId` cho `LevelResult`: bỏ trống khi đang chơi nội dung cả đảo (lối vào tạm, `islandContent`). */
export function levelIdOf(level: Level | undefined): { levelId?: string } {
  return level && !level.id.endsWith(ISLAND_LEVEL_SUFFIX) ? { levelId: level.id } : {};
}
