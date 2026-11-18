import { describe, expect, it } from 'vitest';
import { decks, type LearnItem } from '@study/content';
import { RAIN_CONFIG, type RainConfig } from '../ageConfig';
import { seededRng } from '../random';
import { RainGame } from './RainGame';
import { promptLabel } from './labels';

const config: RainConfig = { maxDrops: 2, spawnEvery: 1, speed: 0.5, speedUpPerMinute: 0, lives: 2, duration: 30 };

describe('RainGame', () => {
  it('sinh hạt mưa đầu tiên ngay, sau đó theo nhịp và không quá maxDrops', () => {
    const g = new RainGame('en', decks.en.items, config, seededRng(1));
    expect(g.tick(0.01).map((e) => e.type)).toEqual(['spawn']);
    expect(g.tick(0.5)).toEqual([]);
    expect(g.tick(0.6).map((e) => e.type)).toEqual(['spawn']);
    expect(g.drops).toHaveLength(2);
    g.tick(0.2);
    expect(g.drops).toHaveLength(2);
  });

  it('không cho hai hạt cùng một từ trên màn hình', () => {
    const g = new RainGame('en', decks.en.items.slice(0, 1), { ...config, maxDrops: 3 }, seededRng(2));
    g.tick(0.01);
    g.tick(1.01);
    expect(g.drops).toHaveLength(1);
  });

  it('gõ đúng phá hạt rơi thấp nhất có cùng đáp án, cộng điểm', () => {
    const item = decks.ja.items.find((i) => i.id === 'ja-mizu')!;
    const g = new RainGame('ja', [item, decks.ja.items[0]!], config, seededRng(3));
    g.tick(0.01);
    g.tick(1);
    const target = g.drops.find((d) => d.item.id === 'ja-mizu')!;
    expect(g.submit('mizu')).toBe(target);
    expect(g.score).toBe(1);
    expect(g.hits).toEqual([item]);
    expect(g.submit('mizu')).toBeNull();
  });

  it('hạt chạm đất thì mất một chậu hoa và ghi vào danh sách lỡ', () => {
    const g = new RainGame('en', decks.en.items, { ...config, lives: 3 }, seededRng(4));
    g.tick(0.01);
    const first = g.drops[0]!.item;
    const events = g.tick(2.1);
    expect(events.some((e) => e.type === 'miss')).toBe(true);
    expect(g.lives).toBeLessThan(3);
    expect(g.missed[0]).toBe(first);
  });

  it('hết chậu hoa thì kết thúc', () => {
    const g = new RainGame('en', decks.en.items, { ...config, lives: 1 }, seededRng(5));
    g.tick(0.01);
    const events = g.tick(2.5);
    expect(events.at(-1)).toEqual({ type: 'over', reason: 'lives' });
    expect(g.over).toBe(true);
    expect(g.drops).toEqual([]);
    expect(g.tick(1)).toEqual([]);
    expect(g.submit(g.missed[0]!.term)).toBeNull();
  });

  it('hết giờ thì kết thúc', () => {
    const g = new RainGame('en', decks.en.items, { ...config, duration: 0.5, speed: 0 }, seededRng(6));
    g.tick(0.01);
    expect(g.tick(0.6).at(-1)).toEqual({ type: 'over', reason: 'time' });
    expect(g.timeLeft).toBe(0);
  });

  it('tốc độ tăng theo thời gian chơi', () => {
    const g = new RainGame('en', decks.en.items, {
      ...config,
      speedUpPerMinute: 0.5,
      speed: 0.1,
      duration: 999,
      lives: 99,
    });
    const before = g.speed;
    g.elapsed = 60;
    expect(g.speed).toBeCloseTo(before * 1.5);
  });

  it('tiếp tục sinh từ khi đã dùng hết một vòng bộ từ', () => {
    const items = decks.en.items.slice(0, 2);
    const g = new RainGame('en', items, { ...config, maxDrops: 1 }, seededRng(7));
    const seen: string[] = [];
    for (let i = 0; i < 4; i++) {
      g.tick(1.01);
      const d = g.drops[0]!;
      seen.push(d.item.id);
      g.submit(d.item.term);
    }
    expect(seen).toHaveLength(4);
    expect(new Set(seen)).toEqual(new Set(items.map((i) => i.id)));
  });

  it('cấu hình nhóm Mầm chậm và ít hạt hơn nhóm Cây', () => {
    expect(RAIN_CONFIG.mam.maxDrops).toBeLessThan(RAIN_CONFIG.cay.maxDrops);
    expect(RAIN_CONFIG.mam.speed).toBeLessThan(RAIN_CONFIG.cay.speed);
    expect(RAIN_CONFIG.mam.speedUpPerMinute).toBe(0);
  });
});

describe('promptLabel', () => {
  const kanji: LearnItem = { id: 'ja-mizu', term: '水', reading: 'みず', emoji: '💧', meaningVi: 'nước' };
  const kana: LearnItem = { id: 'ja-neko', term: 'ねこ', emoji: '🐱', meaningVi: 'con mèo' };

  it('chế độ từ gốc: kanji kèm cách đọc, かな thì không', () => {
    expect(promptLabel(kanji, 'term')).toEqual({ main: '水', sub: 'みず' });
    expect(promptLabel(kana, 'term')).toEqual({ main: 'ねこ' });
  });
  it('chế độ nghĩa và chế độ nghe', () => {
    expect(promptLabel(kana, 'meaning')).toEqual({ main: '🐱 con mèo' });
    expect(promptLabel(kana, 'audio')).toEqual({ main: '🔊' });
  });
});
