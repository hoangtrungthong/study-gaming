# Kế hoạch triển khai — Bản mẫu giai đoạn 0 (giai-doan-0-ban-mau)

Nhánh `feat/giai-doan-0-ban-mau` (PR #1, đã merge). Thứ tự theo phụ thuộc: nội dung → luật chơi → giọng đọc → màn → offline → E2E.

- [x] 1. Khung dự án: pnpm workspace, TypeScript strict, ESLint, Prettier, CI
- [x] 2. `packages/content`
  - [x] 2.1 Kiểu dữ liệu, bộ bài mẫu en / ja / it, `validateDeck`; test
  - [x] 2.2 Chấm đáp án: Latin, tiếng Nhật (Hepburn + `nn`, katakana, `ー`), xem trước romaji; test
  - [x] 2.3 Câu đọc (`cardSegments`, `translationSegment`, `phrases`, `collectSpeech`), xuất danh sách câu; test
- [x] 3. Luật chơi: `MatchGame`, `RainGame`, cấu hình nhóm tuổi; test
- [x] 4. Giọng đọc: `Speaker`, `browserBackend` (file → giọng máy dự phòng), manifest; test
- [x] 5. Màn: trang chủ, đảo, Ghép Đôi, Mưa Chữ (Phaser lazy), thẻ kiến thức, kết quả, cài đặt; test giao diện
- [x] 6. Offline: PWA, precache, âm thanh CacheFirst + Range, tải sẵn âm thanh, banner bản mới; test
- [x] 7. Công cụ `tools/tts` (VieNeu, VOICEVOX, Kokoro, AAC, tên file theo cấu hình giọng); unittest
- [x] 8. E2E Playwright: Ghép Đôi, Mưa Chữ (en, ja), cài đặt, offline — máy tính + điện thoại
- [x] 9. Tài liệu: README, `AGENTS.md`, `docs/ai/`, hướng dẫn, danh sách giọng VOICEVOX
- [x] 10. DoD (`docs/dod/giai-doan-0-ban-mau_2026-11-17.md`), review 3 vòng + phản biện, bảo mật
- [ ] 11. Tạo âm thanh thật và nghe so sánh giọng tiếng Anh (Q-17) — chờ đủ dung lượng ổ đĩa (~5 GB)
