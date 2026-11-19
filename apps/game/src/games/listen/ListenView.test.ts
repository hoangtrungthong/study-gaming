import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { decks, islandContent, phrases, regions, type Deck, type Level } from '@study/content';
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

const { default: ListenView } = await import('./ListenView.vue');

const level = regions.en.flatMap((r) => r.levels).find((l) => l.game === 'listen')!;

beforeEach(() => {
  Object.assign(settings, defaultSettings());
  hints.value = START_HINTS;
  audio.mock!.said.length = 0;
  audio.mock!.speaker.say.mockClear();
  audio.mock!.speaker.stop.mockClear();
});

const said = () => audio.mock!.said;
const lastSaid = () => said().at(-1)!;
const optionIds = (w: VueWrapper) =>
  w.findAll('[data-testid^="listen-option-"]').map((b) => b.attributes('data-testid')!.slice('listen-option-'.length));

/** Đáp án của đề hiện tại: lựa chọn có từ trùng với lần đọc đề gần nhất. */
function answerOf(w: VueWrapper, deck: Deck): string {
  const prompt = [...said()]
    .reverse()
    .flat()
    .find((s) => s.lang === deck.termLang)!.text;
  return optionIds(w).find((id) => {
    const item = deck.items.find((i) => i.id === id)!;
    return (item.reading ?? item.term) === prompt;
  })!;
}

function mountView(props: { deck?: Deck; level?: Level } = {}) {
  return mount(ListenView, { props: { deck: props.deck ?? decks.en, level: props.level ?? level } });
}

async function solveRound(w: VueWrapper, deck: Deck = decks.en) {
  await w.get(`[data-testid="listen-option-${answerOf(w, deck)}"]`).trigger('click');
  await w.get('[data-testid="listen-next"]').trigger('click');
  await flushPromises();
}

describe('ListenView', () => {
  it('đọc hướng dẫn rồi đề, chọn sai thì mờ và đọc lại đề, chọn đúng thì hiện thẻ và sang đề sau', async () => {
    const w = mountView();
    expect(w.classes()).toContain('listen');
    expect(w.get('h2').text()).toBe('Nghe Chọn');
    const answer = answerOf(w, decks.en);
    const item = decks.en.items.find((i) => i.id === answer)!;
    expect(said()[0]).toEqual([
      { lang: 'vi', text: phrases.listenIntro },
      { lang: 'en', text: item.term },
    ]);
    // Chồi: 4 lựa chọn hình + nghĩa.
    expect(optionIds(w)).toHaveLength(4);
    expect(w.findAll('.option .emoji')).toHaveLength(4);
    expect(w.findAll('.option .text')).toHaveLength(4);
    expect(w.text()).toContain('1/8');

    const wrongId = optionIds(w).find((id) => id !== answer)!;
    await w.get(`[data-testid="listen-option-${wrongId}"]`).trigger('click');
    const wrongBtn = w.get(`[data-testid="listen-option-${wrongId}"]`);
    expect(wrongBtn.classes()).toContain('out');
    expect(wrongBtn.attributes('disabled')).toBeDefined();
    expect(lastSaid()).toEqual([
      { lang: 'vi', text: phrases.wrong },
      { lang: 'en', text: item.term },
    ]);

    await w.get('[data-testid="listen-replay"]').trigger('click');
    expect(lastSaid()).toEqual([{ lang: 'en', text: item.term }]);

    expect(w.find('[data-testid="listen-next"]').exists()).toBe(false);
    await w.get(`[data-testid="listen-option-${answer}"]`).trigger('click');
    expect(w.get('[data-testid="knowledge-card"]').text()).toContain(item.meaningVi);
    expect(w.get(`[data-testid="listen-option-${answer}"]`).classes()).toContain('right');
    // Thẻ kiến thức tự đọc.
    expect(lastSaid()[0]).toEqual({ lang: 'en', text: item.term });
    expect(w.get('[data-testid="listen-hint"]').attributes('disabled')).toBeDefined();

    audio.mock!.speaker.stop.mockClear();
    await w.get('[data-testid="listen-next"]').trigger('click');
    await flushPromises();
    expect(w.find('[data-testid="knowledge-card"]').exists()).toBe(false);
    expect(w.text()).toContain('2/8');
    // Đề mới được đọc SAU khi thẻ cũ gỡ (thẻ gỡ gọi stop), nên không bị cắt.
    const stopOrder = Math.max(...audio.mock!.speaker.stop.mock.invocationCallOrder);
    expect(audio.mock!.speaker.say.mock.invocationCallOrder.at(-1)!).toBeGreaterThan(stopOrder);
    expect(lastSaid()).toHaveLength(1);
    expect(lastSaid()[0]!.lang).toBe('en');
  });

  it('chơi hết thì phát kết quả, đọc lời khen sau khi thẻ gỡ, chơi lại được', async () => {
    const w = mountView();
    const wrongId = optionIds(w).find((id) => id !== answerOf(w, decks.en))!;
    const firstAnswer = answerOf(w, decks.en);
    await w.get(`[data-testid="listen-option-${wrongId}"]`).trigger('click');
    for (let i = 0; i < 7; i++) await solveRound(w);
    const lastAnswer = answerOf(w, decks.en);
    await w.get(`[data-testid="listen-option-${lastAnswer}"]`).trigger('click');
    audio.mock!.speaker.stop.mockClear();
    await w.get('[data-testid="listen-next"]').trigger('click');
    await flushPromises();

    expect(w.find('[data-testid="result"]').exists()).toBe(true);
    expect(w.text()).toContain('sai 1 lần');
    const result = w.emitted('finish')![0]![0] as LevelResult;
    expect(result).toMatchObject({
      levelId: level.id,
      game: 'listen',
      stars: 2,
      usedHint: false,
      wrong: [firstAnswer],
    });
    // Màn ít từ hơn số lượt nên từ lặp lại; từ đã sai thì không bao giờ tính "đúng ngay".
    expect(result.firstTry.length).toBeGreaterThan(0);
    expect(new Set(result.firstTry).size).toBe(result.firstTry.length);
    expect(result.firstTry).not.toContain(firstAnswer);
    const stopOrder = Math.max(...audio.mock!.speaker.stop.mock.invocationCallOrder);
    expect(audio.mock!.speaker.say.mock.invocationCallOrder.at(-1)!).toBeGreaterThan(stopOrder);
    expect(lastSaid()).toEqual([{ lang: 'vi', text: phrases.roundWin }]);

    await w.get('[data-testid="result"] .primary').trigger('click');
    await flushPromises();
    expect(w.find('[data-testid="result"]').exists()).toBe(false);
    expect(w.text()).toContain('1/8');
    expect(lastSaid()[0]).toEqual({ lang: 'vi', text: phrases.listenIntro });
    expect(w.findAll('.option.out')).toHaveLength(0);
  });

  it('Đèn Pin loại một lựa chọn sai, không được 3 sao; hết Đèn Pin thì Tomo báo hết', async () => {
    settings.ageGroup = 'mam';
    const w = mountView();
    const answer = answerOf(w, decks.en);
    await w.get('[data-testid="listen-hint"]').trigger('click');
    expect(hints.value).toBe(START_HINTS - 1);
    expect(lastSaid()).toEqual([{ lang: 'vi', text: phrases.hint }]);
    const out = w.findAll('.option.out');
    expect(out).toHaveLength(1);
    expect(out[0]!.attributes('data-testid')).not.toBe(`listen-option-${answer}`);
    // Mầm có 3 lựa chọn: loại hết lựa chọn sai thì nút tắt.
    await w.get('[data-testid="listen-hint"]').trigger('click');
    expect(w.findAll('.option.out')).toHaveLength(2);
    expect(w.get('[data-testid="listen-hint"]').attributes('disabled')).toBeDefined();
    expect(hints.value).toBe(START_HINTS - 2);

    await solveRound(w);
    expect(w.get('[data-testid="listen-hint"]').text()).toContain(String(START_HINTS - 2));
    hints.value = 0;
    await flushPromises();
    expect(w.get('[data-testid="listen-hint"]').attributes('disabled')).toBeUndefined();
    expect(w.get('[data-testid="listen-hint"]').attributes('aria-disabled')).toBe('true');
    const before = audio.mock!.said.length;
    await w.get('[data-testid="listen-hint"]').trigger('click');
    expect(audio.mock!.said.slice(before)).toEqual([[{ lang: 'vi', text: phrases.noHints }]]);
    expect(hints.value).toBe(0);
    expect(w.findAll('.option.out')).toHaveLength(0);

    for (let i = 0; i < 3; i++) await solveRound(w);
    await solveRound(w);
    const result = w.emitted('finish')![0]![0] as LevelResult;
    expect(result.usedHint).toBe(true);
    expect(result.stars).toBe(2);
    expect(result.firstTry).toHaveLength(5);
  });

  it('Mầm chỉ hiện hình, 3 lựa chọn, 5 đề', () => {
    settings.ageGroup = 'mam';
    const w = mountView();
    expect(optionIds(w)).toHaveLength(3);
    expect(w.findAll('.option .emoji')).toHaveLength(3);
    expect(w.find('.option .text').exists()).toBe(false);
    // Trình đọc màn hình nghe nghĩa tiếng Việt của hình (không phải từ đang học, vì đó là đáp án).
    const first = decks.en.items.find((i) => i.id === optionIds(w)[0])!;
    expect(w.get('.option').attributes('aria-label')).toBe(`Hình 1: ${first.meaningVi}`);
    expect(w.text()).toContain('1/5');
    expect(w.classes()).toContain('age-mam');
  });

  it('Cây chỉ hiện nghĩa; ẩn tiếng Việt thì quay về hình', async () => {
    settings.ageGroup = 'cay';
    const w = mountView();
    expect(optionIds(w)).toHaveLength(4);
    expect(w.text()).toContain('1/10');
    expect(w.find('.option .emoji').exists()).toBe(false);
    expect(w.findAll('.option .text')).toHaveLength(4);
    expect(w.get('.option').attributes('aria-label')).toBeUndefined();
    settings.showVietnamese = false;
    await w.vm.$nextTick();
    expect(w.find('.option .text').exists()).toBe(false);
    expect(w.findAll('.option .emoji')).toHaveLength(4);
  });

  it('Chồi ẩn tiếng Việt thì chỉ còn hình', () => {
    settings.showVietnamese = false;
    const w = mountView();
    expect(w.findAll('.option .emoji')).toHaveLength(4);
    expect(w.find('.option .text').exists()).toBe(false);
  });

  it('tắt tự đọc thì chọn đúng vẫn được khen một câu', async () => {
    settings.autoRead = false;
    const w = mountView({
      deck: decks.ja,
      level: regions.ja.flatMap((r) => r.levels).find((l) => l.game === 'listen'),
    });
    await w.get(`[data-testid="listen-option-${answerOf(w, decks.ja)}"]`).trigger('click');
    expect(lastSaid()).toEqual([{ lang: 'vi', text: phrases.correct }]);
  });

  it('màn gộp cả đảo không gửi levelId; màn ít từ lấy thêm nhiễu từ cả đảo', async () => {
    const all = islandContent('it', 'listen');
    const w = mountView({ deck: decks.it, level: all });
    for (let i = 0; i < 8; i++) await solveRound(w, decks.it);
    const result = w.emitted('finish')![0]![0] as LevelResult;
    expect(result).not.toHaveProperty('levelId');
    expect(result.stars).toBe(3);
    // Nút "Về đảo" ở khung kết quả cũng phát exit.
    await w.get('[data-testid="result"] .actions button:not(.primary)').trigger('click');
    expect(w.emitted('exit')).toHaveLength(1);

    const small = mountView({ level: { id: 'en-test', game: 'listen', items: ['en-apple', 'en-cat'] } });
    expect(optionIds(small)).toHaveLength(4);
  });

  it('nút quay về phát exit, gỡ màn thì dừng đọc', async () => {
    const w = mountView();
    await w.get('.back').trigger('click');
    expect(w.emitted('exit')).toHaveLength(1);
    audio.mock!.speaker.stop.mockClear();
    w.unmount();
    expect(audio.mock!.speaker.stop).toHaveBeenCalled();
  });
});
