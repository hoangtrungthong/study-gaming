import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { decks, findLevel, islandContent, phrases, type Level } from '@study/content';
import { defaultSettings, settings } from '../../settings';
import { hints, START_HINTS } from '../hints';
import type { LevelResult } from '../result';
import type { StarController } from './StarScene';

const audio = vi.hoisted(() => ({
  mock: null as null | ReturnType<typeof import('../../test/audioMock').createAudioMock>,
}));
vi.mock('../../audio', async () => {
  const { createAudioMock } = await import('../../test/audioMock');
  audio.mock = createAudioMock();
  return audio.mock;
});

// Phaser không chạy được trong jsdom: thay cảnh bằng bản giả giữ lại controller để test tự "tick".
const scene = vi.hoisted(() => ({ ctl: null as null | StarController, destroy: vi.fn(), started: 0 }));
vi.mock('./StarScene', () => ({
  startStarScene: (_parent: HTMLElement, ctl: StarController) => {
    scene.ctl = ctl;
    scene.started++;
    return { scene: {}, destroy: scene.destroy };
  },
}));

const { default: StarView } = await import('./StarView.vue');

const realLevel = findLevel('en-r1-l4')!.level;
const allLevel = islandContent('en', 'star');

beforeEach(() => {
  Object.assign(settings, defaultSettings());
  hints.value = START_HINTS;
  audio.mock!.said.length = 0;
  audio.mock!.speaker.stop.mockClear();
  scene.ctl = null;
  scene.started = 0;
  scene.destroy.mockClear();
});

const lastSaid = () => audio.mock!.said.at(-1)!;
const ctl = () => scene.ctl!;
const correct = () => ctl().game.stars.find((s) => s.correct)!;
const wrong = () => ctl().game.stars.find((s) => !s.correct)!;

async function startGame(level: Level = realLevel) {
  const w = mount(StarView, { props: { deck: decks.en, level }, attachTo: document.body });
  await w.get('[data-testid="star-start"]').trigger('click');
  await flushPromises();
  return w;
}

/** Cho cảnh chạy `seconds` giây (mỗi khung 0,1 giây). */
async function advance(w: VueWrapper, seconds: number) {
  for (let t = 0; t < seconds; t += 0.1) ctl().onEvents(ctl().game.tick(0.1));
  await w.vm.$nextTick();
}

async function catchCorrect(w: VueWrapper) {
  if (ctl().game.stars.length === 0) await advance(w, 1.2);
  await w.vm.$nextTick();
  await w.get(`[data-testid="star-catch-${correct().item.id}"]`).trigger('click');
}

describe('StarView', () => {
  it('đọc hướng dẫn; bắt đầu thì dựng cảnh, hiện và đọc đề; danh sách sao có nút hứng', async () => {
    const w = mount(StarView, { props: { deck: decks.en, level: realLevel } });
    expect(audio.mock!.said[0]).toEqual([{ lang: 'vi', text: phrases.starIntro }]);
    expect(w.get('h2').text()).toBe('Hứng Sao');
    await w.get('[data-testid="star-start"]').trigger('click');
    await flushPromises();
    expect(scene.started).toBe(1);
    const prompt = ctl().game.prompt!;
    expect(realLevel.items).toContain(prompt.id);
    expect(w.get('[data-testid="star-prompt"]').text()).toContain(prompt.meaningVi);
    expect(lastSaid()).toEqual([{ lang: 'vi', text: prompt.meaningVi, translation: true }]);

    ctl().onEvents(ctl().game.tick(0.01));
    await w.vm.$nextTick();
    const items = w.findAll('[data-testid="star-falling"] li').map((li) => li.attributes('data-item-id'));
    expect(items).toHaveLength(3);
    expect(items).toContain(prompt.id);
    expect(w.find(`[data-testid="star-catch-${prompt.id}"]`).exists()).toBe(true);
    // Danh sách nút hứng ẩn nhưng hiện ra khi được Tab tới (CSS `.catch-list:has(:focus-visible)`).
    expect(w.get('[data-testid="star-falling"]').classes()).toEqual(['catch-list', 'sr-only']);
    expect(ctl().label(correct())).toEqual({ main: prompt.term });

    // Chạm sao là nghe từ; bấm đề là nghe lại đề.
    ctl().onStarTap(correct());
    expect(lastSaid()).toEqual([{ lang: 'en', text: prompt.term }]);
    await w.get('[data-testid="star-prompt"]').trigger('click');
    expect(lastSaid()).toEqual([{ lang: 'vi', text: prompt.meaningVi, translation: true }]);

    // Khung hình không có gì thì không đọc.
    const quiet = audio.mock!.said.length;
    ctl().onEvents([]);
    expect(audio.mock!.said).toHaveLength(quiet);
    w.unmount();
  });

  it('kéo giỏ bằng con trỏ và phím ← →; phím khác và lúc chưa chơi thì bỏ qua', async () => {
    const before = mount(StarView, { props: { deck: decks.en, level: realLevel } });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    before.unmount();

    const w = await startGame();
    const g = ctl().game;
    ctl().onBasketMove(0.3);
    expect(g.basketX).toBe(0.3);
    const left = new KeyboardEvent('keydown', { key: 'ArrowLeft', cancelable: true });
    window.dispatchEvent(left);
    expect(g.basketX).toBeCloseTo(0.22);
    expect(left.defaultPrevented).toBe(true);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(g.basketX).toBeCloseTo(0.38);
    const other = new KeyboardEvent('keydown', { key: 'a', cancelable: true });
    window.dispatchEvent(other);
    expect(other.defaultPrevented).toBe(false);
    expect(g.basketX).toBeCloseTo(0.38);

    // Gỡ màn thì bỏ nghe phím.
    w.unmount();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    expect(g.basketX).toBeCloseTo(0.38);
    expect(scene.destroy).toHaveBeenCalled();
    expect(audio.mock!.speaker.stop).toHaveBeenCalled();
  });

  it('hứng sai thì Tomo nhắc và đọc lại đề; sao đúng rơi mất thì báo và đọc lại đề', async () => {
    const w = await startGame();
    ctl().onEvents(ctl().game.tick(0.01));
    await w.vm.$nextTick();
    const prompt = ctl().game.prompt!;
    const promptSeg = { lang: 'vi', text: prompt.meaningVi, translation: true };

    await w.get(`[data-testid="star-catch-${wrong().item.id}"]`).trigger('click');
    expect(lastSaid()).toEqual([{ lang: 'vi', text: phrases.starWrong }, promptSeg]);
    expect(w.findAll('[data-testid="star-falling"] li')).toHaveLength(2);

    for (const s of ctl().game.stars) s.y = 0.999;
    ctl().onEvents(ctl().game.tick(0.1));
    expect(lastSaid()).toEqual([{ lang: 'vi', text: phrases.starLost }, promptSeg]);
    w.unmount();
  });

  it('hứng đúng: đọc từ + nghĩa rồi đề mới; hứng đủ đề thì phát kết quả có id màn và chơi lại được', async () => {
    const w = await startGame();
    ctl().onEvents(ctl().game.tick(0.01));
    const first = ctl().game.prompt!;
    await catchCorrect(w);
    const next = ctl().game.prompt!;
    expect(lastSaid()).toEqual([
      { lang: 'en', text: first.term },
      { lang: 'vi', text: first.meaningVi, translation: true },
      { lang: 'vi', text: next.meaningVi, translation: true },
    ]);
    expect(w.get('[data-testid="star-prompt"]').text()).toContain(next.meaningVi);
    expect(w.text()).toContain('2/8');

    // Một lần hứng sai để có lỗi.
    await advance(w, 1.2);
    await w.get(`[data-testid="star-catch-${wrong().item.id}"]`).trigger('click');
    const missedPrompt = ctl().game.prompt!.id;
    for (let i = 1; i < 8; i++) await catchCorrect(w);
    await flushPromises();

    expect(lastSaid().at(-1)).toEqual({ lang: 'vi', text: phrases.roundWin });
    expect(scene.destroy).toHaveBeenCalled();
    const result = w.emitted('finish')![0]![0] as LevelResult;
    expect(result).toMatchObject({ levelId: 'en-r1-l4', game: 'star', stars: 2, usedHint: false });
    expect(result.wrong).toEqual([missedPrompt]);
    expect(result.firstTry).toContain(first.id);
    expect(result.firstTry).not.toContain(missedPrompt);
    const panel = w.get('[data-testid="result"]');
    expect(panel.text()).toContain('nhầm 1 lần');
    expect(panel.find('[aria-label="2 trên 3 sao"]').exists()).toBe(true);

    await panel.get('.primary').trigger('click');
    await flushPromises();
    expect(scene.started).toBe(2);
    expect(w.find('[data-testid="star-prompt"]').exists()).toBe(true);
    w.unmount();
  });

  it('màn toàn đảo (-all) không gửi id màn; dùng Đèn Pin thì rơi chậm lại và không được 3 sao', async () => {
    settings.ageGroup = 'mam';
    const w = await startGame(allLevel);
    ctl().onEvents(ctl().game.tick(0.01));
    const speed = ctl().game.speed;
    await w.get('[data-testid="star-hint"]').trigger('click');
    expect(hints.value).toBe(START_HINTS - 1);
    expect(ctl().game.speed).toBeCloseTo(speed / 2);
    expect(lastSaid()).toEqual([{ lang: 'vi', text: phrases.hint }]);
    expect(w.get('[data-testid="star-hint"]').text()).toContain(String(START_HINTS - 1));
    // Đang rơi chậm thì nút tắt (bấm thêm không chậm hơn); hết thời gian chậm thì bật lại.
    expect(w.get('[data-testid="star-hint"]').attributes('disabled')).toBeDefined();
    for (let i = 0; i < 60 && ctl().game.slowed; i++) {
      for (const s of ctl().game.stars) s.y = 0;
      ctl().onEvents(ctl().game.tick(0.1));
    }
    await w.vm.$nextTick();
    expect(w.get('[data-testid="star-hint"]').attributes('disabled')).toBeUndefined();

    for (let i = 0; i < 5; i++) await catchCorrect(w);
    await flushPromises();
    const result = w.emitted('finish')![0]![0] as LevelResult;
    expect(result.levelId).toBeUndefined();
    expect(result).toMatchObject({ stars: 2, usedHint: true, wrong: [] });
    expect(result.firstTry).toHaveLength(5);

    await w.findAll('[data-testid="result"] button').at(-1)!.trigger('click');
    expect(w.emitted('exit')).toHaveLength(1);
    w.unmount();
  });

  it('hết Đèn Pin thì nút mờ nhưng vẫn bấm được: Tomo báo hết, không rơi chậm', async () => {
    hints.value = 0;
    const w = await startGame();
    ctl().onEvents(ctl().game.tick(0.01));
    const btn = w.get('[data-testid="star-hint"]');
    expect(btn.attributes('disabled')).toBeUndefined();
    expect(btn.attributes('aria-disabled')).toBe('true');
    const speed = ctl().game.speed;
    audio.mock!.said.length = 0;
    await btn.trigger('click');
    expect(audio.mock!.said).toEqual([[{ lang: 'vi', text: phrases.noHints }]]);
    expect(hints.value).toBe(0);
    expect(ctl().game.speed).toBe(speed);
    expect(ctl().game.slowed).toBe(false);
    w.unmount();
  });

  it('bàn phím: hứng sao xong focus sang nút hứng còn lại / đề / lượt sao mới, không để rơi về body', async () => {
    settings.ageGroup = 'mam';
    const w = await startGame();
    ctl().onEvents(ctl().game.tick(0.01));
    await w.vm.$nextTick();
    const catchBtn = (id: string) => w.get(`[data-testid="star-catch-${id}"]`).element as HTMLButtonElement;
    const firstCatch = () => w.get('[data-testid="star-falling"] button').element;
    const prompt = () => w.get('[data-testid="star-prompt"]').element;

    // Hứng sai: nút đang focus bị gỡ, focus sang nút đầu tiên còn lại.
    const bad = wrong().item.id;
    catchBtn(bad).focus();
    catchBtn(bad).click();
    await flushPromises();
    expect(w.find(`[data-testid="star-catch-${bad}"]`).exists()).toBe(false);
    expect(document.activeElement).toBe(firstCatch());

    // Hứng đúng: hết sao thì tạm đặt lên đề, lượt sao mới rơi xuống thì vào nút đầu tiên.
    catchBtn(correct().item.id).focus();
    catchBtn(correct().item.id).click();
    await flushPromises();
    expect(document.activeElement).toBe(prompt());
    await advance(w, 1.2);
    await flushPromises();
    expect(document.activeElement).toBe(firstCatch());

    // Sao đổi mà nút đang focus vẫn còn thì giữ nguyên.
    const other = ctl().game.stars.at(-1)!;
    catchBtn(other.item.id).focus();
    ctl().onEvents(ctl().game.tick(0.01));
    await flushPromises();
    expect(document.activeElement).toBe(catchBtn(other.item.id));

    // Sao đúng rơi mất: cả lượt rơi lại, focus vào nút đầu tiên của lượt mới.
    for (const s of ctl().game.stars) s.y = 0.999;
    ctl().onEvents(ctl().game.tick(0.1));
    await flushPromises();
    expect(document.activeElement).toBe(firstCatch());

    // Người chơi tự chuyển focus đi chỗ khác thì không kéo về.
    (w.get('[data-testid="star-hint"]').element as HTMLElement).focus();
    catchBtn(correct().item.id).click();
    await advance(w, 1.2);
    await flushPromises();
    expect(document.activeElement).toBe(w.get('[data-testid="star-hint"]').element);

    // Chạm / bấm chuột thì thôi giữ focus trong danh sách.
    (firstCatch() as HTMLElement).focus();
    window.dispatchEvent(new Event('pointerdown'));
    (document.activeElement as HTMLElement).blur();
    catchBtn(correct().item.id).click();
    await advance(w, 1.2);
    await flushPromises();
    expect(document.activeElement).toBe(document.body);

    // Hứng nốt bằng bàn phím tới hết ván: danh sách biến mất thì thôi.
    while (w.find('[data-testid="star-falling"]').exists()) {
      if (ctl().game.stars.length === 0) await advance(w, 1.2);
      catchBtn(correct().item.id).focus();
      catchBtn(correct().item.id).click();
      await flushPromises();
    }
    expect(w.find('[data-testid="result"]').exists()).toBe(true);
    w.unmount();
  });

  it('ẩn tiếng Việt: đề chỉ hiện hình và Tomo nhắc tìm từ của hình', async () => {
    settings.showVietnamese = false;
    const w = await startGame();
    const prompt = ctl().game.prompt!;
    const shown = w.get('[data-testid="star-prompt"]');
    expect(shown.text()).toContain(prompt.emoji);
    expect(shown.text()).not.toContain(prompt.meaningVi);
    expect(lastSaid()).toEqual([{ lang: 'vi', text: phrases.starFindPicture }]);
    w.unmount();
  });

  it('màn không có từ thì dùng cả bộ từ của đảo', async () => {
    const w = await startGame({ id: 'en-x', game: 'star' });
    expect(decks.en.items).toContain(ctl().game.prompt);
    w.unmount();
  });

  it('thoát trong lúc cảnh đang tải thì không dựng cảnh; nút thoát phát sự kiện', async () => {
    const w = mount(StarView, { props: { deck: decks.en, level: realLevel } });
    await w.get('.back').trigger('click');
    expect(w.emitted('exit')).toHaveLength(1);
    await w.get('[data-testid="star-start"]').trigger('click');
    w.unmount();
    await flushPromises();
    expect(scene.started).toBe(0);
  });
});
