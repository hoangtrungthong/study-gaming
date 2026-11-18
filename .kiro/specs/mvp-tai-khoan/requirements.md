# Tài liệu yêu cầu — Tài khoản, máy chủ và đồng bộ MVP (mvp-tai-khoan)

> Viết ngày 2026-11-18, chưa code. Nguồn: `docs/kich-ban-game.md` mục 10.5, 10.7, 12.1, 12.2; `.kiro/specs/mvp-cho-chot.md`;
> hợp đồng của các spec phụ thuộc (`mvp-tien-do-hoc`, `mvp-mua-ban`, `mvp-android`, `mvp-quang-cao`); `docs/deploy.md`.
> **Cập nhật 2026-11-18:** chủ sản phẩm đã đồng ý toàn bộ đề xuất (mục "Điểm chốt thêm"). Ghi chú gốc: mọi điểm ở mục "Chờ chốt" phải được chủ sản phẩm trả lời trước khi code phần phụ thuộc (`AGENTS.md` mục 3 và 5).

## Giới thiệu

Spec này dựng **máy chủ đầu tiên** của dự án và mọi thứ quanh nó:

- Khung `apps/server` (NestJS + PostgreSQL) trong cùng pnpm workspace: cấu hình, ORM + migration, ghi log an toàn, kiểm sức khoẻ.
- **Đăng nhập** bằng Google (nút Google trên web, đăng nhập Google gốc trên app Android) và **email + mã OTP** gửi qua Resend.
- **Phiên đăng nhập**, đăng xuất, xoá tài khoản (yêu cầu của Google Play).
- **Đồng bộ tiến độ** theo đúng hợp đồng `ProgressDocV1` / `SyncRequestV1` / `SyncResponseV1` / `mergeProgress` /
  `migrateProgress` của `mvp-tien-do-hoc` (không định nghĩa lại), gồm gộp tiến độ khách khi đăng nhập lần đầu.
- **Vai trò quản trị** (`users.role`, lệnh CLI, `ADMIN_EMAILS`) mà `mvp-mua-ban` dùng cho `apps/admin`.
- Phía game (`apps/game`): màn Tài khoản, lưu phiên, hành vi khi mất mạng, gọi đồng bộ.
- **Docker**: Dockerfile cho máy chủ và bản web tĩnh, `docker-compose.yml` cho phát triển (server + PostgreSQL + game dev +
  hộp thư thử), `docker-compose.prod.yml` cho máy ảo (server + PostgreSQL + reverse proxy có TLS phục vụ PWA + sao lưu),
  cách CI chạy test máy chủ.

**Không thuộc spec này:**

| Phần | Thuộc spec |
|---|---|
| Đơn hàng, webhook SePay, Google Play Billing, quyền `entitlement.noAds`, các màn của `apps/admin` | `mvp-mua-ban` |
| Hiện quảng cáo, nội dung `ads-config.json` | `mvp-quang-cao` (spec này chỉ chừa chỗ phục vụ file đó trên reverse proxy) |
| Dự án Capacitor, khoá ký, AAB, bảng Data safety, phát hành Google Play | `mvp-android` (spec này chỉ thêm plugin đăng nhập Google và mã gọi nó) |
| Kiểu và hàm tiến độ (`ProgressDocV1`, `mergeProgress`…), màn hồ sơ, cổng phụ huynh (`ParentGate.vue`) | `mvp-tien-do-hoc` |
| Đăng nhập số điện thoại / Zalo ZNS, App Store / iOS | sau MVP / giai đoạn 2 |

### Hiện trạng đã rà trong code (nhánh `chore/quy-trinh-nhu-medicine`, commit `ddb53ee`)

- **Chưa có máy chủ:** `docs/ai/00-overview.md:16` ghi `apps/server/` "**Chưa có**". `pnpm-workspace.yaml:2` gom `apps/*`,
  nên `apps/server` (và `apps/admin` của `mvp-mua-ban`) tự vào workspace. `package.json` gốc chạy `pnpm -r test`, `pnpm -r build`,
  `pnpm -r typecheck` → gói mới phải có đủ các script `test`, `test:coverage`, `build`, `typecheck`.
- **Chưa có Docker:** không có `Dockerfile`, `docker-compose*.yml`, `.env.example` nào trong repo. `docs/deploy.md` đã viết trước
  các bước, đánh dấu "(chờ chốt)" những chỗ thuộc spec này; nó dùng tiền tố `/api/*`, cổng `server:3000`, `GET /api/health`
  (`docs/deploy.md` mục 5, 7) — spec này giữ đúng các tên đó.
- **`.gitignore` chưa chặn `.env`** (chỉ có `node_modules/`, `dist/`…); hook `pre-commit` có chặn `.env*` trừ `*.example`
  (`.githooks/pre-commit:34`) và chặn dòng giống secret (`:51-58`). Cần thêm `.env`, `.env.*`, `!.env*.example` vào `.gitignore`.
- **Game:** `apps/game/src/App.vue:12` `type Screen = 'home' | 'island' | 'match' | 'rain' | 'settings'` (không router).
  Màn Cài đặt `apps/game/src/views/SettingsView.vue` có các `fieldset` "Nhóm tuổi" (`:42`), "Giọng đọc" (`:60`), "Ghi công giọng
  đọc" (`:82`). Cài đặt lưu `localStorage` (`apps/game/src/settings.ts:24,38`).
- **Service worker:** precache `**/*.{js,css,html,svg,png,woff2,json}` (`apps/game/vite.config.ts:26`), `navigateFallback:
  'index.html'` (`:37`) **không có danh sách loại trừ** → nếu PWA và trang quản trị / API cùng tên miền, service worker sẽ trả
  `index.html` của game cho điều hướng `/admin/...`. Cần `navigateFallbackDenylist` (design §10.6).
- **Kiểm độ phủ file bị đổi** chỉ biết hai gói: `scripts/coverage-changed.mjs:12` (`CLOVERS`) và `:15` (`MEASURED`). Phải thêm
  `apps/server` (và `apps/admin` khi có), nếu không file máy chủ bị đổi sẽ bị bỏ qua.
- **TypeScript gốc** (`tsconfig.base.json`): `module: ESNext`, `moduleResolution: Bundler`, `verbatimModuleSyntax`,
  `isolatedModules`, `noEmit`. NestJS cần `experimentalDecorators` + `emitDecoratorMetadata` và phát mã ra `dist/` → `apps/server`
  cần `tsconfig` riêng (design §2.3).
- **`@study/content` không build:** `packages/content/package.json` `exports: { ".": "./src/index.ts" }`, import JSON có
  `with { type: 'json' }` (`docs/ai/00-overview.md` mục 8). Bản build máy chủ chạy bằng Node phải xử lý được điều này (CC-5).
- **CI** (`.github/workflows/ci.yml`): ba job `check`, `tts-tool`, `e2e`, không có PostgreSQL, không có Docker.
- **Hợp đồng đã chốt ở spec khác mà spec này phải giữ đúng tên:**
  - `mvp-tien-do-hoc/design.md` §5.1: `SyncRequestV1 { schema: 1; deviceId; docs: ProgressDocV1[] }`, `SyncResponseV1 { schema: 1;
    docs }`; máy chủ `migrateProgress` → `mergeProgress(bản lưu, gói nhận)` → lưu → trả mọi hồ sơ của tài khoản; lưu "một dòng
    `jsonb` cho mỗi cặp tài khoản + `profileId`"; đề xuất gói ≤ 512 KB; giữ nguyên `levelId` / `itemId` lạ; xoá hồ sơ đã đồng bộ
    (bản ghi "đã xoá") thuộc spec này (§5.3); đồng ý của phụ huynh trước khi gửi gói hồ sơ Mầm/Chồi phụ thuộc Q-5 (§5.4).
  - `mvp-mua-ban/requirements.md` CC-19 (đã chốt): đăng nhập của spec này + `users.role = 'admin'` gán bằng CLI, mọi `/admin/*`
    kiểm vai trò ở máy chủ, **phiên quản trị hết hạn sau 12 giờ**, `ADMIN_EMAILS` là lớp chặn thứ hai. `mvp-mua-ban/design.md` §2
    dùng `users.id uuid`, bảng `audit_logs` ("nếu `mvp-tai-khoan` đã có bảng audit thì dùng chung"), endpoint `GET /me/entitlements`,
    `/billing/*`, `/admin/*`; DTO "kiểm bằng cơ chế kiểm dữ liệu `mvp-tai-khoan` chọn"; cần "sự kiện vừa đăng nhập / gộp khách".
  - `mvp-android/design.md` §4: app gọi API bằng URL tuyệt đối từ `VITE_WEB_ORIGIN`; app chạy ở origin `https://localhost`
    (`server: { androidScheme: 'https' }`, §3). §9.4: dịch vụ đăng nhập phải dùng được với đối tượng trẻ em, không gửi định danh
    máy, có xoá tài khoản trong app + link web.
  - `mvp-quang-cao/requirements.md` CC-2: `ads-config.json` cùng tên miền với bản web, không nằm trong `public/`, địa chỉ ở
    `VITE_ADS_CONFIG_URL`.

### Tra cứu (2026-11-18)

| Nguồn | Điều rút ra |
|---|---|
| [Resend — Pricing](https://resend.com/pricing) | Gói Free: **3.000 email/tháng, tối đa 100/ngày**, 3 tên miền tuỳ chỉnh; giữ log 30 ngày; giới hạn tốc độ gọi API tính theo nhóm, như nhau mọi gói. → Cần trần gửi OTP mỗi ngày dưới 100 (CC-8). |
| [Resend — Send email API](https://resend.com/docs/api-reference/emails/send-email) | `POST https://api.resend.com/emails`, header `Authorization: Bearer <key>`; gửi được bằng `fetch`, không bắt buộc SDK. Phải xác minh tên miền gửi bằng bản ghi DNS (SPF/DKIM). |
| [Google Identity Services — Overview](https://developers.google.com/identity/gsi/web/guides/overview) | Nút "Sign in with Google" trên web trả **ID token (JWT)** cho hàm callback; nút do Google vẽ, cần tải script `https://accounts.google.com/gsi/client` (cần mạng). |
| [Verify the Google ID token on your server side](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token) | Máy chủ kiểm chữ ký, `aud` là một trong các client ID của mình, `iss` là `accounts.google.com`, `exp`; dùng `sub` làm khoá người dùng (email có thể đổi). `google-auth-library` `verifyIdToken({ audience: string \| string[] })` ([kiểu](https://googleapis.dev/nodejs/google-auth-library/latest/interfaces/VerifyIdTokenOptions.html)). |
| [Capgo — capacitor-social-login](https://github.com/Cap-go/capacitor-social-login), [hướng dẫn Android](https://capgo.app/docs/plugins/social-login/google/android/) | Fork của `@codetrix-studio/capacitor-google-auth`; dòng v8 cho Capacitor 8; Android dùng **Credential Manager** (không dùng `GoogleSignInClient` cũ); khởi tạo bằng **Web client ID**, cần thêm Android client (tên gói + SHA-1, gồm SHA-1 của khoá Play App Signing). ID token trả về có `aud` = Web client ID. |
| [Capawesome — Google Sign-In](https://capawesome.io/blog/how-to-sign-in-with-google-using-capacitor/) | Plugin khác, cũng dùng Credential Manager; lựa chọn thứ hai (CC-11). |
| [Google Play — Account deletion requirements](https://support.google.com/googleplay/android-developer/answer/13327111) | App cho tạo tài khoản phải có **đường xoá tài khoản trong app** và **một trang web** yêu cầu xoá không cần cài lại app (khai ở Data safety); xoá cả dữ liệu gắn với tài khoản; được giữ một phần dữ liệu vì bảo mật / chống gian lận / pháp luật nhưng phải nói rõ. Vi phạm sau 31/5/2024 có thể bị gỡ app. |
| [Google Play — Families policy](https://support.google.com/googleplay/android-developer/answer/9893335) | "Thông tin xác thực" của trẻ là thông tin nhạy cảm, phải khai; app hỗn hợp **không được bắt** người dùng đi qua API/SDK không được duyệt cho trẻ em; trao đổi thông tin cá nhân cần "hành động của người lớn" (ví dụ xác minh email, ngày sinh, PIN). Nhóm tuổi đã khai gồm "5 tuổi trở xuống" (`mvp-android` CC-18) → áp cho cả app. |
| [Nghị định 13/2023/NĐ-CP, Điều 20](https://hethongphapluat.com/nghi-dinh-13-2023-nd-cp-ve-bao-ve-du-lieu-ca-nhan/dieu-20) | Phải **xác minh tuổi** trước khi xử lý dữ liệu cá nhân của trẻ em; trẻ từ đủ 7 tuổi cần đồng ý của trẻ **và** cha mẹ / người giám hộ; cha mẹ được rút đồng ý. (Trang tổng hợp, chưa đối chiếu Công báo.) |
| [Luật Bảo vệ dữ liệu cá nhân 91/2025/QH15](https://luatvietnam.vn/dan-su/tai-toan-van-luat-bao-ve-du-lieu-ca-nhan-2025-pdf-word-568-103646-article.html) ([tin hiệu lực](https://hatinh.gov.vn/vi/bai-viet/luat-bao-ve-du-lieu-ca-nhan-chinh-thuc-co-hieu-luc-thi-hanh-tu-ngay-112026)) | **Có hiệu lực từ 01/01/2026**, Điều 24 về dữ liệu trẻ em; Nghị định 356/2025/NĐ-CP hướng dẫn. Kịch bản Q-5 chỉ nhắc Nghị định 13/2023 → cần người có chuyên môn xác nhận văn bản nào đang áp dụng (CC-12). |
| [NestJS — Testing](https://docs.nestjs.com/fundamentals/testing), [NestJS — SWC / Vitest](https://docs.nestjs.com/recipes/swc) | `Test.createTestingModule` + `supertest` cho test API; chạy Vitest với Nest cần SWC (`unplugin-swc`) vì esbuild không phát `emitDecoratorMetadata`. |
| [GitHub Actions — PostgreSQL service containers](https://docs.github.com/en/actions/use-cases-and-examples/using-containerized-services/creating-postgresql-service-containers) | Job CI có thể kèm container PostgreSQL có healthcheck, không cần Docker Compose. [Testcontainers for Node](https://node.testcontainers.org/) là lựa chọn khác (cần Docker trong lúc test). |
| [Docker — Compose in production](https://docs.docker.com/compose/how-tos/production/) | Tách file prod (không bind mount mã, `restart`, biến môi trường riêng); chỉ mở cổng cần thiết. |
| [Caddy — Automatic HTTPS](https://caddyserver.com/docs/automatic-https) | Caddy tự xin và gia hạn chứng chỉ Let's Encrypt khi tên miền trỏ đúng IP và cổng 80/443 mở. medicine-management dùng mẫu này (`docker/caddy/Caddyfile.home`). |
| medicine-management (chỉ đọc) | Dev: mọi dịch vụ trong container, bind mount mã, `node_modules` trong volume ẩn danh (`docker-compose.yml`, `docker/frontend/Dockerfile`). Prod: image chứa mã, DB không mở cổng, chỉ reverse proxy ra ngoài, `backup` dump mỗi 24 giờ giữ 14 bản + `status.json` (`docker-compose.prod.yml`, `docker/backup/backup.sh`); bí mật mount chỉ đọc, không vào image. |
| [OWASP — Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html) | Mã phiên ngẫu nhiên ≥ 64 bit entropy, cookie `HttpOnly` + `Secure` + `SameSite`, hết hạn khi rảnh và hết hạn tuyệt đối, thu hồi được ở máy chủ. |
| [Android WebView — CookieManager.setAcceptThirdPartyCookies](https://developer.android.com/reference/android/webkit/CookieManager#setAcceptThirdPartyCookies(android.webkit.WebView,%20boolean)) | Mặc định WebView **không nhận cookie bên thứ ba** (app nhắm API ≥ 21). App ở `https://localhost` gọi API ở tên miền khác → cookie phiên là bên thứ ba → trên app nên dùng token ở header (CC-6). |

### Quyết định đã thống nhất (ràng buộc đầu vào)

Chỉ gồm điều đã chốt trong kịch bản mục 12.1, phần thân kịch bản ghi "đã chốt", và các quyết định chủ sản phẩm đưa ngày 2026-11-18.

1. **Đăng nhập MVP = Google + email OTP gửi qua Resend** (Q-3 sửa 2026-11-18, Q-27). Số điện thoại / Zalo ZNS làm **sau MVP**.
   Trên app dùng đăng nhập Google gốc của Android; trên web dùng nút Google (kịch bản 10.7).
2. **Một người gắn được nhiều cách đăng nhập vào cùng một tài khoản** (kịch bản 10.7).
3. **Chơi khách được** (Q-26): chơi đầy đủ, tiến độ lưu trên máy; chỉ cần đăng nhập khi **mua trên web** hoặc **đồng bộ nhiều máy**.
   **Đăng nhập lần đầu thì tiến độ trên máy được gộp vào tài khoản.**
4. **Đăng nhập cần mạng; đã đăng nhập thì chơi offline bình thường, có mạng lại thì đồng bộ** (kịch bản 10.7).
5. **Máy chủ = NestJS + PostgreSQL**, cùng pnpm workspace với game (`apps/server`), dùng chung gói kiểu dữ liệu (Q-25).
6. **Nơi đặt máy chủ (Q-29, chốt 2026-11-18):** **một máy ảo Ubuntu trên cloud**, mọi thứ chạy bằng **Docker / Docker Compose**,
   chạy liên tục (không ngủ). **Docker dùng cả khi phát triển** (như medicine-management: test chạy trong container). Các bước
   triển khai ghi ở `docs/deploy.md`.
7. **Nhóm tuổi khai trên Google Play gồm cả "5 tuổi trở xuống"** (`mvp-android` CC-18, chốt 2026-11-18) → chính sách Families áp
   cho cả app, gồm phần đăng nhập (`mvp-android/design.md` §9.4).
8. **Mọi đề xuất trong các spec anh em đã được chấp nhận ngày 2026-11-18** (`mvp-cho-chot.md`). Những điều spec này phải tuân theo:
   - `mvp-tien-do-hoc` CC-20 (quy tắc gộp), CC-21 (code tiến độ ở `packages/content/src/progress/`, xuất qua `@study/content`),
     CC-3 (biệt danh không đồng bộ), CC-19 (xoá hồ sơ trên máy chủ thuộc spec này), CC-6 (nút "Đăng nhập để giữ tiến độ" trên Safari).
   - `mvp-mua-ban` CC-18 (trang quản trị là app riêng `apps/admin`), CC-19 (xác thực quản trị như mục "Hiện trạng" ở trên),
     CC-22 (quyền lưu trên máy khoá `tomo.entitlement.v1`, làm mới sau đăng nhập / đăng xuất).
   - `mvp-quang-cao` CC-2 (`ads-config.json` cùng tên miền với web, ngoài `public/`).
9. Dữ liệu trẻ em: không gửi dữ liệu cá nhân ra ngoài khi chưa cần; **không log email, số điện thoại, OTP, nội dung chuyển khoản**
   (`AGENTS.md` 2.7). **Q-5** (phụ huynh đồng ý khi tạo tài khoản cho Mầm/Chồi) **còn mở** trong kịch bản 12.2 → CC-12.
10. Không thêm thư viện khi chưa hỏi (`AGENTS.md` mục 6) → danh sách thư viện ở CC-4, CC-11, CC-28, CC-29.

11. **Dữ liệu offline trên máy dùng SQLite** (chốt 2026-11-18, `mvp-cho-chot.md` 2.6 và mục 7; `mvp-tien-do-hoc`
    requirements quyết định thêm dòng 92): một lớp `Db` chung theo mẫu medicine-management `frontend/src/offline/db/`; app Android
    `@capacitor-community/sqlite` 8.x, trình duyệt `sql.js` lưu file DB vào IndexedDB, test `sql.js` trong bộ nhớ, bảng
    `schema_version` + `migrate()` khi mở. `ProgressDocV1` vẫn là gói đồng bộ (đọc ra từ / ghi vào SQLite). → Phía game của spec
    này đọc / ghi trạng thái tài khoản và dữ liệu đồng bộ qua `Db` đó (thêm bảng bằng `migrate()`), **không** dùng `localStorage`.
    Máy chủ vẫn PostgreSQL. Nơi lưu **mã phiên** trên app: CC-29.

### Điểm chốt thêm (2026-11-18)

Chủ sản phẩm **đồng ý toàn bộ đề xuất** ngày 2026-11-18: mỗi điểm dưới đây chốt theo phần **Đề xuất** của nó (phần tra cứu
và lý do giữ lại để biết vì sao). Hệ quả chéo: CC-13 thêm `deletedProfileIds` vào `SyncResponseV1` của `mvp-tien-do-hoc`.

**Nền máy chủ**

**CC-1. ORM và công cụ migration.**
- Lựa chọn: (A) **Drizzle ORM + drizzle-kit** — lược đồ viết bằng TS, truy vấn gần SQL, migration sinh ra là file `.sql` đọc
  được, không có bước sinh client ([docs](https://orm.drizzle.team/docs/overview)); (B) **Prisma** — DSL `schema.prisma` riêng,
  cần `prisma generate`, migration SQL tự sinh ([docs](https://www.prisma.io/docs)); (C) **TypeORM** — tích hợp chính thức của
  NestJS, entity bằng decorator ([NestJS database](https://docs.nestjs.com/techniques/database)); (D) Kysely (chỉ query builder)
  + công cụ migration riêng.
- **Đề xuất:** (A).
- Lý do: kiểu suy ra thẳng từ lược đồ TS (đúng tinh thần một ngôn ngữ, Q-25); migration là SQL thuần nên viết được
  `COMMENT ON` tiếng Việt, chỉ mục một phần, `REVOKE UPDATE, DELETE ON audit_logs` mà `mvp-mua-ban/design.md` §2 cần; cần
  `SELECT … FOR UPDATE` cho gộp tiến độ và đơn hàng — Drizzle viết được trực tiếp; không có tệp nhị phân / bước sinh mã làm
  phức tạp Docker. Chặn: việc 3 và mọi việc sau.

**CC-2. Phiên bản PostgreSQL.**
- Lựa chọn: 16, **17**, 18 (image chính thức `postgres:<n>-alpine`). [Chính sách hỗ trợ](https://www.postgresql.org/support/versioning/):
  mỗi bản lớn được hỗ trợ 5 năm.
- **Đề xuất:** `postgres:17-alpine`, ghim cùng một thẻ ở compose dev, compose prod, CI.
- Lý do: hỗ trợ tới khoảng 11/2029, mọi công cụ (ORM, `pg_dump`) đã quen; 18 mới hơn, chưa cần tính năng nào của nó. Chặn: việc 1.

**CC-3. Cách kiểm dữ liệu đầu vào (DTO).** `mvp-mua-ban` dùng chung cơ chế spec này chọn.
- Lựa chọn: (A) `class-validator` + `class-transformer` (mặc định của NestJS, `ValidationPipe`); (B) **`zod`** + một pipe nhỏ
  `ZodValidationPipe`.
- **Đề xuất:** (B).
- Lý do: một lược đồ cho cả kiểu TS và kiểm lúc chạy; không phụ thuộc metadata decorator; dễ test bằng hàm thuần. Gói tiến độ
  vẫn kiểm bằng `migrateProgress` của `mvp-tien-do-hoc` (không viết lại lược đồ thứ hai). Chặn: việc 2.3.

**CC-4. Danh sách thư viện mới cho máy chủ** (phải được đồng ý trước khi cài, `AGENTS.md` mục 6).
- **Đề xuất** (theo lựa chọn đề xuất của CC-1, CC-3, CC-6, CC-28):
  - Lõi: `@nestjs/core`, `@nestjs/common`, `@nestjs/platform-express` (Express, không Fastify: nhiều tài liệu hơn, webhook của
    `mvp-mua-ban` đọc thân thô đơn giản), `reflect-metadata`, `rxjs` (phụ thuộc bắt buộc của Nest).
  - CSDL: `drizzle-orm`, `pg`, `drizzle-kit` (dev).
  - Kiểm dữ liệu: `zod`.
  - Bảo mật: `@nestjs/throttler` (giới hạn tần suất), `helmet`, `cookie-parser`.
  - Đăng nhập Google: `google-auth-library` (kiểm ID token, lấy khoá công khai của Google có lưu đệm).
  - Log: `nestjs-pino` + `pino` (JSON, có `redact` che trường nhạy cảm) — thay cho logger mặc định.
  - Việc định kỳ: `@nestjs/schedule` (dọn OTP / phiên hết hạn; `mvp-mua-ban` dùng lại cho cron đơn hàng).
  - Test (dev): `vitest`, `@vitest/coverage-v8` (đã có ở repo), `unplugin-swc` + `@swc/core`, `supertest`, `@types/supertest`.
  - **Không** dùng SDK Resend (gọi `fetch`, CC-9); không dùng Passport (một guard tự viết đủ cho hai cách đăng nhập).
- Lý do: mỗi gói một việc, không trùng chức năng; đều phổ biến, có kiểu TypeScript. Chặn: việc 2.

**CC-5. Bản build máy chủ dùng `@study/content` (TS nguồn, không build) thế nào?**
- Lựa chọn: (A) **thêm bước build cho `@study/content`** (`tsc` phát `dist/`), `exports` có điều kiện: Vite / Vitest / tsx
  dùng `src/` (điều kiện `development` hoặc `source`), Node dùng `dist/`; (B) chạy máy chủ bằng chế độ bỏ kiểu của Node 22
  (`--experimental-strip-types`) — không chạy với file nằm trong `node_modules` (sau `pnpm deploy`), không hỗ trợ cú pháp chỉ có ở
  TS; (C) đóng gói máy chủ bằng webpack (`nest build --webpack`) kéo luôn mã `@study/content` vào.
- **Đề xuất:** (A).
- Lý do: Nest cần `emitDecoratorMetadata` nên không bundle bằng esbuild được; (A) chỉ thêm một script và một mục `exports`,
  game giữ nguyên cách import nguồn; `docs/ai/00-overview.md` mục 1 cần sửa dòng "Không build". Chặn: việc 2.1, 11.1.

**Đăng nhập và phiên**

**CC-6. Cơ chế phiên đăng nhập.**
- Lựa chọn: (A) **mã phiên ngẫu nhiên (opaque), lưu băm trong bảng `sessions`**; web nhận bằng **cookie `HttpOnly; Secure;
  SameSite=Strict`**, app Android nhận bằng **`Authorization: Bearer`**; (B) JWT truy cập ngắn hạn + refresh token xoay vòng;
  (C) chỉ cookie cho cả web và app (cần bật cookie bên thứ ba trong WebView / `CapacitorCookies`).
- **Đề xuất:** (A). Mã phiên trên app lưu ở đâu: CC-29.
- Lý do: một máy chủ, vài chục yêu cầu/giây → tra bảng mỗi lần là rẻ; thu hồi được ngay (đăng xuất, xoá tài khoản, quản trị
  12 giờ) mà JWT không làm được nếu không có danh sách đen; trên web JavaScript không đọc được cookie (giảm hậu quả XSS);
  app ở `https://localhost` gọi tên miền khác nên cookie là bên thứ ba, WebView chặn mặc định (bảng tra cứu) → dùng header.
  Chặn: việc 4.1, 8.

**CC-7. Thời hạn phiên.**
- **Đề xuất:** người chơi (web, app): hết hạn sau **90 ngày không dùng** (mỗi lần gọi API thì gia hạn, ghi lại tối đa mỗi giờ
  một lần), hết hạn tuyệt đối **365 ngày**; tối đa **10 phiên** mỗi tài khoản (vượt thì thu hồi phiên cũ nhất). Quản trị: **12 giờ**
  tuyệt đối (đã chốt ở `mvp-mua-ban` CC-19), không gia hạn.
- Lý do: người chơi nhỏ tuổi không nên phải đăng nhập lại thường xuyên (đăng nhập cần phụ huynh, CC-12); hết hạn khi offline
  không ảnh hưởng chơi, chỉ đồng bộ báo "Đăng nhập lại để đồng bộ". Chặn: việc 4.1.

**CC-8. Tham số mã OTP email và giới hạn tần suất.**
- **Đề xuất:**
  - Mã **6 chữ số** (`crypto.randomInt`), hết hạn **10 phút**, **5 lần nhập sai** thì mã bị huỷ; mã mới làm mã cũ hết hiệu lực.
  - Gửi lại sau tối thiểu **60 giây**; tối đa **5 mã/email/giờ**, **10 mã/email/ngày**, **20 yêu cầu gửi mã/IP/giờ**;
    **trần toàn hệ thống 90 email/ngày** (Resend Free 100/ngày) — vượt trần thì báo "Hôm nay đã hết lượt gửi mã, hãy đăng nhập
    bằng Google hoặc thử lại ngày mai".
  - Lưu **HMAC-SHA256(khoá `OTP_PEPPER`, mã thử thách + mã)**, không lưu mã gốc; email trong bảng OTP cũng chỉ lưu HMAC.
  - Đếm giới hạn theo email / trần ngày bằng bảng `email_otps` (bền qua khởi động lại); giới hạn theo IP và các endpoint khác bằng
    `@nestjs/throttler` lưu trong bộ nhớ (một tiến trình máy chủ duy nhất).
  - Phản hồi "đã gửi mã" giống hệt nhau dù email đã có tài khoản hay chưa (không dò được email).
- Lý do: 6 số + 5 lần thử → xác suất đoán trúng 5/10⁶ mỗi mã; HMAC đủ vì mã sống ngắn và bị giới hạn lần thử (bcrypt không thêm
  gì đáng kể); trần ngày giữ trong gói miễn phí. Chặn: việc 4.3.

**CC-9. Gửi email.**
- Lựa chọn: (A) **gọi HTTP API của Resend bằng `fetch`**; ở dev / test gửi vào **Mailpit** (container hộp thư thử, xem thư ở
  `http://localhost:8025`, có HTTP API để Playwright đọc mã); (B) SMTP qua `nodemailer` (Resend có SMTP relay, Mailpit nhận SMTP).
- **Đề xuất:** (A), giao diện `MailDriver` với ba bản: `resend`, `mailpit` (gửi qua API gửi thư của Mailpit), `memory` (unit test).
  Địa chỉ gửi `Tomo <no-reply@<tên miền>>` (tên miền theo CC-21). Thư tiếng Việt, ngắn: mã, hạn 10 phút, "Nếu không phải bạn,
  hãy bỏ qua thư này". Không có ảnh theo dõi, không có liên kết đăng nhập.
- Lý do: không thêm thư viện; dev / CI không cần khoá Resend và **không bao giờ in OTP ra log** (Mailpit thay cho việc "in mã ra
  console"). Chặn: việc 1.2, 4.3.

**CC-10. Gắn Google và email vào cùng tài khoản; dữ liệu lưu về người dùng.**
- Lựa chọn khi đăng nhập Google mà email đó đã có tài khoản email-OTP (hoặc ngược lại): (A) **tự gắn vào tài khoản đó** khi
  Google báo `email_verified = true`; (B) tạo tài khoản riêng; (C) hỏi người dùng.
- **Đề xuất:** (A). Mỗi email một tài khoản. Chỉ lưu: email (đã chuẩn hoá chữ thường), `sub` của Google, thời điểm tạo / đăng nhập
  gần nhất, thời điểm đồng ý (CC-12). **Không lưu** tên, ảnh đại diện Google, ngôn ngữ, số điện thoại. Đổi email: sau MVP.
- Lý do: cả hai cách đều chứng minh người dùng nắm email đó; khớp "nhiều cách đăng nhập một tài khoản" (quyết định 2) mà không
  cần màn gắn tài khoản; ít dữ liệu cá nhân nhất (Nghị định 13/2023, Families). Chặn: việc 4.2, 4.3.

**CC-11. Plugin đăng nhập Google gốc cho app Android** (thư viện mới).
- Lựa chọn: (A) **`@capgo/capacitor-social-login`** (Credential Manager, dòng v8 cho Capacitor 8); (B) Capawesome Google Sign-In
  (Credential Manager); (C) `@codetrix-studio/capacitor-google-auth` (bản gốc mà (A) fork từ đó — cần kiểm còn bảo trì không).
- **Đề xuất:** (A), chỉ dùng trên app (`Capacitor.isNativePlatform()`); web dùng thẳng script GIS (không thêm gói npm). Bọc trong
  `apps/game/src/account/googleNative.ts` để test thay bằng bản giả. Trước khi phát hành: kiểm tài khoản Google có giám sát
  (Family Link) đăng nhập được hay bị chặn, ghi kết quả vào `docs/mobile-app.md`.
- Lý do: dùng Credential Manager (API Google khuyên dùng), bảo trì cho đúng bản Capacitor, trả ID token cùng `aud` với web nên
  máy chủ kiểm một kiểu. Chặn: việc 8.4 (và cần dự án Capacitor của `mvp-android`).

**CC-12. Q-5 — Đồng ý của phụ huynh và dữ liệu trẻ em khi đăng nhập / đồng bộ** (Q-5 còn mở ở kịch bản 12.2; spec tiến độ §5.4
yêu cầu xử lý trước khi bật đồng bộ).
- Tra cứu: Nghị định 13/2023 Điều 20 (xác minh tuổi; trẻ từ đủ 7 tuổi cần đồng ý của trẻ và cha mẹ); **Luật 91/2025/QH15 có
  hiệu lực 01/01/2026** (Điều 24) + Nghị định 356/2025 — chưa rõ thay thế Nghị định 13/2023 tới đâu; Families policy đòi "hành
  động của người lớn" trước khi trao đổi thông tin cá nhân.
- Lựa chọn: (A) **tài khoản là của người lớn**: màn đăng nhập đi qua cổng phụ huynh (`ParentGate`) khi hồ sơ đang chơi là
  Mầm/Chồi; bắt buộc tích "Tôi là phụ huynh hoặc từ 18 tuổi và đồng ý Chính sách quyền riêng tư"; lưu `consent_at` +
  `consent_version`; gói đồng bộ của hồ sơ trẻ không có định danh trực tiếp (không biệt danh, không ngày sinh — đã có ở
  `mvp-tien-do-hoc` §5.4); (B) như (A) và thêm xác minh phụ huynh mạnh hơn (ví dụ xác nhận qua email của phụ huynh khi hồ sơ Mầm/Chồi
  được đồng bộ lần đầu); (C) không cho đăng nhập / đồng bộ hồ sơ Mầm/Chồi trong MVP.
- **Đề xuất:** (A), và **trước khi mở cho người dùng thật** nhờ người có chuyên môn pháp lý xác nhận văn bản đang áp dụng
  (Luật 91/2025 / Nghị định 356/2025 hay Nghị định 13/2023) và nội dung Chính sách quyền riêng tư (`mvp-android` CC-19).
  Khi Q-5 được trả lời, ghi vào kịch bản 12.1.
- Lý do: email đăng nhập là của người lớn, không phải của trẻ; trẻ không tự nhập dữ liệu cá nhân nào; cổng phụ huynh đã có
  (`mvp-tien-do-hoc` CC-18/19, `mvp-mua-ban` CC-16) nên không thêm việc. Chặn: việc 4.4, 8.3 và **bật đồng bộ ở bản phát hành**.

**Đồng bộ**

**CC-13. Hồ sơ đã xoá trên máy chủ: máy khác biết bằng cách nào?** `mvp-tien-do-hoc` §5.3 giao việc này cho spec này, nhưng
`SyncResponseV1` chỉ có `docs`.
- Lựa chọn: (A) **thêm trường tuỳ chọn** `deletedProfileIds?: string[]` vào `SyncResponseV1` (thêm trường, không đổi `schema: 1`;
  máy cũ bỏ qua trường lạ), sửa `mvp-tien-do-hoc/design.md` §5.1 trong cùng PR; (B) endpoint riêng `GET /api/sync/deleted`;
  (C) không báo — máy khác vẫn giữ hồ sơ trên máy, máy chủ chỉ không nhận lại.
- **Đề xuất:** (A). Máy nhận `deletedProfileIds` thì **hỏi** "Hồ sơ này đã bị xoá ở máy khác. Xoá trên máy này?" (qua cổng phụ
  huynh) chứ không tự xoá; chọn giữ thì hồ sơ thành hồ sơ chỉ trên máy với `profileId` mới.
- Lý do: một lời gọi; không mất tiến độ của trẻ vì một thao tác ở máy khác. Chặn: việc 5.2.

**CC-14. Giới hạn đồng bộ và lúc nào máy tự đồng bộ.**
- **Đề xuất:** mỗi gói ≤ **512 KB** (đề xuất của `mvp-tien-do-hoc` §5.1), mỗi lần ≤ **20 gói**, thân yêu cầu ≤ **2 MB**,
  tối đa **20 hồ sơ** mỗi tài khoản (kể cả đã xoá thì không tính), **30 lần đồng bộ / 10 phút / tài khoản**. Máy tự đồng bộ: ngay
  sau đăng nhập; khi mở app (có mạng, đã đăng nhập); khi có mạng lại (`online`); **30 giây sau khi xong một màn** (gom nhiều màn
  thành một lần); khi app chuyển nền (`visibilitychange` → `fetch(..., { keepalive: true })`); nút "Đồng bộ ngay".
- Lý do: một hồ sơ một năm khoảng 12 KB, đủ nội dung 150–250 KB (`mvp-tien-do-hoc` §3.3) → 512 KB dư; nhịp trên đủ để đổi máy
  thấy ngay mà không gọi mỗi câu trả lời. Chặn: việc 5.1, 8.5.

**CC-15. Đăng xuất: dữ liệu trên máy giữ hay xoá?**
- **Đề xuất:** **giữ** các hồ sơ trên máy (thành dữ liệu khách, ngừng đồng bộ); thêm nút "Xoá dữ liệu của tài khoản trên máy này"
  (qua cổng phụ huynh) cho máy dùng chung. Bỏ mã phiên, bỏ quyền nguồn tài khoản (`mvp-mua-ban` Yêu cầu 8.5).
- Lý do: trẻ không mất tiến độ khi bố mẹ lỡ đăng xuất; máy dùng chung vẫn có cách dọn. Chặn: việc 8.3.

**Xoá và lưu dữ liệu**

**CC-16. Xoá tài khoản.**
- **Đề xuất:**
  - Trong app / web: Tài khoản → "Xoá tài khoản" → cổng phụ huynh → giải thích sẽ mất gì → gõ chữ `XOÁ` → xoá. Phiên phải được tạo
    **trong 15 phút gần nhất**; nếu không, đăng nhập lại (Google hoặc OTP) rồi xoá.
  - **Xoá ngay** (không có thời gian chờ): `users`, `auth_identities`, `sessions`, `progress_docs`, `email_otps` của email đó.
    Dữ liệu mua (`orders`, `store_purchases`, `entitlement_grants` của `mvp-mua-ban`) **giữ lại cho kế toán nhưng bỏ liên kết**
    (`user_id = null`), không còn email; ghi một dòng `audit_logs` `account.delete` không chứa email.
  - Trang web **`/xoa-tai-khoan.html`** (Google Play bắt buộc): các bước xoá trong app / web, địa chỉ email hỗ trợ cho người không
    đăng nhập được, dữ liệu nào giữ lại và vì sao, bản sao lưu tự hết sau 14 ngày (CC-23).
  - Trên máy: sau khi xoá, như đăng xuất (CC-15) và hỏi có xoá luôn dữ liệu trên máy không.
- Lý do: đúng yêu cầu Google Play (đường trong app + trang web, nói rõ dữ liệu giữ lại); không có thời gian chờ thì không cần job
  xoá trễ và trạng thái "chờ xoá". Chặn: việc 6.2, 8.3, 11 (trang tĩnh).

**CC-17. Lưu dữ liệu bao lâu.**
- **Đề xuất:** dòng `email_otps` xoá sau **24 giờ**; phiên hết hạn / bị thu hồi xoá sau **30 ngày**; dòng "hồ sơ đã xoá" (CC-13)
  giữ **180 ngày** rồi xoá hẳn; `audit_logs` giữ **2 năm**; tài khoản không hoạt động **không tự xoá** trong MVP (xem lại khi có
  Chính sách quyền riêng tư chính thức). Dọn bằng việc định kỳ mỗi ngày.
- Lý do: tối thiểu dữ liệu (Nghị định 13/2023 / Luật 91/2025); 180 ngày đủ để máy lâu không mở vẫn nhận được tin hồ sơ đã xoá.
  Chặn: việc 3.1, 6.3.

**CC-18. Bảng `audit_logs` dùng chung.**
- **Đề xuất:** spec này tạo `audit_logs` **đúng lược đồ ở `mvp-mua-ban/design.md` §2** (`actor`, `action`, `target_type`,
  `target_id`, `before`, `after`, `reason`, `created_at`; chỉ `INSERT` với người dùng CSDL của ứng dụng). Spec này ghi:
  `admin.role.grant` / `admin.role.revoke` (CLI), `account.delete`, `sync.profile.delete`. Không ghi mỗi lần đăng nhập.
- Lý do: `mvp-mua-ban` đã ghi "nếu `mvp-tai-khoan` đã có bảng audit thì dùng chung"; tạo một lần, một chỗ. Chặn: việc 3.1, 7.

**Docker, máy ảo, vận hành**

**CC-19. Reverse proxy có TLS.**
- Lựa chọn: (A) **Caddy 2** (tự HTTPS); (B) nginx + certbot; (C) Traefik.
- **Đề xuất:** (A), image `caddy:2-alpine`, cấu hình `docker/caddy/Caddyfile`.
- Lý do: tự xin / gia hạn chứng chỉ, cấu hình vài dòng; `docs/deploy.md` mục 5 và medicine-management đã dùng. Chặn: việc 10.

**CC-20. PWA, API và trang quản trị đặt ở đâu?**
- Lựa chọn: (A) **cùng máy ảo, cùng tên miền**: game ở `/`, API ở `/api/*`, quản trị ở `/admin/`, `ads-config.json` ở `/`;
  (B) game trên Cloudflare Pages, API trên máy ảo (tên miền con `api.`); (C) như (A) nhưng quản trị ở tên miền con `admin.`.
- **Đề xuất:** (A).
- Lý do: cookie phiên là cookie cùng trang (không cần CORS cho web, `SameSite=Strict` dùng được); một lần triển khai; game đã
  được service worker lưu sẵn nên không cần CDN. Phải thêm `navigateFallbackDenylist` cho `/api/` và `/admin/` (Hiện trạng).
  Chặn: việc 8.6, 10.

**CC-21. Tên miền.**
- Lựa chọn: (A) **mua tên miền riêng** (`.vn` hoặc `.com`) trước khi mở cho người dùng thật; (B) tên miền miễn phí (DuckDNS) suốt MVP.
- **Đề xuất:** (A) cho bản thật; DuckDNS chỉ để chạy thử máy ảo. Chủ sản phẩm chọn tên.
- Lý do: tiến độ khách của PWA gắn với tên miền — đổi tên miền là người chơi mất tiến độ chưa đăng nhập (`docs/deploy.md` 3.3);
  Resend cần xác minh tên miền gửi bằng bản ghi DNS (SPF/DKIM) mà DuckDNS không cho tạo; Google OAuth cần tên miền trong
  "Authorized domains". Chặn: việc 4.3 (gửi thư thật), 10, 12.

**CC-22. Nhà cung cấp, vùng và cỡ máy ảo.**
- Lựa chọn (giá ước tính, kiểm lại trước khi mua): Oracle Cloud Always Free (ARM, khó xin máy —
  [trang](https://www.oracle.com/cloud/free/)); DigitalOcean / Vultr / Linode khoảng 12 USD/tháng cho 2 GB RAM
  ([DigitalOcean](https://www.digitalocean.com/pricing/droplets), [Vultr](https://www.vultr.com/pricing/)); nhà cung cấp trong nước
  (Viettel IDC, BizFly Cloud…).
- **Đề xuất:** 2 vCPU, **2 GB RAM** (thêm 2 GB swap), 40 GB ổ, **Ubuntu 24.04 LTS**, vùng **Singapore**; image build được cả x86_64
  và ARM để còn chuyển sang Oracle nếu xin được. Chủ sản phẩm chọn nhà cung cấp.
- Lý do: PostgreSQL + Node + Caddy dùng dưới 1 GB lúc rảnh; build image trên máy 2 GB cần swap; Singapore gần Việt Nam. Chặn: việc 10.4, 12.

**CC-23. Sao lưu ra ngoài máy ảo.**
- Lựa chọn nơi chép: (A) **Cloudflare R2** (miễn phí 10 GB, [giá](https://developers.cloudflare.com/r2/pricing/)); (B) Backblaze B2;
  (C) Google Drive qua `rclone`; (D) chỉ giữ trên máy ảo.
- **Đề xuất:** container `backup` chạy `pg_dump -Fc` mỗi **24 giờ**, giữ **14 bản** trong volume (như medicine-management), mã hoá
  bằng `age` rồi `rclone copy` lên (A), giữ 30 ngày ở R2; ghi `status.json`; `GET /api/health` báo lỗi khi bản sao lưu cũ hơn 36 giờ;
  **thử khôi phục mỗi tháng** vào một DB tạm (ghi bước ở `docs/deploy.md`).
- Lý do: bản sao lưu nằm cùng máy với DB không cứu được khi mất máy (`docs/deploy.md` mục 7); mã hoá vì có email người dùng.
  Chặn: việc 10.3.

**CC-24. CI chạy test máy chủ thế nào?**
- Lựa chọn: (A) **service container PostgreSQL** trong job GitHub Actions; (B) `docker compose up` trong CI rồi `docker compose exec`;
  (C) Testcontainers trong test.
- **Đề xuất:** (A) cho job `check` (unit + API e2e của máy chủ chạy trong `pnpm -r test:coverage`, cùng thẻ image ở CC-2); thêm job
  **`account-e2e`** dùng (B) với `docker-compose.yml` (db + mailpit + server) để Playwright chạy luồng đăng nhập; thêm job
  **`docker`** build hai image prod và chạy `docker compose -f docker-compose.prod.yml config`. Trên máy dev: test chạy trong
  container (`docker compose exec -T server pnpm --filter @study/server test`).
- Lý do: (A) nhanh và không đổi cách chạy `pnpm -r test:coverage`; (B) cho E2E dùng đúng topology dev; (C) cần Docker bên trong
  test, chậm hơn. Chặn: việc 9.

**CC-25. Cách triển khai bản mới.**
- Lựa chọn: (A) **tay qua SSH**: `git pull` + build image trên máy ảo + `up -d` + migrate (script `scripts/deploy-prod.sh`);
  (B) GitHub Actions build image, đẩy lên GHCR, SSH vào máy ảo kéo image; (C) như (B) nhưng tự chạy khi `main` xanh.
- **Đề xuất:** (A) cho MVP; (B)/(C) sau MVP.
- Lý do: ít bí mật phải cất trên GitHub; ít khi phát bản; `docs/deploy.md` mục 6 đã viết theo (A). Chặn: việc 10.5.

**CC-26. `docker-compose.yml` (dev) commit thẳng hay dùng `.example`?** medicine-management gitignore file này và commit
`docker-compose.yml.example`.
- **Đề xuất:** commit thẳng `docker-compose.yml` (không có bí mật, giá trị lấy từ `.env` không commit; `.env.example` commit).
- Lý do: `docker compose up -d` chạy được ngay sau khi clone; dự án một người, ít cần chỉnh cục bộ. Chặn: việc 1.

**CC-27. Giám sát và log.**
- **Đề xuất:** UptimeRobot gói miễn phí gọi `GET /api/health` mỗi 5 phút, báo email; log Docker `json-file` `max-size: 10m`,
  `max-file: 3` mọi dịch vụ; log máy chủ là JSON (pino) có `redact` (design §12); không dùng dịch vụ thu log bên ngoài trong MVP.
- Lý do: miễn phí, đủ biết máy chủ chết; giới hạn log để không đầy ổ (bài học binlog của medicine-management). Chặn: việc 10.

**CC-28. Bộ chạy test máy chủ.**
- Lựa chọn: (A) **Vitest** + `unplugin-swc` (cùng bộ với game, cùng định dạng `clover.xml` cho `coverage-changed`); (B) Jest
  (mặc định của Nest CLI).
- **Đề xuất:** (A).
- Lý do: một bộ test cho cả repo; `scripts/coverage-changed.mjs` đọc `clover.xml` của Vitest sẵn. Chặn: việc 2.2.

**CC-29. Mã phiên trên app Android lưu ở đâu?** (web không lưu: cookie `HttpOnly`, CC-6)
- Tra cứu: dữ liệu offline đã chốt là SQLite (`@capacitor-community/sqlite`, quyết định 11). File DB nằm trong vùng riêng của app
  nhưng **không mã hoá** mặc định, và `android:allowBackup=true` (`mvp-android/design.md` §3) đưa nó vào sao lưu Google → mã phiên
  có thể được khôi phục sang máy khác. Plugin này có chế độ mã hoá (SQLCipher, cần khoá lưu ở Android Keystore —
  [tài liệu plugin](https://github.com/capacitor-community/sqlite)); lựa chọn khác là plugin lưu khoá bảo mật dựa trên Keystore
  (thư viện mới, ví dụ [`capacitor-secure-storage-plugin`](https://github.com/martinkasa/capacitor-secure-storage-plugin)).
- Lựa chọn: (A) **bảng `account_session` trong cùng SQLite**, loại file DB khỏi sao lưu Google bằng `dataExtractionRules` /
  `fullBackupContent` (sao lưu tiến độ khách mất theo — tiến độ đã có đồng bộ tài khoản thay thế); (B) như (A) nhưng mở mã hoá
  SQLCipher của plugin; (C) plugin lưu bảo mật trên Keystore riêng cho mã phiên (thư viện mới), SQLite chỉ giữ trạng thái không bí mật.
- **Đề xuất:** (C) nếu chủ sản phẩm đồng ý thêm một thư viện nhỏ; không thì (A). Bất kể lựa chọn nào: mã phiên không bao giờ nằm
  trong gói đồng bộ hay log, đăng xuất / 401 thì xoá ngay.
- Lý do: mã phiên là bí mật duy nhất trên máy; Keystore không bị sao lưu sang máy khác và không đọc được khi chép file DB; (A) đủ an
  toàn ở mức app sandbox nhưng phải bỏ sao lưu file DB. Chặn: việc 8.2 (phần app), và cần ý kiến `mvp-android` về quy tắc sao lưu.

## Thuật ngữ

- **Tài khoản**: một dòng `users`, khoá `id` (UUID). Mỗi email một tài khoản (CC-10).
- **Cách đăng nhập (identity)**: Google (`sub`) hoặc email; một tài khoản có thể có cả hai.
- **Mã OTP / thử thách**: mã 6 số gửi qua email; mỗi lần gửi tạo một thử thách có `challengeId`.
- **Phiên**: một lần đăng nhập trên một máy, khoá là mã phiên ngẫu nhiên; máy chủ lưu bản băm.
- **Khách**: người chơi chưa đăng nhập; tiến độ chỉ trên máy.
- **Đồng bộ**: gửi `SyncRequestV1`, nhận `SyncResponseV1` (hợp đồng của `mvp-tien-do-hoc`).
- **Gộp khách**: lần đồng bộ đầu sau khi đăng nhập, gửi mọi hồ sơ trên máy (không có bước riêng — `mvp-tien-do-hoc` §5.1).
- **Bản ghi hồ sơ đã xoá (tombstone)**: dòng `progress_docs` có `deleted_at`, không còn gói, để máy khác không gửi lên lại.
- **Quản trị viên**: tài khoản có `role = 'admin'` **và** email nằm trong `ADMIN_EMAILS`.
- **Origin của web / app**: `https://<tên miền>` (web) và `https://localhost` (app Capacitor).

## Yêu cầu

### Yêu cầu 1 — Khung máy chủ `apps/server`

**User story:** Là người phát triển, tôi muốn một máy chủ NestJS nằm trong workspace, chạy và test được bằng Docker.

1. Gói `@study/server` ở `apps/server`, có script `dev`, `build`, `start`, `typecheck`, `test`, `test:coverage`, `test:unit`,
   `test:e2e`, `db:migrate`, `db:generate`; `pnpm -r build|test|typecheck` ở gốc chạy cả gói này.
2. Mọi route có tiền tố **`/api`** (khớp `docs/deploy.md`); endpoint của `mvp-mua-ban` (`/billing/*`, `/me/entitlements`,
   `/admin/*`) vì vậy nằm dưới `/api`.
3. `GET /api/health` trả 200 `{ ok: true, db: 'up', backup: { lastSuccessAt } }` khi DB trả lời; 503 khi DB không trả lời. Không
   cần đăng nhập, không lộ phiên bản thư viện.
4. Cấu hình đọc từ biến môi trường, kiểm lúc khởi động (CC-3); thiếu biến **bắt buộc** thì dừng với thông báo nêu tên biến (không
   in giá trị). Thiếu biến của một phần không bắt buộc (vd chưa có `RESEND_API_KEY`) thì phần đó tắt và báo rõ khi được gọi
   (vd đăng nhập email trả 503 `email_login_unavailable`), máy chủ vẫn chạy.
5. Các cờ chỉ dành cho test (`AUTH_GOOGLE_FAKE`, `MAIL_DRIVER=memory|mailpit`) **bị từ chối khi `NODE_ENV=production`**: máy chủ
   không khởi động.
6. Lỗi trả dạng `{ code, message }`, `message` tiếng Việt ngắn; không trả stack trace.
7. Có lệnh CLI chạy trong container: `migrate`, `admin:grant <email>`, `admin:revoke <email>`, `admin:list` (Yêu cầu 11).

### Yêu cầu 2 — Môi trường phát triển bằng Docker

**User story:** Là người phát triển, tôi muốn `docker compose up -d` là có đủ server, PostgreSQL, game và hộp thư thử.

1. `docker-compose.yml` có các dịch vụ `db`, `mailpit`, `server`, `game`; mã nguồn bind mount, `node_modules` nằm trong volume
   của container (không dùng `node_modules` của Windows).
2. `server` tự nạp lại khi sửa mã; `game` là Vite dev server, chuyển `/api` tới `server` (cùng origin như prod, cookie chạy được).
3. `db` có healthcheck; `server` chờ `db` khoẻ; script khởi tạo tạo thêm DB `tomo_test` và người dùng CSDL của ứng dụng.
4. Cổng chỉ mở trên `127.0.0.1` của máy dev: 3000 (server), 5173 (game), 5432 (db), 8025 (giao diện Mailpit).
5. Test máy chủ chạy được trong container: `docker compose exec -T server pnpm --filter @study/server test` (dùng `tomo_test`,
   không đụng dữ liệu dev).
6. Phần game hiện có vẫn chạy được không cần Docker (`pnpm dev`, `pnpm test`, `pnpm e2e` như `AGENTS.md` mục 4).
7. `.env.example` liệt kê đủ tên biến (design §3), không có giá trị bí mật; `.gitignore` chặn `.env`, `.env.*` trừ `*.example`.

### Yêu cầu 3 — Cơ sở dữ liệu và migration

1. Bảng `users`, `auth_identities`, `email_otps`, `sessions`, `progress_docs`, `audit_logs` theo design §4; `id` là UUID; thời gian
   `timestamptz`; comment bảng / cột tiếng Việt.
2. `users.role` (`'user'` | `'admin'`, mặc định `'user'`) có trong migration đầu (`mvp-mua-ban` CC-19).
3. Migration chạy bằng người dùng CSDL **chủ sở hữu**; ứng dụng chạy bằng người dùng **chỉ có quyền DML**, không `UPDATE/DELETE`
   trên `audit_logs`.
4. Migration chỉ tiến (forward-only) và có test: áp toàn bộ lên DB trống thành công; áp hai lần không lỗi.
5. Không có dữ liệu mẫu chứa email thật.

### Yêu cầu 4 — Đăng nhập Google

**User story:** Là phụ huynh, tôi muốn bấm một nút Google để đăng nhập, trên web và trên app.

1. Web: nút Google do GIS vẽ (script tải khi mở màn Tài khoản, chỉ khi có mạng); app: plugin gốc (CC-11). Cả hai gửi ID token
   lên `POST /api/auth/google { idToken, client, consent }`.
2. Máy chủ kiểm chữ ký, `iss`, `aud ∈ { GOOGLE_WEB_CLIENT_ID }`, `exp`, `email_verified = true`; sai → 401 `invalid_google_token`.
3. Tìm theo `(google, sub)`; chưa có thì gắn theo email (CC-10) hoặc tạo tài khoản mới; cập nhật `last_login_at`.
4. Tài khoản mới (hoặc chưa có `consent_at`) mà thiếu `consent` đúng phiên bản → 409 `consent_required`, không tạo phiên (CC-12).
5. Thành công: tạo phiên (Yêu cầu 6), trả `{ user: { id, email, providers, createdAt }, isNewUser, token? }` — `token` chỉ có khi
   `client = 'android'`.
6. Không lưu tên, ảnh, ID token; không log email hay token.

### Yêu cầu 5 — Đăng nhập email + mã OTP

**User story:** Là phụ huynh không dùng Google, tôi muốn nhận mã qua email để đăng nhập.

1. `POST /api/auth/email/start { email }`: chuẩn hoá (cắt khoảng trắng, chữ thường, NFC), kiểm định dạng và độ dài ≤ 254; luôn
   trả 202 `{ challengeId, resendAfterSeconds, expiresInSeconds }` dù email có tài khoản hay chưa. Vượt giới hạn → 429
   `{ code: 'otp_rate_limited', retryAfterSeconds }`; vượt trần ngày → 429 `otp_daily_cap`. Gửi thư lỗi → 503 `email_send_failed`.
2. Tham số mã, hạn, số lần thử, giới hạn, cách băm theo CC-8.
3. `POST /api/auth/email/verify { email, challengeId, code, client, consent }`: so sánh hằng thời gian; sai → 400
   `otp_invalid { attemptsLeft }`; hết hạn / hết lượt / đã dùng → 400 `otp_expired`. Đúng → đánh dấu đã dùng, tìm hoặc tạo tài
   khoản, gắn cách đăng nhập email, kiểm `consent` như Yêu cầu 4.4, tạo phiên như Yêu cầu 4.5.
4. Thư theo CC-9; thư không chứa liên kết đăng nhập.
5. Ô nhập mã trên game: `inputmode="numeric"`, `autocomplete="one-time-code"`, dán được cả mã, đọc hướng dẫn thành tiếng.

### Yêu cầu 6 — Phiên đăng nhập, đăng xuất

1. Phiên theo CC-6, thời hạn theo CC-7. Mã phiên 32 byte ngẫu nhiên; bảng `sessions` chỉ lưu SHA-256 của mã.
2. Web: cookie `tomo_sid` (`HttpOnly; Secure; SameSite=Strict; Path=/api`). App: header `Authorization: Bearer <mã>`.
   Quản trị: cookie riêng `tomo_admin_sid` (Yêu cầu 11).
3. `GET /api/me` trả tài khoản hiện tại; không có / hết hạn / bị thu hồi phiên → 401 `unauthenticated`.
4. `POST /api/auth/logout` thu hồi phiên hiện tại, xoá cookie; gọi lại khi đã đăng xuất vẫn 204.
5. Guard `AuthGuard` + decorator `@CurrentUser()` để `mvp-mua-ban` dùng; endpoint "không bắt buộc đăng nhập" dùng
   `OptionalAuthGuard` (vd `POST /api/billing/google/verify`).
6. Yêu cầu đổi trạng thái (POST/PUT/PATCH/DELETE) dùng cookie phải có header `Origin` bằng `APP_ORIGIN`; sai → 403 (chống CSRF,
   cùng với `SameSite=Strict`). Yêu cầu dùng Bearer không cần kiểm này.
7. CORS chỉ cho `CORS_ORIGINS` (mặc định `https://localhost` của app), không `credentials`; web cùng origin không cần CORS.

### Yêu cầu 7 — Đồng bộ tiến độ (hợp đồng `mvp-tien-do-hoc` §5)

**User story:** Là phụ huynh đã đăng nhập, tôi muốn tiến độ của con trên điện thoại và máy tính là một.

1. `POST /api/sync/progress` (đăng nhập bắt buộc) nhận `SyncRequestV1`, trả `SyncResponseV1` (+ `deletedProfileIds` nếu CC-13 chọn A).
   Kiểu lấy từ `@study/content`, **không định nghĩa lại**.
2. Với mỗi gói nhận: kiểm kích thước (CC-14) → `migrateProgress` → `'invalid'`: bỏ gói đó, log `profileId` (không nội dung);
   `'newer'` (bản máy chủ cũ hơn app): bỏ gói đó, không ghi đè → nếu không thì trong một transaction: khoá dòng
   `(user_id, profile_id)` (`SELECT … FOR UPDATE`, tạo dòng nếu chưa có) → `mergeProgress(bản lưu, gói nhận)` → lưu.
3. Hồ sơ đã có bản ghi xoá (Yêu cầu 9): gói gửi lên bị bỏ qua, không làm sống lại.
4. Trả **mọi** hồ sơ chưa xoá của tài khoản, đã gộp, đã nâng lên `schema` mới nhất.
5. Gửi lại cùng yêu cầu nhiều lần cho cùng kết quả (dựa vào tính chạy-lại-không-đổi của `mergeProgress`); hai máy đồng bộ cùng lúc
   cùng hồ sơ không mất dữ liệu của máy nào (test song song).
6. Gói tiến độ chỉ có dữ liệu §5.4 của `mvp-tien-do-hoc`; máy chủ không thêm email hay thông tin máy vào gói.
7. Giới hạn kích thước, số gói, số hồ sơ, tần suất theo CC-14; vượt → 413 / 422 / 429 với `code` riêng.

### Yêu cầu 8 — Gộp tiến độ khách khi đăng nhập lần đầu

1. Ngay sau khi đăng nhập thành công, game gửi **mọi hồ sơ trên máy** trong một lần đồng bộ (không có bước riêng).
2. Hồ sơ cùng `profileId` gộp theo `mergeProgress`; hồ sơ khác `profileId` (từ máy khác) được thêm vào máy; không hỏi "giữ bản nào".
3. Đăng nhập vào tài khoản đã có tiến độ từ máy khác: cả hai bên được giữ, không mất sao, không mất ngày học.
4. Mất mạng giữa chừng: phiên đã có thì lần đồng bộ sau gửi lại; không mất dữ liệu trên máy.
5. Sau gộp, game phát sự kiện `signedIn { userId, isNewUser }` để `mvp-mua-ban` làm mới quyền và gửi `purchaseToken`.

### Yêu cầu 9 — Xoá hồ sơ đã đồng bộ

1. Xoá hồ sơ trên máy (`mvp-tien-do-hoc` CC-19) khi đã đăng nhập → game gọi `DELETE /api/sync/profiles/:profileId`; máy chủ xoá
   gói, giữ bản ghi xoá theo CC-17, ghi `audit_logs`.
2. Mất mạng lúc xoá: game nhớ yêu cầu xoá đang chờ và gửi ở lần đồng bộ sau.
3. Máy khác biết hồ sơ đã xoá theo CC-13.

### Yêu cầu 10 — Xoá tài khoản (Google Play)

**User story:** Là phụ huynh, tôi muốn xoá tài khoản và dữ liệu của con trên máy chủ bất cứ lúc nào.

1. Có đường xoá trong app và web (màn Tài khoản), theo CC-16; `DELETE /api/me { confirm: 'XOÁ' }`; phiên cũ hơn 15 phút → 403
   `reauth_required`.
2. Có trang `/xoa-tai-khoan.html` (tiếng Việt + tiếng Anh) dùng làm link khai trên Data safety; trang đọc được khi offline (precache).
3. Sau khi xoá: mọi phiên của tài khoản bị thu hồi; đăng nhập lại cùng email tạo tài khoản **mới** (không còn tiến độ cũ).
4. Dữ liệu giữ lại và lý do được ghi trên trang xoá và Chính sách quyền riêng tư.

### Yêu cầu 11 — Vai trò quản trị (cho `mvp-mua-ban`)

1. `node dist/cli.js admin:grant <email>` đặt `role = 'admin'` cho tài khoản có email đó (tài khoản phải đã đăng nhập ít nhất một lần);
   `admin:revoke`, `admin:list`. Không có endpoint nào tự cấp quyền. Mỗi lệnh ghi `audit_logs` (`actor = 'system:cli'`). Lệnh in
   email đã che (`a***@gmail.com`).
2. Đăng nhập quản trị: `POST /api/auth/google { client: 'admin' }` chỉ tạo phiên khi `role = 'admin'` **và** email thuộc
   `ADMIN_EMAILS`; không thì 403 `not_admin`, không tạo phiên. Phiên quản trị 12 giờ, cookie `tomo_admin_sid`.
3. `AdminGuard` kiểm lại cả hai điều kiện ở **mỗi** yêu cầu `/api/admin/*` (bỏ email khỏi `ADMIN_EMAILS` là mất quyền ngay).
4. Spec này không làm màn quản trị nào (thuộc `mvp-mua-ban`); chỉ cung cấp đăng nhập, guard, CLI.

### Yêu cầu 12 — Màn Tài khoản trong game và hành vi khi mất mạng

**User story:** Là người chơi, tôi muốn chơi như cũ khi không đăng nhập hay mất mạng; là phụ huynh, tôi muốn đăng nhập dễ.

1. Cài đặt có mục "Tài khoản": khách → nút "Đăng nhập để lưu tiến độ"; đã đăng nhập → email đã che, "Đã đồng bộ lúc …". Bấm →
   màn `account` (thêm vào `Screen` của `App.vue`).
2. Màn Tài khoản (khách): cổng phụ huynh khi hồ sơ đang chơi là Mầm/Chồi (CC-12) → nút Google, "Đăng nhập bằng email" → nhập mã →
   ô đồng ý → xong thì đồng bộ ngay và Tomo báo "Đã lưu tiến độ vào tài khoản".
3. Màn Tài khoản (đã đăng nhập): email đã che, cách đăng nhập đã gắn, trạng thái đồng bộ, "Đồng bộ ngay", "Đăng xuất" (CC-15),
   "Xoá tài khoản" (CC-16), liên kết Chính sách quyền riêng tư.
4. **Mất mạng:** nút đăng nhập bị khoá với lời "Cần có mạng để đăng nhập" (đọc thành tiếng); đã đăng nhập thì mọi thứ chơi được,
   đồng bộ chờ có mạng; không có thông báo lỗi lặp lại.
5. Máy chủ trả 401 khi đồng bộ → giữ dữ liệu trên máy, hiện "Đăng nhập lại để đồng bộ" một lần; trả `'newer'` → "Cập nhật game để
   đồng bộ" (`mvp-tien-do-hoc` Yêu cầu 9.5).
6. Lưu trên máy trong SQLite (`Db` của `mvp-tien-do-hoc`, quyết định 11): bảng `account_state` (id tài khoản, email đã che, thời
   điểm đồng bộ gần nhất, lỗi đồng bộ gần nhất) và `sync_outbox` (yêu cầu xoá hồ sơ đang chờ gửi). Web không có mã phiên trên máy
   (cookie `HttpOnly`); mã phiên trên app theo CC-29. Không dùng `localStorage`.
7. Nút "Đăng nhập để giữ tiến độ" của `mvp-tien-do-hoc` CC-6 và lời mời đăng nhập của `mvp-mua-ban` mở màn này qua một hàm
   `openAccount({ reason })`, xong thì quay lại màn gọi.
8. Lời hướng dẫn đọc bằng `speaker.say`; câu cố định thêm vào `packages/content/src/phrases.ts`; nhóm Mầm đọc cả tên nút; nút chạm
   ≥ 44px; có `data-testid`; chạy được khổ điện thoại và máy tính.

### Yêu cầu 13 — Docker cho bản chạy thật

1. `docker/server/Dockerfile` nhiều tầng: tầng `dev` (dùng cho compose dev), tầng `build`, tầng `runtime` chỉ có `dist` + phụ thuộc
   production, chạy bằng người dùng **không phải root**, có `HEALTHCHECK`, build được cho x86_64 và ARM.
2. `docker/web/Dockerfile`: build `apps/game` (và `apps/admin` khi có) rồi chép vào image Caddy (CC-19); bí mật không nằm trong image.
3. `docker-compose.prod.yml`: `caddy` (80, 443), `server` (chỉ mạng nội bộ), `db` (không mở cổng, volume có tên), `backup`; mạng
   `internal` của DB không ra Internet; `restart: unless-stopped`; giới hạn log (CC-27).
4. Caddy phục vụ PWA (`/`), `/api/*` → `server:3000`, `/admin/*` (CC-20), `/ads-config.json` từ thư mục mount (sửa không cần build lại,
   `Cache-Control: no-store`); `index.html`, `sw.js`, `manifest.webmanifest` không lưu đệm; `/assets/*` lưu đệm lâu; HSTS và các
   header bảo mật (design §11.3).
5. Sao lưu theo CC-23; `.env.prod.example` chỉ có tên biến.
6. Migration chạy bằng lệnh riêng trước khi bật bản mới (`docker compose run --rm server node dist/cli.js migrate`).

### Yêu cầu 14 — CI

1. Job `check` có PostgreSQL (CC-24) để `pnpm -r test:coverage` chạy cả test máy chủ; `scripts/coverage-changed.mjs` đo cả
   `apps/server/src/**/*.ts`.
2. Job `account-e2e`: dựng `db` + `mailpit` + `server` bằng compose, chạy Playwright luồng đăng nhập (máy tính + điện thoại).
3. Job `docker`: build `docker/server/Dockerfile` (tầng `runtime`) và `docker/web/Dockerfile`, kiểm `docker compose -f
   docker-compose.prod.yml config` với `.env.prod.example`, chạy image server với DB thử và chờ `/api/health` 200.
4. Không bí mật thật nào trong CI; khoá thử sinh ngẫu nhiên trong job.

### Yêu cầu phi chức năng — Bảo mật và dữ liệu

1. **Không log** email, OTP, mã phiên, ID token, header `Authorization`, cookie, thân yêu cầu đăng nhập / đồng bộ; log có `redact`
   và có test kiểm log không chứa email / mã mẫu.
2. Giới hạn tần suất: OTP theo CC-8; `POST /api/auth/google` 30 lần / 10 phút / IP; đồng bộ theo CC-14; mặc định 300 yêu cầu / phút / IP.
   Máy chủ đọc IP thật từ `X-Forwarded-For` của Caddy (`trust proxy` = 1 tầng).
3. Bí mật (`OTP_PEPPER`, `RESEND_API_KEY`, mật khẩu DB) chỉ trong `.env` / `.env.prod`; không vào image, repo, log.
4. Container chạy không phải root; PostgreSQL không mở cổng ra Internet; chỉ Caddy mở 80/443.
5. `helmet` cho API; giới hạn thân JSON (2 MB cho đồng bộ, 16 KB các endpoint khác).
6. Mỗi file code bị đổi đạt 100% dòng (`pnpm coverage:changed`); lint, typecheck, build, test không cảnh báo.
7. Game chạy offline như cũ: E2E offline hiện có (`apps/game/e2e/offline.spec.ts`) vẫn xanh; không precache đường `/api/`.
8. Thư viện mới chỉ cài sau khi CC-4, CC-11, CC-28, CC-29 được trả lời.
