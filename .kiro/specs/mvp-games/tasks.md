# Kế hoạch triển khai — Các trò chơi của MVP (mvp-games)

> **Cập nhật 2026-11-18:** chủ sản phẩm đồng ý toàn bộ đề xuất — mọi chỗ ghi `(CC-n)` / `[CC-x]` / "Chặn bởi CC-n" nay là **đã chốt** theo đề xuất, trừ các điểm gắn nhãn **Còn mở** ở `requirements.md` (xem `../mvp-open-questions.md`).

Nhánh `feat/mvp-games` từ `main` mới nhất. Thứ tự theo phụ thuộc: dữ liệu → phần dùng chung → luật + màn từng trò → lối vào
→ nội dung 2 vùng → E2E → tài liệu → DoD. **Hỏi hết "Chờ chốt" (`requirements.md`) trước khi code phần phụ thuộc**; cột
"Chặn" ghi điểm phải chốt trước. Mỗi việc kèm test; file đổi phải 100% dòng (`pnpm -r test:coverage` + `pnpm coverage:changed`).

- [x] 0. Chốt các điểm CC-1 … CC-27 với chủ sản phẩm; ghi câu trả lời vào `requirements.md` (chuyển sang "Quyết định đã thống
  nhất") và kịch bản mục 12.1 / 12.2; sửa `design.md` nếu khác đề xuất.
- [x] 1. Dữ liệu (`packages/content`) — Chặn: CC-1, CC-2, CC-4, CC-6, CC-7, CC-21
  - [x] 1.1 Kiểu `GameKind`, `Region`, `Level`, `Sentence`, `KanaStrokes`, `BlockKind`, `MazeLevel` (`types.ts`); `regions.ts`
    nạp và tra cứu nội dung màn; test tra cứu
  - [x] 1.2 `validateRegions`, `validateSentence`, `validateMaze` (BFS), `validateKanaStrokes`; test mỗi nhánh lỗi bằng dữ liệu hỏng
  - [x] 1.3 `sentenceSegments`, `kanaSegment`, câu cố định mới trong `phrases.ts`, `collectSpeech` gom câu / kana / `hintVi`;
    test thứ tự đoạn và cờ `translation`
  - [x] 1.4 Dữ liệu mẫu tối thiểu cho mỗi trò (1 vùng mỗi đảo, đủ chạy test và E2E); `content.test.ts` kiểm dữ liệu thật hợp lệ
- [x] 2. Dữ liệu nét kana — Chặn: CC-8, CC-9, CC-27
  - [x] 2.1 Đưa file nguồn đã chọn + giấy phép vào repo (theo CC-27)
  - [x] 2.2 Script `packages/content/scripts/build-kana-strokes.ts` (SVG → điểm lấy mẫu → `data/kana-strokes.json`), lệnh pnpm mới;
    test với SVG mẫu nhỏ; ghi lệnh vào `AGENTS.md` mục 4
- [x] 3. Phần dùng chung (`apps/game`)
  - [x] 3.1 `result.ts` (`LevelResult`, `starsByMistakes`) — Chặn: CC-24; test biên sao
  - [x] 3.2 Cấu hình nhóm tuổi mới trong `ageConfig.ts` — Chặn: CC-10, CC-13…CC-17, CC-20; test mỗi nhóm đủ khoá
  - [x] 3.3 `drag.ts` (`useDrag`: Pointer Events, `setPointerCapture`, `touch-action: none`, chạm-chọn-chạm-đặt) — Chặn: CC-12;
    test jsdom bằng `PointerEvent` giả
  - [x] 3.4 `Speaker.say` nhận tốc độ riêng cho một lượt; test `speaker.test.ts`
  - [x] 3.5 `VirtualKeyboard.vue` (phím = chữ khác nhau của đáp án, xáo trộn, chữ to) — Chặn: CC-19; test component
  - [x] 3.6 `registry.ts` + `App.vue` dùng `<component :is>` lazy, phát / chuyển `finish`; test `App.test.ts` vẫn xanh và có trò mới
- [x] 4. G5 Lật Thẻ Nhớ — Chặn: CC-15
  - [x] 4.1 `MemoryGame.ts` + test (lật, khớp, không khớp, chặn thẻ thứ ba, sao)
  - [x] 4.2 `MemoryView.vue` + test màn (đọc khi lật, úp lại theo hẹn giờ giả, bàn phím, `finish`)
- [x] 5. G4 Nghe Chọn — Chặn: CC-14
  - [x] 5.1 `ListenGame.ts` + test (nhiễu cùng vùng không trùng emoji, sai loại lựa chọn, sao)
  - [x] 5.2 `ListenView.vue` + test màn (tự đọc đề, Nghe lại, Mầm chỉ hình, Cây chỉ chữ, `KnowledgeCard`)
- [x] 6. W1 Viết Lại Từ — Chặn: CC-5, CC-17, CC-18, CC-19
  - [x] 6.1 `WriteGame.ts` + test (ô xanh từng chữ, sai 2 lần hiện chữ đầu, 3 lần hiện cả từ, romaji → かな, bỏ qua khi đang soạn,
    3 mức Chép / Nhớ / Nghe viết)
  - [x] 6.2 `WriteView.vue` + test màn (thứ tự đọc nghĩa → từ, đọc chậm khi sai, Mầm bàn phím ảo, focus trong lần chạm, ví dụ cuối)
  - [x] 6.3 Nối W1 sau trò chính khi màn có `newWords`; test gộp `LevelResult`
  - [x] 6.4 Mưa Chữ nhóm Mầm dùng `VirtualKeyboard` (chỉ khi CC-19c = có); test `games.test.ts`
- [x] 7. G3 Xếp Câu — Chặn: CC-6, CC-7, CC-16
  - [x] 7.1 `SentenceGame.ts` + test (đặt / gỡ khối, thứ tự `accept`, khối nhiễu, khối sai trả về khay)
  - [x] 7.2 `SentenceView.vue` + test màn (kéo và chạm-chạm, khối tiếng Nhật có かな, đọc câu + dịch, ẩn tiếng Việt)
- [x] 8. G2 Hứng Sao — Chặn: CC-11, CC-13
  - [x] 8.1 `StarGame.ts` + test (`tick`, hứng đúng / sai, lỡ sao đúng rơi lại, không mất mạng, kết thúc, `seededRng`)
  - [x] 8.2 `StarScene.ts` (Phaser, lazy, `/* v8 ignore file */`) + `StarView.vue` + test màn với cảnh mock (đọc đề, phím ← →,
    chạm sao nghe từ, danh sách sr-only)
- [x] 9. J1 Vẽ Kana — Chặn: CC-8, CC-9, CC-10
  - [x] 9.1 `strokeMatch.ts` + `KanaTrace.ts` + test (nét đúng, ngược hướng, lệch xa, ngưỡng theo nhóm, sao)
  - [x] 9.2 `KanaView.vue` (SVG, Pointer Events, mũi tên, hoạt ảnh thứ tự nét, nạp lazy `kana-strokes.json`) + test màn
  - [x] 9.3 Ghi công nguồn dữ liệu nét ở `SettingsView` (nếu giấy phép yêu cầu); test `views.test.ts`
- [x] 10. I1 Đưa Bit Về Nhà — Chặn: CC-20, CC-21
  - [x] 10.1 `MazeGame.ts` + test (tuần tự, rẽ, lặp, lặp lồng cho Cây, đụng tường, chưa tới nhà, quá `maxBlocks`, sao)
  - [x] 10.2 `MazeView.vue` + test màn (thêm / sắp / xoá khối, chạy phát lại từng bước bằng hẹn giờ giả, đọc tên khối, Về chỗ cũ)
- [x] 11. Lối vào tạm ở `IslandView` theo CC-25 (lọc theo môn); test `views.test.ts`
- [x] 12. Nội dung đủ 2 vùng mỗi đảo — Chặn: CC-1, CC-2, CC-3, CC-6
  - [x] 12.1 Từ, câu, mê cung, danh sách màn cho en / ja / it; `content.test.ts` xanh
  - [x] 12.2 `pnpm speech-list` chạy được, danh sách có câu mới (tạo file âm thanh thật theo `docs/audio.md` khi đủ dung lượng) — đã chạy 2026-11-19: 825 đoạn; file âm thanh thật chưa tạo
- [x] 13. E2E Playwright (desktop + phone, `muteSpeech`, ảnh `shot()`)
  - [x] 13.1 `e2e/mvp-games.spec.ts`: G2, G3, G4, G5, W1 (en + ja romaji), J1 (vẽ theo nét chuẩn), I1 — mỗi trò một luồng thắng
    và một lần sai
  - [x] 13.2 `offline.spec.ts`: mở một trò tải lazy khi mất mạng
  - [x] 13.3 Xem ảnh chụp khổ điện thoại và máy tính (bàn phím ảo, vùng kéo, J1 không cuộn trang)
- [x] 14. Cổng: `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm -r test:coverage` +
  `pnpm coverage:changed`, `pnpm build`, `pnpm e2e` — sạch, không cảnh báo
- [x] **(làm trước E2E và cổng chất lượng)** Đèn Pin (gợi ý) trong mọi trò: nút gợi ý + hành vi riêng từng trò như requirements "Chốt thêm 2026-11-18"; dùng gợi ý thì `LevelResult` báo `usedHint` và không cho 3 sao; test từng trò
- [x] 15. Tài liệu (cùng commit)
  - [x] 15.1 `docs/feature-checklist.md`: G2–G5, W1, J1, I1 → ✅ kèm nơi triển khai; dòng nội dung 2 vùng
  - [x] 15.2 `docs/ai/00-overview.md` (luồng màn, registry, dữ liệu mới), `40-conventions.md` (file mẫu: trò DOM, kéo-thả, SVG),
    `50-stack-patterns.md` (Pointer Events, SVG nét, Phaser cho G2)
  - [x] 15.3 `docs/content-authoring.md`: cách soạn vùng / màn, câu, mê cung, kana; `docs/audio.md` nếu đổi cách gom câu;
    `AGENTS.md` mục 4 nếu thêm lệnh
  - [x] 15.4 Kịch bản mục 12: chuyển các CC đã chốt sang 12.1
- [x] 16. DoD: skill `dod-report`, báo cáo `docs/dod/mvp-games_<ngày>.md`; review + phản biện; tạo PR khi người dùng bảo
