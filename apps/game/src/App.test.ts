import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { decks, islandContent, islandMazes } from '@study/content';
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
    await vi.dynamicImportSettled();
    await flushPromises();
    expect(w.find('[data-testid^="left-ja-"]').exists()).toBe(true);
    await w.get('.back').trigger('click');

    await w.get('[data-testid="play-rain"]').trigger('click');
    await vi.dynamicImportSettled();
    await flushPromises();
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

  it('màn có từ mới: bảng kết quả có nút sang Viết Lại Từ, kết quả giữ sao trò chính (CC-5, CK-6)', async () => {
    const w = mount(App);
    await w.get('[data-testid="island-en"]').trigger('click');
    await w.get('[data-testid="play-match"]').trigger('click');
    await vi.dynamicImportSettled();
    await flushPromises();
    const vm = w.vm as unknown as { lastResult: unknown; nextStep: { label: string; go: () => void } | null };
    expect(vm.nextStep).toBeNull();
    const main = {
      game: 'match',
      stars: 3,
      firstTry: ['en-apple'],
      wrong: ['en-cat'],
      hinted: ['en-dog'],
      usedHint: false,
    };
    (w.findComponent('.game-view') as VueWrapper).vm.$emit('finish', main);
    await flushPromises();
    // Chưa tự chuyển: bé còn đang xem bảng kết quả của trò chính.
    expect(w.find('[data-testid^="left-en-"]').exists()).toBe(true);
    expect(vm.nextStep?.label).toBe('Tiếp: Viết Lại Từ');
    vm.nextStep!.go();
    await vi.dynamicImportSettled();
    await flushPromises();
    expect(w.get('.game-view h2').text()).toBe('Viết Lại Từ');
    expect(vm.nextStep).toBeNull();
    // Chỉ hỏi từ mới bé vừa gặp trong lượt chính, kể cả từ làm đúng nhờ Đèn Pin (đều là từ mới của màn Ghép Đôi).
    expect((w.vm as unknown as { gameLevel: { newWords: string[] } }).gameLevel.newWords).toEqual([
      'en-apple',
      'en-cat',
      'en-dog',
    ]);
    const lastResult = () => vm.lastResult;
    expect(lastResult()).toBeNull();

    const write = { game: 'write', stars: 1, firstTry: [], wrong: ['en-dog', 'en-cat'], usedHint: true };
    (w.findComponent('.game-view') as VueWrapper).vm.$emit('finish', write);
    // Dùng Đèn Pin ở Viết Lại Từ: cả màn tối đa 2 sao.
    expect(lastResult()).toEqual({ ...main, stars: 2, wrong: ['en-cat', 'en-dog'], usedHint: true });

    // Chơi lại màn khác: kết quả cũ không còn; về đảo trước khi gõ lại thì màn chưa tính xong.
    await w.get('.back').trigger('click');
    await w.get('[data-testid="play-star"]').trigger('click');
    await vi.dynamicImportSettled();
    await flushPromises();
    expect(lastResult()).toBeNull();
    const star = { game: 'star', stars: 3, firstTry: ['khong-phai-tu-moi'], wrong: [], usedHint: false };
    (w.findComponent('.game-view') as VueWrapper).vm.$emit('finish', star);
    await flushPromises();
    expect(vm.nextStep?.label).toBe('Tiếp: Viết Lại Từ');
    vm.nextStep!.go();
    await vi.dynamicImportSettled();
    await flushPromises();
    // Lượt chính không gặp từ mới nào: hỏi mọi từ mới của màn.
    const starNew = (w.vm as unknown as { gameLevel: { newWords: string[] } }).gameLevel.newWords as string[];
    expect(starNew).toEqual(islandContent('en', 'star').newWords);
    await w.get('.back').trigger('click');
    expect(lastResult()).toBeNull();
  });

  it('trò không có từ mới thì kết quả là của chính trò đó', async () => {
    const w = mount(App, { attachTo: document.body });
    await w.get('[data-testid="island-it"]').trigger('click');
    await w.get('[data-testid="play-maze"]').trigger('click');
    await vi.dynamicImportSettled();
    await flushPromises();
    const vm = w.vm as unknown as { lastResult: unknown; nextStep: { label: string; go: () => void } | null };
    const level = () => (w.vm as unknown as { gameLevel: { maze?: string } }).gameLevel;
    expect(level().maze).toBe(islandMazes('it')[0]);
    expect(vm.nextStep).toBeNull();
    const result = { game: 'maze', stars: 2, firstTry: [], wrong: [], usedHint: false };
    (w.findComponent('.game-view') as VueWrapper).vm.$emit('finish', result);
    expect(vm.lastResult).toEqual(result);

    // Mê cung: thắng thì sang mê cung sau, lần lượt tới mê cung cuối của đảo (CC-25).
    const all = islandMazes('it');
    for (let i = 1; i < all.length; i++) {
      await flushPromises();
      expect(vm.nextStep?.label).toBe('Tiếp: Mê cung sau');
      vm.nextStep!.go();
      await vi.dynamicImportSettled();
      await new Promise((resolve) => setTimeout(resolve));
      await flushPromises();
      expect(level().maze).toBe(all[i]);
      expect(vm.nextStep).toBeNull();
      // Mê cung mới gắn lại: focus về tiêu đề trò, không rơi xuống <body>.
      expect(document.activeElement).toBe(w.get('.game-view h2').element);
      (w.findComponent('.game-view') as VueWrapper).vm.$emit('finish', result);
    }
    await flushPromises();
    expect(vm.nextStep).toBeNull();

    // Đã thắng mê cung cuối: vào lại thì chơi từ mê cung đầu.
    await w.get('.back').trigger('click');
    await w.get('[data-testid="play-maze"]').trigger('click');
    await flushPromises();
    expect(level().maze).toBe(all[0]);
    w.unmount();
  });

  it('đổi màn thì focus về tiêu đề màn mới, kể cả trò tải lazy lần đầu', async () => {
    const w = mount(App, { attachTo: document.body });
    await w.get('[data-testid="island-en"]').trigger('click');
    await flushPromises();
    expect(document.activeElement?.textContent).toBe(decks.en.titleVi);
    await w.get('[data-testid="play-memory"]').trigger('click');
    await vi.dynamicImportSettled();
    await flushPromises();
    expect(document.activeElement).toBe(w.get('.game-view h2').element);
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
