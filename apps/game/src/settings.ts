import { reactive, watch } from 'vue';
import type { AgeGroup, SpeechLang } from '@study/content';

export interface Settings {
  ageGroup: AgeGroup;
  /** Tự đọc giải thích khi hiện ra. */
  autoRead: boolean;
  /** Tốc độ đọc, 0.75–1.5. */
  rate: number;
  /** Hiện dòng tiếng Việt (chữ và tiếng). */
  showVietnamese: boolean;
  /** Giọng chọn cho từng ngôn ngữ; rỗng là giọng mặc định. */
  voices: Partial<Record<SpeechLang, string>>;
}

const KEY = 'tomo.settings.v1';

export const DEFAULT_RATE: Record<AgeGroup, number> = { mam: 0.8, choi: 1, cay: 1 };

export function defaultSettings(): Settings {
  return { ageGroup: 'choi', autoRead: true, rate: 1, showVietnamese: true, voices: {} };
}

export function loadSettings(storage: Pick<Storage, 'getItem'> = localStorage): Settings {
  try {
    const raw = storage.getItem(KEY);
    if (!raw) return defaultSettings();
    const parsed = JSON.parse(raw) as Partial<Settings>;
    const merged = { ...defaultSettings(), ...parsed, voices: { ...parsed.voices } };
    merged.rate = Math.min(1.5, Math.max(0.75, Number(merged.rate) || 1));
    if (!['mam', 'choi', 'cay'].includes(merged.ageGroup)) merged.ageGroup = 'choi';
    return merged;
  } catch {
    return defaultSettings();
  }
}

export function saveSettings(settings: Settings, storage: Pick<Storage, 'setItem'> = localStorage): void {
  storage.setItem(KEY, JSON.stringify(settings));
}

export const settings = reactive(loadSettings());
watch(settings, (s) => saveSettings(s), { deep: true });
