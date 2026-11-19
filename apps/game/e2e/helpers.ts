import type { Page, TestInfo } from '@playwright/test';
import { toRomaji } from 'wanakana';
import { decks, type LearnItem, type Subject } from '@study/content';

export function findItem(subject: Subject, id: string): LearnItem {
  const item = decks[subject].items.find((i) => i.id === id);
  if (!item) throw new Error(`Không có từ ${id}`);
  return item;
}

/** Cách gõ đáp án: tiếng Nhật gõ romaji (kiểm cả đường đổi romaji → かな), môn khác gõ đúng từ. */
export function typedAnswer(subject: Subject, item: LearnItem): string {
  return subject === 'ja' ? toRomaji(item.reading ?? item.term) : item.term;
}

export async function shot(page: Page, info: TestInfo, name: string): Promise<void> {
  await page.screenshot({ path: info.outputPath(`${name}-${info.project.name}.png`), fullPage: true });
}

/** Một câu giọng đọc đã "đọc": `lang` là hai chữ đầu mã ngôn ngữ (`vi`, `en`, `ja`). */
export interface Spoken {
  lang: string;
  text: string;
}

/**
 * Tắt giọng đọc của trình duyệt để test không phụ thuộc máy chạy test. Giọng giả đọc xong ngay và ghi lại từng câu,
 * chia theo lượt đọc (mỗi lần app huỷ giọng cũ là một lượt mới), để test biết Tomo đang đọc gì ở những trò chỉ cho
 * nghe mà không hiện chữ (Nghe Chọn, Viết Lại Từ).
 */
export async function muteSpeech(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const runs: { lang: string; text: string }[][] = [[]];
    const voices = ['vi-VN', 'en-US', 'ja-JP'].map((lang) => ({
      lang,
      name: lang,
      voiceURI: lang,
      localService: true,
      default: false,
    }));
    class Utterance {
      voice: unknown = null;
      lang = '';
      rate = 1;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(readonly text: string) {}
    }
    Object.defineProperty(window, '__speechRuns', { value: runs });
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: Utterance, configurable: true });
    Object.defineProperty(window, 'speechSynthesis', {
      value: {
        getVoices: () => voices,
        speak: (u: Utterance) => {
          runs.at(-1)!.push({ lang: u.lang.slice(0, 2), text: u.text });
          setTimeout(() => u.onend?.());
        },
        cancel: () => runs.push([]),
      },
    });
  });
}

/** Các câu của lượt đọc hiện tại (xem `muteSpeech`). */
export async function currentSpeech(page: Page): Promise<Spoken[]> {
  return page.evaluate(() => (window as unknown as { __speechRuns: Spoken[][] }).__speechRuns.at(-1)!);
}
