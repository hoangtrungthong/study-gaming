import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { decks, phrases, type Level } from '@study/content';
import { defaultSettings, settings } from '../settings';
import { hints, START_HINTS } from './hints';
import type { LevelResult } from './result';
import type { RainController } from './rain/RainScene';

const audio = vi.hoisted(() => ({
  mock: null as null | ReturnType<typeof import('../test/audioMock').createAudioMock>,
}));
vi.mock('../audio', async () => {
  const { createAudioMock } = await import('../test/audioMock');
  audio.mock = createAudioMock();
  return audio.mock;
});

// Phaser không chạy được trong jsdom: thay cảnh bằng bản giả giữ lại controller để test tự "tick".
const scene = vi.hoisted(() => ({
  ctl: null as null | RainController,
  burst: vi.fn(),
  destroy: vi.fn(),
  started: 0,
}));
vi.mock('./rain/RainScene', () => ({
  startRainScene: (_parent: HTMLElement, ctl: RainController) => {
    scene.ctl = ctl;
    scene.started++;
    return { scene: { burst: scene.burst }, destroy: scene.destroy };
  },
}));

const { default: MatchView } = await import('./match/MatchView.vue');
const { default: RainView } = await import('./rain/RainView.vue');

beforeEach(() => {
  Object.assign(settings, defaultSettings());
  hints.value = START_HINTS;
  audio.mock!.said.length = 0;
  scene.ctl = null;
  scene.started = 0;
  scene.burst.mockClear();
  scene.destroy.mockClear();
});
afterEach(() => vi.useRealTimers());

const lastSaid = () => audio.mock!.said.at(-1)!;
/** Màn giả lấy vài từ đầu của bộ (không phụ thuộc dữ liệu màn đang được soạn). */
const fakeLevel = (id: string, game: Level['game'], count: number): Level => ({
  id,
  game,
  items: decks.en.items.slice(0, count).map((i) => i.id),
});
const finishOf = (w: ReturnType<typeof mount>) => w.emitted('finish') as [LevelResult][] | undefined;

describe('MatchView', () => {
  const leftIds = (w: ReturnType<typeof mount>) =>
    w.findAll('[data-testid^="left-"]').map((b) => b.attributes('data-testid')!.slice('left-'.length));

  it('đọc hướng dẫn, ghép đúng thì hiện thẻ kiến thức, ghép hết thì hiện kết quả và chơi lại được', async () => {
    const w = mount(MatchView, { props: { deck: decks.en } });
    expect(audio.mock!.said[0]).toEqual([{ lang: 'vi', text: phrases.matchIntro }]);
    const ids = leftIds(w);
    expect(ids).toHaveLength(4);

    await w.get(`[data-testid="left-${ids[0]}"]`).trigger('click');
    const first = w.get(`[data-testid="left-${ids[0]}"]`);
    expect(first.classes()).toContain('selected');
    expect(first.attributes('aria-pressed')).toBe('true');
    // Chạm vào từ là nghe từ đó.
    expect(lastSaid()).toEqual([{ lang: 'en', text: decks.en.items.find((i) => i.id === ids[0])!.term }]);
    await w.get(`[data-testid="right-${ids[0]}"]`).trigger('click');
    expect(w.find('[data-testid="knowledge-card"]').exists()).toBe(true);
    expect(w.text()).toContain('1/4');

    for (const id of ids.slice(1)) {
      await w.get(`[data-testid="left-${id}"]`).trigger('click');
      await w.get(`[data-testid="right-${id}"]`).trigger('click');
    }
    expect(w.find('[data-testid="result"]').exists()).toBe(true);
    // Cặp cuối vẫn có thẻ kiến thức và được đọc, lời khen nối sau thẻ.
    const lastItem = decks.en.items.find((i) => i.id === ids.at(-1))!;
    expect(w.get('[data-testid="knowledge-card"]').text()).toContain(lastItem.meaningVi);
    expect(lastSaid()[0]).toEqual({ lang: 'en', text: lastItem.term });
    expect(lastSaid().at(-1)).toEqual({ lang: 'vi', text: phrases.roundWin });

    audio.mock!.speaker.stop.mockClear();
    await w.get('[data-testid="result"] .primary').trigger('click');
    await flushPromises();
    expect(w.find('[data-testid="result"]').exists()).toBe(false);
    expect(w.findAll('.tile.done')).toHaveLength(0);
    // Hướng dẫn được đọc SAU khi thẻ cũ gỡ (thẻ gỡ gọi stop), nên không bị cắt.
    const stopOrder = Math.max(...audio.mock!.speaker.stop.mock.invocationCallOrder);
    const introOrder = audio.mock!.speaker.say.mock.invocationCallOrder.at(-1)!;
    expect(introOrder).toBeGreaterThan(stopOrder);
    expect(lastSaid()).toEqual([{ lang: 'vi', text: phrases.matchIntro }]);
  });

  it('ghép sai thì rung, đọc câu nhắc, bỏ hiệu ứng rung sau 450ms', async () => {
    vi.useFakeTimers();
    const w = mount(MatchView, { props: { deck: decks.it } });
    const ids = leftIds(w);
    await w.get(`[data-testid="left-${ids[0]}"]`).trigger('click');
    await w.get(`[data-testid="right-${ids[1]}"]`).trigger('click');
    expect(w.get(`[data-testid="right-${ids[1]}"]`).classes()).toContain('wrong');
    expect(lastSaid()).toEqual([{ lang: 'vi', text: phrases.wrong }]);
    vi.advanceTimersByTime(450);
    await w.vm.$nextTick();
    expect(w.get(`[data-testid="right-${ids[1]}"]`).classes()).not.toContain('wrong');
  });

  it('chạm nghĩa khi chưa chọn từ thì không có gì xảy ra; ẩn tiếng Việt thì chỉ còn hình', async () => {
    settings.showVietnamese = false;
    const w = mount(MatchView, { props: { deck: decks.ja } });
    const ids = leftIds(w);
    const said = audio.mock!.said.length;
    await w.get(`[data-testid="right-${ids[0]}"]`).trigger('click');
    expect(audio.mock!.said).toHaveLength(said);
    expect(w.find('.meaning .main').exists()).toBe(false);
  });

  it('tắt tự đọc thì thẻ im lặng nhưng vẫn đọc lời khen cuối màn', async () => {
    settings.autoRead = false;
    const w = mount(MatchView, { props: { deck: decks.en } });
    for (const id of leftIds(w)) {
      await w.get(`[data-testid="left-${id}"]`).trigger('click');
      await w.get(`[data-testid="right-${id}"]`).trigger('click');
    }
    await flushPromises();
    expect(lastSaid()).toEqual([{ lang: 'vi', text: phrases.roundWin }]);
    // Lời khen phải đọc SAU lần stop cuối (thẻ cũ gỡ gọi stop), không thì bị cắt.
    const stopOrder = Math.max(...audio.mock!.speaker.stop.mock.invocationCallOrder);
    expect(audio.mock!.speaker.say.mock.invocationCallOrder.at(-1)!).toBeGreaterThan(stopOrder);
  });

  it('màn kết quả có nút về đảo', async () => {
    const w = mount(MatchView, { props: { deck: decks.en } });
    for (const id of leftIds(w)) {
      await w.get(`[data-testid="left-${id}"]`).trigger('click');
      await w.get(`[data-testid="right-${id}"]`).trigger('click');
    }
    await w.findAll('[data-testid="result"] button').at(-1)!.trigger('click');
    expect(w.emitted('exit')).toHaveLength(1);
  });

  /** Ghép hết các cặp còn lại (chọn từ nếu chưa chọn). */
  async function matchAll(w: ReturnType<typeof mount>, ids: string[]) {
    for (const id of ids) {
      if (!w.get(`[data-testid="left-${id}"]`).classes().includes('selected')) {
        await w.get(`[data-testid="left-${id}"]`).trigger('click');
      }
      await w.get(`[data-testid="right-${id}"]`).trigger('click');
    }
  }

  it('dùng từ của màn; ghép xong phát finish một lần với levelId, firstTry, wrong', async () => {
    const level = fakeLevel('en-r1-l1', 'match', 4);
    const w = mount(MatchView, { props: { deck: decks.en, level } });
    const ids = leftIds(w);
    expect(new Set(ids)).toEqual(new Set(level.items));
    await w.get(`[data-testid="left-${ids[0]}"]`).trigger('click');
    await w.get(`[data-testid="right-${ids[1]}"]`).trigger('click'); // sai
    await matchAll(w, ids);
    expect(finishOf(w)).toHaveLength(1);
    expect(finishOf(w)![0]![0]).toEqual({
      levelId: 'en-r1-l1',
      game: 'match',
      stars: 2,
      firstTry: ids.slice(1),
      wrong: [ids[0]],
      usedHint: false,
    });
  });

  it('màn "-all" hoặc màn không có từ: dùng cả bộ từ và không có levelId', async () => {
    const empty: Level = { id: 'en-match-x', game: 'match', items: [] };
    const w0 = mount(MatchView, { props: { deck: decks.en, level: empty } });
    expect(leftIds(w0)).toHaveLength(4);
    const w = mount(MatchView, { props: { deck: decks.en, level: fakeLevel('en-match-all', 'match', 6) } });
    await matchAll(w, leftIds(w));
    expect(finishOf(w)![0]![0]).not.toHaveProperty('levelId');
    expect(finishOf(w)![0]![0].stars).toBe(3);
    expect(finishOf(w)![0]![0]).not.toHaveProperty('hinted');
  });

  it('Đèn Pin chỉ bật khi đang chọn từ, loé sáng nghĩa đúng 1 giây, rồi tối đa 2 sao', async () => {
    vi.useFakeTimers();
    const w = mount(MatchView, { props: { deck: decks.en } });
    const ids = leftIds(w);
    const btn = () => w.get('[data-testid="match-hint"]');
    expect(btn().attributes('disabled')).toBeDefined();
    expect(btn().text()).toContain(String(START_HINTS));
    await w.get(`[data-testid="left-${ids[0]}"]`).trigger('click');
    expect(btn().attributes('disabled')).toBeUndefined();
    await btn().trigger('click');
    expect(hints.value).toBe(START_HINTS - 1);
    expect(lastSaid()).toEqual([{ lang: 'vi', text: phrases.hint }]);
    const right = () => w.get(`[data-testid="right-${ids[0]}"]`);
    expect(right().classes()).toContain('flash');
    expect(right().attributes('aria-describedby')).toBe('match-flash-note');
    expect(w.get('#match-flash-note').text()).toContain('nghĩa đúng');
    vi.advanceTimersByTime(1000);
    await w.vm.$nextTick();
    expect(right().classes()).not.toContain('flash');
    expect(right().attributes('aria-describedby')).toBeUndefined();

    // Chọn từ khác thì tắt loé sáng ngay.
    await btn().trigger('click');
    expect(right().classes()).toContain('flash');
    await w.get(`[data-testid="left-${ids[1]}"]`).trigger('click');
    expect(right().classes()).not.toContain('flash');

    // Hết Đèn Pin: nút mờ nhưng vẫn bấm được; Tomo báo hết, không loé sáng.
    hints.value = 0;
    await w.get(`[data-testid="left-${ids[0]}"]`).trigger('click');
    expect(btn().attributes('disabled')).toBeUndefined();
    expect(btn().attributes('aria-disabled')).toBe('true');
    audio.mock!.said.length = 0;
    await btn().trigger('click');
    expect(audio.mock!.said).toEqual([[{ lang: 'vi', text: phrases.noHints }]]);
    expect(hints.value).toBe(0);
    expect(right().classes()).not.toContain('flash');

    await matchAll(w, ids);
    const result = finishOf(w)![0]![0];
    expect(result.usedHint).toBe(true);
    expect(result.stars).toBe(2);
    expect(result.firstTry).not.toContain(ids[0]);
    expect(result.hinted).toEqual([ids[0]]);
    expect(w.get('[data-testid="result"]').find('[aria-label="2 trên 3 sao"]').exists()).toBe(true);
    w.unmount();
  });

  it('thoát thì phát sự kiện và dừng đọc', async () => {
    const w = mount(MatchView, { props: { deck: decks.en } });
    await w.get('.back').trigger('click');
    expect(w.emitted('exit')).toHaveLength(1);
    w.unmount();
    expect(audio.mock!.speaker.stop).toHaveBeenCalled();
  });
});

describe('RainView', () => {
  async function startGame(deck = decks.ja, mode?: 'term' | 'meaning' | 'audio') {
    const w = mount(RainView, { props: { deck }, attachTo: document.body });
    if (mode) await w.get(`input[value="${mode}"]`).setValue(true);
    await w.get('[data-testid="rain-start"]').trigger('click');
    await flushPromises();
    return w;
  }

  it('nhóm Mầm mặc định hiện nghĩa tiếng Việt; nhóm khác hiện từ gốc; tiếng Nhật có gợi ý romaji', () => {
    settings.ageGroup = 'mam';
    const mam = mount(RainView, { props: { deck: decks.ja } });
    expect((mam.get('input[value="meaning"]').element as HTMLInputElement).checked).toBe(true);
    expect(mam.text()).toContain('romaji');
    settings.ageGroup = 'cay';
    const cay = mount(RainView, { props: { deck: decks.en } });
    expect((cay.get('input[value="term"]').element as HTMLInputElement).checked).toBe(true);
    expect(cay.text()).not.toContain('romaji');
  });

  it('bắt đầu thì dựng cảnh; gõ romaji đúng thì phá hạt mưa, cộng điểm, đọc từ và xoá ô gõ', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearInterval'] });
    const w = await startGame();
    expect(scene.started).toBe(1);
    const ctl = scene.ctl!;
    ctl.onEvents(ctl.game.tick(0.01));
    await w.vm.$nextTick();
    const drop = ctl.game.drops[0]!;
    expect(w.get('[data-testid="rain-drops"]').text()).toContain(drop.item.term);
    expect(ctl.label(drop).main).toBe(drop.item.term);

    const input = w.get('[data-testid="rain-input"]');
    const romaji = (await import('wanakana')).toRomaji(drop.item.reading ?? drop.item.term);
    await input.setValue(romaji.slice(0, 1));
    expect(ctl.game.score).toBe(0);
    await input.setValue(romaji);
    ctl.onEvents([]); // khung hình kế tiếp: đọc lời khen
    expect(scene.burst).toHaveBeenCalledWith(drop.id, 'hit');
    expect(w.get('[data-testid="rain-score"]').text()).toBe('1');
    expect((input.element as HTMLInputElement).value).toBe('');
    expect(lastSaid()[1]).toEqual({ lang: 'vi', text: drop.item.meaningVi, translation: true });
    expect(w.get('.typing').classes()).toContain('ok');
    vi.advanceTimersByTime(300);
    await w.vm.$nextTick();
    expect(w.get('.typing').classes()).not.toContain('ok');

    ctl.onDropTap(drop);
    expect(lastSaid()).toEqual([{ lang: 'ja', text: drop.item.reading ?? drop.item.term }]);
    vi.advanceTimersByTime(250);
    w.unmount();
    expect(scene.destroy).toHaveBeenCalled();
  });

  it('đang gõ bằng bộ gõ (IME) thì chưa chấm; gõ xong mới chấm', async () => {
    const w = await startGame();
    const ctl = scene.ctl!;
    ctl.onEvents(ctl.game.tick(0.01));
    const drop = ctl.game.drops[0]!;
    const input = w.get('[data-testid="rain-input"]');
    await input.trigger('compositionstart');
    await input.setValue(drop.item.reading ?? drop.item.term);
    expect(ctl.game.score).toBe(0);
    await input.trigger('compositionend');
    expect(ctl.game.score).toBe(1);
  });

  it('nhấn Enter khi gõ sai thì báo sai rồi tự bỏ báo', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout'] });
    const w = await startGame(decks.en);
    scene.ctl!.onEvents(scene.ctl!.game.tick(0.01));
    await w.get('[data-testid="rain-input"]').setValue('khongdung');
    await w.get('form.typing').trigger('submit');
    expect(w.get('.typing').classes()).toContain('bad');
    vi.advanceTimersByTime(400);
    await w.vm.$nextTick();
    expect(w.get('.typing').classes()).not.toContain('bad');
  });

  it('chế độ chỉ nghe: đọc to các từ đang rơi, và đọc lại chúng sau mỗi câu nhắc / khen', async () => {
    const w = await startGame(decks.en, 'audio');
    const ctl = scene.ctl!;
    ctl.onEvents(ctl.game.tick(0.01));
    const first = ctl.game.drops[0]!;
    expect(ctl.label(first)).toEqual({ main: '🔊' });
    expect(lastSaid()).toEqual([{ lang: 'en', text: first.item.term }]);

    ctl.onEvents(ctl.game.tick(2.6)); // hạt thứ hai rơi xuống
    const second = ctl.game.drops.find((d) => d !== first)!;
    // Hạt thấp nhất đọc trước.
    expect(lastSaid()).toEqual([
      { lang: 'en', text: first.item.term },
      { lang: 'en', text: second.item.term },
    ]);

    // Gõ đúng khi màn đã đầy: khung hình kế tiếp sinh hạt mới vào chỗ trống. Khen + đọc các từ đang rơi
    // phải nằm trong CÙNG một lượt, không bị câu của hạt mới cắt mất.
    ctl.onEvents(ctl.game.tick(2.6)); // màn đầy (2 hạt) quá nhịp sinh hạt: chỗ trống sẽ có hạt mới ngay
    await w.get('[data-testid="rain-input"]').setValue(first.item.term);
    const beforeHit = audio.mock!.said.length;
    ctl.onEvents(ctl.game.tick(0.016));
    expect(audio.mock!.said.length).toBe(beforeHit + 1);
    const afterHit = lastSaid().map((s) => s.text);
    expect(afterHit.slice(0, 2)).toEqual([first.item.term, first.item.meaningVi]);
    expect(ctl.game.drops).toHaveLength(2);
    for (const d of ctl.game.drops) expect(afterHit).toContain(d.item.term);

    // Hạt rơi xuống và hạt mới sinh ra trong cùng khung hình: một lượt, câu nhắc trước, rồi mọi hạt đang rơi.
    ctl.game.drops.forEach((d) => (d.y = 0.999));
    const beforeMiss = audio.mock!.said.length;
    ctl.onEvents(ctl.game.tick(0.05));
    expect(audio.mock!.said.length).toBe(beforeMiss + 1);
    expect(lastSaid()[0]).toEqual({ lang: 'vi', text: phrases.missed });
    for (const d of ctl.game.drops) expect(lastSaid().map((s) => s.text)).toContain(d.item.term);

    // Khung hình không có gì thì không đọc.
    const quiet = audio.mock!.said.length;
    ctl.onEvents([]);
    expect(audio.mock!.said.length).toBe(quiet);
    w.unmount();
  });

  it('ô gõ có sẵn trước khi bắt đầu và được focus ngay khi bấm Bắt đầu (bàn phím iOS)', async () => {
    const w = mount(RainView, { props: { deck: decks.en }, attachTo: document.body });
    const input = w.get('[data-testid="rain-input"]');
    expect(input.attributes('placeholder')).toBe('Gõ ở đây khi mưa bắt đầu');
    await input.setValue('cat'); // chưa bắt đầu: không làm gì
    await w.get('form.typing').trigger('submit');
    w.get('[data-testid="rain-start"]').element.dispatchEvent(new MouseEvent('click'));
    expect(document.activeElement).toBe(input.element); // focus trước mọi await
    await flushPromises();
    expect(input.attributes('placeholder')).toBe('Gõ từ trên hạt mưa…');
    scene.ctl!.onEvents([{ type: 'over', reason: 'time' }]);
    await flushPromises();
    expect(input.attributes('placeholder')).toBe('Bấm Chơi lại để chơi tiếp');
    w.unmount();
  });

  it('hết trận thì hiện kết quả, đọc lại từ bị lỡ, nghe lại từng từ và chơi lại', async () => {
    const w = await startGame(decks.en);
    const ctl = scene.ctl!;
    ctl.onEvents(ctl.game.tick(0.01));
    const missed = ctl.game.drops[0]!.item;
    ctl.onEvents(ctl.game.tick(80)); // quá 75 giây của nhóm Chồi: hạt rơi và hết giờ
    await flushPromises();
    expect(scene.destroy).toHaveBeenCalled();
    const result = w.get('[data-testid="result"]');
    expect(result.text()).toContain('lỡ');
    expect(result.text()).toContain(missed.meaningVi);
    expect(audio.mock!.said.some((s) => s[0]!.text === phrases.rainOver)).toBe(true);

    await result.get('.missed button').trigger('click');
    expect(lastSaid()).toEqual([
      { lang: 'en', text: missed.term },
      { lang: 'vi', text: missed.meaningVi, translation: true },
    ]);
    // Mỗi từ bị lỡ chỉ hiện một lần dù rơi nhiều lần.
    const shown = result.findAll('.missed li').length;
    expect(shown).toBe(new Set(ctl.game.missed.map((i) => i.id)).size);

    await result.get('.primary').trigger('click');
    await flushPromises();
    expect(scene.started).toBe(2);
    expect(w.find('[data-testid="rain-input"]').exists()).toBe(true);
  });

  it('kết quả 3 sao khi không lỡ hạt nào; 2 sao khi phá được phần lớn', async () => {
    const w = await startGame(decks.en);
    const ctl = scene.ctl!;
    const g = ctl.game;
    g.hits.push(...decks.en.items.slice(0, 9));
    g.missed.push(decks.en.items[9]!);
    ctl.onEvents([{ type: 'over', reason: 'time' }]);
    await flushPromises();
    expect(w.get('[data-testid="result"]').find('[aria-label="3 trên 3 sao"]').exists()).toBe(true);

    await w.get('[data-testid="result"] .primary').trigger('click');
    await flushPromises();
    const g2 = scene.ctl!.game;
    g2.hits.push(...decks.en.items.slice(0, 6));
    g2.missed.push(...decks.en.items.slice(6, 10));
    scene.ctl!.onEvents([{ type: 'over', reason: 'lives' }]);
    await flushPromises();
    expect(w.get('[data-testid="result"]').find('[aria-label="2 trên 3 sao"]').exists()).toBe(true);
  });

  it('thoát trong lúc cảnh đang tải thì không dựng cảnh', async () => {
    const w = mount(RainView, { props: { deck: decks.en } });
    await w.get('[data-testid="rain-start"]').trigger('click');
    w.unmount();
    await flushPromises();
    expect(scene.started).toBe(0);
  });

  it('đổi chế độ hiện chữ; cảnh không tạm dừng; kết quả có nút về đảo', async () => {
    const w = mount(RainView, { props: { deck: decks.en } });
    await w.get('input[value="meaning"]').setValue(true);
    expect(w.get('input[value="meaning"]').element.closest('label')!.classList).toContain('on');
    await w.get('input[value="term"]').setValue(true);
    await w.get('[data-testid="rain-start"]').trigger('click');
    await flushPromises();
    expect(scene.ctl!.paused()).toBe(false);
    scene.ctl!.onEvents([{ type: 'over', reason: 'time' }]);
    await flushPromises();
    await w.findAll('[data-testid="result"] button').at(-1)!.trigger('click');
    expect(w.emitted('exit')).toHaveLength(1);
  });

  it('dùng từ của màn; hết trận phát finish với levelId, firstTry, wrong', async () => {
    const level = fakeLevel('en-r1-l2', 'rain', 3);
    const w = mount(RainView, { props: { deck: decks.en, level } });
    await w.get('[data-testid="rain-start"]').trigger('click');
    await flushPromises();
    const ctl = scene.ctl!;
    ctl.onEvents(ctl.game.tick(0.01));
    const first = ctl.game.drops[0]!;
    expect(level.items).toContain(first.item.id);
    await w.get('[data-testid="rain-input"]').setValue(first.item.term);
    const missed = decks.en.items.find((i) => i.id !== first.item.id)!;
    ctl.game.missed.push(missed);
    ctl.onEvents([{ type: 'over', reason: 'time' }]);
    await flushPromises();
    expect(finishOf(w)).toHaveLength(1);
    expect(finishOf(w)![0]![0]).toEqual({
      levelId: 'en-r1-l2',
      game: 'rain',
      stars: 1,
      firstTry: [first.item.id],
      wrong: [missed.id],
      usedHint: false,
    });
  });

  it('màn "-all" hoặc màn không có từ: dùng cả bộ từ và không có levelId', async () => {
    const level: Level = { id: 'en-rain-all', game: 'rain', items: [] };
    const w = mount(RainView, { props: { deck: decks.en, level } });
    await w.get('[data-testid="rain-start"]').trigger('click');
    await flushPromises();
    const ctl = scene.ctl!;
    ctl.onEvents(ctl.game.tick(0.01));
    expect(decks.en.items).toContain(ctl.game.drops[0]!.item);
    ctl.onEvents([{ type: 'over', reason: 'time' }]);
    await flushPromises();
    expect(finishOf(w)![0]![0]).not.toHaveProperty('levelId');
  });

  it('Đèn Pin làm mưa rơi chậm 5 giây và tối đa 2 sao; hết Đèn Pin thì Tomo báo hết', async () => {
    const w = await startGame(decks.en);
    const ctl = scene.ctl!;
    const normal = ctl.game.speed;
    const btn = w.get('[data-testid="rain-hint"]');
    expect(btn.text()).toContain(String(START_HINTS));
    expect(btn.attributes('disabled')).toBeUndefined();
    await btn.trigger('click');
    expect(hints.value).toBe(START_HINTS - 1);
    expect(ctl.game.speed).toBeLessThan(normal);
    // Đang rơi chậm thì nút tắt (bấm thêm không chậm hơn); hết 5 giây thì bật lại.
    expect(btn.attributes('disabled')).toBeDefined();
    ctl.game.drops.length = 0;
    ctl.onEvents(ctl.game.tick(5.1));
    await w.vm.$nextTick();
    expect(ctl.game.slowed).toBe(false);
    expect(btn.attributes('disabled')).toBeUndefined();
    ctl.game.hits.push(...decks.en.items.slice(0, 5));
    ctl.onEvents([{ type: 'over', reason: 'time' }]);
    await flushPromises();
    expect(finishOf(w)![0]![0]).toMatchObject({ stars: 2, usedHint: true });
    expect(w.find('[data-testid="rain-hint"]').exists()).toBe(false);

    // Chơi lại: cờ Đèn Pin được đặt lại; hết Đèn Pin thì nút mờ nhưng vẫn bấm được, Tomo báo hết.
    await w.get('[data-testid="result"] .primary').trigger('click');
    await flushPromises();
    hints.value = 0;
    await w.vm.$nextTick();
    const again = w.get('[data-testid="rain-hint"]');
    expect(again.attributes('disabled')).toBeUndefined();
    expect(again.attributes('aria-disabled')).toBe('true');
    audio.mock!.said.length = 0;
    await again.trigger('click');
    expect(audio.mock!.said).toEqual([[{ lang: 'vi', text: phrases.noHints }]]);
    expect(scene.ctl!.game.slowed).toBe(false);
    scene.ctl!.onEvents([{ type: 'over', reason: 'time' }]);
    await flushPromises();
    expect(finishOf(w)![1]![0].usedHint).toBe(false);
  });

  it('nhóm Mầm: ô gõ chỉ đọc, bàn phím ảo có các chữ của hạt đang rơi; gõ đủ thì phá hạt', async () => {
    settings.ageGroup = 'mam';
    const w = await startGame(decks.ja);
    const input = w.get('[data-testid="rain-input"]');
    expect(input.attributes('readonly')).toBeDefined();
    expect(input.attributes('inputmode')).toBe('none');
    const ctl = scene.ctl!;
    ctl.onEvents(ctl.game.tick(0.01));
    await w.vm.$nextTick();
    const drop = ctl.game.drops[0]!;
    const answer = [...(drop.item.reading ?? drop.item.term)];
    const keys = w.findAll('[data-testid^="vkey-"]').map((k) => k.attributes('data-testid')!.slice('vkey-'.length));
    expect(new Set(keys)).toEqual(new Set([...answer, 'back']));

    const value = () => (input.element as HTMLInputElement).value;
    await w.get(`[data-testid="vkey-${answer[0]}"]`).trigger('click');
    await w.get(`[data-testid="vkey-${answer[0]}"]`).trigger('click');
    expect(value()).toBe(answer[0]! + answer[0]!);
    await w.get('[data-testid="vkey-back"]').trigger('click');
    expect(value()).toBe(answer[0]);
    for (const ch of answer.slice(1)) await w.get(`[data-testid="vkey-${ch}"]`).trigger('click');
    expect(ctl.game.score).toBe(1);
    expect(value()).toBe('');
    w.unmount();
  });

  it('nhóm Mầm: hạt rơi xuống đất thì xoá chữ gõ dở; nhóm khác thì giữ', async () => {
    settings.ageGroup = 'mam';
    const w = await startGame(decks.en);
    const ctl = scene.ctl!;
    ctl.onEvents(ctl.game.tick(0.01));
    await w.vm.$nextTick();
    const first = [...ctl.game.drops[0]!.item.term][0]!;
    await w.get(`[data-testid="vkey-${first}"]`).trigger('click');
    ctl.game.drops[0]!.y = 0.999;
    ctl.onEvents(ctl.game.tick(0.05));
    await w.vm.$nextTick();
    expect((w.get('[data-testid="rain-input"]').element as HTMLInputElement).value).toBe('');
    w.unmount();

    settings.ageGroup = 'choi';
    const c = await startGame(decks.en);
    expect(c.find('[data-testid="virtual-keyboard"]').exists()).toBe(false);
    expect(c.get('[data-testid="rain-input"]').attributes('readonly')).toBeUndefined();
    const ctl2 = scene.ctl!;
    ctl2.onEvents(ctl2.game.tick(0.01));
    await c.get('[data-testid="rain-input"]').setValue('zz');
    ctl2.game.drops[0]!.y = 0.999;
    ctl2.onEvents(ctl2.game.tick(0.05));
    expect((c.get('[data-testid="rain-input"]').element as HTMLInputElement).value).toBe('zz');
    c.unmount();
  });

  it('nhóm Mầm không hiện đồng hồ; nút thoát phát sự kiện', async () => {
    settings.ageGroup = 'mam';
    const w = await startGame(decks.en);
    expect(w.find('[aria-label="Thời gian còn lại"]').exists()).toBe(false);
    await w.get('.back').trigger('click');
    expect(w.emitted('exit')).toHaveLength(1);
  });
});
