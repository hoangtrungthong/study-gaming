import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { toRomaji } from 'wanakana';
import { decks, islandContent, phrases, regions, type Deck, type LearnItem, type Level } from '@study/content';
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

const { default: WriteView } = await import('./WriteView.vue');

const levels = (deck: Deck) => regions[deck.subject].flatMap((r) => r.levels);
/** Màn Ghép Đôi có từ mới: Viết Lại Từ dùng các từ mới này. */
const newWordsLevel = levels(decks.en).find((l) => l.newWords)!;
/** Màn riêng của Viết Lại Từ (không có `newWords`): dùng toàn bộ từ của màn. */
const writeLevel = levels(decks.en).find((l) => l.game === 'write')!;

beforeEach(() => {
  Object.assign(settings, defaultSettings());
  hints.value = START_HINTS;
  audio.mock!.said.length = 0;
  audio.mock!.speaker.say.mockClear();
  audio.mock!.speaker.stop.mockClear();
});

const said = () => audio.mock!.said;
const lastSaid = () => said().at(-1)!;
const answerOf = (item: LearnItem) => item.reading ?? item.term;
const term = (deck: Deck, item: LearnItem) => ({ lang: deck.termLang, text: answerOf(item) });
const meaning = (item: LearnItem) => ({ lang: 'vi', text: item.meaningVi, translation: true });

/** Từ đang hỏi: từ được đọc gần nhất. */
function current(deck: Deck): LearnItem {
  for (const seg of said().flat().reverse()) {
    const found = deck.items.find((i) => seg.lang === deck.termLang && answerOf(i) === seg.text);
    if (found) return found;
  }
  throw new Error('chưa đọc từ nào');
}

function mountView(deck: Deck = decks.en, level: Level = newWordsLevel) {
  return mount(WriteView, { props: { deck, level }, attachTo: document.body });
}

async function type(w: VueWrapper, text: string) {
  await w.get('[data-testid="write-input"]').setValue(text);
  await w.get('[data-testid="write-check"]').trigger('submit');
  await flushPromises();
}

async function next(w: VueWrapper) {
  await w.get('[data-testid="write-next"]').trigger('click');
  await flushPromises();
}

const boxStates = (w: VueWrapper) => w.findAll('[data-testid="write-box"]').map((b) => b.classes());
const boxTexts = (w: VueWrapper) => w.findAll('[data-testid="write-box"]').map((b) => b.text());

describe('WriteView', () => {
  it('Chồi: đọc hướng dẫn rồi nghĩa và từ, hiện hình và ô trống theo số chữ; ô gõ dùng bàn phím máy', async () => {
    const w = mountView();
    expect(w.classes()).toContain('write');
    expect(w.get('h2').text()).toBe('Viết Lại Từ');
    expect(w.get('h2').attributes('tabindex')).toBe('-1');
    const item = current(decks.en);
    expect(newWordsLevel.newWords).toContain(item.id);
    expect(said()[0]).toEqual([{ lang: 'vi', text: phrases.writeIntro }, meaning(item), term(decks.en, item)]);
    expect(w.text()).toContain(`1/${newWordsLevel.newWords!.length}`);
    expect(w.get('[data-testid="write-card"]').text()).toContain(item.emoji);
    // Mức Nhớ: chỉ hình + tiếng, ô trống không có chữ mờ.
    expect(boxTexts(w)).toEqual([...item.term].map(() => ''));
    expect(w.find('.ghost').exists()).toBe(false);
    expect(w.find('[data-testid="virtual-keyboard"]').exists()).toBe(false);

    const input = w.get('[data-testid="write-input"]');
    expect(input.attributes()).toMatchObject({
      lang: 'en',
      autocomplete: 'off',
      autocapitalize: 'off',
      autocorrect: 'off',
      spellcheck: 'false',
    });
    expect(input.attributes('readonly')).toBeUndefined();
    expect(document.activeElement).toBe(input.element);

    // Gõ đúng chữ nào ô đó xanh, sai thì đỏ.
    await input.setValue(`${item.term[0]}#`);
    expect(boxStates(w)[0]).toContain('ok');
    expect(boxStates(w)[1]).toContain('bad');
    expect(boxTexts(w).slice(0, 2)).toEqual([item.term[0], '#']);

    await w.get('[data-testid="write-replay"]').trigger('click');
    expect(lastSaid()).toEqual([meaning(item), term(decks.en, item)]);
    w.unmount();
  });

  it('gõ sai thì giữ chữ, đọc lại từ chậm; sai 2 lần hiện chữ đầu, 3 lần hiện cả từ; đúng thì đọc từ + ví dụ', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout'] });
    const w = mountView();
    const first = current(decks.en);

    await type(w, 'zzz');
    const input = w.get<HTMLInputElement>('[data-testid="write-input"]');
    expect(input.element.value).toBe('zzz');
    expect(w.get('form').classes()).toContain('bad');
    expect(lastSaid()).toEqual([{ lang: 'vi', text: phrases.wrong }, term(decks.en, first)]);
    expect(audio.mock!.speaker.say.mock.lastCall![2]).toBe(0.8);
    vi.advanceTimersByTime(500);
    await flushPromises();
    expect(w.get('form').classes()).not.toContain('bad');

    // Ô trống: không chấm, không đọc gì.
    const before = said().length;
    await type(w, '  ');
    expect(said()).toHaveLength(before);

    await type(w, 'yyy');
    expect(lastSaid()).toEqual([
      { lang: 'vi', text: phrases.wrong },
      { lang: 'vi', text: phrases.writeHintFirst },
      term(decks.en, first),
    ]);
    await type(w, '');
    expect(boxTexts(w)[0]).toBe(first.term[0]);
    expect(boxTexts(w)[1]).toBe('');
    await type(w, 'xxx');
    expect(lastSaid()[1]).toEqual({ lang: 'vi', text: phrases.writeHintAll });
    await type(w, '');
    expect(boxTexts(w)).toEqual([...first.term]);
    expect(w.get('[data-testid="write-hint"]').attributes('disabled')).toBeDefined();

    await type(w, first.term.toUpperCase());
    expect(w.get('form').classes()).toContain('ok');
    expect(lastSaid()).toEqual([
      { lang: 'vi', text: phrases.correct },
      term(decks.en, first),
      { lang: 'en', text: first.example },
      { lang: 'vi', text: first.exampleVi, translation: true },
    ]);
    const done = w.get('[data-testid="write-done"]');
    expect(done.text()).toContain(first.term);
    expect(done.text()).toContain(first.example!);
    expect(done.text()).toContain(first.exampleVi!);
    expect(w.find('[data-testid="write-hint"]').exists()).toBe(false);
    expect(w.get('[data-testid="write-next"]').text()).toBe('Tiếp →');

    await next(w);
    expect(input.element.value).toBe('');
    expect(document.activeElement).toBe(input.element);
    const second = current(decks.en);
    expect(second.id).not.toBe(first.id);
    expect(lastSaid()).toEqual([meaning(second), term(decks.en, second)]);
    expect(w.text()).toContain('2/3');

    await type(w, answerOf(second));
    await next(w);
    const third = current(decks.en);
    await type(w, answerOf(third));
    expect(w.get('[data-testid="write-next"]').text()).toBe('Xong');
    await next(w);
    expect(w.find('[data-testid="result"]').exists()).toBe(true);
    expect(lastSaid()).toEqual([{ lang: 'vi', text: phrases.roundWin }]);
    const [result] = w.emitted<[LevelResult]>('finish')![0]!;
    // Sai 3 lần trên 3 từ: 1 sao; hiện chữ do gõ sai không tính là dùng Đèn Pin.
    expect(result).toEqual({
      levelId: newWordsLevel.id,
      game: 'write',
      stars: 1,
      firstTry: [second.id, third.id],
      wrong: [first.id],
      usedHint: false,
    });

    await w.get('[data-testid="result"] .primary').trigger('click');
    await flushPromises();
    expect(w.find('[data-testid="result"]').exists()).toBe(false);
    expect(w.text()).toContain('1/3');
    expect(lastSaid()[0]).toEqual({ lang: 'vi', text: phrases.writeIntro });
    w.unmount();
    vi.useRealTimers();
  });

  it('Cây, lối vào cả đảo: 5 từ của màn, kết quả không có levelId, 3 sao khi không sai', async () => {
    settings.ageGroup = 'cay';
    const all = islandContent('en', 'write');
    const w = mountView(decks.en, all);
    expect(w.text()).toContain('1/5');
    for (let i = 0; i < 5; i++) {
      const item = current(decks.en);
      expect(all.items).toContain(item.id);
      await type(w, item.term);
      await next(w);
    }
    const [result] = w.emitted<[LevelResult]>('finish')![0]!;
    expect(result.levelId).toBeUndefined();
    expect(result.stars).toBe(3);
    expect(result.firstTry).toHaveLength(5);
    expect(w.get('[data-testid="result"]').text()).toContain('sai 0 lần');
    await w.get('[data-testid="result"] button:not(.primary)').trigger('click');
    expect(w.emitted('exit')).toHaveLength(1);
    w.unmount();

    const own = mountView(decks.en, writeLevel);
    expect(writeLevel.items).toContain(current(decks.en).id);
    own.unmount();
  });

  it('Đèn Pin: đọc câu gợi ý cùng chữ tiếp theo trong một lượt; dùng gợi ý thì không được 3 sao', async () => {
    // Đủ Đèn Pin để soi hết cả từ dài nhất (5 chữ).
    hints.value = 10;
    const w = mountView();
    const item = current(decks.en);

    await w.get('[data-testid="write-hint"]').trigger('click');
    expect(hints.value).toBe(9);
    expect(boxTexts(w)[0]).toBe(item.term[0]);
    expect(w.findAll('.ghost')).toHaveLength(1);
    expect(lastSaid()).toEqual([
      { lang: 'vi', text: phrases.hint },
      { lang: 'en', text: item.term[0]!.toLowerCase() },
    ]);

    // Đã gõ đúng 2 chữ đầu thì gợi ý chữ thứ 3.
    await w.get('[data-testid="write-input"]').setValue(item.term.slice(0, 2));
    await w.get('[data-testid="write-hint"]').trigger('click');
    expect(lastSaid()[1]).toEqual({ lang: 'en', text: item.term[2]!.toLowerCase() });

    for (let i = 0; i < 10 && w.get('[data-testid="write-hint"]').attributes('disabled') === undefined; i++) {
      await w.get('[data-testid="write-hint"]').trigger('click');
    }
    expect(w.get('[data-testid="write-hint"]').attributes('disabled')).toBeDefined();
    const left = hints.value;
    // Nút đã tắt: bấm cũng không tốn Đèn Pin.
    await w.get('[data-testid="write-hint"]').trigger('click');
    expect(hints.value).toBe(left);

    await type(w, item.term);
    await next(w);
    for (let i = 0; i < 2; i++) {
      await type(w, answerOf(current(decks.en)));
      await next(w);
    }
    const [result] = w.emitted<[LevelResult]>('finish')![0]!;
    expect(result.usedHint).toBe(true);
    expect(result.stars).toBe(2);
    expect(result.firstTry).not.toContain(item.id);
    w.unmount();
  });

  it('hết Đèn Pin thì nút mờ nhưng vẫn bấm được, hiện số 0; bấm thì Tomo báo hết, không hiện gợi ý', async () => {
    hints.value = 0;
    const w = mountView();
    const btn = w.get('[data-testid="write-hint"]');
    expect(btn.attributes('disabled')).toBeUndefined();
    expect(btn.attributes('aria-disabled')).toBe('true');
    expect(btn.text()).toContain('0');
    audio.mock!.said.length = 0;
    await btn.trigger('click');
    expect(said()).toEqual([[{ lang: 'vi', text: phrases.noHints }]]);
    expect(hints.value).toBe(0);
    expect(w.find('.ghost').exists()).toBe(false);
    w.unmount();
  });

  it('Đèn Pin đọc chữ vừa hiện bằng chữ thường (âm thanh tạo sẵn là chữ thường), ô vẫn hiện đúng chữ hoa', async () => {
    const level: Level = { id: 'it-x', game: 'write', items: ['it-cpu'] };
    const w = mountView(decks.it, level);
    expect(current(decks.it).term).toBe('CPU');
    await w.get('[data-testid="write-hint"]').trigger('click');
    expect(boxTexts(w)[0]).toBe('C');
    expect(lastSaid()).toEqual([
      { lang: 'vi', text: phrases.hint },
      { lang: 'en', text: 'c' },
    ]);
    w.unmount();
  });

  it('Mầm: mức Chép hiện chữ mờ trong ô, gõ bằng bàn phím ảo, ô gõ chỉ đọc', async () => {
    settings.ageGroup = 'mam';
    const deck = decks.ja;
    const level = levels(deck).find((l) => l.newWords)!;
    const w = mountView(deck, level);
    const item = current(deck);
    const chars = [...answerOf(item)];
    expect(boxTexts(w)).toEqual(chars);
    expect(w.findAll('.ghost')).toHaveLength(chars.length);
    expect(w.get('[data-testid="write-boxes"]').attributes('lang')).toBe('ja');
    const input = w.get<HTMLInputElement>('[data-testid="write-input"]');
    expect(input.attributes('readonly')).toBeDefined();
    expect(input.attributes('inputmode')).toBe('none');
    expect(w.find('[data-testid="virtual-keyboard"]').exists()).toBe(true);

    await w.get(`[data-testid="vkey-${chars[0]}"]`).trigger('click');
    await w.get(`[data-testid="vkey-${chars[0]}"]`).trigger('click');
    expect(input.element.value).toBe(chars[0]! + chars[0]!);
    await w.get('[data-testid="vkey-back"]').trigger('click');
    expect(input.element.value).toBe(chars[0]);
    for (const c of chars.slice(1)) await w.get(`[data-testid="vkey-${c}"]`).trigger('click');
    expect(input.element.value).toBe(answerOf(item));
    await w.get('[data-testid="write-check"]').trigger('submit');
    await flushPromises();
    expect(lastSaid()[0]).toEqual({ lang: 'vi', text: phrases.correct });
    expect(w.find('[data-testid="virtual-keyboard"]').exists()).toBe(false);
    w.unmount();
  });

  it('Mầm: bàn phím ảo tự thêm khoảng trắng giữa hai từ', async () => {
    settings.ageGroup = 'mam';
    const thanks = decks.en.items.find((i) => i.term.includes(' '))!;
    const w = mountView(decks.en, { id: 'test-thanks', game: 'write', items: [thanks.id] });
    const input = w.get<HTMLInputElement>('[data-testid="write-input"]');
    for (const c of thanks.term.replace(/ /g, '')) await w.get(`[data-testid="vkey-${c}"]`).trigger('click');
    expect(input.element.value).toBe(thanks.term);
    expect(w.findAll('[data-testid="write-box"].space')).toHaveLength(1);
    // Xoá chữ ngay sau khoảng trắng thì bỏ luôn khoảng trắng.
    const firstWord = thanks.term.split(' ')[0]!;
    for (let i = thanks.term.length; i > firstWord.length + 1; i--) {
      await w.get('[data-testid="vkey-back"]').trigger('click');
    }
    expect(input.element.value).toBe(firstWord);
    w.unmount();
  });

  it('tiếng Nhật: gõ romaji có xem trước かな, không chấm khi đang soạn chữ bằng bộ gõ', async () => {
    const deck = decks.ja;
    const level = levels(deck).find((l) => l.newWords)!;
    const w = mountView(deck, level);
    const item = current(deck);
    const input = w.get('[data-testid="write-input"]');
    expect(input.attributes('lang')).toBe('ja');

    await input.setValue('ne');
    expect(w.get('.preview').text()).toBe('ね');

    await input.trigger('compositionstart');
    const before = said().length;
    await type(w, answerOf(item));
    expect(said()).toHaveLength(before);
    await input.trigger('compositionend');
    await w.get('[data-testid="write-check"]').trigger('submit');
    await flushPromises();
    expect(lastSaid()[0]).toEqual({ lang: 'vi', text: phrases.correct });
    await next(w);

    const nextItem = current(deck);
    // Gõ romaji của cách đọc cũng đúng.
    await w.get('[data-testid="write-input"]').setValue(toRomaji(answerOf(nextItem)));
    expect(boxStates(w).every((c) => c.includes('ok'))).toBe(true);
    await w.get('[data-testid="write-check"]').trigger('submit');
    await flushPromises();
    expect(lastSaid()[1]).toEqual(term(deck, nextItem));
    w.unmount();
  });

  it('từ có kanji: gõ xong hiện kanji, cách đọc và Hán Việt; tắt tiếng Việt thì ẩn Hán Việt và dịch ví dụ', async () => {
    const mizu = decks.ja.items.find((i) => i.id === 'ja-mizu')!;
    const level: Level = { id: 'test-mizu', game: 'write', items: [mizu.id] };
    const w = mountView(decks.ja, level);
    expect(boxTexts(w)).toHaveLength([...mizu.reading!].length);
    await type(w, 'mizu');
    const done = w.get('[data-testid="write-done"]');
    expect(done.text()).toContain(mizu.term);
    expect(done.text()).toContain(mizu.reading);
    expect(done.text()).toContain(`Hán Việt: ${mizu.hanViet}`);
    expect(done.text()).toContain(mizu.exampleVi);
    w.unmount();

    settings.showVietnamese = false;
    const hidden = mountView(decks.ja, level);
    await type(hidden, 'みず');
    expect(hidden.get('[data-testid="write-done"]').text()).not.toContain('Hán Việt');
    expect(hidden.get('[data-testid="write-done"]').text()).not.toContain(mizu.exampleVi);
    expect(hidden.get('[data-testid="write-done"]').text()).toContain(mizu.example);
    hidden.unmount();
  });

  it('từ không có câu ví dụ: gõ xong chỉ đọc lại từ', async () => {
    const deck = decks.it;
    const plain = deck.items.find((i) => !i.example)!;
    const w = mountView(deck, { id: 'test-it', game: 'write', items: [plain.id] });
    await type(w, plain.term);
    expect(lastSaid()).toEqual([{ lang: 'vi', text: phrases.correct }, term(deck, plain)]);
    expect(w.find('.example').exists()).toBe(false);
    w.unmount();
  });

  it('nút về đảo phát exit; gỡ màn thì dừng đọc', async () => {
    const w = mountView();
    await w.get('.back').trigger('click');
    expect(w.emitted('exit')).toHaveLength(1);
    w.unmount();
    expect(audio.mock!.speaker.stop).toHaveBeenCalled();
  });
});
