import { speechKey, type SpeechLang, type SpeechSegment } from '@study/content';

export interface VoiceInfo {
  id: string;
  lang: SpeechLang;
  /** vieneu | voicevox | kokoro */
  engine: string;
  label: string;
  /** Dòng ghi công bắt buộc (VOICEVOX:<tên>), nếu có. */
  credit?: string;
}

export interface AudioManifest {
  voices: VoiceInfo[];
  /** voiceId → (lang|text → đường dẫn file trong public/). */
  clips: Record<string, Record<string, string>>;
}

export interface SpeakerOptions {
  rate: number;
  voices: Partial<Record<SpeechLang, string>>;
  /** Bỏ các dòng dịch tiếng Việt (khi người học tắt tiếng Việt). Lời hướng dẫn vẫn đọc. */
  skipTranslations: boolean;
}

export interface SpeakerBackend {
  /** Phát một file; trả false nếu không phát được (lỗi tải, không giải mã được, bị chặn tự phát). */
  playFile(url: string, rate: number): Promise<boolean>;
  /** Đọc bằng giọng có sẵn trên máy; trả false nếu máy không có giọng cho ngôn ngữ đó. */
  speakSystem(segment: SpeechSegment, rate: number): Promise<boolean>;
  stop(): void;
}

export const emptyManifest = (): AudioManifest => ({ voices: [], clips: {} });

/**
 * Tìm file âm thanh tạo sẵn cho một đoạn: ưu tiên giọng người dùng chọn,
 * sau đó giọng đầu tiên của ngôn ngữ đó có file.
 */
export function resolveClip(manifest: AudioManifest, segment: SpeechSegment, chosen?: string): string | null {
  const key = speechKey(segment);
  const candidates = manifest.voices.filter((v) => v.lang === segment.lang).map((v) => v.id);
  const order = chosen ? [chosen, ...candidates.filter((id) => id !== chosen)] : candidates;
  for (const id of order) {
    const path = manifest.clips[id]?.[key];
    if (path) return path;
  }
  return null;
}

export class Speaker {
  private run = 0;

  constructor(
    private backend: SpeakerBackend,
    private getManifest: () => AudioManifest,
    private getOptions: () => SpeakerOptions,
    private baseUrl = '/',
  ) {}

  /**
   * Đọc lần lượt các đoạn. Lần gọi mới huỷ lần đang đọc.
   * `onSegment(i)` báo đoạn đang đọc để tô sáng phụ đề; `-1` khi xong.
   * `rateFactor` nhân với tốc độ trong cài đặt cho riêng lượt này (ví dụ 0,8 để đọc chậm khi người học gõ sai).
   */
  async say(segments: SpeechSegment[], onSegment?: (index: number) => void, rateFactor = 1): Promise<void> {
    const run = ++this.run;
    this.backend.stop();
    const base = this.getOptions();
    const opts = { ...base, rate: base.rate * rateFactor };
    for (const [i, seg] of segments.entries()) {
      if (run !== this.run) break;
      if (opts.skipTranslations && seg.translation) continue;
      onSegment?.(i);
      const clip = resolveClip(this.getManifest(), seg, opts.voices[seg.lang]);
      const played = clip ? await this.backend.playFile(this.baseUrl + clip, opts.rate) : false;
      // File hỏng hoặc trình duyệt không phát được: đọc bằng giọng của máy.
      if (!played && run === this.run) await this.backend.speakSystem(seg, opts.rate);
    }
    // Báo xong cả khi bị lượt mới huỷ, để phụ đề không bị tô sáng mãi.
    onSegment?.(-1);
  }

  stop(): void {
    this.run++;
    this.backend.stop();
  }
}
