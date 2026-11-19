import { describe, expect, it } from 'vitest';
import { decks } from './decks';
import {
  findLevel,
  gameAllowed,
  ISLAND_LEVEL_SUFFIX,
  islandContent,
  islandMazes,
  levelItems,
  levelMaze,
  levelNewWords,
  levelSentences,
  mazes,
  regions,
  sentenceDecks,
} from './regions';
import { validateRegions } from './validate';
import { loadKanaStrokes } from './kana';
import { subjects } from './decks';

describe('dữ liệu vùng thật', () => {
  it.each(subjects)('vùng của môn %s hợp lệ, kana của màn Vẽ Kana có dữ liệu nét', async (subject) => {
    const kanaChars = new Set((await loadKanaStrokes()).map((k) => k.char));
    expect(validateRegions(subject, regions[subject], { decks, sentenceDecks, mazes, kanaChars })).toEqual([]);
  });
});

describe('tra cứu nội dung màn', () => {
  it('tìm màn theo id và trả vùng chứa nó', () => {
    const found = findLevel('ja-r1-l4');
    expect(found?.region.id).toBe('ja-r1');
    expect(found?.level.game).toBe('sentence');
    expect(findLevel('khong-co')).toBeUndefined();
  });

  it('tra từ, từ mới, câu, mê cung đúng thứ tự trong màn; bỏ id không có', () => {
    const l1 = findLevel('en-r1-l1')!.level;
    expect(levelItems('en', l1).map((i) => i.id)).toEqual(l1.items);
    expect(levelNewWords('en', l1).map((i) => i.id)).toEqual(['en-apple', 'en-cat', 'en-dog']);
    expect(levelItems('en', { id: 'x', game: 'match', items: ['en-apple', 'khong-co'] })).toHaveLength(1);
    expect(levelSentences('ja', findLevel('ja-r1-l4')!.level)[0]!.chunks).toEqual(['りんごを', 'ください']);
    expect(levelSentences('it', { id: 'x', game: 'sentence', sentences: ['a'] })).toEqual([]);
    expect(levelMaze(findLevel('it-r1-l3')!.level)?.id).toBe('it-m-01');
    expect(levelNewWords('en', { id: 'x', game: 'match' })).toEqual([]);
  });

  it('trò nào dùng cho môn nào', () => {
    expect(gameAllowed('kana', 'ja')).toBe(true);
    expect(gameAllowed('kana', 'en')).toBe(false);
    expect(gameAllowed('maze', 'it')).toBe(true);
    expect(gameAllowed('maze', 'ja')).toBe(false);
    expect(gameAllowed('sentence', 'it')).toBe(false);
    expect(gameAllowed('sentence', 'en')).toBe(true);
    expect(gameAllowed('memory', 'it')).toBe(true);
  });

  it('nội dung cả đảo cho một trò: gộp các màn, không trùng', () => {
    const listen = islandContent('en', 'listen');
    expect(listen.items).toEqual(findLevel('en-r1-l2')!.level.items);
    // Từ mới của các màn Ghép Đôi được gộp để nối Viết Lại Từ (CC-5).
    const newWords = regions.en.flatMap((r) => r.levels).flatMap((l) => (l.game === 'match' ? (l.newWords ?? []) : []));
    expect(islandContent('en', 'match').newWords).toEqual([...new Set(newWords)]);
    const jaSentences = regions.ja.flatMap((r) => r.levels).flatMap((l) => l.sentences ?? []);
    expect(islandContent('ja', 'sentence').sentences).toEqual([...new Set(jaSentences)]);
    expect(islandContent('it', 'maze').maze).toBe('it-m-01');
    expect(islandContent('it', 'maze').id).toBe(`it-maze${ISLAND_LEVEL_SUFFIX}`);
    expect(islandMazes('it')).toEqual(regions.it.flatMap((r) => r.levels).flatMap((l) => (l.maze ? [l.maze] : [])));
    expect(new Set(islandMazes('it')).size).toBe(6);
    expect(islandMazes('en')).toEqual([]);
    expect(islandContent('ja', 'kana').kana).toEqual(['あ', 'い', 'う', 'え', 'お', 'ア', 'イ', 'ウ', 'エ', 'オ']);
  });

  it('trò từ vựng mà đảo chưa có màn: dùng cả bộ từ; trò khác thì để trống', () => {
    expect(islandContent('it', 'star', []).items).toHaveLength(decks.it.items.length);
    const kana = islandContent('en', 'kana');
    expect(kana.items).toBeUndefined();
    expect(kana.kana).toBeUndefined();
  });
});
