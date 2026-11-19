import enRegions from '../data/regions/en.json' with { type: 'json' };
import jaRegions from '../data/regions/ja.json' with { type: 'json' };
import itRegions from '../data/regions/it.json' with { type: 'json' };
import enSentences from '../data/sentences/en.json' with { type: 'json' };
import jaSentences from '../data/sentences/ja.json' with { type: 'json' };
import mazeData from '../data/mazes.json' with { type: 'json' };
import { decks } from './decks';
import type { GameKind, LearnItem, Level, MazeLevel, Region, Sentence, SentenceDeck, Subject } from './types';

export const regions: Record<Subject, Region[]> = {
  en: (enRegions as { regions: Region[] }).regions,
  ja: (jaRegions as { regions: Region[] }).regions,
  it: (itRegions as { regions: Region[] }).regions,
};

/** IT chưa có câu cho Xếp Câu ở vùng 1–2. */
export const sentenceDecks: Partial<Record<Subject, SentenceDeck>> = {
  en: enSentences as SentenceDeck,
  ja: jaSentences as SentenceDeck,
};

export const mazes: MazeLevel[] = (mazeData as { mazes: MazeLevel[] }).mazes;

/** Trò nào dùng được ở môn nào (Vẽ Kana chỉ tiếng Nhật, Đưa Bit Về Nhà chỉ IT, Xếp Câu không có ở IT). */
export function gameAllowed(game: GameKind, subject: Subject): boolean {
  if (game === 'kana') return subject === 'ja';
  if (game === 'maze') return subject === 'it';
  if (game === 'sentence') return subject !== 'it';
  return true;
}

export function findLevel(levelId: string): { region: Region; level: Level } | undefined {
  for (const list of Object.values(regions)) {
    for (const region of list) {
      const level = region.levels.find((l) => l.id === levelId);
      if (level) return { region, level };
    }
  }
  return undefined;
}

/** Trò chơi dựa trên bộ từ vựng. */
export const ITEM_GAMES: GameKind[] = ['match', 'rain', 'star', 'listen', 'memory', 'write'];

const byId = <T extends { id: string }>(list: readonly T[], ids: readonly string[] | undefined): T[] =>
  (ids ?? []).map((id) => list.find((x) => x.id === id)).filter((x): x is T => x !== undefined);

export function levelItems(subject: Subject, level: Level): LearnItem[] {
  return byId(decks[subject].items, level.items);
}

export function levelNewWords(subject: Subject, level: Level): LearnItem[] {
  return byId(decks[subject].items, level.newWords);
}

export function levelSentences(subject: Subject, level: Level): Sentence[] {
  return byId(sentenceDecks[subject]?.sentences ?? [], level.sentences);
}

export function levelMaze(level: Level): MazeLevel | undefined {
  return mazes.find((m) => m.id === level.maze);
}

/** Đuôi id của màn gộp cả đảo (`en-match-all`): kết quả chơi màn này không gắn với màn thật nào. */
export const ISLAND_LEVEL_SUFFIX = '-all';

/** Toàn bộ nội dung một trò của đảo (lối vào tạm khi chưa có bản đồ vùng): gộp mọi màn cùng trò, không trùng. */
export function islandContent(subject: Subject, game: GameKind, list: Region[] = regions[subject]): Level {
  const levels = list.flatMap((r) => r.levels).filter((l) => l.game === game);
  const uniq = (key: 'items' | 'newWords' | 'sentences' | 'kana') => [...new Set(levels.flatMap((l) => l[key] ?? []))];
  const all: Level = { id: `${subject}-${game}${ISLAND_LEVEL_SUFFIX}`, game };
  if (levels.some((l) => l.items)) all.items = uniq('items');
  if (levels.some((l) => l.newWords)) all.newWords = uniq('newWords');
  if (levels.some((l) => l.sentences)) all.sentences = uniq('sentences');
  if (levels.some((l) => l.kana)) all.kana = uniq('kana');
  const maze = islandMazes(subject, list)[0];
  if (maze) all.maze = maze;
  // Trò dùng từ vựng mà đảo chưa có màn nào: dùng cả bộ từ của đảo.
  if (levels.length === 0 && ITEM_GAMES.includes(game)) all.items = decks[subject].items.map((i) => i.id);
  return all;
}

/** Mọi mê cung của đảo theo thứ tự màn: lối vào tạm chơi lần lượt từng mê cung (CC-25). */
export function islandMazes(subject: Subject, list: Region[] = regions[subject]): string[] {
  return list.flatMap((r) => r.levels).flatMap((l) => (l.maze ? [l.maze] : []));
}
