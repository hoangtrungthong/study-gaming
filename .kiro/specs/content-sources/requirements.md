# Đối chiếu nội dung bài học với nguồn mở

Ngày: 2026-11-19. Nhánh `docs/content-sources`. Dựa trên `main` sau PR #5 (`feat/mvp-games`, merge 2026-11-19).

## Giới thiệu

Nội dung bài học (từ, nghĩa tiếng Việt, cách đọc, âm Hán Việt, câu ví dụ, giải thích, câu Xếp Câu) hiện do AI soạn nháp từ
kiến thức của mô hình, không lấy từ nguồn nào cụ thể, và chưa bám CEFR / JLPT (kịch bản Q-4). Người dùng chọn (2026-11-19):
**đối chiếu nội dung với nguồn mở có giấy phép dùng thương mại**, rồi mở rộng thành **lấy toàn bộ từ vựng theo cấp từ các
nguồn đó** (CEFR-J A1–B2, JLPT N5–N3, thuật ngữ IT 4 cấp), soạn phần tiếng Việt bằng AI và chủ sản phẩm duyệt.

## Hiện trạng (đã rà trong nhánh `feat/mvp-games`)

| Phần | Số lượng | Nơi | Nguồn hiện tại |
|---|---|---|---|
| Từ tiếng Anh | 45 từ, đủ ví dụ + giải thích | `packages/content/data/en.json` | AI nháp |
| Từ tiếng Nhật | 40 từ, 7 từ có kanji kèm `hanViet`, 39 có ví dụ | `packages/content/data/ja.json` | AI nháp |
| Thuật ngữ IT | 41 từ, đủ giải thích | `packages/content/data/it.json` | AI nháp |
| Câu Xếp Câu | en 23, ja 26 | `packages/content/data/sentences/` | AI nháp |
| Nét kana | 92 chữ | `packages/content/vendor/kanjivg/` | KanjiVG, CC BY-SA 3.0 (đã ghi công ở Cài đặt) |

- Kiểm hiện có chỉ là định dạng (`packages/content/src/validate.ts`: thiếu trường, trùng id, kanji phải có `reading` +
  `hanViet`, đáp án tiếng Nhật chỉ gồm かな). Không có bước nào kiểm **đúng nghĩa**.
- Trường cấp độ (CEFR / JLPT) chưa có trong `LearnItem` (`packages/content/src/types.ts`).

## Nguồn đã tra (2026-11-19, không phải tư vấn pháp lý)

| Nguồn | Cho ta | Giấy phép | Dùng thương mại | Ghi chú |
|---|---|---|---|---|
| [CEFR-J Wordlist 1.6](https://www.cefr-j.org/download.html) | Cấp A1–B2 cho từ tiếng Anh | Cho phép kể cả thương mại, **ghi nguồn** | Được | Không ShareAlike. Ghi: "The CEFR-J Wordlist Version 1.6, Tono Laboratory, TUFS" |
| [NGSL 1.2](https://www.newgeneralservicelist.com/new-general-service-list) | Tần suất ~2.800 từ tiếng Anh | CC BY-SA 4.0 | Được | ShareAlike nếu chép dữ liệu vào app |
| Oxford 3000 / 5000 | — | © OUP, cần hợp đồng | **Không** | Bản "MIT" trên GitHub không thay được giấy phép |
| Cambridge English Vocabulary Profile | — | Chỉ phi thương mại | **Không** | |
| [Wiktionary](https://en.wiktionary.org/wiki/Wiktionary:Copyrights) | Gợi ý nghĩa tiếng Việt | CC BY-SA 4.0 + GFDL | Được | Phần dịch tiếng Việt thưa, chỉ dùng tham khảo |
| FreeDict, WikDict, từ điển Hồ Ngọc Đức | — | Không có cặp Anh–Việt / giấy phép dữ liệu không rõ | **Không** | |
| [JMdict / KANJIDIC2](https://www.edrdg.org/edrdg/licence.html) | Cách đọc, nghĩa tiếng Anh của từ Nhật; kanji; KANJIDIC2 có trường âm `vietnam` | CC BY-SA 4.0 (EDRDG) | Được | Nếu phân phối dữ liệu: ghi công ở **màn riêng trong menu**, kèm giấy phép, **cập nhật định kỳ**. Không có nghĩa tiếng Việt |
| [Unihan `kVietnamese`](https://www.unicode.org/reports/tr38/) | Âm đọc tiếng Việt của chữ Hán | Giấy phép Unicode (thoáng) | Được | Không tách Hán Việt với Nôm → chỉ để kiểm chéo |
| Danh sách JLPT N5–N3 của Jonathan Waller (tanos) | Cấp JLPT ước lượng | CC BY (đã đọc bản lưu trữ, xem "Tra thêm") | Được | Không có danh sách JLPT chính thức từ 2010 |
| Mazii và các từ điển Nhật–Việt khác | — | Độc quyền | **Không** | Không có từ điển Nhật–Việt mở |
| [Tatoeba](https://tatoeba.org/en/terms_of_use) | Câu ví dụ có bản dịch | CC BY 2.0 FR (mặc định), một phần CC0 | Được | Ghi công **từng câu** (người viết + giấy phép); **không dùng âm thanh** (có thể phi thương mại). Số câu tiếng Việt chưa đếm |
| Wikipedia | Kiểm giải thích IT | CC BY-SA 4.0 | Được | Viết lại bằng lời mình thì không ShareAlike; chép nguyên văn thì có |
| FOLDOC; bảng thuật ngữ AWS / Google Cloud | — | GFDL / giữ mọi quyền | Không chép | Tên thuật ngữ dùng tự do; không chép định nghĩa |

### Tra thêm (2026-11-19, đợt 2)

- **Danh sách Waller (CS-3): giấy phép đã kiểm.** Bản lưu trữ
  http://web.archive.org/web/20121216045735/http://www.tanos.co.uk:80/jlpt/sharing/ ghi: "Everything on this site (that I'm
  not selling), is licenced under Creative Commons "BY" … use anything here however you like (commercial or non-commercial),
  but credit my site." Có N3. Ước: N5 ~670 từ / ~80 kanji, N4 ~580 / ~167, N3 ~1.800 / ~368.
- **CEFR-J 1.6:** A1 1.068 · A2 1.352 · B1 2.353 · B2 2.692 từ (6.868 từ, 7.801 mục theo từ loại); có từ loại và nhóm chủ đề.
  Ghi nguồn: "The CEFR-J Wordlist Version 1.6. Compiled by Yukio Tono, Tokyo University of Foreign Studies. Retrieved from
  https://www.cefr-j.org/download.html on <ngày>."
- **Tatoeba (bản xuất 14/11/2026):** tiếng Việt 33.343 câu (gần như toàn bộ CC BY, CC0 = 0), tiếng Nhật 249.275, tiếng Anh
  2.049.947. Liên kết dịch trực tiếp: Việt→Anh 23.277, Việt→Nhật 8.477 (thêm được qua tiếng Anh). Tác giả từng câu có trong
  `sentences_detailed`. Câu Nhật–Anh từ Tanaka Corpus là public domain.
- **Tổng từ dự kiến:** tiếng Anh 6.868 + tiếng Nhật ~3.050 từ / ~615 kanji (+ IT).
- **Âm thanh (ước, AAC 32 kbps, 2,5 s / đoạn):** 8.000 từ × 6 đoạn ≈ 480 MB; thêm câu ví dụ → **≈ 0,7–1,1 GB**.
  Google Play: gói gốc tối đa 500 MB, mỗi asset pack ≤ 1,5 GB, install-time ≤ 4 GB → đóng gói toàn bộ được bằng Play Asset
  Delivery. Web PWA: trình duyệt cho mỗi trang tới ~60% ổ trống (Chrome, Safari 17+), nhưng precache 0,7–1 GB nghĩa là lần
  mở đầu phải tải chừng đó, và dữ liệu có thể bị xoá khi máy thiếu chỗ nếu không xin lưu lâu dài.
- **Nguồn thuật ngữ IT (CS-15):**

  | Nguồn | Nội dung | Giấy phép | Dùng được |
  |---|---|---|---|
  | Wikipedia "Glossary of computer science" + bài vi/ja | ~400+ thuật ngữ, mức đại học, không chia cấp | CC BY-SA 4.0 | Được (file BY-SA riêng) |
  | Wiktionary (chuyên mục Computing) | Hàng nghìn từ, nhiều bản dịch vi/ja | CC BY-SA 4.0 | Được (file BY-SA riêng) |
  | Chương trình GDPT 2018 môn Tin học (Thông tư 32/2018) | Lớp 3–12, theo lớp, ít thuật ngữ | Văn bản pháp quy không được bảo hộ quyền tác giả (Luật SHTT điều 15, đã kiểm bản hợp nhất 2026 — xem "Chờ chốt"); **SGK Tin học có bản quyền, không lấy** | Được (suy luận) |
  | CS Unplugged | Hoạt động cho trẻ, không có danh sách từ riêng | CC BY-SA 4.0 | Được nhưng ít giá trị |
  | Đề cương ITパスポート / 基本情報 (IPA) | ~1.000+ thuật ngữ, chia mức nhập môn / chuyên nghiệp | © IPA, chưa thấy cho phép chép | **Chưa được**, phải hỏi IPA |
  | Microsoft Terminology (TBX) | Việt 28.828, Nhật 58.715 mục | Không có file giấy phép | **Chỉ tham khảo khi biên tập** |
  | Code.org, CSTA | Từ vựng K-12 | CC BY-NC-SA (phi thương mại) | **Không** |

**ShareAlike (BY-SA) nghĩa là gì với ta:** chỉ áp cho dữ liệu, không áp cho code app. Nhưng file nội dung nào **chép hoặc
trộn** mục từ nguồn BY-SA (JMdict, NGSL, Wiktionary, Wikipedia) thì file đó phải mở theo BY-SA: ai lấy được file từ APK /
web đều được dùng lại, ta không cấm được. Chỉ **đối chiếu để sửa lỗi** (một cách đọc, một nghĩa ngắn là sự thật, không có
bản quyền) thì không kéo theo ShareAlike, nhưng không được chép hàng loạt.

**Không nguồn mở nào cho nghĩa tiếng Việt đủ tốt** (cả Anh–Việt lẫn Nhật–Việt): nghĩa tiếng Việt cuối cùng vẫn cần người duyệt.

## Quyết định đã thống nhất

- **QĐ-1 (2026-11-19):** đối chiếu nội dung với nguồn mở có giấy phép dùng thương mại (không dùng nguồn phi thương mại hoặc
  không rõ giấy phép).

Các câu CS-1…CS-10 chốt ngày 2026-11-19 (người dùng trả lời trực tiếp):

- **CS-1 — Nguồn BY-SA (JMdict, KANJIDIC2, NGSL, Wiktionary, Wikipedia): ~~chỉ đối chiếu~~ → được chép vào app (sửa
  2026-11-19, người dùng chọn).** Dữ liệu chép từ nguồn BY-SA nằm trong **file riêng** (vd. `data/sources/jmdict-*.json`),
  chấp nhận file đó mở theo CC BY-SA (ai lấy được file đều được dùng lại); file nội dung do dự án soạn giữ riêng. Bắt buộc
  theo EDRDG: màn ghi công riêng trong menu, kèm giấy phép, cập nhật JMdict / KANJIDIC2 mỗi bản phát hành. Code app không bị
  ảnh hưởng.
- **CS-2 — Cấp độ tiếng Anh: CEFR-J 1.6** là nguồn chính, NGSL chỉ xem tần suất. Không dùng Oxford / Cambridge.
- **CS-3 — Cấp độ tiếng Nhật: danh sách Waller**, ghi "ước lượng, không chính thức"; chỉ dùng sau khi đọc được trang giấy
  phép gốc (bản lưu trữ) — **đã đọc: CC BY, cho phép thương mại, ghi công trang tanos.co.uk**. Phạm vi N5–N3 (CS-10).
- **CS-4 — Âm Hán Việt:** kiểm chéo bằng KANJIDIC2 (`vietnam`) và Unihan `kVietnamese`; lệch thì vào danh sách người duyệt.
- **CS-5 — Câu ví dụ: được lấy câu Tatoeba CC BY và CC0** (chỉ chữ, không lấy âm thanh). Câu lấy từ Tatoeba lưu kèm id câu,
  người viết và giấy phép; app có danh sách ghi công từng câu trong mục "Nguồn dữ liệu".
- **CS-6 — Chủ sản phẩm duyệt nghĩa tiếng Việt** (hoặc người được giao, biết tiếng Nhật cho đảo Nhật), theo danh sách chỗ nghi
  sai mà công cụ đánh dấu.
- **CS-7 — Script `pnpm content-check`:** tải nguồn về cache không commit (`tools/content-check/.cache/`), so với dữ liệu, ghi
  báo cáo `docs/content-review/<yyyy-mm-dd>.md`; chạy tay khi thêm nội dung, không chạy trong CI.
- **CS-8 — Thêm trường không bắt buộc `cefr` (en) / `jlpt` (ja) vào `LearnItem`**, dùng cho báo cáo và soạn vùng sau; chưa
  đổi cách chơi. Sửa quyết định Q-4 trong kịch bản ("chưa bám CEFR / JLPT") cùng commit với code.
- **CS-9 — Ghi công trong app:** mục "Nguồn dữ liệu" ở Cài đặt thêm CEFR-J và ghi công Tatoeba (CS-5); nguồn chỉ dùng đối chiếu
  ghi ở `docs/content-authoring.md`.
- **CS-10 — Phạm vi đợt này:** ~~toàn bộ nội dung MVP~~ → mở rộng (2026-11-19): ngoài đối chiếu 126 từ, 49 câu của MVP,
  **lấy toàn bộ từ vựng theo cấp từ nguồn**: tiếng Anh CEFR-J A1–B2, tiếng Nhật JLPT N5–N3 (danh sách Waller, điều kiện CS-3)
  cùng kanji của các cấp đó, câu Tatoeba (CC BY / CC0) chứa các từ đó. Ước khoảng 6.000–8.000 từ. Nguồn không có bài học
  hay câu hỏi sẵn: câu hỏi trong game sinh từ từ vựng như hiện nay.
- **CS-11 — Nghĩa, ví dụ, giải thích tiếng Việt cho từ lấy về:** AI soạn theo từng vùng, `pnpm content-check` đánh dấu chỗ
  nghi sai, chủ sản phẩm duyệt từng vùng; **vùng chưa duyệt không hiện cho người chơi**.

- **CS-12 — Tầng theo cấp:** mỗi cấp (A1, A2, B1, B2 / N5, N4, N3) là một **tầng** gồm nhiều vùng; giữ 6 màn / vùng và ≤ 5 từ
  mới / màn (CK-11). Đi hết tầng này mới tới tầng sau. Sửa kịch bản mục 3 và 7 ("8 vùng mỗi đảo") cùng commit với code.
- **CS-13 — Không giới hạn cấp theo tuổi:** mọi nhóm tuổi học mọi cấp; nhóm tuổi chỉ đổi tốc độ, số lượng, cỡ chữ như hiện nay.
- **CS-14 — Đóng gói toàn bộ:** chữ và âm thanh của mọi cấp nằm sẵn trong app, chơi offline ngay. Bản Android dùng Play Asset
  Delivery (Q-9) vì vượt giới hạn cỡ gói; bản web precache toàn bộ (cần xem lại giới hạn bộ nhớ của trình duyệt).
- **CS-15 — Đảo IT: tra thêm nguồn mở** có danh sách thuật ngữ IT theo cấp trước khi soạn; kết quả tra đưa vào spec này.

- **CS-16 — Bản web tải âm thanh theo tầng:** web precache toàn bộ chữ và âm thanh tầng đầu; âm thanh tầng sau tải khi bé mở
  tầng đó, lưu lại để chơi offline, xin quyền lưu lâu dài (`navigator.storage.persist()`). App Android vẫn đóng gói toàn bộ
  (Play Asset Delivery) theo CS-14.
- **CS-17 — Đảo IT tự chia cấp, ghép nguồn mở:** 4 cấp (trẻ em / phổ thông / nhập môn kiểu ITパスポート / chuyên nghiệp); đầu
  mục từ lấy từ chương trình GDPT 2018 môn Tin học (văn bản pháp quy, không lấy SGK) và Wikipedia glossary; bản dịch vi/ja từ
  Wiktionary (file BY-SA riêng); giải thích tự viết; Microsoft TBX chỉ tham khảo khi biên tập; không dùng Code.org / CSTA /
  đề cương IPA.

## Chờ chốt

Không còn câu nào.

**Đã kiểm (2026-11-19, không phải tư vấn pháp lý):** Luật SHTT điều 15 theo văn bản hợp nhất 160/2026/VBHN-VPQH
(https://datafiles.chinhphu.vn/cpp/files/vbpq/2026/10/160-vbhn-vpqh.signed.pdf) vẫn giữ khoản 2: văn bản quy phạm pháp luật
và văn bản hành chính không được bảo hộ quyền tác giả; Luật 131/2025/QH15 chỉ thêm khoản 4 (ý tưởng, khẩu hiệu, tên tác
phẩm). Thông tư 32/2018/TT-BGDĐT là văn bản quy phạm pháp luật, chương trình môn Tin học "ban hành kèm theo" → nhiều khả
năng dùng lại được lời văn của chương trình (suy luận; khoản 3 cũng loại trừ khái niệm, thuật ngữ trần). Khi dùng: lấy văn
bản từ nguồn chính thức, ghi "Theo Chương trình GDPT 2018 (TT 32/2018/TT-BGDĐT và các thông tư sửa đổi)", không ngụ ý Bộ
GD&ĐT bảo trợ app, **không lấy gì từ SGK / sách giáo viên** (có bản quyền). Chưa kiểm: NĐ 134/2026 có sửa điều 8 NĐ 17/2023.

## Thuật ngữ

- **ShareAlike (BY-SA):** giấy phép buộc bản chỉnh sửa / trộn cũng phải mở theo cùng giấy phép.
- **Đối chiếu:** so nội dung của mình với nguồn để tìm chỗ sai.
- **Tầng:** một cấp (A1…B2 / N5…N3 / 4 cấp IT) của một đảo, gồm nhiều vùng (CS-12).
- **CEFR / JLPT:** khung cấp độ tiếng Anh (A1–C2) / kỳ thi năng lực tiếng Nhật (N5–N1).

## Yêu cầu

### Yêu cầu 1 — Lấy nguồn về, lặp lại được

**User story:** Là người soạn nội dung, tôi muốn tải và đọc các nguồn bằng một lệnh, ghi rõ phiên bản, để làm lại được khi
nguồn cập nhật.

1. Một lệnh tải CEFR-J 1.6, danh sách Waller (bản lưu trữ), JMdict, KANJIDIC2, Unihan, Tatoeba (theo ngôn ngữ cần), NGSL,
   Wiktionary (phần cần), chương trình GDPT 2018 môn Tin học, Wikipedia glossary vào cache không commit.
2. Mỗi nguồn ghi tên, URL, phiên bản / ngày tải, giấy phép, checksum vào một file khoá được commit.
3. Chạy lại không tải lại khi checksum trùng; JMdict / KANJIDIC2 cập nhật mỗi bản phát hành (CS-1).

### Yêu cầu 2 — Danh sách từ theo tầng

**User story:** Là chủ sản phẩm, tôi muốn mỗi đảo có đủ từ của từng cấp, chia vùng / màn theo khuôn hiện có.

1. Tiếng Anh: mọi từ CEFR-J A1–B2 (6.868 từ) có cấp `cefr`; tiếng Nhật: mọi từ JLPT N5–N3 theo Waller (~3.050 từ) có `jlpt`,
   kanji của các cấp có `reading` + `hanViet`; IT: 4 cấp tự đặt (CS-17).
2. Từ của mỗi tầng chia thành vùng 6 màn, mỗi màn ≤ 5 từ mới (CS-12, CK-11); từ đã có trong nội dung MVP giữ id và nội dung
   đã duyệt.
3. Màn Xếp Câu dùng câu chỉ chứa từ đã dạy tới màn đó (`validateRegionShape` mở rộng theo tầng).

### Yêu cầu 3 — Phần tiếng Việt do AI soạn, chủ sản phẩm duyệt

1. Mỗi từ có `meaningVi`, ví dụ + bản dịch, `explainVi` do AI soạn theo từng vùng (CS-11), đối chiếu nghĩa tiếng Anh của nguồn.
2. Báo cáo `docs/content-review/<yyyy-mm-dd>.md` liệt kê chỗ nghi sai: nghĩa lệch nguồn, cách đọc lệch JMdict, âm Hán Việt lệch
   KANJIDIC2 / Unihan, từ không có trong nguồn (CS-4, CS-7).
3. Vùng có trạng thái duyệt; **vùng chưa duyệt không hiện cho người chơi** (CS-11).

### Yêu cầu 4 — Câu ví dụ Tatoeba

1. Câu ví dụ lấy từ Tatoeba (CC BY / CC0, chỉ chữ) khi có câu phù hợp chứa từ, kèm bản dịch tiếng Việt (trực tiếp hoặc qua
   tiếng Anh rồi AI dịch, ghi rõ); lưu id câu, người viết, giấy phép (CS-5).
2. Câu không có trên Tatoeba thì AI viết như hiện nay.

### Yêu cầu 5 — Giấy phép và ghi công

1. Dữ liệu chép từ nguồn BY-SA nằm trong file riêng, ghi rõ giấy phép BY-SA (CS-1); nội dung dự án soạn ở file khác.
2. Màn "Nguồn dữ liệu" riêng trong menu (EDRDG yêu cầu): CEFR-J, Waller, JMdict / KANJIDIC2 (kèm giấy phép), Unihan, NGSL,
   Wiktionary, Wikipedia, KanjiVG, chương trình GDPT 2018 ("Theo Chương trình GDPT 2018…", không ngụ ý Bộ bảo trợ), danh sách
   ghi công từng câu Tatoeba (CS-9). Đọc được khi offline.
3. Không chép gì từ nguồn phi thương mại / không rõ giấy phép (Oxford, Cambridge, Code.org, CSTA, IPA, Microsoft TBX, SGK).

### Yêu cầu 6 — Đóng gói và chơi offline

1. App Android có sẵn chữ + âm thanh mọi tầng (Play Asset Delivery) (CS-14).
2. Bản web có sẵn chữ mọi tầng + âm thanh tầng đầu; âm thanh tầng sau tải khi mở tầng, lưu để chơi offline, xin lưu lâu dài
   (CS-16).
3. Trang chủ không tải dữ liệu của mọi tầng một lúc (tải theo tầng khi cần).

### Yêu cầu 7 — Tài liệu

1. `AGENTS.md` mục 4 (lệnh mới), `docs/content-authoring.md` (quy trình lấy nguồn → soạn → duyệt), `docs/audio.md` (âm thanh
   theo tầng), kịch bản: Q-4 (bám CEFR / JLPT), mục 3 và 7 (tầng thay "8 vùng mỗi đảo") (CS-8, CS-12).
