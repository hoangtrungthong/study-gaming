import { describe, expect, it, vi } from 'vitest';
import type { SpeechSegment } from '@study/content';
import {
  emptyManifest,
  resolveClip,
  Speaker,
  type AudioManifest,
  type SpeakerBackend,
  type SpeakerOptions,
} from './speaker';

const manifest: AudioManifest = {
  voices: [
    { id: 'vi-a', lang: 'vi', engine: 'vieneu', label: 'A' },
    { id: 'vi-b', lang: 'vi', engine: 'vieneu', label: 'B' },
    { id: 'ja-z', lang: 'ja', engine: 'voicevox', label: 'Z', credit: 'VOICEVOX:Z' },
  ],
  clips: {
    'vi-a': { 'vi|xin chào': 'audio/vi-a/1.ogg', 'vi|chỉ a': 'audio/vi-a/2.ogg' },
    'vi-b': { 'vi|xin chào': 'audio/vi-b/1.ogg' },
    'ja-z': { 'ja|ねこ': 'audio/ja-z/1.ogg' },
  },
};

describe('resolveClip', () => {
  it('ưu tiên giọng đã chọn', () => {
    expect(resolveClip(manifest, { lang: 'vi', text: 'xin chào' }, 'vi-b')).toBe('audio/vi-b/1.ogg');
  });
  it('giọng đã chọn thiếu file thì lấy giọng khác cùng ngôn ngữ', () => {
    expect(resolveClip(manifest, { lang: 'vi', text: 'chỉ a' }, 'vi-b')).toBe('audio/vi-a/2.ogg');
  });
  it('không chọn giọng thì lấy giọng đầu tiên có file', () => {
    expect(resolveClip(manifest, { lang: 'vi', text: 'xin chào' })).toBe('audio/vi-a/1.ogg');
  });
  it('không có file thì trả null', () => {
    expect(resolveClip(manifest, { lang: 'en', text: 'hello' })).toBeNull();
    expect(resolveClip(emptyManifest(), { lang: 'vi', text: 'xin chào' })).toBeNull();
  });
});

function fakeBackend() {
  const played: string[] = [];
  let release: (() => void) | null = null;
  const backend: SpeakerBackend & { played: string[]; hold: boolean; failFiles: boolean; release(): void } = {
    played,
    hold: false,
    failFiles: false,
    playFile: vi.fn(async (url: string) => {
      played.push(`file:${url}`);
      if (backend.hold) await new Promise<void>((r) => (release = r));
      return !backend.failFiles;
    }),
    speakSystem: vi.fn(async (s: SpeechSegment) => {
      played.push(`tts:${s.lang}:${s.text}`);
      return true;
    }),
    stop: vi.fn(() => {
      release?.();
      release = null;
    }),
    release: () => release?.(),
  };
  return backend;
}

const opts = (over: Partial<SpeakerOptions> = {}): SpeakerOptions => ({
  rate: 1,
  voices: {},
  skipTranslations: false,
  ...over,
});

describe('Speaker', () => {
  it('đọc lần lượt: có file thì phát file, không thì dùng giọng của máy, báo chỉ số đoạn', async () => {
    const backend = fakeBackend();
    const speaker = new Speaker(
      backend,
      () => manifest,
      () => opts(),
      '/base/',
    );
    const seen: number[] = [];
    await speaker.say(
      [
        { lang: 'ja', text: 'ねこ' },
        { lang: 'vi', text: 'con mèo' },
      ],
      (i) => seen.push(i),
    );
    expect(backend.played).toEqual(['file:/base/audio/ja-z/1.ogg', 'tts:vi:con mèo']);
    expect(seen).toEqual([0, 1, -1]);
  });

  it('tắt tiếng Việt chỉ bỏ dòng dịch, lời hướng dẫn vẫn đọc', async () => {
    const backend = fakeBackend();
    const speaker = new Speaker(
      backend,
      () => manifest,
      () => opts({ skipTranslations: true }),
    );
    await speaker.say([
      { lang: 'vi', text: 'dòng dịch', translation: true },
      { lang: 'en', text: 'hello' },
      { lang: 'vi', text: 'hướng dẫn' },
    ]);
    expect(backend.played).toEqual(['tts:en:hello', 'tts:vi:hướng dẫn']);
  });

  it('file không phát được (lỗi, Safari không giải mã được) thì đọc bằng giọng của máy', async () => {
    const backend = fakeBackend();
    backend.failFiles = true;
    const speaker = new Speaker(
      backend,
      () => manifest,
      () => opts(),
      '',
    );
    await speaker.say([{ lang: 'ja', text: 'ねこ' }]);
    expect(backend.played).toEqual(['file:audio/ja-z/1.ogg', 'tts:ja:ねこ']);
  });

  it('dùng giọng người dùng chọn', async () => {
    const backend = fakeBackend();
    const speaker = new Speaker(
      backend,
      () => manifest,
      () => opts({ voices: { vi: 'vi-b' } }),
      '',
    );
    await speaker.say([{ lang: 'vi', text: 'xin chào' }]);
    expect(backend.played).toEqual(['file:audio/vi-b/1.ogg']);
  });

  it('lần gọi mới huỷ lần đang đọc', async () => {
    const backend = fakeBackend();
    backend.hold = true;
    const speaker = new Speaker(
      backend,
      () => manifest,
      () => opts(),
      '',
    );
    const seen: number[] = [];
    const first = speaker.say(
      [
        { lang: 'ja', text: 'ねこ' },
        { lang: 'vi', text: 'không được đọc' },
      ],
      (i) => seen.push(i),
    );
    backend.hold = false;
    const second = speaker.say([{ lang: 'en', text: 'hi' }]);
    await Promise.all([first, second]);
    expect(backend.played).toEqual(['file:audio/ja-z/1.ogg', 'tts:en:hi']);
    expect(seen).toEqual([0, -1]); // bị huỷ vẫn báo xong để bỏ tô sáng
  });

  it('stop dừng cả lần đang đọc', async () => {
    const backend = fakeBackend();
    backend.hold = true;
    const speaker = new Speaker(
      backend,
      () => manifest,
      () => opts(),
      '',
    );
    const run = speaker.say([
      { lang: 'ja', text: 'ねこ' },
      { lang: 'en', text: 'never' },
    ]);
    speaker.stop();
    await run;
    expect(backend.played).toEqual(['file:audio/ja-z/1.ogg']);
    expect(backend.stop).toHaveBeenCalled();
  });
});
