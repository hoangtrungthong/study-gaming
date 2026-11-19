import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { decks, findLevel, islandContent, phrases, type Deck, type Level } from '@study/content';
import { defaultSettings, settings } from '../../settings';
import { hints, START_HINTS } from '../hints';
import type { LevelResult } from '../result';

const audio = vi.hoisted(() => ({
  mock: null as null | ReturnType<typeof import('../../test/audioMock').createAudioMock>,
}));
vi.mock('../../audio', async () => {
  const { createAudioMock } = await import('../../test/audioMock');
  audio.mock = createAudioMock();
  return audio.mock;
});

const { default: MemoryView } = await import('./MemoryView.vue');

const level = findLevel('en-r1-l3')!.level;
const items = decks.en.items;

beforeEach(() => {
  Object.assign(settings, defaultSettings());
  hints.value = START_HINTS;
  audio.mock!.said.length = 0;
  audio.mock!.speaker.stop.mockClear();
});
afterEach(() => vi.useRealTimers());

const lastSaid = () => audio.mock!.said.at(-1)!;

function play(deck: Deck = decks.en, lvl: Level = level) {
  return mount(MemoryView, { props: { deck, level: lvl } });
}

/** Chỉ số thẻ từ và thẻ nghĩa của mỗi mục đang có trên lưới (đọc từ chữ trên mặt thẻ). */
function layout(w: VueWrapper) {
  const cards = w.findAll('[data-testid^="memory-card-"]');
  const pairs = items
    .map((item) => ({
      item,
      term: cards.findIndex((c) => c.find('.term').exists() && c.get('.term').text() === item.term),
      meaning: cards.findIndex((c) => c.find('.meaning').exists() && c.get('.meaning').text() === item.meaningVi),
    }))
    .filter((p) => p.term >= 0);
  return { count: cards.length, pairs };
}

const card = (w: VueWrapper, idx: number) => w.get(`[data-testid="memory-card-${idx}"]`);
const click = (w: VueWrapper, idx: number) => card(w, idx).trigger('click');

async function solve(w: VueWrapper) {
  for (const p of layout(w).pairs) {
    if (card(w, p.term).attributes('disabled') !== undefined) continue;
    await click(w, p.term);
    await click(w, p.meaning);
  }
}

describe('MemoryView', () => {
  it('đọc hướng dẫn, lưới theo nhóm tuổi, thẻ úp có nhãn số', () => {
    const w = play();
    expect(audio.mock!.said[0]).toEqual([{ lang: 'vi', text: phrases.memoryIntro }]);
    expect(w.classes()).toContain('memory');
    expect(w.get('h2').text()).toBe('Lật Thẻ Nhớ');
    expect(layout(w).count).toBe(12);
    expect(w.get('.grid').attributes('style')).toContain('repeat(4, 1fr)');
    expect(card(w, 2).attributes('aria-label')).toBe('Thẻ úp số 3');
    expect(w.text()).toContain('0/6');
  });

  it('nhóm Mầm 3 cặp, lưới 3 cột', () => {
    settings.ageGroup = 'mam';
    const w = play();
    expect(layout(w).count).toBe(6);
    expect(w.get('.grid').attributes('style')).toContain('repeat(3, 1fr)');
    expect(w.classes()).toContain('mam');
  });

  it('lật thẻ từ đọc từ, thẻ nghĩa đọc dòng dịch; khớp thì giữ ngửa và đọc từ + nghĩa', async () => {
    const w = play();
    const [p] = layout(w).pairs;
    await click(w, p!.term);
    expect(lastSaid()).toEqual([{ lang: 'en', text: p!.item.term }]);
    expect(card(w, p!.term).classes()).toContain('up');
    expect(card(w, p!.term).attributes('aria-label')).toBe(p!.item.term);
    await click(w, p!.meaning);
    expect(lastSaid()).toEqual([
      { lang: 'en', text: p!.item.term },
      { lang: 'vi', text: p!.item.meaningVi, translation: true },
    ]);
    expect(card(w, p!.meaning).classes()).toContain('done');
    expect(card(w, p!.meaning).attributes('disabled')).toBeDefined();
    expect(card(w, p!.meaning).attributes('aria-label')).toBe(p!.item.meaningVi);
    expect(w.text()).toContain('1/6');
  });

  it('khác nghĩa thì đọc thẻ + câu nhắc, chặn thẻ thứ ba, úp lại sau thời gian của nhóm tuổi', async () => {
    vi.useFakeTimers();
    settings.ageGroup = 'mam';
    const w = play();
    const [a, b, c] = layout(w).pairs;
    await click(w, a!.meaning);
    expect(lastSaid()).toEqual([{ lang: 'vi', text: a!.item.meaningVi, translation: true }]);
    await click(w, b!.term);
    expect(lastSaid()).toEqual([
      { lang: 'en', text: b!.item.term },
      { lang: 'vi', text: phrases.wrong },
    ]);
    const said = audio.mock!.said.length;
    await click(w, c!.term);
    expect(audio.mock!.said).toHaveLength(said);
    expect(card(w, c!.term).classes()).not.toContain('up');

    vi.advanceTimersByTime(1799);
    await w.vm.$nextTick();
    expect(card(w, a!.meaning).classes()).toContain('up');
    vi.advanceTimersByTime(1);
    await w.vm.$nextTick();
    expect(card(w, a!.meaning).classes()).not.toContain('up');
    expect(card(w, b!.term).attributes('aria-label')).toMatch(/^Thẻ úp số /);
  });

  it('ghép hết: đọc lời khen, phát finish, hiện kết quả và chơi lại được', async () => {
    const w = play();
    await solve(w);
    expect(lastSaid().at(-1)).toEqual({ lang: 'vi', text: phrases.roundWin });
    expect(w.find('[data-testid="result"]').exists()).toBe(true);
    expect(w.find('[data-testid="memory-hint"]').exists()).toBe(false);
    const ids = layout(w).pairs.map((p) => p.item.id);
    expect(w.emitted('finish')).toEqual([
      [
        {
          levelId: 'en-r1-l3',
          game: 'memory',
          stars: 3,
          firstTry: expect.arrayContaining(ids) as string[],
          wrong: [],
          usedHint: false,
        },
      ],
    ]);
    expect(w.get('[data-testid="result"]').text()).toContain('lật sai 0 lần');

    await w.get('[data-testid="result"] .primary').trigger('click');
    await flushPromises();
    expect(w.find('[data-testid="result"]').exists()).toBe(false);
    expect(w.findAll('.card.up')).toHaveLength(0);
    expect(lastSaid()).toEqual([{ lang: 'vi', text: phrases.memoryIntro }]);
  });

  it('lật sai nhiều hơn số cặp thì 1 sao, mục sai nằm trong wrong; lối vào đảo không có levelId', async () => {
    vi.useFakeTimers();
    settings.ageGroup = 'mam';
    const w = play(decks.en, islandContent('en', 'memory'));
    const [a, b] = layout(w).pairs;
    for (let i = 0; i < 4; i++) {
      await click(w, a!.term);
      await click(w, b!.meaning);
      vi.advanceTimersByTime(1800);
      await w.vm.$nextTick();
    }
    await solve(w);
    const result = w.emitted('finish')![0]![0] as LevelResult;
    expect(result.levelId).toBeUndefined();
    expect(result.stars).toBe(1);
    expect(result.wrong.sort()).toEqual([a!.item.id, b!.item.id].sort());
    expect(result.firstTry).toHaveLength(1);
  });

  it('Đèn Pin soi sáng một cặp trong 1 giây, dùng rồi thì tối đa 2 sao', async () => {
    vi.useFakeTimers();
    const w = play();
    await w.get('[data-testid="memory-hint"]').trigger('click');
    expect(hints.value).toBe(START_HINTS - 1);
    expect(lastSaid()).toEqual([{ lang: 'vi', text: phrases.hint }]);
    const peeked = w.findAll('.card.peek');
    expect(peeked).toHaveLength(2);
    expect(peeked.every((c) => c.classes().includes('up'))).toBe(true);
    expect(peeked[0]!.attributes('aria-label')).not.toMatch(/^Thẻ úp/);
    expect(w.get('[data-testid="memory-hint"]').attributes('disabled')).toBeDefined();
    vi.advanceTimersByTime(1000);
    await w.vm.$nextTick();
    expect(w.findAll('.card.peek')).toHaveLength(0);
    expect(w.findAll('.card.up')).toHaveLength(0);

    await solve(w);
    const result = w.emitted('finish')![0]![0] as LevelResult;
    expect(result.usedHint).toBe(true);
    expect(result.stars).toBe(2);
  });

  it('ghép xong khi đang soi thì tắt soi', async () => {
    vi.useFakeTimers();
    const w = play();
    await w.get('[data-testid="memory-hint"]').trigger('click');
    await solve(w);
    expect(w.find('[data-testid="result"]').exists()).toBe(true);
    await w.get('[data-testid="result"] .primary').trigger('click');
    expect(w.findAll('.card.peek')).toHaveLength(0);
    vi.advanceTimersByTime(1000);
    expect(w.findAll('.card.up')).toHaveLength(0);
  });

  it('hết Đèn Pin thì nút mờ nhưng vẫn bấm được, hiện số 0; bấm thì Tomo báo hết, không soi', async () => {
    hints.value = 0;
    const w = play();
    const btn = w.get('[data-testid="memory-hint"]');
    expect(btn.attributes('disabled')).toBeUndefined();
    expect(btn.attributes('aria-disabled')).toBe('true');
    expect(btn.attributes('aria-label')).toBe('Đèn Pin, còn 0');
    audio.mock!.said.length = 0;
    await btn.trigger('click');
    expect(audio.mock!.said).toEqual([[{ lang: 'vi', text: phrases.noHints }]]);
    expect(hints.value).toBe(0);
    expect(w.findAll('.card.peek')).toHaveLength(0);
  });

  it('tiếng Nhật: thẻ từ có かな và đọc theo かな', async () => {
    const w = play(decks.ja, findLevel('ja-r1-l3')!.level);
    const idx = w.findAll('[data-testid^="memory-card-"]').findIndex((c) => c.find('.sub').exists());
    const reading = card(w, idx).get('.sub').text();
    expect(card(w, idx).get('.term').attributes('lang')).toBe('ja');
    await click(w, idx);
    expect(lastSaid()).toEqual([{ lang: 'ja', text: reading }]);
  });

  it('ẩn tiếng Việt thì thẻ nghĩa chỉ còn hình', async () => {
    settings.showVietnamese = false;
    const w = play();
    expect(w.find('.meaning').exists()).toBe(false);
    const idx = w.findAll('[data-testid^="memory-card-"]').findIndex((c) => !c.find('.term').exists());
    await click(w, idx);
    const emoji = card(w, idx).get('.emoji').text();
    expect(card(w, idx).attributes('aria-label')).toBe(emoji);
  });

  it('thoát thì phát sự kiện; gỡ màn thì dừng đọc và huỷ hẹn giờ', async () => {
    vi.useFakeTimers();
    const w = play();
    const [a, b] = layout(w).pairs;
    await click(w, a!.term);
    await click(w, b!.term);
    await w.get('.back').trigger('click');
    expect(w.emitted('exit')).toHaveLength(1);
    w.unmount();
    expect(audio.mock!.speaker.stop).toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('màn kết quả có nút về đảo', async () => {
    const w = play();
    await solve(w);
    await w.findAll('[data-testid="result"] button').at(-1)!.trigger('click');
    expect(w.emitted('exit')).toHaveLength(1);
  });
});
