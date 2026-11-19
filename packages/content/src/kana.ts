import type { KanaStrokes } from './types';

/** Dạng file `data/kana-strokes.json` (sinh bởi `pnpm kana-strokes`). */
export interface KanaStrokesFile {
  license: string;
  kana: KanaStrokes[];
}

/**
 * Nạp dữ liệu nét kana. Nạp lazy (không import tĩnh ở `index.ts`) để trang chủ không phải tải file nét;
 * chỉ trò Vẽ Kana gọi hàm này.
 */
export async function loadKanaStrokes(): Promise<KanaStrokes[]> {
  const data = await import('../data/kana-strokes.json', { with: { type: 'json' } });
  return (data.default as KanaStrokesFile).kana;
}

export function findKana(list: readonly KanaStrokes[], char: string): KanaStrokes | undefined {
  return list.find((k) => k.char === char);
}
