# Kiểm thử

## 1. Các tầng test

| Tầng | Công cụ | Ở đâu | Chạy |
|---|---|---|---|
| Logic nội dung, chấm đáp án | Vitest (node) | `packages/content/src/*.test.ts` | `pnpm --filter @study/content test` |
| Luật trò chơi, bộ đọc, cài đặt, màn Vue | Vitest (jsdom) + `@vue/test-utils` | `apps/game/src/**/*.test.ts` | `pnpm --filter @study/game test` |
| Luồng người dùng, offline | Playwright | `apps/game/e2e/*.spec.ts` | `pnpm e2e` |
| Công cụ tạo âm thanh | `unittest` | `tools/tts/test_generate.py` | `cd tools/tts && python -m unittest` |

Tất cả unit test: `pnpm test`. Độ phủ: `pnpm -r test:coverage`.

## 2. Tiêu chuẩn

- File code bị đổi phải **100% dòng**. Đang bỏ đo có lý do: `apps/game/src/main.ts` (điểm khởi động) và
  `apps/game/src/games/rain/RainScene.ts` (vẽ Phaser, không chạy trong jsdom) — cả hai được E2E phủ.
- Fix bug: test tái hiện lỗi phải đỏ trước bản sửa, xanh sau.
- Không skip, không xoá, không nới test để cho xanh.
- Lint, typecheck, build không cảnh báo.

## 3. Viết test màn Vue

- Mock bộ đọc: `vi.mock('../audio', …createAudioMock())` (`apps/game/src/test/audioMock.ts`); kiểm câu đọc qua `said`.
- Mock cảnh Phaser: `vi.mock('./rain/RainScene', …)`, giữ `RainController` để tự gọi `game.tick()` / `onEvents()`.
- Kiểm thứ tự đọc (câu không bị `stop()` cắt): so `speaker.say.mock.invocationCallOrder` với `speaker.stop.mock.invocationCallOrder`.
- Mẫu: `apps/game/src/games/games.test.ts`.

## 4. E2E

- `apps/game/playwright.config.ts`: kiểm kiểu + build thật + `vite preview` cổng 4173 (có service worker).
- Chạy ở hai khổ: máy tính 1280×800 và điện thoại (Pixel 7). Ảnh chụp lưu ở `apps/game/test-results/`;
  thay đổi giao diện phải xem ảnh ở cả hai khổ.
- `offline.spec.ts`: mở lần đầu → chờ service worker nắm quyền → tắt mạng → tải lại → chơi Mưa Chữ tiếng Nhật.
- Chưa phủ: Safari/WebKit, máy thật iOS/Android, âm thanh thật (cần thử tay).

## 5. Xong việc (DoD)

Code xong và mọi bước xanh thì chạy skill `dod-report` (`.claude/skills/dod-report/SKILL.md`): checklist 15 mục
(offline, song ngữ + giọng đọc, nhóm tuổi, nội dung, quảng cáo/mua bán, dữ liệu trẻ em, E2E, review 3 vòng có phản biện,
bảo mật, CI). Báo cáo ghi ở `docs/dod/<tên>_<ngày>.md`.
