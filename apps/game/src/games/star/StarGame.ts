import type { LearnItem } from '@study/content';
import type { StarConfig } from '../ageConfig';
import { shuffle, type Rng } from '../random';

export interface Star {
  id: number;
  item: LearnItem;
  /** Sao mang từ đúng của đề. */
  correct: boolean;
  /** Vị trí ngang 0–1 (giữa ngôi sao). */
  x: number;
  /** Vị trí dọc 0–1; chạm 1 là rơi khỏi khung. */
  y: number;
}

export type StarEvent =
  | { type: 'spawn'; stars: Star[] }
  | { type: 'caught'; star: Star }
  | { type: 'wrong'; star: Star }
  | { type: 'lost'; star: Star }
  | { type: 'round'; prompt: LearnItem }
  /** Hết thời gian rơi chậm của Đèn Pin (để giao diện bật lại nút). */
  | { type: 'slow-end' }
  | { type: 'over' };

/** Độ cao vạch giỏ (0–1): sao đi qua vạch này trong tầm giỏ là được hứng. */
export const BASKET_Y = 0.85;
/** Nửa bề ngang giỏ, theo phần bề ngang khung chơi. */
export const BASKET_HALF = 0.12;
/** Giây nghỉ giữa hai đề, để kịp nghe từ vừa hứng. */
export const ROUND_GAP = 1;
/** Tốc độ khi dùng Đèn Pin (làm chậm rơi). */
export const SLOW_FACTOR = 0.5;
/** Bước thời gian tối đa mỗi khung (giây): chuyển tab quay lại sao không rơi một mạch. */
export const MAX_STEP = 0.1;

/** Kết quả chung cho những khung hình không có sự kiện, khỏi tạo mảng mới mỗi khung. */
const NO_EVENTS: readonly StarEvent[] = Object.freeze([]);

/** Luật trò Hứng Sao, tách khỏi phần vẽ để test được. */
export class StarGame {
  stars: Star[] = [];
  basketX = 0.5;
  round = 0;
  mistakes = 0;
  over = false;
  readonly prompts: LearnItem[];

  private nextId = 1;
  private spawnIn = 0;
  private slowLeft = 0;
  private wrongThisRound = false;
  private readonly firstTrySet = new Set<string>();
  private readonly wrongSet = new Set<string>();

  constructor(
    private readonly pool: readonly LearnItem[],
    readonly config: StarConfig,
    private readonly rng: Rng = Math.random,
  ) {
    // Bộ từ ít hơn số đề thì xáo lại và dùng tiếp.
    const prompts: LearnItem[] = [];
    while (pool.length > 0 && prompts.length < config.rounds) prompts.push(...shuffle(pool, rng));
    this.prompts = prompts.slice(0, config.rounds);
    if (this.prompts.length === 0) this.over = true;
  }

  get prompt(): LearnItem | undefined {
    return this.prompts[this.round];
  }

  get speed(): number {
    return this.config.speed * (this.slowLeft > 0 ? SLOW_FACTOR : 1);
  }

  get firstTry(): string[] {
    // Từ lặp lại ở nhiều lượt: đã từng sai thì không tính "đúng ngay".
    return [...this.firstTrySet].filter((id) => !this.wrongSet.has(id));
  }

  get wrong(): string[] {
    return [...this.wrongSet];
  }

  /** Đang rơi chậm nhờ Đèn Pin: bấm thêm cũng không chậm hơn (không cộng dồn). */
  get slowed(): boolean {
    return this.slowLeft > 0;
  }

  moveBasket(x: number): void {
    this.basketX = Math.min(1, Math.max(0, x));
  }

  /** Đèn Pin của G2: rơi chậm lại trong `seconds` giây. */
  slowDown(seconds: number): void {
    this.slowLeft = Math.max(this.slowLeft, seconds);
  }

  /**
   * Tiến thời gian `dt` giây. Gọi mỗi khung hình nên khung không có gì xảy ra không tạo mảng nào
   * (trả `NO_EVENTS`, chỉ đọc).
   */
  tick(dt: number): readonly StarEvent[] {
    if (this.over) return NO_EVENTS;
    const step = Math.min(dt, MAX_STEP);
    let events: StarEvent[] | undefined;
    const move = this.speed * step;
    if (this.slowLeft > 0) {
      this.slowLeft = Math.max(0, this.slowLeft - step);
      if (this.slowLeft === 0) events = [{ type: 'slow-end' }];
    }

    // `resolve` gán mảng mới cho `this.stars` chứ không sửa mảng cũ, nên duyệt thẳng mảng cũ vẫn an toàn.
    let anyFallen = false;
    for (const star of this.stars) {
      const before = star.y;
      star.y += move;
      if (before < BASKET_Y && star.y >= BASKET_Y && Math.abs(star.x - this.basketX) <= BASKET_HALF) {
        (events ??= []).push(...this.resolve(star));
        if (star.correct) return events;
      }
      if (star.y >= 1) anyFallen = true;
    }

    if (anyFallen) {
      const lost = this.stars.find((s) => s.y >= 1 && s.correct);
      this.stars = this.stars.filter((s) => s.y < 1);
      if (lost) {
        // Sao đúng rơi mất: cả lượt sao rơi lại từ trên cho cùng đề.
        (events ??= []).push({ type: 'lost', star: lost });
        this.stars = [];
        this.spawnIn = 0;
      }
    }

    if (this.stars.length === 0) {
      this.spawnIn -= step;
      if (this.spawnIn <= 0) (events ??= []).push({ type: 'spawn', stars: this.spawn() });
    }
    return events ?? NO_EVENTS;
  }

  /** Hứng một sao ngay (nút trợ năng / bàn phím): như khi sao rơi vào giỏ. */
  catchStar(id: number): StarEvent[] {
    const star = this.stars.find((s) => s.id === id);
    if (this.over || !star) return [];
    this.moveBasket(star.x);
    return this.resolve(star);
  }

  private resolve(star: Star): StarEvent[] {
    const prompt = this.prompt!;
    if (!star.correct) {
      this.stars = this.stars.filter((s) => s !== star);
      this.mistakes++;
      this.wrongThisRound = true;
      this.wrongSet.add(prompt.id);
      return [{ type: 'wrong', star }];
    }
    this.stars = [];
    if (!this.wrongThisRound) this.firstTrySet.add(prompt.id);
    this.wrongThisRound = false;
    this.round++;
    const events: StarEvent[] = [{ type: 'caught', star }];
    if (this.round >= this.prompts.length) {
      this.over = true;
      events.push({ type: 'over' });
      return events;
    }
    this.spawnIn = ROUND_GAP;
    events.push({ type: 'round', prompt: this.prompt! });
    return events;
  }

  private spawn(): Star[] {
    const prompt = this.prompt!;
    // Sao sai không trùng nghĩa / hình với đề, để không có hai đáp án đúng.
    const others = this.pool.filter(
      (i) => i.id !== prompt.id && i.meaningVi !== prompt.meaningVi && i.emoji !== prompt.emoji,
    );
    const wrongItems = shuffle(others, this.rng).slice(0, this.config.wrongStars);
    const items = [prompt, ...wrongItems];
    // Mỗi sao một làn riêng, để giỏ không hứng hai sao cùng lúc.
    const lanes = shuffle(
      items.map((_, i) => i),
      this.rng,
    );
    this.stars = items.map((item, i) => ({
      id: this.nextId++,
      item,
      correct: i === 0,
      x: (lanes[i]! + 0.5) / items.length,
      y: 0,
    }));
    return [...this.stars];
  }
}
