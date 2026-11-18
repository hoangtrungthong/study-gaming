import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadManifest, manifest, speaker } from './index';
import { emptyManifest } from './speaker';

afterEach(() => {
  vi.unstubAllGlobals();
  manifest.value = emptyManifest();
});

describe('audio/index', () => {
  it('nạp manifest âm thanh tạo sẵn', async () => {
    const data = { voices: [{ id: 'v', lang: 'vi', engine: 'vieneu', label: 'V' }], clips: { v: {} } };
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(data), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await loadManifest();
    expect(fetchMock).toHaveBeenCalledWith('/audio/manifest.json');
    expect(manifest.value).toEqual(data);
    // Có mạng: tải sẵn âm thanh vào bộ nhớ đệm (ở đây manifest không có file nên không mở cache).
  });

  it('không có manifest hoặc mất mạng thì giữ manifest rỗng (dùng giọng của máy)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 404 })),
    );
    await loadManifest();
    expect(manifest.value).toEqual(emptyManifest());
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new Error('offline'))),
    );
    await loadManifest();
    expect(manifest.value).toEqual(emptyManifest());
  });

  it('speaker dùng chung đọc theo cài đặt và manifest hiện tại', async () => {
    Object.defineProperty(window, 'speechSynthesis', {
      value: { getVoices: () => [], speak: vi.fn(), cancel: vi.fn() },
      configurable: true,
    });
    const played: string[] = [];
    vi.stubGlobal(
      'Audio',
      class {
        playbackRate = 1;
        onended: (() => void) | null = null;
        onerror: (() => void) | null = null;
        constructor(src: string) {
          played.push(src);
        }
        play() {
          queueMicrotask(() => this.onended?.());
          return Promise.resolve();
        }
        pause() {}
      },
    );
    manifest.value = {
      voices: [{ id: 'v', lang: 'vi', engine: 'vieneu', label: 'V' }],
      clips: { v: { 'vi|xin chào': 'audio/v/1.ogg' } },
    };
    await speaker.say([{ lang: 'vi', text: 'xin chào' }]);
    expect(played).toEqual(['/audio/v/1.ogg']);
  });
});
