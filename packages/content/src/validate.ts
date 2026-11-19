import { isKanaOnly, primaryAnswer } from './answer';
import { countBlocks, parseMaze, runMaze, shortestProgram } from './maze';
import { gameAllowed } from './regions';
import type { Deck, KanaStrokes, MazeLevel, Region, Sentence, SentenceDeck, Subject } from './types';

const KANJI = /[一-龯㐀-䶿]/;

/** Trả về danh sách lỗi của một bộ bài; rỗng là hợp lệ. */
export function validateDeck(deck: Deck): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();

  if (deck.items.length < 6) errors.push(`${deck.subject}: cần ít nhất 6 từ cho một màn Ghép Đôi`);

  for (const item of deck.items) {
    const where = `${deck.subject}/${item.id}`;
    if (ids.has(item.id)) errors.push(`${where}: trùng id`);
    ids.add(item.id);
    if (!item.id.startsWith(`${deck.subject}-`)) errors.push(`${where}: id phải bắt đầu bằng "${deck.subject}-"`);
    for (const field of ['term', 'emoji', 'meaningVi'] as const) {
      if (!item[field]?.trim()) errors.push(`${where}: thiếu ${field}`);
    }
    if (Boolean(item.example) !== Boolean(item.exampleVi)) {
      errors.push(`${where}: example và exampleVi phải đi cùng nhau`);
    }

    if (deck.subject === 'ja') {
      const hasKanji = KANJI.test(item.term);
      if (hasKanji && !item.reading) errors.push(`${where}: từ có kanji phải có reading bằng かな`);
      if (hasKanji && !item.hanViet) errors.push(`${where}: từ có kanji phải có hanViet`);
      if (!isKanaOnly(primaryAnswer(item))) errors.push(`${where}: đáp án phải chỉ gồm かな/カナ`);
    } else if (item.reading || item.hanViet) {
      errors.push(`${where}: reading/hanViet chỉ dùng cho tiếng Nhật`);
    }
  }
  return errors;
}

/** Kiểm một câu Xếp Câu. */
export function validateSentence(subject: Subject, s: Sentence): string[] {
  const where = `${subject}/${s.id}`;
  const errors: string[] = [];
  if (!s.id.startsWith(`${subject}-s-`)) errors.push(`${where}: id câu phải bắt đầu bằng "${subject}-s-"`);
  if (s.chunks.length < 2) errors.push(`${where}: câu cần ít nhất 2 khối`);
  if (s.chunks.some((c) => !c.trim())) errors.push(`${where}: có khối rỗng`);
  if (!s.textVi?.trim()) errors.push(`${where}: thiếu textVi`);
  if (s.readings && s.readings.length !== s.chunks.length) errors.push(`${where}: readings phải có đúng số khối`);
  if (subject === 'ja') {
    s.chunks.forEach((c, i) => {
      if (KANJI.test(c) && !s.readings?.[i]) errors.push(`${where}: khối "${c}" có kanji phải có reading`);
    });
  } else if (s.readings) {
    errors.push(`${where}: readings chỉ dùng cho tiếng Nhật`);
  }
  const sorted = [...s.chunks].sort().join('|');
  for (const order of s.accept ?? []) {
    if ([...order].sort().join('|') !== sorted) errors.push(`${where}: accept phải dùng đúng các khối của câu`);
  }
  for (const d of s.distractors ?? []) {
    if (s.chunks.includes(d)) errors.push(`${where}: khối nhiễu "${d}" trùng khối của câu`);
  }
  return errors;
}

/** Kiểm một mê cung: lưới hợp lệ, tới được nhà, `optimal` đúng bằng chương trình ngắn nhất (có tính khối lặp một tầng). */
export function validateMaze(maze: MazeLevel): string[] {
  const where = `maze/${maze.id}`;
  const errors: string[] = [];
  const width = maze.grid[0]?.length ?? 0;
  if (maze.grid.length === 0 || maze.grid.some((row) => row.length !== width)) {
    return [`${where}: lưới phải là hình chữ nhật`];
  }
  const cells = maze.grid.join('');
  if ([...cells].some((c) => !'#.SH'.includes(c))) errors.push(`${where}: lưới chỉ dùng # . S H`);
  if ((cells.match(/S/g) ?? []).length !== 1) errors.push(`${where}: cần đúng một S`);
  if ((cells.match(/H/g) ?? []).length !== 1) errors.push(`${where}: cần đúng một H`);
  if (errors.length > 0) return errors;

  const map = parseMaze(maze);
  const best = shortestProgram(map, maze.blocks);
  if (best === null) return [`${where}: Bit không tới được nhà`];
  if (maze.optimal > maze.maxBlocks) errors.push(`${where}: optimal lớn hơn maxBlocks`);
  if (maze.optimal !== best.blocks) errors.push(`${where}: optimal phải là ${best.blocks} (lời giải ngắn nhất)`);
  if (best.blocks > maze.maxBlocks) errors.push(`${where}: lời giải ngắn nhất (${best.blocks}) vượt maxBlocks`);

  if (maze.blocks.includes('repeat')) {
    if (!maze.solution) return [...errors, `${where}: mê cung có khối lặp phải có solution`];
    if (runMaze(map, maze.solution).outcome !== 'home') errors.push(`${where}: solution không đưa Bit về nhà`);
    if (countBlocks(maze.solution) !== maze.optimal) errors.push(`${where}: optimal phải bằng số khối của solution`);
  }
  return errors;
}

/** Kiểm nét kana: mỗi nét ít nhất 2 điểm, toạ độ trong khung 0–109. */
export function validateKanaStrokes(k: KanaStrokes): string[] {
  const where = `kana/${k.char}`;
  const errors: string[] = [];
  if (k.strokes.length === 0) errors.push(`${where}: không có nét`);
  if (!k.romaji.trim()) errors.push(`${where}: thiếu romaji`);
  k.strokes.forEach((stroke, i) => {
    if (stroke.length < 2) errors.push(`${where}: nét ${i + 1} cần ít nhất 2 điểm`);
    if (stroke.some(([x, y]) => x < 0 || y < 0 || x > 109 || y > 109))
      errors.push(`${where}: nét ${i + 1} ra ngoài khung`);
  });
  return errors;
}

export interface RegionContent {
  decks: Record<Subject, Deck>;
  sentenceDecks: Partial<Record<Subject, SentenceDeck>>;
  mazes: MazeLevel[];
  /** Chữ kana có dữ liệu nét; bỏ trống khi chưa có dữ liệu nét. */
  kanaChars?: Set<string>;
}

/** Kiểm các vùng của một môn và mọi màn trỏ tới nội dung có thật. */
export function validateRegions(subject: Subject, list: Region[], content: RegionContent): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  const itemIds = new Set(content.decks[subject].items.map((i) => i.id));
  const sentenceIds = new Set((content.sentenceDecks[subject]?.sentences ?? []).map((s) => s.id));
  const mazeIds = new Set(content.mazes.map((m) => m.id));
  const missing = (where: string, kind: string, wanted: string[] | undefined, have: Set<string>) => {
    for (const id of wanted ?? []) if (!have.has(id)) errors.push(`${where}: ${kind} "${id}" không tồn tại`);
  };

  for (const region of list) {
    const where = `${subject}/${region.id}`;
    if (ids.has(region.id)) errors.push(`${where}: trùng id`);
    ids.add(region.id);
    if (region.subject !== subject) errors.push(`${where}: subject phải là ${subject}`);
    if (region.id !== `${subject}-r${region.order}`)
      errors.push(`${where}: id vùng phải là "${subject}-r${region.order}"`);
    if (!region.titleVi?.trim() || !region.titleTarget?.trim()) errors.push(`${where}: thiếu tên vùng`);

    for (const level of region.levels) {
      const lw = `${subject}/${level.id}`;
      if (ids.has(level.id)) errors.push(`${lw}: trùng id`);
      ids.add(level.id);
      if (!level.id.startsWith(`${region.id}-l`)) errors.push(`${lw}: id màn phải bắt đầu bằng "${region.id}-l"`);
      if (!gameAllowed(level.game, subject)) errors.push(`${lw}: trò ${level.game} không dùng cho môn ${subject}`);
      missing(lw, 'từ', level.items, itemIds);
      missing(lw, 'từ mới', level.newWords, itemIds);
      missing(lw, 'câu', level.sentences, sentenceIds);
      if (level.maze && !mazeIds.has(level.maze)) errors.push(`${lw}: mê cung "${level.maze}" không tồn tại`);
      if (content.kanaChars) {
        for (const k of level.kana ?? []) {
          if (!content.kanaChars.has(k)) errors.push(`${lw}: kana "${k}" chưa có dữ liệu nét`);
        }
      }
      const need: Record<string, boolean> = {
        sentence: !level.sentences?.length,
        kana: !level.kana?.length,
        maze: !level.maze,
      };
      if (need[level.game] ?? !level.items?.length) errors.push(`${lw}: màn ${level.game} chưa có nội dung`);
    }
  }
  return errors;
}

/** Số vùng mỗi đảo, số màn mỗi vùng, số từ mới tối đa mỗi màn (Req 1.2: CC-1, CC-2, CK-11). */
export const REGION_SHAPE = { regions: 2, levels: 6, newWords: 5 } as const;

/**
 * Kiểm khuôn của đảo: đúng 2 vùng, mỗi vùng 6 màn, mỗi màn tối đa 5 từ mới, từ mới nằm trong `items` của màn (khi màn có
 * `items`), và màn Viết Lại Từ chỉ hỏi từ đã là từ mới ở màn đó hoặc màn trước.
 */
export function validateRegionShape(subject: Subject, list: Region[]): string[] {
  const errors: string[] = [];
  if (list.length !== REGION_SHAPE.regions) errors.push(`${subject}: cần đúng ${REGION_SHAPE.regions} vùng`);
  const taught = new Set<string>();
  for (const region of list) {
    if (region.levels.length !== REGION_SHAPE.levels) {
      errors.push(`${subject}/${region.id}: cần đúng ${REGION_SHAPE.levels} màn`);
    }
    for (const level of region.levels) {
      const lw = `${subject}/${level.id}`;
      const newWords = level.newWords ?? [];
      if (newWords.length > REGION_SHAPE.newWords) errors.push(`${lw}: tối đa ${REGION_SHAPE.newWords} từ mới`);
      for (const id of level.items ? newWords : []) {
        if (!level.items!.includes(id)) errors.push(`${lw}: từ mới "${id}" phải có trong items`);
      }
      newWords.forEach((id) => taught.add(id));
      if (level.game !== 'write') continue;
      for (const id of level.items ?? []) {
        if (!taught.has(id)) errors.push(`${lw}: Viết Lại Từ hỏi "${id}" khi chưa dạy ở màn nào trước đó`);
      }
    }
  }
  return errors;
}
