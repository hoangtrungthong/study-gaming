# Tài liệu thiết kế — Tài khoản, máy chủ và đồng bộ MVP (mvp-tai-khoan)

> **Cập nhật 2026-11-18:** chủ sản phẩm đồng ý toàn bộ đề xuất — mọi chỗ ghi `(CC-n)` / "Chặn bởi CC-n" nay là **đã chốt** theo đề xuất (xem `requirements.md`, mục "Điểm chốt thêm").

> Thiết kế kỹ thuật cho `requirements.md`. Chỗ nào phụ thuộc một điểm **Chờ chốt** thì ghi `(CC-n)` và vẽ theo **đề xuất** của
> điểm đó; đề xuất **chưa phải quyết định** — chủ sản phẩm chọn khác thì sửa đúng phần đó trước khi code.
> Hợp đồng tiến độ (`ProgressDocV1`, `SyncRequestV1`, `SyncResponseV1`, `mergeProgress`, `migrateProgress`, kể cả kho Đèn Pin nằm
> trong `ProgressDocV1`) thuộc `mvp-tien-do-hoc/design.md` §3.1, §5; spec này chỉ **dùng**, không định nghĩa lại.

## 1. Tổng quan các lớp

```
apps/game (Vue, PWA + bản Capacitor)                      apps/admin (mvp-mua-ban)
  account/api.ts        fetch tới /api (web) hoặc VITE_WEB_ORIGIN/api (app)
  account/session.ts    trạng thái khách / đã đăng nhập, sự kiện signedIn / signedOut
  account/googleWeb.ts  nạp GIS, nút Google          account/googleNative.ts  plugin gốc (CC-11)
  account/sync.ts       lấy gói từ Db SQLite (mvp-tien-do-hoc) → POST /api/sync/progress → ghi gói gộp về Db
  views/AccountView.vue màn Tài khoản
        │ HTTPS JSON — web: cookie tomo_sid (cùng origin) · app: Authorization: Bearer (CC-6)
        ▼
Caddy (TLS, CC-19) ── /            → file tĩnh PWA
                   ── /admin/*     → file tĩnh apps/admin (CC-20)
                   ── /ads-config.json → thư mục mount (mvp-quang-cao CC-2)
                   ── /api/*       → server:3000
apps/server (NestJS, tiền tố /api)
  ConfigModule   kiểm biến môi trường (zod, CC-3)
  DbModule       Drizzle + pg (CC-1), hai người dùng CSDL (migrate / app)
  AuthModule     GoogleVerifier · OtpService · MailDriver (CC-9) · SessionService · AuthGuard / OptionalAuthGuard / AdminGuard
  AccountModule  GET/DELETE /me, xoá tài khoản (CC-16)
  SyncModule     POST /sync/progress, DELETE /sync/profiles/:id (dùng @study/content)
  AuditModule    AuditService (bảng audit_logs dùng chung, CC-18)
  HealthModule   GET /health
  MaintenanceModule  dọn dữ liệu hết hạn mỗi ngày (CC-17)
  cli.ts         migrate · admin:grant · admin:revoke · admin:list
  [billing/ do mvp-mua-ban thêm sau]
        ▼
PostgreSQL 17 (CC-2): users, auth_identities, email_otps, sessions, progress_docs, audit_logs
```

Nguyên tắc: game chạy đủ khi không có máy chủ; máy chủ chỉ lo đăng nhập, đồng bộ, (sau này) mua. Máy chủ **quyết**, máy khách **xin**.

## 2. Cấu trúc `apps/server`

### 2.1 Thư mục

```
apps/server/
  package.json            @study/server; scripts: dev, build, start, typecheck, test, test:unit, test:e2e, test:coverage,
                          db:generate, db:migrate, cli
  tsconfig.json           kế thừa tsconfig.base.json, ghi đè (2.3)
  tsconfig.build.json     phát dist/
  vitest.config.ts        unplugin-swc; hai project: unit (src/**/*.test.ts), e2e (test/**/*.e2e.test.ts) (CC-28)
  drizzle.config.ts       lược đồ src/db/schema.ts → migrations/
  migrations/             0000_init.sql … (SQL, có COMMENT ON tiếng Việt), meta/
  src/
    main.ts               tạo app, prefix /api, helmet, cookie-parser, trust proxy, giới hạn thân, pino
    app.module.ts
    cli.ts                lệnh vận hành (2.4)
    config/env.ts         lược đồ zod của biến môi trường + loadEnv()
    db/schema.ts, db/db.module.ts, db/roles.sql
    common/errors.ts      AppError(code, message, status) + filter → { code, message }
    common/zod.pipe.ts    ZodValidationPipe (CC-3)
    common/origin.guard.ts kiểm Origin cho yêu cầu đổi trạng thái dùng cookie
    common/redact.ts      danh sách trường che trong log
    auth/                 google.verifier.ts, otp.service.ts, mail/{mail.driver.ts,resend.driver.ts,mailpit.driver.ts,memory.driver.ts},
                          session.service.ts, auth.controller.ts, guards.ts, current-user.decorator.ts, auth.events.ts
    account/              account.controller.ts, account.service.ts
    sync/                 sync.controller.ts, sync.service.ts
    audit/                audit.service.ts
    health/               health.controller.ts
    maintenance/          maintenance.service.ts (@nestjs/schedule)
  test/                   e2e: app factory, tiện ích DB thử (truncate), *.e2e.test.ts
```

### 2.2 Dùng `@study/content` (CC-5, đề xuất A)

- `packages/content/package.json`: `exports: { ".": { "source": "./src/index.ts", "types": "./src/index.ts", "default": "./dist/index.js" } }`
  và `build: tsc -p tsconfig.build.json` (phát `dist/`, giữ `with { type: 'json' }` — `module: NodeNext`). Vite / Vitest đặt
  `resolve.conditions: ['source']` nên game và test vẫn đọc nguồn. `pnpm -r build` build `content` trước `server` (thứ tự phụ thuộc
  của pnpm).
- Máy chủ import `migrateProgress`, `mergeProgress`, kiểu `ProgressDocV1`, `SyncRequestV1`, `SyncResponseV1` từ `@study/content`.

### 2.3 TypeScript

`apps/server/tsconfig.json` ghi đè so với gốc: `module/moduleResolution: NodeNext`, `experimentalDecorators: true`,
`emitDecoratorMetadata: true`, `noEmit: false`, `outDir: dist`, `lib: ["ES2023"]` (không DOM). Giữ `strict`,
`noUncheckedIndexedAccess`, `verbatimModuleSyntax`.

Bẫy cần nhớ (ghi vào `docs/ai/50-stack-patterns.md`): lớp được tiêm qua constructor **phải import giá trị**, không `import type`
(metadata DI cần lớp lúc chạy); tắt quy tắc ESLint tự đổi sang `import type` trong `apps/server`; kiểm TS 6 còn hỗ trợ
`experimentalDecorators` ngay khi dựng khung (việc 2.1) — không được thì ghi lại và hỏi.

### 2.4 CLI (`node dist/cli.js <lệnh>`, dev: `pnpm --filter @study/server cli <lệnh>`)

| Lệnh | Việc |
|---|---|
| `migrate` | Áp migration bằng `DATABASE_URL_MIGRATE` (người dùng chủ sở hữu), rồi chạy `db/roles.sql` cấp quyền cho người dùng app |
| `admin:grant <email>` | `role='admin'`; email chưa có tài khoản → báo "Tài khoản phải đăng nhập ít nhất một lần"; ghi audit `system:cli` |
| `admin:revoke <email>` | `role='user'`, thu hồi mọi phiên `client='admin'` của tài khoản; ghi audit |
| `admin:list` | In danh sách quản trị (email đã che) và cảnh báo nếu email không có trong `ADMIN_EMAILS` |

## 3. Cấu hình (`.env.example`, chỉ tên biến)

| Biến | Ý nghĩa / mặc định |
|---|---|
| `NODE_ENV` | `development` / `test` / `production` |
| `PORT` | `3000` |
| `DATABASE_URL` | Người dùng app `tomo_app` (chỉ DML) |
| `DATABASE_URL_MIGRATE` | Người dùng chủ sở hữu (chạy migration) |
| `DATABASE_URL_TEST` | DB `tomo_test` cho test e2e |
| `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `DB_APP_PASSWORD` | Dùng bởi container `db` và script khởi tạo |
| `APP_ORIGIN` | `https://<tên miền>` (dev `http://localhost:5173`); dùng kiểm `Origin` |
| `CORS_ORIGINS` | `https://localhost` (app Capacitor) |
| `TRUST_PROXY_HOPS` | `1` (Caddy) |
| `SESSION_IDLE_DAYS` (90), `SESSION_ABSOLUTE_DAYS` (365), `SESSION_MAX_PER_USER` (10), `ADMIN_SESSION_HOURS` (12) | CC-7 |
| `GOOGLE_WEB_CLIENT_ID` | `aud` hợp lệ cho cả web và app (CC-11) |
| `AUTH_GOOGLE_FAKE` | Chỉ test: nhận token giả `fake:<sub>:<email>`; bị từ chối khi `production` |
| `MAIL_DRIVER` | `resend` / `mailpit` / `memory` (2 cái sau bị từ chối khi `production`) |
| `RESEND_API_KEY`, `MAIL_FROM`, `MAILPIT_URL` | CC-9 |
| `OTP_PEPPER` | Khoá HMAC cho mã và email (≥ 32 byte ngẫu nhiên) |
| `OTP_LENGTH` (6), `OTP_TTL_MINUTES` (10), `OTP_MAX_ATTEMPTS` (5), `OTP_RESEND_SECONDS` (60), `OTP_PER_EMAIL_HOUR` (5), `OTP_PER_EMAIL_DAY` (10), `OTP_PER_IP_HOUR` (20), `OTP_DAILY_CAP` (90) | CC-8 |
| `SYNC_MAX_DOC_BYTES` (524288), `SYNC_MAX_DOCS` (20), `SYNC_MAX_PROFILES` (20) | CC-14 |
| `CONSENT_VERSION` | Phiên bản điều khoản đang hiệu lực (CC-12), vd `2026-11` |
| `ADMIN_EMAILS` | Danh sách cách nhau bởi dấu phẩy (`mvp-mua-ban` CC-19) |
| `BACKUP_STATUS_FILE` | `/backups/status.json` (đọc chỉ đọc cho `/api/health`, CC-23) |
| `LOG_LEVEL` | `info` |

Biến build của game (`apps/game/.env.example`): `VITE_GOOGLE_WEB_CLIENT_ID`, `VITE_WEB_ORIGIN` (chỉ bản app, `mvp-android`),
`VITE_API_PROXY` (dev: `http://server:3000`). Web gọi đường tương đối `/api`; app gọi `${VITE_WEB_ORIGIN}/api`.

`.env.prod.example` (gốc repo, cho compose prod): mọi biến máy chủ ở trên + `SITE_ADDRESS`, `ACME_EMAIL`, `BACKUP_KEEP` (14),
`BACKUP_EVERY_HOURS` (24), `BACKUP_AGE_RECIPIENT` (khoá công khai `age`), `RCLONE_REMOTE`, `RCLONE_CONFIG_*` (CC-23).
`mvp-mua-ban` thêm biến của nó vào cùng hai file.

## 4. Mô hình dữ liệu (PostgreSQL, migration `0000_init`)

| Bảng | Cột | Ràng buộc / ghi chú |
|---|---|---|
| `users` | `id uuid pk default gen_random_uuid()`, `email citext not null`, `role varchar(16) not null default 'user'`, `consent_at timestamptz null`, `consent_version varchar(16) null`, `created_at`, `last_login_at` | `unique(email)`, `check (role in ('user','admin'))`. Không có tên, ảnh (CC-10). Extension `citext` |
| `auth_identities` | `id uuid pk`, `user_id uuid fk users on delete cascade`, `provider varchar(16)` (`google`/`email`), `subject varchar(255)`, `created_at`, `last_used_at` | `unique(provider, subject)`; `subject` = `sub` của Google hoặc email đã chuẩn hoá |
| `email_otps` | `id uuid pk` (= `challengeId`), `email_hmac bytea`, `code_hmac bytea`, `ip_hmac bytea`, `attempts smallint default 0`, `expires_at`, `consumed_at null`, `created_at` | Chỉ mục `(email_hmac, created_at)`, `(created_at)` (trần ngày). Không có email, mã gốc (CC-8). Xoá sau 24 giờ (CC-17) |
| `sessions` | `id uuid pk`, `user_id uuid fk on delete cascade`, `token_hash bytea unique`, `client varchar(16)` (`web`/`android`/`admin`), `created_at`, `last_seen_at`, `idle_expires_at`, `absolute_expires_at`, `revoked_at null` | Chỉ mục `(user_id)`. Không lưu IP, user-agent (không cần cho MVP, ít dữ liệu cá nhân) |
| `progress_docs` | `user_id uuid fk on delete cascade`, `profile_id uuid`, `schema int`, `doc jsonb null`, `doc_bytes int`, `updated_at`, `deleted_at null` | `pk (user_id, profile_id)`; `check ((deleted_at is null) = (doc is not null))`. "Một dòng jsonb cho mỗi cặp tài khoản + profileId" (`mvp-tien-do-hoc` §5.1) |
| `audit_logs` | `id bigserial`, `actor varchar(64)`, `action varchar(64)`, `target_type varchar(32)`, `target_id varchar(64)`, `before jsonb`, `after jsonb`, `reason text null`, `created_at` | Đúng lược đồ `mvp-mua-ban/design.md` §2 (CC-18). `tomo_app` chỉ có `INSERT, SELECT` |

Người dùng CSDL (`db/roles.sql`, chạy sau migration, chạy lại không lỗi): `tomo_owner` (chủ bảng, chỉ dùng khi migrate) và
`tomo_app` (`SELECT, INSERT, UPDATE, DELETE` trên mọi bảng trừ `audit_logs` chỉ `SELECT, INSERT`; `USAGE` trên sequence;
`ALTER DEFAULT PRIVILEGES` để bảng của `mvp-mua-ban` sau này theo cùng quy tắc).

Xoá tài khoản (CC-16): `DELETE FROM users WHERE id = $1` (cascade identities, sessions, progress_docs); bảng của `mvp-mua-ban` dùng
`ON DELETE SET NULL` cho `user_id` — ghi thành ràng buộc trong spec đó; `AccountService.delete` gọi thêm hook
`AccountDeletionHook[]` để module khác dọn dữ liệu của mình trong cùng transaction.

## 5. Đăng nhập

### 5.1 Google trên web

```
AccountView → googleWeb.load() (chèn <script src="https://accounts.google.com/gsi/client" async>, chỉ khi navigator.onLine)
  google.accounts.id.initialize({ client_id: VITE_GOOGLE_WEB_CLIENT_ID, callback, ux_mode: 'popup', auto_select: false })
  google.accounts.id.renderButton(el, { locale: 'vi', size: 'large', text: 'signin_with' })
  callback({ credential }) → POST /api/auth/google { idToken: credential, client: 'web', consent? }
```

Không bật One Tap (tránh bật lên trước mắt trẻ). Script GIS không precache; mất mạng thì không nạp, hiện lời "Cần có mạng".
Google OAuth: "Authorized JavaScript origins" gồm `https://<tên miền>`, `http://localhost`, `http://localhost:5173`, `http://localhost:4173`
(ghi ở `docs/deploy.md`).

### 5.2 Google trên app Android (CC-11)

`googleNative.signIn()` bọc plugin: `SocialLogin.initialize({ google: { webClientId } })` một lần khi khởi động app, `login({ provider:
'google' })` → `idToken` → `POST ${VITE_WEB_ORIGIN}/api/auth/google { idToken, client: 'android' }` → nhận `token`, lưu theo CC-29.
Cần Android OAuth client (tên gói + SHA-1 của upload key **và** của khoá Play App Signing) — bước ghi ở `docs/mobile-app.md`.

### 5.3 Máy chủ kiểm Google (`GoogleVerifier`)

```
verify(idToken):
  ticket = OAuth2Client.verifyIdToken({ idToken, audience: [GOOGLE_WEB_CLIENT_ID] })   // kiểm chữ ký, exp, aud; khoá Google lưu đệm
  p = ticket.getPayload()
  if p.iss ∉ {'accounts.google.com','https://accounts.google.com'} or !p.email_verified → 401 invalid_google_token
  return { sub: p.sub, email: normalize(p.email) }
FakeGoogleVerifier (AUTH_GOOGLE_FAKE=true, không production): 'fake:<sub>:<email>' → { sub, email }
```

### 5.4 Email + OTP (`OtpService`, CC-8)

```
start(email, ip):
  e = normalize(email); validate
  eh = hmac(OTP_PEPPER, 'email:' + e); ih = hmac(OTP_PEPPER, 'ip:' + ip)
  tx (khoá tư vấn pg_advisory_xact_lock(hash(eh)) để hai yêu cầu song song không vượt giới hạn):
    lần gửi gần nhất của eh < 60 s → 429 otp_rate_limited
    đếm eh trong 1 giờ ≥ 5 / trong 24 giờ ≥ 10 → 429; đếm toàn bảng hôm nay (giờ VN) ≥ OTP_DAILY_CAP → 429 otp_daily_cap
    update email_otps set consumed_at = now() where email_hmac = eh and consumed_at is null     // mã cũ hết hiệu lực
    id = uuid; code = randomInt(0, 10^6) đệm 6 số
    insert email_otps(id, eh, hmac(OTP_PEPPER, id + ':' + code), ih, expires_at = now()+10 phút)
  MailDriver.send({ to: e, subject: 'Mã đăng nhập Tomo: ' (không đưa mã vào tiêu đề), text, html })  // lỗi → 503, xoá dòng vừa tạo
  return { challengeId: id, resendAfterSeconds: 60, expiresInSeconds: 600 }

verify(email, challengeId, code):
  tx: select … for update where id = challengeId and email_hmac = hmac(email)
    không có / consumed / hết hạn → 400 otp_expired
    attempts += 1
    timingSafeEqual(code_hmac, hmac(id + ':' + code)) sai → attempts ≥ 5 ? consumed_at=now() : giữ; 400 otp_invalid { attemptsLeft }
    đúng → consumed_at = now() → trả email đã chuẩn hoá
```

Giới hạn theo IP (`@nestjs/throttler`, bộ nhớ): `start` 20/giờ/IP, `verify` 30/10 phút/IP.

### 5.5 Tạo hoặc gắn tài khoản (`AuthService.signIn`, CC-10, CC-12)

```
signIn({ provider, subject, email }, client, consent):
  tx:
    id = auth_identities(provider, subject)?.user_id
       ?? users(email)?.id                      // gắn cách đăng nhập mới vào tài khoản cùng email
    if !id: nếu consent?.version != CONSENT_VERSION → 409 consent_required; tạo users(email, consent_at, consent_version)
    else if user.consent_version != CONSENT_VERSION: consent hợp lệ → cập nhật; không → 409 consent_required
    upsert auth_identities(provider, subject, user_id); users.last_login_at = now()
    if client == 'admin' && !(role == 'admin' && email ∈ ADMIN_EMAILS) → 403 not_admin
    session = SessionService.create(user, client)
  AuthEvents.signedIn$.next({ userId, isNewUser })          // RxJS Subject; mvp-mua-ban đăng ký nếu cần phía máy chủ
```

`409 consent_required` → game hiện ô đồng ý rồi gửi lại (với Google: gửi lại cùng `idToken` nếu chưa hết hạn, không thì bấm lại nút).

### 5.6 Phiên (`SessionService`, CC-6, CC-7)

- `create`: `token = randomBytes(32).base64url`; lưu `sha256(token)`; vượt 10 phiên → thu hồi phiên `last_seen_at` cũ nhất.
- Trả về: `client='web'` → `Set-Cookie: tomo_sid=<token>; HttpOnly; Secure; SameSite=Strict; Path=/api; Max-Age=<idle>`;
  `client='admin'` → `tomo_admin_sid`, `Max-Age=43200`; `client='android'` → `token` trong thân JSON.
  Dev chạy `http://localhost` (trình duyệt coi localhost là ngữ cảnh an toàn nên cookie `Secure` vẫn nhận).
- `resolve(req)`: lấy `Authorization: Bearer` nếu có, không thì cookie (guard thường đọc `tomo_sid`, `AdminGuard` chỉ đọc
  `tomo_admin_sid`) → tra `token_hash`, kiểm `revoked_at`, `idle_expires_at`, `absolute_expires_at`, khớp `client`.
  Gia hạn trượt: nếu `last_seen_at` cũ hơn 1 giờ thì cập nhật `last_seen_at`, `idle_expires_at` (phiên admin không gia hạn).
- `revoke(id)`, `revokeAll(userId)`.

### 5.7 CSRF và CORS

- Web cùng origin → không bật CORS cho `APP_ORIGIN`. `OriginGuard` (toàn cục): yêu cầu không phải GET/HEAD/OPTIONS **có cookie phiên
  và không có Bearer** thì `Origin` phải bằng `APP_ORIGIN`, sai / thiếu → 403 `bad_origin`.
- CORS cho `CORS_ORIGINS` (`https://localhost`): phương thức GET/POST/DELETE, header `Authorization, Content-Type`,
  `credentials: false`. Origin `https://localhost` dùng chung mọi app Capacitor nên không coi là xác thực — chỉ Bearer mới xác thực.

### 5.8 Guard cho các spec khác

```ts
@UseGuards(AuthGuard)          // 401 nếu không có phiên người chơi; req.user = { id, email, role }
@UseGuards(OptionalAuthGuard)  // req.user có thể null
@UseGuards(AdminGuard)         // phiên tomo_admin_sid + role='admin' + email ∈ ADMIN_EMAILS, kiểm mỗi yêu cầu
@CurrentUser() user: AuthUser
```

## 6. Đồng bộ (`SyncService`)

```
sync(userId, req: SyncRequestV1):
  zod: { schema: 1, deviceId: uuid, docs: array max SYNC_MAX_DOCS }      // từng doc kiểm bằng migrateProgress, không zod
  for doc in req.docs:
    if byteLength(JSON.stringify(doc)) > SYNC_MAX_DOC_BYTES → 413 doc_too_large (cả yêu cầu)
  tx:
    for doc in req.docs (sắp theo profileId để khoá theo thứ tự cố định, tránh deadlock):
      m = migrateProgress(doc)
      'invalid' → log.warn({ profileId }) ; tiếp
      'newer'   → log.warn({ profileId, schema }) ; tiếp
      insert progress_docs(user_id, profile_id, …) on conflict do nothing
      row = select … for update
      row.deleted_at → bỏ qua (Yêu cầu 7.3)
      số hồ sơ chưa xoá ≥ SYNC_MAX_PROFILES và đây là hồ sơ mới → 422 too_many_profiles
      merged = row.doc ? mergeProgress(migrate(row.doc), m) : m
      update doc = merged, schema, doc_bytes, updated_at = now()  (bỏ qua nếu không đổi)
    docs = select doc where user_id and deleted_at is null → migrateProgress từng gói (nâng schema)
    deleted = select profile_id where user_id and deleted_at is not null
  return { schema: 1, docs, deletedProfileIds: deleted }          // trường thêm theo CC-13 (A)

deleteProfile(userId, profileId):
  update progress_docs set doc = null, deleted_at = now() …; chưa có dòng → insert dòng đã xoá; audit 'sync.profile.delete'
```

- Endpoint: `POST /api/sync/progress` (giới hạn thân 2 MB, 30 lần / 10 phút / tài khoản), `DELETE /api/sync/profiles/:profileId`.
- `mergeProgress` giao hoán + chạy lại không đổi (`mvp-tien-do-hoc` §5.2) → gửi lại, hai máy song song, thứ tự đến khác nhau đều cho
  cùng kết quả; khoá dòng chỉ để tránh mất cập nhật giữa đọc và ghi.
- Đèn Pin và mọi trường mới của `ProgressDocV1` đi qua `mergeProgress` của `@study/content`; máy chủ không biết từng trường.
- Máy chủ luôn chạy `@study/content` mới nhất (cùng repo) → nhận được gói cũ. Khi triển khai, **cập nhật máy chủ trước** bản game
  có `schema` mới; nếu ngược lại, gói `'newer'` bị bỏ qua chứ không mất (máy vẫn giữ).

## 7. Tài khoản (`AccountModule`)

| Endpoint | Việc |
|---|---|
| `GET /api/me` | `{ id, email, providers: ('google'\|'email')[], createdAt, consentVersion }` |
| `DELETE /api/me` `{ confirm: 'XOÁ' }` | Phiên tạo > 15 phút → 403 `reauth_required`. Tx: hook các module (mua bán: `user_id → null`), audit `account.delete` (`target_id` = id, không email), `delete from users` (cascade). Trả 204, xoá cookie |

## 8. Danh sách endpoint (tiền tố `/api`)

| Phương thức + đường dẫn | Đăng nhập | Ghi chú |
|---|---|---|
| `GET /health` | không | Yêu cầu 1.3 |
| `POST /auth/google` `{ idToken, client, consent? }` | không | 30 / 10 phút / IP |
| `POST /auth/email/start` `{ email }` | không | CC-8 |
| `POST /auth/email/verify` `{ email, challengeId, code, client, consent? }` | không | CC-8 |
| `POST /auth/logout` | có (bất kỳ client) | 204 |
| `GET /me` · `DELETE /me` | có | §7 |
| `POST /sync/progress` | có | §6 |
| `DELETE /sync/profiles/:profileId` | có | §6 |
| `/billing/*`, `/me/entitlements`, `/admin/*` | theo `mvp-mua-ban` | Dùng `AuthGuard` / `OptionalAuthGuard` / `AdminGuard` của spec này |

`consent` = `{ version: string, adult: true }`. Mã lỗi: `unauthenticated`, `bad_origin`, `invalid_google_token`, `consent_required`,
`not_admin`, `otp_rate_limited`, `otp_daily_cap`, `otp_invalid`, `otp_expired`, `email_send_failed`, `email_login_unavailable`,
`reauth_required`, `doc_too_large`, `too_many_profiles`, `sync_rate_limited`, `validation_failed`.

## 9. Ghi log và bảo mật

- `nestjs-pino`, JSON, `redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]', '*.email', '*.code',
  '*.idToken', '*.token', '*.docs', '*.content', '*.purchaseToken']`; không log thân yêu cầu; URL có `:profileId` được phép (UUID ngẫu nhiên).
- Test: chạy luồng OTP + Google giả + đồng bộ với logger ghi vào bộ nhớ, kiểm không có email mẫu, mã mẫu, token mẫu.
- `helmet()` (API chỉ trả JSON), `express.json({ limit })` theo route, `app.set('trust proxy', TRUST_PROXY_HOPS)`.
- So sánh bí mật bằng `timingSafeEqual` trên HMAC cùng độ dài.
- Container: `USER node`, `read_only: true` + `tmpfs: /tmp` cho `server`; `cap_drop: [ALL]`; `no-new-privileges`.

## 10. Game (`apps/game`)

### 10.1 Tệp

| Tệp | Việc |
|---|---|
| `src/account/api.ts` | `apiFetch(path, init)`: base `/api` (web) hoặc `${VITE_WEB_ORIGIN}/api` (app); `credentials: 'same-origin'` (web) / header Bearer (app); hết giờ 10 s; lỗi mạng → `{ kind: 'offline' }`; 401 → phát `sessionExpired` |
| `src/account/session.ts` | Store phản ứng `account = { status: 'guest' \| 'signedIn', userId, emailMasked, lastSyncAt, syncError }`; `signInWithGoogle`, `startEmail`, `verifyEmail`, `signOut`, `deleteAccount`; `onAuthChange(cb)` (`mvp-mua-ban` đăng ký `refreshEntitlement`, `claim`); `openAccount({ reason })` |
| `src/account/googleWeb.ts` | Nạp GIS một lần, render nút; bọc để test thay bằng giả |
| `src/account/googleNative.ts` | Bọc plugin (CC-11); chỉ nạp bằng `import()` khi `Capacitor.isNativePlatform()` |
| `src/account/tokenStore.ts` | Mã phiên trên app (CC-29): giao diện `get/set/clear`; web là bản rỗng |
| `src/account/sync.ts` | `syncNow()`: đọc mọi gói qua hàm của `mvp-tien-do-hoc` (từ `Db` SQLite) → `POST /sync/progress` → ghi từng gói về qua hàm nhận gói gộp → xử lý `deletedProfileIds` (CC-13) → gửi `sync_outbox`. Một lượt chạy một lúc (khoá trong bộ nhớ); lập lịch theo CC-14 |
| `src/views/AccountView.vue` | Màn Tài khoản (10.4) |
| `src/components/OtpInput.vue` | 6 ô số, dán cả mã, `autocomplete="one-time-code"` |
| `public/xoa-tai-khoan.html`, `public/privacy.html` | Trang tĩnh (CC-16; nội dung chính sách theo `mvp-android` CC-19) |

### 10.2 Bảng SQLite của tài khoản (thêm bằng `migrate()` của `Db`, quyết định 11)

```sql
CREATE TABLE account_state (id INTEGER PRIMARY KEY CHECK (id = 1), user_id TEXT, email_masked TEXT,
                            last_sync_at TEXT, sync_error TEXT, updated_at TEXT NOT NULL);
CREATE TABLE sync_outbox   (id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL,      -- 'delete_profile'
                            profile_id TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE (kind, profile_id));
-- chỉ khi CC-29 chọn (A)/(B):
CREATE TABLE account_session (id INTEGER PRIMARY KEY CHECK (id = 1), token TEXT NOT NULL, created_at TEXT NOT NULL);
```

Email chỉ lưu dạng đã che (`a***@gmail.com`). Gói tiến độ vẫn nằm ở bảng của `mvp-tien-do-hoc`; spec này không lưu bản sao thứ hai.

### 10.3 Phiên trên máy

- Web: không giữ mã phiên (cookie `HttpOnly`). Mở app: đọc `account_state` → hiện "đã đăng nhập" ngay (offline được); khi có mạng gọi
  `GET /api/me` để xác nhận; 401 → `status='guest'`, giữ dữ liệu, báo "Đăng nhập lại để đồng bộ" một lần.
- App: mã phiên theo CC-29; không bao giờ đưa vào log, gói đồng bộ, `account_state`.

### 10.4 Màn Tài khoản

```
Cài đặt ─ fieldset "Tài khoản" (sau "Giọng đọc", SettingsView.vue:60) ─ [Đăng nhập để lưu tiến độ] / [Tài khoản: a***@gmail.com]
   └→ screen = 'account'  (App.vue: thêm 'account' vào Screen, focus tiêu đề như các màn khác)
AccountView (khách):
   offline → nút khoá + Tomo đọc "Cần có mạng để đăng nhập"
   hồ sơ Mầm/Chồi → ParentGate (mvp-tien-do-hoc) trước (CC-12)
   [Nút Google] (GIS / plugin) · [Đăng nhập bằng email] → ô email → [Gửi mã] → OtpInput → [Đăng nhập]
   409 consent_required → ô "Tôi là phụ huynh hoặc từ 18 tuổi, đồng ý Chính sách quyền riêng tư" + [Tiếp tục]
   thành công → syncNow() → Tomo: "Đã lưu tiến độ vào tài khoản" → quay lại màn gọi (openAccount)
AccountView (đã đăng nhập):
   email đã che · cách đăng nhập · "Đã đồng bộ lúc …" / lỗi · [Đồng bộ ngay] · [Đăng xuất] · [Xoá dữ liệu trên máy này]
   · [Xoá tài khoản] (ParentGate → giải thích → gõ XOÁ → 403 reauth_required thì đăng nhập lại) · liên kết Chính sách
```

Chữ ngắn, tiếng Việt; câu cố định ở `packages/content/src/phrases.ts` (`accountNeedsNetwork`, `accountSaved`, `accountReauth`,
`accountUpdateGame`, `otpSent`, `otpWrong`…); nhóm Mầm đọc tên nút; mọi nút có `data-testid` (`account-google`, `account-email`,
`account-otp`, `account-consent`, `account-signout`, `account-delete`, `account-sync-now`).

### 10.5 Đăng xuất / xoá tài khoản trên máy (CC-15, CC-16)

`signOut()`: `POST /auth/logout` (lỗi mạng vẫn tiếp tục) → `tokenStore.clear()` → `account_state` về khách → phát `signedOut`
(`mvp-mua-ban` bỏ quyền nguồn tài khoản). Hồ sơ trên máy giữ nguyên. "Xoá dữ liệu trên máy này" gọi hàm xoá hồ sơ của
`mvp-tien-do-hoc` cho mọi hồ sơ.

### 10.6 Service worker và Vite

- `vite.config.ts`: `workbox.navigateFallbackDenylist: [/^\/api\//, /^\/admin\//]`; không `runtimeCaching` nào khớp `/api/` (mặc định
  đi mạng). `server.proxy` và `preview.proxy`: `'/api' → VITE_API_PROXY` (dev compose `http://server:3000`, E2E `http://localhost:3000`).
- `resolve.conditions` thêm `source` (CC-5).
- `xoa-tai-khoan.html`, `privacy.html` nằm trong precache (glob `html` sẵn có) → đọc được khi offline.

## 11. Docker

### 11.1 `docker/server/Dockerfile` (nhiều tầng, CC-4, CC-5)

```dockerfile
FROM node:22-alpine AS base            # ghim bản vá cụ thể khi viết; build được amd64 + arm64
RUN corepack enable && corepack prepare pnpm@11.28.11 --activate
WORKDIR /repo

FROM base AS dev                       # compose dev: mã bind mount, node_modules trong volume
CMD ["sh", "-c", "pnpm install --frozen-lockfile && pnpm --filter @study/server dev"]

FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/content/package.json packages/content/
COPY apps/server/package.json apps/server/
RUN pnpm install --frozen-lockfile --filter @study/server...
COPY tsconfig.base.json ./
COPY packages/content packages/content
COPY apps/server apps/server
RUN pnpm --filter @study/content build && pnpm --filter @study/server build \
 && pnpm --filter @study/server deploy --prod /out

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /out ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "dist/main.js"]
```

`.dockerignore`: `**/node_modules`, `**/dist`, `**/coverage`, `.env*` (trừ `*.example`), `apps/game/public/audio` (không cần cho máy chủ),
`tools/`, `.git`.

### 11.2 `docker/web/Dockerfile` (bản web tĩnh trong Caddy)

```dockerfile
FROM node:22-alpine AS build
# … corepack, pnpm install --filter @study/game... (và @study/admin... khi có)
ARG VITE_GOOGLE_WEB_CLIENT_ID
RUN pnpm --filter @study/game build      # (+ apps/admin build, base '/admin/')
FROM caddy:2-alpine
COPY docker/caddy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /repo/apps/game/dist /srv/game
# COPY --from=build /repo/apps/admin/dist /srv/admin   (mvp-mua-ban)
```

Âm thanh tạo sẵn đi theo `apps/game/dist` (`docs/deploy.md` mục 1) → build web cần thư mục âm thanh đã tạo trên máy nhóm.

### 11.3 `docker/caddy/Caddyfile`

```
{
  email {$ACME_EMAIL}
}
{$SITE_ADDRESS} {
  encode zstd gzip
  header {
    Strict-Transport-Security "max-age=31536000"
    X-Content-Type-Options nosniff
    Referrer-Policy strict-origin-when-cross-origin
    Permissions-Policy "geolocation=(), camera=(), microphone=()"
    -Server
  }
  handle /api/* {
    reverse_proxy server:3000
  }
  handle /ads-config.json {
    root * /srv/config
    header Cache-Control "no-store"
    file_server
  }
  handle_path /admin/* {
    root * /srv/admin
    try_files {path} /index.html
    file_server
  }
  handle {
    root * /srv/game
    @shell path /index.html /sw.js /manifest.webmanifest /registerSW.js
    header @shell Cache-Control "no-cache"
    header /assets/* Cache-Control "public, max-age=31536000, immutable"
    try_files {path} /index.html
    file_server
  }
}
```

CSP chưa đặt ở MVP (GIS cần `accounts.google.com`, AdSense của `mvp-quang-cao` cần thêm nguồn) — ghi việc sau MVP.

### 11.4 `docker-compose.yml` (dev, CC-26)

```yaml
name: tomo-dev
services:
  db:
    image: postgres:17-alpine                      # CC-2
    environment: { POSTGRES_DB: tomo, POSTGRES_USER: tomo_owner, POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}, DB_APP_PASSWORD: ${DB_APP_PASSWORD} }
    volumes: [pgdata:/var/lib/postgresql/data, ./docker/postgres/initdb.sh:/docker-entrypoint-initdb.d/initdb.sh:ro]
    ports: ["127.0.0.1:${DB_PORT:-5432}:5432"]
    healthcheck: { test: ["CMD-SHELL", "pg_isready -U tomo_owner -d tomo"], interval: 5s, retries: 20 }
  mailpit:
    image: axllent/mailpit:<ghim bản>
    ports: ["127.0.0.1:8025:8025"]
  server:
    build: { context: ., dockerfile: docker/server/Dockerfile, target: dev }
    env_file: .env
    environment: { DATABASE_URL: postgres://tomo_app:${DB_APP_PASSWORD}@db:5432/tomo, DATABASE_URL_MIGRATE: postgres://tomo_owner:${POSTGRES_PASSWORD}@db:5432/tomo,
                   DATABASE_URL_TEST: postgres://tomo_owner:${POSTGRES_PASSWORD}@db:5432/tomo_test, MAIL_DRIVER: mailpit, MAILPIT_URL: http://mailpit:8025 }
    volumes: [.:/repo, nm-root:/repo/node_modules, nm-server:/repo/apps/server/node_modules,
              nm-content:/repo/packages/content/node_modules, nm-game:/repo/apps/game/node_modules, pnpm-store:/pnpm-store]
    ports: ["127.0.0.1:3000:3000"]
    depends_on: { db: { condition: service_healthy } }
  game:
    build: { context: ., dockerfile: docker/server/Dockerfile, target: dev }   # cùng image Node
    command: ["sh", "-c", "pnpm install --frozen-lockfile && pnpm --filter @study/game dev --host 0.0.0.0"]
    environment: { VITE_API_PROXY: http://server:3000 }
    volumes: [ … như server … ]
    ports: ["127.0.0.1:5173:5173"]
    depends_on: [server]
volumes: { pgdata: {}, nm-root: {}, nm-server: {}, nm-content: {}, nm-game: {}, pnpm-store: {} }
```

`docker/postgres/initdb.sh` (chỉ chạy khi volume trống): tạo người dùng `tomo_app`, DB `tomo_test`. Lệnh thường dùng (ghi vào `docs/deploy.md` mục 2):

```bash
docker compose up -d
docker compose exec -T server pnpm --filter @study/server cli migrate
docker compose exec -T server pnpm --filter @study/server test          # unit + API e2e trên tomo_test
docker compose exec -T server pnpm --filter @study/server cli admin:grant <email>
```

Ổ đĩa máy dev gần đầy: image Node alpine + Postgres alpine + Mailpit khoảng 0,5 GB; không kéo image Playwright (E2E chạy trên máy
chủ thật của dev hoặc CI, 11.6).

### 11.5 `docker-compose.prod.yml`

```yaml
name: tomo-prod
x-logging: &logging { driver: json-file, options: { max-size: 10m, max-file: "3" } }    # CC-27
services:
  caddy:
    build: { context: ., dockerfile: docker/web/Dockerfile, args: [VITE_GOOGLE_WEB_CLIENT_ID] }
    image: tomo-web:prod
    ports: ["80:80", "443:443", "443:443/udp"]
    environment: [SITE_ADDRESS, ACME_EMAIL]
    volumes: [caddy-data:/data, caddy-config:/config, ./deploy/config:/srv/config:ro]   # ads-config.json
    networks: [edge]
    depends_on: [server]
    restart: unless-stopped
    logging: *logging
  server:
    build: { context: ., dockerfile: docker/server/Dockerfile, target: runtime }
    image: tomo-server:prod
    env_file: .env.prod
    read_only: true
    tmpfs: [/tmp]
    cap_drop: [ALL]
    security_opt: ["no-new-privileges:true"]
    volumes: [backups:/backups:ro]
    networks: [edge, internal]                    # không có "ports": chỉ Caddy gọi tới
    depends_on: { db: { condition: service_healthy } }
    restart: unless-stopped
    logging: *logging
  db:
    image: postgres:17-alpine
    environment: [POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD, DB_APP_PASSWORD]
    volumes: [pgdata:/var/lib/postgresql/data, ./docker/postgres/initdb.sh:/docker-entrypoint-initdb.d/initdb.sh:ro]
    networks: [internal]                          # không mở cổng
    healthcheck: { test: ["CMD-SHELL", "pg_isready -U $$POSTGRES_USER -d $$POSTGRES_DB"], interval: 10s, retries: 12 }
    restart: unless-stopped
    logging: *logging
  backup:
    build: { context: ., dockerfile: docker/backup/Dockerfile }   # postgres:17-alpine + age + rclone (CC-23)
    environment: [POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD, BACKUP_KEEP, BACKUP_EVERY_HOURS, BACKUP_AGE_RECIPIENT, RCLONE_REMOTE]
    volumes: [backups:/backups, ./docker/backup/backup.sh:/backup.sh:ro]
    networks: [internal, egress]                  # egress chỉ để rclone đẩy ra R2
    depends_on: { db: { condition: service_healthy } }
    restart: unless-stopped
    logging: *logging
networks:
  edge: {}
  internal: { internal: true }
  egress: {}
volumes: { pgdata: {}, backups: {}, caddy-data: {}, caddy-config: {} }
```

Lưu ý: `server` cần ra Internet (Google JWKS, Resend) → mạng `edge` có đường ra; `internal: true` chỉ áp cho mạng của DB.
Caddy image chính thức chạy bằng root để mở 80/443 — giữ như vậy ở MVP, ghi rủi ro; các container khác không phải root.

Triển khai (CC-25, `scripts/deploy-prod.sh`):

```bash
P="docker compose -f docker-compose.prod.yml --env-file .env.prod"
git pull --ff-only
$P build
$P run --rm server node dist/cli.js migrate     # trước khi đổi bản
$P up -d
curl -fsS https://$SITE_ADDRESS/api/health
```

### 11.6 Sao lưu (`docker/backup/backup.sh`, CC-23)

Theo `medicine-management/docker/backup/backup.sh`: vòng lặp `pg_dump -Fc -h db` → `gzip -t` không cần (định dạng custom) → kiểm
`pg_restore --list` đọc được → `age -r $BACKUP_AGE_RECIPIENT` → giữ `BACKUP_KEEP` bản → `rclone copy` lên `RCLONE_REMOTE` → ghi
`status.json { last_success_at, last_file, last_error, offsite_ok }`. Khoá bí mật `age` **không** nằm trên máy ảo (chủ sản phẩm giữ).
Khôi phục: tải bản, `age -d`, `pg_restore -d <db tạm>`; ghi đủ bước + lịch thử hằng tháng vào `docs/deploy.md` mục 7.

## 12. CI (CC-24)

| Job | Thay đổi |
|---|---|
| `check` | Thêm `services.postgres` (`postgres:17-alpine`, healthcheck `pg_isready`), env `DATABASE_URL_TEST`; trước `test:coverage` chạy `pnpm --filter @study/server cli migrate` với DB thử. `scripts/coverage-changed.mjs`: thêm `apps/server/coverage/clover.xml` vào `CLOVERS`, `apps\/server\/src\/.*\.ts` vào `MEASURED` |
| `account-e2e` (mới, `needs: check`) | `cp .env.example .env` + giá trị thử sinh ngẫu nhiên; `docker compose up -d db mailpit server` (`AUTH_GOOGLE_FAKE=true`); chờ `/api/health`; build game với `VITE_GOOGLE_WEB_CLIENT_ID=fake`; `pnpm --filter @study/game exec playwright test e2e/account.spec.ts` (preview proxy `/api` → `localhost:3000`); tải lên `test-results` |
| `docker` (mới) | `docker build --target runtime -f docker/server/Dockerfile .`; build `docker/web/Dockerfile`; `docker compose -f docker-compose.prod.yml --env-file .env.prod.example config -q`; chạy image server + postgres thử, chờ `/api/health` 200 |

`e2e` hiện có giữ nguyên (game không cần máy chủ); `account.spec.ts` bị bỏ qua ở job đó khi không có `E2E_API=1`
(`test.skip(!process.env.E2E_API, 'cần máy chủ')` — không phải nới test, chỉ chạy ở job có máy chủ).

## 13. Test

| Mức | Nội dung |
|---|---|
| Unit máy chủ (Vitest + SWC) | `env.ts` (thiếu biến, cờ test bị chặn ở production); `normalizeEmail`; `OtpService` với DB giả / đồng hồ giả: mã đúng, sai, hết lượt, hết hạn, mã cũ bị huỷ khi gửi mới, cooldown, giới hạn giờ / ngày, trần toàn hệ thống; `GoogleVerifier` với `OAuth2Client` giả (iss sai, email chưa xác minh, aud sai); `SessionService` (tạo, trượt, hết hạn, tuyệt đối, tối đa 10, admin không trượt); `OriginGuard`; `AdminGuard` (thiếu role / thiếu email / phiên user); `SyncService` dùng `mergeProgress` thật (invalid, newer, tombstone, quá kích thước, quá số hồ sơ); `MailDriver` resend/mailpit với `fetch` giả; redact log; CLI |
| API e2e (Nest + supertest + PostgreSQL `tomo_test`, truncate mỗi test) | Luồng OTP đầy đủ (đọc mã từ `MemoryMailDriver`), phản hồi giống nhau email có/không tài khoản; Google giả → tạo tài khoản, gắn email cùng tài khoản (CC-10); 409 `consent_required`; cookie đúng thuộc tính; Bearer cho android; CSRF thiếu `Origin` → 403; CORS `https://localhost`; `/me` 401; logout; đồng bộ: gộp, chạy lại không đổi, **hai yêu cầu song song cùng hồ sơ** không mất sao, hồ sơ máy khác được trả về, xoá hồ sơ + `deletedProfileIds`, không sống lại; xoá tài khoản (reauth, cascade, đăng nhập lại tạo tài khoản mới, audit không có email); admin: CLI grant → đăng nhập `client=admin` được, bỏ khỏi `ADMIN_EMAILS` → 403 ngay; giới hạn tần suất 429; `tomo_app` không `UPDATE audit_logs` (lỗi quyền); migration áp lên DB trống |
| Unit game (jsdom) | `api.ts` (offline, 401, base URL web/app), `session.ts` (khôi phục từ `account_state`, đăng xuất giữ hồ sơ, sự kiện), `sync.ts` (gom 30 s, một lượt một lúc, `deletedProfileIds` hỏi người chơi, outbox), `AccountView` (offline khoá nút, cổng phụ huynh Mầm/Chồi, ô đồng ý, lỗi OTP, thứ tự đọc), `OtpInput`; `Db` SQLite bằng `sql.js` trong bộ nhớ (migration bảng mới) |
| Playwright (`apps/game/e2e/account.spec.ts`, máy tính + điện thoại, job `account-e2e`) | Khách chơi một màn → Cài đặt → Tài khoản → email → đọc mã từ API Mailpit (`GET http://localhost:8025/api/v1/message/latest`) → đồng ý → "Đã lưu" ; context thứ hai đăng nhập cùng email → thấy sao của màn đã chơi; Google giả (`page.route` thay script GIS bằng bản giả gọi callback `fake:…`); tắt mạng → nút đăng nhập khoá, đã đăng nhập vẫn chơi, có mạng lại tự đồng bộ; đăng xuất giữ hồ sơ; xoá tài khoản; ảnh chụp `shot()` các màn mới |
| Docker | Job `docker` (§12); thủ công: dựng máy ảo theo `docs/deploy.md`, HTTPS, khôi phục bản sao lưu |
| Thủ công trước phát hành | Đăng nhập Google thật trên web (tên miền thật) và app Android (internal testing), tài khoản Family Link (CC-11); thư Resend thật tới Gmail / Outlook không vào thư rác (SPF/DKIM) |
