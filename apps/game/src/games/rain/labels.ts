import type { LearnItem } from '@study/content';
import type { DropLabel } from './RainScene';

/** term: hiện từ gốc · meaning: hiện nghĩa tiếng Việt · audio: chỉ nghe. */
export type PromptMode = 'term' | 'meaning' | 'audio';

export function promptLabel(item: LearnItem, mode: PromptMode): DropLabel {
  switch (mode) {
    case 'term':
      return item.reading && item.reading !== item.term ? { main: item.term, sub: item.reading } : { main: item.term };
    case 'meaning':
      return { main: `${item.emoji} ${item.meaningVi}` };
    case 'audio':
      return { main: '🔊' };
  }
}
