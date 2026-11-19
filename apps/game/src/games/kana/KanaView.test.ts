import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { decks, findKana, findLevel, islandContent, loadKanaStrokes, phrases, type Level } from '@study/content';
import { defaultSettings, settings } from '../../settings';
import { hints, START_HINTS } from '../hints';
import type { LevelResult } from '../result';
import type { Point } from './strokeMatch';

const audio = vi.hoisted(() => ({
  mock: null as null | ReturnType<typeof import('../../test/audioMock').createAudioMock>,
}));
vi.mock('../../audio', async () => {
  const { createAudioMock } = await import('../../test/audioMock');
  audio.mock = createAudioMock();
  return audio.mock;
});

const { default: KanaView } = await import('./KanaView.vue');

const level = findLevel('ja-r1-l2')!.level;
const kana = await loadKanaStrokes();
const strokesOf = (char: string) => findKana(kana, char)!.strokes;

beforeEach(() => {
  Object.assign(settings, defaultSettings());
  hints.value = START_HINTS;
  audio.mock!.said.length = 0;
  audio.mock!.speaker.stop.mockClear();
});
afterEach(() => vi.useRealTimers());

const said = () => audio.mock!.said;
const lastSaid = () => said().at(-1)!;
const ja = (text: string) => ({ lang: 'ja', text });
const vi_ = (text: string) => ({ lang: 'vi', text });
/** Từ ví dụ đọc sau tên chữ: từ tiếng Nhật rồi nghĩa (dòng dịch). */
const example = (text: string, meaning: string) => [ja(text), { lang: 'vi', text: meaning, translation: true }];

async function play(lvl: Level = level) {
  const w = mount(KanaView, { props: { deck: decks.ja, level: lvl } });
  await vi.waitFor(() => expect(w.find('.kana').attributes('data-ready')).toBe('true'));
  return w;
}

const auto = (w: VueWrapper) => w.get('[data-testid="kana-auto-stroke"]').trigger('click');

/** Vẽ một nét bằng con trỏ trên bảng giả kích thước 218×218 px (gấp đôi khung 109). */
async function draw(w: VueWrapper, pts: Point[]) {
  const board = w.get('[data-testid="kana-board"]');
  const rect = vi.spyOn(board.element, 'getBoundingClientRect').mockReturnValue({
    left: 10,
    top: 20,
    width: 218,
    height: 218,
  } as DOMRect);
  rect.mockClear();
  const at = ([x, y]: Point) => ({ clientX: 10 + x * 2, clientY: 20 + y * 2, pointerId: 1 });
  await board.trigger('pointerdown', at(pts[0]!));
  for (const p of pts.slice(1)) await board.trigger('pointermove', at(p));
  await board.trigger('pointerup', at(pts.at(-1)!));
  return rect;
}

/** Tô hết chữ đang hiện bằng nút tô giúp. */
async function finishChar(w: VueWrapper, char: string) {
  for (let n = 0; n < strokesOf(char).length; n++) await auto(w);
}

describe('KanaView', () => {
  it('đọc hướng dẫn, tên chữ đầu và từ ví dụ; hiện chữ mờ, chấm đầu số 1 và mũi tên', async () => {
    const w = await play();
    expect(said()[0]).toEqual([vi_(phrases.kanaIntro), ja('あ'), ...example('ありがとう', 'cảm ơn')]);
    expect(w.get('h2').text()).toBe('Vẽ Kana');
    expect(w.get('[data-testid="kana-char"]').text()).toContain('あ');
    expect(w.get('[data-testid="kana-char"]').attributes('lang')).toBe('ja');
    expect(w.text()).toContain('1/5');
    expect(w.findAll('.guide')).toHaveLength(3);
    expect(w.get('.start-num').text()).toBe('1');
    expect(w.find('.next').exists()).toBe(true);
    expect(w.get('[data-testid="kana-board"]').attributes('viewBox')).toBe('0 0 109 109');
  });

  it('gỡ màn trước khi nạp xong dữ liệu thì không đọc gì', async () => {
    const w = mount(KanaView, { props: { deck: decks.ja, level } });
    w.unmount();
    await flushPromises();
    expect(said()).toEqual([]);
    expect(audio.mock!.speaker.stop).toHaveBeenCalled();
  });

  it('vẽ đúng nét bằng con trỏ thì nét hiện rõ và sang nét sau; vẽ sai thì nhắc, nét đỏ mờ đi', async () => {
    const w = await play();
    vi.useFakeTimers();
    const [s1, s2] = strokesOf('あ');

    await draw(w, s1!.slice().reverse());
    expect(lastSaid()).toEqual([vi_(phrases.kanaStrokeWrong)]);
    expect(w.find('.fading').exists()).toBe(true);
    expect(w.get('.next').classes()).toContain('blink');
    expect(w.findAll('.done-stroke')).toHaveLength(0);
    vi.advanceTimersByTime(500);
    await flushPromises();
    expect(w.find('.fading').exists()).toBe(false);

    // Khung bảng chỉ đo một lần lúc đặt bút, không đo lại mỗi lần di chuyển.
    const rect = await draw(w, s1!);
    expect(s1!.length).toBeGreaterThan(2);
    expect(rect).toHaveBeenCalledTimes(1);
    expect(w.findAll('.done-stroke')).toHaveLength(1);
    expect(w.get('.start-num').text()).toBe('2');
    expect(w.get('.next').classes()).not.toContain('blink');

    // Đang vẽ thì nét hiện theo tay; huỷ (pointercancel) thì bỏ nét đó.
    const board = w.get('[data-testid="kana-board"]');
    await board.trigger('pointerdown', { clientX: 10 + s2![0]![0] * 2, clientY: 20 + s2![0]![1] * 2, pointerId: 1 });
    expect(w.find('.drawing').exists()).toBe(true);
    await board.trigger('pointercancel');
    expect(w.find('.drawing').exists()).toBe(false);
    // Di chuyển hay thả tay khi chưa bấm xuống thì không có gì.
    await board.trigger('pointermove', { clientX: 50, clientY: 50 });
    await board.trigger('pointerup');
    expect(w.find('.drawing').exists()).toBe(false);
    expect(w.findAll('.done-stroke')).toHaveLength(1);
  });

  it('tô xong một chữ: đọc tên chữ, khen, khoá bảng rồi sang chữ sau và đọc tên chữ mới', async () => {
    const w = await play();
    vi.useFakeTimers();
    await finishChar(w, 'あ');
    expect(lastSaid()).toEqual([ja('あ')]);
    expect(w.find('.cheer').exists()).toBe(true);
    expect(w.findAll('.done-stroke')).toHaveLength(3);
    expect(w.get('[data-testid="kana-hint"]').attributes('disabled')).toBeDefined();
    expect(w.get('[data-testid="kana-auto-stroke"]').attributes('disabled')).toBeDefined();
    // Đang khen thì vẽ không được.
    await w.get('[data-testid="kana-board"]').trigger('pointerdown', { clientX: 0, clientY: 0, pointerId: 1 });
    expect(w.find('.drawing').exists()).toBe(false);

    vi.advanceTimersByTime(1200);
    await flushPromises();
    expect(w.find('.cheer').exists()).toBe(false);
    expect(w.get('[data-testid="kana-char"]').text()).toContain('い');
    expect(w.text()).toContain('2/5');
    expect(lastSaid()).toEqual([ja('い'), ...example('いぬ', 'con chó')]);
  });

  it('nhóm Cây: mũi tên chỉ hiện sau khi vẽ sai', async () => {
    settings.ageGroup = 'cay';
    const w = await play();
    expect(w.find('.next').exists()).toBe(false);
    await draw(w, [
      [0, 109],
      [5, 100],
    ]);
    expect(w.find('.next').exists()).toBe(true);
  });

  it('Đèn Pin hiện lại nét mẫu đang phải vẽ một lúc, hiện số còn lại; hết Đèn Pin thì Tomo báo hết', async () => {
    const w = await play();
    vi.useFakeTimers();
    await w.get('[data-testid="kana-hint"]').trigger('click');
    expect(hints.value).toBe(START_HINTS - 1);
    expect(lastSaid()).toEqual([vi_(phrases.hint)]);
    expect(w.find('[data-testid="kana-hint-stroke"]').exists()).toBe(true);
    expect(w.get('[data-testid="kana-hint"]').attributes('disabled')).toBeDefined();
    vi.advanceTimersByTime(1400);
    await flushPromises();
    expect(w.find('[data-testid="kana-hint-stroke"]').exists()).toBe(false);

    expect(w.get('[data-testid="kana-hint"]').text()).toContain(String(START_HINTS - 1));
    hints.value = 0;
    await flushPromises();
    expect(w.get('[data-testid="kana-hint"]').attributes('disabled')).toBeUndefined();
    expect(w.get('[data-testid="kana-hint"]').attributes('aria-disabled')).toBe('true');
    expect(w.get('[data-testid="kana-hint"]').attributes('aria-label')).toBe('Đèn Pin, còn 0');
    audio.mock!.said.length = 0;
    await w.get('[data-testid="kana-hint"]').trigger('click');
    expect(audio.mock!.said).toEqual([[vi_(phrases.noHints)]]);
    expect(hints.value).toBe(0);
    expect(w.find('[data-testid="kana-hint-stroke"]').exists()).toBe(false);
  });

  it('nút xem thứ tự nét chạy hoạt ảnh cả chữ rồi tắt', async () => {
    const w = await play();
    vi.useFakeTimers();
    await w.get('[data-testid="kana-replay"]').trigger('click');
    expect(w.findAll('.replay-stroke')).toHaveLength(3);
    expect(w.get('[data-testid="kana-replay"]').attributes('disabled')).toBeDefined();
    vi.advanceTimersByTime(700 * 4);
    await flushPromises();
    expect(w.findAll('.replay-stroke')).toHaveLength(0);
  });

  it('tô hết các chữ: đọc chữ cuối + lời khen, hiện kết quả, phát LevelResult; chơi lại được', async () => {
    const w = await play();
    vi.useFakeTimers();
    // Một nét sai ở chữ あ và dùng Đèn Pin: không được 3 sao.
    await draw(w, [
      [0, 109],
      [5, 100],
    ]);
    await w.get('[data-testid="kana-hint"]').trigger('click');
    for (const char of level.kana!) {
      await finishChar(w, char);
      vi.advanceTimersByTime(1200);
      await flushPromises();
    }
    expect(lastSaid()).toEqual([ja('お'), vi_(phrases.kanaDone)]);
    expect(w.find('[data-testid="result"]').exists()).toBe(true);
    expect(w.text()).toContain('vẽ sai 1 nét');
    const result = w.emitted('finish')![0]![0] as LevelResult;
    expect(result).toEqual({
      levelId: 'ja-r1-l2',
      game: 'kana',
      stars: 2,
      firstTry: ['い', 'う', 'え', 'お'],
      wrong: ['あ'],
      usedHint: true,
    });

    await w.get('[data-testid="result"] .primary').trigger('click');
    expect(w.find('[data-testid="result"]').exists()).toBe(false);
    expect(lastSaid()).toEqual([vi_(phrases.kanaIntro), ja('あ'), ...example('ありがとう', 'cảm ơn')]);
    expect(w.text()).toContain('1/5');
  });

  it('lối vào cả đảo không có levelId; nút quay lại phát exit, gỡ màn thì dừng đọc', async () => {
    const all = islandContent('ja', 'kana');
    const w = await play({ ...all, kana: ['ん'] });
    // Không từ nào bắt đầu bằng ん: chỉ đọc tên chữ.
    expect(said()[0]).toEqual([vi_(phrases.kanaIntro), ja('ん')]);
    await finishChar(w, 'ん');
    const result = w.emitted('finish')![0]![0] as LevelResult;
    expect(result.levelId).toBeUndefined();
    expect(result.stars).toBe(3);
    await w.get('[data-testid="result"] button:not(.primary)').trigger('click');
    await w.get('.back').trigger('click');
    expect(w.emitted('exit')).toHaveLength(2);
    w.unmount();
    expect(audio.mock!.speaker.stop).toHaveBeenCalled();
  });

  it('màn không có chữ có dữ liệu nét thì báo trống', async () => {
    const w = await play({ id: 'x', game: 'kana', kana: ['x'] });
    expect(w.text()).toContain('Màn này chưa có chữ để tô.');
    expect(w.find('[data-testid="kana-board"]').exists()).toBe(false);
    expect(said()[0]).toEqual([vi_(phrases.kanaIntro)]);
    const none = await play({ id: 'y', game: 'kana' });
    expect(none.text()).toContain('0/0');
  });
});
