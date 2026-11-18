import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { decks, phrases } from '@study/content';
import { defaultSettings, settings } from '../settings';

const audio = vi.hoisted(() => ({
  mock: null as null | ReturnType<typeof import('../test/audioMock').createAudioMock>,
}));
vi.mock('../audio', async () => {
  const { createAudioMock } = await import('../test/audioMock');
  audio.mock = createAudioMock();
  return audio.mock;
});

const { default: HomeView } = await import('./HomeView.vue');
const { default: IslandView } = await import('./IslandView.vue');
const { default: SettingsView } = await import('./SettingsView.vue');

beforeEach(() => {
  Object.assign(settings, defaultSettings());
  audio.mock!.said.length = 0;
  audio.mock!.manifest.value = { voices: [], clips: {} };
});

describe('HomeView', () => {
  it('liệt kê 3 đảo, mở đảo, mở cài đặt, Tomo chào', async () => {
    const w = mount(HomeView);
    expect(w.findAll('.island')).toHaveLength(3);
    expect(w.text()).toContain(decks.ja.titleVi);
    await w.get('[data-testid="island-it"]').trigger('click');
    await w.get('[data-testid="open-settings"]').trigger('click');
    await w.get('.tomo').trigger('click');
    expect(w.emitted('open')).toEqual([['it']]);
    expect(w.emitted('settings')).toHaveLength(1);
    expect(audio.mock!.said[0]).toEqual([{ lang: 'vi', text: phrases.welcome }]);
  });
});

describe('IslandView', () => {
  it('chọn trò và quay lại', async () => {
    const w = mount(IslandView, { props: { deck: decks.en } });
    expect(w.text()).toContain(decks.en.titleVi);
    await w.get('[data-testid="play-match"]').trigger('click');
    await w.get('[data-testid="play-rain"]').trigger('click');
    await w.get('.back').trigger('click');
    expect(w.emitted('play')).toEqual([['match'], ['rain']]);
    expect(w.emitted('back')).toHaveLength(1);
  });
});

describe('SettingsView', () => {
  it('chọn nhóm tuổi đặt luôn tốc độ đọc mặc định của nhóm', async () => {
    const w = mount(SettingsView);
    await w.get('[data-testid="age-mam"]').trigger('click');
    expect(settings.ageGroup).toBe('mam');
    expect(settings.rate).toBe(0.8);
    expect(w.get('[data-testid="age-mam"]').attributes('aria-pressed')).toBe('true');
    await w.get('.back').trigger('click');
    expect(w.emitted('back')).toHaveLength(1);
  });

  it('chưa có giọng tạo sẵn thì ghi "Giọng của máy"; có thì cho chọn và hiện ghi công', async () => {
    const w = mount(SettingsView);
    expect(w.get('#voice-ja').text()).toContain('Giọng của máy');
    expect(w.text()).not.toContain('Ghi công');

    audio.mock!.manifest.value = {
      voices: [
        { id: 'ja-zunda', lang: 'ja', engine: 'voicevox', label: 'ずんだもん', credit: 'VOICEVOX:ずんだもん' },
        { id: 'ja-metan', lang: 'ja', engine: 'voicevox', label: '四国めたん', credit: 'VOICEVOX:四国めたん' },
      ],
      clips: {},
    };
    await w.vm.$nextTick();
    expect(w.get('#voice-ja').text()).toContain('Mặc định');
    expect(w.text()).toContain('VOICEVOX:ずんだもん');
    expect(w.text()).toContain('VOICEVOX:四国めたん');

    await w.get('#voice-ja').setValue('ja-metan');
    expect(settings.voices.ja).toBe('ja-metan');
    await w.get('#voice-ja').setValue('');
    expect(settings.voices.ja).toBeUndefined();
  });

  it('nghe thử từng ngôn ngữ', async () => {
    const w = mount(SettingsView);
    const buttons = w.findAll('.voice button');
    for (const b of buttons) await b.trigger('click');
    expect(audio.mock!.said.map((s) => s[0]!.lang)).toEqual(['vi', 'en', 'ja']);
    expect(audio.mock!.said[0]![0]!.text).toBe(phrases.correct);
  });

  it('bật tắt tự đọc, tiếng Việt và đổi tốc độ', async () => {
    const w = mount(SettingsView);
    const [autoRead, showVi] = w.findAll('input[type="checkbox"]');
    await autoRead!.setValue(false);
    await showVi!.setValue(false);
    await w.get('input[type="range"]').setValue('1.25');
    expect(settings.autoRead).toBe(false);
    expect(settings.showVietnamese).toBe(false);
    expect(settings.rate).toBe(1.25);
  });
});
