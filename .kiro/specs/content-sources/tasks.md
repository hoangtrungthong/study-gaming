# Việc cần làm: đối chiếu và lấy nội dung từ nguồn mở

Nhánh code: `feat/content-sources-<đợt>` từ `main` mới nhất, mỗi đợt một PR. Thứ tự theo phụ thuộc; mỗi việc kèm test. Các điểm
D-1…D-6 đã chốt (`design.md`). Đợt 2 trở đi chờ `mvp-progress` xong bản đồ đọc vùng theo tầng (D-2).

## Đợt 1 — Công cụ và đối chiếu nội dung MVP

- [ ] 1. `tools/content-sources/` (Node 22 + tsx): `fetch.ts` tải nguồn vào `.cache/` (gitignore), ghi / kiểm
  `sources.lock.json` (URL, phiên bản, ngày, giấy phép, sha256); lệnh `pnpm content-sources fetch`; test với file mẫu
- [ ] 2. Bộ đọc nguồn (`src/parse/`), mỗi nguồn một file + test trên `fixtures/`:
  - [ ] 2.1 CEFR-J 1.6: đổi tay bảng tính sang `tools/content-sources/data/cefrj-1.6.csv` một lần (D-1), bộ đọc CSV
  - [ ] 2.2 Danh sách Waller N5–N3 (bản lưu trữ)
  - [ ] 2.3 JMdict (cách đọc, nghĩa tiếng Anh), KANJIDIC2 (`vietnam`), Unihan `kVietnamese`
  - [ ] 2.4 Tatoeba theo ngôn ngữ (vie, eng, jpn) + liên kết dịch + tác giả, giấy phép (CC0 / CC BY)
  - [ ] 2.5 NGSL; Wiktionary (bản dịch vi / ja phần Computing); Wikipedia glossary; chương trình GDPT 2018 môn Tin học
- [ ] 3. `src/check.ts` + lệnh `pnpm content-check` → `docs/content-review/<ngày>.md` (nghĩa lệch, cách đọc lệch, Hán Việt lệch,
  từ không có trong nguồn, emoji > Unicode 12, câu dùng từ chưa dạy); test với dữ liệu giả
- [ ] 4. Chạy đối chiếu 126 từ + 49 câu MVP; chủ sản phẩm duyệt báo cáo; sửa dữ liệu theo kết quả duyệt
- [ ] 5. Kiểu mới (`cefr`, `jlpt`, `itLevel`, `exampleSource`, `Region.tier`, `Region.status`) + `validate*` + test; gắn cấp cho
  từ MVP
- [ ] 6. Tài liệu đợt 1: `AGENTS.md` mục 4, `docs/content-authoring.md` (quy trình), kịch bản Q-4; DoD

## Đợt 2 — Tầng đầu mỗi đảo (A1, N5, IT trẻ em) — sau `mvp-progress` (D-2)

- [ ] 7. Vùng theo tầng: `regions/<môn>/<tầng>.json`, `TIERS`, `regionsOf` / `tiersOf`, `validateRegionShape` theo tầng; dời vùng
  MVP vào tầng đầu, giữ id; test
- [ ] 8. `build-tiers.ts`: khung vùng / màn cho một tầng, gom theo chủ đề (D-5), ≤ 5 từ mới / màn, 6 màn / vùng, chọn trò theo
  khuôn vùng MVP; test
- [ ] 9. File BY-SA `sources/*.json` (chỉ mục app dùng, khoá `license`); app đọc cách đọc / bản dịch từ đây; test
- [ ] 10. Câu Tatoeba: chọn câu chứa từ, lưu `examples/<môn>.json` + `exampleSource`; sinh `credits.json`; test
- [ ] 11. AI soạn tiếng Việt cho cả tầng đầu (D-4) → `pnpm content-check` → chủ sản phẩm duyệt một lần → `status: 'reviewed'`
- [ ] 12. App: ẩn vùng `draft`; tải dữ liệu tầng lazy; màn "Nguồn dữ liệu" riêng (chuyển ghi công KanjiVG vào), đọc được
  offline; test màn + E2E offline
- [ ] 13. Âm thanh tầng đầu: `pnpm speech-list` + `tools/tts` (khi đủ dung lượng ổ)
- [ ] 14. Tài liệu: kịch bản mục 3, 7 (tầng), `docs/feature-checklist.md`, `docs/ai/`; DoD

## Đợt 3 trở đi — Mỗi đợt một tầng mỗi đảo (A2/N4/phổ thông, B1/N3/nhập môn, B2/chuyên nghiệp)

- [ ] 15. Lặp việc 8, 10, 11, 13 cho tầng tiếp theo
- [ ] 16. (Khi có tầng thứ hai) âm thanh web theo tầng: manifest theo tầng, tải khi mở tầng, `navigator.storage.persist()`;
  test `offlineCache` + E2E
- [ ] 17. (Spec `mvp-android`) asset pack Play Asset Delivery theo tầng
- [ ] 18. Mỗi bản phát hành: `pnpm content-sources fetch` làm mới JMdict / KANJIDIC2, chạy lại `content-check` (EDRDG)
