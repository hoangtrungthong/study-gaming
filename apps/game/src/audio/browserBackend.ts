import type { SpeechLang } from '@study/content';
import type { SpeakerBackend } from './speaker';

const BCP47: Record<SpeechLang, string> = { vi: 'vi-VN', en: 'en-US', ja: 'ja-JP' };

/** Phát file bằng <audio>, dự phòng bằng giọng đọc của trình duyệt/hệ điều hành. */
export function createBrowserBackend(): SpeakerBackend {
  let audio: HTMLAudioElement | null = null;
  let finishCurrent: (() => void) | null = null;

  const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined;
  // Chrome trả danh sách rỗng ở lần gọi đầu; gọi sớm để danh sách sẵn sàng khi cần đọc.
  synth?.getVoices();

  function pickVoice(lang: SpeechLang): SpeechSynthesisVoice | undefined {
    const tag = BCP47[lang].toLowerCase();
    const voices = synth?.getVoices() ?? [];
    const matches = (v: SpeechSynthesisVoice) =>
      v.lang.toLowerCase() === tag || v.lang.toLowerCase().replace('_', '-').startsWith(`${lang}-`);
    // Ưu tiên giọng chạy trên máy (không cần mạng). Giọng online chỉ dùng khi đang có mạng.
    return (
      voices.find((v) => matches(v) && v.localService) ??
      (navigator.onLine ? voices.find((v) => matches(v)) : undefined)
    );
  }

  return {
    playFile(url, rate) {
      return new Promise<boolean>((resolve) => {
        audio = new Audio(url);
        audio.playbackRate = rate;
        // Bị dừng giữa chừng vẫn tính là đã phát, để không đọc lại bằng giọng máy.
        finishCurrent = () => resolve(true);
        audio.onended = () => resolve(true);
        audio.onerror = () => resolve(false);
        audio.play().catch(() => resolve(false));
      });
    },
    speakSystem(segment, rate) {
      const voice = pickVoice(segment.lang);
      if (!synth || !voice) return Promise.resolve(false);
      return new Promise<boolean>((resolve) => {
        const u = new SpeechSynthesisUtterance(segment.text);
        u.voice = voice;
        u.lang = voice.lang;
        u.rate = rate;
        finishCurrent = () => resolve(true);
        u.onend = () => resolve(true);
        u.onerror = () => resolve(true);
        synth.speak(u);
      });
    },
    stop() {
      if (audio) {
        audio.onended = null;
        audio.pause();
        audio = null;
      }
      synth?.cancel();
      finishCurrent?.();
      finishCurrent = null;
    },
  };
}
