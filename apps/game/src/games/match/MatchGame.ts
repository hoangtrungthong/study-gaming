import type { LearnItem } from '@study/content';
import { capForHint } from '../result';
import { sample, shuffle, type Rng } from '../random';

export type MatchResult = 'match' | 'wrong' | 'ignored';

/** Luật trò Ghép Đôi: chọn một từ bên trái rồi chọn nghĩa bên phải. */
export class MatchGame {
  readonly left: LearnItem[];
  readonly right: LearnItem[];
  readonly matched = new Set<string>();
  selected: string | null = null;
  mistakes = 0;
  /** Đã dùng Đèn Pin trong ván này: không được 3 sao. */
  usedHint = false;

  /** Từ đã ghép sai ít nhất một lần, hoặc đã được Đèn Pin soi nghĩa: không tính "đúng ngay lần đầu". */
  private readonly wrongSet = new Set<string>();
  private readonly hintedSet = new Set<string>();

  constructor(pool: readonly LearnItem[], pairs: number, rng: Rng = Math.random) {
    this.left = sample(pool, pairs, rng);
    this.right = shuffle(this.left, rng);
  }

  get done(): boolean {
    return this.matched.size === this.left.length;
  }

  /** 3 sao khi không sai lần nào, 2 sao khi sai tối đa 2 lần, còn lại 1 sao. Dùng Đèn Pin thì tối đa 2. */
  get stars(): number {
    return capForHint(this.mistakes === 0 ? 3 : this.mistakes <= 2 ? 2 : 1, this.usedHint);
  }

  /** Id từ ghép đúng ngay lần đầu, không nhờ Đèn Pin (theo thứ tự ghép). */
  get firstTry(): string[] {
    return [...this.matched].filter((id) => !this.wrongSet.has(id) && !this.hintedSet.has(id));
  }

  /** Id từ ghép đúng nhờ Đèn Pin soi nghĩa mà chưa từng ghép sai (không thuộc `firstTry` lẫn `wrong`). */
  get hinted(): string[] {
    return [...this.matched].filter((id) => this.hintedSet.has(id) && !this.wrongSet.has(id));
  }

  /** Id từ từng ghép sai. */
  get wrong(): string[] {
    return [...this.wrongSet];
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
    this.wrongSet.add(this.selected);
    return 'wrong';
  }

  /** Đèn Pin: trả id thẻ nghĩa đúng của từ đang chọn (để loé sáng), `null` khi chưa chọn từ. */
  hint(): string | null {
    if (this.selected === null) return null;
    this.usedHint = true;
    this.hintedSet.add(this.selected);
    return this.selected;
  }
}
