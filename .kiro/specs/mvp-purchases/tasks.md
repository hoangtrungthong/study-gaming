# Kế hoạch triển khai — Gói bỏ quảng cáo: mua trên web và Google Play (mvp-purchases)

> **Cập nhật 2026-11-18:** chủ sản phẩm đồng ý toàn bộ đề xuất — mọi chỗ ghi `(CC-n)` / `[CC-x]` / "Chặn bởi CC-n" nay là **đã chốt** theo đề xuất, trừ các điểm gắn nhãn **Còn mở** ở `requirements.md` (xem `../mvp-open-questions.md`).

Nhánh `feat/mvp-purchases` từ `main` mới nhất, **sau khi** `mvp-accounts` đã merge (cần `apps/server`, `users`, đăng nhập, khung
test API). Phần Google Play cần `mvp-android` đã có dự án Capacitor. Thứ tự theo phụ thuộc: hàm dùng chung → CSDL → quyền →
đơn + webhook → quản trị → Google Play → giao diện → E2E → tài liệu.

**Hỏi hết "Chờ chốt" trước khi code phần bị chặn** (cột "Chặn bởi"). Thư viện mới (`qrcode`, plugin mua hàng,
`@googleapis/androidpublisher`) phải được đồng ý trước khi cài (AGENTS.md mục 6). Mọi việc: file bị đổi đạt 100% dòng
(`pnpm coverage:changed`), lint / typecheck / build không cảnh báo.

- [x] 0. Hỏi chủ sản phẩm CC-1 … CC-24 (`requirements.md`), ghi câu trả lời vào `requirements.md` (chuyển sang "Quyết định đã
      thống nhất") và kịch bản mục 12.1; sửa `design.md` theo lựa chọn khác đề xuất
- [ ] 1. Hàm dùng chung `packages/content` — chặn bởi CC-4, CC-5
  - [ ] 1.1 `parseOrderCodes()` + `generateOrderCode` (định dạng CC-5); unit test hoa thường, dấu, ký tự lạ, Crockford
  - [ ] 1.2 `buildVietQrPayload()` (EMVCo/NAPAS, CRC16); unit test chuỗi mẫu đã quét thử bằng app ngân hàng thật
- [ ] 2. CSDL — chặn bởi CC-19 (cột `users.role`), CC-23
  - [ ] 2.1 Migration các bảng ở design §2 (ràng buộc `unique`, chỉ mục một phần, comment tiếng Việt, `down` chạy được, thu
        quyền `UPDATE/DELETE` trên `audit_logs`); test migration lên / xuống
  - [ ] 2.2 Biến môi trường (design §3.1) vào `.env.example` (chỉ tên), kiểm cấu hình lúc khởi động, phần thiếu biến thì tắt; unit test
- [ ] 3. `EntitlementService` + `AuditService` + `GET /me/entitlements`; unit test idempotent, thu hồi một nguồn; API e2e chỉ
      thấy quyền của mình
- [ ] 4. Đơn chuyển khoản — chặn bởi CC-3, CC-6, CC-7
  - [ ] 4.1 `PricingService` (khung giá ra mắt, giờ VN); unit test biên
  - [ ] 4.2 `OrderService` + `POST /billing/orders`, `GET /billing/orders/:code`, huỷ, `GET /billing/offer`, giới hạn tần suất;
        API e2e: giá từ máy chủ, 409 khi đã có quyền, dùng lại đơn chờ, đọc đơn người khác → 404
  - [ ] 4.3 Cron hết hạn đơn 24 giờ + audit; unit test
- [ ] 5. Webhook — chặn bởi CC-1, CC-2, CC-8, CC-9, CC-23
  - [ ] 5.1 `BankFeedDriver` + `SepayDriver` (xác thực, chỉ tiền vào, đúng tài khoản, IP tuỳ chọn); unit test
  - [ ] 5.2 `PaymentRecorder` (chống trùng, khoá đơn, bảng design §3.5) + `webhook_events`; unit test từng dòng bảng
  - [ ] 5.3 Endpoint `POST /billing/webhooks/:provider`, phản hồi đúng định dạng SePay; API e2e: đúng khoá → mở khoá, gửi lại
        không cộng lần hai, sai khoá → 401, thiếu / thừa / hết hạn, hai webhook song song
  - [ ] 5.4 Che log (nội dung, token, email, `Authorization`); test log không chứa nội dung chuyển khoản mẫu
  - [ ] 5.5 Cron xoá nội dung chuyển khoản cũ (CC-23); unit test
- [ ] 6. API quản trị — chặn bởi CC-15, CC-19, CC-20, CC-24
  - [ ] 6.1 Guard quản trị (vai trò + `ADMIN_EMAILS`), lệnh CLI cấp quyền quản trị; API e2e 401/403
  - [ ] 6.2 Danh sách đơn / giao dịch, duyệt, từ chối, gán, đã hoàn tiền, cấp tay, chuyển quyền — mỗi thao tác ghi audit cùng
        transaction; API e2e từng thao tác + hai quản trị bấm cùng lúc
  - [ ] 6.3 Tra người dùng (token che), nhật ký, doanh thu + CSV; API e2e số liệu
- [ ] 7. Google Play ở máy chủ — chặn bởi CC-13, CC-14, CC-15
  - [ ] 7.1 `GooglePlayService.verify` + acknowledge + `POST /billing/google/verify`; unit test với client giả (purchased /
        pending / canceled / sai sản phẩm / sai tài khoản / đã gắn tài khoản khác / acknowledge lỗi)
  - [ ] 7.2 `POST /billing/google/claim` (gộp giao dịch khách vào tài khoản); API e2e
  - [ ] 7.3 Cron `syncVoided` (Voided Purchases API) → thu hồi quyền + audit; unit test
- [ ] 8. Game: store quyền và cổng phụ huynh — chặn bởi CC-16, CC-22
  - [ ] 8.1 `billing/entitlement.ts` (`entitlement.noAds` cho `mvp-ads`, làm mới, giữ khi lỗi, đăng xuất); unit test
  - [ ] 8.2 `ParentGate.vue` (đọc câu hỏi thành tiếng); test giao diện
  - [ ] 8.3 `BuyAdFree.vue` trong `SettingsView.vue`, màn `buy` trong `App.vue`, `openAdFreeOffer()`; cờ `__STORE_BUILD__` trong
        `vite.config.ts` + `env.d.ts`; câu cố định mới vào `phrases.ts`; test giao diện chọn luồng theo cờ và nhóm tuổi
- [ ] 9. Game: luồng web — chặn bởi CC-4 (thư viện `qrcode`), CC-10, CC-11
  - [ ] 9.1 `TransferOrder.vue` (QR SVG, chép nội dung, đếm hạn, hỏi trạng thái 3 giây, còn thiếu, huỷ, hỗ trợ, lưu
        `tomo.order.v1` để xem offline); test giao diện với hẹn giờ giả
- [ ] 10. Game: luồng Google Play — chặn bởi CC-12, CC-17; cần `mvp-android`
  - [ ] 10.1 Cài plugin, `billing/playStore.ts` (bọc plugin: đăng ký sản phẩm, verify → finish, pending, restore, gửi lại giao
        dịch dở); unit test với bản giả
  - [ ] 10.2 `GooglePlayPurchase.vue` (giá từ Play, Mua, Khôi phục, chờ, lời CC-17, claim sau đăng nhập); test giao diện
  - [ ] 10.3 Kiểm build `STORE_BUILD=true`: `dist/` không chứa chuỗi chuyển khoản / VietQR / mã đơn; test tự động trong CI
- [ ] 11. `apps/admin` — chặn bởi CC-18
  - [ ] 11.1 Khung app (Vite + Vue, lint, typecheck, test, không PWA), đăng nhập, trang "Không có quyền"
  - [ ] 11.2 Màn Đơn, Giao dịch chưa khớp, Người dùng, Doanh thu, Nhật ký; hộp xác nhận + lý do bắt buộc; test giao diện
- [ ] 12. E2E Playwright (máy tính + điện thoại)
  - [ ] 12.1 Hạ tầng: máy chủ thử + PostgreSQL thử trong `webServer`, khoá SePay thử, helper `fakeSepayWebhook(code, amount)`
  - [ ] 12.2 Web: đăng nhập → (cổng phụ huynh) → Bỏ quảng cáo → QR + mã đơn → webhook giả → "Đã mở khoá" → tải lại offline vẫn
        không quảng cáo; chuyển thiếu → "Còn thiếu"; ảnh chụp hai khổ
  - [ ] 12.3 Quản trị: đơn chưa khớp → duyệt trên `apps/admin` → người mua thấy mở khoá; từ chối → người mua thấy lý do
  - [ ] 12.4 Thủ công trên máy thật (ghi kết quả vào báo cáo DoD): quét QR bằng 2 app ngân hàng; Google Play track kiểm thử nội
        bộ với tài khoản thử giấy phép: mua, chờ, khôi phục, hoàn tiền trong Play Console → `syncVoided` thu hồi
- [ ] 13. Tài liệu và DoD
  - [ ] 13.1 `docs/deploy.md` (tạo nếu chưa có): biến môi trường, tạo khoá API + webhook SePay (tiền tố mã đơn), tài khoản dịch vụ
        Google + quyền Play Console, tạo sản phẩm một lần trên Play Console, đăng ký chương trình phí 15%, lệnh cấp quyền quản trị,
        gửi lại webhook khi máy chủ lỗi, quy trình hoàn tiền
  - [ ] 13.2 `docs/ai/` (bảng, endpoint, store `entitlement`, cờ `__STORE_BUILD__`), `docs/feature-checklist.md` (dòng "Gói bỏ
        quảng cáo"), kịch bản mục 12.1 với các CC đã chốt
  - [ ] 13.3 DoD bằng skill `dod-report` (báo cáo `docs/dod/mvp-purchases_<ngày>.md`), review bảo mật (webhook, quyền quản trị,
        log, bí mật), đánh dấu `- [x]` các việc đã xong
