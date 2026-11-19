# Tài liệu thiết kế — Bản mẫu giai đoạn 0 (phase-0-prototype)

Thiết kế chi tiết đã nằm trong bộ tài liệu dùng chung, không chép lại ở đây:

| Phần | Tài liệu |
|---|---|
| Cấu trúc, luồng màn, dữ liệu, chấm đáp án, giọng đọc, offline | [docs/ai/00-overview.md](../../../docs/ai/00-overview.md) |
| Quy ước code, file mẫu | [docs/ai/40-conventions.md](../../../docs/ai/40-conventions.md) |
| Phaser, wanakana, Workbox, Vitest, Playwright | [docs/ai/50-stack-patterns.md](../../../docs/ai/50-stack-patterns.md) |
| Định dạng bài học | [docs/content-authoring.md](../../../docs/content-authoring.md) |
| Bộ đọc, công cụ tạo âm thanh, bộ nhớ đệm âm thanh | [docs/audio.md](../../../docs/audio.md) |

## Điểm thiết kế chính

1. **Luật tách khỏi phần vẽ:** `MatchGame`, `RainGame` là class TS thuần (có `Rng` để test); `RainScene` (Phaser) chỉ vẽ.
2. **Một cổng giọng đọc:** mọi màn gọi `speaker.say(đoạn[])`; lượt mới huỷ lượt cũ; Mưa Chữ gộp mọi câu của một khung hình
   thành một lượt.
3. **Ô gõ HTML** (không phải canvas) để bộ gõ tiếng Nhật/Việt của máy hoạt động; focus đồng bộ trong lần chạm (iOS).
4. **Offline:** precache code + phông; âm thanh dùng CacheFirst có Range (Safari) và được tải sẵn khi có mạng.
5. **Nội dung dùng chung** ở `packages/content` (game, công cụ âm thanh, máy chủ sau này).
