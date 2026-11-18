import { describe, expect, it, vi } from 'vitest';
import { AUDIO_CACHE, warmAudioCache } from './offlineCache';
import type { AudioManifest } from './speaker';

function fakeCaches(existing: string[] = [], failing: string[] = []) {
  const abs = (u: string) => new URL(u, location.href).href;
  const stored = new Set(existing.map(abs));
  const cache = {
    keys: vi.fn(async () => [...stored].map((url) => ({ url }) as Request)),
    delete: vi.fn(async (req: Request) => stored.delete(req.url)),
    match: vi.fn(async (url: string) => (stored.has(abs(url)) ? new Response('x') : undefined)),
    add: vi.fn(async (url: string) => {
      if (failing.includes(url)) throw new Error('network');
      stored.add(abs(url));
    }),
  };
  const storage = { open: vi.fn(async () => cache) } as unknown as CacheStorage;
  return { storage, cache, stored };
}

const manifest: AudioManifest = {
  voices: [],
  clips: {
    a: { 'vi|1': 'audio/a/1.m4a', 'vi|2': 'audio/a/2.m4a' },
    b: { 'ja|3': 'audio/b/3.m4a', 'ja|4': 'audio/a/1.m4a' },
  },
};

describe('warmAudioCache', () => {
  it('tải các file chưa có, không trùng, theo từng đợt; bỏ qua file đã có', async () => {
    const { storage, cache, stored } = fakeCaches(['/audio/a/2.m4a']);
    const added = await warmAudioCache(manifest, '/', storage, 1);
    expect(storage.open).toHaveBeenCalledWith(AUDIO_CACHE);
    expect(added).toBe(2);
    expect(cache.add).toHaveBeenCalledTimes(2);
    expect([...stored].map((u) => new URL(u).pathname).sort()).toEqual([
      '/audio/a/1.m4a',
      '/audio/a/2.m4a',
      '/audio/b/3.m4a',
    ]);
  });

  it('xoá file không còn trong manifest (câu đã sửa, giọng đã đổi)', async () => {
    const { storage, cache, stored } = fakeCaches(['/audio/a/1.m4a', '/audio/cu/xoa.m4a']);
    await warmAudioCache(manifest, '/', storage);
    expect(cache.delete).toHaveBeenCalledTimes(1);
    expect([...stored].some((u) => u.endsWith('/audio/cu/xoa.m4a'))).toBe(false);
  });

  it('một file lỗi mạng không làm hỏng cả lượt', async () => {
    const { storage } = fakeCaches([], ['/audio/a/1.m4a']);
    expect(await warmAudioCache(manifest, '/', storage)).toBe(2);
  });

  it('không có bộ nhớ đệm hoặc manifest rỗng thì không làm gì', async () => {
    expect(await warmAudioCache(manifest, '/', undefined)).toBe(0);
    const { storage } = fakeCaches();
    expect(await warmAudioCache({ voices: [], clips: {} }, '/', storage)).toBe(0);
    expect(storage.open).not.toHaveBeenCalled();
  });
});
