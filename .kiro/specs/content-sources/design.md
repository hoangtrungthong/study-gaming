# Thiết kế: đối chiếu và lấy nội dung từ nguồn mở

Dựa trên `requirements.md` (QĐ-1, CS-1…CS-17). Các điểm thiết kế chưa chọn ghi ở mục "Chờ chốt thiết kế" (D-x).

## Tổng quan các lớp

```
tools/content-sources/            Node 22 + tsx, chạy tay trên máy nhóm (không chạy lúc chơi, không chạy trong CI)
  sources.lock.json               commit: tên, URL, phiên bản / ngày tải, giấy phép, sha256 từng nguồn
  .cache/                         KHÔNG commit (.gitignore): file tải về (Tatoeba theo ngôn ngữ, JMdict, KANJIDIC2…)
  src/fetch.ts                    tải + kiểm checksum, bỏ qua khi đã có
  src/parse/*.ts                  mỗi nguồn một bộ đọc → kiểu chung (Headword, Reading, ExampleSentence…)
  src/build-tiers.ts              danh sách từ theo tầng → khung vùng / màn (từ mới, trò) cho mỗi tầng
  src/check.ts                    đối chiếu dữ liệu với nguồn → docs/content-review/<ngày>.md
packages/content/data/
  {en,ja,it}.json                 nội dung dự án soạn (giữ như hiện nay) + trường mới `cefr` / `jlpt` / `itLevel`
  regions/<môn>/<tầng>.json       vùng theo tầng (thay 1 file / môn), mỗi vùng có `status: 'draft' | 'reviewed'`
  sources/                        dữ liệu chép từ nguồn BY-SA (CS-1), mỗi file ghi giấy phép trong khoá `license`
    jmdict-readings.json            cách đọc + nghĩa tiếng Anh cho từ ja của app (chỉ mục app dùng)
    kanjidic-hanviet.json           âm `vietnam` cho kanji của app
    wiktionary-it.json              bản dịch vi / ja cho thuật ngữ IT
  examples/<môn>.json             câu Tatoeba đã chọn: id, chữ, bản dịch, người viết, giấy phép (CS-5)
  credits.json                    sinh tự động: danh sách nguồn + ghi công từng câu Tatoeba (màn Nguồn dữ liệu)
apps/game/                        đọc vùng theo tầng (lazy), ẩn vùng `draft`, màn Nguồn dữ liệu, âm thanh theo tầng (web)
```

## Mô hình dữ liệu

```ts
// packages/content/src/types.ts — thêm, đều không bắt buộc (dữ liệu MVP cũ vẫn hợp lệ)
interface LearnItem {
  cefr?: 'A1' | 'A2' | 'B1' | 'B2';          // en, từ CEFR-J 1.6
  jlpt?: 'N5' | 'N4' | 'N3';                 // ja, theo Waller (ước lượng, không chính thức)
  itLevel?: 'kids' | 'school' | 'intro' | 'pro'; // it, tự đặt (CS-17)
  example?: string; exampleVi?: string;      // như cũ
  exampleSource?: { tatoebaId: number; author: string; license: 'CC BY 2.0 FR' | 'CC0'; viFrom: 'tatoeba' | 'ai' };
}
interface Region {
  tier: string;                              // 'A1' | … | 'N5' | … | 'kids' | … ; vùng MVP hiện có gắn tầng đầu
  status: 'draft' | 'reviewed';              // vùng draft không hiện cho người chơi (CS-11)
}
```

- **Tầng → vùng:** `regions/<môn>/<tầng>.json` theo thứ tự tầng (`TIERS[subject]`); id vùng giữ dạng `<môn>-r<số>` chạy liên tục
  qua các tầng để không đụng id của tiến độ đã lưu (`mvp-progress`). Vùng MVP hiện có (`en-r1`, `en-r2`…) thuộc tầng đầu.
- **Khuôn:** `validateRegionShape` đổi từ "đúng 2 vùng" sang theo tầng: mỗi vùng 6 màn, mỗi màn ≤ 5 từ mới, từ của tầng chỉ
  xuất hiện từ tầng đó trở đi (trừ từ ôn); Viết Lại Từ và Xếp Câu chỉ dùng từ đã dạy.
- **File BY-SA tách riêng:** app đọc `sources/*.json` để hiện cách đọc / bản dịch; nội dung dự án (`{en,ja,it}.json`) không chép
  chữ từ đó vào, chỉ tham chiếu theo id.

## Quy trình soạn một tầng

1. `pnpm content-sources fetch` → cache + `sources.lock.json`.
2. `pnpm content-sources build-tiers <môn> <tầng>` → khung vùng (`status: 'draft'`) + danh sách từ cần soạn; từ đã có trong
   dữ liệu giữ nguyên.
3. **AI soạn phần tiếng Việt cho cả tầng** (`meaningVi`, ví dụ, `explainVi`; chọn câu Tatoeba nếu có) — chạy bằng phiên
   Claude Code, ghi thẳng vào `{en,ja,it}.json` / `examples/` (D-4).
4. `pnpm content-check` → `docs/content-review/<ngày>.md`: nghĩa lệch nghĩa tiếng Anh của nguồn, cách đọc lệch JMdict, Hán Việt
   lệch KANJIDIC2 / Unihan, từ không có trong nguồn, emoji Unicode > 12, câu dùng từ chưa dạy.
5. Chủ sản phẩm duyệt cả tầng một lần qua báo cáo → AI đổi `status` sang `reviewed` cho vùng được duyệt (D-3).
6. `pnpm speech-list` + `tools/tts` tạo âm thanh cho vùng đã duyệt.

## Màn hình

- **Đảo / bản đồ:** thuộc `mvp-progress` (Yêu cầu 3: bản đồ đảo → vùng → màn, luật mở vùng). Spec này chỉ thêm khái niệm tầng
  vào dữ liệu và hàm tra (`regionsOf(subject, tier)`, `tiersOf(subject)`); cách hiện tầng trên bản đồ: D-2.
- **Nguồn dữ liệu:** màn riêng mở từ Cài đặt (EDRDG yêu cầu màn riêng trong menu): danh sách nguồn + giấy phép (đầy đủ chữ
  giấy phép / link), ghi công Tatoeba có ô tìm (hàng nghìn dòng, cuộn ảo không cần: danh sách chữ thuần, tải lazy).
  Mục KanjiVG hiện có ở Cài đặt chuyển vào đây.

## Offline và đóng gói

- **Chữ:** dữ liệu mỗi tầng là một chunk JSON tải lazy (`import()` theo tầng); precache mọi chunk (vài MB). Trang chủ chỉ tải
  danh sách tầng.
- **Âm thanh web (CS-16):** manifest âm thanh tách theo tầng (`audio/manifest-<môn>-<tầng>.json`); tầng đầu được
  `warmAudioCache` tải sẵn như hiện nay, tầng sau tải khi mở tầng; gọi `navigator.storage.persist()` lần đầu tải tầng sau;
  thiếu file thì đọc bằng giọng của máy như hiện nay.
- **Âm thanh Android (CS-14):** asset pack theo tầng của Play Asset Delivery (install-time cho tầng đầu, fast-follow cho phần
  còn lại, ≤ 1,5 GB / pack) — làm trong spec `mvp-android`; spec này chỉ sinh file và manifest theo tầng.

## Test

- `tools/content-sources`: bộ đọc từng nguồn chạy trên file mẫu nhỏ commit trong `tools/content-sources/fixtures/` (không tải
  mạng trong test); `build-tiers` và `check` có test với dữ liệu giả.
- `packages/content`: kiểm khuôn theo tầng, trường mới, `status`, file `sources/` có `license`, `credits.json` đủ mọi câu
  Tatoeba đang dùng.
- `apps/game`: vùng `draft` không hiện; tải tầng lazy; màn Nguồn dữ liệu (đọc được offline — E2E); âm thanh theo tầng (unit
  test `offlineCache`).

## Quyết định thiết kế (2026-11-19, người dùng chọn)

- **D-1 — CEFR-J: đổi tay một lần sang CSV**, commit `tools/content-sources/data/cefrj-1.6.csv` kèm ghi nguồn; không thêm thư viện.
- **D-2 — Làm `mvp-progress` trước**, bản đồ đọc danh sách vùng theo tầng ngay từ đầu (`regionsOf` / `tiersOf`, `Region.tier`).
  Đợt 1 của spec này (công cụ + đối chiếu nội dung MVP) làm song song được vì không đụng bản đồ.
- **D-3 / D-4 — AI soạn cả một tầng rồi chủ sản phẩm duyệt một lần:** duyệt qua báo cáo `docs/content-review/`, báo trong chat
  hoặc sửa thẳng JSON; AI đổi `status` sang `reviewed` cho vùng được duyệt. Không làm màn duyệt trong app.
- **D-5 — Gom từ vào vùng theo chủ đề:** tiếng Anh theo nhóm chủ đề CEFR-J (`Coreinventory`), tiếng Nhật theo thứ tự danh sách
  Waller, IT theo chủ đề chương trình GDPT; trong vùng xếp từ dễ trước.
- **D-6 — Thứ tự đợt:** đợt 1 công cụ + đối chiếu 126 từ MVP; đợt 2 tầng đầu (A1, N5, IT trẻ em) + màn Nguồn dữ liệu + ẩn vùng
  draft; đợt 3 trở đi mỗi đợt một tầng mỗi đảo; âm thanh web theo tầng khi có tầng thứ hai.

## Chờ chốt thiết kế

Không còn câu nào.
