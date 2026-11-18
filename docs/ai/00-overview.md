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

`apps/game/src/App.vue` giữ biến `screen` (không dùng router): `home` → `island` → `match` | `rain`, và `settings`.
Đổi màn thì focus về tiêu đề màn mới (`App.vue`, `watch(screen)`).

| Màn | File | Việc chính |
|---|---|---|
| Trang chủ (3 đảo) | `src/views/HomeView.vue` | Chọn đảo, mở cài đặt, Tomo chào |
| Đảo | `src/views/IslandView.vue` | Chọn trò Ghép Đôi / Mưa Chữ |
| Ghép Đôi (G1) | `src/games/match/MatchView.vue` + luật `MatchGame.ts` | Chọn từ rồi chọn nghĩa; thẻ kiến thức `components/KnowledgeCard.vue` |
| Mưa Chữ (W2) | `src/games/rain/RainView.vue` + luật `RainGame.ts` + vẽ `RainScene.ts` (Phaser, tải lazy) | Gõ từ trên hạt mưa |
| Cài đặt | `src/views/SettingsView.vue` | Nhóm tuổi, tự đọc, tốc độ, ẩn tiếng Việt, chọn giọng, ghi công giọng |
| Kết quả | `src/components/ResultPanel.vue` | Sao, lời nhắn, chơi lại |

## 3. Dữ liệu bài học

- Bộ bài JSON: `packages/content/data/{en,ja,it}.json`, nạp ở `packages/content/src/decks.ts:6`.
- Kiểu: `LearnItem`, `Deck`, `SpeechSegment` ở `packages/content/src/types.ts`.
- Kiểm hợp lệ: `validateDeck` (`packages/content/src/validate.ts:7`), chạy trong `content.test.ts` và hook pre-commit.
- Cách viết nội dung: [docs/noi-dung-bai-hoc.md](../noi-dung-bai-hoc.md).

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
- Chi tiết: [docs/am-thanh.md](../am-thanh.md).

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
- Phaser không chạy trong jsdom: test giao diện mock `./rain/RainScene` (xem `src/games/games.test.ts`).
- Import JSON trong `packages/content` phải có `with { type: 'json' }` vì Playwright chạy file theo ESM của Node.
- Ổ C của máy dev gần đầy: cài mô hình giọng (VieNeu, Kokoro + PyTorch, VOICEVOX) cần khoảng 5 GB trống.
- `tools/tts/speech-list.json` là file sinh ra (`pnpm speech-list`), không commit.
