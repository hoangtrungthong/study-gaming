import type { LearnItem } from '@study/content';
import { sample, shuffle, type Rng } from '../random';

export type MatchResult = 'match' | 'wrong' | 'ignored';

/** Luật trò Ghép Đôi: chọn một từ bên trái rồi chọn nghĩa bên phải. */
export class MatchGame {
  readonly left: LearnItem[];
  readonly right: LearnItem[];
  readonly matched = new Set<string>();
  selected: string | null = null;
  mistakes = 0;

  constructor(pool: readonly LearnItem[], pairs: number, rng: Rng = Math.random) {
    this.left = sample(pool, pairs, rng);
    this.right = shuffle(this.left, rng);
  }

  get done(): boolean {
    return this.matched.size === this.left.length;
  }

  /** 3 sao khi không sai lần nào, 2 sao khi sai tối đa 2 lần, còn lại 1 sao. */
  get stars(): number {
    if (this.mistakes === 0) return 3;
    return this.mistakes <= 2 ? 2 : 1;
  }

  selectLeft(id: string): MatchResult {
    if (this.matched.has(id) || !this.left.some((i) => i.id === id)) return 'ignored';
    this.selected = this.selected === id ? null : id;
    return 'ignored';
  }

  selectRight(id: string): MatchResult {
    if (this.selected === null || this.matched.has(id)) return 'ignored';
    if (id === this.selected) {
      this.matched.add(id);
      this.selected = null;
      return 'match';
    }
    this.mistakes++;
    return 'wrong';
  }
}
