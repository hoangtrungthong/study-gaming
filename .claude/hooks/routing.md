[study-gaming] Hook này chèn vào mọi prompt (.claude/settings.json).

Repo (pnpm workspace): `apps/game/` Vue 3 + Phaser 4 + PWA (sau này đóng gói Capacitor) · `packages/content/` nội dung bài học, chấm đáp án, danh sách câu đọc · `tools/tts/` Python tạo sẵn âm thanh (VieNeu-TTS, VOICEVOX, Kokoro) · `apps/server/` NestJS + PostgreSQL (giai đoạn 1, chưa có).
Rule đầy đủ: `AGENTS.md`. Bản đồ code: `docs/ai/00-overview.md`; quy ước: `docs/ai/40-conventions.md`, `docs/ai/50-stack-patterns.md`.
Kịch bản và mọi quyết định đã chốt: `docs/kich-ban-game.md` (mục 12). Spec tính năng ở `.kiro/specs/<tên>/` (requirements, design, tasks).

Luôn nhớ:
- Điểm người dùng chưa chọn thì hỏi lại, không tự quyết; ghi câu hỏi vào mục 12.2 của kịch bản.
- Game phải chơi được khi không có mạng. Giải thích nào cũng phải đọc được thành tiếng, có song ngữ với tiếng Việt.
- Nội dung mới: `pnpm speech-list` rồi chạy `tools/tts` để tạo âm thanh. Kanji phải có `reading` và `hanViet`.
- Lệnh chạy ở gốc repo, Node 22 (`/c/Users/thonght/AppData/Local/nvm/v22.22.2`): `pnpm lint` · `pnpm typecheck` · `pnpm test` · `pnpm build` · `pnpm e2e`.
- Code xong và test xanh thì chạy skill `dod-report` trước khi hỏi commit.
- Commit / push chỉ khi người dùng bảo. Làm trên nhánh `feat/…`, `fix/…`, `chore/…` rồi mở PR vào `main`. Không commit / push thẳng vào `main`.
