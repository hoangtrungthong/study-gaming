import type { Sentence } from '@study/content';
import type { SentenceConfig } from '../ageConfig';
import { sample, shuffle, type Rng } from '../random';

/** Một khối trong khay. `chunk` là chỉ số khối trong câu, `null` khi là khối nhiễu. */
export interface Piece {
  text: string;
  reading: string | null;
  chunk: number | null;
}

export interface SubmitResult {
  ok: boolean;
  wrongSlots: number[];
}

/**
 * Luật trò Xếp Câu. Khối được nhận diện bằng chỉ số trong `pieces` (không bằng chữ), vì một câu có thể có hai khối
 * cùng chữ. Chấm thì so chữ, để hai khối cùng chữ đổi chỗ cho nhau vẫn đúng.
 */
export class SentenceGame {
  readonly sentences: Sentence[];
  index = 0;
  pieces: Piece[] = [];
  /** `tray[i]`: khối `i` đang nằm trong khay. Khay giữ chỗ cố định để khối không nhảy lung tung. */
  tray: boolean[] = [];
  /** Khối (chỉ số trong `pieces`) đang ở từng chỗ trống. */
  slots: (number | null)[] = [];
  /** Số lần bấm "Xong" sai, cả màn. */
  mistakes = 0;
  /** Số lần sai của câu hiện tại. */
  sentenceMistakes = 0;
  readonly firstTry: string[] = [];
  readonly wrong: string[] = [];
  private hinted = false;

  constructor(
    pool: readonly Sentence[],
    private readonly config: SentenceConfig,
    private readonly rng: Rng = Math.random,
  ) {
    const fit = pool.filter((s) => s.chunks.length <= config.maxChunks);
    // Màn không có câu nào đủ ngắn cho nhóm này thì vẫn chơi bằng câu có sẵn, không để màn trống.
    this.sentences = sample(fit.length > 0 ? fit : pool, config.sentences, rng);
    this.setup();
  }

  get current(): Sentence | undefined {
    return this.sentences[this.index];
  }

  get done(): boolean {
    return this.index >= this.sentences.length;
  }

  get full(): boolean {
    return this.slots.length > 0 && this.slots.every((p) => p !== null);
  }

  slotOf(piece: number): number {
    return this.slots.indexOf(piece);
  }

  /** Đặt khối vào chỗ. Chỗ đã có khối thì khối cũ về khay; khối đang ở chỗ khác thì chuyển sang. */
  place(piece: number, slot: number): void {
    if (this.pieces[piece] === undefined || slot < 0 || slot >= this.slots.length) return;
    const from = this.slotOf(piece);
    if (from === slot) return;
    if (from >= 0) this.slots[from] = null;
    const old = this.slots[slot];
    if (old !== null && old !== undefined) this.tray[old] = true;
    this.slots[slot] = piece;
    this.tray[piece] = false;
  }

  /** Đưa khối ở chỗ `slot` về khay. */
  remove(slot: number): void {
    const piece = this.slots[slot];
    if (piece === null || piece === undefined) return;
    this.slots[slot] = null;
    this.tray[piece] = true;
  }

  /** Chấm cả câu. Sai thì khối sai về khay. */
  submit(): SubmitResult {
    const order = this.bestOrder();
    const wrongSlots = this.slots.flatMap((_, i) => (this.textAt(i) === order[i] ? [] : [i]));
    if (wrongSlots.length === 0) {
      const id = this.current!.id;
      if (this.sentenceMistakes === 0 && !this.hinted) this.firstTry.push(id);
      return { ok: true, wrongSlots };
    }
    this.mistakes++;
    this.sentenceMistakes++;
    const id = this.current!.id;
    if (!this.wrong.includes(id)) this.wrong.push(id);
    for (const slot of wrongSlots) this.remove(slot);
    return { ok: false, wrongSlots };
  }

  /** Đèn Pin: đặt đúng một khối vào chỗ trống / chỗ sai đầu tiên. Trả chỗ vừa đặt, `null` khi câu đã đúng hết. */
  placeOneCorrect(): number | null {
    const order = this.bestOrder();
    const slot = this.slots.findIndex((_, i) => this.textAt(i) !== order[i]);
    if (slot < 0) return null;
    const want = order[slot];
    const candidates = this.pieces.flatMap((p, i) => (p.text === want ? [i] : []));
    // Ưu tiên khối trong khay, rồi tới khối đang nằm sai chỗ (không lấy khối đã đúng chỗ).
    const piece =
      candidates.find((i) => this.tray[i]) ??
      candidates.find((i) => {
        const at = this.slotOf(i);
        return at >= 0 && this.textAt(at) !== order[at];
      });
    // Chỉ xảy ra khi `accept` có chữ không nằm trong câu (dữ liệu sai).
    if (piece === undefined) return null;
    this.place(piece, slot);
    this.hinted = true;
    return slot;
  }

  /** Mọi chỗ đã có khối đúng (theo một thứ tự được chấp nhận). */
  allCorrect(): boolean {
    const order = this.bestOrder();
    return this.slots.every((_, i) => this.textAt(i) === order[i]);
  }

  next(): void {
    if (this.done) return;
    this.index++;
    this.setup();
  }

  private textAt(slot: number): string | undefined {
    const p = this.slots[slot];
    return p === null || p === undefined ? undefined : this.pieces[p]!.text;
  }

  /** Thứ tự chuẩn hoặc thứ tự trong `accept` khớp nhiều chỗ nhất với những gì đã xếp (bằng nhau thì lấy thứ tự chuẩn). */
  private bestOrder(): readonly string[] {
    const s = this.current!;
    const orders = [s.chunks, ...(s.accept ?? []).filter((o) => o.length === s.chunks.length)];
    let best = orders[0]!;
    let bestScore = -1;
    for (const order of orders) {
      const score = order.filter((t, i) => this.textAt(i) === t).length;
      if (score > bestScore) [best, bestScore] = [order, score];
    }
    return best;
  }

  private setup(): void {
    this.sentenceMistakes = 0;
    this.hinted = false;
    const s = this.current;
    if (!s) {
      this.pieces = [];
      this.tray = [];
      this.slots = [];
      return;
    }
    const pieces: Piece[] = s.chunks.map((text, i) => ({ text, reading: s.readings?.[i] ?? null, chunk: i }));
    const distractors = s.distractors ?? [];
    if (this.config.distractor && distractors.length > 0) {
      pieces.push({ text: sample(distractors, 1, this.rng)[0]!, reading: null, chunk: null });
    }
    const shuffled = shuffle(pieces, this.rng);
    // Xáo ra đúng thứ tự câu thì xoay các khối thật một bước (khối nhiễu đứng yên), kẻo câu tự đúng sẵn.
    const at = shuffled.flatMap((p, i) => (p.chunk === null ? [] : [i]));
    if (at.every((pos, i) => shuffled[pos]!.text === s.chunks[i])) {
      const moved = at.map((pos) => shuffled[pos]!);
      at.forEach((pos, i) => (shuffled[pos] = moved[(i + 1) % moved.length]!));
    }
    this.pieces = shuffled;
    this.tray = shuffled.map(() => true);
    this.slots = s.chunks.map(() => null);
  }
}
