import type { KanaStrokes } from '@study/content';
import { starsByMistakes } from '../result';
import { strokeMatch, type Point, type StrokeReason } from './strokeMatch';

export type StrokeResult = 'ok' | 'wrong' | 'charDone' | 'done';

/** Luật Vẽ Kana (J1): tô lần lượt từng chữ, mỗi chữ từng nét theo thứ tự; sai thì vẽ lại nét đó, không giới hạn lần. */
export class KanaTrace {
  index = 0;
  strokeIndex = 0;
  /** Tổng số nét sai cả lượt (tính sao). */
  mistakes = 0;
  /** Lý do của lần chấm sai gần nhất. */
  lastReason: StrokeReason | null = null;
  /** Chữ tô đúng hết các nét ngay lần đầu. */
  readonly firstTry: string[] = [];
  /** Chữ từng có nét sai. */
  readonly wrong: string[] = [];
  private charMistakes = new Map<string, number>();

  constructor(
    readonly chars: readonly KanaStrokes[],
    readonly tolerance: number,
  ) {}

  get done(): boolean {
    return this.index >= this.chars.length;
  }

  get current(): KanaStrokes | undefined {
    return this.chars[this.index];
  }

  /** Nét chuẩn đang phải vẽ. */
  get expected(): Point[] | undefined {
    return this.current?.strokes[this.strokeIndex];
  }

  mistakesFor(char: string): number {
    return this.charMistakes.get(char) ?? 0;
  }

  submitStroke(points: readonly Point[]): StrokeResult {
    const char = this.current;
    if (!char) return 'done';
    const check = strokeMatch(points, char.strokes[this.strokeIndex]!, this.tolerance);
    if (!check.ok) {
      this.lastReason = check.reason;
      this.mistakes++;
      this.charMistakes.set(char.char, this.mistakesFor(char.char) + 1);
      if (!this.wrong.includes(char.char)) this.wrong.push(char.char);
      return 'wrong';
    }
    this.lastReason = null;
    this.strokeIndex++;
    if (this.strokeIndex < char.strokes.length) return 'ok';
    if (this.mistakesFor(char.char) === 0) this.firstTry.push(char.char);
    this.index++;
    this.strokeIndex = 0;
    return this.done ? 'done' : 'charDone';
  }

  /** Đèn Pin: chỉ số nét cần hiện lại nét mẫu (nét đang phải vẽ); `-1` khi đã xong. */
  hint(): number {
    return this.done ? -1 : this.strokeIndex;
  }

  stars(usedHint: boolean): number {
    return starsByMistakes(this.mistakes, this.chars.length, usedHint);
  }
}
