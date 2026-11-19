# Tài liệu yêu cầu — Gói bỏ quảng cáo: mua trên web và Google Play (mvp-purchases)

> Viết ngày 2026-11-18, trước khi code. Nguồn: `docs/game-design.md` mục 10.5 ("Gói bỏ quảng cáo", "Giá"), 10.7
> ("Xác nhận chuyển khoản", "Máy chủ làm những việc gì"), 12.1, 12.2.

## Giới thiệu

Bán **gói bỏ quảng cáo** (mua một lần) ở giai đoạn 1 (MVP): trên web bằng chuyển khoản ngân hàng qua mã VietQR, trên app
Android bằng Google Play Billing. Quyền "đã bỏ quảng cáo" gắn với tài khoản, dùng được ở mọi nơi và khi không có mạng.

Phạm vi spec này: mô hình quyền (entitlement), đơn chuyển khoản (mã đơn, QR, hết hạn, khớp tiền, giá ra mắt), webhook của
dịch vụ đọc biến động số dư, trang quản trị duyệt tay + nhật ký, Google Play Billing (mua, xác minh ở máy chủ, khôi phục,
hoàn tiền / huỷ), giao diện mua trên web và app, lưu quyền trên máy, xem doanh thu.

**Không thuộc spec này:**

- Hiện quảng cáo: spec `mvp-ads` (chỉ **đọc** quyền `adFree` do spec này cung cấp, kể cả việc tặng phần thưởng của
  quảng cáo có thưởng cho người đã mua).
- Đăng nhập, bảng `users`, phiên đăng nhập, khung `apps/server`: spec `mvp-accounts` (đang viết song song). Spec này chỉ
  dùng lại: người dùng hiện tại (guard đăng nhập), `users.id`, sự kiện "vừa đăng nhập / gộp khách vào tài khoản".
- Đóng gói app Android, khoá ký, phát hành lên Google Play: spec `mvp-android`.
- App Store (iOS): giai đoạn 2, làm cùng bản iOS (kịch bản 10.5).

### Hiện trạng đã rà trong code (commit `ddb53ee`)

- **Chưa có máy chủ:** `apps/server/` chưa tồn tại (`docs/ai/00-overview.md`, mục 1, dòng "`apps/server/` … **Chưa có**").
  `pnpm-workspace.yaml` đã gom `apps/*`, nên `apps/server` (do `mvp-accounts` dựng) tự vào workspace.
- **Chưa có Capacitor:** `apps/game/package.json` không có `@capacitor/*` hay plugin mua hàng nào.
- **Chưa có tài khoản, chưa có quảng cáo:** `docs/feature-checklist.md:70-72` đều ⏳ MVP.
- **Chưa có Góc phụ huynh:** `docs/feature-checklist.md:60` ghi ⏳ giai đoạn 2. Kịch bản 10.5 lại đặt nút mua của nhóm Mầm
  trong Góc phụ huynh → cần một cổng phụ huynh tối thiểu ngay ở MVP (xem CC-16).
- **Màn hình:** `apps/game/src/App.vue:13` giữ biến `screen` (không router), các màn `home / island / match / rain /
  settings` (`App.vue:36-40`). Màn Cài đặt: `apps/game/src/views/SettingsView.vue` (tiêu đề `:38`, nhóm "Giọng đọc" `:61`).
- **Nhóm tuổi:** `apps/game/src/settings.ts:5` (`ageGroup: AgeGroup`), lưu `localStorage` khoá `tomo.settings.v1`
  (`settings.ts:16`), mặc định `choi` (`settings.ts:21`).
- **Offline:** precache Workbox `apps/game/vite.config.ts:26` (`js,css,html,svg,png,woff2,json`); dữ liệu người chơi
  lưu `localStorage`. Gọi API máy chủ không được precache (đúng ý: trạng thái mua phải lấy từ máy chủ rồi lưu trên máy).
- **Tiền lệ trong medicine-management (chỉ tham khảo, khác stack PHP):** webhook SePay xác thực header
  `Authorization: Apikey …` so sánh hằng thời gian, chống trùng theo `id` của SePay, chỉ nhận `transferType = in`, bỏ giao
  dịch vào tài khoản khác (`backend/app/Services/Billing/Webhooks/SepayWebhook.php`); webhook Casso v1 (`Secure-Token`) và
  v2 (HMAC-SHA512) (`CassoWebhook.php`); ghi tiền idempotent theo (nhà cung cấp, mã giao dịch), khoá đơn `lockForUpdate`,
  thiếu tiền → `underpaid`, đơn đã xong → giao dịch `extra`, không khớp mã → `unmatched` chờ gán tay
  (`backend/app/Services/Billing/PaymentRecorder.php:16-32`); QR lấy ảnh từ `img.vietqr.io`
  (`backend/app/Services/Billing/Gateways/BankTransferGateway.php`, `qrUrl`).

### Quyết định đã thống nhất (ràng buộc đầu vào)

Chỉ gồm điều đã chốt trong kịch bản mục 12.1 và phần thân đã ghi "đã chốt".

1. **Có bán gói bỏ quảng cáo từ MVP** (Q-16). Mua **một lần**, bỏ toàn bộ quảng cáo; người mua vẫn nhận các phần thưởng
   của quảng cáo có thưởng mà không phải xem (10.5).
2. **Trên app:** mua qua Google Play và App Store bằng plugin thanh toán cho Capacitor; có nút **"Khôi phục giao dịch"**.
   MVP làm **Google Play**; App Store làm cùng bản iOS ở giai đoạn 2 (10.5).
3. **Trên web: chuyển khoản ngân hàng** (Q-19). Người dùng **phải đăng nhập**, bấm "Bỏ quảng cáo", màn hình hiện **mã QR
   chuyển khoản (VietQR)** có sẵn **số tiền** và **mã đơn** trong nội dung chuyển khoản (10.5).
4. **Xác nhận chuyển khoản: cả hai cách** (Q-20, 10.7):
   - Tự động: dịch vụ đọc biến động số dư (**SePay hoặc Casso**) gọi về máy chủ; máy chủ khớp **mã đơn trong nội dung** và
     **số tiền** → mở khoá ngay, app/web nhận tin **trong vài giây**.
   - Thủ công: trang quản trị liệt kê đơn chưa khớp (ghi sai nội dung, chuyển thiếu/thừa, dịch vụ lỗi); người quản lý so
     sao kê rồi bấm **Duyệt** hoặc **Từ chối (kèm lý do)**. Mỗi lần duyệt tay ghi lại **ai duyệt, lúc nào**.
   - Đơn chưa thanh toán **tự hết hạn sau 24 giờ**.
   - Người mua thấy trạng thái đơn ("Đang chờ xác nhận", "Đã mở khoá") và có **nút liên hệ hỗ trợ**.
5. **Mua một nơi, dùng mọi nơi** (Q-22): quyền gắn với **tài khoản**. Mua trên app khi chưa đăng nhập thì quyền gắn với
   tài khoản cửa hàng (khôi phục được); đăng nhập sau thì **gộp vào tài khoản**.
6. **Chơi offline:** trạng thái đã mua lưu trên máy; mất mạng vẫn không có quảng cáo (10.5).
7. **Quy định cửa hàng:** trong app Android/iOS **không hiện, không nhắc tới chuyển khoản ngân hàng**; trong app chỉ bán
   qua Google Play / App Store; **không nhắc giá web rẻ hơn** (chỉ giới thiệu trên trang web) (10.5).
8. **Nhóm Mầm:** vẫn mua được để ủng hộ, nhưng **nút mua đặt trong Góc phụ huynh** để trẻ không tự bấm (10.5).
9. **Giá** (Q-24): web **59.000đ**; app **79.000đ** (hoặc mức gần nhất trong bảng giá của cửa hàng); **giá ra mắt 39.000đ
   trên web trong tháng đầu**.
10. **Máy chủ NestJS + PostgreSQL** cùng thư mục dự án (Q-25). Máy chủ làm: đơn chuyển khoản (tạo đơn + QR, nhận tin
    SePay/Casso, trang duyệt tay), **xác minh giao dịch Google Play ở máy chủ của cửa hàng** để chống mua giả, quyền "đã bỏ
    quảng cáo" trả về cho app/web, **trang quản trị** (duyệt đơn, tra người dùng, xem doanh thu) (10.7).
11. **Chơi khách** (Q-26): chỉ bắt đăng nhập khi mua trên web (hoặc đồng bộ nhiều máy).

**Hệ quả bắt buộc (không phải quyết định mới):**

- Phí 15% của Google Play chỉ áp khi **đăng ký chương trình phí 15%** trong Play Console (10.5, bảng giá) → việc vận hành,
  ghi vào tài liệu.
- Giá trên Google Play đặt trong Play Console, không đồng bộ tự động với giá web.
- Hoàn tiền giao dịch Google Play do Google xử lý (người dùng xin hoàn với Google, hoặc nhà phát triển hoàn trong
  Play Console); máy chủ phải biết giao dịch bị huỷ/hoàn để thu hồi quyền.
- **Cập nhật 2026-11-18 — Q-29 đã chốt:** máy chủ là một máy ảo **Ubuntu trên cloud**, chạy bằng **Docker** (Docker Compose), chạy liên tục — không có chuyện máy chủ ngủ. Chi tiết: `docs/deploy.md`, spec `mvp-accounts`. Đoạn dưới viết lúc Q-29 còn mở: Nếu chọn gói miễn phí tự ngủ (Render: ngủ sau 15 phút), lần gọi webhook
  đầu có thể chờ vài chục giây → ảnh hưởng CC-1 (thời gian chờ của dịch vụ đối soát) và CC-14.

### Điểm chốt thêm (2026-11-18)

Chủ sản phẩm **đồng ý toàn bộ đề xuất** ngày 2026-11-18: mỗi điểm dưới đây chốt theo phần **Đề xuất** của nó (phần tra cứu
và lý do giữ lại để biết vì sao). Điểm nào gắn nhãn **Còn mở** thì chưa chốt — xem `.kiro/specs/mvp-open-questions.md`.

- **Chốt thêm 2026-11-18 — Dữ liệu offline dùng SQLite** (xem `mvp-progress`): cờ quyền đã mua trên máy (CC-22) lưu trong DB SQLite đó thay vì `localStorage`.

**Chuyển khoản trên web**

- **CC-1 — Dịch vụ đọc biến động số dư: SePay, Casso, hay cả hai?**
  Tra cứu:
  - SePay ([bảng giá](https://sepay.vn/bang-gia.html)): gói **Miễn phí 0đ/tháng, 50 giao dịch/tháng** (vượt thì tính sau),
    không giới hạn số tài khoản; gói Startup từ 120.000đ/tháng. 12 ngân hàng (Vietcombank, VPBank, ACB, Sacombank,
    VietinBank, MBBank, BIDV, MSB, TPBank, KienLongBank, Shinhan, OCB). Webhook ([tài liệu](https://docs.sepay.vn/tich-hop-webhooks.html)):
    chờ phản hồi tới **30 giây**, thử lại 7 lần trong ~33 phút, khuyên chống trùng theo `id`; có API giao dịch để đối soát bù.
  - Casso ([bảng giá Flow](https://casso.vn/flow/bang-gia/)): **không có gói miễn phí lâu dài** (dùng thử 14 ngày / 100 giao
    dịch), trả theo năm, không hoàn tiền. Webhook v2 ([tài liệu](https://developer.casso.vn/webhook/thiet-lap-webhook-thu-cong)):
    ký bằng khoá bảo mật, **timeout 5 giây**, thử lại 17 lần trong 24 giờ.
  - medicine-management đã làm cả hai (`SepayWebhook.php`, `CassoWebhook.php`).
  **Đề xuất:** chỉ **SePay** ở MVP, viết qua một giao diện `BankFeedDriver` để thêm Casso sau không phải sửa phần khớp đơn.
  Lý do: có gói miễn phí đủ cho giai đoạn thử nghiệm; timeout 30 giây chịu được máy chủ ngủ (Q-29), còn 5 giây của Casso thì
  không; ít mã hơn để kiểm.

- **CC-2 — Cách xác thực webhook SePay: API Key hay HMAC-SHA256?**
  SePay cho chọn HMAC-SHA256, API Key, OAuth 2.0 hoặc không xác thực. API Key gửi `Authorization: Apikey <khoá>` (đã
  dùng ở medicine-management). Chi tiết header/chuỗi ký của HMAC nằm ở trang "Xác thực webhook" của developer.sepay.vn,
  chưa đọc được (trang trả 404 khi tra) → phải kiểm lúc làm.
  **Đề xuất:** **API Key** + so sánh hằng thời gian + chỉ nhận HTTPS + kiểm số tài khoản nhận khớp cấu hình; thêm danh sách
  IP của SePay (tài liệu có công bố) làm lớp phụ, bật/tắt bằng biến môi trường. Lý do: định dạng đã biết và đã chạy thật ở
  medicine-management; HMAC chuyển sang sau khi có tài liệu rõ (driver tách riêng nên đổi dễ).

- **CC-3 — Tài khoản ngân hàng nhận tiền và nơi cấu hình.**
  Cần: ngân hàng (phải nằm trong danh sách SePay hỗ trợ ở CC-1), mã BIN NAPAS, số tài khoản, tên chủ tài khoản; tài khoản
  cá nhân hay tài khoản hộ kinh doanh / doanh nghiệp (liên quan CC-21).
  **Đề xuất:** cấu hình bằng **biến môi trường máy chủ** (`BANK_BIN`, `BANK_ACCOUNT_NO`, `BANK_ACCOUNT_NAME`,
  `BANK_SHORT_NAME`), không làm màn sửa trong trang quản trị ở MVP. Loại tài khoản: hỏi chủ sản phẩm. Lý do: ít khi đổi,
  đổi sai thì tiền vào nhầm chỗ, không nên sửa được qua giao diện web.

- **CC-4 — Tạo mã VietQR bằng cách nào?**
  Lựa chọn: (a) ảnh từ `img.vietqr.io` (cách của medicine-management) — cần mạng, gửi số tài khoản + số tiền + mã đơn cho
  bên thứ ba, ảnh không hiện khi mất mạng; (b) **tự dựng chuỗi VietQR** theo chuẩn EMVCo QR của NAPAS (GUID `A000000727`,
  dịch vụ `QRIBFTTA` chuyển tới tài khoản, CRC16 ở thẻ `63`; [đặc tả EMVCo MPM](https://mvallim.github.io/emv-qrcode/docs/EMVCo-Merchant-Presented-QR-Specification-v1-1.pdf),
  [thư viện tham khảo](https://beta.pkg.go.dev/giautm.dev/emvqr)) rồi vẽ QR ngay trên máy.
  **Đề xuất:** (b). Hàm thuần `buildVietQrPayload()` trong `packages/content` (dùng chung web + server, có unit test với chuỗi
  mẫu quét được bằng app ngân hàng); vẽ SVG ở trình duyệt bằng thư viện `qrcode` (MIT) — **thư viện mới, cần chủ sản phẩm
  đồng ý** (AGENTS.md mục 6). Lý do: không phụ thuộc bên thứ ba, không lộ dữ liệu đơn, đơn đang chờ mở lại khi mất mạng vẫn
  thấy QR (người dùng có thể chuyển bằng điện thoại khác).

- **CC-5 — Định dạng mã đơn.**
  Ngân hàng hay cắt ký tự đặc biệt và đổi hoa/thường trong nội dung chuyển khoản.
  **Đề xuất:** `TOMO` + 6 ký tự Crockford Base32 bỏ ký tự dễ nhầm (vd `TOMO7K3QXP`), khớp không phân biệt hoa thường, bỏ khoảng
  trắng/dấu; nội dung chuyển khoản chỉ gồm mã đơn. Khai cùng tiền tố `TOMO` ở mục "nhận diện mã thanh toán" của SePay để có
  trường `code`. Lý do: ngắn, gõ tay được, xác suất trùng thấp (~1 tỷ tổ hợp), không lộ thông tin người dùng.

- **CC-6 — Khung thời gian giá ra mắt 39.000đ.**
  Đã chốt "tháng đầu", chưa chốt ngày bắt đầu và cách tính.
  **Đề xuất:** biến môi trường `LAUNCH_PRICE_FROM` / `LAUNCH_PRICE_UNTIL` (giờ Việt Nam), đặt bằng ngày mở bán web và +30 ngày.
  Giá tính theo **thời điểm tạo đơn** và **giữ nguyên trong 24 giờ** của đơn (đơn tạo ngày cuối vẫn trả 39.000đ). Web hiện giá
  gốc gạch ngang + "Giá ra mắt tới ngày …". Lý do: người dùng không bị đổi giá giữa chừng; không cần sửa code khi hết đợt.

- **CC-7 — Người dùng bấm mua lại khi đang có đơn chờ.**
  **Đề xuất:** dùng lại đơn đang chờ (cùng mã, cùng giá) tới khi hết hạn; mỗi tài khoản tối đa 1 đơn chờ; đã có quyền thì
  không cho tạo đơn. Có nút "Huỷ đơn" để tạo đơn mới. Lý do: tránh nhiều mã đơn cùng lúc làm người dùng chuyển nhầm mã cũ.

- **CC-8 — Chuyển thiếu tiền.**
  **Đề xuất:** không mở khoá; đơn sang `underpaid`, cộng dồn các lần chuyển cùng mã; màn đơn hiện "Còn thiếu X đ" + QR mới với
  đúng số còn thiếu (cùng mã) trong thời hạn đơn; đơn vào danh sách chờ duyệt tay. Quá hạn mà vẫn thiếu → quản trị duyệt (mở
  khoá) hoặc từ chối và hoàn tiền tay. Lý do: không mất tiền của người dùng, không mở khoá sai.

- **CC-9 — Chuyển thừa, chuyển trùng, chuyển sau khi đơn hết hạn.**
  **Đề xuất:** thừa → **mở khoá**, đánh dấu `overpaid` để quản trị hoàn phần thừa khi người dùng yêu cầu; chuyển lần hai khi
  đơn đã xong → giao dịch `extra` vào danh sách quản trị; đơn đã hết hạn mà nhận đủ tiền đúng mã → **vẫn mở khoá tự động**
  (tiền đã về, từ chối chỉ làm phiền người dùng); đơn đã bị từ chối → vào danh sách chờ duyệt tay. Lý do: ưu tiên người đã trả
  tiền; mọi trường hợp lệch đều có dấu vết cho quản trị.

- **CC-10 — Cách web biết đơn đã mở khoá "trong vài giây".**
  **Đề xuất:** khi màn đơn đang mở, gọi `GET /billing/orders/:code` mỗi 3 giây (dừng khi rời màn, ẩn tab, hoặc sau 30 phút; có
  nút "Kiểm tra lại"). Không dùng WebSocket/SSE ở MVP. Lý do: đơn giản, chạy được trên mọi nơi đặt máy chủ (Q-29), tải rất nhỏ.

- **CC-11 — Kênh "liên hệ hỗ trợ".**
  **Đề xuất:** liên kết `mailto:` tới hộp thư hỗ trợ (biến môi trường `VITE_SUPPORT_EMAIL`), tiêu đề điền sẵn mã đơn; không gửi
  kèm dữ liệu khác. Chủ sản phẩm cho biết địa chỉ email (hoặc muốn dùng Zalo OA). Lý do: không cần dịch vụ thêm; mã đơn đủ để
  tra.

**Google Play**

- **CC-12 — Plugin mua hàng cho Capacitor.**
  Tra cứu:
  - `cordova-plugin-purchase` v13 (gói Capacitor `capacitor-plugin-cdv-purchase`, MIT): Google Play Billing 8.3, StoreKit 2
    cho iOS; luồng rõ `verify()` → máy chủ → `finish()` (xác nhận); bộ xác minh tự trỏ về máy chủ mình được (Iaptic là tuỳ
    chọn trả phí) ([README](https://cdn.jsdelivr.net/npm/cordova-plugin-purchase@13.15.0/README.md),
    [bản Capacitor](https://www.iaptic.com/blog/20260407-capacitor-native-plugin)).
  - `@capgo/native-purchases` (MPL-2.0): Google Play Billing 7.x, **tự xác nhận (acknowledge) giao dịch ở máy** trên Android,
    có `appAccountToken` → `obfuscatedAccountId`, `restorePurchases()`, `getPurchases()`
    ([GitHub](https://github.com/Cap-go/capacitor-native-purchases)).
  - RevenueCat `@revenuecat/purchases-capacitor` (MIT SDK): dịch vụ miễn phí tới **2.500 USD doanh thu theo dõi/tháng**, sau đó
    1%; dữ liệu mua nằm ở bên thứ ba, vẫn cần máy chủ mình cho đơn chuyển khoản.
  **Đề xuất:** `cordova-plugin-purchase` (bản Capacitor), bộ xác minh trỏ về `POST /billing/google/verify`, không dùng Iaptic /
  RevenueCat. Lý do: cho máy chủ xác minh **trước** khi xác nhận giao dịch (đúng khuyến nghị của Google, xem
  [Billing security](https://developer.android.com/google/play/billing/security)); bản Billing mới hơn (Google buộc nâng bản
  Billing Library theo hạn hằng năm — kiểm hạn hiện hành lúc làm); dùng lại được cho App Store ở giai đoạn 2; không phí, không
  gửi dữ liệu trẻ em cho bên thứ ba. **Thư viện mới, cần đồng ý.**

- **CC-13 — Thư viện gọi Google Play Developer API ở máy chủ.**
  **Đề xuất:** `@googleapis/androidpublisher` (gói riêng của một API, có kiểu TypeScript, kèm xác thực tài khoản dịch vụ) thay vì
  gói `googleapis` đầy đủ. Lý do: gói đầy đủ rất nặng (ổ đĩa máy dev gần đầy), dự án chỉ cần `purchases.products` +
  `voidedpurchases`. **Thư viện mới, cần đồng ý.**

- **CC-14 — Biết giao dịch Google Play bị hoàn/huỷ bằng cách nào: thông báo thời gian thực (RTDN qua Pub/Sub) hay hỏi định kỳ
  Voided Purchases API?**
  RTDN cần dựng chủ đề Google Cloud Pub/Sub + endpoint nhận đẩy có kiểm token OIDC; Voided Purchases API trả các giao dịch bị
  huỷ / hoàn / chargeback trong 30 ngày gần nhất ([tài liệu](https://developers.google.com/android-publisher/voided-purchases)).
  **Đề xuất:** MVP **chỉ hỏi Voided Purchases API mỗi ngày** (lệnh định kỳ) + xác minh lúc mua; giao dịch chưa gửi được lên máy chủ
  thì app gửi lại ở lần mở sau (plugin trả lại giao dịch chưa `finish`). RTDN làm khi có iOS / lượng mua lớn. Lý do: ít hạ tầng;
  chậm tối đa 1 ngày mới thu hồi quyền là chấp nhận được với gói 79.000đ; máy chủ ngủ (Q-29) không làm lỡ thông báo.

- **CC-15 — Giao dịch Google Play mua khi chưa đăng nhập đã gắn với tài khoản A, sau đó người dùng đăng nhập tài khoản B.**
  **Đề xuất:** giữ ở tài khoản đầu tiên (A); app báo "Quyền bỏ quảng cáo trên máy này đã gắn với một tài khoản khác" (che email
  dạng `a***@gmail.com`); máy vẫn không có quảng cáo khi đăng xuất (quyền theo tài khoản cửa hàng); quản trị chuyển được quyền
  sang tài khoản khác (có ghi nhật ký). Lý do: chống một lần mua mở khoá cho nhiều tài khoản; vẫn tôn trọng người đã trả tiền.

**Giao diện**

- **CC-16 — Nút mua đặt ở đâu, và nhóm Chồi có cần cổng phụ huynh?**
  Đã chốt: Mầm → Góc phụ huynh. Góc phụ huynh đầy đủ là giai đoạn 2 (`docs/feature-checklist.md:60`).
  **Đề xuất:** mục **"Bỏ quảng cáo"** trong màn Cài đặt cho mọi nhóm; với **Mầm và Chồi**, mục này nằm sau **cổng phụ huynh tối
  thiểu** (một phép tính, như kịch bản mục 9 mô tả cho Góc phụ huynh) — chính là phần đầu của Góc phụ huynh, giai đoạn 2 mở rộng
  thêm; nhóm Cây vào thẳng. Thêm hàm `openAdFreeOffer()` để spec `mvp-ads` gắn liên kết "Bỏ quảng cáo" cạnh banner / sau
  quảng cáo toàn màn hình (chỉ nhóm Cây). Lý do: 9–14 tuổi vẫn là trẻ vị thành niên; App Store bắt cổng phụ huynh cho mua hàng
  trong app trẻ em (giai đoạn 2), làm từ giờ để khỏi đổi.

- **CC-17 — Chữ trong app Android cho người đã mua ở nơi khác nhưng chưa đăng nhập.**
  Quy định Payments của Google Play cấm dẫn người dùng tới cách thanh toán ngoài Google Play cho hàng số trong app; ngoại lệ
  chỉ ở EEA, Mỹ… ([chính sách Payments](https://support.google.com/googleplay/android-developer/answer/9858738)), không thấy Việt
  Nam trong các chương trình thanh toán thay thế ([danh sách](https://support.google.com/googleplay/android-developer/answer/12348241)).
  Cho dùng quyền đã mua ở nơi khác thì được phép.
  **Đề xuất:** chỉ hiện "Đã mua bằng tài khoản của bạn? **Đăng nhập** để bỏ quảng cáo." Không nhắc web, giá web, chuyển khoản,
  QR, mã đơn. Bản build Android **không chứa** mã giao diện chuyển khoản (cờ lúc build, xem design). Lý do: tránh bị từ chối
  khi duyệt app.

**Quản trị**

- **CC-18 — Trang quản trị đặt ở đâu?**
  Lựa chọn: (a) app riêng `apps/admin` (Vue + Vite, không PWA); (b) đường dẫn `/admin` trong `apps/game`; (c) AdminJS trong
  máy chủ.
  **Đề xuất:** (a). Lý do: mã quản trị không nằm trong gói game (không vào app Android, không bị precache offline, nhẹ cho người
  chơi); dùng lại Vue + test như game; (c) thêm một bộ thư viện lớn.

- **CC-19 — Xác thực quản trị.**
  **Đề xuất:** dùng đăng nhập của `mvp-accounts` (Google) + cột vai trò `users.role = 'admin'` gán bằng lệnh CLI trên máy chủ
  (không có giao diện tự cấp quyền); mọi endpoint `/admin/*` kiểm vai trò ở máy chủ; phiên quản trị hết hạn sau 12 giờ; thêm danh
  sách email quản trị cho phép trong biến môi trường làm lớp chặn thứ hai. Cột `role` phải được `mvp-accounts` đồng ý thêm
  (hoặc spec này thêm bằng migration riêng). Lý do: không thêm hệ đăng nhập thứ hai; khoá Google có 2 bước xác minh.

**Tiền và dữ liệu**

- **CC-20 — Chính sách hoàn tiền trên web.**
  **Đề xuất:** hoàn khi người dùng yêu cầu trong **7 ngày** kể từ khi mở khoá (và mọi khoản chuyển thừa/trùng bất kỳ lúc nào);
  quản trị chuyển khoản trả tay rồi bấm "Đã hoàn tiền" → thu hồi quyền nguồn web, ghi nhật ký. Google Play: theo chính sách hoàn
  tiền của Google; quyền bị thu hồi khi Google báo huỷ (CC-14). Lý do: rõ ràng, ít tranh chấp; thời hạn giống các cửa hàng.

- **CC-21 — Thuế, hoá đơn.**
  Chưa tra được quy định áp cho cá nhân / hộ kinh doanh bán nội dung số qua chuyển khoản; Google tự kê khai thuế cho giao dịch
  qua Google Play tại Việt Nam hay không cũng cần kiểm lại.
  **Đề xuất:** hỏi kế toán trước khi mở bán; MVP **không xuất hoá đơn điện tử** nhưng lưu đủ dữ liệu để xuất sau (mã đơn, số
  tiền, thời điểm nhận, nguồn); trang doanh thu xuất được tổng theo tháng. Lý do: không chặn MVP, không mất dữ liệu cần cho kê khai.

- **CC-22 — Lưu quyền trên máy: cờ thường hay có chữ ký?**
  **Đề xuất:** cờ thường trong `localStorage` (`tomo.entitlement.v1`), làm mới mỗi lần mở app có mạng và đã đăng nhập; trên
  Android còn đối chiếu giao dịch Google Play trên máy. Không ký số. Lý do: sửa tay `localStorage` chỉ làm mất doanh thu quảng cáo
  trên chính máy đó; ký số cần quản lý khoá mà không chặn được người sửa mã app.

- **CC-23 — Lưu nội dung chuyển khoản bao lâu, lưu gì.**
  AGENTS.md mục 2.7: không log nội dung chuyển khoản.
  **Đề xuất:** chỉ lưu trong bảng giao dịch: số tiền, thời điểm, mã giao dịch của dịch vụ, mã đơn tìm thấy, **nội dung cắt 140 ký
  tự** (cần cho duyệt tay); **không lưu** tên / số tài khoản người chuyển, số dư; không ghi ra log ứng dụng; xoá nội dung của giao
  dịch đã khớp sau **90 ngày** (giữ mã đơn, số tiền). Lý do: đủ cho đối soát, tối thiểu dữ liệu cá nhân (Nghị định 13/2023).

- **CC-24 — Trang doanh thu cần những gì?**
  **Đề xuất:** theo ngày / tháng: số đơn và tổng tiền web (số thật nhận), số giao dịch Google Play và **doanh thu ước tính**
  (= số giao dịch × giá niêm yết × 85%, ghi rõ "ước tính, số chính xác xem Play Console"), số hoàn/huỷ; lọc theo khoảng ngày; tải
  CSV. Lý do: đủ để theo dõi MVP; Developer API không trả số tiền thực nhận của từng giao dịch một cách đơn giản.

## Thuật ngữ

- **Quyền bỏ quảng cáo (entitlement `ad_free`)**: trạng thái "đã bỏ quảng cáo". Có khi tồn tại **ít nhất một nguồn cấp quyền**
  còn hiệu lực.
- **Nguồn cấp quyền (grant)**: một bản ghi cấp quyền từ một nguồn: `web_transfer` (đơn chuyển khoản), `google_play` (giao dịch
  Google Play), `admin` (quản trị cấp tay khi xử lý sự cố). Thu hồi một nguồn không ảnh hưởng nguồn khác.
- **Đơn (order)**: đơn mua trên web bằng chuyển khoản; có **mã đơn**, số tiền chốt lúc tạo, hạn 24 giờ.
- **Giao dịch ngân hàng (bank transaction)**: một lần tiền vào do dịch vụ đọc biến động số dư báo về.
- **Giao dịch cửa hàng (store purchase)**: một lần mua trên Google Play, định danh bằng `purchaseToken` (duy nhất toàn cầu, dùng
  làm khoá chống trùng; **không** dùng `orderId` vì giao dịch mã khuyến mại không có `orderId` — tài liệu Google).
- **Cổng phụ huynh**: câu hỏi phép tính chặn trẻ nhỏ trước khu vực mua (CC-16).
- **Bản build cửa hàng**: bản web đóng gói trong app Android (sau này iOS), bật cờ `VITE_STORE_BUILD`.

## Yêu cầu

### Yêu cầu 1 — Mô hình quyền bỏ quảng cáo (máy chủ)

**User story:** Là người chơi đã mua, tôi muốn mọi máy đăng nhập cùng tài khoản đều không có quảng cáo, dù tôi mua ở đâu.

1. Máy chủ lưu các nguồn cấp quyền; `adFree(user) = true` khi có ít nhất một nguồn `active` gắn với tài khoản đó.
2. `GET /me/entitlements` (đã đăng nhập) trả `{ adFree, sources: [{ kind, grantedAt }], checkedAt }`. Không trả số tiền, mã
   giao dịch ngân hàng hay token cửa hàng.
3. Cấp quyền và thu hồi quyền chỉ đi qua một dịch vụ duy nhất (`EntitlementService.grant / revoke`), trong transaction, ghi nhật
   ký (Yêu cầu 6).
4. Một nguồn chỉ cấp quyền một lần (idempotent): cùng đơn / cùng `purchaseToken` gọi lại không tạo nguồn mới.
5. Thu hồi một nguồn (hoàn tiền, Google huỷ) chỉ tắt nguồn đó; còn nguồn khác thì vẫn `adFree`.
6. Đã có quyền thì từ chối tạo đơn mới (HTTP 409, mã `already_ad_free`) và app/web ẩn nút mua, hiện "Bạn đã bỏ quảng cáo. Cảm ơn
   bạn!".

### Yêu cầu 2 — Đơn chuyển khoản trên web

**User story:** Là người chơi trên web, tôi muốn quét QR bằng app ngân hàng để mua, không phải gõ số tài khoản.

1. Chỉ người đã đăng nhập tạo được đơn (`POST /billing/orders`); khách bấm "Bỏ quảng cáo" thì được mời đăng nhập rồi quay lại
   đúng màn mua.
2. **Giá do máy chủ quyết**: máy chủ tính giá (59.000đ, hoặc 39.000đ trong khung giá ra mắt — CC-6) và lưu vào đơn; mọi số tiền
   trình duyệt gửi lên đều bị bỏ qua.
3. Đơn có mã đơn duy nhất (CC-5), số tiền, `expiresAt = createdAt + 24h`, trạng thái `pending`. Đơn chờ đang có thì dùng lại
   (CC-7).
4. Phản hồi gồm: mã đơn, số tiền, hạn, thông tin nhận (ngân hàng, số tài khoản, tên chủ tài khoản) và **chuỗi VietQR** (CC-4).
   Màn hình hiện QR, số tiền, nội dung chuyển khoản có nút chép, đồng hồ đếm hạn, câu "Chuyển đúng số tiền và giữ nguyên nội
   dung" (được đọc thành tiếng — AGENTS.md 2.2).
5. Trạng thái đơn hiện cho người mua: "Đang chờ chuyển khoản", "Đang chờ xác nhận" (đã nhận tiền nhưng chưa khớp đủ), "Còn thiếu
   X đ" (CC-8), "Đã mở khoá", "Đã hết hạn", "Bị từ chối: <lý do>". Có nút liên hệ hỗ trợ (CC-11).
6. Màn đơn tự cập nhật khi mở khoá trong vài giây (CC-10); mở khoá thì cập nhật quyền trên máy ngay (Yêu cầu 8).
7. Đơn `pending` quá hạn tự sang `expired` (lệnh định kỳ, và kiểm lại mỗi khi đọc đơn). Tiền về sau khi hết hạn xử lý theo CC-9.
8. Chỉ chủ đơn đọc được đơn của mình (`GET /billing/orders/:code` trả 404 nếu không phải chủ).
9. Giới hạn tần suất tạo đơn theo người dùng (vd 10 đơn/giờ) để chống spam mã.

### Yêu cầu 3 — Nhận tiền tự động (webhook dịch vụ đọc biến động số dư)

**User story:** Là người mua, tôi muốn chuyển khoản xong là được bỏ quảng cáo ngay, không phải chờ người duyệt.

1. Endpoint công khai `POST /billing/webhooks/sepay` (và `/casso` nếu CC-1 chọn); **xác thực trước khi đọc nội dung** (CC-2), so
   sánh hằng thời gian; sai → 401, không ghi gì ngoài một dòng log không chứa nội dung.
2. Chỉ nhận tiền **vào** (`transferType = in`), số tiền > 0, vào **đúng tài khoản cấu hình** (CC-3); còn lại trả thành công để
   dịch vụ không gửi lại, nhưng bỏ qua.
3. **Idempotent theo (nhà cung cấp, mã giao dịch của nhà cung cấp)** bằng ràng buộc `UNIQUE` trong CSDL; gửi lại → trả thành công,
   không cộng tiền lần nữa.
4. Tìm mã đơn trong nội dung (và trường `code` của SePay) theo CC-5. Khớp đơn → khoá dòng đơn (`SELECT … FOR UPDATE`), cộng tiền:
   - đủ hoặc thừa → `paid` (thừa thì đánh dấu `overpaid` — CC-9), cấp quyền nguồn `web_transfer`;
   - thiếu → `underpaid` (CC-8);
   - đơn đã `paid` → giao dịch `extra`; đơn `expired` / `rejected` → theo CC-9.
5. Không tìm thấy mã đơn → giao dịch `unmatched`, chờ quản trị gán (Yêu cầu 5).
6. Phản hồi đúng định dạng nhà cung cấp mong đợi (SePay: HTTP 200 + `{"success": true}`) trong thời gian chờ của họ; xử lý nặng
   (nếu có) làm sau khi đã ghi giao dịch.
7. Ghi nhật ký webhook tối thiểu: nhà cung cấp, thời điểm, kết quả xác thực, mã giao dịch, kết quả xử lý. **Không** lưu thân
   request thô; nội dung chuyển khoản chỉ lưu theo CC-23.

### Yêu cầu 4 — Mua trên app Android (Google Play Billing)

**User story:** Là người chơi trên app Android, tôi muốn mua bằng tài khoản Google Play và khôi phục được khi đổi máy.

1. Một sản phẩm **một lần, không tiêu hao** (one-time, non-consumable) trên Play Console, giá 79.000đ hoặc mức gần nhất; mã sản
   phẩm cấu hình ở cả app và máy chủ.
2. App hiện **giá do Google Play trả về** (không viết cứng), nút "Mua", nút "Khôi phục giao dịch".
3. Khi đã đăng nhập, app truyền `obfuscatedAccountId` = băm (HMAC-SHA256, khoá máy chủ cấp) của `users.id` để máy chủ đối chiếu và
   Google phát hiện gian lận; không truyền email hay id thô.
4. Mua xong (trạng thái `PURCHASED`), app gửi `purchaseToken` + mã sản phẩm lên `POST /billing/google/verify`. Máy chủ gọi Google
   Play Developer API (`purchases.products.get`), kiểm: đúng `packageName`, đúng mã sản phẩm, `purchaseState = 0` (đã mua),
   `obfuscatedExternalAccountId` khớp người dùng hiện tại (nếu có), token chưa bị gắn tài khoản khác (CC-15). Đạt → lưu giao dịch,
   cấp quyền nguồn `google_play`, **máy chủ gọi `purchases.products.acknowledge`**, rồi trả kết quả; app chỉ `finish()` sau khi máy
   chủ trả thành công.
5. Trạng thái `PENDING` (thanh toán chờ, vd tiền mặt tại cửa hàng tiện lợi): **không cấp quyền**, hiện "Đang chờ Google Play xác
   nhận thanh toán"; app gửi lại khi trạng thái đổi.
6. Không xác minh được vì mất mạng / máy chủ lỗi: giữ giao dịch chưa `finish`, thử lại ở lần mở sau. Google tự hoàn tiền giao
   dịch không được xác nhận trong 3 ngày → app thử lại khi mở và khi có mạng lại.
7. Giao dịch không hợp lệ (sai gói, sai sản phẩm, token giả): không cấp quyền, không xác nhận, ghi nhật ký cảnh báo.
8. **Mua khi chưa đăng nhập** (Q-22): máy chủ vẫn xác minh và lưu giao dịch với `user_id = null`; máy lưu quyền theo tài khoản
   cửa hàng (Yêu cầu 8). Đăng nhập sau → app gửi các `purchaseToken` đang có lên `POST /billing/google/claim` để gộp vào tài khoản
   (CC-15 khi token đã thuộc tài khoản khác).
9. "Khôi phục giao dịch": đọc giao dịch của tài khoản Google Play trên máy, gửi từng token lên máy chủ xác minh / gộp; báo "Đã khôi
   phục" hoặc "Không tìm thấy giao dịch nào".
10. Hoàn tiền / huỷ / chargeback: lệnh định kỳ đọc Voided Purchases API (CC-14) → thu hồi nguồn `google_play` của token đó, ghi
    nhật ký; máy nhận khi làm mới quyền.
11. Khoá tài khoản dịch vụ Google Cloud (JSON) chỉ nằm ở biến môi trường / tệp bí mật của máy chủ, không vào repo.

### Yêu cầu 5 — Trang quản trị: duyệt tay

**User story:** Là người quản lý, tôi muốn xử lý các khoản tiền không tự khớp để người mua không phải chờ lâu.

1. Chỉ quản trị vào được (CC-19); mọi kiểm quyền ở máy chủ.
2. Danh sách đơn lọc theo trạng thái (`pending`, `underpaid`, `overpaid`, `expired`, `paid`, `rejected`, `refunded`), tìm theo mã
   đơn hoặc email người mua; danh sách giao dịch `unmatched` / `extra`.
3. **Duyệt** một đơn: chọn giao dịch ngân hàng khớp (hoặc ghi "đã đối chiếu sao kê" + ghi chú bắt buộc) → đơn `paid`, cấp quyền.
   **Gán** giao dịch `unmatched` vào một đơn. **Từ chối** đơn: lý do bắt buộc → `rejected`, người mua thấy lý do.
4. **Đánh dấu đã hoàn tiền** (CC-20): thu hồi quyền nguồn của đơn, đơn `refunded`.
5. **Chuyển quyền Google Play** giữa tài khoản (CC-15) và **cấp quyền tay** (nguồn `admin`, ghi chú bắt buộc) cho sự cố.
6. Tra người dùng: theo email → các nguồn quyền, đơn, giao dịch cửa hàng (che bớt token).
7. Mọi thao tác ghi nhật ký (Yêu cầu 6); thao tác đổi trạng thái có xác nhận hai bước trên giao diện.
8. Đơn đã ở trạng thái cuối không duyệt lại được; hai quản trị bấm cùng lúc thì chỉ một thao tác thành công (khoá dòng, kiểm trạng
   thái trong transaction).

### Yêu cầu 6 — Nhật ký kiểm toán

1. Bảng nhật ký chỉ thêm, không sửa / xoá qua ứng dụng: ai (`actor_user_id` hoặc `system:sepay`, `system:google`, `system:cron`),
   hành động, đối tượng, dữ liệu trước/sau (không chứa nội dung chuyển khoản, token đầy đủ, khoá bí mật), lý do, thời điểm.
2. Ghi cho: cấp / thu hồi quyền, duyệt, từ chối, gán giao dịch, đánh dấu hoàn tiền, chuyển quyền, đơn hết hạn hàng loạt (một dòng
   cho cả lượt).
3. Trang quản trị xem được nhật ký theo đối tượng (đơn, người dùng).

### Yêu cầu 7 — Giao diện mua (web và app)

**User story:** Là phụ huynh, tôi muốn mua cho con mà con không tự bấm mua được.

1. Vị trí nút mua theo CC-16; nhóm Mầm luôn sau cổng phụ huynh (đã chốt).
2. **Web:** luồng Yêu cầu 2. Trang giới thiệu trên web được nói giá web.
3. **App Android (bản build cửa hàng):** chỉ luồng Google Play (Yêu cầu 4). **Không** có chữ, hình, liên kết nào về chuyển khoản,
   QR, mã đơn, giá web (đã chốt). Mã giao diện chuyển khoản bị loại khỏi bản build cửa hàng. Chữ cho người đã mua nơi khác theo
   CC-17.
4. Mọi lời hướng dẫn trong luồng mua được đọc thành tiếng qua `speaker.say` (AGENTS.md 2.2); chữ tiếng Việt, câu ngắn.
5. Mất mạng: nút mua bị khoá với lời "Cần có mạng để mua"; trạng thái đã mua vẫn hiện đúng.
6. Bố cục chạy trên khổ điện thoại và máy tính; nút chạm ≥ 44px; có `data-testid` cho test.

### Yêu cầu 8 — Lưu quyền trên máy và chơi offline

1. Máy lưu `{ noAds, sources, userId | null, storeOwned, checkedAt }` (CC-22). Spec `mvp-ads` đọc qua store
   `entitlement` (trường `entitlement.noAds`, đúng tên `mvp-ads/design.md` đang dùng) — một nguồn duy nhất.
2. Mở app khi có mạng: đã đăng nhập → làm mới từ `GET /me/entitlements`; trên Android → đối chiếu thêm giao dịch Google Play trên
   máy (quyền theo tài khoản cửa hàng khi chưa đăng nhập).
3. Mất mạng hoặc máy chủ lỗi: giữ nguyên lần lưu trước, **không bao giờ** tự tắt quyền vì không gọi được máy chủ.
4. Máy chủ trả `adFree = false` (đã bị thu hồi) → tắt quyền trên máy ở lần làm mới đó.
5. Đăng xuất: bỏ quyền nguồn tài khoản khỏi máy; giữ quyền theo tài khoản cửa hàng (Android) nếu có.
6. Mở khoá xong (web hoặc app) → cập nhật ngay, không cần tải lại trang.

### Yêu cầu 9 — Xem doanh thu (quản trị)

1. Theo CC-24. Số tiền web là tiền thật nhận (tổng `paid_amount` của đơn `paid` / `overpaid`, trừ đơn `refunded`); Google Play là
   ước tính, ghi rõ.
2. Lọc theo khoảng ngày (giờ Việt Nam), xem theo ngày / tháng.

### Yêu cầu 10 — Bảo mật và dữ liệu (áp cho mọi yêu cầu trên)

1. Không tin giá, số tiền, trạng thái mua do máy khách gửi; máy chủ tự tính / tự xác minh.
2. Webhook xác thực trước khi xử lý; idempotent; ghi nhận trong transaction.
3. Bí mật (khoá API SePay, khoá tài khoản dịch vụ Google, khoá HMAC) chỉ ở biến môi trường máy chủ; `.env.example` chỉ có tên
   biến; hook git chặn tệp bí mật (AGENTS.md mục 8).
4. Không log email, nội dung chuyển khoản, `purchaseToken` đầy đủ (chỉ 8 ký tự cuối), khoá API (AGENTS.md 2.7).
5. Endpoint quản trị kiểm vai trò ở máy chủ; endpoint người dùng chỉ trả dữ liệu của chính người đó.
6. Giới hạn tần suất cho tạo đơn, xác minh Google Play, gộp giao dịch.
