import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { decks, findLevel, islandContent, levelSentences, phrases, type Level, type Sentence } from '@study/content';
import { defaultSettings, settings } from '../../settings';

const audio = vi.hoisted(() => ({
  mock: null as null | ReturnType<typeof import('../../test/audioMock').createAudioMock>,
}));
vi.mock('../../audio', async () => {
  const { createAudioMock } = await import('../../test/audioMock');
  audio.mock = createAudioMock();
  return audio.mock;
});

const { default: SentenceView } = await import('./SentenceView.vue');
const { hints, START_HINTS } = await import('../hints');

const enLevel = findLevel('en-r1-l5')!.level;
const jaLevel = findLevel('ja-r1-l4')!.level;

beforeEach(() => {
  Object.assign(settings, defaultSettings());
  hints.value = START_HINTS;
  audio.mock!.said.length = 0;
  audio.mock!.speaker.stop.mockClear();
});
afterEach(() => {
  vi.useRealTimers();
  delete (document as { elementFromPoint?: unknown }).elementFromPoint;
});

const said = () => audio.mock!.said;
const lastSaid = () => said().at(-1)!;

function mountView(level: Level = enLevel, subject: 'en' | 'ja' = 'en') {
  return mount(SentenceView, { props: { deck: decks[subject], level }, attachTo: document.body });
}

type W = VueWrapper<InstanceType<typeof SentenceView>>;

/** Câu đang chơi, tra theo emoji + số khối (mọi câu mẫu khác nhau ở cặp này hoặc ở chữ khối). */
function current(w: W, level: Level, subject: 'en' | 'ja'): Sentence {
  const texts = chunkTexts(w);
  return levelSentences(subject, level).find((s) => s.chunks.every((c) => texts.includes(c)))!;
}

function chunkTexts(w: W): string[] {
  return w.findAll('[data-testid^="sentence-chunk-"] .main').map((e) => e.text());
}

function trayIndex(w: W, text: string): number {
  const btn = w.findAll('[data-testid^="sentence-chunk-"]').find((b) => b.get('.main').text() === text)!;
  return Number(btn.attributes('data-testid')!.slice('sentence-chunk-'.length));
}

/** Xếp bằng bàn phím (click có detail = 0): chọn khối rồi chọn chỗ. */
async function placeByKeyboard(w: W, text: string, slot: number) {
  await w.get(`[data-testid="sentence-chunk-${trayIndex(w, text)}"]`).trigger('click');
  await w.get(`[data-testid="sentence-slot-${slot}"]`).trigger('click');
}

async function solve(w: W, order: readonly string[]) {
  for (const [slot, text] of order.entries()) await placeByKeyboard(w, text, slot);
  await w.get('[data-testid="sentence-done"]').trigger('click');
  await flushPromises();
}

const pointer = (type: string, x: number, y: number) =>
  Object.assign(new MouseEvent(type, { clientX: x, clientY: y, bubbles: true }), { pointerId: 1 });

function drag(from: Element, to: Element | null) {
  from.dispatchEvent(pointer('pointerdown', 0, 0));
  window.dispatchEvent(pointer('pointermove', 50, 50));
  document.elementFromPoint = () => to;
  window.dispatchEvent(pointer('pointerup', 50, 50));
}

describe('SentenceView', () => {
  it('vào màn đọc hướng dẫn + nghĩa tiếng Việt (Chồi); xếp hết câu thì đọc câu, phát finish và chơi lại được', async () => {
    const w = mountView();
    const first = current(w, enLevel, 'en');
    expect(said()[0]).toEqual([
      { lang: 'vi', text: phrases.sentenceIntro },
      { lang: 'vi', text: first.textVi, translation: true },
    ]);
    expect(w.findAll('[data-testid^="sentence-slot-"]')).toHaveLength(first.chunks.length);
    expect(w.get('.vi').text()).toBe(first.textVi);
    expect(w.get('[data-testid="sentence-done"]').attributes('disabled')).toBeDefined();
    expect(w.get('.count').text()).toBe('1/5');

    for (let i = 0; i < 5; i++) {
      const s = current(w, enLevel, 'en');
      await solve(w, s.chunks);
      // Đọc câu gốc + bản dịch khi đúng.
      expect(said()).toContainEqual([
        { lang: 'en', text: s.chunks.join(' ') },
        { lang: 'vi', text: s.textVi, translation: true },
      ]);
    }
    expect(w.find('[data-testid="result"]').exists()).toBe(true);
    expect(w.get('.count').text()).toBe('5/5');
    expect(lastSaid()).toEqual([{ lang: 'vi', text: phrases.roundWin }]);
    expect(w.emitted('finish')).toEqual([
      [{ levelId: 'en-r1-l5', game: 'sentence', stars: 3, firstTry: expect.any(Array), wrong: [], usedHint: false }],
    ]);
    expect((w.emitted('finish')![0]![0] as { firstTry: string[] }).firstTry).toHaveLength(5);

    await w.get('[data-testid="result"] .primary').trigger('click');
    await flushPromises();
    expect(w.find('[data-testid="result"]').exists()).toBe(false);
    expect(lastSaid()[0]).toEqual({ lang: 'vi', text: phrases.sentenceIntro });

    await w.get('.back').trigger('click');
    expect(w.emitted('exit')).toHaveLength(1);
    w.unmount();
    expect(audio.mock!.speaker.stop).toHaveBeenCalled();
  });

  it('nút Về đảo trong bảng kết quả phát exit; màn "-all" không có levelId', async () => {
    const all = islandContent('en', 'sentence');
    const w = mountView(all);
    for (let i = 0; i < 5; i++) await solve(w, current(w, all, 'en').chunks);
    const result = w.emitted('finish')![0]![0] as { levelId?: string };
    expect(result).not.toHaveProperty('levelId');
    await w.get('[data-testid="result"] button:not(.primary)').trigger('click');
    expect(w.emitted('exit')).toHaveLength(1);
    w.unmount();
  });

  it('xếp sai thì khối sai rung đỏ, về khay, Tomo nhắc và đọc lại đề; sai thì mất 3 sao', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout'] });
    const w = mountView();
    const s = current(w, enLevel, 'en');
    const reversed = [...s.chunks].reverse();
    await solve(w, reversed);
    expect(lastSaid()).toEqual([
      { lang: 'vi', text: phrases.sentenceWrong },
      { lang: 'vi', text: s.textVi, translation: true },
    ]);
    const wrongCount = reversed.filter((t, i) => t !== s.chunks[i]).length;
    expect(w.findAll('.chunk.wrong')).toHaveLength(wrongCount);
    vi.advanceTimersByTime(500);
    await flushPromises();
    expect(w.findAll('.chunk.wrong')).toHaveLength(0);
    // Chỗ còn trống nên chưa bấm Xong được; bấm (bàn phím) cũng không chấm.
    await w.get('[data-testid="sentence-done"]').trigger('click');
    expect(w.get('[data-testid="sentence-done"]').attributes('disabled')).toBeDefined();
    w.unmount();
  });

  it('chạm khối thì chọn và nghe khối; chạm lại thì bỏ chọn; chạm khối đã đặt thì về khay; đổi khối ở chỗ đã có', async () => {
    const w = mountView(jaLevel, 'ja');
    const s = current(w, jaLevel, 'ja');
    const a = trayIndex(w, s.chunks[0]!);
    const b = trayIndex(w, s.chunks[1]!);
    const chunkA = w.get(`[data-testid="sentence-chunk-${a}"]`);
    expect(chunkA.get('.main').attributes('lang')).toBe('ja');
    await chunkA.trigger('click');
    expect(chunkA.classes()).toContain('selected');
    expect(lastSaid()).toEqual([{ lang: 'ja', text: s.readings?.[0] ?? s.chunks[0] }]);
    await chunkA.trigger('click');
    expect(chunkA.classes()).not.toContain('selected');

    // Chuột / ngón tay chạm chỗ trống (detail = 1) vẫn đặt được khối đang chọn.
    await w.get(`[data-testid="sentence-chunk-${a}"]`).trigger('click');
    await w.get('[data-testid="sentence-slot-0"]').trigger('click', { detail: 1 });
    expect(w.get('[data-testid="sentence-slot-0"]').text()).toContain(s.chunks[0]);
    expect(w.find(`[data-testid="sentence-chunk-${a}"]`).exists()).toBe(false);
    expect(w.findAll('.chunk.ghost')).toHaveLength(1);
    // Chuột chạm chỗ đã có khối thì để useDrag xử lý (không làm gì ở click).
    await w.get('[data-testid="sentence-slot-0"]').trigger('click', { detail: 1 });
    expect(w.get('[data-testid="sentence-slot-0"]').text()).toContain(s.chunks[0]);

    // Đang chọn khối khác mà chạm chỗ đã có: đổi khối, khối cũ về khay.
    await w.get(`[data-testid="sentence-chunk-${b}"]`).trigger('click');
    await w.get('[data-testid="sentence-slot-0"]').trigger('click');
    expect(w.get('[data-testid="sentence-slot-0"]').text()).toContain(s.chunks[1]);
    expect(w.find(`[data-testid="sentence-chunk-${a}"]`).exists()).toBe(true);
    // Chạm khối đã đặt (không chọn gì) thì về khay.
    await w.get('[data-testid="sentence-slot-0"]').trigger('click');
    expect(w.find(`[data-testid="sentence-chunk-${b}"]`).exists()).toBe(true);
    expect(w.get('[data-testid="sentence-slot-0"]').attributes('aria-label')).toBe('Chỗ trống số 1');
    w.unmount();
  });

  it('khối tiếng Nhật có kanji hiện thêm かな', async () => {
    // Câu có kanji (水を / 本を) là một trong 5 câu; chơi tới khi gặp.
    const w = mountView(jaLevel, 'ja');
    for (let i = 0; i < 5; i++) {
      const s = current(w, jaLevel, 'ja');
      const k = s.readings?.findIndex((r) => r !== null) ?? -1;
      if (k >= 0) {
        const chunk = w.get(`[data-testid="sentence-chunk-${trayIndex(w, s.chunks[k]!)}"]`);
        expect(chunk.get('.sub').text()).toBe(s.readings![k]);
        expect(chunk.get('.sub').attributes('lang')).toBe('ja');
        await placeByKeyboard(w, s.chunks[k]!, k);
        expect(w.get(`[data-testid="sentence-slot-${k}"] .sub`).text()).toBe(s.readings![k]);
        w.unmount();
        return;
      }
      await solve(w, s.chunks);
    }
    throw new Error('không gặp câu có kanji');
  });

  it('kéo khối vào chỗ, kéo khối đã đặt về khay; chạm bằng ngón tay là chọn; đang kéo có khối bay theo', async () => {
    const w = mountView();
    const s = current(w, enLevel, 'en');
    const a = trayIndex(w, s.chunks[0]!);
    const slot0 = w.get('[data-testid="sentence-slot-0"]').element;

    const chunk = w.get(`[data-testid="sentence-chunk-${a}"]`).element;
    chunk.dispatchEvent(pointer('pointerdown', 0, 0));
    window.dispatchEvent(pointer('pointermove', 40, 40));
    await flushPromises();
    expect(w.get('.floating').text()).toBe(s.chunks[0]);
    document.elementFromPoint = () => slot0;
    window.dispatchEvent(pointer('pointerup', 40, 40));
    await flushPromises();
    expect(w.find('.floating').exists()).toBe(false);
    expect(w.get('[data-testid="sentence-slot-0"]').text()).toContain(s.chunks[0]);

    // Kéo từ chỗ này sang chỗ khác.
    drag(slot0, w.get('[data-testid="sentence-slot-1"]').element);
    await flushPromises();
    expect(w.get('[data-testid="sentence-slot-1"]').text()).toContain(s.chunks[0]);

    // Kéo về khay.
    drag(w.get('[data-testid="sentence-slot-1"]').element, w.get('.tray').element);
    await flushPromises();
    expect(w.find(`[data-testid="sentence-chunk-${a}"]`).exists()).toBe(true);
    // Kéo khối trong khay thả vào khay: không đổi gì.
    drag(w.get(`[data-testid="sentence-chunk-${a}"]`).element, w.get('.tray').element);
    await flushPromises();
    expect(w.find(`[data-testid="sentence-chunk-${a}"]`).exists()).toBe(true);

    // Bấm rồi nhả không kéo = chạm: chọn khối.
    w.get(`[data-testid="sentence-chunk-${a}"]`).element.dispatchEvent(pointer('pointerdown', 0, 0));
    window.dispatchEvent(pointer('pointerup', 0, 0));
    await flushPromises();
    expect(w.get(`[data-testid="sentence-chunk-${a}"]`).classes()).toContain('selected');
    // Nhấn trên chỗ trống không bắt đầu kéo.
    w.get('[data-testid="sentence-slot-1"]').element.dispatchEvent(pointer('pointerdown', 0, 0));
    window.dispatchEvent(pointer('pointerup', 0, 0));
    await flushPromises();
    expect(w.get('[data-testid="sentence-slot-1"]').text()).toBe('');
    w.unmount();
  });

  it('Đèn Pin đặt đúng một khối, trừ kho, bỏ 3 sao; câu đã đúng hết thì không dùng; hết Đèn Pin thì Tomo báo hết', async () => {
    const w = mountView();
    const s = current(w, enLevel, 'en');
    await w.get('[data-testid="sentence-hint"]').trigger('click');
    expect(hints.value).toBe(START_HINTS - 1);
    expect(lastSaid()).toEqual([{ lang: 'vi', text: phrases.hint }]);
    expect(w.get('[data-testid="sentence-slot-0"]').text()).toContain(s.chunks[0]);
    expect(w.get('[data-testid="sentence-hint"]').text()).toContain(String(START_HINTS - 1));

    for (const [slot, text] of s.chunks.entries()) if (slot > 0) await placeByKeyboard(w, text, slot);
    await w.get('[data-testid="sentence-hint"]').trigger('click');
    expect(hints.value).toBe(START_HINTS - 1);

    await w.get('[data-testid="sentence-done"]').trigger('click');
    await flushPromises();
    hints.value = 0;
    await flushPromises();
    const btn = w.get('[data-testid="sentence-hint"]');
    expect(btn.attributes('disabled')).toBeUndefined();
    expect(btn.attributes('aria-disabled')).toBe('true');
    const before = said().length;
    await btn.trigger('click');
    expect(said().slice(before)).toEqual([[{ lang: 'vi', text: phrases.noHints }]]);
    expect(hints.value).toBe(0);
    expect(w.get('[data-testid="sentence-slot-0"]').text()).toBe('');

    for (let i = 1; i < 5; i++) await solve(w, current(w, enLevel, 'en').chunks);
    const result = w.emitted('finish')![0]![0] as { stars: number; usedHint: boolean };
    expect(result.usedHint).toBe(true);
    expect(result.stars).toBe(2);
    w.unmount();
  });

  it('nhóm Cây nghe câu gốc làm đề và có khối nhiễu; chạm khối nhiễu nghe khối đó; Nghe lại đọc lại đề', async () => {
    settings.ageGroup = 'cay';
    const w = mountView(jaLevel, 'ja');
    const first = current(w, jaLevel, 'ja');
    expect(said()[0]![1]).toEqual({ lang: 'ja', text: first.chunks.map((c, i) => first.readings?.[i] ?? c).join('') });
    await w.get('[data-testid="sentence-replay"]').trigger('click');
    expect(lastSaid()).toEqual([said()[0]![1]]);

    for (let i = 0; i < 5; i++) {
      const s = current(w, jaLevel, 'ja');
      if (s.distractors) {
        expect(chunkTexts(w)).toContain(s.distractors[0]);
        await w.get(`[data-testid="sentence-chunk-${trayIndex(w, s.distractors[0]!)}"]`).trigger('click');
        expect(lastSaid()).toEqual([{ lang: 'ja', text: s.distractors[0] }]);
        await w.get(`[data-testid="sentence-chunk-${trayIndex(w, s.distractors[0]!)}"]`).trigger('click');
      }
      await solve(w, s.chunks);
    }
    expect(w.find('[data-testid="result"]').exists()).toBe(true);
    w.unmount();
  });

  /** Xếp đúng câu rồi bấm Xong, nhưng lời đọc lại câu treo đến khi gọi hàm trả về (như giọng thật đang đọc dở). */
  async function solveHeld(w: W, order: readonly string[]): Promise<() => void> {
    for (const [slot, text] of order.entries()) await placeByKeyboard(w, text, slot);
    let release!: () => void;
    audio.mock!.speaker.say.mockImplementationOnce(async (segments) => {
      said().push(segments);
      await new Promise<void>((r) => (release = r));
    });
    await w.get('[data-testid="sentence-done"]').trigger('click');
    await flushPromises();
    return () => release();
  }

  it('rời màn khi đang đọc lại câu đúng: không đọc đề câu sau, không phát finish', async () => {
    const w = mountView();
    for (let i = 0; i < 4; i++) await solve(w, current(w, enLevel, 'en').chunks);
    // Câu cuối: đang đọc lại thì bấm ← Đảo (màn bị gỡ, speaker.stop() cắt lời đọc).
    const last = current(w, enLevel, 'en');
    const release = await solveHeld(w, last.chunks);
    expect(lastSaid()).toEqual([
      { lang: 'en', text: last.chunks.join(' ') },
      { lang: 'vi', text: last.textVi, translation: true },
    ]);
    const count = said().length;
    w.unmount();
    release();
    await flushPromises();
    expect(said()).toHaveLength(count);
    expect(w.emitted('finish')).toBeUndefined();

    // Câu giữa màn: cũng không đọc đề câu sau.
    const w2 = mountView();
    const release2 = await solveHeld(w2, current(w2, enLevel, 'en').chunks);
    const count2 = said().length;
    w2.unmount();
    release2();
    await flushPromises();
    expect(said()).toHaveLength(count2);
  });

  it('đang đọc lại câu đúng thì Nghe lại và Đèn Pin tắt; đọc xong mới sang câu sau', async () => {
    const w = mountView();
    const release = await solveHeld(w, current(w, enLevel, 'en').chunks);
    const replayBtn = w.get('[data-testid="sentence-replay"]');
    expect(replayBtn.attributes('disabled')).toBeDefined();
    expect(w.get('[data-testid="sentence-hint"]').attributes('disabled')).toBeDefined();
    const count = said().length;
    await replayBtn.trigger('click');
    expect(said()).toHaveLength(count);
    expect(w.get('.count').text()).toBe('1/5');

    release();
    await flushPromises();
    expect(w.get('.count').text()).toBe('2/5');
    expect(w.get('[data-testid="sentence-replay"]').attributes('disabled')).toBeUndefined();
    const second = current(w, enLevel, 'en');
    expect(lastSaid()).toEqual([{ lang: 'vi', text: second.textVi, translation: true }]);
    w.unmount();
  });

  it('ẩn tiếng Việt: không hiện nghĩa, Chồi cũng nghe câu gốc làm đề', () => {
    settings.showVietnamese = false;
    const w = mountView();
    const s = current(w, enLevel, 'en');
    expect(w.find('.vi').exists()).toBe(false);
    expect(said()[0]![1]).toEqual({ lang: 'en', text: s.chunks.join(' ') });
    w.unmount();
  });
});
