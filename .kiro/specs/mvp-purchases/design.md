# Tài liệu thiết kế — Gói bỏ quảng cáo: mua trên web và Google Play (mvp-purchases)

> **Cập nhật 2026-11-18:** chủ sản phẩm đồng ý toàn bộ đề xuất — mọi chỗ ghi `(CC-n)` / `[CC-x]` / "Chặn bởi CC-n" nay là **đã chốt** theo đề xuất, trừ các điểm gắn nhãn **Còn mở** ở `requirements.md` (xem `../mvp-open-questions.md`).

> **Đường dẫn API:** mọi endpoint trong file này nằm dưới tiền tố chung `/api` của máy chủ (spec `mvp-accounts`), ví dụ `GET /billing/offer` là `GET /api/billing/offer`.

> Thiết kế kỹ thuật cho `requirements.md`. Chỗ nào phụ thuộc một điểm **Chờ chốt** thì ghi `(CC-n)` và vẽ theo **đề xuất**
> của điểm đó; chủ sản phẩm chọn khác thì sửa đúng phần đó trước khi code. Khung `apps/server` (NestJS, cấu hình, kết nối
> PostgreSQL, công cụ migration, guard đăng nhập, bảng `users`) do spec `mvp-accounts` dựng; spec này chỉ thêm module.

## 1. Tổng quan các lớp

```
apps/game (Vue, PWA + bản build cửa hàng)            apps/admin (Vue, CC-18)
  billing/entitlement.ts  ← store noAds (mvp-ads đọc)   orders / transactions / users / revenue / audit
  billing/BuyAdFree.vue   → web: TransferOrder.vue (QR)        │
                          → app: GooglePlayPurchase.vue        │
  components/ParentGate.vue (CC-16)                            │
        │ HTTPS (JSON, phiên của mvp-accounts)                │
        ▼                                                      ▼
apps/server/src/billing (NestJS)
  EntitlementService ── nơi duy nhất cấp / thu hồi quyền, ghi audit
  OrderService       ── tạo đơn, giá, mã đơn, hết hạn
  PaymentRecorder    ── ghi tiền vào đơn (webhook + duyệt tay), idempotent
  BankFeedDriver     ── SepayDriver (CC-1, CC-2) [CassoDriver sau]
  GooglePlayService  ── verify / acknowledge / claim / voided (CC-12..14)
  AdminBillingController, RevenueService, AuditService
  Cron: hết hạn đơn (mỗi 10 phút), voided purchases (mỗi ngày), xoá nội dung chuyển khoản cũ (CC-23)
        │
        ▼
PostgreSQL: orders, bank_transactions, webhook_events, store_purchases, entitlement_grants, audit_logs
packages/content: buildVietQrPayload(), parseOrderCodes(), kiểu dữ liệu dùng chung (CC-4, CC-5)
```

Nguyên tắc: máy khách chỉ **xin** (tạo đơn, gửi `purchaseToken`), máy chủ **quyết** (giá, xác minh, cấp quyền).

## 2. Mô hình dữ liệu

Một migration (công cụ theo `mvp-accounts`). Tiền là `integer` đồng VND. Thời gian `timestamptz`, hiển thị giờ Việt Nam.
Comment cột bằng tiếng Việt.

| Bảng | Cột chính | Ghi chú |
|---|---|---|
| `orders` | `id uuid pk`, `code varchar(16) unique`, `user_id uuid fk users`, `product varchar(32)` (`no_ads`), `list_price int`, `amount int`, `price_kind` (`standard`/`launch`), `paid_amount int default 0`, `status` (`pending`/`underpaid`/`paid`/`expired`/`rejected`/`refunded`/`cancelled`), `overpaid bool default false`, `expires_at`, `paid_at`, `decided_by uuid null`, `decision_note text null`, `created_at`, `updated_at` | Chỉ mục một phần `unique (user_id) where status in ('pending','underpaid')` (CC-7). Chỉ mục `(status, expires_at)` cho lệnh hết hạn |
| `bank_transactions` | `id uuid pk`, `provider varchar(16)`, `external_id varchar(64)`, `amount int`, `content varchar(140) null` (CC-23), `matched_code varchar(16) null`, `order_id uuid null fk`, `status` (`applied`/`unmatched`/`extra`/`ignored`), `bank_ref varchar(64) null`, `transaction_at`, `received_at`, `assigned_by uuid null` | `unique (provider, external_id)` — chống trùng. **Không** có cột tên / số tài khoản người chuyển, số dư |
| `webhook_events` | `id bigserial`, `provider`, `received_at`, `auth_ok bool`, `external_id null`, `result varchar(16)`, `http_status smallint` | Không lưu thân request. Giữ 90 ngày |
| `store_purchases` | `id uuid pk`, `store` (`google_play`), `purchase_token text unique`, `product_id`, `order_id_store varchar(64) null`, `user_id uuid null fk`, `obfuscated_account_id varchar(64) null`, `state` (`purchased`/`pending`/`voided`), `acknowledged bool`, `purchase_time`, `region_code varchar(4) null`, `voided_at null`, `voided_reason smallint null`, `created_at` | Khoá chống trùng là `purchase_token` (không dùng `orderId` — tài liệu Google) |
| `entitlement_grants` | `id uuid pk`, `entitlement varchar(32)` (`no_ads`), `user_id uuid null fk`, `source` (`web_transfer`/`google_play`/`admin`), `order_id uuid null unique`, `store_purchase_id uuid null unique`, `status` (`active`/`revoked`), `granted_at`, `revoked_at null`, `revoke_reason text null` | `unique` trên `order_id` và `store_purchase_id` → cấp quyền idempotent. `user_id` null khi mua Google Play lúc chưa đăng nhập |
| `audit_logs` | `id bigserial`, `actor` (`user:<uuid>` / `system:sepay` / `system:google` / `system:cron`), `action`, `target_type`, `target_id`, `before jsonb`, `after jsonb`, `reason text null`, `created_at` | Chỉ `INSERT`; người dùng CSDL của ứng dụng không có quyền `UPDATE/DELETE` bảng này (ghi trong migration). Nếu `mvp-accounts` đã có bảng audit thì dùng chung |
| `users` | `role varchar(16) default 'user'` | Chỉ khi CC-19 chọn đề xuất; thống nhất với `mvp-accounts` |

`adFree(user)` = `exists (select 1 from entitlement_grants where user_id = $1 and entitlement = 'no_ads' and status = 'active')`.

## 3. Máy chủ (`apps/server/src/billing`)

### 3.1 Cấu hình (biến môi trường, `.env.example` chỉ có tên)

| Biến | Ý nghĩa |
|---|---|
| `PRICE_WEB` (59000), `PRICE_WEB_LAUNCH` (39000), `LAUNCH_PRICE_FROM`, `LAUNCH_PRICE_UNTIL` | Giá web, khung giá ra mắt (CC-6) |
| `ORDER_TTL_HOURS` (24), `ORDER_CODE_PREFIX` (`TOMO`, CC-5) | Đơn |
| `BANK_BIN`, `BANK_ACCOUNT_NO`, `BANK_ACCOUNT_NAME`, `BANK_SHORT_NAME` | Tài khoản nhận (CC-3) |
| `SEPAY_ENABLED`, `SEPAY_API_KEY`, `SEPAY_IP_ALLOWLIST` (tuỳ chọn) | Webhook (CC-1, CC-2) |
| `GOOGLE_PLAY_PACKAGE`, `GOOGLE_PLAY_PRODUCT_ID`, `GOOGLE_SERVICE_ACCOUNT_JSON` (hoặc đường dẫn tệp bí mật), `PURCHASE_ACCOUNT_HMAC_KEY` | Google Play |
| `ADMIN_EMAILS` | Lớp chặn thứ hai cho quản trị (CC-19) |

Thiếu biến bắt buộc của phần nào thì phần đó tắt (vd chưa có `SEPAY_API_KEY` → chỉ duyệt tay; `GET /billing/offer` báo
`autoConfirm: false`), không làm sập máy chủ.

### 3.2 Giá và mã đơn

- `PricingService.webPrice(now)` → `{ amount, listPrice, kind, launchUntil }`. So sánh theo giờ Việt Nam, biên là `[FROM, UNTIL)`.
- `generateOrderCode()`: `ORDER_CODE_PREFIX` + 6 ký tự Crockford Base32 từ `crypto.randomInt`; thử lại khi trùng `unique`.
- `parseOrderCodes(text)` (packages/content, dùng chung): bỏ dấu, viết hoa, bỏ ký tự không phải chữ/số, tìm mọi chuỗi
  `PREFIX[0-9A-HJKMNP-TV-Z]{6}`; đổi `O→0`, `I/L→1` trong phần đuôi như Crockford.

### 3.3 Đơn (`OrderService`)

```
create(user):
  if EntitlementService.adFree(user) → 409 already_ad_free
  open = order pending|underpaid của user, chưa hết hạn → trả lại (CC-7)
  price = PricingService.webPrice(now)
  insert order(code, amount = price.amount, list_price, price_kind, expires_at = now + TTL)
  return { code, amount, listPrice, expiresAt, bank, qrPayload = buildVietQrPayload(bank, amount, code) }
get(user, code): chỉ chủ đơn; nếu pending && expires_at < now → expire() trước khi trả
cancel(user, code): chỉ khi pending và paid_amount = 0 → cancelled
expireDue(): cron 10 phút, update … set status='expired' where status='pending' and expires_at < now; 1 dòng audit cho cả lượt
```

`underpaid` quá hạn **không** tự `expired` (đã có tiền), ở lại danh sách duyệt tay (CC-8).

### 3.4 VietQR (`packages/content/src/vietqr.ts`, CC-4)

`buildVietQrPayload({ bin, accountNo, amount, content }) → string` theo EMVCo MPM + NAPAS: `00`=`01`, `01`=`12` (QR động, có
số tiền), `38` = { `00`=`A000000727`, `01` = { `00`=BIN, `01`=số tài khoản }, `02`=`QRIBFTTA` }, `53`=`704`, `54`=số tiền,
`58`=`VN`, `62` = { `08`=nội dung }, `63`=CRC16-CCITT (0xFFFF, đa thức 0x1021) tính trên toàn chuỗi kèm `6304`. Hàm thuần,
kiểm độ dài từng trường (nội dung ≤ 25 ký tự không dấu). Test: so với chuỗi mẫu đã quét thử bằng app ngân hàng (ghi trong test).

### 3.5 Webhook (`BankFeedDriver`, `PaymentRecorder`)

```ts
interface BankFeedDriver {
  key: 'sepay' | 'casso';
  enabled(): boolean;
  authorize(req): boolean;              // CC-2: Apikey, timingSafeEqual; IP allowlist nếu bật
  parse(req): BankTxInput[];            // chỉ tiền vào, đúng tài khoản cấu hình
  success(): { status: number; body: unknown };   // SePay: 200 {"success": true}
}
```

`POST /billing/webhooks/:provider` (không cần đăng nhập, giới hạn kích thước body 16 KB):

1. Driver tắt → 404. `authorize` sai → ghi `webhook_events(auth_ok=false)`, 401.
2. Với mỗi giao dịch: `PaymentRecorder.record(tx)` trong transaction:
   - `insert into bank_transactions … on conflict (provider, external_id) do nothing returning id` → không có dòng = trùng, bỏ qua.
   - `codes = parseOrderCodes(content + ' ' + code)`; tìm đơn theo mã, `select … for update`.
   - Không có đơn → `unmatched`. Có đơn → áp theo bảng dưới.
3. Trả `success()` sau khi transaction xong (vài chục ms, trong 30 giây của SePay).

| Trạng thái đơn | Tiền sau khi cộng | Kết quả (theo đề xuất CC-8, CC-9) |
|---|---|---|
| `pending` / `underpaid` | `≥ amount` | `paid` (`overpaid` nếu `>`), `EntitlementService.grant(web_transfer)` |
| `pending` / `underpaid` | `< amount` | `underpaid` |
| `expired` | `≥ amount` | `paid`, cấp quyền (CC-9) |
| `expired` | `< amount` | `underpaid` (chờ duyệt tay) |
| `paid` / `refunded` | bất kỳ | giao dịch `extra`, đơn giữ nguyên |
| `rejected` / `cancelled` | bất kỳ | giao dịch `unmatched` (chờ duyệt tay) |

Đối soát bù khi webhook lỗi quá lịch thử lại của SePay: quản trị bấm "Gửi lại" trong trang SePay, hoặc (sau MVP) lệnh đọc API
giao dịch SePay — ngoài phạm vi MVP, ghi vào tài liệu vận hành.

### 3.6 Google Play (`GooglePlayService`, CC-12..15)

Thư viện `@googleapis/androidpublisher` (CC-13), xác thực tài khoản dịch vụ có quyền "Xem dữ liệu tài chính, quản lý đơn hàng".

```
verify(user | null, { productId, purchaseToken }):
  if productId != GOOGLE_PLAY_PRODUCT_ID → 400
  p = purchases.products.get(package, productId, token)        // lỗi 404/410 → 400 invalid_token
  if p.purchaseState == 2 → upsert store_purchase(state=pending); return { status: 'pending' }
  if p.purchaseState != 0 → 400 not_purchased
  expectedObf = user ? hmac(PURCHASE_ACCOUNT_HMAC_KEY, user.id) : null
  if p.obfuscatedExternalAccountId && user && != expectedObf → 403 account_mismatch
  tx:
    sp = upsert store_purchases by purchase_token (state=purchased, region, purchase_time, order_id_store)
    if sp.user_id == null && user → sp.user_id = user.id
    if sp.user_id != null && user && sp.user_id != user.id → (CC-15) không gộp, trả { status:'owned_by_other', maskedEmail }
    EntitlementService.grant(google_play, sp)              // idempotent theo store_purchase_id
  if p.acknowledgementState == 0 → purchases.products.acknowledge(...)   // ngoài transaction, thử lại ở lần verify sau
  return { status: 'granted', noAds: true }

claim(user, tokens[]):  verify(user, t) cho từng token (tối đa 5 / lượt)
syncVoided(): cron mỗi ngày, voidedpurchases.list(startTime = lần chạy trước − 1 giờ, type=0)
  → với mỗi token có trong store_purchases: state=voided, EntitlementService.revoke(grant, 'google_voided:<reason>')
```

`obfuscatedAccountId` gửi từ app: máy chủ trả kèm trong `GET /me/entitlements` (`purchaseAccountId`) để app truyền vào luồng
mua — app không tự băm.

### 3.7 `EntitlementService`

```
grant(source, ref, actor) → insert entitlement_grants … on conflict do nothing; audit 'entitlement.grant'
revoke(grantId, reason, actor) → status=revoked; audit 'entitlement.revoke'
adFree(userId) / sources(userId)
transferStorePurchase(spId, toUserId, actor, note)   // quản trị, CC-15
```

### 3.8 Endpoint

| Phương thức + đường dẫn | Đăng nhập | Việc |
|---|---|---|
| `GET /billing/offer` | không bắt buộc | `{ web: { amount, listPrice, launchUntil }, autoConfirm }` — chỉ web gọi |
| `POST /billing/orders` | có | Tạo / lấy lại đơn (Yêu cầu 2). 10 lần/giờ/người |
| `GET /billing/orders/:code` | có, chủ đơn | Trạng thái `{ status, amount, paidAmount, remaining, expiresAt, decisionNote, qrPayload }` |
| `POST /billing/orders/:code/cancel` | có, chủ đơn | Huỷ đơn chưa có tiền (CC-7) |
| `POST /billing/webhooks/:provider` | xác thực webhook | Yêu cầu 3 |
| `POST /billing/google/verify` | không bắt buộc | Yêu cầu 4.4. 30 lần/giờ/IP + người |
| `POST /billing/google/claim` | có | Yêu cầu 4.8 |
| `GET /me/entitlements` | có | `{ noAds, sources, purchaseAccountId, checkedAt }` |
| `GET /admin/billing/orders?status&q&page` | quản trị | Danh sách đơn |
| `GET /admin/billing/transactions?status` | quản trị | Giao dịch `unmatched` / `extra` |
| `POST /admin/billing/orders/:id/approve` `{ transactionId?, note }` | quản trị | Duyệt |
| `POST /admin/billing/orders/:id/reject` `{ reason }` | quản trị | Từ chối |
| `POST /admin/billing/transactions/:id/assign` `{ orderId }` | quản trị | Gán |
| `POST /admin/billing/orders/:id/refunded` `{ note }` | quản trị | Đã hoàn tiền (CC-20) |
| `POST /admin/billing/grants` `{ userId, note }` · `POST /admin/billing/store-purchases/:id/transfer` `{ toUserId, note }` | quản trị | Cấp tay, chuyển quyền |
| `GET /admin/users?email=` | quản trị | Tra người dùng (token che, chỉ 8 ký tự cuối) |
| `GET /admin/billing/revenue?from&to&group=day\|month[&format=csv]` | quản trị | CC-24 |
| `GET /admin/audit?targetType&targetId` | quản trị | Nhật ký |

Lỗi dạng `{ code, message }`, `message` tiếng Việt. DTO kiểm bằng cơ chế kiểm dữ liệu `mvp-accounts` chọn.

### 3.9 Bảo mật

- Webhook: xác thực trước, so sánh `timingSafeEqual` sau khi đưa hai chuỗi về cùng độ dài (băm SHA-256 trước khi so).
- Log: middleware che các trường `content`, `purchaseToken`, `email`, header `Authorization`. Test kiểm log không chứa nội dung
  chuyển khoản mẫu.
- Quản trị: guard vai trò + `ADMIN_EMAILS`; thao tác ghi `audit_logs` trong cùng transaction với thay đổi.
- Đua dữ liệu: mọi đổi trạng thái đơn dùng `select … for update` và kiểm trạng thái nguồn trong transaction.

## 4. Game (`apps/game/src/billing/`)

### 4.1 Store quyền (`entitlement.ts`)

```ts
interface EntitlementState {
  noAds: boolean;
  sources: ('web_transfer' | 'google_play' | 'admin' | 'store_local')[];
  userId: string | null;
  storeOwned: boolean;          // Android: có giao dịch Google Play trên máy (kể cả chưa đăng nhập)
  checkedAt: string | null;
}
export const entitlement: Readonly<Ref<EntitlementState>>;  // mvp-ads đọc entitlement.value.noAds
export async function refreshEntitlement(): Promise<void>;
export function applyServerEntitlement(e): void;            // gọi sau khi mở khoá
```

- `localStorage` khoá `tomo.entitlement.v1` (CC-22). `noAds = serverNoAds(userId hiện tại) || storeOwned`.
- `refreshEntitlement()`: chạy khi khởi động, khi `online`, sau đăng nhập / đăng xuất (sự kiện của `mvp-accounts`). Lỗi mạng /
  5xx → giữ nguyên. 200 với `noAds=false` → tắt nguồn tài khoản.
- Sau đăng nhập trên Android: gửi các token trên máy lên `POST /billing/google/claim`.

### 4.2 Giao diện

| Thành phần | Việc |
|---|---|
| `ParentGate.vue` | Phép tính cộng/nhân hai số (vd 7 × 3), đọc câu hỏi bằng `speaker.say`, sai thì đổi câu; dùng lại ở Góc phụ huynh giai đoạn 2 (CC-16) |
| `BuyAdFree.vue` | Mục "Bỏ quảng cáo" trong `SettingsView.vue` (thêm `fieldset` sau "Giọng đọc", `:61`). Đã có quyền → lời cảm ơn. Mầm/Chồi → `ParentGate` trước (CC-16). Chọn luồng theo `__STORE_BUILD__` |
| `TransferOrder.vue` (chỉ web) | QR (SVG từ `qrPayload`, thư viện `qrcode` — CC-4), số tiền, nội dung + nút chép, đếm hạn, trạng thái, "Còn thiếu X đ", huỷ đơn, liên hệ hỗ trợ (CC-11). Hỏi trạng thái mỗi 3 giây khi màn đang hiện (CC-10). Lưu đơn đang chờ vào `localStorage` `tomo.order.v1` để mở lại khi mất mạng |
| `GooglePlayPurchase.vue` (chỉ bản cửa hàng) | Giá từ Play, Mua, Khôi phục giao dịch, trạng thái chờ, lời CC-17 khi chưa đăng nhập |
| `openAdFreeOffer()` | Mở màn Cài đặt ở mục Bỏ quảng cáo; `mvp-ads` gọi từ liên kết cạnh quảng cáo (CC-16) |

Màn mới đi qua `screen` của `App.vue` (thêm giá trị `'buy'`), focus tiêu đề như các màn khác. Chữ cố định mới thêm vào
`packages/content/src/phrases.ts` để tạo sẵn âm thanh.

### 4.3 Tách bản web và bản cửa hàng (chống nhắc chuyển khoản trong app, CC-17)

- `vite.config.ts` thêm `define: { __STORE_BUILD__: process.env.STORE_BUILD === 'true' }` (hằng, như `__ADS_ENABLED__` của
  `mvp-ads`); `mvp-android` đặt `STORE_BUILD=true` khi build cho Capacitor.
- `BuyAdFree.vue` nạp `TransferOrder.vue` bằng `import()` sau nhánh `if (!__STORE_BUILD__)` → Rollup bỏ hẳn khỏi bản cửa hàng;
  `GooglePlayPurchase.vue` và plugin chỉ nạp trong nhánh ngược lại.
- Test build: tìm trong `dist/` bản cửa hàng không có chuỗi "chuyển khoản", "VietQR", "TOMO" mẫu, `qrPayload`.

### 4.4 Plugin Google Play (CC-12)

Theo đề xuất `cordova-plugin-purchase` (bản Capacitor): đăng ký sản phẩm `NON_CONSUMABLE`, `store.validator` = hàm gọi
`POST /billing/google/verify`; `.approved(t => t.verify())` → `.verified(r => r.finish())`; `.pending(...)` hiện trạng thái chờ;
`store.restorePurchases()` cho nút Khôi phục; khởi động thì `store.update()` để gửi lại giao dịch chưa xong. Truyền
`applicationUsername` = `purchaseAccountId` khi đã đăng nhập (→ `obfuscatedAccountId`). Bọc trong `billing/playStore.ts` có giao
diện riêng để test thay bằng bản giả.

## 5. Trang quản trị (`apps/admin`, CC-18)

Vue 3 + Vite, không PWA, không đóng gói vào app. Màn: Đơn (lọc, chi tiết, Duyệt / Từ chối / Đã hoàn tiền), Giao dịch chưa khớp
(Gán), Người dùng (tra email, cấp tay, chuyển quyền), Doanh thu (bảng ngày/tháng, CSV), Nhật ký. Thao tác đổi trạng thái mở hộp
xác nhận, lý do / ghi chú bắt buộc. Đăng nhập dùng luồng của `mvp-accounts`; không phải quản trị → trang "Không có quyền".

## 6. Offline

| Tình huống | Hành vi |
|---|---|
| Đã mua, mất mạng | `entitlement.noAds` đọc từ `localStorage`, không có quảng cáo |
| Mở app mất mạng / máy chủ ngủ | Giữ trạng thái cũ, không tắt quyền |
| Đơn đang chờ, mất mạng | `TransferOrder` hiện lại QR + số tiền từ `tomo.order.v1`, báo "Mất mạng, chưa kiểm tra được trạng thái" |
| Mua trên Android, mất mạng giữa chừng | Giao dịch chưa `finish`, gửi lại khi có mạng / lần mở sau (trước hạn 3 ngày) |
| Bấm mua khi mất mạng | Nút khoá, "Cần có mạng để mua" |

Không đổi precache: API máy chủ không được service worker lưu đệm (`NetworkOnly` mặc định); kiểm lại `vite.config.ts` không bắt
nhầm đường `/billing`, `/me`.

## 7. Test

| Mức | Nội dung |
|---|---|
| Unit (Vitest, `packages/content`) | `buildVietQrPayload` (CRC, độ dài, chuỗi mẫu), `parseOrderCodes` (hoa thường, dấu, ký tự lạ, nhiều mã, Crockford O/0) |
| Unit (máy chủ) | `PricingService` (biên khung giá ra mắt, giờ VN); `generateOrderCode`; `PaymentRecorder` theo từng dòng bảng 3.5; `SepayDriver` (xác thực đúng/sai/thiếu, tiền ra, sai tài khoản); `GooglePlayService` với client giả (purchased / pending / canceled / sai sản phẩm / sai tài khoản / đã gắn tài khoản khác / acknowledge lỗi); `syncVoided`; `EntitlementService` idempotent, thu hồi một nguồn còn nguồn khác; che log |
| API e2e (máy chủ + PostgreSQL thử, theo khung `mvp-accounts`) | Tạo đơn (giá từ máy chủ dù client gửi số khác, 409 khi đã có quyền, dùng lại đơn chờ), webhook có chữ ký đúng → mở khoá, gửi lại → không cộng lần hai, webhook sai khoá → 401, thiếu / thừa / hết hạn, hai webhook song song cùng đơn, quản trị duyệt / từ chối / gán / hoàn tiền + audit, người thường gọi `/admin` → 403, đọc đơn người khác → 404, giới hạn tần suất |
| Unit (game, jsdom) | Store `entitlement` (làm mới, giữ khi lỗi mạng, tắt khi bị thu hồi, đăng xuất), `ParentGate`, `BuyAdFree` chọn luồng theo cờ, `TransferOrder` (hỏi trạng thái, dừng khi rời màn, còn thiếu), `GooglePlayPurchase` với `playStore` giả |
| Playwright (web, máy tính + điện thoại) | Đăng nhập thử → Cài đặt → (cổng phụ huynh với Mầm) → Bỏ quảng cáo → thấy QR + mã đơn → **webhook giả**: helper test gửi `POST /billing/webhooks/sepay` có khoá thử tới máy chủ thử → màn chuyển "Đã mở khoá" trong vài giây → tải lại offline vẫn `noAds`; chuyển thiếu → "Còn thiếu"; quản trị duyệt đơn trên `apps/admin` → người mua thấy mở khoá; ảnh chụp hai khổ |
| Kiểm build | Bản `STORE_BUILD=true` không chứa chuỗi chuyển khoản (4.3) |
| Thủ công (ghi vào tài liệu) | Quét QR bằng 2 app ngân hàng thật; Google Play: tài khoản thử giấy phép, track kiểm thử nội bộ, mua / chờ / khôi phục / hoàn tiền trong Play Console rồi chạy `syncVoided` |
