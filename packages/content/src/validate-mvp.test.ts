import { describe, expect, it } from 'vitest';
import { decks } from './decks';
import { mazes, sentenceDecks } from './regions';
import { validateKanaStrokes, validateMaze, validateRegions, validateSentence } from './validate';
import type { MazeLevel, Region, Sentence } from './types';

describe('validateSentence', () => {
  const ok: Sentence = { id: 'en-s-a', chunks: ['I', 'like', 'apples'], textVi: 'Tôi thích táo.' };

  it('câu hợp lệ không có lỗi; câu thật hợp lệ', () => {
    expect(validateSentence('en', ok)).toEqual([]);
    for (const s of ['en', 'ja'] as const) {
      for (const sentence of sentenceDecks[s]!.sentences) expect(validateSentence(s, sentence)).toEqual([]);
    }
  });

  it('báo từng lỗi', () => {
    const errors = validateSentence('en', {
      id: 'x',
      chunks: [' '],
      textVi: '',
      readings: ['a', 'b'],
      accept: [['I', 'eat']],
      distractors: [' '],
    });
    expect(errors).toEqual([
      'en/x: id câu phải bắt đầu bằng "en-s-"',
      'en/x: câu cần ít nhất 2 khối',
      'en/x: có khối rỗng',
      'en/x: thiếu textVi',
      'en/x: readings phải có đúng số khối',
      'en/x: readings chỉ dùng cho tiếng Nhật',
      'en/x: accept phải dùng đúng các khối của câu',
      'en/x: khối nhiễu " " trùng khối của câu',
    ]);
  });

  it('tiếng Nhật: khối có kanji phải có reading', () => {
    expect(validateSentence('ja', { id: 'ja-s-a', chunks: ['水を', 'のみます'], textVi: 'Uống nước.' })).toEqual([
      'ja/ja-s-a: khối "水を" có kanji phải có reading',
    ]);
    expect(
      validateSentence('ja', {
        id: 'ja-s-b',
        chunks: ['水を', 'のみます'],
        readings: ['みずを', null],
        textVi: 'Uống nước.',
        accept: [['のみます', '水を']],
      }),
    ).toEqual([]);
  });
});

describe('validateMaze', () => {
  const base: MazeLevel = {
    id: 'm',
    grid: ['S..#', '##.#', '##H#', '####'],
    dir: '>',
    blocks: ['forward', 'left', 'right'],
    maxBlocks: 6,
    optimal: 5,
    hintVi: 'x',
  };

  it('mê cung thật và mê cung mẫu hợp lệ', () => {
    expect(validateMaze(base)).toEqual([]);
    for (const m of mazes) expect(validateMaze(m)).toEqual([]);
  });

  it('lưới sai hình, sai ký hiệu, thiếu / thừa S H', () => {
    expect(validateMaze({ ...base, grid: ['S.', 'H'] })).toEqual(['maze/m: lưới phải là hình chữ nhật']);
    expect(validateMaze({ ...base, grid: [] })).toEqual(['maze/m: lưới phải là hình chữ nhật']);
    expect(validateMaze({ ...base, grid: ['SxSH'] })).toEqual([
      'maze/m: lưới chỉ dùng # . S H',
      'maze/m: cần đúng một S',
    ]);
    expect(validateMaze({ ...base, grid: ['S..H', '...H'] })).toEqual(['maze/m: cần đúng một H']);
  });

  it('không tới được nhà', () => {
    expect(validateMaze({ ...base, grid: ['S#H'] })).toEqual(['maze/m: Bit không tới được nhà']);
  });

  it('không lặp: optimal phải đúng lời giải ngắn nhất và vừa maxBlocks', () => {
    expect(validateMaze({ ...base, optimal: 4 })).toEqual(['maze/m: optimal phải là 5 (lời giải ngắn nhất)']);
    expect(validateMaze({ ...base, maxBlocks: 4, optimal: 5 })).toEqual([
      'maze/m: optimal lớn hơn maxBlocks',
      'maze/m: lời giải ngắn nhất (5) vượt maxBlocks',
    ]);
  });

  it('có lặp: optimal phải bằng chương trình ngắn nhất có lặp; cần solution đưa về nhà, đúng optimal', () => {
    const loop: MazeLevel = { ...mazes.find((m) => m.id === 'it-m-02')! };
    expect(validateMaze({ ...loop, solution: undefined })).toEqual([
      'maze/it-m-02: mê cung có khối lặp phải có solution',
    ]);
    expect(validateMaze({ ...loop, solution: [{ kind: 'forward' }] })).toEqual([
      'maze/it-m-02: solution không đưa Bit về nhà',
      'maze/it-m-02: optimal phải bằng số khối của solution',
    ]);
    expect(validateMaze({ ...loop, optimal: 6 })).toEqual([
      'maze/it-m-02: optimal phải là 5 (lời giải ngắn nhất)',
      'maze/it-m-02: optimal phải bằng số khối của solution',
    ]);
    // Lời giải mẫu dài hơn chương trình ngắn nhất (lỗi cũ của it-m-05: 8 khối trong khi lặp 3 lần chỉ cần 6).
    const square: MazeLevel = { ...mazes.find((m) => m.id === 'it-m-05')! };
    const four = { kind: 'repeat' as const, times: 4, body: [{ kind: 'forward' as const }] };
    expect(
      validateMaze({
        ...square,
        maxBlocks: 9,
        optimal: 8,
        solution: [four, { kind: 'right' }, four, { kind: 'right' }, four],
      }),
    ).toEqual(['maze/it-m-05: optimal phải là 6 (lời giải ngắn nhất)']);
  });
});

describe('validateKanaStrokes', () => {
  it('hợp lệ và các lỗi', () => {
    expect(
      validateKanaStrokes({
        char: 'い',
        romaji: 'i',
        strokes: [
          [
            [10, 10],
            [20, 90],
          ],
        ],
      }),
    ).toEqual([]);
    expect(validateKanaStrokes({ char: 'あ', romaji: ' ', strokes: [] })).toEqual([
      'kana/あ: không có nét',
      'kana/あ: thiếu romaji',
    ]);
    expect(
      validateKanaStrokes({
        char: 'う',
        romaji: 'u',
        strokes: [
          [[1, 1]],
          [
            [0, 0],
            [120, 5],
          ],
        ],
      }),
    ).toEqual(['kana/う: nét 1 cần ít nhất 2 điểm', 'kana/う: nét 2 ra ngoài khung']);
  });
});

describe('validateRegions', () => {
  const content = { decks, sentenceDecks, mazes };
  const region = (over: Partial<Region> = {}): Region => ({
    id: 'en-r1',
    subject: 'en',
    order: 1,
    titleVi: 'Vùng',
    titleTarget: 'Region',
    levels: [{ id: 'en-r1-l1', game: 'match', items: ['en-apple'] }],
    ...over,
  });

  it('vùng hợp lệ', () => {
    expect(validateRegions('en', [region()], content)).toEqual([]);
  });

  it('báo lỗi vùng: trùng id, sai môn, sai id, thiếu tên', () => {
    const r = region({ subject: 'ja', titleVi: '', levels: [] });
    expect(validateRegions('en', [r, { ...region({ order: 2 }), levels: [] }], content)).toEqual([
      'en/en-r1: subject phải là en',
      'en/en-r1: thiếu tên vùng',
      'en/en-r1: trùng id',
      'en/en-r1: id vùng phải là "en-r2"',
    ]);
  });

  it('báo lỗi màn: trùng id, sai tiền tố, trò không hợp môn, nội dung không tồn tại, màn trống', () => {
    const errors = validateRegions(
      'en',
      [
        region({
          levels: [
            { id: 'en-r1-l1', game: 'maze', maze: 'khong-co' },
            { id: 'en-r1-l1', game: 'sentence', sentences: ['khong-co'] },
            { id: 'x-l1', game: 'match', items: ['khong-co'], newWords: ['khong-co-2'] },
            { id: 'en-r1-l4', game: 'kana' },
            { id: 'en-r1-l5', game: 'listen' },
          ],
        }),
      ],
      content,
    );
    expect(errors).toEqual([
      'en/en-r1-l1: trò maze không dùng cho môn en',
      'en/en-r1-l1: mê cung "khong-co" không tồn tại',
      'en/en-r1-l1: trùng id',
      'en/en-r1-l1: câu "khong-co" không tồn tại',
      'en/x-l1: id màn phải bắt đầu bằng "en-r1-l"',
      'en/x-l1: từ "khong-co" không tồn tại',
      'en/x-l1: từ mới "khong-co-2" không tồn tại',
      'en/en-r1-l4: trò kana không dùng cho môn en',
      'en/en-r1-l4: màn kana chưa có nội dung',
      'en/en-r1-l5: màn listen chưa có nội dung',
    ]);
  });

  it('kana phải có dữ liệu nét khi có danh sách nét', () => {
    const ja = region({
      id: 'ja-r1',
      subject: 'ja',
      levels: [{ id: 'ja-r1-l1', game: 'kana', kana: ['あ', 'い'] }],
    });
    expect(validateRegions('ja', [ja], { ...content, kanaChars: new Set(['あ']) })).toEqual([
      'ja/ja-r1-l1: kana "い" chưa có dữ liệu nét',
    ]);
    expect(validateRegions('ja', [ja], content)).toEqual([]);
  });
});
