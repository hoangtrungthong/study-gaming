import { describe, expect, it } from 'vitest';
import { decks, type LearnItem } from '@study/content';
import { STAR_CONFIG, type StarConfig } from '../ageConfig';
import { seededRng } from '../random';
import { BASKET_HALF, BASKET_Y, MAX_STEP, ROUND_GAP, StarGame } from './StarGame';

const config: StarConfig = { rounds: 3, wrongStars: 2, speed: 1 };
const pool = decks.en.items.slice(0, 6);

/** Tiến thời gian nhiều khung (mỗi khung tối đa MAX_STEP). */
function run(g: StarGame, seconds: number) {
  const events = [];
  for (let t = 0; t < seconds - 1e-9; t += MAX_STEP) events.push(...g.tick(MAX_STEP));
  return events;
}

const correctStar = (g: StarGame) => g.stars.find((s) => s.correct)!;
const wrongStar = (g: StarGame) => g.stars.find((s) => !s.correct)!;

describe('StarGame', () => {
  it('sinh lượt sao ngay: 1 sao đúng + số sao sai theo nhóm tuổi, mỗi sao một làn', () => {
    const g = new StarGame(pool, config, seededRng(1));
    expect(g.prompts).toHaveLength(3);
    const events = g.tick(0.01);
    expect(events.map((e) => e.type)).toEqual(['spawn']);
    expect(g.stars).toHaveLength(3);
    expect(g.stars.filter((s) => s.correct)).toHaveLength(1);
    expect(correctStar(g).item).toBe(g.prompt);
    const xs = g.stars.map((s) => s.x).sort();
    expect(xs.map((x) => +x.toFixed(3))).toEqual([0.167, 0.5, 0.833]);
    for (const s of g.stars.filter((s) => !s.correct)) {
      expect(s.item.id).not.toBe(g.prompt!.id);
      expect(s.item.emoji).not.toBe(g.prompt!.emoji);
    }
  });

  it('khung hình không có sự kiện (kể cả khi đã xong) trả cùng một mảng rỗng chỉ đọc, không tạo mảng mới', () => {
    const g = new StarGame(pool, config, seededRng(1));
    g.tick(0.01);
    g.moveBasket(correctStar(g).x > 0.5 ? 0 : 1);
    const idle = g.tick(0.01);
    expect(idle).toEqual([]);
    expect(g.tick(0.01)).toBe(idle);
    expect(Object.isFrozen(idle)).toBe(true);
    expect(new StarGame([], config).tick(0.01)).toBe(idle);
  });

  it('di chuyển giỏ bị kẹp trong 0–1', () => {
    const g = new StarGame(pool, config, seededRng(2));
    g.moveBasket(-1);
    expect(g.basketX).toBe(0);
    g.moveBasket(2);
    expect(g.basketX).toBe(1);
    g.moveBasket(0.3);
    expect(g.basketX).toBe(0.3);
  });

  it('bước thời gian bị giới hạn: chuyển tab quay lại sao không rơi một mạch', () => {
    const g = new StarGame(pool, config, seededRng(3));
    g.tick(0.01);
    g.moveBasket(correctStar(g).x > 0.5 ? 0 : 1);
    g.tick(10);
    expect(correctStar(g).y).toBeCloseTo(MAX_STEP);
  });

  it('hứng sao đúng: sang đề mới sau một quãng nghỉ; hứng đủ đề thì kết thúc', () => {
    const g = new StarGame(pool, config, seededRng(4));
    for (let round = 0; round < 3; round++) {
      if (round === 0) g.tick(0.01);
      else run(g, ROUND_GAP + MAX_STEP);
      const prompt = g.prompt!;
      g.moveBasket(correctStar(g).x);
      const events = run(g, 1);
      const caught = events.find((e) => e.type === 'caught');
      expect(caught && caught.type === 'caught' && caught.star.item).toBe(prompt);
      expect(g.stars).toEqual([]);
      if (round < 2) expect(events.at(-1)).toEqual({ type: 'round', prompt: g.prompt });
    }
    expect(g.over).toBe(true);
    expect(g.round).toBe(3);
    expect(g.mistakes).toBe(0);
    expect(g.firstTry).toHaveLength(new Set(g.prompts.map((p) => p.id)).size);
    expect(g.wrong).toEqual([]);
    expect(g.tick(1)).toEqual([]);
    expect(g.catchStar(1)).toEqual([]);
  });

  it('hứng sao sai: tính một lỗi, sao đó biến mất, các sao khác vẫn rơi, đề giữ nguyên', () => {
    const g = new StarGame(pool, config, seededRng(5));
    g.tick(0.01);
    const prompt = g.prompt!;
    const wrong = wrongStar(g);
    g.moveBasket(wrong.x);
    const events = run(g, 0.9);
    expect(events).toContainEqual({ type: 'wrong', star: wrong });
    expect(g.mistakes).toBe(1);
    expect(g.stars).toHaveLength(2);
    expect(g.stars).not.toContain(wrong);
    expect(g.prompt).toBe(prompt);
    expect(g.wrong).toEqual([prompt.id]);

    // Hứng đúng sau khi đã sai: không tính là đúng ngay lần đầu.
    const events2 = g.catchStar(correctStar(g).id);
    expect(events2[0]!.type).toBe('caught');
    expect(g.firstTry).toEqual([]);
  });

  it('sao đúng rơi mất: báo lỡ, cả lượt sao rơi lại cho cùng đề, không tính lỗi', () => {
    const g = new StarGame(pool, config, seededRng(6));
    g.tick(0.01);
    const prompt = g.prompt!;
    // Giỏ đặt giữa hai làn, không hứng được sao nào.
    g.moveBasket(0.5 + BASKET_HALF + 0.03);
    for (const s of g.stars) s.y = 0.95;
    const events = g.tick(0.1);
    const types = events.map((e) => e.type);
    expect(types).toContain('lost');
    expect(types.at(-1)).toBe('spawn');
    expect(g.prompt).toBe(prompt);
    expect(g.mistakes).toBe(0);
    expect(g.stars).toHaveLength(3);
    expect(g.stars.every((s) => s.y === 0)).toBe(true);
  });

  it('sao sai rơi khỏi khung trước sao đúng thì chỉ biến mất', () => {
    const g = new StarGame(pool, config, seededRng(7));
    g.tick(0.01);
    const wrong = wrongStar(g);
    wrong.y = 0.99;
    g.moveBasket(0.5 + BASKET_HALF + 0.03);
    const events = g.tick(0.05);
    expect(events).toEqual([]);
    expect(g.stars).not.toContain(wrong);
    expect(g.stars).toHaveLength(2);
  });

  it('sao rơi qua vạch giỏ ngoài tầm giỏ thì không được hứng', () => {
    const g = new StarGame(pool, config, seededRng(8));
    g.tick(0.01);
    const star = correctStar(g);
    star.y = BASKET_Y - 0.01;
    g.moveBasket(star.x + BASKET_HALF + 0.01 > 1 ? star.x - BASKET_HALF - 0.01 : star.x + BASKET_HALF + 0.01);
    expect(g.tick(0.05).some((e) => e.type === 'caught' || e.type === 'wrong')).toBe(false);
  });

  it('Đèn Pin làm chậm rơi trong số giây đã định', () => {
    const g = new StarGame(pool, { ...config, speed: 0.1 }, seededRng(9));
    g.tick(0.01);
    expect(g.speed).toBe(0.1);
    expect(g.slowed).toBe(false);
    g.slowDown(0.2);
    g.slowDown(0.1); // gọi ngắn hơn không rút ngắn thời gian còn lại
    expect(g.speed).toBe(0.05);
    expect(g.slowed).toBe(true);
    expect(g.tick(0.1).some((e) => e.type === 'slow-end')).toBe(false);
    expect(g.speed).toBe(0.05);
    // Hết thời gian chậm: báo một lần để giao diện bật lại nút Đèn Pin.
    expect(g.tick(0.1).some((e) => e.type === 'slow-end')).toBe(true);
    expect(g.speed).toBe(0.1);
    expect(g.slowed).toBe(false);
    expect(g.tick(0.01).some((e) => e.type === 'slow-end')).toBe(false);
  });

  it('hứng bằng nút trợ năng: đưa giỏ tới sao; id không có thì bỏ qua', () => {
    const g = new StarGame(pool, config, seededRng(10));
    g.tick(0.01);
    const wrong = wrongStar(g);
    expect(g.catchStar(wrong.id)).toEqual([{ type: 'wrong', star: wrong }]);
    expect(g.basketX).toBe(wrong.x);
    expect(g.catchStar(9999)).toEqual([]);
  });

  it('bộ từ ít hơn số đề thì dùng lại; chỉ một từ thì không có sao sai; bộ rỗng thì xong ngay', () => {
    const few = new StarGame(pool.slice(0, 2), { ...config, rounds: 5 }, seededRng(11));
    expect(few.prompts).toHaveLength(5);
    const one = new StarGame(pool.slice(0, 1), config, seededRng(12));
    one.tick(0.01);
    expect(one.stars).toHaveLength(1);
    const empty = new StarGame([] as LearnItem[], config);
    expect(empty.over).toBe(true);
    expect(empty.prompt).toBeUndefined();
    expect(empty.tick(1)).toEqual([]);
  });

  it('cấu hình theo nhóm tuổi: Mầm 5 đề 1 sao sai, Cây 10 đề 3 sao sai', () => {
    const mam = new StarGame(decks.en.items, STAR_CONFIG.mam);
    mam.tick(0.01);
    expect(mam.prompts).toHaveLength(5);
    expect(mam.stars).toHaveLength(2);
    const cay = new StarGame(decks.en.items, STAR_CONFIG.cay);
    cay.tick(0.01);
    expect(cay.prompts).toHaveLength(10);
    expect(cay.stars).toHaveLength(4);
  });

  it('từ lặp lại: đúng ngay ở lượt trước, sai ở lượt sau thì không còn trong firstTry', () => {
    const two = pool.slice(0, 2);
    const g = new StarGame(two, { rounds: 4, wrongStars: 1, speed: 1 }, seededRng(2));
    const seen = new Set<string>();
    let missed = '';
    while (!g.over) {
      run(g, ROUND_GAP + 0.05);
      const prompt = g.prompt!;
      if (!missed && seen.has(prompt.id) && g.firstTry.includes(prompt.id)) {
        g.catchStar(wrongStar(g).id);
        missed = prompt.id;
      }
      seen.add(prompt.id);
      g.catchStar(correctStar(g).id);
    }
    expect(missed).not.toBe('');
    expect(g.firstTry).not.toContain(missed);
    expect(g.wrong).toEqual([missed]);
  });
});
