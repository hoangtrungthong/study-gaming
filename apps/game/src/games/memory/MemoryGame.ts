import type { LearnItem } from '@study/content';
import { capForHint } from '../result';
import { sample, shuffle, type Rng } from '../random';

export type CardFace = 'term' | 'meaning';

export interface MemoryCard {
  item: LearnItem;
  face: CardFace;
}

export type FlipResult = 'first' | 'match' | 'mismatch' | 'ignored';

/**
 * Sao của Lật Thẻ Nhớ theo CC-15 ("theo số lần lật sai vượt số cặp"), khác `starsByMistakes`
 * vì trò nhớ luôn phải lật sai vài lần: 3 sao khi không sai, 2 sao khi sai tối đa bằng số cặp, còn lại 1.
 * Đã dùng Đèn Pin thì tối đa 2 sao.
 */
export function memoryStars(mistakes: number, pairs: number, usedHint = false): number {
  return capForHint(mistakes === 0 ? 3 : mistakes <= pairs ? 2 : 1, usedHint);
}

/** Luật trò Lật Thẻ Nhớ: mỗi từ có một thẻ từ và một thẻ nghĩa, lật hai thẻ cùng từ để ghép cặp. */
export class MemoryGame {
  readonly items: LearnItem[];
  readonly cards: MemoryCard[];
  /** Chỉ số các thẻ đang ngửa mà chưa ghép (tối đa 2). */
  faceUp: number[] = [];
  readonly matched = new Set<string>();
  /** Id từ từng nằm trong một lần lật sai. */
  readonly missed = new Set<string>();
  mistakes = 0;

  constructor(pool: readonly LearnItem[], pairs: number, rng: Rng = Math.random) {
    this.items = sample(pool, pairs, rng);
    const cards = this.items.flatMap((item): MemoryCard[] => [
      { item, face: 'term' },
      { item, face: 'meaning' },
    ]);
    this.cards = shuffle(cards, rng);
  }

  get pairs(): number {
    return this.items.length;
  }

  get done(): boolean {
    return this.matched.size === this.items.length;
  }

  isMatched(idx: number): boolean {
    const card = this.cards[idx];
    return card !== undefined && this.matched.has(card.item.id);
  }

  flip(idx: number): FlipResult {
    const card = this.cards[idx];
    if (!card || this.faceUp.length >= 2 || this.faceUp.includes(idx) || this.matched.has(card.item.id)) {
      return 'ignored';
    }
    this.faceUp.push(idx);
    if (this.faceUp.length === 1) return 'first';
    const other = this.cards[this.faceUp[0]!]!;
    if (other.item.id === card.item.id) {
      this.matched.add(card.item.id);
      this.faceUp = [];
      return 'match';
    }
    this.mistakes++;
    this.missed.add(card.item.id);
    this.missed.add(other.item.id);
    return 'mismatch';
  }

  /** Úp lại hai thẻ không khớp (màn gọi sau thời gian chờ của nhóm tuổi). */
  hideMismatch(): void {
    if (this.faceUp.length === 2) this.faceUp = [];
  }

  /** Đèn Pin: chỉ số hai thẻ của một cặp chưa ghép, ưu tiên cặp chưa có thẻ nào đang ngửa. */
  revealPair(): [number, number] | null {
    const unmatched = this.items.filter((i) => !this.matched.has(i.id));
    const pick = unmatched.find((i) => !this.faceUp.some((idx) => this.cards[idx]!.item.id === i.id)) ?? unmatched[0];
    if (!pick) return null;
    const term = this.cards.findIndex((c) => c.item.id === pick.id && c.face === 'term');
    const meaning = this.cards.findIndex((c) => c.item.id === pick.id && c.face === 'meaning');
    return [term, meaning];
  }

  /** Id từ ghép được mà chưa từng lật sai. */
  get firstTry(): string[] {
    return this.items.filter((i) => this.matched.has(i.id) && !this.missed.has(i.id)).map((i) => i.id);
  }

  get wrong(): string[] {
    return this.items.filter((i) => this.missed.has(i.id)).map((i) => i.id);
  }

  stars(usedHint = false): number {
    return memoryStars(this.mistakes, this.pairs, usedHint);
  }
}
