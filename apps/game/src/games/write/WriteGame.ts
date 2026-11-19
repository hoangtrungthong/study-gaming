import {
  isCorrectAnswer,
  normalizeJapanese,
  primaryAnswer,
  romajiPreview,
  type AgeGroup,
  type LearnItem,
  type Subject,
} from '@study/content';
import type { WriteLevel } from '../ageConfig';
import { sample, type Rng } from '../random';

/**
 * Số từ tối đa mỗi lượt Viết Lại Từ: màn có `newWords` thường chỉ 3 từ; màn riêng của W1 có 5 từ.
 * Giữ ngắn để một lượt dưới 3 phút (Yêu cầu 9.6), Mầm gõ chậm nên ít từ hơn.
 */
export const WRITE_ROUNDS: Record<AgeGroup, number> = { mam: 3, choi: 4, cay: 5 };

/** Sai đến lần này thì hiện chữ đầu / cả từ để chép (Yêu cầu 6.3). */
export const REVEAL_FIRST_AFTER = 2;
export const REVEAL_ALL_AFTER = 3;

export type WriteCheck = 'correct' | 'wrong' | 'ignored';

/** Một ô chữ: `ok` gõ đúng, `bad` gõ sai, `empty` chưa gõ, `space` khoảng trắng giữa hai từ. */
export interface WriteBox {
  /** Chữ của đáp án ở ô này. */
  char: string;
  state: 'ok' | 'bad' | 'empty' | 'space';
  /** Chữ người học đã gõ vào ô (tiếng Nhật: かな sau khi đổi từ romaji). */
  typed: string;
  /** Hiện chữ mờ để gõ đè: mức Chép, hoặc chữ đã được gợi ý. */
  ghost: boolean;
}

/** Luật trò Viết Lại Từ (W1): mỗi lượt một từ, gõ đúng đáp án (tiếng Nhật: かな hoặc romaji) mới sang từ sau. */
export class WriteGame {
  readonly rounds: LearnItem[];
  index = 0;
  solved = false;
  /** Tổng số lần gõ sai cả lượt. */
  mistakes = 0;
  /** Số lần gõ sai ở từ hiện tại. */
  roundMistakes = 0;
  /** Số chữ đầu của từ hiện tại đã được hiện (do gõ sai nhiều lần hoặc Đèn Pin). */
  revealCount = 0;
  readonly firstTry: string[] = [];
  readonly wrong: string[] = [];

  constructor(
    private readonly subject: Subject,
    pool: readonly LearnItem[],
    count: number,
    readonly mode: WriteLevel,
    rng: Rng = Math.random,
  ) {
    this.rounds = sample(pool, count, rng);
  }

  get item(): LearnItem {
    return this.rounds[this.index]!;
  }

  /** Chữ người học phải gõ (tiếng Nhật: cách đọc かな). */
  get answer(): string {
    return primaryAnswer(this.item);
  }

  /** Các ô chữ: mỗi ký tự một ô (tiếng Nhật: mỗi かな một ô, CC-18). */
  get chars(): string[] {
    return [...this.answer];
  }

  get done(): boolean {
    return this.solved && this.index === this.rounds.length - 1;
  }

  get canHint(): boolean {
    return !this.solved && this.revealCount < this.chars.length;
  }

  /** Chữ gõ được, tách theo ô để so với đáp án. Tiếng Nhật: đổi romaji sang かな, bỏ phần romaji chưa thành chữ. */
  typedChars(input: string): string[] {
    if (this.subject !== 'ja') return [...input.toLowerCase()];
    const target = this.target();
    // Romaji có hai kiểu gõ ん (bộ gõ `nn` / Hepburn `n`): lấy cách đổi khớp đáp án dài hơn. `n` cuối giữ lại chờ gõ tiếp.
    const kana = (text: string) => [...normalizeJapanese(text.replace(/[a-z].*$/i, ''))];
    const candidates = [kana(romajiPreview(input.trim())), kana(normalizeJapanese(input.trim().replace(/n$/i, '')))];
    const matched = (chars: string[]) => {
      const miss = chars.findIndex((c, i) => c !== target[i]);
      return miss < 0 ? chars.length : miss;
    };
    return candidates.reduce((best, c) => (matched(c) > matched(best) ? c : best));
  }

  /** Đáp án đã chuẩn hoá để so từng ô. */
  private target(): string[] {
    return this.subject === 'ja' ? [...normalizeJapanese(this.answer)] : [...this.answer.toLowerCase()];
  }

  /** Trạng thái từng ô theo chữ đang gõ. */
  boxes(input: string): WriteBox[] {
    const typed = this.typedChars(input);
    const target = this.target();
    return this.chars.map((char, i) => {
      const ghost = this.mode === 'copy' || i < this.revealCount;
      if (char.trim() === '') return { char, state: 'space', typed: '', ghost: false };
      const t = typed[i];
      if (t === undefined) return { char, state: 'empty', typed: '', ghost };
      return { char, state: t === target[i] ? 'ok' : 'bad', typed: t, ghost };
    });
  }

  check(input: string): WriteCheck {
    if (this.solved || input.trim() === '') return 'ignored';
    const id = this.item.id;
    if (isCorrectAnswer(this.subject, this.item, input)) {
      this.solved = true;
      // Đã phải xem chữ gợi ý thì không tính là đúng ngay (Yêu cầu 6.8).
      if (this.roundMistakes === 0 && this.revealCount === 0) this.firstTry.push(id);
      return 'correct';
    }
    this.mistakes++;
    this.roundMistakes++;
    if (!this.wrong.includes(id)) this.wrong.push(id);
    if (this.roundMistakes >= REVEAL_ALL_AFTER) this.revealCount = this.chars.length;
    else if (this.roundMistakes >= REVEAL_FIRST_AFTER) this.revealCount = Math.max(this.revealCount, 1);
    return 'wrong';
  }

  /**
   * Đèn Pin: hiện chữ tiếp theo sau phần đã gõ đúng / đã hiện. Trả chữ vừa hiện, `null` khi không còn gì để hiện.
   */
  hint(input: string): string | null {
    if (!this.canHint) return null;
    const boxes = this.boxes(input);
    const okPrefix = boxes.findIndex((b) => b.state !== 'ok' && b.state !== 'space');
    const known = okPrefix < 0 ? boxes.length : okPrefix;
    this.revealCount = Math.min(this.chars.length, Math.max(this.revealCount, known) + 1);
    // Ô cuối được hiện là khoảng trắng thì hiện thêm chữ sau nó.
    while (this.revealCount < this.chars.length && this.chars[this.revealCount - 1]!.trim() === '') this.revealCount++;
    return this.chars[this.revealCount - 1]!;
  }

  /** Sang từ sau; chỉ được khi từ hiện tại đã đúng và chưa phải từ cuối. */
  next(): boolean {
    if (!this.solved || this.done) return false;
    this.index++;
    this.solved = false;
    this.roundMistakes = 0;
    this.revealCount = 0;
    return true;
  }
}
