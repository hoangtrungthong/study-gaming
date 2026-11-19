import type { LearnItem } from '@study/content';
import { shuffle, type Rng } from '../random';

export type ListenChoice = 'correct' | 'wrong' | 'ignored';

export interface ListenRound {
  answer: LearnItem;
  options: LearnItem[];
}

export interface ListenOptions {
  rounds: number;
  options: number;
}

/** Luật trò Nghe Chọn (G4): nghe từ đang học, chọn hình / chữ đúng trong các lựa chọn. */
export class ListenGame {
  readonly rounds: ListenRound[];
  index = 0;
  /** Lựa chọn đã bị loại (chọn sai hoặc Đèn Pin) ở đề hiện tại. */
  readonly disabled = new Set<string>();
  solved = false;
  mistakes = 0;
  readonly firstTry: string[] = [];
  readonly wrong: string[] = [];
  private missed = false;

  /** `distractorPool`: nơi lấy lựa chọn nhiễu, mặc định là chính `pool` (cùng vùng). */
  constructor(
    pool: readonly LearnItem[],
    config: ListenOptions,
    private readonly rng: Rng = Math.random,
    distractorPool: readonly LearnItem[] = pool,
  ) {
    this.rounds = pickAnswers(pool, config.rounds, rng).map((answer) => ({
      answer,
      options: shuffle([answer, ...pickDistractors(answer, distractorPool, config.options - 1, rng)], rng),
    }));
  }

  get round(): ListenRound {
    return this.rounds[this.index]!;
  }

  get done(): boolean {
    return this.solved && this.index === this.rounds.length - 1;
  }

  /** Còn lựa chọn sai chưa bị loại để Đèn Pin loại bớt. */
  get canEliminate(): boolean {
    return !this.solved && this.wrongLeft().length > 0;
  }

  choose(id: string): ListenChoice {
    if (this.solved || this.disabled.has(id) || !this.round.options.some((o) => o.id === id)) return 'ignored';
    const answerId = this.round.answer.id;
    if (id === answerId) {
      this.solved = true;
      // Từ lặp lại ở nhiều lượt: chỉ tính "đúng ngay" khi chưa từng sai, mỗi từ một lần.
      if (!this.missed && !this.wrong.includes(answerId) && !this.firstTry.includes(answerId))
        this.firstTry.push(answerId);
      return 'correct';
    }
    this.disabled.add(id);
    this.mistakes++;
    if (!this.wrong.includes(answerId)) this.wrong.push(answerId);
    const earlier = this.firstTry.indexOf(answerId);
    if (earlier >= 0) this.firstTry.splice(earlier, 1);
    this.missed = true;
    return 'wrong';
  }

  /** Sang đề sau; chỉ được khi đề hiện tại đã đúng và chưa phải đề cuối. */
  next(): boolean {
    if (!this.solved || this.done) return false;
    this.index++;
    this.solved = false;
    this.missed = false;
    this.disabled.clear();
    return true;
  }

  /** Gợi ý G4: loại 1 lựa chọn sai (không tính lỗi). Trả id bị loại, `null` khi không còn gì để loại. */
  eliminateWrong(): string | null {
    if (this.solved) return null;
    const left = this.wrongLeft();
    if (left.length === 0) return null;
    const id = left[Math.floor(this.rng() * left.length)]!.id;
    this.disabled.add(id);
    return id;
  }

  private wrongLeft(): LearnItem[] {
    return this.round.options.filter((o) => o.id !== this.round.answer.id && !this.disabled.has(o.id));
  }
}

/** Màn ít từ hơn số đề thì xáo lại và lặp, tránh hai đề liền nhau trùng từ. */
function pickAnswers(pool: readonly LearnItem[], count: number, rng: Rng): LearnItem[] {
  const out: LearnItem[] = [];
  while (pool.length > 0 && out.length < count) {
    const batch = shuffle(pool, rng);
    if (batch.length > 1 && batch[0]!.id === out.at(-1)?.id) batch.push(batch.shift()!);
    out.push(...batch);
  }
  return out.slice(0, count);
}

/** Lựa chọn nhiễu không trùng emoji với đáp án và với nhau, để hình không lộ / không gây nhầm. */
function pickDistractors(answer: LearnItem, pool: readonly LearnItem[], count: number, rng: Rng): LearnItem[] {
  const emojis = new Set([answer.emoji]);
  const out: LearnItem[] = [];
  for (const item of shuffle(pool, rng)) {
    if (out.length >= count) break;
    if (item.id === answer.id || emojis.has(item.emoji)) continue;
    emojis.add(item.emoji);
    out.push(item);
  }
  return out;
}
