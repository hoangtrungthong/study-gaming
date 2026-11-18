import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { decks } from '@study/content';
import { defaultSettings, settings } from './settings';

const audio = vi.hoisted(() => ({
  mock: null as null | ReturnType<typeof import('./test/audioMock').createAudioMock>,
}));
vi.mock('./audio', async () => {
  const { createAudioMock } = await import('./test/audioMock');
  audio.mock = createAudioMock();
  return audio.mock;
});
vi.mock('./games/rain/RainScene', () => ({
  startRainScene: () => ({ scene: { burst: vi.fn() }, destroy: vi.fn() }),
}));

const { default: App } = await import('./App.vue');
const { setupPwa, updateReady } = await import('./pwa');

beforeEach(() => Object.assign(settings, defaultSettings()));

describe('App', () => {
  it('nạp manifest khi mở và đi qua các màn: đảo → Ghép Đôi → đảo → Mưa Chữ → bản đồ → cài đặt', async () => {
    const w = mount(App);
    expect(audio.mock!.loadManifest).toHaveBeenCalled();

    await w.get('[data-testid="island-ja"]').trigger('click');
    expect(w.text()).toContain(decks.ja.titleVi);

    await w.get('[data-testid="play-match"]').trigger('click');
    expect(w.find('[data-testid^="left-ja-"]').exists()).toBe(true);
    await w.get('.back').trigger('click');

    await w.get('[data-testid="play-rain"]').trigger('click');
    expect(w.find('[data-testid="rain-start"]').exists()).toBe(true);
    await w.get('.back').trigger('click');
    await w.get('.back').trigger('click');
    expect(w.findAll('.island')).toHaveLength(3);

    await w.get('[data-testid="open-settings"]').trigger('click');
    expect(w.find('[data-testid="age-mam"]').exists()).toBe(true);
    await w.get('.back').trigger('click');
    await flushPromises();
    expect(w.findAll('.island')).toHaveLength(3);
  });

  it('đổi màn thì focus về tiêu đề màn mới', async () => {
    const w = mount(App, { attachTo: document.body });
    await w.get('[data-testid="island-en"]').trigger('click');
    await flushPromises();
    expect(document.activeElement?.textContent).toBe(decks.en.titleVi);
    w.unmount();
  });

  it('có bản mới thì hiện thông báo tải lại', async () => {
    const apply = vi.fn(async () => {});
    setupPwa(() => apply);
    const w = mount(App);
    expect(w.find('[data-testid="update-banner"]').exists()).toBe(false);
    updateReady.value = true;
    await w.vm.$nextTick();
    expect(w.get('[data-testid="update-banner"]').text()).toContain('bản mới');
    await w.get('[data-testid="update-banner"] button').trigger('click');
    await flushPromises();
    expect(apply).toHaveBeenCalledWith(true);
    expect(updateReady.value).toBe(false);
  });
});
