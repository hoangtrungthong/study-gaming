import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBrowserBackend } from './browserBackend';

class FakeAudio {
  static last: FakeAudio | null = null;
  static playFails = false;
  playbackRate = 1;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  pause = vi.fn();
  constructor(public src: string) {
    FakeAudio.last = this;
  }
  play() {
    return FakeAudio.playFails ? Promise.reject(new Error('autoplay')) : Promise.resolve();
  }
}

class FakeUtterance {
  static last: FakeUtterance | null = null;
  voice: unknown = null;
  lang = '';
  rate = 1;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public text: string) {
    FakeUtterance.last = this;
  }
}

const voice = (lang: string, localService: boolean) => ({ lang, localService, name: lang }) as SpeechSynthesisVoice;

function installSynth(voices: SpeechSynthesisVoice[]) {
  const synth = { getVoices: vi.fn(() => voices), speak: vi.fn(), cancel: vi.fn() };
  Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
  return synth;
}

let online = true;
beforeEach(() => {
  vi.stubGlobal('Audio', FakeAudio);
  vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
  FakeAudio.last = null;
  FakeAudio.playFails = false;
  online = true;
  vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => online);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('createBrowserBackend', () => {
  it('phát file với tốc độ đã chọn, xong khi file phát hết', async () => {
    installSynth([]);
    const b = createBrowserBackend();
    const done = b.playFile('/audio/a.ogg', 1.25);
    expect(FakeAudio.last!.src).toBe('/audio/a.ogg');
    expect(FakeAudio.last!.playbackRate).toBe(1.25);
    FakeAudio.last!.onended!();
    await expect(done).resolves.toBe(true);
  });

  it('file lỗi hoặc trình duyệt chặn tự phát thì báo false, không treo', async () => {
    installSynth([]);
    const b = createBrowserBackend();
    const errored = b.playFile('/a.ogg', 1);
    FakeAudio.last!.onerror!();
    await expect(errored).resolves.toBe(false);
    FakeAudio.playFails = true;
    await expect(b.playFile('/b.ogg', 1)).resolves.toBe(false);
  });

  it('ưu tiên giọng chạy trên máy đúng ngôn ngữ', async () => {
    const synth = installSynth([voice('ja-JP', false), voice('ja-JP', true), voice('vi_VN', true)]);
    const b = createBrowserBackend();
    const spoken = b.speakSystem({ lang: 'ja', text: 'ねこ' }, 0.9);
    const u = FakeUtterance.last!;
    expect((u.voice as SpeechSynthesisVoice).localService).toBe(true);
    expect(u.rate).toBe(0.9);
    expect(synth.speak).toHaveBeenCalledWith(u);
    u.onend!();
    await expect(spoken).resolves.toBe(true);

    const vi_ = b.speakSystem({ lang: 'vi', text: 'chào' }, 1);
    expect((FakeUtterance.last!.voice as SpeechSynthesisVoice).lang).toBe('vi_VN');
    FakeUtterance.last!.onerror!();
    await expect(vi_).resolves.toBe(true);
  });

  it('giọng online chỉ dùng khi có mạng; không có giọng thì báo false', async () => {
    installSynth([voice('en-US', false)]);
    const b = createBrowserBackend();
    const p = b.speakSystem({ lang: 'en', text: 'hi' }, 1);
    FakeUtterance.last!.onend!();
    await expect(p).resolves.toBe(true);
    online = false;
    await expect(b.speakSystem({ lang: 'en', text: 'hi' }, 1)).resolves.toBe(false);
    await expect(b.speakSystem({ lang: 'ja', text: 'x' }, 1)).resolves.toBe(false);
  });

  it('stop dừng file đang phát, huỷ giọng máy và kết thúc lượt đang chờ', async () => {
    const synth = installSynth([voice('en-US', true)]);
    const b = createBrowserBackend();
    const file = b.playFile('/a.ogg', 1);
    const audio = FakeAudio.last!;
    b.stop();
    expect(audio.pause).toHaveBeenCalled();
    expect(audio.onended).toBeNull();
    await expect(file).resolves.toBe(true);

    const tts = b.speakSystem({ lang: 'en', text: 'hi' }, 1);
    b.stop();
    expect(synth.cancel).toHaveBeenCalled();
    await expect(tts).resolves.toBe(true);
    b.stop(); // gọi lại khi không có gì đang phát
  });

  it('trình duyệt không có speechSynthesis thì báo false', async () => {
    Object.defineProperty(window, 'speechSynthesis', { value: undefined, configurable: true });
    const b = createBrowserBackend();
    await expect(b.speakSystem({ lang: 'vi', text: 'a' }, 1)).resolves.toBe(false);
    b.stop();
  });
});
