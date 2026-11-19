# Giai đoạn 0: bản mẫu Ghép Đôi + Mưa Chữ

Sửa lần 3: 2026-11-17 (sửa nốt lỗi Medium, review bổ sung, tài liệu và rule dự án). Feature, theo `docs/game-design.md` mục 11 (giai đoạn 0) và
mục 5.1 (G1), 5.2 (W2). Repo mới, chưa có commit nào; mọi thay đổi đang ở thư mục làm việc, chưa có nhánh.

## Đã làm

- Monorepo pnpm: `apps/game` (Vue 3 + Phaser 4 + Vite + PWA), `packages/content` (nội dung, chấm đáp án, danh sách câu đọc).
- Nội dung mẫu song ngữ: tiếng Anh 16 từ, tiếng Nhật 16 từ (kanji có cách đọc かな và âm Hán Việt), IT 20 từ (có 4 từ về đám mây).
- Ghép Đôi: 3/4/5 cặp theo nhóm tuổi, chấm 1–3 sao, chạm vào từ là nghe từ đó, ghép đúng thì hiện thẻ kiến thức và
  tự đọc to (cả cặp cuối, rồi đến lời khen).
- Mưa Chữ: Phaser vẽ hạt mưa (canvas theo mật độ điểm ảnh), ô gõ HTML (dùng được bộ gõ tiếng Việt / tiếng Nhật của
  máy), gõ romaji kiểu bộ gõ (`nn`) hoặc Hepburn đều được, 3 chế độ (từ gốc / nghĩa / chỉ nghe), tổng kết đọc lại các
  từ bị lỡ (mỗi từ một lần). Nhóm Mầm không hiện đồng hồ.
- Giọng đọc: phát file tạo sẵn theo `audio/manifest.json`; file không phát được thì đọc bằng giọng của máy. Tắt tiếng
  Việt chỉ bỏ dòng dịch, lời hướng dẫn vẫn đọc. Chọn giọng theo ngôn ngữ, tốc độ đọc, ghi công VOICEVOX ở Cài đặt.
- Chơi không cần mạng: service worker lưu sẵn 261 file (game, phông Noto Sans / Noto Sans JP, âm thanh m4a/ogg/wav).
- `tools/tts/generate.py`: tạo sẵn âm thanh AAC `.m4a` bằng VieNeu-TTS, VOICEVOX, Kokoro; bỏ qua file đã có (mọi định
  dạng); ghi qua file tạm để ffmpeg lỗi không để lại file hỏng; ghi manifest.
- Danh sách giọng VOICEVOX đã kiểm điều khoản: `docs/voicevox-voices.md`.
- Cấu hình AI: skill/hook chép từ medicine-management, skill `dod-report` viết lại cho dự án, 40 agent từ agency-agents,
  git hook trong `.githooks/`, CI `.github/workflows/ci.yml`.

## Checklist

| # | Mục | Kết quả | Bằng chứng / thiếu gì |
|---|---|---|---|
| 1 | Đúng yêu cầu | Chưa đạt | G1 và W2 cho 3 môn, chạy offline trên web: có code và test. **Chưa tạo âm thanh thật** (ổ C không đủ chỗ cài mô hình, người dùng chọn làm sau), nên chưa nghe so sánh giọng tiếng Anh (Q-17) và chưa đo dung lượng âm thanh |
| 2 | Test xanh | Đạt | `pnpm -r test:coverage`: content 35 passed, game 81 passed, 0 failed. `python -m unittest` (tools/tts): 13 tests OK. Không có skip |
| 2a | Độ phủ 100% file bị đổi | Đạt | content 100% dòng, game 100% dòng. Bỏ đo có lý do: `src/main.ts` (điểm khởi động) và `src/games/rain/RainScene.ts` (vẽ Phaser, không chạy trong jsdom), cả hai được E2E phủ |
| 2b | Lint, typecheck | Đạt | `pnpm lint`, `pnpm typecheck`, `pnpm format:check` sạch |
| 3 | Chơi không cần mạng | Đạt | `e2e/offline.spec.ts` xanh ở máy tính và điện thoại. `test_every_clip_format_is_precached_for_offline` chặn việc quên đưa định dạng âm thanh vào precache (đã thử: bỏ `m4a` thì test đỏ) |
| 4 | Song ngữ, giọng đọc | Đạt | Thẻ đọc theo `cardSegments`; dòng dịch gắn cờ `translation`; file lỗi chuyển sang giọng máy (`speaker.test.ts`). `pnpm speech-list` ra 200 câu. **Đang dùng giọng của máy**, chưa chạy `tools/tts` |
| 5 | Nhóm tuổi | Đạt | Cấu hình từng nhóm có test; E2E chọn Mầm thì còn 3 cặp; Mầm tốc độ đọc 0.8×, không đồng hồ |
| 6 | Nội dung bài học | Đạt | `validateDeck` sạch cho 3 bộ; nội dung tự soạn; emoji không trùng trong bộ IT |
| 7 | Quảng cáo, mua bán | Không đổi | Giai đoạn 0 không có quảng cáo và phần mua |
| 8 | Dữ liệu trẻ em, bảo mật | Đạt | Không có máy chủ, không gửi dữ liệu ra ngoài; cài đặt chỉ lưu `localStorage`; reviewer bảo mật không có finding Critical/High |
| 9 | Cấu hình, build | Đạt | `pnpm build` thoát 0, 0 cảnh báo; không có biến môi trường mới; cách chạy và tạo âm thanh ở `README.md` |
| 10 | Chạy thật, E2E | Đạt | `pnpm e2e`: 12 passed (6 kịch bản × máy tính 1280×800 + Pixel 7); đã xem ảnh chụp các màn |
| 11 | Tài liệu | Đạt | `README.md`, rule `AGENTS.md` (+ `CLAUDE.md`, Cursor, Copilot, Kiro trỏ về), `docs/README.md`, `docs/ai/00-overview.md`, `40-conventions.md`, `50-stack-patterns.md`, `docs/content-authoring.md`, `audio.md`, `testing.md`, `workflow.md`, `voicevox-voices.md`, kịch bản v0.7 |
| 12 | Self review | Đạt | Tự sửa trước review: 5 lỗi giao diện/giọng đọc, 1 lỗi dựng cảnh Phaser sau khi thoát màn, 2 lỗi trong test |
| 13 | Review + phản biện | Đạt | 3 vòng (bảng dưới). Không còn finding Critical/High mở. Bản sửa của vòng 3 có test chặn tái phát (đã thử: bỏ bản sửa thì test đỏ) |
| 14 | Bảo mật | Đạt | Reviewer riêng chiều bảo mật trong vòng 1: 0 Critical/High |
| 15 | CI xanh | Chưa đạt | Repo chưa có commit, chưa có remote: chờ CI |

## Review

| Vòng | Phạm vi | Critical | High | Medium | Low | Bị phản biện bác |
|---|---|---|---|---|---|---|
| 1 | Toàn bộ bản mẫu, 5 chiều | 0 | 3 | 15 | 15 | 0/3 (cả 3 High đều 3/3 STANDS) |
| 2 | Các bản sửa của vòng 1 | 0 | 1 | 3 | 6 | 0/1 (3/3 STANDS) |
| 3 | Các bản sửa của vòng 2 | 0 | 1 | 0 | 2 | Tự đọc lại code xác nhận |
| Bổ sung | Sửa nốt các Medium còn lại (chế độ nghe, bàn phím iOS, focus, cập nhật PWA, âm thanh offline Safari) | 0 | 0 | 1 | 3 | Đã sửa cả 4, có test |

High đã sửa: chấm romaji `nn` sai (vòng 1); iOS cũ không phát được Ogg mà không có giọng dự phòng (vòng 1); cặp cuối Ghép
Đôi không được đọc (vòng 1); `.m4a` không được precache (vòng 2); lời khen cuối màn bị cắt khi tắt tự đọc (vòng 3).

## Còn lại

- Tạo âm thanh thật: cần khoảng 5 GB trống trên ổ C (VieNeu, Kokoro + PyTorch, Docker image VOICEVOX). Sau đó nghe so
  sánh tiếng Anh VieNeu / Kokoro để chốt Q-17.
- Safari/iOS khi offline có thể không phát được file âm thanh từ precache (cần hỗ trợ Range request) — game sẽ chuyển
  sang giọng của máy. Cần thử trên iPhone thật khi có file âm thanh.
- Các Medium trước đây đã sửa: chế độ "Chỉ nghe" gộp mọi câu của một khung hình thành một lượt; ô gõ luôn có sẵn và được
  focus ngay trong lần chạm (iOS); focus về tiêu đề khi đổi màn, vào khung kết quả khi xong; banner "Đã có bản mới" thay vì
  tự tải lại; âm thanh dùng bộ nhớ đệm có hỗ trợ Range, tự tải sẵn và dọn file cũ, tên file đổi theo cấu hình giọng.
- Cần thử trên máy thật: bàn phím iOS, âm thanh Safari khi offline.
- CI (mục 15) chạy khi có remote.
