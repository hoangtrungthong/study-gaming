import { isCorrectAnswer, type LearnItem, type Subject } from '@study/content';
import type { RainConfig } from '../ageConfig';
import { shuffle, type Rng } from '../random';

export interface Drop {
  id: number;
  item: LearnItem;
  /** Vị trí ngang 0–1 (giữa hạt mưa). */
  x: number;
  /** Vị trí dọc 0–1; chạm 1 là rơi xuống đất. */
  y: number;
}

export type RainEvent =
  { type: 'spawn'; drop: Drop } | { type: 'miss'; drop: Drop } | { type: 'over'; reason: 'time' | 'lives' };

/** Luật trò Mưa Chữ, tách khỏi phần vẽ để test được. */
export class RainGame {
  drops: Drop[] = [];
  score = 0;
  lives: number;
  elapsed = 0;
  over = false;
  readonly missed: LearnItem[] = [];
  readonly hits: LearnItem[] = [];

  private nextId = 1;
  private sinceSpawn: number;
  private queue: LearnItem[] = [];

  constructor(
    private readonly subject: Subject,
    private readonly pool: readonly LearnItem[],
    readonly config: RainConfig,
    private readonly rng: Rng = Math.random,
  ) {
    this.lives = config.lives;
    // Hạt mưa đầu tiên rơi ngay khi bắt đầu.
    this.sinceSpawn = config.spawnEvery;
  }

  get speed(): number {
    return this.config.speed * (1 + (this.config.speedUpPerMinute * this.elapsed) / 60);
  }

  get timeLeft(): number {
    return Math.max(0, this.config.duration - this.elapsed);
  }

  /** Tiến thời gian `dt` giây. */
  tick(dt: number): RainEvent[] {
    if (this.over) return [];
    const events: RainEvent[] = [];
    this.elapsed += dt;
    this.sinceSpawn += dt;

    for (const drop of this.drops) drop.y += this.speed * dt;
    const fallen = this.drops.filter((d) => d.y >= 1);
    if (fallen.length > 0) {
      this.drops = this.drops.filter((d) => d.y < 1);
      for (const drop of fallen) {
        this.lives--;
        this.missed.push(drop.item);
        events.push({ type: 'miss', drop });
      }
    }

    if (this.lives <= 0) return this.finish(events, 'lives');
    if (this.elapsed >= this.config.duration) return this.finish(events, 'time');

    if (this.sinceSpawn >= this.config.spawnEvery && this.drops.length < this.config.maxDrops) {
      const drop = this.spawn();
      if (drop) events.push({ type: 'spawn', drop });
      this.sinceSpawn = 0;
    }
    return events;
  }

  /** Người chơi gõ xong một từ. Trả về hạt mưa bị phá, ưu tiên hạt rơi thấp nhất. */
  submit(input: string): Drop | null {
    if (this.over) return null;
    const target = [...this.drops].sort((a, b) => b.y - a.y).find((d) => isCorrectAnswer(this.subject, d.item, input));
    if (!target) return null;
    this.drops = this.drops.filter((d) => d !== target);
    this.score++;
    this.hits.push(target.item);
    return target;
  }

  private spawn(): Drop | null {
    const onScreen = new Set(this.drops.map((d) => d.item.id));
    if (this.queue.length === 0) this.queue = shuffle(this.pool, this.rng);
    const index = this.queue.findIndex((i) => !onScreen.has(i.id));
    if (index < 0) return null;
    const [item] = this.queue.splice(index, 1);
    const drop: Drop = { id: this.nextId++, item: item!, x: 0.15 + this.rng() * 0.7, y: 0 };
    this.drops.push(drop);
    return drop;
  }

  private finish(events: RainEvent[], reason: 'time' | 'lives'): RainEvent[] {
    this.over = true;
    this.drops = [];
    events.push({ type: 'over', reason });
    return events;
  }
}
