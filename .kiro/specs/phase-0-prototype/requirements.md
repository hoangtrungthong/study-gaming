# Tài liệu yêu cầu — Bản mẫu giai đoạn 0 (phase-0-prototype)

> Viết bổ sung ngày 2026-11-18 sau khi làm xong (PR #1, commit merge `47b275e`), để bản mẫu có hồ sơ theo quy trình spec.

## Giới thiệu

Giai đoạn 0 của kịch bản (`docs/game-design.md` mục 11): thử cảm giác chơi, giọng đọc, gõ tiếng Nhật trên điện thoại,
chơi không cần mạng, trước khi làm MVP. Repo mới, chưa có code trước đó.

### Quyết định đã thống nhất (ràng buộc đầu vào)

1. Hai trò: **Ghép Đôi** (G1) và **Mưa Chữ** (W2), cho cả ba đảo (tiếng Anh, tiếng Nhật, IT).
2. Công nghệ: Vue 3 + Phaser, đóng gói Capacitor sau, bản web là PWA (Q-1, Q-28).
3. Phải chơi được khi không có mạng.
4. Giọng máy, tạo sẵn file âm thanh: tiếng Việt VieNeu-TTS, tiếng Nhật VOICEVOX (chỉ giọng miễn phí), tiếng Anh nghe so
   sánh VieNeu và Kokoro rồi chốt (Q-17, Q-18).
5. Gõ tiếng Nhật nhận cả bộ gõ và romaji.
6. Mọi giải thích được đọc thành tiếng; người dùng chọn được giọng (Q-23).
7. Ba nhóm tuổi Mầm / Chồi / Cây.

### Chờ chốt

- Q-17: giọng tiếng Anh (VieNeu hay Kokoro) — cần tạo âm thanh thật để nghe, đang chờ đủ dung lượng ổ đĩa.

## Yêu cầu

### Yêu cầu 1 — Ghép Đôi
1. Số cặp theo nhóm tuổi (Mầm 3, Chồi 4, Cây 5). Chọn từ rồi chọn nghĩa; đúng thì đánh dấu, sai thì rung và nhắc.
2. Ghép đúng hiện thẻ kiến thức song ngữ và đọc to; cặp cuối đọc thẻ rồi đọc lời khen.
3. Chấm 1–3 sao theo số lần sai; chơi lại, về đảo.

### Yêu cầu 2 — Mưa Chữ
1. Hạt mưa mang từ rơi xuống, gõ đúng thì vỡ; chạm đất thì mất một chậu hoa và ghi vào danh sách bị lỡ.
2. Ba chế độ: từ gốc, nghĩa tiếng Việt, chỉ nghe. Nhóm Mầm mặc định hiện nghĩa, không đồng hồ.
3. Kết thúc khi hết giờ hoặc hết chậu hoa; tổng kết đọc lại từ bị lỡ (mỗi từ một lần).

### Yêu cầu 3 — Giọng đọc và song ngữ
1. Phát file tạo sẵn theo manifest; không có file hoặc phát lỗi thì dùng giọng của máy.
2. Tắt tiếng Việt chỉ bỏ dòng dịch, lời hướng dẫn vẫn đọc.
3. Công cụ `tools/tts` tạo sẵn âm thanh, ghi manifest, ghi công giọng VOICEVOX.

### Yêu cầu 4 — Chơi không cần mạng
1. Sau lần mở đầu, tắt mạng vẫn mở và chơi được (kể cả phông tiếng Nhật, cảnh Phaser tải lazy).
2. Có bản mới thì hỏi người chơi trước khi tải lại.
