import { vi } from 'vitest';
import { ref } from 'vue';
import type { SpeechSegment } from '@study/content';
import { emptyManifest, type AudioManifest } from '../audio/speaker';

/** Bản giả của module `src/audio` cho test giao diện: ghi lại các câu được yêu cầu đọc. */
export function createAudioMock() {
  const said: SpeechSegment[][] = [];
  const speaker = {
    say: vi.fn(async (segments: SpeechSegment[], onSegment?: (i: number) => void) => {
      said.push(segments);
      segments.forEach((_, i) => onSegment?.(i));
    }),
    stop: vi.fn(),
  };
  const manifest = ref<AudioManifest>(emptyManifest());
  return { said, speaker, manifest, loadManifest: vi.fn(async () => {}) };
}
