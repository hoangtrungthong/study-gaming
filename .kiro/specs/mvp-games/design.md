# Tài liệu thiết kế — Các trò chơi của MVP (mvp-games)

> **Cập nhật 2026-11-18:** chủ sản phẩm đồng ý toàn bộ đề xuất — mọi chỗ ghi `(CC-n)` / `[CC-x]` / "Chặn bởi CC-n" nay là **đã chốt** theo đề xuất, trừ các điểm gắn nhãn **Còn mở** ở `requirements.md` (xem `../mvp-open-questions.md`).

> Mọi chỗ gắn **[CC-x]** là **đề xuất** theo danh sách "Chờ chốt" ở `requirements.md`, chưa phải quyết định. Chốt khác đi thì
> sửa mục tương ứng ở đây trước khi code phần đó.

## Tổng quan

```
packages/content                     apps/game/src/games
  data/regions/{en,ja,it}.json  ──►    registry.ts (GameKind → màn Vue lazy, tên, biểu tượng)
  data/sentences/{en,ja}.json         star/      StarGame.ts  StarScene.ts (Phaser)  StarView.vue     G2
  data/kana-strokes.json              sentence/  SentenceGame.ts                     SentenceView.vue G3
  data/mazes.json                     listen/    ListenGame.ts                       ListenView.vue   G4
  src/types.ts  validate.ts           memory/    MemoryGame.ts                       MemoryView.vue   G5
  src/speech.ts phrases.ts            write/     WriteGame.ts                        WriteView.vue    W1
  src/regions.ts (nạp + tra cứu)      kana/      strokeMatch.ts KanaTrace.ts         KanaView.vue     J1
  scripts/build-kana-strokes.ts       maze/      MazeGame.ts (thông dịch khối lệnh)  MazeView.vue     I1
                                      drag.ts    useDrag (Pointer Events)            [CC-12]
                                      result.ts  LevelResult + tính sao chung        [CC-24]
                                      ../components/VirtualKeyboard.vue              [CC-19]
```

Nguyên tắc giữ như giai đoạn 0 (`docs/ai/40-conventions.md` mục 0): luật = class TS thuần có test, không đụng DOM; màn Vue
giữ class trong `shallowRef` + bản sao phản ứng; chỉ G2 dùng Phaser [CC-11]; mọi lời đọc qua `speaker.say`.

## Mô hình dữ liệu (`packages/content/src/types.ts`)

```ts
export type GameKind = 'match' | 'rain' | 'star' | 'sentence' | 'listen' | 'memory' | 'write' | 'kana' | 'maze';

export interface Region {            // [CC-1, CC-4]
  id: string;                        // 'ja-r1'
  subject: Subject;
  order: number;                     // 1, 2
  titleVi: string;                   // 'Cổng Torii'
  titleTarget: string;               // '鳥居'
  levels: Level[];                   // số màn theo [CC-2]
}

export interface Level {
  id: string;                        // 'ja-r1-l3'
  game: GameKind;
  items?: string[];                  // id LearnItem (G1, G2, G4, G5, W1, W2)
  sentences?: string[];              // id Sentence (G3, G4 câu)
  kana?: string[];                   // ký tự kana (J1)
  maze?: string;                     // id MazeLevel (I1)
  newWords?: string[];               // có thì nối W1 sau trò chính [CC-5]
}

export interface Sentence {          // [CC-7]
  id: string;                        // 'en-s-like-apples'
  chunks: string[];                  // ['I', 'like', 'green', 'apples']
  readings?: (string | null)[];      // tiếng Nhật: かな của từng khối có kanji
  textVi: string;
  emoji?: string;
  accept?: string[][];               // thứ tự khác cũng đúng
  distractors?: string[];            // khối nhiễu (Cây) [CC-16]
}

export interface KanaStrokes {       // [CC-8]
  char: string;                      // 'あ'
  romaji: string;                    // 'a'
  strokes: [number, number][][];     // mỗi nét là dãy điểm đã lấy mẫu, toạ độ 0–109
}

export type BlockKind = 'forward' | 'left' | 'right' | 'repeat';
export interface MazeLevel {         // [CC-20, CC-21]
  id: string;                        // 'it-m-01'
  grid: string[];                    // '#' tường · '.' đường · 'S' Bit · 'H' nhà
  dir: '^' | '>' | 'v' | '<';        // hướng xuất phát của Bit (trường riêng, lưới chỉ dùng # . S H)
  blocks: BlockKind[];
  maxBlocks: number;
  optimal: number;                   // validateMaze tự tìm lời giải ngắn nhất không lặp để kiểm
  solution?: Block[];                // bắt buộc khi có 'repeat': lời giải mẫu, đếm đúng bằng optimal
  hintVi: string;
}
```

- Tệp: `data/regions/{en,ja,it}.json`, `data/sentences/{en,ja}.json` [CC-6: IT chưa có câu], `data/mazes.json`,
  `data/kana-strokes.json` (sinh bởi script, giữ header giấy phép nguồn [CC-8, CC-27]). `LearnItem` của 2 vùng nằm tiếp trong
  `data/{en,ja,it}.json` (giữ `Deck` cũ, `decks.ts:6` không đổi).
- `regions.ts`: nạp JSON (`with { type: 'json' }`), hàm `levelContent(level)` trả `LearnItem[]` / `Sentence[]` / … đã tra id;
  `kana-strokes.json` **không** import ở `index.ts` mà nạp lazy từ `KanaView` (`await import`) để trang chủ không phải tải.
- `validate.ts`: thêm `validateRegions`, `validateSentence`, `validateMaze` (BFS trên trạng thái `(x, y, hướng, số khối)` với
  bộ khối của màn; kiểm giải được trong `maxBlocks` và lời giải ngắn nhất = `optimal`), `validateKanaStrokes` (mọi kana trong
  vùng Nhật có nét, mỗi nét ≥ 2 điểm, trong khung). Chạy trong `content.test.ts` (hook pre-commit đang chạy test này).
- `speech.ts`: `sentenceSegments(deck, s)` = câu gốc (`termLang`, tiếng Nhật đọc theo かな) + `translationSegment(textVi)`;
  `kanaSegment(k)` = `{ lang: 'ja', text: k.char }`; `collectSpeech` gom thêm câu, kana, `hintVi`, câu cố định mới.
- `phrases.ts` thêm câu cố định (ví dụ): `starIntro`, `starWrong`, `sentenceIntro`, `sentenceWrong`, `listenIntro`,
  `memoryIntro`, `writeIntro`, `writeHintFirst`, `writeHintAll`, `kanaIntro`, `kanaStrokeWrong`, `mazeIntro`, `mazeWall`,
  `mazeNotHome`, `mazeTooMany`, tên khối (`blockForward`…). Mỗi câu ≤ ~15 giây đọc.

## Luật từng trò (class TS thuần)

| Class | Trạng thái chính | Hàm | Ghi chú |
|---|---|---|---|
| `StarGame` | `round`, `prompt: LearnItem`, `stars[]` (x, y, item), `basketX`, `mistakes` | `tick(dt)` → sự kiện `spawn/caught/wrong/lost/round/over`; `moveBasket(x)` | Giống `RainGame`: thời gian giới hạn 100 ms/khung; số liệu `STAR_CONFIG[age]` [CC-13] |
| `SentenceGame` | `current`, `slots: (chunk\|null)[]`, `tray` | `place(chunkIdx, slot)`, `remove(slot)`, `submit()` → `{ ok, wrongSlots }` | So khớp thứ tự chuẩn + `accept` [CC-7, CC-16] |
| `ListenGame` | `round`, `answer`, `options`, `disabled` | `choose(id)` → `correct/wrong/ignored` | Nhiễu lấy cùng vùng, không trùng emoji [CC-14] |
| `MemoryGame` | `cards[]` (id, cặp, mặt), `faceUp`, `matched`, `flips` | `flip(idx)` → `first/match/mismatch/ignored`; `hideMismatch()` | Thời gian úp lại do màn hẹn giờ [CC-15] |
| `WriteGame` | `index`, `level`, `cells[]` (ok/wrong/empty), `misses`, `hint` | `input(text, composing)`, `next()` | Tiếng Nhật đổi romaji → かな bằng `japaneseReadings`; gợi ý ở lần sai 2, 3 [CC-17, CC-18] |
| `KanaTrace` + `strokeMatch` | `char`, `strokeIndex`, `mistakes` | `submitStroke(points)` → `ok/wrong`; `strokeMatch(user, ref, tol)` hàm thuần | Lấy mẫu 16 điểm, kiểm đầu / cuối / khoảng cách TB [CC-10] |
| `MazeGame` | `program: Block[]`, `bit (x, y, dir)`, `runs` | `run()` → dãy bước `{ blockPath, x, y, dir, result }`; `reset()` | Thông dịch tách khỏi hoạt ảnh: màn phát lại các bước theo nhịp [CC-20] |

- `result.ts`: `LevelResult` [CC-24] (thêm `usedHint`: dùng Đèn Pin thì tối đa 2 sao) và `starsByMistakes(mistakes, total, usedHint)` dùng chung (3 khi 0 lỗi, 2 khi ≤ 2 hoặc ≤ 20% số mục,
  còn lại 1 — đề xuất, chốt cùng CC-13..16); `ageConfig.ts` thêm `STAR_CONFIG`, `SENTENCE_CONFIG`, `LISTEN_CONFIG`,
  `MEMORY_CONFIG`, `WRITE_CONFIG` (mức mặc định), `KANA_CONFIG` (ngưỡng), `MAZE_CONFIG` dạng `Record<AgeGroup, …>`.

## Màn hình

- **Lối vào [CC-25]:** `IslandView` hiện danh sách trò lấy từ `registry.ts` lọc theo môn (`kana` chỉ `ja`, `maze` chỉ `it`);
  `App.vue` dùng `<component :is="gameInfo(game).view" :deck :level @exit @finish>` (`defineAsyncComponent`, mỗi trò một
  chunk; `load()` dùng chung promise để App chờ chunk rồi đưa focus vào tiêu đề trò). App **luôn truyền `level`**: lối vào
  tạm truyền `islandContent` (id đuôi `ISLAND_LEVEL_SUFFIX`, kết quả không gắn `levelId` — `levelIdOf`). Ghép Đôi / Mưa Chữ
  vẫn nhận `level?` (từ trước MVP), các trò mới bắt buộc `level`. Mê cung chơi lần lượt `islandMazes(subject)`; thắng thì
  bảng kết quả có nút "Tiếp: Mê cung sau". `mvp-progress` sau này truyền màn thật và nghe `finish`.
- **Nối W1 [CC-5, CK-6]:** màn có `newWords` → khi trò chính phát `finish`, `App.vue` giữ kết quả và `provide` bước tiếp
  (`components/nextStep.ts`); `ResultPanel` hiện nút chính "Tiếp: Viết Lại Từ". Bấm thì mở `WriteView` với các từ đó;
  xong thì gộp `LevelResult`: sao của trò chính (tối đa 2 khi một trong hai bên dùng Đèn Pin), `wrong` hợp hai bên,
  `usedHint` hoặc của hai bên. Viết Lại Từ chỉ hỏi từ mới có trong `firstTry ∪ wrong ∪ hinted` của lượt chính; không có thì hỏi mọi
  từ mới của màn. Nút Đèn Pin dùng chung `components/HintButton.vue`: hiện số còn lại; hết thì mờ (`aria-disabled`) nhưng vẫn bấm được để Tomo
  nói "hết Đèn Pin"; `disabled` thật chỉ khi lúc đó không có gì để gợi ý. Từ làm đúng nhờ Đèn Pin báo ở `LevelResult.hinted`
  và cũng được hỏi lại ở Viết Lại Từ.
- **G2 `StarView` + `StarScene`:** khung chơi Phaser như `RainScene` (canvas × devicePixelRatio, `ResizeObserver`, tải lazy,
  kiểm còn sống sau `await`). Giỏ kéo bằng pointer trên canvas, phím ← → ở `window`. Danh sách sao đang rơi cũng có ở
  `<ul class="sr-only">` (như `RainView.vue`) để E2E và trình đọc màn hình đọc được.
- **G3 `SentenceView`:** hàng chỗ trống + khay khối (nút). `useDrag` cho kéo; chạm khối → chọn, chạm chỗ → đặt.
- **G4 `ListenView`:** nút 🔊 lớn + lưới lựa chọn; đúng thì `KnowledgeCard`.
- **G5 `MemoryView`:** lưới nút thẻ (tối đa 4×4), lật bằng CSS transform; `aria-label` "Thẻ úp số 3" / nội dung khi ngửa.
- **W1 `WriteView`:** hàng ô chữ, hình, ô `<input>` ẩn nhận bộ gõ (focus trong lần chạm), xem trước romaji (`romajiPreview`);
  Mầm: `VirtualKeyboard` (phím = các chữ khác nhau của đáp án, xáo trộn [CC-19]), không bật bàn phím máy (`inputmode="none"`).
  Có `visualViewport` resize để co vùng chơi khi bàn phím máy bật (kịch bản 10.6).
- **J1 `KanaView`:** `<svg viewBox="0 0 109 109">`: chữ mờ (các nét chuẩn), nét đã đúng (đậm), mũi tên + chấm đầu của nét kế,
  nét đang vẽ (`polyline` theo pointer). `touch-action: none`, `setPointerCapture`, toạ độ đổi bằng `getBoundingClientRect` của SVG (jsdom không có `getScreenCTM`).
  Hoạt ảnh thứ tự nét bằng `stroke-dasharray`. Không dùng Phaser [CC-11].
- **I1 `MazeView`:** lưới CSS grid (ô 48px+), Bit là emoji xoay theo hướng, khay khối + vùng chương trình (khối 🔁 có ô số lần
  và vùng con). Phát lại các bước của `MazeGame.run()` mỗi 400 ms (Mầm 600 ms), đọc tên khối đang chạy.
- **Ghi công:** nếu chọn KanjiVG [CC-8], `SettingsView` thêm dòng "Dữ liệu nét chữ: KanjiVG (CC BY-SA 3.0), kanjivg.tagaini.net"
  cạnh ghi công VOICEVOX.

## Giọng đọc

| Lúc | Đoạn đọc |
|---|---|
| Vào trò | `viSegment(phrases.<trò>Intro)` |
| Đề G2 | `translationSegment(item.meaningVi)`; ẩn tiếng Việt → `termSegment` không đọc, chỉ emoji + `viSegment(phrases.starFindPicture)` |
| Đề G4 | `termSegment` hoặc câu gốc |
| Đúng | `cardSegments` (G4, G5) / `sentenceSegments` (G3) / `termSegment + translationSegment` (G2) |
| Sai | `viSegment(phrases.<trò>Wrong)` + đọc lại đề |
| W1 | `translationSegment(meaningVi)` → `termSegment`; sai: `termSegment` ở tốc độ × 0,8 (thêm tham số tốc độ cho một lượt `say`, `speaker.ts:65`); xong: từ + ví dụ |
| J1 | `kanaSegment` + từ ví dụ; sai nét: `viSegment(phrases.kanaStrokeWrong)` |
| I1 | tên khối khi chạy, `viSegment(phrases.mazeWall)` … |

`Speaker.say` cần thêm tuỳ chọn tốc độ riêng cho một lượt (đọc chậm hơn ở W1); đổi `speaker.ts` kèm test.

## Chơi không cần mạng

- Chunk lazy của từng trò và JSON nội dung nằm trong `globPatterns` hiện có (`vite.config.ts:26`), không cần đổi cấu hình.
- Âm thanh mới đi theo đường cũ: `pnpm speech-list` → `tools/tts` → manifest; chưa có file thì giọng máy.
- E2E `offline.spec.ts` thêm bước mở một trò lazy (ví dụ J1) khi đã tắt mạng.

## Kiểm thử

| Loại | Nội dung |
|---|---|
| Vitest `packages/content` | `validate*` (mỗi nhánh lỗi), BFS mê cung, `sentenceSegments`, `kanaSegment`, `collectSpeech` có câu mới, nội dung thật hợp lệ, script kana (đầu vào SVG mẫu nhỏ) |
| Vitest luật | Mỗi class: đường đúng, sai, gợi ý, kết thúc, sao, `seededRng`; `strokeMatch` với nét chuẩn / ngược hướng / lệch; `MazeGame` đụng tường, lặp, quá `maxBlocks` |
| Vitest màn (jsdom) | Mock `../audio` (`test/audioMock.ts`), mock `StarScene`; kiểm thứ tự đọc (`invocationCallOrder`), ẩn tiếng Việt, Mầm dùng bàn phím ảo, chạm-chọn-chạm-đặt, `finish` phát `LevelResult`, `speaker.stop` khi gỡ |
| Playwright (desktop + phone) | Mỗi trò một luồng thắng + một lần sai; kéo bằng `locator.dragTo` và đường chạm-chạm; J1 vẽ bằng `page.mouse` theo nét chuẩn đổi ra toạ độ màn hình (helper đọc `kana-strokes.json` + `boundingBox`); I1 xếp khối và chạy; ảnh chụp `shot()` cả hai khổ; offline mở một trò mới |
| Độ phủ | File đổi 100% dòng (`pnpm coverage:changed`); `StarScene.ts` `/* v8 ignore file -- vẽ Phaser */`, phủ bằng E2E |

## Rủi ro

- **Giấy phép dữ liệu nét** (CC BY-SA ShareAlike) — chờ CC-8 trước khi đưa dữ liệu vào repo.
- **Chấm nét quá khắt khe / quá dễ** với trẻ nhỏ — ngưỡng nằm trong `KANA_CONFIG`, chỉnh sau khi thử với nhóm thử nghiệm.
- **Kéo-thả trên iOS Safari** (cuộn trang khi kéo) — `touch-action: none` trên vùng kéo + E2E project phone; vẫn cần thử máy thật.
- **Khối lượng nội dung** 2 vùng × 3 đảo phụ thuộc CC-3 (Q-4); code không chờ nội dung đủ, chỉ cần mỗi trò có dữ liệu mẫu hợp lệ.
- **Bàn phím máy che vùng chơi** ở W1 trên điện thoại — dùng `visualViewport`; kiểm ảnh chụp khổ phone.
