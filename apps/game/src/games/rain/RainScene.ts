/* v8 ignore file -- vẽ bằng Phaser (canvas/WebGL) không chạy được trong jsdom; được kiểm bằng E2E (apps/game/e2e). */
import * as Phaser from 'phaser';
import type { Drop, RainEvent, RainGame } from './RainGame';

export interface DropLabel {
  main: string;
  sub?: string;
}

export interface RainController {
  game: RainGame;
  paused(): boolean;
  label(drop: Drop): DropLabel;
  fontScale: number;
  onEvents(events: RainEvent[]): void;
  onDropTap(drop: Drop): void;
}

const FONT = '"Noto Sans JP", "Noto Sans", sans-serif';
const COLORS = { drop: 0xdff1fb, rim: 0x2f6f8f, text: '#173b4d', sub: '#4d6b7a', flower: 0xf6c453, splash: 0x7fb7d6 };

/**
 * Vẽ hạt mưa theo trạng thái của RainGame. Luật chơi nằm ở RainGame, cảnh này chỉ vẽ.
 * Phần vẽ được kiểm bằng E2E (apps/game/e2e), không có unit test.
 */
export class RainScene extends Phaser.Scene {
  private views = new Map<number, Phaser.GameObjects.Container>();
  private bursts = new Map<number, 'hit' | 'miss'>();

  constructor(
    private readonly ctl: RainController,
    /** Mật độ điểm ảnh: canvas vẽ ở độ phân giải thật của màn hình để chữ không mờ. */
    private readonly pixelRatio = 1,
  ) {
    super('rain');
  }

  burst(dropId: number, kind: 'hit' | 'miss'): void {
    this.bursts.set(dropId, kind);
  }

  override update(_time: number, delta: number): void {
    const game = this.ctl.game;
    if (!this.ctl.paused() && !game.over) {
      // Giới hạn bước thời gian để khi chuyển tab quay lại hạt mưa không rơi một mạch.
      const events = game.tick(Math.min(delta, 100) / 1000);
      for (const e of events) if (e.type === 'miss') this.burst(e.drop.id, 'miss');
      // Gọi cả khi không có sự kiện: RainView đọc lời khen đang chờ ở khung hình này.
      this.ctl.onEvents(events);
    }
    this.sync(game.drops);
  }

  private sync(drops: Drop[]): void {
    const { width, height } = this.scale;
    const alive = new Set<number>();
    for (const drop of drops) {
      alive.add(drop.id);
      let view = this.views.get(drop.id);
      if (!view) {
        view = this.createView(drop);
        this.views.set(drop.id, view);
      }
      const radius = (view.getData('radius') as number) ?? 40;
      view.setPosition(
        Phaser.Math.Clamp(drop.x * width, radius + 4 * this.pixelRatio, width - radius - 4 * this.pixelRatio),
        radius + drop.y * (height - radius * 2),
      );
    }
    for (const [id, view] of this.views) {
      if (alive.has(id)) continue;
      this.views.delete(id);
      const kind = this.bursts.get(id);
      this.bursts.delete(id);
      this.animateOut(view, kind);
    }
  }

  private createView(drop: Drop): Phaser.GameObjects.Container {
    const { main, sub } = this.ctl.label(drop);
    const k = this.ctl.fontScale * this.pixelRatio;
    const size = Math.round(24 * k);
    const text = this.add
      .text(0, sub ? -size * 0.35 : 0, main, {
        fontFamily: FONT,
        fontSize: `${size}px`,
        color: COLORS.text,
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    const parts: Phaser.GameObjects.GameObject[] = [];
    let textWidth = text.width;
    let subText: Phaser.GameObjects.Text | undefined;
    if (sub) {
      subText = this.add
        .text(0, size * 0.65, sub, { fontFamily: FONT, fontSize: `${Math.round(size * 0.6)}px`, color: COLORS.sub })
        .setOrigin(0.5);
      textWidth = Math.max(textWidth, subText.width);
    }
    const radius = Math.max(40 * k, textWidth / 2 + 18 * this.pixelRatio);
    const circle = this.add.circle(0, 0, radius, COLORS.drop).setStrokeStyle(3 * this.pixelRatio, COLORS.rim);
    circle.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.ctl.onDropTap(drop));
    parts.push(circle, text);
    if (subText) parts.push(subText);
    const view = this.add.container(0, 0, parts);
    view.setData('radius', radius);
    view.setScale(0.4);
    this.tweens.add({ targets: view, scale: 1, duration: 220, ease: 'Back.Out' });
    return view;
  }

  private animateOut(view: Phaser.GameObjects.Container, kind: 'hit' | 'miss' | undefined): void {
    if (kind === 'hit') {
      const radius = (view.getData('radius') as number) ?? 40;
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI * 2 * i) / 6;
        const petal = this.add.circle(view.x, view.y, radius * 0.3, COLORS.flower);
        this.tweens.add({
          targets: petal,
          x: view.x + Math.cos(angle) * radius * 1.2,
          y: view.y + Math.sin(angle) * radius * 1.2,
          alpha: 0,
          duration: 420,
          onComplete: () => petal.destroy(),
        });
      }
      view.destroy();
      return;
    }
    if (kind === 'miss') {
      const r = this.pixelRatio;
      const splash = this.add.ellipse(view.x, this.scale.height - 8 * r, 30 * r, 10 * r, COLORS.splash);
      this.tweens.add({ targets: splash, scaleX: 4, alpha: 0, duration: 450, onComplete: () => splash.destroy() });
    }
    view.destroy();
  }
}

export function startRainScene(parent: HTMLElement, ctl: RainController): { scene: RainScene; destroy(): void } {
  const ratio = Math.min(window.devicePixelRatio || 1, 3);
  const scene = new RainScene(ctl, ratio);
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
