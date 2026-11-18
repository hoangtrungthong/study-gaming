import { describe, expect, it, vi } from 'vitest';
import { reloadToUpdate, setupPwa, updateReady } from './pwa';

describe('pwa', () => {
  it('có bản mới thì bật thông báo; bấm tải lại thì áp dụng bản mới', async () => {
    const apply = vi.fn(async () => {});
    let needRefresh: (() => void) | undefined;
    setupPwa((options) => {
      expect(options.immediate).toBe(true);
      needRefresh = options.onNeedRefresh;
      return apply;
    });
    expect(updateReady.value).toBe(false);
    needRefresh!();
    expect(updateReady.value).toBe(true);
    await reloadToUpdate();
    expect(updateReady.value).toBe(false);
    expect(apply).toHaveBeenCalledWith(true);
  });

  it('cập nhật lỗi thì giữ thông báo để bấm lại', async () => {
    setupPwa(() => vi.fn(async () => Promise.reject(new Error('redundant'))));
    updateReady.value = true;
    await reloadToUpdate();
    expect(updateReady.value).toBe(true);
  });
});
