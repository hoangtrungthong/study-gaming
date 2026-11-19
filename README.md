# Tomo và Quần đảo Tri Thức (tên tạm)

Game học **tiếng Anh, tiếng Nhật và IT** cho mọi lứa tuổi, chơi trên app điện thoại và trình duyệt (điện thoại, máy tính).
Người chơi cùng chú robot Tomo đi qua ba hòn đảo; mỗi màn là một trò chơi ngắn 1–3 phút.

- **Nghe thay vì đọc:** mọi lời giải thích đều được đọc thành tiếng, chữ chỉ là phụ đề.
- **Song ngữ:** nội dung có ngôn ngữ đang học kèm tiếng Việt; kanji có cách đọc và âm Hán Việt.
- **Chơi không cần mạng** sau lần mở đầu tiên.
- **Ba nhóm tuổi:** 🌱 Mầm (5–8), 🌿 Chồi (9–14), 🌳 Cây (15+) — khác tốc độ, số lượng, cỡ chữ.

Kịch bản đầy đủ và các quyết định đã chốt: [docs/game-design.md](docs/game-design.md).

## Trạng thái

**Giai đoạn 0 — bản mẫu** (xem [báo cáo DoD](docs/dod/phase-0-prototype_2026-11-17.md)):

| Đã có                                                                                | Chưa có                                                       |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| Trò **Ghép Đôi** (nối từ với nghĩa) và **Mưa Chữ** (gõ từ trên hạt mưa) cho cả 3 đảo | Âm thanh tạo sẵn (đang dùng giọng có sẵn trên máy)            |
| Thẻ kiến thức song ngữ có đọc to, phụ đề tô sáng                                     | Các trò khác trong kịch bản (mục 5)                           |
| Gõ tiếng Nhật bằng bộ gõ hoặc romaji                                                 | Máy chủ, tài khoản, quảng cáo, gói bỏ quảng cáo (giai đoạn 1) |
| Cài đặt: nhóm tuổi, tốc độ đọc, ẩn tiếng Việt, chọn giọng                            | Bản app Android/iOS (Capacitor)                               |
| PWA chơi offline, thông báo khi có bản mới                                           |                                                               |
| Công cụ tạo sẵn âm thanh (VieNeu-TTS, VOICEVOX, Kokoro)                              |                                                               |

## Bắt đầu nhanh

Cần **Node 22** và **pnpm 11** (Python 3.12 nếu dùng công cụ âm thanh).

```bash
git clone https://github.com/hoangtrungthong/study-gaming.git
cd study-gaming
pnpm install
git config core.hooksPath .githooks   # bật git hook của dự án (một lần)
pnpm dev                              # mở http://localhost:5173
```

## Lệnh

| Việc                                                          | Lệnh                                                                               |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Chạy thử                                                      | `pnpm dev`                                                                         |
| Lint · format                                                 | `pnpm lint` · `pnpm format:check` (sửa: `pnpm format`)                             |
| Kiểm kiểu                                                     | `pnpm typecheck`                                                                   |
| Unit test · độ phủ                                            | `pnpm test` · `pnpm -r test:coverage`                                              |
| Build (web + service worker)                                  | `pnpm build` → `apps/game/dist`                                                    |
| E2E (Playwright, máy tính + điện thoại, có kịch bản mất mạng) | `pnpm e2e` (lần đầu: `pnpm --filter @study/game exec playwright install chromium`) |
| Xuất danh sách câu cần đọc                                    | `pnpm speech-list`                                                                 |
| Tạo âm thanh                                                  | `cd tools/tts && python generate.py` — xem [docs/audio.md](docs/audio.md)          |

## Cấu trúc

```
apps/game/          Game: Vue 3 + Phaser 4 + Vite, PWA
  src/games/        Mỗi trò một thư mục: luật (TS thuần) + màn (Vue) + cảnh Phaser
  src/audio/        Bộ đọc: phát file tạo sẵn, dự phòng giọng của máy, bộ nhớ đệm offline
  src/views/        Trang chủ, đảo, cài đặt
  e2e/              Test Playwright
packages/content/   Nội dung bài học (data/*.json), chấm đáp án, danh sách câu đọc
tools/tts/          Python: tạo sẵn file âm thanh, ghi apps/game/public/audio/manifest.json
docs/               Kịch bản, tài liệu, báo cáo DoD
```

Bản đồ code chi tiết: [docs/ai/00-overview.md](docs/ai/00-overview.md).

## Tài liệu

| Tài liệu                                               | Nội dung                                                                     |
| ------------------------------------------------------ | ---------------------------------------------------------------------------- |
| [AGENTS.md](AGENTS.md)                                 | **Rule của dự án** (cho người và mọi công cụ AI)                             |
| [docs/README.md](docs/README.md)                       | Danh mục toàn bộ tài liệu                                                    |
| [docs/game-design.md](docs/game-design.md)             | Kịch bản, nhân vật, trò chơi, lộ trình, quyết định đã chốt và câu hỏi còn mở |
| [docs/content-authoring.md](docs/content-authoring.md) | Cách thêm / sửa bài học                                                      |
| [docs/audio.md](docs/audio.md)                         | Giọng đọc và công cụ tạo âm thanh                                            |
| [docs/testing.md](docs/testing.md)                     | Cách test và tiêu chuẩn xong việc                                            |
| [docs/workflow.md](docs/workflow.md)                   | Nhánh, commit, PR, review                                                    |

## Công cụ AI đi kèm

- Rule chung: `AGENTS.md`; `CLAUDE.md`, `.cursor/rules/project.mdc`, `.github/copilot-instructions.md`,
  `.kiro/steering/project.md` trỏ về đó.
- Skill thiết kế (impeccable, design, ui-ux-pro-max…) cho Claude Code, Codex, Cursor, Kiro, Copilot; skill `dod-report`
  (checklist xong việc của dự án).
- 40 agent chuyên môn chọn từ [agency-agents](https://github.com/msitarzewski/agency-agents) (MIT, commit `8ae6164`;
  giấy phép ở `.claude/agents/AGENCY-AGENTS-LICENSE.txt`).

## Giấy phép bên thứ ba

| Thành phần                                    | Giấy phép                                                                                  |
| --------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Phaser, Vue, Vite, wanakana                   | MIT                                                                                        |
| Phông Noto Sans, Noto Sans JP (`@fontsource`) | SIL OFL 1.1                                                                                |
| VieNeu-TTS, Kokoro-82M                        | Apache-2.0                                                                                 |
| Giọng VOICEVOX                                | Theo từng nhân vật, bắt buộc ghi công — [docs/voicevox-voices.md](docs/voicevox-voices.md) |
