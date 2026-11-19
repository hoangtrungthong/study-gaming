# Kế hoạch triển khai — App Android cho MVP (mvp-android)

> **Cập nhật 2026-11-18:** chủ sản phẩm đồng ý toàn bộ đề xuất — mọi chỗ ghi `(CC-n)` / `[CC-x]` / "Chặn bởi CC-n" nay là **đã chốt** theo đề xuất, trừ các điểm gắn nhãn **Còn mở** ở `requirements.md` (xem `../mvp-open-questions.md`).

Nhánh: `feat/mvp-android` (từ `main` mới nhất). Node 22 + pnpm 11 (AGENTS mục 4).

**Trước khi code:** hỏi hết "Chờ chốt" trong `requirements.md`. Việc nào phụ thuộc câu nào thì ghi ở cuối việc; chưa chốt thì
không làm việc đó. Không câu nào được coi là chốt chỉ vì có đề xuất.

Mỗi việc xong: `pnpm lint`, `pnpm typecheck`, `pnpm -r test:coverage`, `pnpm coverage:changed` (100% dòng file đổi) xanh,
không cảnh báo.

- [ ] 1. Thêm Capacitor và mode build `capacitor` (CC-1, CC-2, CC-3, CC-4, CC-15)
  - Thêm gói theo CC-3; `capacitor.config.ts`; `cap add android`; `variables.gradle` (min theo CC-4, compile/target 36);
    `.gitignore` cho `android/app/build`, `android/.gradle`, `local.properties`, `*.jks`, `*.keystore`, `google-services.json`.
  - `vite.config.ts`: `VitePWA({ disable: mode === 'capacitor' })`; script `build:app`, `app:android`.
  - `src/platform.ts` (`isNativeApp`), `main.ts` tách `bootstrap(native)`: web gọi `setupPwa`, app gọi `setupNative` (import động).
  - Test: unit `platform.test.ts`, `bootstrap` (app không gọi `setupPwa`, web có); build web vẫn có `sw.js`; build mode
    `capacitor` không có `sw.js`; `pnpm e2e` xanh.

- [ ] 2. Manifest Android, edge-to-edge, quyền (CC-5, CC-6)
  - `AndroidManifest.xml`: `screenOrientation` theo CC-5, thêm `density` vào `configChanges`, `windowSoftInputMode` theo CC-6;
    `MainActivity` gọi `EdgeToEdge.enable`; cấu hình `SystemBars`.
  - CSS: padding vùng an toàn cho thanh tiêu đề, ô gõ Mưa Chữ, banner.
  - Test: E2E web khổ điện thoại chụp ảnh không đổi bố cục; kiểm merged manifest (`app/build/intermediates/merged_manifests`)
    chỉ có `INTERNET` — ghi lệnh kiểm vào `docs/mobile-app.md`; máy thật: thanh hệ thống không che nội dung.

- [ ] 3. Âm thanh trong app (CC-7, CC-9, CC-10)
  - `pickBundledVoices` + plugin Vite lọc `dist/audio` ở mode `capacitor` (bỏ bước lọc nếu CC-7 chọn đóng gói mọi giọng).
  - `src/audio/clipSource.ts` (`resolveClipUrl`), `Speaker` giải URL trước khi phát; `audio/index.ts` không warm cache trong app.
  - Kiểm tra mọi câu cố định / thẻ bài có file trong giọng mặc định (khi manifest không rỗng).
  - Test: unit `pickBundledVoices`, `clipSource` (web, app bundled, app tải thêm có / không có cache, thu hồi blob URL),
    `speaker.test.ts`, `index.test.ts` (không warm khi native); E2E `offline.spec.ts` xanh; máy thật: chế độ máy bay lần mở
    đầu vẫn có tiếng, tự đọc không cần chạm, xác nhận `speechSynthesis` vắng trong WebView (ghi kết quả vào spec).

- [ ] 4. Vòng đời app: vào nền dừng đọc, tạm dừng Mưa Chữ
  - Nghe `visibilitychange` (chung web/app) + `App` `pause` (app); `RainView` tạm dừng, hiện "Chơi tiếp".
  - Test: unit `lifecycle`; unit `RainView` (sự kiện ẩn → paused, không tự chơi tiếp); E2E web: giả tab ẩn → dừng đọc;
    máy thật: bấm Home / khoá màn / quay lại.

- [ ] 5. Bàn phím và bộ gõ trong Mưa Chữ (CC-6)
  - `blocksWhileComposing(termLang, mode)`; trúng lúc đang soạn chữ thì kết thúc phiên soạn rồi mới xoá ô.
  - Thêm `@capacitor/keyboard` **chỉ khi** máy thật Android 15/16 bị che ô gõ (hỏi trước, CC-3).
  - Test: unit bảng ngôn ngữ × chế độ; unit `RainView` (tiếng Anh chấm khi đang composition, tiếng Nhật không); E2E web
    giả composition; máy thật: Gboard かな, romaji, tiếng Anh, Telex tiếng Việt, bàn phím không che, ô xoá sạch sau khi trúng.

- [ ] 6. Nút Back (CC-11)
  - `backAction` thuần; hộp thoại "Thoát ván này?" (đọc to); nối `App.addListener('backButton')` trong `setupNative`.
  - Test: unit mọi hàng của bảng ở `design.md` mục 7; unit hộp thoại (Ở lại / Thoát, đọc `viSegment`); E2E web: hộp thoại
    mở từ nút Thoát hiện có không đổi; máy thật: Back từng màn, thoát app ở trang chủ.

- [ ] 7. Icon, splash, tên (CC-2, CC-13)
  - `apps/game/resources/` (icon 1024, foreground/background adaptive, splash); `app:icons`; `src/native/splash.ts` ẩn splash
    sau `mount` + khung hình đầu.
  - Test: unit `splash` (gọi `hide` đúng một lần sau mount); máy thật: không chớp trắng, icon tròn / vuông đúng, tên dưới icon.

- [ ] 8. Ký app, số phiên bản, kiểm dung lượng (CC-8, CC-14, CC-7)
  - `app/build.gradle`: `signingConfigs` đọc biến môi trường, `versionCode`/`versionName` từ biến; `scripts/check-app-size.mjs`
    + script `app:size`.
  - Test: unit cho `check-app-size.mjs` (dưới / trên ngưỡng, thiếu file); build debug không cần keystore.

- [ ] 9. CI Android (CC-8, CC-14, CC-20)
  - `.github/workflows/android.yml`: APK debug trên PR (lọc đường dẫn), AAB phát hành khi `workflow_dispatch` / tag
    `android-v*`; keystore chỉ ở `$RUNNER_TEMP`, xoá ở bước `always()`.
  - Test: PR chạy job debug xanh, có artifact; một lần chạy tay ra AAB đã ký (kiểm bằng `jarsigner -verify` hoặc
    `bundletool validate`); PR chỉ đổi `docs/**` không chạy job.

- [ ] Thêm `@capacitor-community/sqlite` 8.x (thay `@capacitor/preferences`), kiểm trên máy thật: tiến độ còn sau khi tắt app, sau khi cập nhật app
- [ ] 10. Google Play: internal testing (CC-16, CC-17, CC-18, CC-19) — chủ sản phẩm làm trên Play Console, dev chuẩn bị tài liệu
  - Tạo app, tải AAB đầu (đăng ký Play App Signing), tạo kênh internal testing, thêm Google Group người thử.
  - Nháp hồ sơ cửa hàng, nhóm tuổi, Data safety, IARC, trang chính sách quyền riêng tư (`public/privacy.html` nếu CC-19 chọn vậy;
    có unit/E2E kiểm trang tồn tại và mở được offline).
  - Kiểm: người thử cài được từ link mời; chạy hết checklist máy thật ở `design.md` mục 11 và ghi kết quả vào báo cáo DoD.

- [ ] 11. Tài liệu và DoD
  - Tạo `docs/mobile-app.md` (từng bước): cài công cụ (Android Studio ≥ 2025.2.1, JDK đi kèm, hoặc chỉ dùng CI), `build:app`,
    chạy trên máy thật / giả lập, tạo upload key, GitHub Secrets, chạy workflow phát hành, tải AAB lên internal testing,
    thêm người thử, điền hồ sơ / Data safety / nhóm tuổi / IARC, phát bản mới (tăng phiên bản, tag `android-v*`), mất upload
    key, ngưỡng dung lượng và khi nào chuyển Play Asset Delivery, bảng ràng buộc Families cho các spec khác, checklist máy thật.
  - Cập nhật `AGENTS.md` mục 4 (lệnh `build:app`, `app:android`, `app:icons`, `app:size`) và mục 8 nếu có file mới không commit;
    `docs/README.md`; `docs/ai/00-overview.md` (mục 1, 6: offline trong app); `docs/audio.md` (mục 4: âm thanh trong app);
    `docs/feature-checklist.md`; chuyển các CC đã chốt vào kịch bản mục 12.1 và câu mới (nếu có) vào 12.2.
  - Đánh dấu `- [x]` từng việc; chạy skill `dod-report`, báo cáo ở `docs/dod/`.
