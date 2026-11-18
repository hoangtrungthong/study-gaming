# Kế hoạch triển khai — Tài khoản, máy chủ và đồng bộ MVP (mvp-tai-khoan)

> **Cập nhật 2026-11-18:** chủ sản phẩm đồng ý toàn bộ đề xuất — mọi chỗ ghi `(CC-n)` / "Chặn bởi CC-n" nay là **đã chốt** theo đề xuất (xem `requirements.md`, mục "Điểm chốt thêm").

Nhánh **`feat/mvp-tai-khoan`** từ `main` mới nhất, **sau khi** `mvp-tien-do-hoc` đã merge (cần `ProgressDocV1`, `mergeProgress`,
`migrateProgress` ở `@study/content`, lớp `Db` SQLite, `ParentGate.vue`). Phần plugin Google gốc cần dự án Capacitor của `mvp-android`.

Thứ tự theo phụ thuộc: hỏi Chờ chốt → môi trường Docker dev → khung máy chủ → CSDL → đăng nhập → đồng bộ → xoá tài khoản → quản trị
→ game → E2E → CI → Docker prod → tài liệu → DoD.

**Hỏi hết "Chờ chốt" trước khi code phần bị chặn** (ghi "chặn bởi CC-n"). Thư viện mới chỉ cài sau khi CC-4, CC-11, CC-28, CC-29
được đồng ý (`AGENTS.md` mục 6). Mọi việc: file code bị đổi đạt 100% dòng (`pnpm -r test:coverage` rồi `pnpm coverage:changed`),
lint / format / typecheck / build / test không cảnh báo. Test máy chủ chạy trong container (`docker compose exec -T server …`).

- [ ] 0. Hỏi chủ sản phẩm CC-1 … CC-29 (`requirements.md`); ghi câu trả lời vào `requirements.md` (chuyển sang "Quyết định đã
      thống nhất") và `docs/kich-ban-game.md` mục 12.1 (gồm Q-29 đã chốt, Q-5 khi có trả lời); sửa `design.md` chỗ chọn khác đề xuất.
      Báo `mvp-tien-do-hoc` nếu CC-13 chọn (A) (thêm `deletedProfileIds?` vào `SyncResponseV1`, design §5.1 của spec đó).
- [ ] 1. Môi trường phát triển Docker — chặn bởi CC-2, CC-9, CC-26
  - [ ] 1.1 `.gitignore` thêm `.env`, `.env.*`, `!.env*.example`; `.dockerignore`; `.env.example` (design §3, chỉ tên + giá trị dev
        không bí mật); `apps/game/.env.example`
  - [ ] 1.2 `docker/server/Dockerfile` tầng `base` + `dev`; `docker/postgres/initdb.sh` (người dùng `tomo_app`, DB `tomo_test`);
        `docker-compose.yml` với `db`, `mailpit`, `server`, `game` (design §11.4), cổng chỉ `127.0.0.1`
  - [ ] 1.3 Kiểm: `docker compose up -d` → `db` khoẻ, Mailpit mở được `http://localhost:8025`; `game` chạy Vite qua compose;
        `pnpm dev` ngoài Docker vẫn chạy (ghi kết quả vào mô tả PR)
- [ ] 2. Khung `apps/server` — chặn bởi CC-3, CC-4, CC-5, CC-28
  - [ ] 2.1 `@study/content` có bước build + `exports` điều kiện `source` (design §2.2); `resolve.conditions` ở Vite / Vitest; test hiện
        có của game và content vẫn xanh; `pnpm -r build` build content trước server
  - [ ] 2.2 `apps/server`: `package.json` (scripts design §2.1), `tsconfig*.json` (design §2.3, kiểm TS 6 + decorator), `vitest.config.ts`
        (SWC, project unit + e2e, clover), ESLint cho `apps/server` (không tự đổi `import type`); `scripts/coverage-changed.mjs` đo
        `apps/server` (`CLOVERS`, `MEASURED`); test cho script nếu có
  - [ ] 2.3 `config/env.ts` (zod; thiếu biến bắt buộc → dừng, nêu tên; cờ test bị chặn ở production), `common/errors.ts`,
        `ZodValidationPipe`, `main.ts` (prefix `/api`, helmet, cookie-parser, trust proxy, giới hạn thân), pino + `redact`; unit test
        từng nhánh, test log không chứa email / mã mẫu
  - [ ] 2.4 `HealthModule` `GET /api/health` (DB lên / xuống, đọc `status.json` sao lưu); API e2e 200 / 503
- [ ] 3. CSDL — chặn bởi CC-1, CC-2, CC-17, CC-18
  - [ ] 3.1 `db/schema.ts` 6 bảng (design §4), migration `0000_init.sql` (citext, ràng buộc, chỉ mục, `COMMENT ON` tiếng Việt),
        `db/roles.sql` (`tomo_app` chỉ DML, `audit_logs` chỉ INSERT/SELECT, default privileges)
  - [ ] 3.2 `cli.ts migrate`; tiện ích test e2e (app factory, truncate); API e2e: migration lên DB trống, chạy lại không lỗi,
        `tomo_app` bị từ chối `UPDATE audit_logs`
  - [ ] 3.3 `AuditService.write()`; unit test
- [ ] 4. Đăng nhập và phiên — chặn bởi CC-6, CC-7, CC-8, CC-9, CC-10, CC-12
  - [ ] 4.1 `SessionService` (tạo, băm, trượt, tuyệt đối, tối đa 10, client web/android/admin), cookie `tomo_sid` / `tomo_admin_sid`,
        Bearer; `AuthGuard`, `OptionalAuthGuard`, `@CurrentUser()`, `OriginGuard`, CORS; `GET /api/me`, `POST /api/auth/logout`;
        unit test + API e2e (thuộc tính cookie, 401, CSRF thiếu Origin → 403, CORS `https://localhost`)
  - [ ] 4.2 `GoogleVerifier` (+ `FakeGoogleVerifier` chỉ test), `POST /api/auth/google`; unit test iss / aud / email_verified; API e2e
        tạo tài khoản, gắn vào tài khoản cùng email, android nhận `token`
  - [ ] 4.3 `MailDriver` (resend / mailpit / memory), `OtpService`, `POST /api/auth/email/start|verify`, throttler theo IP; unit test
        bảng đủ CC-8 với đồng hồ giả; API e2e luồng đầy đủ, phản hồi giống nhau email có / chưa có tài khoản, 429, 503 khi gửi lỗi
  - [ ] 4.4 Đồng ý (`consent`, `CONSENT_VERSION`, 409 `consent_required`), sự kiện `AuthEvents.signedIn$`; API e2e
  - [ ] 4.5 `MaintenanceModule`: dọn OTP 24 giờ, phiên hết hạn 30 ngày, tombstone 180 ngày, audit 2 năm (CC-17); unit test với đồng hồ giả
- [ ] 5. Đồng bộ tiến độ — chặn bởi CC-13, CC-14
  - [ ] 5.1 `SyncService.sync` + `POST /api/sync/progress` (design §6: kích thước, migrate, khoá dòng theo thứ tự, merge, số hồ sơ,
        tần suất); unit test với `mergeProgress` thật; API e2e gộp, gửi lại không đổi, **hai yêu cầu song song cùng hồ sơ**, hồ sơ từ
        máy khác được trả về, `invalid` / `newer` bị bỏ qua không ghi đè, 413 / 422 / 429
  - [ ] 5.2 `DELETE /api/sync/profiles/:profileId`, tombstone, `deletedProfileIds`, audit; API e2e không sống lại
- [ ] 6. Tài khoản — chặn bởi CC-16
  - [ ] 6.1 `AccountService` + hook `AccountDeletionHook[]` (để `mvp-mua-ban` đăng ký)
  - [ ] 6.2 `DELETE /api/me` (reauth 15 phút, cascade, thu hồi phiên, audit không email); API e2e đăng nhập lại tạo tài khoản mới
- [ ] 7. Vai trò quản trị (cho `mvp-mua-ban` CC-19)
  - [ ] 7.1 `cli.ts admin:grant|admin:revoke|admin:list` (email che, audit `system:cli`, revoke thu hồi phiên admin); unit test
  - [ ] 7.2 `client: 'admin'` ở đăng nhập Google (role + `ADMIN_EMAILS`), phiên 12 giờ không trượt, `AdminGuard` kiểm mỗi yêu cầu;
        API e2e: người thường → 403 `not_admin`; bỏ email khỏi `ADMIN_EMAILS` → 403 ngay; route thử `/api/admin/ping` chỉ trong test
- [ ] 8. Game (`apps/game`) — chặn bởi CC-11, CC-12, CC-13, CC-14, CC-15, CC-16, CC-20, CC-29
  - [ ] 8.1 `account/api.ts`; bảng SQLite `account_state`, `sync_outbox` (+ `account_session` nếu CC-29 chọn A/B) trong `migrate()`
        của `Db`; unit test (sql.js trong bộ nhớ, offline, 401, base URL web / app)
  - [ ] 8.2 `account/session.ts`, `tokenStore.ts` (CC-29), `onAuthChange`, `openAccount`; unit test khôi phục từ SQLite, đăng xuất giữ hồ sơ
  - [ ] 8.3 `AccountView.vue`, `OtpInput.vue`, fieldset "Tài khoản" trong `SettingsView.vue`, `'account'` trong `App.vue`; cổng phụ huynh
        Mầm/Chồi, ô đồng ý, đăng xuất, "Xoá dữ liệu trên máy này", xoá tài khoản; câu đọc ở `phrases.ts`; test giao diện + thứ tự đọc
  - [ ] 8.4 `googleWeb.ts` (GIS) và `googleNative.ts` (plugin, `import()` chỉ trên app); test với bản giả
  - [ ] 8.5 `account/sync.ts` (lịch CC-14, một lượt một lúc, outbox xoá hồ sơ, `deletedProfileIds` hỏi qua cổng phụ huynh, 401 / newer);
        nối nút "Đăng nhập để giữ tiến độ" (`mvp-tien-do-hoc` CC-6); unit test với đồng hồ giả
  - [ ] 8.6 `vite.config.ts`: `navigateFallbackDenylist` `/api/`, `/admin/`; `server.proxy` + `preview.proxy` `/api`; `public/xoa-tai-khoan.html`,
        `public/privacy.html` (bản nháp, tiếng Việt + tiếng Anh); E2E offline hiện có vẫn xanh
- [ ] 9. E2E Playwright luồng tài khoản
  - [ ] 9.1 `apps/game/e2e/account.spec.ts` (bỏ qua khi không có `E2E_API`): OTP qua API Mailpit, Google giả bằng `page.route`, gộp khách,
        hai context cùng tài khoản thấy chung sao, mất mạng (nút khoá, vẫn chơi, có mạng lại tự đồng bộ), đăng xuất, xoá tài khoản;
        ảnh chụp `shot()` khổ máy tính + điện thoại; chạy với compose dev trên máy dev
- [ ] 10. CI — chặn bởi CC-24
  - [ ] 10.1 Job `check`: service PostgreSQL + migrate trước `test:coverage`
  - [ ] 10.2 Job `account-e2e` (compose db + mailpit + server, Playwright `account.spec.ts`, tải `test-results`)
  - [ ] 10.3 Job `docker` (build hai image prod, `compose config`, chạy image server chờ `/api/health`)
- [ ] 11. Docker cho máy ảo — chặn bởi CC-19, CC-20, CC-21, CC-22, CC-23, CC-25, CC-27
  - [ ] 11.1 `docker/server/Dockerfile` tầng `build` + `runtime` (không root, healthcheck, `pnpm deploy --prod`); build thử amd64
  - [ ] 11.2 `docker/web/Dockerfile` + `docker/caddy/Caddyfile` (design §11.3: `/api`, `/admin/`, `/ads-config.json` từ `deploy/config`,
        header lưu đệm, HSTS)
  - [ ] 11.3 `docker/backup/Dockerfile` + `backup.sh` (pg_dump, age, rclone, giữ 14 bản, `status.json`); test script bằng chạy thử với DB
        compose dev + remote rclone cục bộ (`:local:`), thử khôi phục
  - [ ] 11.4 `docker-compose.prod.yml` (design §11.5: mạng, không mở cổng DB, `read_only`, `cap_drop`, log giới hạn), `.env.prod.example`
  - [ ] 11.5 `scripts/deploy-prod.sh` (pull, build, migrate, up, kiểm health); chạy thử trên máy ảo thật khi CC-21/CC-22 đã có
- [ ] 12. Tài liệu (cùng PR)
  - [ ] 12.1 `docs/deploy.md`: thay mọi "(chờ chốt)" của spec này bằng lựa chọn đã chốt; lệnh dev chính xác (mục 2), migrate, tạo quản
        trị viên, Caddy, `.env.prod` (danh sách khoá), sao lưu + khôi phục + lịch thử, giám sát UptimeRobot; cài Google OAuth (origins,
        consent screen, Android client SHA-1), xác minh tên miền Resend (SPF/DKIM)
  - [ ] 12.2 `docs/ai/00-overview.md` (bảng `apps/server` "Có", luồng màn `account`, `@study/content` có build), `docs/ai/40-conventions.md`
        (file mẫu cho controller / service / test e2e máy chủ), `docs/ai/50-stack-patterns.md` (NestJS + SWC + Vitest, Drizzle, import giá trị
        cho DI, cookie / Bearer), thêm `docs/ai/20-api.md` và `docs/ai/30-data-model.md` nếu chủ sản phẩm đồng ý tạo
  - [ ] 12.3 `docs/feature-checklist.md` (tài khoản, máy chủ, đồng bộ, xoá tài khoản); `docs/mobile-app.md` (plugin Google, SHA-1, Data
        safety: email, mục xoá tài khoản + link `/xoa-tai-khoan.html`); `AGENTS.md` mục 4 thêm lệnh Docker (bảng lệnh); `README.md`
- [ ] 13. DoD: lint, format, typecheck, `pnpm -r test:coverage`, `coverage:changed`, build, `pnpm e2e`, `account.spec.ts` qua compose, job
      `docker` đều sạch không cảnh báo; review bảo mật (log, giới hạn tần suất, CSRF/CORS, bí mật, container không root, DB không mở
      cổng); skill `dod-report`, báo cáo `docs/dod/mvp-tai-khoan_<ngày>.md`; mở PR vào `main`
