import { ref } from 'vue';
import { settings } from '../settings';
import { createBrowserBackend } from './browserBackend';
import { warmAudioCache } from './offlineCache';
import { emptyManifest, Speaker, type AudioManifest } from './speaker';

export const manifest = ref<AudioManifest>(emptyManifest());

export async function loadManifest(): Promise<void> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}audio/manifest.json`);
    if (res.ok) manifest.value = (await res.json()) as AudioManifest;
    // Tải sẵn âm thanh cho lúc mất mạng; chạy nền, lỗi thì lần mở sau tải tiếp.
    if (navigator.onLine) void warmAudioCache(manifest.value, import.meta.env.BASE_URL).catch(() => 0);
  } catch {
    // Không có file âm thanh tạo sẵn: dùng giọng của máy.
  }
}

export const speaker = new Speaker(
  createBrowserBackend(),
  () => manifest.value,
  () => ({ rate: settings.rate, voices: settings.voices, skipTranslations: !settings.showVietnamese }),
  import.meta.env.BASE_URL,
);
