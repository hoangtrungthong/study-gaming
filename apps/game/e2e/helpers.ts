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

/** Tắt giọng đọc của trình duyệt để test không phụ thuộc máy chạy test. */
export async function muteSpeech(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'speechSynthesis', {
      value: { getVoices: () => [], speak: () => {}, cancel: () => {} },
    });
  });
}
