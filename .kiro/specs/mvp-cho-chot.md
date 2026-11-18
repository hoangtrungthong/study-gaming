# Giai đoạn 1 (MVP) — tổng hợp "Chờ chốt"

Rà chéo ngày 2026-11-18. **Cùng ngày, chủ sản phẩm đồng ý toàn bộ đề xuất**: mục "Chờ chốt" của mỗi spec đổi thành
"Điểm chốt thêm (2026-11-18)", mọi CC-n chốt theo đề xuất của nó. Chỉ còn các điểm gắn nhãn **Còn mở** dưới đây.

## 1. Danh sách spec

| Spec | Nội dung | Số CC (đã chốt) | Phụ thuộc |
|---|---|---|---|
| [mvp-tro-choi](mvp-tro-choi/requirements.md) | G2 Hứng Sao, G3 Xếp Câu, G4 Nghe Chọn, G5 Lật Thẻ, W1 Viết Lại Từ, J1 Vẽ Kana, I1 Đưa Bit Về Nhà; dữ liệu 2 vùng/đảo | 27 | Trả `LevelResult` cho tiến độ |
| [mvp-tien-do-hoc](mvp-tien-do-hoc/requirements.md) | Hồ sơ, bản đồ vùng/màn, lưu sao, nhiệm vụ hôm nay, chuỗi ngày, cảnh mở đầu, giới hạn giờ chơi | 21 | Định nghĩa `ProgressDocV1` + hợp đồng đồng bộ cho tài khoản |
| [mvp-mua-ban](mvp-mua-ban/requirements.md) | Gói bỏ quảng cáo: chuyển khoản VietQR + SePay, duyệt tay, Google Play Billing, trang quản trị | 24 | Cần bảng người dùng + đăng nhập của **mvp-tai-khoan** |
| [mvp-quang-cao](mvp-quang-cao/requirements.md) | AdMob (app), AdSense (web), 2 tầng công tắc, luật theo nhóm tuổi, quảng cáo có thưởng | 17 | Đọc `entitlement.noAds` của mua bán |
| [mvp-android](mvp-android/requirements.md) | Capacitor Android, ký app, bàn phím/IME, âm thanh, Google Play | 20 | Cần âm thanh tạo sẵn (xem 2.5) |
| [mvp-tai-khoan](mvp-tai-khoan/requirements.md) | Máy chủ NestJS + PostgreSQL trên Docker, đăng nhập Google + email OTP, đồng bộ, xoá tài khoản | 29 (đã chốt) | Hiện thực hợp đồng đồng bộ của `mvp-tien-do-hoc`; tạo `users`, `audit_logs` cho `mvp-mua-ban` |

## 2. Điểm xung đột / liên quan nhiều spec (cần chốt trước)

### 2.1 Nhóm tuổi khai báo trên Google Play — **Đã chốt 2026-11-18: gồm cả "5 tuổi trở xuống"**
- `mvp-android` CC-18 đề xuất: mọi nhóm từ "5 tuổi trở xuống" tới 18+ (cả app theo chính sách Families).
- `mvp-quang-cao` CC-6 đề xuất: từ 6–8 tuổi trở lên.
- Kịch bản: nhóm Mầm là khoảng **5–8 tuổi**, nên nhóm "5 tuổi trở xuống" có liên quan.

### 2.2 Hỏi tuổi người chơi — **Đã chốt** theo đề xuất gộp bên dưới
- `mvp-tien-do-hoc` CC-3: hồ sơ chọn **nhóm tuổi** (Mầm / Chồi / Cây), không hỏi năm sinh.
- `mvp-quang-cao` CC-7: màn hỏi **năm sinh** trung lập (yêu cầu của chính sách Families khi app có cả trẻ em lẫn người lớn); lên nhóm Cây phải qua khoá phụ huynh.
- Cần chọn một cách dùng chung (đề xuất gộp: hỏi năm sinh một lần khi tạo hồ sơ, tự suy ra nhóm tuổi, cho đổi nhóm qua khoá phụ huynh).

### 2.3 Đèn Pin (phần thưởng của quảng cáo có thưởng) — **Đã chốt 2026-11-18** theo đề xuất ở mục 6.1
- `mvp-quang-cao` dùng "+3 Đèn Pin" làm phần thưởng (kịch bản 10.5).
- Đèn Pin chỉ dùng ở **màn trùm**, mà `mvp-tro-choi` CC-2 và `mvp-tien-do-hoc` CC-9 đều đề xuất **không có màn trùm trong MVP**.
- Cần chọn: có màn trùm trong MVP, đổi phần thưởng khác, hay bỏ phần thưởng Đèn Pin ở MVP.

### 2.4 Dữ liệu vùng / màn — **Đã chốt**
- `mvp-tro-choi` CC-1, CC-2, CC-4 và `mvp-tien-do-hoc` CC-8 cùng đề xuất: vùng 1–2 mỗi đảo, 6 màn mỗi vùng, kiểu dữ liệu
  đặt ở `packages/content` do `mvp-tro-choi` sở hữu. Đã khớp, chỉ cần chốt một lần.

### 2.5 Âm thanh tạo sẵn là điều kiện của bản Android — việc cần làm, không phải câu hỏi
- `mvp-android` CC-10: WebView Android dường như **không có giọng của máy**, nên trong app chỉ có tiếng khi có file tạo sẵn.
- Âm thanh thật chưa tạo được (giai đoạn 0, việc 11): cần khoảng 5 GB trống. Chưa có thì app Android gần như không có tiếng.

### 2.6 Lưu dữ liệu offline — **Đã chốt 2026-11-18: SQLite** (chủ sản phẩm đổi từ đề xuất 6.2, xem mục 7)
- `mvp-tien-do-hoc` CC-5 đề xuất `localStorage` trên web và Capacitor Preferences trên Android (thư viện mới, hỏi ở spec Android).
- `mvp-android` CC-3 chưa liệt kê Capacitor Preferences. Cần chốt có thêm thư viện này không.

### 2.7 Khoá phụ huynh — **Đã chốt**
- `mvp-tien-do-hoc` CC-18, CC-19 và `mvp-mua-ban` CC-16 cùng đề xuất khoá bằng phép tính đơn giản. Đã khớp.

### 2.8 Phụ thuộc vào máy chủ (Q-29 và mvp-tai-khoan) — **Q-29 đã chốt: máy ảo Ubuntu + Docker** (`docs/deploy.md`); spec mvp-tai-khoan đang viết
- `mvp-mua-ban` (đơn hàng, webhook, quản trị) và đồng bộ của `mvp-tien-do-hoc` cần **mvp-tai-khoan**; nơi đặt cấu hình
  quảng cáo từ xa (`mvp-quang-cao` CC-2) và giới hạn thời gian chờ webhook (`mvp-mua-ban` CC-1) phụ thuộc **Q-29**.

## 3. Thứ tự làm (đã chốt theo đề xuất)

1. `mvp-tro-choi` và `mvp-tien-do-hoc` (không cần máy chủ).
2. Tạo âm thanh thật (cần dung lượng ổ đĩa) → `mvp-android`.
3. `mvp-tai-khoan` (sau khi chốt Q-29) → `mvp-mua-ban` → `mvp-quang-cao`.

## 4. Lỗi trong code hiện có các spec phát hiện

| Lỗi | Nơi | Spec ghi việc sửa |
|---|---|---|
| Sao tính xong nhưng mất khi thoát màn (chưa lưu tiến độ) | các màn chơi chỉ phát `exit` | mvp-tien-do-hoc |
| Mưa Chữ phá 0 hạt vẫn được 1 sao | `apps/game/src/games/rain/RainView.vue:57` | mvp-tien-do-hoc |
| Gboard (Android) soạn chữ cả với chữ Latin → Mưa Chữ tiếng Anh chỉ chấm sau khi bấm cách / OK | `RainView.vue:142` | mvp-android |
| Nhóm Mầm chưa có bàn phím ảo chữ to (kịch bản mục 4) | `RainView.vue` | mvp-tro-choi (CC-19) |

## 5. Câu hỏi của kịch bản được trả lời qua các đề xuất đã chốt

Đã chuyển vào mục 12.1 của `docs/kich-ban-game.md` (bản v0.9).

| Câu kịch bản | Trả lời (theo đề xuất đã chốt) | Nguồn |
|---|---|---|
| Q-2 Tên game | Giữ tên "Tomo và Quần đảo Tri Thức", dưới icon "Tomo" | `mvp-android` CC-2 |
| Q-4 Ai soạn nội dung | AI soạn nháp, chủ sản phẩm duyệt; chưa bám CEFR / JLPT | `mvp-tro-choi` CC-3 |
| Q-9 Dung lượng offline | Đóng gói toàn bộ âm thanh của giọng mặc định; chỉ chuyển Play Asset Delivery khi AAB vượt khoảng 150 MB | `mvp-android` CC-7 |
| Q-29 Nơi đặt máy chủ | Máy ảo Ubuntu trên cloud, chạy bằng Docker (cả khi phát triển) | Chủ sản phẩm, 2026-11-18 |

Vẫn mở trong kịch bản: Q-5 (phụ huynh đồng ý), Q-6 (phong cách hình — MVP dùng emoji và hình CSS), Q-7 (chấm phát âm),
Q-13, Q-14, Q-30.

## 6. Đề xuất đã chốt (chủ sản phẩm nhờ đề xuất và đồng ý, 2026-11-18)

1. **2.3 Đèn Pin — Đề xuất: biến Đèn Pin thành "gợi ý" dùng được ở mọi màn MVP**, không chỉ màn trùm. Mỗi lần dùng:
   - W1 Viết Lại Từ: hiện 1 chữ cái tiếp theo · G3 Xếp Câu: đặt đúng 1 khối · G4 Nghe Chọn: loại 1 đáp án sai ·
     G5 Lật Thẻ: lật sáng 1 cặp trong 1 giây · Ghép Đôi: loé sáng nghĩa đúng của từ đang chọn · G2 / Mưa Chữ: làm chậm
     rơi 5 giây · J1 Vẽ Kana: hiện lại nét mẫu · I1: tô sáng khối lệnh tiếp theo.
   - Dùng gợi ý vẫn được qua màn nhưng **không được 3 sao** (giữ giá trị của sao).
   - Bắt đầu với 3 Đèn Pin; xem quảng cáo có thưởng +3 (trần 3 lần/ngày như `mvp-quang-cao` CC-4d); nhóm Mầm (không có
     quảng cáo) được tặng 1 Đèn Pin mỗi ngày học.
   - Lý do: giữ đúng tên và câu chuyện ở kịch bản (Đèn Pin của Tomo soi Bóng Quên), phần thưởng có ý nghĩa ngay ở MVP,
     không phải làm thêm màn trùm; về sau màn trùm dùng chung kho Đèn Pin này.
   - Ảnh hưởng: `mvp-tro-choi` (nút gợi ý trong mỗi trò), `mvp-tien-do-hoc` (lưu số Đèn Pin trong `ProgressDocV1`),
     `mvp-quang-cao` (phần thưởng).
2. **2.6 Lưu tiến độ trên Android — Đề xuất: dùng `@capacitor/preferences`** (plugin chính thức của Capacitor, nhỏ) qua lớp
   `KeyValueStore` đã có trong `mvp-tien-do-hoc`; web vẫn dùng `localStorage`.
   - Lý do: tài liệu Capacitor khuyên không dựa vào `localStorage` / IndexedDB của WebView cho dữ liệu cần giữ lâu vì hệ điều
     hành có thể xoá khi thiếu dung lượng; Preferences lưu vào bộ nhớ riêng của app (Android `SharedPreferences`), chỉ mất khi
     gỡ app hoặc xoá dữ liệu app. Lần đầu mở bản có Preferences thì chép dữ liệu cũ từ `localStorage` sang.
   - Ảnh hưởng: `mvp-android` CC-3 (thêm `@capacitor/preferences` vào danh sách thư viện), `mvp-tien-do-hoc` CC-5.

## 7. Thay đổi sau khi chốt

- **2026-11-18 — Dữ liệu offline dùng SQLite** (chủ sản phẩm: "có thể chơi offline, nên db offline sẽ dùng sqlite"), thay cho
  `@capacitor/preferences` + `localStorage` ở mục 6.2. Theo mẫu bản offline của medicine-management (`frontend/src/offline/db/`):
  lớp `Db` chung; Android `@capacitor-community/sqlite` 8.x; trình duyệt `sql.js` lưu file DB vào IndexedDB; test `sql.js` trong
  bộ nhớ; `migrate()` khi mở DB. `ProgressDocV1` vẫn là gói dữ liệu đồng bộ với máy chủ. Ảnh hưởng: `mvp-tien-do-hoc`,
  `mvp-android`, `mvp-mua-ban` (cờ quyền đã mua), `mvp-tai-khoan` (đồng bộ đọc/ghi từ SQLite).
- Lưu ý vẫn còn trên web: Safari xoá dữ liệu trang web (kể cả IndexedDB) sau 7 ngày không mở nếu chưa "Thêm vào màn hình
  chính" — giữ đề xuất nhắc người chơi ở `mvp-tien-do-hoc` CC-6.

## 8. Spec mvp-tai-khoan (viết xong 2026-11-18) — 29 điểm, **đã chốt toàn bộ theo đề xuất**

- Khớp với các spec khác: API dưới tiền tố `/api` (`mvp-mua-ban` ghi chú ở `design.md`), máy chủ `server:3000`, `GET /api/health`
  (như `docs/deploy.md`); `users.role`, `audit_logs` theo lược đồ `mvp-mua-ban`; gọi `migrateProgress` / `mergeProgress` của
  `mvp-tien-do-hoc`; game lưu trạng thái tài khoản ở bảng SQLite `account_state`, `sync_outbox`.
- **Phụ thuộc chéo (đã làm):** `mvp-tai-khoan` CC-13 → `SyncResponseV1` của `mvp-tien-do-hoc` có thêm `deletedProfileIds?`.
- **Pháp lý:** Luật 91/2025/QH15 (bảo vệ dữ liệu cá nhân) có hiệu lực từ 01/01/2026, có thể thay một phần Nghị định 13/2023
  mà Q-5 đang nhắc — `mvp-tai-khoan` CC-12 đề xuất hỏi người có chuyên môn pháp lý trước khi phát hành.
