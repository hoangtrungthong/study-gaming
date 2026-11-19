# study-gaming: Tổng quan code

> Viết ngày 2026-11-17, trước commit đầu tiên. Đây là bản đồ để đọc nhanh, không phải spec: kiểm lại code trước khi dựa
> vào chi tiết quan trọng. Lệch với code thì sửa mục đó cùng commit với code.

## 1. Cấu trúc

pnpm workspace (`pnpm-workspace.yaml`), Node 22, TypeScript 6 strict (`tsconfig.base.json`).

| Thư mục | Vai trò | Ghi chú |
|---|---|---|
| `apps/game/` | Game: Vue 3 + Phaser 4 + Vite 8, PWA (`vite-plugin-pwa`) | Sau này đóng gói Android/iOS bằng Capacitor |
| `packages/content/` | `@study/content`: kiểu dữ liệu, bộ bài, chấm đáp án, danh sách câu đọc | Không build, import thẳng `src/index.ts` |
| `tools/tts/` | Python: tạo sẵn file âm thanh, ghi `apps/game/public/audio/manifest.json` | Chạy trên máy nhóm, không chạy lúc chơi |
| `docs/` | Kịch bản, tài liệu, báo cáo DoD | |
| `apps/server/` | NestJS + PostgreSQL (giai đoạn 1) | **Chưa có** |

## 2. Luồng màn hình

`apps/game/src/App.vue` giữ biến `screen` (không dùng router): `home` → `island` → `game`, và `settings`.
Đổi màn thì focus về tiêu đề màn mới (`App.vue`, `watch(screen)`).

| Màn | File | Việc chính |
|---|---|---|
| Trang chủ (3 đảo) | `src/views/HomeView.vue` | Chọn đảo, mở cài đặt, Tomo chào |
| Đảo | `src/views/IslandView.vue` | Lối vào tạm (CC-25): các trò của đảo (`gamesFor`), mỗi trò chơi với nội dung gộp mọi màn của đảo (`islandContent`) |
| Trò chơi | `src/games/<trò>/<Trò>View.vue`, chọn qua `src/games/registry.ts` | 9 trò, mỗi trò một chunk tải lazy (`defineAsyncComponent`) |
| Cài đặt | `src/views/SettingsView.vue` | Nhóm tuổi, tự đọc, tốc độ, ẩn tiếng Việt, chọn giọng, ghi công giọng và KanjiVG |
| Kết quả | `src/components/ResultPanel.vue` | Sao, lời nhắn, chơi lại; nút "Tiếp: Viết Lại Từ" khi App `provide` bước tiếp (`components/nextStep.ts`) |

Hợp đồng chung của màn trò chơi: nhận `deck` + `level` (`Level` của `@study/content`), phát `exit` và `finish` với
`LevelResult` (`src/games/result.ts`: `stars`, `firstTry`, `wrong`, `usedHint`, `hinted?`; `levelId` bỏ trống khi id màn kết thúc
bằng `-all`, tức đang chơi cả đảo — `levelIdOf`). Sao dùng chung: `starsByMistakes` / `capForHint`; dùng Đèn Pin
(`src/games/hints.ts`, `useHint`, nút `components/HintButton.vue`) thì tối đa 2 sao.

Màn có `newWords`: xong trò chính, bảng kết quả có nút "Tiếp: Viết Lại Từ" (CK-6). Kết quả màn giữ sao trò chính, gộp
thêm từ còn sai và `usedHint` của Viết Lại Từ (`App.vue`, `onFinish`). `lastResult` là chỗ `mvp-progress` sẽ lưu.

| Mã | Trò | Thư mục `src/games/` | Ghi chú |
|---|---|---|---|
| G1 | Ghép Đôi | `match/` | |
| W2 | Mưa Chữ | `rain/` | Phaser (`RainScene.ts`); nhóm Mầm dùng `components/VirtualKeyboard.vue` |
| G2 | Hứng Sao | `star/` | Phaser (`StarScene.ts`); nút trợ năng `star-catch-<id>` thay cho kéo giỏ |
| G3 | Xếp Câu | `sentence/` | Kéo-thả Pointer Events (`drag.ts`) |
| G4 | Nghe Chọn | `listen/` | |
| G5 | Lật Thẻ Nhớ | `memory/` | |
| W1 | Viết Lại Từ | `write/` | Chế độ chép / nghe viết; số lượt `WRITE_ROUNDS` |
| J1 | Vẽ Kana | `kana/` | SVG + Pointer Events; so nét `strokeMatch.ts` |
| I1 | Đưa Bit Về Nhà | `maze/` | Khối lệnh `blocks.ts`, chương trình `MazeProgram.vue`; chạy bằng `runMaze` |

Cấu hình theo nhóm tuổi của mọi trò: `src/games/ageConfig.ts`.

## 3. Dữ liệu bài học

- Bộ bài JSON: `packages/content/data/{en,ja,it}.json`, nạp ở `packages/content/src/decks.ts`.
- Vùng và màn: `data/regions/{en,ja,it}.json`; câu: `data/sentences/{en,ja}.json`; mê cung: `data/mazes.json`;
  tra cứu ở `packages/content/src/regions.ts` (`findLevel`, `levelItems`, `levelSentences`, `levelMaze`, `islandContent`,
  `gameAllowed`).
- Nét kana: `data/kana-strokes.json` (sinh từ `vendor/kanjivg/` bằng `pnpm kana-strokes`), nạp lazy `loadKanaStrokes`
  (`src/kana.ts`) để trang chủ không phải tải.
- Chạy mê cung: `packages/content/src/maze.ts` (`parseMaze`, `runMaze`, `shortestPlainProgram`), dùng chung cho game và
  kiểm dữ liệu.
- Kiểu: `packages/content/src/types.ts`.
- Kiểm hợp lệ: `validateDeck`, `validateSentence`, `validateMaze`, `validateKanaStrokes`, `validateRegions`
  (`packages/content/src/validate.ts`), chạy trong test của `packages/content` và hook pre-commit.
- Cách viết nội dung: [docs/content-authoring.md](../content-authoring.md).

## 4. Chấm đáp án

`packages/content/src/answer.ts`:
- Tiếng Anh / IT: `normalizeLatin` (bỏ hoa thường, dấu câu, khoảng trắng thừa).
- Tiếng Nhật: `japaneseReadings` (`:44`) trả 1–2 cách đọc: romaji kiểu Hepburn và kiểu bộ gõ (`nn` = ん, `n` cuối = ん),
  katakana → hiragana, kéo dài `ー` theo nguyên âm trước (`expandLongVowels`).
- `isCorrectAnswer` (`:73`): đúng khi một cách đọc trùng một đáp án chấp nhận (`reading ?? term` + `accept`).
- `romajiPreview` (`:83`): xem trước kiểu bộ gõ khi đang gõ.

## 5. Giọng đọc

- Câu cần đọc: `cardSegments` (`packages/content/src/speech.ts:23`) theo thứ tự từ → nghĩa → Hán Việt → ví dụ → dịch → giải thích;
  câu cố định của Tomo ở `phrases.ts`. `collectSpeech` gom tất cả cho công cụ tạo âm thanh.
- Phát: `Speaker` (`apps/game/src/audio/speaker.ts:51`). Có file tạo sẵn trong manifest thì phát file
  (`browserBackend.ts`, `<audio>`); không có file hoặc phát lỗi thì đọc bằng giọng của máy (`speechSynthesis`, ưu tiên giọng
  chạy trên máy). Lượt đọc mới huỷ lượt cũ.
- Manifest: `apps/game/public/audio/manifest.json` (rỗng cho tới khi chạy `tools/tts`). Nạp ở `src/audio/index.ts`.
- Chi tiết: [docs/audio.md](../audio.md).

## 6. Chơi không cần mạng

`apps/game/vite.config.ts`:
- Precache Workbox: js, css, html, svg, png, woff2, json (`:26`). Phông Noto Sans + Noto Sans JP đóng gói qua `@fontsource`.
- Âm thanh: **không** precache; `runtimeCaching` CacheFirst có `rangeRequests` (`:29`) vì Safari tải `<audio>` bằng Range.
  `warmAudioCache` (`src/audio/offlineCache.ts`) tải sẵn mọi file trong manifest khi có mạng.
- Cập nhật: chế độ hỏi trước (`registerType: 'prompt'`), banner "Đã có bản mới" (`src/pwa.ts`, `App.vue`);
  `clientsClaim: true` để lần cài đầu chơi offline được ngay.
- E2E kiểm: `apps/game/e2e/offline.spec.ts`.

## 7. Cài đặt người chơi

`apps/game/src/settings.ts`: lưu `localStorage` khoá `tomo.settings.v1`; nhóm tuổi, tự đọc, tốc độ (0.75–1.5),
hiện tiếng Việt, giọng theo ngôn ngữ. Tốc độ mặc định theo nhóm: `DEFAULT_RATE` (`:18`).

## 8. Gotchas

- Node mặc định trên máy là 16: dùng Node 22 (`AGENTS.md` mục 4).
- Phaser không chạy trong jsdom: test giao diện mock `./rain/RainScene`, `./star/StarScene` (xem `src/games/games.test.ts`,
  `star/StarView.test.ts`).
- jsdom không có `getScreenCTM`: Vẽ Kana đổi toạ độ con trỏ bằng `getBoundingClientRect` của khung SVG.
- Một từ có thể lặp ở nhiều lượt (màn ít từ hơn số lượt): `firstTry` chỉ giữ từ chưa từng sai trong cả lượt chơi.
- Import JSON trong `packages/content` phải có `with { type: 'json' }` vì Playwright chạy file theo ESM của Node.
- Ổ C của máy dev gần đầy: cài mô hình giọng (VieNeu, Kokoro + PyTorch, VOICEVOX) cần khoảng 5 GB trống.
- `tools/tts/speech-list.json` là file sinh ra (`pnpm speech-list`), không commit.
