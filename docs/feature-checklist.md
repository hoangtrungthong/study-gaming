# Đối chiếu kịch bản game với code

Nguồn yêu cầu: [game-design.md](game-design.md). Cập nhật khi xong một tính năng (cùng commit với code).

Trạng thái: ✅ đã làm · ⚠️ làm một phần · ⏳ chưa làm (ghi giai đoạn dự kiến theo mục 11 của kịch bản).

## Trò chơi (kịch bản mục 5)

| Mã | Trò | Trạng thái | Nơi triển khai |
|---|---|---|---|
| G1 | Ghép Đôi | ✅ | `apps/game/src/games/match/` (`MatchGame.ts`, `MatchView.vue`) |
| G2 | Hứng Sao | ✅ | `apps/game/src/games/star/` (`StarGame.ts`, `StarView.vue`, `StarScene.ts`) |
| G3 | Xếp Câu | ✅ | `apps/game/src/games/sentence/` (`SentenceGame.ts`, `SentenceView.vue`, kéo-thả `games/drag.ts`) |
| G4 | Nghe Chọn | ✅ | `apps/game/src/games/listen/` (`ListenGame.ts`, `ListenView.vue`) |
| G5 | Lật Thẻ Nhớ | ✅ | `apps/game/src/games/memory/` (`MemoryGame.ts`, `MemoryView.vue`) |
| G6 | Ai Nói Gì | ⏳ giai đoạn 2 | |
| G7 | Đúng / Sai Siêu Tốc | ⏳ giai đoạn 2 | |
| G8 | Điền Chỗ Trống | ⏳ giai đoạn 2 | |
| W1 | Viết Lại Từ | ✅ (chế độ nghe viết có sẵn trong luật, chưa gắn nhóm tuổi) | `apps/game/src/games/write/` (`WriteGame.ts`, `WriteView.vue`); nối sau màn có từ mới ở `App.vue` |
| W2 | Mưa Chữ (3 chế độ: từ gốc / nghĩa / chỉ nghe) | ✅ | `apps/game/src/games/rain/` (`RainGame.ts`, `RainView.vue`, `RainScene.ts`) |
| J1 | Vẽ Kana | ✅ | `apps/game/src/games/kana/` (`KanaTrace.ts`, `strokeMatch.ts`, `KanaView.vue`); nét `packages/content/data/kana-strokes.json` |
| J2 | Tiệm Bánh Ông Haru | ⏳ giai đoạn 2 | |
| J3 | Ghép Bộ Kanji | ⏳ giai đoạn 2 | |
| E1–E3 | Thư Viện Bay, Đọc Theo Tomo, Truyện Nghe Chọn Nhánh | ⏳ giai đoạn 2 (E2 chấm phát âm: chờ Q-7) | |
| I1 | Đưa Bit Về Nhà (khối lệnh) | ✅ | `apps/game/src/games/maze/` (`MazeGame.ts`, `MazeView.vue`, `MazeProgram.vue`); chạy `packages/content/src/maze.ts` |
| I2–I7 | Đèn Nhị Phân, Săn Bọ, Phòng Lắp Máy, Dọn Kho, Gửi Thư Qua Mạng, Từ Điển IT | ⏳ giai đoạn 2 | |
| I8–I9 | Xây Thành Phố Mây, Phòng Thi Thử (chứng chỉ đám mây) | ⏳ chờ Q-30 | |
| — | Màn trùm cuối vùng | ⏳ giai đoạn 2 | |

## Học và giọng đọc (mục 4, 6)

| Yêu cầu | Trạng thái | Nơi triển khai |
|---|---|---|
| Ba nhóm tuổi (tốc độ, số lượng, cỡ chữ, Mầm không đồng hồ) | ✅ | `apps/game/src/games/ageConfig.ts`, `settings.ts` |
| Thẻ kiến thức song ngữ, đọc to, phụ đề tô sáng | ✅ | `apps/game/src/components/KnowledgeCard.vue`, `cardSegments` (`packages/content/src/speech.ts`) |
| Ẩn tiếng Việt (chỉ bỏ dòng dịch, lời Tomo vẫn đọc) | ✅ | `translationSegment`, `Speaker` (`skipTranslations`) |
| Chọn giọng theo ngôn ngữ, tốc độ đọc | ✅ | `apps/game/src/views/SettingsView.vue` |
| Gõ tiếng Nhật bằng bộ gõ hoặc romaji (Hepburn và `nn`) | ✅ | `packages/content/src/answer.ts` |
| Kanji kèm cách đọc và âm Hán Việt | ✅ | `packages/content/data/ja.json`, `validateDeck` |
| Âm thanh tạo sẵn (VieNeu, VOICEVOX, Kokoro) | ⚠️ | Công cụ xong (`tools/tts/`); **chưa tạo file** (cần ~5 GB trống) — đang dùng giọng của máy |
| Giọng tiếng Anh: VieNeu hay Kokoro | ⏳ chờ nghe so sánh (Q-17) | |
| Ghi công giọng VOICEVOX | ✅ | Màn Cài đặt; [voicevox-voices.md](voicevox-voices.md) |
| Karaoke tô sáng từng chữ | ⏳ | Hiện tô theo đoạn; cần mốc thời gian từ bộ đọc |

## Nội dung (mục 7)

| Yêu cầu | Trạng thái | Ghi chú |
|---|---|---|
| Bộ mẫu 3 đảo | ✅ | en 45, ja 40, it 41 từ; câu en 23, ja 26; 6 mê cung (bản nháp AI, chờ chủ dự án duyệt — CC-3) |
| 2 vùng × 6 màn mỗi đảo (MVP) | ✅ | `packages/content/data/regions/`; vào chơi tạm theo đảo (CC-25) cho tới `mvp-progress` |
| Đủ vùng 1–8 mỗi đảo | ⏳ | Chờ Q-4 (ai soạn, có bám CEFR/JLPT) |
| Nhánh chứng chỉ AWS / Google Cloud (vùng 9, 10) | ⏳ chờ Q-30 | 4 thẻ đám mây mẫu trong `it.json` |

## Tiến độ và phần thưởng (mục 9)

| Yêu cầu | Trạng thái |
|---|---|
| Sao 1–3 mỗi màn | ✅ (cả 9 trò; dùng Đèn Pin thì tối đa 2 sao) |
| Đèn Pin (gợi ý) trong mọi trò | ⚠️ | Nút và hành vi từng trò xong (`games/hints.ts`); kho Đèn Pin chưa lưu (chờ `mvp-progress`) |
| Lưu tiến độ, chuỗi ngày, ôn tập lặp lại ngắt quãng | ⏳ MVP / giai đoạn 2 |
| Nhà của Tomo, bộ sưu tập, huy hiệu | ⏳ giai đoạn 2 |
| Góc phụ huynh | ⏳ giai đoạn 2 |

## Nền tảng (mục 10)

| Yêu cầu | Trạng thái | Nơi triển khai |
|---|---|---|
| Web PWA, chơi offline | ✅ | `apps/game/vite.config.ts`, `e2e/offline.spec.ts` |
| Âm thanh offline trên Safari (Range) | ⚠️ | Đã làm (`runtimeCaching` + `offlineCache.ts`); chưa thử trên iPhone thật |
| Thông báo có bản mới | ✅ | `apps/game/src/pwa.ts` |
| App Android / iOS (Capacitor) | ⏳ MVP (Android), giai đoạn 2 (iOS) | |
| Quảng cáo 2 tầng công tắc, theo nhóm tuổi | ⏳ MVP | Đã chốt Q-11, Q-12 |
| Gói bỏ quảng cáo (Google Play, chuyển khoản web) | ⏳ MVP | Đã chốt Q-16, Q-19, Q-20, Q-22, Q-24 |
| Tài khoản: Google + email OTP (Resend) | ⏳ MVP | Đã chốt Q-3, Q-26, Q-27 |
| Đăng nhập số điện thoại (Zalo ZNS) | ⏳ sau MVP | |
| Máy chủ NestJS + PostgreSQL | ⏳ MVP | Nơi đặt: chờ Q-29 |
