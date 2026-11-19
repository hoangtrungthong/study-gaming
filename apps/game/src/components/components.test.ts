import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref } from 'vue';
import { nextStepKey } from './nextStep';
import { decks } from '@study/content';
import { settings, defaultSettings } from '../settings';

const audio = vi.hoisted(() => ({
  mock: null as null | ReturnType<typeof import('../test/audioMock').createAudioMock>,
}));
vi.mock('../audio', async () => {
  const { createAudioMock } = await import('../test/audioMock');
  audio.mock = createAudioMock();
  return audio.mock;
});

const { default: KnowledgeCard } = await import('./KnowledgeCard.vue');
const { default: ResultPanel } = await import('./ResultPanel.vue');
const { default: HintButton } = await import('./HintButton.vue');
const { hints, START_HINTS } = await import('../games/hints');

const mizu = decks.ja.items.find((i) => i.id === 'ja-mizu')!;
const apple = decks.en.items.find((i) => i.id === 'en-apple')!;

beforeEach(() => {
  Object.assign(settings, defaultSettings());
  audio.mock!.said.length = 0;
  audio.mock!.speaker.say.mockClear();
  audio.mock!.speaker.stop.mockClear();
  hints.value = START_HINTS;
});

describe('KnowledgeCard', () => {
  it('hiện từ, cách đọc, romaji, Hán Việt, ví dụ song ngữ và tự đọc to', () => {
    const w = mount(KnowledgeCard, { props: { deck: decks.ja, item: mizu } });
    const text = w.text();
    for (const part of ['水', 'みず', 'mizu', 'nước', 'Hán Việt: THỦY', '水を のみます。', 'Tôi uống nước.']) {
      expect(text).toContain(part);
    }
    expect(audio.mock!.said[0]![0]).toEqual({ lang: 'ja', text: 'みず' });
  });

  it('tô sáng đoạn đang đọc; đọc xong thì bỏ tô', async () => {
    let report: ((i: number) => void) | undefined;
    audio.mock!.speaker.say.mockImplementationOnce(async (_s, cb) => void (report = cb));
    const w = mount(KnowledgeCard, { props: { deck: decks.ja, item: mizu } });
    report!(0);
    await w.vm.$nextTick();
    expect(w.find('.term').classes()).toContain('lit');
    report!(2);
    await w.vm.$nextTick();
    expect(w.find('.hanviet').classes()).toContain('lit');
    report!(-1);
    await w.vm.$nextTick();
    expect(w.findAll('.lit')).toHaveLength(0);
  });

  it('tắt tự đọc thì chỉ đọc khi bấm Nghe lại; tắt tiếng Việt thì ẩn dòng tiếng Việt', async () => {
    settings.autoRead = false;
    settings.showVietnamese = false;
    const w = mount(KnowledgeCard, { props: { deck: decks.en, item: apple } });
    expect(audio.mock!.speaker.say).not.toHaveBeenCalled();
    expect(w.text()).not.toContain('quả táo');
    expect(w.text()).not.toContain('Trước apple');
    await w.get('button[aria-label="Nghe lại"]').trigger('click');
    expect(audio.mock!.speaker.say).toHaveBeenCalledTimes(1);
    w.unmount();
    expect(audio.mock!.speaker.stop).toHaveBeenCalled();
  });

  it('báo hiệu của lượt đọc cũ (bị huỷ) không xoá tô sáng của lượt mới', async () => {
    const callbacks: ((i: number) => void)[] = [];
    audio.mock!.speaker.say.mockImplementation(async (_s, cb) => void callbacks.push(cb!));
    const w = mount(KnowledgeCard, { props: { deck: decks.ja, item: mizu } });
    await w.get('button[aria-label="Nghe lại"]').trigger('click');
    callbacks[1]!(0);
    callbacks[0]!(-1); // lượt đầu bị huỷ, báo xong muộn
    await w.vm.$nextTick();
    expect(w.find('.term').classes()).toContain('lit');
    audio.mock!.speaker.say.mockReset();
    audio.mock!.speaker.say.mockImplementation(async (segments, onSegment) => {
      audio.mock!.said.push(segments);
      segments.forEach((_, i) => onSegment?.(i));
    });
  });

  it('đổi sang từ khác thì đọc từ mới', async () => {
    const w = mount(KnowledgeCard, { props: { deck: decks.en, item: apple } });
    await w.setProps({ item: decks.en.items[1]! });
    expect(audio.mock!.said.at(-1)![0]).toEqual({ lang: 'en', text: decks.en.items[1]!.term });
    settings.autoRead = false;
    await w.setProps({ item: apple });
    expect(audio.mock!.said).toHaveLength(2);
  });
});

describe('ResultPanel', () => {
  it('hiện số sao, lời nhắn, nhận focus và phát sự kiện', async () => {
    const w = mount(ResultPanel, {
      props: { stars: 2, message: 'Giỏi' },
      slots: { default: '<p>thêm</p>' },
      attachTo: document.body,
    });
    expect(document.activeElement).toBe(w.get('[data-testid="result"]').element);
    expect(w.findAll('.on')).toHaveLength(2);
    expect(w.text()).toContain('Giỏi');
    expect(w.text()).toContain('thêm');
    await w.findAll('button')[0]!.trigger('click');
    await w.findAll('button')[1]!.trigger('click');
    expect(w.emitted('again')).toHaveLength(1);
    expect(w.emitted('exit')).toHaveLength(1);
    expect(w.find('[data-testid="result-next"]').exists()).toBe(false);
    expect(w.findAll('button')[0]!.classes()).toContain('primary');
  });

  it('có bước tiếp thì nút đó là nút chính, "Chơi lại" thành nút phụ', async () => {
    const go = vi.fn();
    const w = mount(ResultPanel, {
      props: { stars: 3, message: 'Giỏi' },
      global: { provide: { [nextStepKey as symbol]: ref({ label: 'Tiếp: Viết Lại Từ', go }) } },
    });
    const next = w.get('[data-testid="result-next"]');
    expect(next.text()).toBe('Tiếp: Viết Lại Từ');
    expect(next.classes()).toContain('primary');
    expect(w.findAll('button')[1]!.classes()).not.toContain('primary');
    await next.trigger('click');
    expect(go).toHaveBeenCalledOnce();
  });
});

describe('HintButton', () => {
  it('hiện số Đèn Pin còn lại và phát use khi bấm', async () => {
    const w = mount(HintButton);
    const btn = w.get('button');
    expect(btn.text()).toContain(String(START_HINTS));
    expect(btn.attributes('aria-label')).toBe(`Đèn Pin, còn ${START_HINTS}`);
    expect(btn.attributes('aria-disabled')).toBeUndefined();
    expect(btn.attributes('disabled')).toBeUndefined();
    await btn.trigger('click');
    expect(w.emitted('use')).toHaveLength(1);
  });

  it('hết Đèn Pin thì chỉ mờ (aria-disabled), vẫn focus được và vẫn phát use', async () => {
    hints.value = 0;
    const w = mount(HintButton, { attachTo: document.body });
    const btn = w.get('button');
    expect(btn.attributes('aria-disabled')).toBe('true');
    expect(btn.attributes('disabled')).toBeUndefined();
    expect(btn.attributes('aria-label')).toBe('Đèn Pin, còn 0');
    (btn.element as HTMLButtonElement).focus();
    expect(document.activeElement).toBe(btn.element);
    await btn.trigger('click');
    expect(w.emitted('use')).toHaveLength(1);
    w.unmount();
  });

  it('prop disabled thì tắt hẳn nút', () => {
    const w = mount(HintButton, { props: { disabled: true } });
    expect(w.get('button').attributes('disabled')).toBeDefined();
  });
});
