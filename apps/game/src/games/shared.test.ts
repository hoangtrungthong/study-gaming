import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { decks, phrases } from '@study/content';

const audio = vi.hoisted(() => ({
  mock: null as null | ReturnType<typeof import('../test/audioMock').createAudioMock>,
}));
vi.mock('../audio', async () => {
  const { createAudioMock } = await import('../test/audioMock');
  audio.mock = createAudioMock();
  return audio.mock;
});

const { starsByMistakes } = await import('./result');
const { hints, useHint, START_HINTS } = await import('./hints');
const { useDrag } = await import('./drag');
const { games, gameInfo, gamesFor } = await import('./registry');
const { default: VirtualKeyboard } = await import('../components/VirtualKeyboard.vue');
const { default: IslandView } = await import('../views/IslandView.vue');
const ageConfig = await import('./ageConfig');
const { seededRng } = await import('./random');

describe('starsByMistakes', () => {
  it('3 sao khi không sai; 2 khi sai ≤ 2 hoặc ≤ 20%; còn lại 1', () => {
    expect(starsByMistakes(0, 5)).toBe(3);
    expect(starsByMistakes(2, 5)).toBe(2);
    expect(starsByMistakes(3, 20)).toBe(2);
    expect(starsByMistakes(3, 5)).toBe(1);
  });
  it('dùng gợi ý thì tối đa 2 sao', () => {
    expect(starsByMistakes(0, 5, true)).toBe(2);
    expect(starsByMistakes(4, 5, true)).toBe(1);
  });
});

describe('Đèn Pin', () => {
  beforeEach(() => {
    hints.value = START_HINTS;
    audio.mock!.said.length = 0;
  });

  it('bắt đầu 3; dùng thì trừ và Tomo báo; hết thì báo hết và không trừ', () => {
    expect(hints.value).toBe(3);
    expect(useHint()).toBe(true);
    expect(hints.value).toBe(2);
    expect(audio.mock!.said.at(-1)).toEqual([{ lang: 'vi', text: phrases.hint }]);
    hints.value = 0;
    expect(useHint()).toBe(false);
    expect(hints.value).toBe(0);
    expect(audio.mock!.said.at(-1)).toEqual([{ lang: 'vi', text: phrases.noHints }]);
  });
});

describe('cấu hình nhóm tuổi của các trò mới', () => {
  it('đủ ba nhóm cho mọi trò; Mầm dễ hơn Cây', () => {
    const configs = [
      ageConfig.STAR_CONFIG,
      ageConfig.SENTENCE_CONFIG,
      ageConfig.LISTEN_CONFIG,
      ageConfig.MEMORY_CONFIG,
      ageConfig.WRITE_CONFIG,
      ageConfig.KANA_CONFIG,
      ageConfig.MAZE_CONFIG,
    ];
    for (const c of configs) expect(Object.keys(c).sort()).toEqual(['cay', 'choi', 'mam']);
    expect(ageConfig.STAR_CONFIG.mam.speed).toBeLessThan(ageConfig.STAR_CONFIG.cay.speed);
    expect(ageConfig.LISTEN_CONFIG.mam.mode).toBe('picture');
    expect(ageConfig.MEMORY_CONFIG.mam.flipBackMs).toBeGreaterThan(ageConfig.MEMORY_CONFIG.cay.flipBackMs);
    expect(ageConfig.WRITE_CONFIG.mam.virtualKeyboard).toBe(true);
    expect(ageConfig.KANA_CONFIG.mam.tolerance).toBeGreaterThan(ageConfig.KANA_CONFIG.cay.tolerance);
    expect(ageConfig.MAZE_CONFIG.cay.nestedRepeat).toBe(true);
  });
});

describe('useDrag', () => {
  let onDrop: ReturnType<typeof vi.fn<(payload: string, target: string) => void>>;
  let onTap: ReturnType<typeof vi.fn<(payload: string) => void>>;
  let drag: ReturnType<typeof useDrag<string>>;
  const pointer = (type: string, x: number, y: number) =>
    Object.assign(new MouseEvent(type, { clientX: x, clientY: y, bubbles: true }), {
      pointerId: 1,
    }) as unknown as PointerEvent;

  beforeEach(() => {
    onDrop = vi.fn();
    onTap = vi.fn();
    drag = useDrag<string>({ onDrop, onTap });
    document.body.innerHTML = '<div data-drop="slot-2"><span id="inner"></span></div><div id="plain"></div>';
  });
  afterEach(() => {
    document.body.innerHTML = '';
    // jsdom không có elementFromPoint: test tự gắn
    delete (document as { elementFromPoint?: unknown }).elementFromPoint;
  });

  const startOn = (el: HTMLElement) => {
    el.setPointerCapture = vi.fn();
    const down = pointer('pointerdown', 10, 10);
    Object.defineProperty(down, 'currentTarget', { value: el });
    drag.start(down, 'khối-1');
    return el;
  };

  it('kéo rồi thả lên chỗ có data-drop thì gọi onDrop; trong lúc kéo có toạ độ', () => {
    const el = startOn(document.getElementById('plain')!);
    expect(el.setPointerCapture).toHaveBeenCalledWith(1);
    window.dispatchEvent(pointer('pointermove', 12, 11)); // dưới ngưỡng: chưa tính là kéo
    expect(drag.dragging.value).toBeNull();
    window.dispatchEvent(pointer('pointermove', 60, 80));
    expect(drag.dragging.value).toEqual({ payload: 'khối-1', x: 60, y: 80 });
    document.elementFromPoint = () => document.getElementById('inner');
    window.dispatchEvent(pointer('pointerup', 60, 80));
    expect(onDrop).toHaveBeenCalledWith('khối-1', 'slot-2');
    expect(drag.dragging.value).toBeNull();
    expect(onTap).not.toHaveBeenCalled();
  });

  it('thả ra ngoài chỗ nhận thì không gọi gì', () => {
    startOn(document.getElementById('plain')!);
    window.dispatchEvent(pointer('pointermove', 90, 90));
    document.elementFromPoint = () => document.getElementById('plain');
    window.dispatchEvent(pointer('pointerup', 90, 90));
    expect(onDrop).not.toHaveBeenCalled();
  });

  it('bấm rồi nhả không kéo là chạm; huỷ kéo thì bỏ trạng thái', () => {
    startOn(document.getElementById('plain')!);
    window.dispatchEvent(pointer('pointerup', 10, 10));
    expect(onTap).toHaveBeenCalledWith('khối-1');
    startOn(document.getElementById('plain')!);
    window.dispatchEvent(pointer('pointermove', 50, 50));
    window.dispatchEvent(pointer('pointercancel', 50, 50));
    expect(drag.dragging.value).toBeNull();
    window.dispatchEvent(pointer('pointerup', 50, 50));
    expect(onDrop).not.toHaveBeenCalled();
  });

  it('không có onTap thì chạm không làm gì; phần tử không có setPointerCapture vẫn chạy', () => {
    const d = useDrag<string>({ onDrop });
    const down = pointer('pointerdown', 0, 0);
    Object.defineProperty(down, 'currentTarget', { value: null });
    d.start(down, 'x');
    window.dispatchEvent(pointer('pointerup', 0, 0));
    expect(onDrop).not.toHaveBeenCalled();
  });
});

describe('VirtualKeyboard', () => {
  it('mỗi chữ khác nhau một phím, bỏ khoảng trắng; bấm phát press / backspace', async () => {
    const w = mount(VirtualKeyboard, { props: { answer: 'apple pie', rng: seededRng(1) } });
    const keys = w.findAll('[data-testid^="vkey-"]').map((b) => b.attributes('data-testid')!.slice(5));
    expect(keys.filter((k) => k !== 'back').sort()).toEqual(['a', 'e', 'i', 'l', 'p']);
    await w.get('[data-testid="vkey-p"]').trigger('click');
    await w.get('[data-testid="vkey-back"]').trigger('click');
    expect(w.emitted('press')).toEqual([['p']]);
    expect(w.emitted('backspace')).toHaveLength(1);
  });
});

describe('registry và lối vào tạm', () => {
  it('mỗi trò có tên, biểu tượng, màn; tra theo loại', () => {
    expect(games).toHaveLength(9);
    for (const g of games) expect(g.nameVi && g.icon && g.view).toBeTruthy();
    expect(gameInfo('maze').nameVi).toBe('Đưa Bit Về Nhà');
  });

  it('mọi trò nạp lazy được (mỗi trò một chunk)', async () => {
    for (const g of games) {
      const loader = (g.view as { __asyncLoader: () => Promise<unknown> }).__asyncLoader;
      await expect(loader()).resolves.toBeTruthy();
    }
  });

  it('trò theo đảo: Vẽ Kana chỉ đảo Nhật, Đưa Bit chỉ đảo IT, Xếp Câu không có ở IT', () => {
    const kinds = (s: 'en' | 'ja' | 'it') => gamesFor(s).map((g) => g.kind);
    expect(kinds('ja')).toContain('kana');
    expect(kinds('en')).not.toContain('kana');
    expect(kinds('it')).toContain('maze');
    expect(kinds('it')).not.toContain('sentence');
    expect(kinds('en')).toContain('sentence');
  });

  it('IslandView liệt kê trò của đảo và phát play theo loại', async () => {
    const w = mount(IslandView, { props: { deck: decks.it } });
    expect(w.find('[data-testid="play-maze"]').exists()).toBe(true);
    expect(w.find('[data-testid="play-kana"]').exists()).toBe(false);
    await w.get('[data-testid="play-memory"]').trigger('click');
    expect(w.emitted('play')).toEqual([['memory']]);
  });
});
