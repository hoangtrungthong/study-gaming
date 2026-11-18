# Đối chiếu kịch bản game với code

Nguồn yêu cầu: [kich-ban-game.md](kich-ban-game.md). Cập nhật khi xong một tính năng (cùng commit với code).

Trạng thái: ✅ đã làm · ⚠️ làm một phần · ⏳ chưa làm (ghi giai đoạn dự kiến theo mục 11 của kịch bản).

## Trò chơi (kịch bản mục 5)

| Mã | Trò | Trạng thái | Nơi triển khai |
|---|---|---|---|
| G1 | Ghép Đôi | ✅ | `apps/game/src/games/match/` (`MatchGame.ts`, `MatchView.vue`) |
| G2 | Hứng Sao | ⏳ MVP | |
| G3 | Xếp Câu | ⏳ MVP | |
| G4 | Nghe Chọn | ⏳ MVP | |
| G5 | Lật Thẻ Nhớ | ⏳ MVP | |
| G6 | Ai Nói Gì | ⏳ giai đoạn 2 | |
| G7 | Đúng / Sai Siêu Tốc | ⏳ giai đoạn 2 | |
| G8 | Điền Chỗ Trống | ⏳ giai đoạn 2 | |
| W1 | Viết Lại Từ | ⏳ MVP | |
| W2 | Mưa Chữ (3 chế độ: từ gốc / nghĩa / chỉ nghe) | ✅ | `apps/game/src/games/rain/` (`RainGame.ts`, `RainView.vue`, `RainScene.ts`) |
| J1 | Vẽ Kana | ⏳ MVP | |
| J2 | Tiệm Bánh Ông Haru | ⏳ giai đoạn 2 | |
| J3 | Ghép Bộ Kanji | ⏳ giai đoạn 2 | |
| E1–E3 | Thư Viện Bay, Đọc Theo Tomo, Truyện Nghe Chọn Nhánh | ⏳ giai đoạn 2 (E2 chấm phát âm: chờ Q-7) | |
| I1 | Đưa Bit Về Nhà (khối lệnh) | ⏳ MVP | |
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
| Ghi công giọng VOICEVOX | ✅ | Màn Cài đặt; [giong-voicevox.md](giong-voicevox.md) |
| Karaoke tô sáng từng chữ | ⏳ | Hiện tô theo đoạn; cần mốc thời gian từ bộ đọc |

## Nội dung (mục 7)

| Yêu cầu | Trạng thái | Ghi chú |
|---|---|---|
| Bộ mẫu 3 đảo | ✅ | en 16, ja 16, it 20 từ |
| Đủ vùng 1–8 mỗi đảo | ⏳ | Chờ Q-4 (ai soạn, có bám CEFR/JLPT) |
| Nhánh chứng chỉ AWS / Google Cloud (vùng 9, 10) | ⏳ chờ Q-30 | 4 thẻ đám mây mẫu trong `it.json` |

## Tiến độ và phần thưởng (mục 9)

| Yêu cầu | Trạng thái |
|---|---|
| Sao 1–3 mỗi màn | ✅ (Ghép Đôi, Mưa Chữ) |
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
