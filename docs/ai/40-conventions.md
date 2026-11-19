# study-gaming: Quy ước viết code

> Viết ngày 2026-11-17 từ code hiện có. Thứ tự ưu tiên khi viết: file đang sửa → file cùng thư mục → tài liệu này →
> `50-stack-patterns.md`. Tool kiểm: ESLint + Prettier + vue-tsc + Vitest + Playwright, chạy trong CI (`.github/workflows/ci.yml`).

## 0. File để copy

| Muốn viết | Copy theo | Vì nó cho thấy |
|---|---|---|
| Luật một trò chơi | `apps/game/src/games/rain/RainGame.ts` | Class TS thuần, nhận `Rng` để test, `tick(dt)` trả sự kiện, không đụng DOM |
| Màn chơi Vue | `apps/game/src/games/match/MatchView.vue` | `<script setup lang="ts">` trước `<template>`, `speaker.say`, `settings`, `ResultPanel`, `data-testid` |
| Trò DOM có Đèn Pin và `finish` | `apps/game/src/games/listen/ListenView.vue` | Nhận `deck` + `level`, nút `*-hint` gọi `useHint()`, phát `finish` với `LevelResult` (`games/result.ts`) |
| Kéo-thả (chuột + ngón tay) | `apps/game/src/games/sentence/SentenceView.vue` + `games/drag.ts` | `useDrag`: Pointer Events, ô thả `data-drop`, chạm nhẹ = chọn, `touch-action: none` |
| Vẽ trên SVG | `apps/game/src/games/kana/KanaView.vue` | Pointer Events trên khung SVG, đổi toạ độ bằng `getBoundingClientRect`, nút ẩn cho bàn phím |
| Thêm một trò | `apps/game/src/games/registry.ts` | Một dòng `GameInfo` với `defineAsyncComponent`; trò chỉ dùng cho một số môn thì sửa `gameAllowed` (`packages/content/src/regions.ts`) |
| Cảnh Phaser | `apps/game/src/games/rain/RainScene.ts` | Chỉ vẽ theo trạng thái; canvas theo devicePixelRatio; `/* v8 ignore file -- lý do */` |
| Cấu hình theo nhóm tuổi | `apps/game/src/games/ageConfig.ts` | `Record<AgeGroup, …>` |
| Hàm nội dung dùng chung | `packages/content/src/answer.ts` | Hàm thuần, JSDoc tiếng Việt |
| Unit test logic | `apps/game/src/games/rain/RainGame.test.ts` | `seededRng`, tên test tiếng Việt mô tả hành vi |
| Test màn Vue | `apps/game/src/games/listen/ListenView.test.ts` | `vi.mock('../../audio')` bằng `test/audioMock.ts`, kiểm lời đọc, `finish`, Đèn Pin; trò có Phaser thì mock cảnh như `star/StarView.test.ts` |
| E2E | `apps/game/e2e/play.spec.ts` | `data-testid`, `muteSpeech`, ảnh chụp `shot()`, chạy khổ máy tính + điện thoại |
| Test Python | `tools/tts/test_generate.py` | `unittest`, thư mục tạm, `mock.patch` cho ffmpeg |

## 1. Đặt tên và bố cục

- File Vue: `PascalCase.vue`, đuôi `View` cho màn (`HomeView.vue`, `MatchView.vue`).
- File TS: `camelCase.ts`; class luật trò chơi `PascalCase.ts` (`MatchGame.ts`). Test đặt cạnh file: `*.test.ts`.
- Mỗi trò một thư mục `apps/game/src/games/<trò>/` gồm luật (`<Trò>Game.ts`), màn (`<Trò>View.vue`), (cảnh Phaser `<Trò>Scene.ts`),
  test đặt cạnh. Tên thư mục là `GameKind` (`star`, `maze`…).
- Mã bài học: `<môn>-<slug>` (`ja-mizu`, `it-cpu`).
- Tên file, thư mục, route / URL, nhánh, slug: tiếng Anh, `kebab-case` cho tài liệu và thư mục (`docs/content-authoring.md`,
  `.kiro/specs/mvp-games/`), không dùng tiếng Việt kể cả không dấu (`AGENTS.md` mục 6). Slug từ tiếng Nhật giữ romaji (`ja-mizu`).

## 2. TypeScript

- Strict, `noUncheckedIndexedAccess`, `verbatimModuleSyntax` (`tsconfig.base.json`): import kiểu bằng `import type`/`type`.
- Không `any`. Dùng `!` chỉ khi đã chắc (chủ yếu trong test).
- Kiểu dùng chung giữa game, công cụ và máy chủ đặt ở `packages/content/src/types.ts`.

## 3. Vue

- `<script setup lang="ts">`, sau đó `<template>`, rồi `<style scoped>`.
- Trạng thái game không phản ứng (class) để trong `shallowRef`, bản sao phản ứng cho giao diện (xem `RainView.vue`, biến `hud`).
- Mọi phần tử test cần chọn có `data-testid`.
- Màu và khoảng cách dùng biến CSS trong `apps/game/src/style.css` (`--sea`, `--ink`, `--paper`…). Nút chạm tối thiểu 44–48px.
- Chữ ngoại ngữ có thuộc tính `lang` (`:lang="deck.termLang"`, `lang="ja"`).

## 4. Giọng đọc

- Không gọi `speechSynthesis` hay `new Audio` trực tiếp trong màn: luôn qua `speaker.say([...])` (`src/audio/index.ts`).
- Lời hướng dẫn / phản hồi của Tomo: `viSegment(phrases.x)`; dòng dịch nội dung: `translationSegment(...)`; từ đang học: `termSegment(deck, item)`.
- Câu cố định mới thêm vào `packages/content/src/phrases.ts` để công cụ tạo sẵn âm thanh.
- Gỡ một component đang đọc thì `speaker.stop()` trong `onBeforeUnmount`; câu đọc ngay sau khi đổi màn phải chờ `nextTick`
  (thẻ cũ gỡ sẽ gọi stop).

## 5. Comment và chữ

- Comment tiếng Việt, chỉ ghi ràng buộc / lý do code không tự nói được. Không kể lại thay đổi.
- Chữ giao diện tiếng Việt, câu ngắn. Lời giải thích không quá khoảng 15 giây đọc.

## 6. Test

- Vitest (jsdom) cho `apps/game`, Vitest (node) cho `packages/content`, `unittest` cho `tools/tts`, Playwright cho E2E.
- Độ phủ: `pnpm -r test:coverage`; file bị đổi phải 100% dòng.
- Tên test tiếng Việt, mô tả hành vi ("gõ đúng từ trên hạt mưa thì được điểm").
- Test thứ tự đọc dùng `mock.invocationCallOrder` (xem `games.test.ts`).

## 7. Format và lint

- Prettier (`.prettierrc.json`): nháy đơn, 120 cột, dấu phẩy cuối. `pnpm format`.
- ESLint flat config (`eslint.config.js`): `eslint-plugin-vue` essential + `@vue/eslint-config-typescript` recommended.
- Thư mục cấu hình AI (`.agents`, `.claude`, `.cursor`, `.kiro`, `.github/agents|skills|hooks`, `.codex`) không lint, không format.

## 8. Git

Xem `AGENTS.md` mục 8 và [docs/workflow.md](../workflow.md).
