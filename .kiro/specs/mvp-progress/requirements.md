# Tài liệu yêu cầu — Tiến độ học MVP (mvp-progress)

> **Cập nhật 2026-11-18:** chủ sản phẩm đồng ý toàn bộ đề xuất — mọi chỗ ghi `(CC-n)` / `[CC-x]` / "Chặn bởi CC-n" nay là **đã chốt** theo đề xuất, trừ các điểm gắn nhãn **Còn mở** ở `requirements.md` (xem `../mvp-open-questions.md`).

> Viết ngày 2026-11-18. Chưa code. Mọi điểm ở mục **"Chờ chốt"** phải được chủ sản phẩm trả lời trước khi code phần phụ
> thuộc (`AGENTS.md` mục 3 và 5).

## Giới thiệu

Giai đoạn 1 (MVP) của kịch bản (`docs/game-design.md` mục 11) cần "hồ sơ 3 nhóm tuổi; sao và chuỗi ngày; mỗi đảo 2 vùng".
Spec này lo phần **tiến độ** của người chơi: hồ sơ, bản đồ đảo → vùng → màn, luật mở màn, lưu sao, "Nhiệm vụ hôm nay",
chuỗi ngày có "vé nghỉ", lưu trên máy khi không có mạng, và **hợp đồng dữ liệu** để spec máy chủ `mvp-accounts` đồng bộ sau.

**Ngoài phạm vi:**

| Phần | Thuộc spec |
|---|---|
| Các trò G2–G5, W1, J1, I1 và ngưỡng chấm sao của từng trò | `mvp-games` |
| Máy chủ NestJS, đăng nhập Google / email OTP, API đồng bộ, lưu PostgreSQL | `mvp-accounts` |
| Quảng cáo, gói bỏ quảng cáo, chuyển khoản | spec quảng cáo / mua hàng |
| Đóng gói Android (Capacitor), plugin native | spec đóng gói Android |
| Ôn tập thông minh (lặp lại 1, 3, 7, 14 ngày), Nhà của Tomo, bộ sưu tập, huy hiệu, Góc phụ huynh đầy đủ, màn trùm | giai đoạn 2 (kịch bản mục 11, `docs/feature-checklist.md`) |

Về **ôn tập thông minh**: dòng MVP ở kịch bản mục 11 không có mục này; dòng "2. Mở rộng" ghi "ôn tập thông minh". Vì vậy spec
này **không** làm lịch lặp lại ngắt quãng. Chỉ đề xuất ghi sẵn số lần đúng / sai của từng từ để giai đoạn 2 có dữ liệu
(CC-16).

### Hiện trạng đã rà trong code (2026-11-18)

- **Không có hồ sơ, không lưu tiến độ.** Chỉ có cài đặt chung một bộ cho cả máy: `localStorage` khoá `tomo.settings.v1`
  (`apps/game/src/settings.ts:16`), gồm nhóm tuổi, tự đọc, tốc độ, hiện tiếng Việt, giọng (`settings.ts:4-14`). Đọc có
  kiểm hợp lệ, lỗi thì về mặc định (`settings.ts:24-36`); ghi mỗi khi đổi bằng `watch` sâu (`settings.ts:42-43`).
  Mặc định nhóm `choi` (`settings.ts:20-22`), đổi nhóm tuổi ở Cài đặt (`apps/game/src/views/SettingsView.vue:9-23`).
- **Không có vùng, không có màn.** Nội dung là ba bộ bài phẳng, mỗi môn một danh sách từ
  (`packages/content/src/decks.ts:6-10`, kiểu `Deck` ở `packages/content/src/types.ts:28-36`): en 16, ja 16, it 20 từ
  (`docs/feature-checklist.md`, mục Nội dung).
- **Luồng màn:** `App.vue` giữ biến `screen` (`apps/game/src/App.vue:12-13`), không router: `home` → `island` → `match` |
  `rain`, và `settings` (`App.vue:36-40`). Trang chủ hiện 3 đảo, đếm số từ (`apps/game/src/views/HomeView.vue:31-46`).
  Màn đảo chỉ có hai nút Ghép Đôi / Mưa Chữ (`apps/game/src/views/IslandView.vue:16-26`), không khoá gì.
- **Sao đã tính nhưng bị bỏ đi khi thoát.** Ghép Đôi: 3 sao khi không sai, 2 sao khi sai ≤ 2 lần, còn lại 1
  (`apps/game/src/games/match/MatchGame.ts:23-27`). Mưa Chữ: tỉ lệ trúng ≥ 0,9 → 3, ≥ 0,6 → 2, còn lại 1
  (`apps/game/src/games/rain/RainView.vue:51-60`), nghĩa là **trúng 0 hạt vẫn được 1 sao**. Màn chơi chỉ phát `exit`
  (`MatchView.vue:12`, `RainView.vue:20`); `ResultPanel` chỉ có "Chơi lại" và "Về đảo"
  (`apps/game/src/components/ResultPanel.vue:4-5`, `:20-21`). Không có sự kiện trả kết quả ra ngoài.
- **Độ khó theo nhóm tuổi** ở `apps/game/src/games/ageConfig.ts:23-33`; câu cố định của Tomo ở
  `packages/content/src/phrases.ts:2-12` (mọi câu phải tạo sẵn âm thanh).
- **Offline:** E2E đã kiểm mở lại và chơi khi mất mạng (`apps/game/e2e/offline.spec.ts:4-34`), chưa kiểm dữ liệu tiến độ.

### Tra cứu bên ngoài (2026-11-18)

| Nguồn | Điều liên quan |
|---|---|
| [MDN — Storage quotas and eviction criteria](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria) | `localStorage` tối đa khoảng 5 MiB mỗi origin, ghi quá thì lỗi `QuotaExceededError`. Mặc định là "best-effort": máy thiếu chỗ thì xoá origin ít dùng nhất (LRU), xoá **cả origin một lúc** (cả `localStorage` lẫn IndexedDB). `navigator.storage.persist()`: Chrome / Safari tự duyệt theo mức tương tác, Firefox hỏi người dùng. **Safari có chặn theo dõi: origin không được chạm vào trong 7 ngày dùng trình duyệt thì dữ liệu do script tạo bị xoá.** |
| [WebKit — Updates to Storage Policy](https://webkit.org/blog/14403/updates-to-storage-policy/) | Safari 17+: origin được tới 60% dung lượng đĩa; có `persist()`, WebKit duyệt theo kinh nghiệm, ví dụ trang đã thêm vào màn hình chính. Origin ở chế độ persistent có thể không bị xoá tự động. |
| [WebKit — Full third-party cookie blocking and more](https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/) | Quy định 7 ngày; web app thêm vào màn hình chính có bộ đếm ngày dùng riêng của nó. |
| [Capacitor — Storage guide](https://capacitorjs.com/docs/guides/storage) | Trong app Capacitor, hệ điều hành **có thể thu hồi `localStorage` của WebView khi máy thiếu chỗ**; "IndexedDB cũng vậy, ít nhất trên iOS". Android có thể đánh dấu persisted. Khuyên dùng Preferences cho dữ liệu nhỏ, SQLite cho dữ liệu lớn. |
| [Capacitor — Preferences API](https://capacitorjs.com/docs/apis/preferences) | iOS dùng `UserDefaults`, Android dùng `SharedPreferences`, bản web/PWA quay về `localStorage`. Không dùng làm cơ sở dữ liệu. |

Kết luận tra cứu: dữ liệu tiến độ MVP rất nhỏ (ước tính design.md §3: dưới 50 KB mỗi hồ sơ sau một năm), nên dung lượng
không phải vấn đề; vấn đề là **bị xoá tự động** (Safari 7 ngày, máy thiếu chỗ) và IndexedDB **không** tránh được việc đó.

### Quyết định đã thống nhất (ràng buộc đầu vào)

Chỉ gồm điều có ở kịch bản mục 12.1 hoặc viết như đã quyết trong thân kịch bản:

1. **Phải chơi được hoàn toàn khi không có mạng** (12.1). Tiến độ, sao, sổ tay lưu trên máy (10.4).
2. **Chơi khách** vẫn chơi đầy đủ, tiến độ lưu trên máy; chỉ bắt đăng nhập khi mua trên web hoặc đồng bộ nhiều máy.
   **Đăng nhập lần đầu thì tiến độ trên máy được gộp vào tài khoản** (Q-26, 12.1 và 10.7).
3. Đăng nhập cần mạng; đã đăng nhập thì chơi offline bình thường, có mạng lại thì đồng bộ (10.7). Máy chủ đồng bộ
   "sao, sổ tay, lịch ôn tập giữa các máy" (10.7, bảng "Máy chủ làm những việc gì").
4. Máy chủ NestJS + PostgreSQL, cùng thư mục dự án với game (Q-25, 12.1).
5. **Ba nhóm tuổi** Mầm (5–8) / Chồi (9–14) / Cây (15+). Người chơi **chọn nhóm tuổi khi tạo hồ sơ, đổi được trong Cài đặt**.
   Nội dung kiến thức giữ nguyên, chỉ đổi cách trình bày và độ khó (mục 4).
6. **Cả ba đảo mở từ đầu, không bắt học theo thứ tự** (mục 3).
7. Cấu trúc: 1 đảo = 5–8 vùng; 1 vùng = 6–10 màn + 1 màn trùm; hết vùng thì một góc đảo "có màu trở lại" (mục 3).
8. **Sao:** 1–3 sao mỗi màn, chơi lại để lấy đủ sao (mục 9).
9. **Chuỗi ngày:** đếm ngày học liên tiếp; có **"vé nghỉ"** để không mất chuỗi khi bận (mục 9).
10. **Không phạt nặng:** sai thì gợi ý và làm lại, không mất mạng, không bị khoá màn (mục 1; `AGENTS.md` 2.5).
11. Nghe thay vì đọc, song ngữ, nhóm Mầm tự đọc cả tên nút và hướng dẫn (mục 1, mục 4; `AGENTS.md` 2.2–2.4).
12. Dữ liệu trẻ em: không gửi dữ liệu cá nhân ra ngoài khi chưa cần (`AGENTS.md` 2.7). **Q-5** (phụ huynh đồng ý khi tạo
    tài khoản cho Mầm/Chồi, Nghị định 13/2023) **còn mở** (12.2).

Phạm vi MVP lấy theo kịch bản mục 11, nhưng tiêu đề mục 11 vẫn ghi "(đề xuất)": xem CC-1.

### Điểm chốt thêm (2026-11-18)

Chủ sản phẩm **đồng ý toàn bộ đề xuất** ngày 2026-11-18: mỗi điểm dưới đây chốt theo phần **Đề xuất** của nó (phần tra cứu
và lý do giữ lại để biết vì sao). Điểm nào gắn nhãn **Còn mở** thì chưa chốt — xem `.kiro/specs/mvp-open-questions.md`.

- **Chốt thêm 2026-11-18 — Đèn Pin là "gợi ý" dùng ở mọi màn MVP** (`mvp-open-questions.md` mục 6.1): mỗi lần dùng một gợi ý riêng của trò (W1 hiện 1 chữ cái tiếp theo; G3 đặt đúng 1 khối; G4 loại 1 đáp án sai; G5 lật sáng 1 cặp trong 1 giây; Ghép Đôi loé sáng nghĩa đúng của từ đang chọn; G2 / Mưa Chữ làm chậm rơi 5 giây; J1 hiện lại nét mẫu; I1 tô sáng khối lệnh tiếp theo). Đã dùng gợi ý thì vẫn qua màn nhưng **không được 3 sao**. Bắt đầu 3 Đèn Pin; quảng cáo có thưởng +3 (tối đa 3 lần/ngày); nhóm Mầm được tặng 1 Đèn Pin mỗi ngày học. Màn trùm (giai đoạn 2) dùng chung kho này.
- ~~**Chốt thêm 2026-11-18 — Lưu tiến độ trên Android bằng `@capacitor/preferences`** (`mvp-open-questions.md` mục 6.2) qua lớp `KeyValueStore`; web vẫn dùng `localStorage`. Lần đầu mở bản app có Preferences thì chép dữ liệu cũ từ `localStorage` sang.~~ (đã thay, xem dòng dưới)
- **Chốt thêm 2026-11-18 (thay cho dòng `@capacitor/preferences` ở trên) — Dữ liệu offline trên máy dùng SQLite**, theo mẫu bản offline của medicine-management (`frontend/src/offline/db/`): một lớp `Db` chung; app Android dùng `@capacitor-community/sqlite` (bản 8.x, hợp Capacitor 8); trình duyệt dùng `sql.js` (WASM) và lưu cả file DB vào IndexedDB (gom ghi sau một khoảng trễ ngắn); test dùng `sql.js` trong bộ nhớ. Có bảng `schema_version` + hàm `migrate()` chạy khi mở DB. Lần đầu mở bản có SQLite thì chép dữ liệu cũ (`localStorage`: cài đặt, tiến độ nếu có) vào DB. `ProgressDocV1` vẫn là gói dữ liệu khi đồng bộ với máy chủ (đọc ra từ / ghi vào SQLite). File `.wasm` của sql.js phải nằm trong precache để chơi offline.
- **Chốt thêm 2026-11-18 (từ `mvp-accounts` CC-13):** `SyncResponseV1` có thêm trường tuỳ chọn `deletedProfileIds?: string[]` — hồ sơ đã bị xoá ở máy khác; máy nhận **hỏi người chơi**, không tự xoá.

**CC-1. Phạm vi MVP.** Dòng "1. MVP" của kịch bản mục 11 (tiêu đề còn ghi "đề xuất") có phải là phạm vi đã chốt không?
- **Đề xuất:** có. MVP gồm hồ sơ 3 nhóm tuổi, sao, chuỗi ngày, 2 vùng mỗi đảo; ôn tập thông minh, Nhà của Tomo, Góc phụ
  huynh, màn trùm để giai đoạn 2.
- Lý do: khớp `docs/feature-checklist.md` (các mục này đã ghi "giai đoạn 2"). Chặn: cả spec.

**CC-2. Số hồ sơ trên một máy.** Một máy có nhiều hồ sơ (anh chị em dùng chung máy tính bảng) không?
- Lựa chọn: (A) một hồ sơ, giống hiện trạng một bộ cài đặt (`settings.ts:16`); (B) nhiều hồ sơ.
- **Đề xuất:** (B), tối đa 4 hồ sơ. Có từ 2 hồ sơ thì mở app hiện màn chọn hồ sơ; 1 hồ sơ thì vào thẳng.
- Lý do: nhóm Mầm/Chồi thường dùng máy của bố mẹ, nhiều con chung một máy; kịch bản mục 4 nói "tạo hồ sơ". Giới hạn 4 để
  màn chọn vừa một khung điện thoại với nút to cho Mầm. Chặn: việc 5, 6.

**CC-3. Hồ sơ chứa gì.** Có hỏi tên không?
- **Đề xuất:** nhóm tuổi (bắt buộc) + chọn một hình đại diện từ bộ hình có sẵn (bắt buộc) + **biệt danh tuỳ chọn** (tối đa
  12 ký tự). Không hỏi ngày sinh, tuổi chính xác, giới tính. Biệt danh **chỉ lưu trên máy, không đưa vào gói đồng bộ** cho
  tới khi Q-5 được trả lời.
- Lý do: biệt danh là dữ liệu cá nhân của trẻ (`AGENTS.md` 2.7, Q-5); hình đại diện đủ để trẻ chưa biết chữ nhận ra hồ sơ
  của mình. Kịch bản 10.3 có nhắc "tên người chơi" đọc bằng giọng của máy nên biệt danh vẫn có ích. Chặn: việc 6.

**CC-4. Cài đặt nào theo hồ sơ, cài đặt nào theo máy.**
- **Đề xuất:** mọi trường của `Settings` hiện có (`settings.ts:4-14`) đi theo hồ sơ. Lần đầu chạy bản mới thì chuyển
  `tomo.settings.v1` vào hồ sơ đầu tiên (giữ nhóm tuổi đã chọn), không hỏi lại.
- Lý do: tốc độ đọc và nhóm tuổi gắn với người học (Mầm mặc định 0,8×, `settings.ts:18`). Chặn: việc 5.

**CC-5. Lưu ở đâu trên máy.**
- Lựa chọn: (A) `localStorage` như hiện trạng (`settings.ts:16`); (B) IndexedDB; (C) Capacitor Preferences trong app.
- **Đề xuất:** (A) cho web và PWA, đi qua một lớp `KeyValueStore` để đổi được; gọi `navigator.storage.persist()` sau khi
  xong màn đầu tiên. Bản app Android sau này đổi lớp này sang Capacitor Preferences; đây là **thư viện mới**
  (`@capacitor/preferences`) nên hỏi ở spec đóng gói Android, không thêm trong spec này.
- Lý do: dữ liệu < 50 KB, xa giới hạn 5 MiB; `localStorage` đồng bộ, đơn giản, đã dùng; IndexedDB bất đồng bộ, phức tạp hơn
  mà không tránh được bị xoá (cùng bị xoá theo origin, trên iOS cũng bị thu hồi, xem bảng tra cứu). Preferences là kho
  native, không bị thu hồi như WebView. Chặn: việc 5.

**CC-6. Nhắc giữ tiến độ trên Safari.** Khách chơi trên Safari, không cài lên màn hình chính, nghỉ quá 7 ngày dùng trình
duyệt thì mất tiến độ (bảng tra cứu). Có nhắc không?
- **Đề xuất:** có, một lần sau khi xong màn thứ 3, chỉ trên Safari / iOS chưa cài: Tomo nói và hiện hướng dẫn "Thêm vào màn
  hình chính" kèm nút "Đăng nhập để giữ tiến độ" (nút chỉ hiện khi `mvp-accounts` đã có). Có nút "Để sau", không hỏi lại.
- Lý do: lỗi mất dữ liệu im lặng là tệ nhất với trẻ; nhắc một lần không làm phiền. Chặn: việc 12.

**CC-7. Cảnh mở đầu của Tomo (mục 3: 30 giây, lồng tiếng, có nút Bỏ qua) có trong MVP không?**
- **Đề xuất:** có, bản đơn giản: 3–4 khung hình tĩnh, lời Tomo đọc bằng âm thanh tạo sẵn + phụ đề, nút "Bỏ qua" luôn hiện.
  Mỗi hồ sơ xem tự động một lần; xem lại được trong Cài đặt.
- Lý do: mở đầu cho trẻ biết vì sao đi qua các đảo; bản hình tĩnh rẻ, chạy offline. Hình phụ thuộc **Q-6** (phong cách hình):
  trước khi có hình thì dùng emoji / khung màu như màn hiện tại. Chặn: việc 7.

**CC-8. Số màn mỗi vùng ở MVP và ai soạn danh sách màn.**
- **Đề xuất:** spec này làm **định dạng** vùng / màn + bộ kiểm hợp lệ + **2 vùng mẫu mỗi đảo, mỗi vùng 6 màn** dựng từ từ
  đã có (en 16, ja 16, it 20). Danh sách màn thật soạn theo Q-4 (ai soạn nội dung), ở việc nội dung riêng.
- Lý do: mục 3 yêu cầu 6–10 màn mỗi vùng, 6 là mức thấp nhất; số từ hiện có chỉ đủ cho mẫu. Chặn: việc 3.

**CC-9. Màn trùm cuối vùng có trong MVP không?**
- **Đề xuất:** không. `docs/feature-checklist.md` đã ghi "giai đoạn 2"; vùng MVP kết thúc ở màn thường cuối cùng. Định dạng
  dữ liệu vẫn có loại màn `boss` để giai đoạn 2 thêm vào mà không đổi định dạng.
- Lý do: màn trùm trộn 3–4 khuôn trò (mục 5.6), cần đủ trò của `mvp-games` trước. Chặn: việc 3, 8.

**CC-10. Luật mở màn trong một vùng.** Nguyên tắc "không bị khoá màn" (mục 1) là thua không bị chặn; còn đi theo thứ tự thì
chưa chốt.
- Lựa chọn: (A) mọi màn mở sẵn như hiện trạng (`IslandView.vue:16-26`); (B) mở lần lượt.
- **Đề xuất:** (B): màn 1 của mỗi vùng mở sẵn; **xong màn trước (được ≥ 1 sao) thì mở màn sau**; màn đã mở luôn chơi lại
  được. Vì mọi trò hiện tại kết thúc đều cho ít nhất 1 sao (`MatchGame.ts:23-27`, `RainView.vue:57`), "xong" nghĩa là chơi
  hết màn, không phải thắng.
- Lý do: trẻ nhỏ cần lối đi rõ ràng; không có điều kiện điểm nên không thành phạt. Chặn: việc 4, 8.

**CC-11. Luật mở vùng.**
- **Đề xuất:** vùng 1 của mỗi đảo mở sẵn; **vùng sau mở khi xong màn cuối của vùng trước**. Ba đảo luôn mở (quyết định 6).
- Lý do: cùng luật với CC-10, dễ hiểu. Chặn: việc 4, 8.

**CC-12. Đổi nhóm tuổi thì sao và tiến độ có giữ không?**
- **Đề xuất:** giữ nguyên sao, màn đã mở và chuỗi ngày; chỉ đổi độ khó cho các lần chơi sau.
- Lý do: mục 4 nói nội dung kiến thức giữ nguyên khi đổi nhóm; xoá tiến độ là phạt nặng. Chặn: việc 4.

**CC-13. "Nhiệm vụ hôm nay" ở MVP gồm gì?** Mục 9 ghi "3 màn + 1 trận Mưa Chữ ôn tập, ~10 phút" và "Bóng Quên làm mưa
bằng những từ sắp quên", phần "sắp quên" cần ôn tập thông minh (giai đoạn 2).
- **Đề xuất:** 3 màn = 3 màn đã mở mà chưa xong (hoặc chưa đủ 3 sao) theo thứ tự trên bản đồ, ưu tiên đảo chơi gần nhất;
  + 1 trận Mưa Chữ dùng các từ của những màn đã chơi, ưu tiên từ sai nhiều (không theo lịch 1-3-7-14). Hồ sơ chưa chơi màn
  nào thì trận Mưa Chữ lấy từ màn 1. Nhiệm vụ tạo một lần đầu ngày, không đổi trong ngày; xong cả 4 thì Tomo khen.
- Lý do: giữ đúng hình dạng mục 9, không cần lịch ôn. Chặn: việc 4, 10.

**CC-14. Một ngày được tính vào chuỗi khi nào?**
- **Đề xuất:** khi **xong ít nhất 1 màn** bất kỳ (kể cả trận Mưa Chữ ôn tập) trong ngày; không cần xong cả nhiệm vụ.
- Lý do: không phạt nặng; trẻ Mầm có ngày chỉ chơi được một màn. Chặn: việc 2.

**CC-15. Mốc đổi ngày và múi giờ.**
- **Đề xuất:** ngày theo **lịch giờ địa phương của máy**, đổi ngày lúc 00:00; lưu dạng chuỗi `YYYY-MM-DD`, không lưu theo
  UTC. Không chống chỉnh đồng hồ máy.
- Lý do: trẻ hiểu "hôm nay" theo đồng hồ nhà mình; chống gian lận không đáng công cho một game học không có bảng xếp hạng.
  Đi qua múi giờ khác có thể được / mất một ngày, chấp nhận. Chặn: việc 2.

**CC-16. Ghi kết quả từng từ cho giai đoạn 2.**
- **Đề xuất:** có: mỗi từ đếm số lần gặp, số lần sai, ngày gặp gần nhất. Không làm lịch ôn.
- Lý do: khi làm ôn tập thông minh ở giai đoạn 2 đã có lịch sử; dữ liệu nhỏ (khoảng 30 byte mỗi từ). Dùng luôn cho CC-13.
  Chặn: việc 2, 9.

**CC-17. Vé nghỉ: nhận thế nào, giữ tối đa bao nhiêu, dùng ra sao?**
- **Đề xuất:** hồ sơ mới có 1 vé; cứ đủ 7 ngày chuỗi thì được thêm 1 vé; giữ tối đa 2. **Tự dùng**: bỏ lỡ ngày nào thì một vé
  bù ngày đó, miễn số ngày bỏ lỡ liên tiếp ≤ số vé đang có; không đủ vé thì chuỗi về 0 (vé còn lại giữ nguyên). Tomo báo "Vé
  nghỉ đã giữ chuỗi của bạn".
- Lý do: tự dùng thì trẻ không phải nhớ bật; tối đa 2 để chuỗi vẫn có ý nghĩa. Luật được tính lại từ danh sách ngày đã học
  (design §4.2), nên gộp giữa các máy không lệch. Chặn: việc 2, 11.

**CC-18. Giới hạn thời gian chơi trong MVP.** Mục 4: Mầm "phụ huynh đặt (mặc định 20 phút/ngày)", Chồi "nhắc nghỉ sau 30
phút". Góc phụ huynh (nơi đặt giới hạn) là giai đoạn 2.
- **Đề xuất:** MVP đếm phút chơi mỗi ngày theo hồ sơ. Chồi: Tomo nhắc nghỉ khi đủ 30 phút, chơi tiếp được. Mầm: đủ 20 phút
  thì Tomo nói nghỉ, muốn chơi tiếp phải qua **cổng phụ huynh** (một phép tính, như mục 9 mô tả cho Góc phụ huynh), mở thêm
  20 phút. Chỉnh số phút để giai đoạn 2. Cây không giới hạn.
- Lý do: giữ đúng mặc định mục 4 mà chưa cần cả Góc phụ huynh. Chặn: việc 12.

**CC-19. Xoá hồ sơ.**
- **Đề xuất:** có, trong Cài đặt, qua cổng phụ huynh (phép tính) và hỏi xác nhận hai lần. Xoá trên máy; hồ sơ đã đồng bộ thì
  việc xoá trên máy chủ thuộc `mvp-accounts`.
- Lý do: tránh trẻ lỡ tay xoá tiến độ của anh chị. Chặn: việc 6.

**CC-20. Quy tắc gộp khi đồng bộ và khi đăng nhập lần đầu** (quyết định 2 chỉ nói "gộp", chưa nói gộp thế nào).
- **Đề xuất:** gộp theo từng trường, không mất dữ liệu (design §5): sao lấy **cao nhất**; ngày học lấy **hợp**; bộ đếm cộng
  theo từng máy; cài đặt và thông tin hồ sơ lấy bản sửa **sau cùng** theo thời điểm sửa. Hồ sơ khớp nhau theo `profileId`;
  hai hồ sơ khác `profileId` (ví dụ cùng một trẻ tạo hồ sơ trên hai máy) **không tự gộp**; tài khoản giữ cả hai. Gộp hai
  hồ sơ bằng tay để sau MVP.
- Lý do: hàm gộp giao hoán, kết hợp, chạy lại không đổi kết quả, nên máy và máy chủ gộp theo thứ tự nào cũng ra một kết quả,
  không cần hỏi người chơi "giữ bản nào". Chặn: việc 2 (hàm gộp); hợp đồng với `mvp-accounts`.

**CC-21. Đặt code tiến độ dùng chung với máy chủ ở đâu.**
- Lựa chọn: (A) `packages/content/src/progress/` (kiểu dùng chung hiện đặt ở `packages/content`, `docs/ai/40-conventions.md`
  §2); (B) gói mới `packages/progress`.
- **Đề xuất:** (A), xuất qua `@study/content`.
- Lý do: không thêm gói mới; máy chủ đằng nào cũng dùng `@study/content` (kịch bản 10.7). Chặn: việc 1.

## Thuật ngữ

- **Hồ sơ**: một người chơi trên máy: nhóm tuổi, hình đại diện, (biệt danh), cài đặt, tiến độ. Khoá là `profileId` (UUID).
- **Đảo**: một môn (`Subject`: `en`, `ja`, `it`). **Vùng**: một chương của đảo. **Màn**: một lần chơi một trò với một nhóm
  từ; có mã cố định `levelId`.
- **Xong màn**: chơi hết màn, nhận kết quả 1–3 sao.
- **Khoá ngày**: chuỗi `YYYY-MM-DD` theo lịch giờ máy (CC-15).
- **Ngày học**: khoá ngày có ít nhất một màn xong (CC-14).
- **Gói tiến độ**: dữ liệu một hồ sơ ở dạng JSON có số phiên bản (`schema`), dùng để lưu trên máy và đồng bộ.
- **Gộp**: hàm `mergeProgress(a, b)` trả gói gộp theo CC-20.
- **Cổng phụ huynh**: câu hỏi một phép tính để trẻ nhỏ không tự qua.

## Yêu cầu

### Yêu cầu 1 — Hồ sơ người chơi

**User story:** Là người chơi (hoặc phụ huynh), tôi muốn có hồ sơ riêng với nhóm tuổi của mình để game hợp tuổi và giữ tiến
độ của riêng tôi.

1. Lần đầu mở game (chưa có hồ sơ): màn tạo hồ sơ hỏi nhóm tuổi (3 nút to có hình, tên nhóm được đọc to), chọn hình đại
   diện, (biệt danh tuỳ chọn, CC-3). Xong thì vào cảnh mở đầu (Yêu cầu 2) hoặc trang chủ.
2. Máy đã có `tomo.settings.v1` (người chơi bản cũ): tự tạo hồ sơ đầu tiên mang cài đặt đó, không hỏi lại (CC-4).
3. Có từ 2 hồ sơ (CC-2): mở game hiện màn chọn hồ sơ (hình đại diện to, đọc biệt danh nếu có); trang chủ có nút đổi hồ sơ.
   Đạt số tối đa thì ẩn nút "Thêm hồ sơ".
4. Đổi nhóm tuổi trong Cài đặt đổi độ khó (`ageConfig.ts`) và tốc độ mặc định; tiến độ theo CC-12.
5. Xoá hồ sơ theo CC-19.
6. Mỗi hồ sơ có cài đặt riêng (CC-4); đổi hồ sơ thì giọng, tốc độ, ẩn tiếng Việt đổi theo ngay.

### Yêu cầu 2 — Cảnh mở đầu (chỉ khi CC-7 chọn có)

1. Hồ sơ mới xem cảnh mở đầu một lần, tối đa khoảng 30 giây, lời Tomo đọc bằng âm thanh tạo sẵn kèm phụ đề tiếng Việt và câu
   chào ba thứ tiếng (mục 3).
2. Nút "Bỏ qua" luôn hiện, bấm được bằng bàn phím; bỏ qua hay xem hết đều ghi "đã xem".
3. Xem lại được từ Cài đặt. Chạy được khi không có mạng.

### Yêu cầu 3 — Bản đồ đảo → vùng → màn

**User story:** Là người chơi, tôi muốn thấy các vùng và màn của một đảo, màn nào đã xong, mấy sao, màn nào chơi tiếp.

1. Trang chủ: 3 đảo luôn mở (quyết định 6); mỗi đảo hiện tổng sao đã lấy / tổng sao có thể lấy.
2. Màn đảo thay danh sách trò hiện tại (`IslandView.vue:16-26`) bằng bản đồ: các vùng theo thứ tự, mỗi vùng có tên tiếng
   Việt + tên bằng ngôn ngữ đang học (thuộc tính `lang`), các màn nối thành đường đi.
3. Mỗi nút màn cho biết: đang khoá / mở / đã xong, số sao tốt nhất (0–3), màn "chơi tiếp" được làm nổi bật. Trạng thái khoá
   không chỉ báo bằng màu (có biểu tượng và nhãn cho trình đọc màn hình).
4. Chạm màn đang khoá: Tomo đọc lời nhắc (ví dụ "Xong màn trước để mở màn này nhé"), không mở trò.
5. Vùng xong hết màn thì vùng đó "có màu trở lại" (quyết định 7).
6. Nhóm Mầm: tên vùng, tên màn và trạng thái được đọc to khi chạm (quyết định 11). Bố cục dọc trên điện thoại, ngang trên máy
   tính (kịch bản 10.6); nút chạm ≥ 48px.

### Yêu cầu 4 — Luật mở màn và mở vùng

1. Màn và vùng mở theo CC-10, CC-11; luật là hàm TS thuần tính từ gói tiến độ + danh sách màn, không lưu cờ "đã mở".
2. Màn đã mở không bao giờ bị khoá lại (kể cả khi đổi nhóm tuổi, khi nội dung thêm màn mới vào giữa vùng: màn mới mở nếu màn
   ngay trước nó đã xong).
3. Thua / ít sao không làm khoá màn nào (quyết định 10).

### Yêu cầu 5 — Lưu kết quả màn

**User story:** Là người chơi, tôi muốn sao của mình được giữ lại, chơi lại được để lấy thêm sao.

1. Khi một trò kết thúc, nó phát kết quả theo hợp đồng `LevelResult` (design §6). Spec này ghi: sao tốt nhất (chỉ tăng, không
   giảm), lần xong đầu tiên, số lần chơi, ngày học hôm nay, kết quả từng từ (CC-16), phần nhiệm vụ hôm nay đã xong.
2. Bảng kết quả có thêm nút "Màn tiếp" khi màn sau vừa mở hoặc đã mở; "Về đảo" quay lại bản đồ, cuộn tới màn vừa chơi.
3. Ghi xong trước khi hiện bảng kết quả; tắt app ngay sau đó vẫn còn kết quả.
4. Trò chơi tự do ngoài bản đồ (nếu `mvp-games` giữ) không ghi sao màn.

### Yêu cầu 6 — Nhiệm vụ hôm nay

1. Trang chủ có thẻ "Nhiệm vụ hôm nay" theo CC-13: danh sách việc, dấu đã xong, nút "Chơi" mở việc kế tiếp.
2. Nhiệm vụ tạo một lần khi mở hồ sơ lần đầu trong ngày (khoá ngày CC-15), không đổi trong ngày; qua ngày thì tạo mới.
3. Xong hết thì Tomo khen một lần (lời đọc + hiệu ứng nhẹ), thẻ hiện "Đã xong hôm nay".
4. Tomo đọc nội dung nhiệm vụ khi mở thẻ (nhóm Mầm tự đọc).

### Yêu cầu 7 — Chuỗi ngày và vé nghỉ

1. Trang chủ hiện số ngày chuỗi hiện tại và số vé nghỉ; chạm vào thì Tomo đọc giải thích.
2. Chuỗi và vé tính theo CC-14, CC-15, CC-17 bằng hàm thuần từ danh sách ngày học, không lưu bộ đếm riêng.
3. Mở game sau khi vé đã bù ngày bỏ lỡ: Tomo báo một lần. Chuỗi về 0: Tomo động viên, không dùng lời chê.
4. Kỷ lục chuỗi dài nhất được giữ và hiện cạnh chuỗi hiện tại.

### Yêu cầu 8 — Lưu trên máy, không cần mạng

1. Mọi dữ liệu tiến độ lưu trên máy theo CC-5; chơi, mở màn, nhận sao, nhiệm vụ, chuỗi chạy đầy đủ khi không có mạng.
2. Dữ liệu có số phiên bản; bản mới đọc được dữ liệu bản cũ bằng hàm chuyển đổi (migration) có test. Dữ liệu hỏng hoặc không
   đọc được: **không ghi đè**, giữ bản gốc ở khoá dự phòng, tạo trạng thái trống, ghi lỗi ra console (không có dữ liệu cá nhân).
3. Ghi lỗi do hết chỗ (`QuotaExceededError`): game vẫn chơi được, Tomo báo "Máy hết chỗ, tiến độ hôm nay chưa lưu được".
4. Mở game ở hai tab: tab này ghi thì tab kia nhận (sự kiện `storage`) và gộp, không mất kết quả của tab nào.
5. Xin lưu bền (`navigator.storage.persist()`) theo CC-5; bị từ chối thì vẫn chạy bình thường. Nhắc giữ tiến độ trên Safari
   theo CC-6.

### Yêu cầu 9 — Hợp đồng đồng bộ (cho `mvp-accounts`)

**User story:** Là phụ huynh đã đăng nhập, tôi muốn tiến độ của con trên điện thoại và máy tính là một.

1. Spec này định nghĩa và kiểm thử: kiểu gói tiến độ `ProgressDocV1`, gói gửi đồng bộ `SyncRequestV1` / `SyncResponseV1`,
   hàm `mergeProgress`, hàm `migrateProgress` (design §5). Spec `mvp-accounts` dùng đúng các kiểu và hàm này ở máy chủ,
   không viết lại.
2. `mergeProgress` giao hoán, kết hợp và chạy lại không đổi (test bảng trên các tổ hợp); gộp không làm giảm sao, không làm mất
   ngày học, không đếm trùng.
3. Đăng nhập lần đầu: mọi hồ sơ trên máy được gửi lên và gộp (quyết định 2, CC-20). Spec này chỉ cung cấp hàm lấy gói và hàm
   nhận gói đã gộp; gọi mạng thuộc `mvp-accounts`.
4. Gói đồng bộ không chứa biệt danh (CC-3), không chứa email, số điện thoại, thông tin thiết bị ngoài `deviceId` ngẫu nhiên.
5. Gói có `schema` cao hơn bản app hiểu: app không ghi đè dữ liệu đó, ngừng đồng bộ hồ sơ đó và báo "Cập nhật game để đồng bộ".

### Yêu cầu 10 — Thời gian chơi (chỉ khi CC-18 chọn có)

1. Đếm phút chơi trong trò (không tính khi app ở nền) theo hồ sơ, theo ngày.
2. Nhắc nghỉ / cổng phụ huynh theo CC-18; cổng phụ huynh dùng chung với xoá hồ sơ (CC-19).

### Yêu cầu 11 — Nghe, song ngữ, nhóm tuổi trên các màn mới

1. Mọi câu mới của Tomo nằm trong `packages/content/src/phrases.ts` để tạo sẵn âm thanh; tên vùng / màn có trong danh sách câu
   đọc (`collectSpeech`).
2. Nhóm Mầm: đọc tên nút và hướng dẫn trên màn hồ sơ, bản đồ, nhiệm vụ, chuỗi. Chồi / Cây: đọc lời Tomo, không đọc tên nút.
3. Chữ giao diện tiếng Việt, câu ngắn; chữ ngoại ngữ có `lang`.

### Yêu cầu phi chức năng

1. Logic (luật mở, chuỗi, vé, nhiệm vụ, gộp, chuyển phiên bản, kiểm hợp lệ danh sách màn) là hàm TS thuần, có unit test;
   file bị đổi đạt 100% dòng (`pnpm coverage:changed`).
2. E2E Playwright trên khổ máy tính và điện thoại: tạo hồ sơ, chơi màn, sao còn sau khi tải lại, mở màn tiếp, nhiệm vụ, chuỗi
   (giả lập ngày), nhiều hồ sơ, và **toàn bộ luồng khi mất mạng** (tạo hồ sơ, chơi, tải lại vẫn còn sao).
3. Không thêm thư viện mới.
4. Không gửi gì ra mạng trong spec này.
