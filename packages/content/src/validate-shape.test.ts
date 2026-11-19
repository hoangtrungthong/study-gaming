import { describe, expect, it } from 'vitest';
import { subjects } from './decks';
import { regions } from './regions';
import { REGION_SHAPE, validateRegionShape } from './validate';
import type { Level, Region } from './types';

const level = (n: number, over: Partial<Level> = {}): Level => ({
  id: `en-r1-l${n}`,
  game: 'match',
  items: ['en-apple', 'en-cat'],
  ...over,
});
const region = (order: number, levels: Level[] = [1, 2, 3, 4, 5, 6].map((n) => level(n))): Region => ({
  id: `en-r${order}`,
  subject: 'en',
  order,
  titleVi: 'Vùng',
  titleTarget: 'Region',
  levels,
});

describe('validateRegionShape', () => {
  it.each(subjects)('đảo %s đúng khuôn: 2 vùng × 6 màn, tối đa 5 từ mới, Viết Lại Từ chỉ hỏi từ đã dạy', (subject) => {
    expect(validateRegionShape(subject, regions[subject])).toEqual([]);
  });

  it('khuôn theo Req 1.2', () => {
    expect(REGION_SHAPE).toEqual({ regions: 2, levels: 6, newWords: 5 });
    expect(validateRegionShape('en', [region(1), region(2)])).toEqual([]);
  });

  it('báo lỗi số vùng và số màn', () => {
    expect(validateRegionShape('en', [region(1)])).toEqual(['en: cần đúng 2 vùng']);
    expect(validateRegionShape('en', [region(1, [level(1)]), region(2)])).toEqual(['en/en-r1: cần đúng 6 màn']);
  });

  it('báo lỗi quá 5 từ mới và từ mới không có trong items; màn không có items thì không kiểm items', () => {
    const six = ['en-a', 'en-b', 'en-c', 'en-d', 'en-e', 'en-f'];
    const levels = [
      level(1, { items: six, newWords: six }),
      level(2, { newWords: ['en-apple', 'en-dog'] }),
      level(3, { game: 'sentence', items: undefined, sentences: ['en-s-x'], newWords: ['en-dog'] }),
      level(4),
      level(5),
      level(6),
    ];
    expect(validateRegionShape('en', [region(1, levels), region(2)])).toEqual([
      'en/en-r1-l1: tối đa 5 từ mới',
      'en/en-r1-l2: từ mới "en-dog" phải có trong items',
    ]);
  });

  it('Viết Lại Từ chỉ hỏi từ đã là từ mới ở màn trước (kể cả vùng trước) hoặc chính màn đó', () => {
    const r1 = region(1, [level(1, { newWords: ['en-apple'] }), level(2), level(3), level(4), level(5), level(6)]);
    const write = (items?: string[], newWords?: string[]) =>
      region(2, [
        level(1, { id: 'en-r2-l1', game: 'write', items, newWords }),
        ...[2, 3, 4, 5, 6].map((n) => level(n)),
      ]);
    expect(validateRegionShape('en', [r1, write(['en-apple'])])).toEqual([]);
    expect(validateRegionShape('en', [r1, write(['en-apple', 'en-cat'], ['en-cat'])])).toEqual([]);
    expect(validateRegionShape('en', [r1, write(['en-apple', 'en-loop'])])).toEqual([
      'en/en-r2-l1: Viết Lại Từ hỏi "en-loop" khi chưa dạy ở màn nào trước đó',
    ]);
    expect(validateRegionShape('en', [r1, write()])).toEqual([]);
  });
});
