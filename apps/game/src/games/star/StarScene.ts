/* v8 ignore file -- vẽ Phaser, kiểm bằng E2E */
import * as Phaser from 'phaser';
import { BASKET_Y, type Star, type StarEvent, type StarGame } from './StarGame';

export interface StarLabel {
  main: string;
  sub?: string;
}

export interface StarController {
  game: StarGame;
  label(star: Star): StarLabel;
  fontScale: number;
  onEvents(events: readonly StarEvent[]): void;
  onStarTap(star: Star): void;
  onBasketMove(x: number): void;
}

const FONT = '"Noto Sans JP", "Noto Sans", sans-serif';
const COLORS = { star: 0xfff3c4, rim: 0xd69e2e, text: '#5a3d00', sub: '#7a5a1a', spark: 0xf6c453, poof: 0xb8c4cc };

/**
 * Vẽ ngôi sao và giỏ theo trạng thái của StarGame. Luật chơi nằm ở StarGame, cảnh này chỉ vẽ.
 * Phần vẽ được kiểm bằng E2E (apps/game/e2e), không có unit test.
 */
export class StarScene extends Phaser.Scene {
  private views = new Map<number, Phaser.GameObjects.Container>();
  private bursts = new Map<number, 'caught' | 'wrong'>();
  /** Id sao còn trên trời, dùng lại mỗi khung hình (sync chạy 60 lần/giây). */
  private readonly alive = new Set<number>();
  private basket: Phaser.GameObjects.Text | null = null;
  private dragging = false;

  constructor(
    private readonly ctl: StarController,
    /** Mật độ điểm ảnh: canvas vẽ ở độ phân giải thật của màn hình để chữ không mờ. */
    private readonly pixelRatio = 1,
  ) {
    super('star');
  }

  burst(starId: number, kind: 'caught' | 'wrong'): void {
    this.bursts.set(starId, kind);
  }

  create(): void {
    const size = Math.round(56 * this.ctl.fontScale * this.pixelRatio);
    this.basket = this.add.text(0, 0, '🧺', { fontFamily: FONT, fontSize: `${size}px` }).setOrigin(0.5, 0.35);
    const move = (pointer: Phaser.Input.Pointer) => this.ctl.onBasketMove(pointer.x / this.scale.width);
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      // Chạm vào sao là nghe từ, không kéo giỏ.
      if (over.length > 0) return;
      this.dragging = true;
      move(pointer);
    });
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.dragging || !pointer.wasTouch) move(pointer);
    });
    this.input.on('pointerup', () => (this.dragging = false));
    this.input.on('pointerupoutside', () => (this.dragging = false));
  }

  override update(_time: number, delta: number): void {
    const game = this.ctl.game;
    if (!game.over) {
      // Giới hạn bước thời gian để khi chuyển tab quay lại sao không rơi một mạch.
      const events = game.tick(Math.min(delta, 100) / 1000);
      if (events.length > 0) {
        for (const e of events) {
          if (e.type === 'caught' || e.type === 'wrong') this.burst(e.star.id, e.type);
        }
        this.ctl.onEvents(events);
      }
    }
    this.sync(game.stars);
    this.basket?.setPosition(game.basketX * this.scale.width, this.toY(BASKET_Y));
  }

  /** Đổi y (0–1) của luật sang toạ độ canvas, chừa lề trên và dưới cho sao. */
  private toY(y: number): number {
    const margin = 40 * this.ctl.fontScale * this.pixelRatio;
    return margin + y * (this.scale.height - margin * 2);
  }

  private sync(stars: Star[]): void {
    const { width } = this.scale;
    const alive = this.alive;
    alive.clear();
    for (const star of stars) {
      alive.add(star.id);
      let view = this.views.get(star.id);
      if (!view) {
        view = this.createView(star);
        this.views.set(star.id, view);
      }
      const radius = (view.getData('radius') as number) ?? 40;
      view.setPosition(
        Phaser.Math.Clamp(star.x * width, radius + 4 * this.pixelRatio, width - radius - 4 * this.pixelRatio),
        this.toY(star.y),
      );
    }
    // Mọi sao còn lại đều đã có hình: cùng số lượng thì không có hình nào cần gỡ.
    if (this.views.size === alive.size) return;
    for (const [id, view] of this.views) {
      if (alive.has(id)) continue;
      this.views.delete(id);
      const kind = this.bursts.get(id);
      this.bursts.delete(id);
      this.animateOut(view, kind);
    }
  }

  private createView(star: Star): Phaser.GameObjects.Container {
    const { main, sub } = this.ctl.label(star);
    const k = this.ctl.fontScale * this.pixelRatio;
    const size = Math.round(22 * k);
    const text = this.add
      .text(0, sub ? -size * 0.35 : 0, main, {
        fontFamily: FONT,
        fontSize: `${size}px`,
        color: COLORS.text,
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    let textWidth = text.width;
    let subText: Phaser.GameObjects.Text | undefined;
    if (sub) {
      subText = this.add
        .text(0, size * 0.65, sub, { fontFamily: FONT, fontSize: `${Math.round(size * 0.6)}px`, color: COLORS.sub })
        .setOrigin(0.5);
      textWidth = Math.max(textWidth, subText.width);
    }
    const radius = Math.max(42 * k, textWidth / 2 + 22 * this.pixelRatio);
    const points: number[] = [];
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? radius : radius * 0.72;
      const angle = -Math.PI / 2 + (Math.PI * i) / 5;
      points.push(radius + Math.cos(angle) * r, radius + Math.sin(angle) * r);
    }
    // Điểm của đa giác nằm trong ô dương; gốc mặc định 0,5 đặt hình vào giữa sao.
    const shape = this.add.polygon(0, 0, points, COLORS.star).setStrokeStyle(3 * this.pixelRatio, COLORS.rim);
    const hit = this.add.circle(0, 0, radius, 0xffffff, 0.001);
    hit.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.ctl.onStarTap(star));
    const parts: Phaser.GameObjects.GameObject[] = [shape, hit, text];
    if (subText) parts.push(subText);
    const view = this.add.container(0, 0, parts);
    view.setData('radius', radius);
    view.setScale(0.4);
    this.tweens.add({ targets: view, scale: 1, duration: 220, ease: 'Back.Out' });
    return view;
  }

  private animateOut(view: Phaser.GameObjects.Container, kind: 'caught' | 'wrong' | undefined): void {
    const radius = (view.getData('radius') as number) ?? 40;
    if (kind === 'caught') {
      for (let i = 0; i < 8; i++) {
        const angle = (Math.PI * 2 * i) / 8;
        const spark = this.add.circle(view.x, view.y, radius * 0.18, COLORS.spark);
        this.tweens.add({
          targets: spark,
          x: view.x + Math.cos(angle) * radius * 1.4,
          y: view.y + Math.sin(angle) * radius * 1.4,
          alpha: 0,
          duration: 450,
          onComplete: () => spark.destroy(),
        });
      }
    } else if (kind === 'wrong') {
      const poof = this.add.circle(view.x, view.y, radius * 0.6, COLORS.poof, 0.6);
      this.tweens.add({ targets: poof, scale: 2, alpha: 0, duration: 400, onComplete: () => poof.destroy() });
    }
    view.destroy();
  }
}

export function startStarScene(parent: HTMLElement, ctl: StarController): { scene: StarScene; destroy(): void } {
  const ratio = Math.min(window.devicePixelRatio || 1, 3);
  const scene = new StarScene(ctl, ratio);
  const size = () => [Math.max(1, parent.clientWidth * ratio), Math.max(1, parent.clientHeight * ratio)] as const;
  const [width, height] = size();
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    transparent: true,
    // Canvas lớn theo điểm ảnh thật, hiển thị thu lại 1/ratio: sắc nét trên màn hình mật độ cao.
    scale: { mode: Phaser.Scale.NONE, width, height, zoom: 1 / ratio },
    scene,
    banner: false,
    audio: { noAudio: true },
  });
  const observer = new ResizeObserver(() => game.scale.resize(...size()));
  observer.observe(parent);
  return {
    scene,
    destroy: () => {
      observer.disconnect();
      game.destroy(true);
    },
  };
}
