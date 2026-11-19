import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { decks, islandContent, mazes, phrases, regions, viSegment, type Level } from '@study/content';
import { defaultSettings, settings } from '../../settings';
import { hints, START_HINTS } from '../hints';
import type { LevelResult } from '../result';
import type { ProgramContext } from './blocks';

const audio = vi.hoisted(() => ({
  mock: null as null | ReturnType<typeof import('../../test/audioMock').createAudioMock>,
}));
vi.mock('../../audio', async () => {
  const { createAudioMock } = await import('../../test/audioMock');
  audio.mock = createAudioMock();
  return audio.mock;
});

const { default: MazeView } = await import('./MazeView.vue');

const levelOf = (maze: string) => regions.it.flatMap((r) => r.levels).find((l) => l.maze === maze)!;

beforeEach(() => {
  Object.assign(settings, defaultSettings());
  hints.value = START_HINTS;
  audio.mock!.said.length = 0;
  audio.mock!.speaker.stop.mockClear();
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  delete (document as { elementFromPoint?: unknown }).elementFromPoint;
});

const said = () => audio.mock!.said;
const lastText = () =>
  said()
    .at(-1)!
    .map((s) => s.text);
const sel = (id: string) => `[data-testid="${id}"]`;
const mountView = (level: Level = levelOf('it-m-01')) => mount(MazeView, { props: { deck: decks.it, level } });

const pointer = (type: string, x: number, y: number) =>
  Object.assign(new MouseEvent(type, { clientX: x, clientY: y, bubbles: true }), { pointerId: 1 });

/** Chạm bằng ngón tay: nhấn rồi nhả tại chỗ (useDrag coi là chạm). */
async function tap(w: VueWrapper, selector: string) {
  await w.get(selector).trigger('pointerdown', { clientX: 0, clientY: 0, pointerId: 1 });
  window.dispatchEvent(pointer('pointerup', 0, 0));
  await flushPromises();
}

/** Kéo phần tử `fromSelector` thả lên phần tử `toSelector`. */
async function drag(w: VueWrapper, fromSelector: string, toSelector: string) {
  await w.get(fromSelector).trigger('pointerdown', { clientX: 0, clientY: 0, pointerId: 1 });
  window.dispatchEvent(pointer('pointermove', 80, 80));
  await flushPromises();
  expect(w.find('.floating').exists()).toBe(true);
  const target = w.get(toSelector).element;
  document.elementFromPoint = () => target;
  window.dispatchEvent(pointer('pointerup', 80, 80));
  await flushPromises();
}

const bitAt = (w: VueWrapper) => {
  const b = w.get(sel('maze-bit'));
  return [Number(b.attributes('data-x')), Number(b.attributes('data-y')), Number(b.attributes('data-dir'))];
};
const kinds = (w: VueWrapper) => w.findAll('[data-testid^="maze-block-"]').map((b) => b.classes()[1]);

async function runToEnd(w: VueWrapper) {
  await w.get(sel('maze-run')).trigger('click');
  await vi.runAllTimersAsync();
  await flushPromises();
}

describe('MazeView', () => {
  it('đọc đề và gợi ý, vẽ mê cung, chạm khối để thêm và nghe tên khối', async () => {
    const w = mountView();
    expect(w.classes()).toContain('maze');
    expect(w.get('h2').text()).toBe('Đưa Bit Về Nhà');
    expect(w.get('h2').attributes('tabindex')).toBe('-1');
    expect(said()[0]!.map((s) => s.text)).toEqual([phrases.mazeIntro, mazes[0]!.hintVi]);
    expect(w.findAll('.cell')).toHaveLength(16);
    expect(w.get('.cell.home').attributes('aria-label')).toBe('Hàng 3, cột 3: nhà của Bit');
    expect(w.get('.cell.wall').attributes('aria-label')).toContain('tường');
    expect(w.get('.cell').attributes('aria-label')).toBe('Hàng 1, cột 1: đường đi');
    expect(bitAt(w)).toEqual([0, 0, 1]);
    expect(w.find(sel('maze-palette-repeat')).exists()).toBe(false);
    expect(w.get(sel('maze-program')).element.tagName).toBe('OL');
    expect(w.get(sel('maze-run')).attributes('disabled')).toBeDefined();

    await tap(w, sel('maze-palette-forward'));
    expect(kinds(w)).toEqual(['forward']);
    expect(lastText()).toEqual([phrases.blockForward]);
    // Bàn phím: click không có detail.
    await w.get(sel('maze-palette-left')).trigger('click');
    expect(kinds(w)).toEqual(['forward', 'left']);
    expect(lastText()).toEqual([phrases.blockLeft]);
    // Click chuột (detail 1) đã do pointer xử lý: không thêm lần nữa.
    await w.get(sel('maze-palette-left')).trigger('click', { detail: 1 });
    expect(kinds(w)).toHaveLength(2);
    expect(w.get('.count').text()).toBe('2/6 khối');

    // Chạm / bấm phím vào khối trong chương trình thì nghe tên khối.
    await tap(w, `${sel('maze-block-1')} .grip`);
    expect(lastText()).toEqual([phrases.blockLeft]);
    await w.get(`${sel('maze-block-0')} .grip`).trigger('click');
    expect(lastText()).toEqual([phrases.blockForward]);
    await w.get(`${sel('maze-block-0')} .grip`).trigger('click', { detail: 1 });
    expect(lastText()).toEqual([phrases.blockForward]);

    await w.get(sel('maze-remove-1')).trigger('click');
    expect(kinds(w)).toEqual(['forward']);
    for (let i = 0; i < 5; i++) await w.get(sel('maze-palette-forward')).trigger('click');
    expect(kinds(w)).toHaveLength(6);
    await w.get(sel('maze-palette-forward')).trigger('click');
    expect(kinds(w)).toHaveLength(6);
    expect(lastText()).toEqual([phrases.mazeTooMany]);
  });

  it('chạy: Bit đi từng bước, khối đang chạy sáng lên; đụng tường thì khối lỗi đỏ; Về chỗ cũ đưa Bit về', async () => {
    const w = mountView();
    for (const k of ['forward', 'forward', 'forward']) await w.get(sel(`maze-palette-${k}`)).trigger('click');
    await w.get(sel('maze-run')).trigger('click');
    expect(w.get(sel('maze-run')).attributes('disabled')).toBeDefined();
    expect(w.get(sel('maze-palette-forward')).attributes('disabled')).toBeDefined();
    // Đang chạy thì không sửa được chương trình.
    await w.get(sel('maze-palette-forward')).trigger('click');
    await w.get(sel('maze-remove-0')).trigger('click');
    await w.get(sel('maze-run')).trigger('click');
    expect(kinds(w)).toHaveLength(3);

    await vi.advanceTimersByTimeAsync(400);
    expect(bitAt(w)).toEqual([1, 0, 1]);
    expect(w.get(sel('maze-block-0')).classes()).toContain('active');
    expect(lastText()).toEqual([phrases.blockForward]);
    await vi.advanceTimersByTimeAsync(400);
    expect(bitAt(w)).toEqual([2, 0, 1]);
    expect(w.get(sel('maze-block-1')).classes()).toContain('active');
    await vi.advanceTimersByTimeAsync(400);
    expect(w.get(sel('maze-block-2')).classes()).toContain('failed');
    expect(w.find('.active').exists()).toBe(false);
    expect(lastText()).toEqual([phrases.mazeWall]);
    expect(kinds(w)).toHaveLength(3);

    await w.get(sel('maze-reset')).trigger('click');
    expect(bitAt(w)).toEqual([0, 0, 1]);
    expect(w.find('.failed').exists()).toBe(false);

    // Hết lệnh mà chưa tới nhà.
    await w.get(sel('maze-remove-2')).trigger('click');
    await runToEnd(w);
    expect(lastText()).toEqual([phrases.mazeNotHome]);

    // Về chỗ cũ giữa lúc chạy thì dừng hoạt ảnh.
    await w.get(sel('maze-run')).trigger('click');
    await vi.advanceTimersByTimeAsync(400);
    await w.get(sel('maze-reset')).trigger('click');
    expect(bitAt(w)).toEqual([0, 0, 1]);
    await vi.advanceTimersByTimeAsync(2000);
    expect(bitAt(w)).toEqual([0, 0, 1]);
    expect(w.get(sel('maze-run')).attributes('disabled')).toBeUndefined();
  });

  it('tới nhà: khen, hiện kết quả, phát finish; chơi lại thì đọc đề lại', async () => {
    settings.ageGroup = 'mam';
    const w = mountView();
    for (const k of ['forward', 'forward', 'right', 'forward', 'forward']) {
      await w.get(sel(`maze-palette-${k}`)).trigger('click');
    }
    await w.get(sel('maze-run')).trigger('click');
    await vi.advanceTimersByTimeAsync(400);
    expect(bitAt(w)).toEqual([0, 0, 1]);
    await vi.advanceTimersByTimeAsync(200);
    expect(bitAt(w)).toEqual([1, 0, 1]);
    await vi.runAllTimersAsync();
    await flushPromises();
    expect(lastText()).toEqual([phrases.mazeHome]);
    expect(w.find(sel('result')).exists()).toBe(true);
    expect(w.get(sel('result')).text()).toContain('Bit về nhà sau 1 lần chạy, dùng 5 khối.');
    expect(w.get(sel('result')).find('[aria-label="3 trên 3 sao"]').exists()).toBe(true);
    const result = w.emitted('finish')![0]![0] as LevelResult;
    expect(result).toEqual({
      levelId: levelOf('it-m-01').id,
      game: 'maze',
      stars: 3,
      firstTry: ['it-m-01'],
      wrong: [],
      usedHint: false,
    });

    said().length = 0;
    await w.get(`${sel('result')} .primary`).trigger('click');
    await flushPromises();
    expect(w.find(sel('result')).exists()).toBe(false);
    expect(kinds(w)).toEqual([]);
    expect(bitAt(w)).toEqual([0, 0, 1]);
    expect(said()[0]![0]!.text).toBe(phrases.mazeIntro);
    await w.get('.back').trigger('click');
    expect(w.emitted('exit')).toHaveLength(1);
  });

  it('khối lặp: kéo khối vào thân, đổi số lần, đổi thứ tự; chạy sai rồi đúng thì 2 sao và có trong wrong', async () => {
    const w = mountView(islandContent('it', 'maze'));
    // Lối vào cả đảo dùng mê cung đầu tiên (không có khối lặp); dùng màn có khối lặp.
    expect(w.find(sel('maze-palette-repeat')).exists()).toBe(false);
    w.unmount();

    const v = mountView({ ...levelOf('it-m-02'), id: 'it-maze-all' });
    await v.get(sel('maze-palette-repeat')).trigger('click');
    expect(v.get(sel('maze-times-0-minus')).attributes('disabled')).toBeDefined();
    await drag(v, sel('maze-palette-forward'), '[data-drop="into-0"]');
    expect(kinds(v)).toEqual(['repeat', 'forward']);
    expect(v.find(sel('maze-block-0-0')).exists()).toBe(true);
    expect(lastText()).toEqual([phrases.blockForward]);
    for (let i = 0; i < 9; i++) await v.get(sel('maze-times-0-plus')).trigger('click');
    expect(v.get(`${sel('maze-block-0')} .times`).text()).toBe('9 lần');
    expect(v.get(sel('maze-times-0-plus')).attributes('disabled')).toBeDefined();
    for (let i = 0; i < 5; i++) await v.get(sel('maze-times-0-minus')).trigger('click');
    expect(v.get(`${sel('maze-block-0')} .times`).text()).toBe('4 lần');

    // Không cho lặp trong lặp (nhóm Chồi): thả vào thân không có tác dụng, Tomo giải thích.
    await drag(v, sel('maze-palette-repeat'), '[data-drop="into-0"]');
    expect(kinds(v)).toEqual(['repeat', 'forward']);
    expect(audio.mock!.said.at(-1)).toEqual([viSegment(phrases.mazeNoNested)]);

    // Thả trước một khối, kéo khối trong chương trình để đổi thứ tự / chuyển vào thân lặp.
    await drag(v, sel('maze-palette-right'), '[data-drop="before-0"]');
    expect(kinds(v)).toEqual(['right', 'repeat', 'forward']);
    await drag(v, `${sel('maze-block-0')} .grip`, '[data-drop="program"]');
    expect(kinds(v)).toEqual(['repeat', 'forward', 'right']);
    expect(lastText()).toEqual([phrases.blockRight]);
    await drag(v, `${sel('maze-block-1')} .grip`, '[data-drop="into-0"]');
    expect(kinds(v)).toEqual(['repeat', 'forward', 'right']);
    expect(v.find(sel('maze-block-0-1')).exists()).toBe(true);
    // Kéo khối lặp vào chính nó: không làm gì.
    await drag(v, `${sel('maze-block-0')} .grip`, '[data-drop="into-0"]');
    expect(kinds(v)).toEqual(['repeat', 'forward', 'right']);

    await runToEnd(v);
    expect(lastText()).toEqual([phrases.mazeWall]);
    expect(v.get(sel('maze-block-0-0')).classes()).toContain('failed');

    // Sửa: bỏ rẽ phải trong thân, thêm rẽ phải và lặp 4 lần đi tới.
    await v.get(sel('maze-remove-0-1')).trigger('click');
    await v.get(sel('maze-palette-right')).trigger('click');
    await v.get(sel('maze-palette-repeat')).trigger('click');
    await drag(v, sel('maze-palette-forward'), '[data-drop="into-2"]');
    for (let i = 0; i < 2; i++) await v.get(sel('maze-times-2-plus')).trigger('click');
    await runToEnd(v);
    const result = v.emitted('finish')![0]![0] as LevelResult;
    expect(result).toEqual({ game: 'maze', stars: 2, firstTry: [], wrong: ['it-m-02'], usedHint: false });
    await v.get(`${sel('result')} button:not(.primary)`).trigger('click');
    expect(v.emitted('exit')).toHaveLength(1);
  });

  it('Đèn Pin tô khối tiếp theo hoặc khối sai; hết Đèn Pin thì báo; dùng rồi thì tối đa 2 sao', async () => {
    const w = mountView();
    await w.get(sel('maze-hint')).trigger('click');
    expect(hints.value).toBe(START_HINTS - 1);
    // Không chỉ tô màu: Tomo đọc và vùng aria-live báo khối tiếp theo.
    expect(lastText()).toEqual([phrases.hint, phrases.mazeHintNext, phrases.blockForward]);
    expect(w.get(sel('maze-status')).text()).toBe('Gợi ý: khối tiếp theo là đi tới, thêm vào cuối chương trình.');
    expect(w.get(sel('maze-palette-forward')).classes()).toContain('hinted');
    expect(w.get(sel('maze-program')).classes()).toContain('hinted');

    await w.get(sel('maze-palette-left')).trigger('click');
    expect(w.find('.hinted').exists()).toBe(false);
    await w.get(sel('maze-hint')).trigger('click');
    expect(w.get(sel('maze-block-0')).classes()).toContain('hinted');
    expect(w.get(sel('maze-palette-forward')).classes()).toContain('hinted');
    expect(lastText()).toEqual([phrases.hint, phrases.mazeHintChange, phrases.blockForward]);
    expect(w.get(sel('maze-status')).text()).toBe('Gợi ý: đổi khối ở vị trí 1 thành đi tới.');

    hints.value = 0;
    await w.get(sel('maze-remove-0')).trigger('click');
    // Hết Đèn Pin: nút dùng chung hiện 0 và mờ đi; bấm thì Tomo báo, không tô gì, vùng báo giữ nguyên.
    expect(w.get(sel('maze-hint')).attributes('aria-disabled')).toBe('true');
    expect(w.get(sel('maze-hint')).text()).toContain('0');
    expect(w.find('.hinted').exists()).toBe(false);
    await w.get(sel('maze-hint')).trigger('click');
    expect(lastText()).toEqual([phrases.noHints]);
    expect(w.find('.hinted').exists()).toBe(false);

    hints.value = 1;
    for (const k of ['forward', 'forward', 'right', 'forward', 'forward', 'left']) {
      await w.get(sel(`maze-palette-${k}`)).trigger('click');
    }
    // Khối thừa ở cuối: Đèn Pin tô khối đó, không tô khay.
    await w.get(sel('maze-hint')).trigger('click');
    expect(w.get(sel('maze-block-5')).classes()).toContain('hinted');
    expect(w.find('.palette .hinted').exists()).toBe(false);
    expect(lastText()).toEqual([phrases.hint, phrases.mazeHintRemove]);
    expect(w.get(sel('maze-status')).text()).toBe('Gợi ý: bỏ khối rẽ trái ở vị trí 6.');
    await w.get(sel('maze-remove-5')).trigger('click');
    // Chương trình đã khớp lời giải: nút Đèn Pin tắt.
    expect(w.get(sel('maze-hint')).attributes('disabled')).toBeDefined();
    await runToEnd(w);
    expect((w.emitted('finish')![0]![0] as LevelResult).stars).toBe(2);
    expect((w.emitted('finish')![0]![0] as LevelResult).usedHint).toBe(true);
  });

  it('Về chỗ cũ giữa lần chạy tới nhà: không chốt thắng; chạy lại hết thì không còn là lần đầu (không 3 sao)', async () => {
    const w = mountView();
    for (const k of ['forward', 'forward', 'right', 'forward', 'forward']) {
      await w.get(sel(`maze-palette-${k}`)).trigger('click');
    }
    await w.get(sel('maze-run')).trigger('click');
    await vi.advanceTimersByTimeAsync(800);
    await w.get(sel('maze-reset')).trigger('click');
    expect(bitAt(w)).toEqual([0, 0, 1]);
    expect(w.emitted('finish')).toBeUndefined();
    // Dừng giữa chừng thì vẫn sửa được chương trình; lần chạy bị dừng vẫn tính là một lần chạy.
    expect(w.get(sel('maze-palette-forward')).attributes('disabled')).toBeUndefined();
    // Về chỗ cũ khi không chạy thì không tính thêm.
    await w.get(sel('maze-reset')).trigger('click');

    await runToEnd(w);
    const result = w.emitted('finish')![0]![0] as LevelResult;
    // Đúng số khối tối ưu nhưng là lần chạy thứ hai: 2 sao; lần dừng sẽ tới nhà nên không tính là sai.
    expect(result.stars).toBe(2);
    expect(result.firstTry).toEqual(['it-m-01']);
    expect(w.get(sel('result')).text()).toContain('Bit về nhà sau 2 lần chạy, dùng 5 khối.');
  });

  it('dừng lần chạy sai trước khi đụng tường rồi sửa: vẫn tính lần chạy và lần sai', async () => {
    const w = mountView();
    for (const k of ['forward', 'forward', 'forward']) await w.get(sel(`maze-palette-${k}`)).trigger('click');
    await w.get(sel('maze-run')).trigger('click');
    await vi.advanceTimersByTimeAsync(400);
    await w.get(sel('maze-reset')).trigger('click');
    await w.get(sel('maze-remove-2')).trigger('click');
    for (const k of ['right', 'forward', 'forward']) await w.get(sel(`maze-palette-${k}`)).trigger('click');
    await runToEnd(w);
    const result = w.emitted('finish')![0]![0] as LevelResult;
    expect(result).toMatchObject({ stars: 2, firstTry: [], wrong: ['it-m-01'] });
    expect(w.get(sel('result')).text()).toContain('Bit về nhà sau 2 lần chạy, dùng 5 khối.');
  });

  it('Đèn Pin trong mê cung có khối lặp: báo số lần và chỗ trong thân khối lặp', async () => {
    hints.value = 9;
    const w = mountView(levelOf('it-m-02'));
    const hintStatus = async () => {
      await w.get(sel('maze-hint')).trigger('click');
      return w.get(sel('maze-status')).text();
    };
    expect(await hintStatus()).toBe('Gợi ý: khối tiếp theo là lặp lại 4 lần, thêm vào cuối chương trình.');
    expect(lastText()).toEqual([phrases.hint, phrases.mazeHintNext, phrases.blockRepeat]);
    await w.get(sel('maze-palette-repeat')).trigger('click');
    expect(await hintStatus()).toBe('Gợi ý: đổi khối ở vị trí 1 thành lặp lại 4 lần.');
    for (let i = 0; i < 2; i++) await w.get(sel('maze-times-0-plus')).trigger('click');
    expect(await hintStatus()).toBe('Gợi ý: khối tiếp theo là đi tới, thêm vào trong khối lặp lại.');
    await drag(w, sel('maze-palette-left'), '[data-drop="into-0"]');
    expect(await hintStatus()).toBe('Gợi ý: đổi khối ở vị trí 1 trong khối lặp lại thành đi tới.');
  });

  it('bàn phím: chọn khối lặp làm chỗ thêm, khay thêm vào thân; ▲ ▼ đổi chỗ trong cùng danh sách', async () => {
    const w = mountView(levelOf('it-m-02'));
    document.body.appendChild(w.element);
    await w.get(sel('maze-palette-repeat')).trigger('click');
    await w.get(sel('maze-palette-right')).trigger('click');
    expect(w.find(sel('maze-target-program')).exists()).toBe(false);
    const into = () => w.get(sel('maze-into-0'));
    expect(into().attributes('aria-pressed')).toBe('false');
    expect(into().attributes('aria-label')).toBe('Thêm khối mới vào trong khối lặp lại này');

    // Chọn khối lặp: phím và chạm ở khay đều thêm vào thân khối lặp.
    await into().trigger('click');
    expect(into().attributes('aria-pressed')).toBe('true');
    expect(lastText()).toEqual([phrases.mazeTargetRepeat]);
    expect(w.get(sel('maze-status')).text()).toBe(phrases.mazeTargetRepeat);
    expect(w.get(sel('maze-status')).attributes('aria-live')).toBe('polite');
    expect(w.get('[data-drop="into-0"]').classes()).toContain('target');
    expect(w.get('[data-drop="into-0"]').text()).toContain('Chạm khối lệnh để thêm vào đây');
    await w.get(sel('maze-palette-forward')).trigger('click');
    await tap(w, sel('maze-palette-left'));
    expect(kinds(w)).toEqual(['repeat', 'forward', 'left', 'right']);
    expect(w.find(sel('maze-block-0-1')).exists()).toBe(true);
    // Lặp trong lặp vẫn bị cấm (nhóm Chồi).
    await w.get(sel('maze-palette-repeat')).trigger('click');
    expect(lastText()).toEqual([phrases.mazeNoNested]);
    expect(kinds(w)).toEqual(['repeat', 'forward', 'left', 'right']);

    // ▲ ▼ đổi chỗ trong thân lặp, tiêu điểm đi theo khối; đầu / cuối danh sách thì nút tắt.
    expect(w.get(sel('maze-up-0-0')).attributes('disabled')).toBeDefined();
    expect(w.get(sel('maze-down-0-1')).attributes('disabled')).toBeDefined();
    expect(w.get(sel('maze-down-0-0')).attributes('aria-label')).toBe('Đưa khối đi tới xuống');
    await w.get(sel('maze-up-0-1')).trigger('click');
    await flushPromises();
    expect(w.get(`${sel('maze-block-0-0')} .grip`).text()).toContain(phrases.blockLeft);
    expect(lastText()).toEqual([phrases.blockLeft]);
    expect(w.get(sel('maze-status')).text()).toBe('Khối rẽ trái ở vị trí 1');
    expect(document.activeElement).toBe(w.get(sel('maze-down-0-0')).element);

    // Đổi chỗ ở chương trình gốc: chỗ thêm vẫn theo đúng khối lặp dù khối lặp đổi vị trí.
    await w.get(sel('maze-down-0')).trigger('click');
    await flushPromises();
    expect(kinds(w)).toEqual(['right', 'repeat', 'left', 'forward']);
    expect(document.activeElement).toBe(w.get(sel('maze-up-1')).element);
    expect(w.get(sel('maze-into-1')).attributes('aria-pressed')).toBe('true');
    await w.get(sel('maze-palette-right')).trigger('click');
    expect(w.find(sel('maze-block-1-2')).exists()).toBe(true);
    // Còn chỗ để đi tiếp thì tiêu điểm ở lại nút cùng chiều.
    await w.get(sel('maze-palette-left')).trigger('click');
    await w.get(sel('maze-target-program')).trigger('click');
    await flushPromises();
    expect(lastText()).toEqual([phrases.mazeTargetProgram]);
    // Nút vừa bấm tự ẩn: tiêu điểm về nút Vào trong của khối lặp vừa bỏ chọn, không rơi về body.
    expect(w.find(sel('maze-target-program')).exists()).toBe(false);
    expect(document.activeElement).toBe(w.get(sel('maze-into-1')).element);
    await w.get(sel('maze-palette-forward')).trigger('click');
    expect(kinds(w)).toEqual(['right', 'repeat', 'left', 'forward', 'right', 'left', 'forward']);
    await w.get(sel('maze-down-0')).trigger('click');
    await flushPromises();
    expect(document.activeElement).toBe(w.get(sel('maze-down-1')).element);

    // Về cuối chương trình bằng nút riêng đã tắt chọn; chọn lại chính khối lặp cũng bật / tắt.
    expect(w.find(sel('maze-target-program')).exists()).toBe(false);
    expect(w.get(sel('maze-into-0')).attributes('aria-pressed')).toBe('false');
    await w.get(sel('maze-into-0')).trigger('click');
    await w.get(sel('maze-into-0')).trigger('click');
    expect(w.get(sel('maze-status')).text()).toBe(phrases.mazeTargetProgram);
    await w.get(sel('maze-into-0')).trigger('click');
    // Bỏ khối lặp đang chọn thì chỗ thêm về cuối chương trình.
    await w.get(sel('maze-remove-0')).trigger('click');
    expect(w.find(sel('maze-target-program')).exists()).toBe(false);
    expect(kinds(w)).toEqual(['right', 'forward']);
    w.unmount();
  });

  it('đang chạy thì không chọn chỗ thêm, không đổi chỗ được; chơi lại thì chỗ thêm về chương trình', async () => {
    settings.ageGroup = 'mam';
    const w = mountView(levelOf('it-m-02'));
    await w.get(sel('maze-palette-forward')).trigger('click');
    await w.get(sel('maze-palette-repeat')).trigger('click');
    await w.get(sel('maze-into-1')).trigger('click');
    await w.get(sel('maze-run')).trigger('click');
    expect(w.get(sel('maze-up-1')).attributes('disabled')).toBeDefined();
    expect(w.get(sel('maze-into-1')).attributes('disabled')).toBeDefined();
    expect(w.get(sel('maze-target-program')).attributes('disabled')).toBeDefined();
    // Bỏ qua thuộc tính disabled (gọi thẳng hàm): vẫn không đổi gì.
    const ctx = w.findComponent({ name: 'MazeProgram' }).props('ctx') as ProgramContext;
    await ctx.nudge([1], -1);
    ctx.aim([1]);
    expect(kinds(w)).toEqual(['forward', 'repeat']);
    expect(ctx.target).toBe('1');
    await vi.runAllTimersAsync();
    await flushPromises();
    // Không phải khối lặp, hoặc không đổi chỗ được: không làm gì.
    ctx.aim([0]);
    await ctx.nudge([0], -1);
    expect(ctx.target).toBe('1');
    expect(kinds(w)).toEqual(['forward', 'repeat']);

    // Thắng hoàn toàn bằng bàn phím, rồi chơi lại: chỗ thêm về chương trình, vùng báo trống.
    const v = mountView(levelOf('it-m-02'));
    const click = (id: string) => v.get(sel(id)).trigger('click');
    await click('maze-palette-repeat');
    await click('maze-into-0');
    await click('maze-palette-forward');
    await click('maze-times-0-plus');
    await click('maze-times-0-plus');
    await click('maze-target-program');
    await click('maze-palette-right');
    await click('maze-palette-repeat');
    await click('maze-into-2');
    await click('maze-palette-forward');
    await click('maze-times-2-plus');
    await click('maze-times-2-plus');
    await runToEnd(v);
    expect((v.emitted('finish')![0]![0] as LevelResult).stars).toBe(3);
    await v.get(`${sel('result')} .primary`).trigger('click');
    await flushPromises();
    expect(v.get(sel('maze-status')).text()).toBe('');
    await click('maze-palette-repeat');
    await click('maze-palette-forward');
    expect(kinds(v)).toEqual(['repeat', 'forward']);
    expect(v.find(sel('maze-block-1')).exists()).toBe(true);
  });

  it('màn không có mê cung thì báo nhẹ nhàng; gỡ màn thì dừng đọc và huỷ hoạt ảnh', async () => {
    const empty = mountView({ id: 'x', game: 'maze' });
    expect(empty.find(sel('maze-empty')).exists()).toBe(true);
    expect(said()).toHaveLength(0);
    empty.unmount();
    expect(audio.mock!.speaker.stop).toHaveBeenCalled();

    const w = mountView();
    await w.get(sel('maze-palette-forward')).trigger('click');
    await w.get(sel('maze-run')).trigger('click');
    w.unmount();
    said().length = 0;
    await vi.runAllTimersAsync();
    expect(said()).toHaveLength(0);
  });
});
