# Tài liệu yêu cầu — App Android cho MVP (mvp-android)

> Viết ngày 2026-11-18. Phạm vi: đóng gói `apps/game` thành app Android bằng Capacitor cho nhóm thử nghiệm của giai đoạn 1
> (MVP). **Không** gồm: code mua hàng (spec `mvp-purchases`), code quảng cáo (spec `mvp-ads`), đăng nhập Google gốc
> (spec `mvp-accounts`), bản iOS (giai đoạn 2). Spec này chỉ chừa chỗ cho ba spec kia và liệt kê những gì cửa hàng đòi hỏi
> ở chúng.

## Giới thiệu

Kịch bản (`docs/game-design.md` mục 10.1, 11) chốt: một code web Vue 3 + Phaser, bản web là PWA, app điện thoại đóng gói
bằng Capacitor, chơi được hoàn toàn khi không có mạng. Giai đoạn 1 ra "bản web + Android cho nhóm thử nghiệm"; iOS để giai
đoạn 2.

### Hiện trạng đã rà trong code (2026-11-18)

- **Chưa có Capacitor:** `apps/game/package.json` không có gói `@capacitor/*`, không có `capacitor.config.*`, không có thư mục
  `android/`. Tài liệu đã ghi "sau này đóng gói Android/iOS bằng Capacitor" (`docs/ai/00-overview.md` mục 1).
- **Offline dựa hoàn toàn vào service worker:** `apps/game/vite.config.ts:9-46` dùng `vite-plugin-pwa`
  (`registerType: 'prompt'`, precache `js,css,html,svg,png,woff2,json`, âm thanh phục vụ bằng `runtimeCaching` CacheFirst có
  `rangeRequests`, cache `tomo-audio-v1`). `src/main.ts:10,15` luôn gọi `setupPwa(registerSW)`.
- **Cập nhật kiểu PWA:** `src/pwa.ts` bật `updateReady` khi service worker có bản mới; `src/App.vue:32` hiện banner "Đã có
  bản mới" (`data-testid="update-banner"`).
- **Âm thanh:** `src/audio/index.ts:11-18` nạp `audio/manifest.json` rồi, nếu `navigator.onLine`, gọi `warmAudioCache`
  (`src/audio/offlineCache.ts`) tải mọi file vào Cache Storage. Phát bằng `new Audio(url)` (`src/audio/browserBackend.ts:30`);
  không có file hoặc phát lỗi thì dùng `window.speechSynthesis` (`browserBackend.ts:11,40-54`). File là `.m4a` AAC 48 kbps mono
  (`docs/audio.md` mục 3). `public/audio/manifest.json` hiện rỗng (chưa chạy `tools/tts`), nên **chưa đo được dung lượng
  âm thanh thật**.
- **Bàn phím ảo:** `index.html:7` có `viewport-fit=cover, interactive-widget=resizes-content`. Ô gõ Mưa Chữ
  (`src/games/rain/RainView.vue:229-244`) tắt tự sửa / gợi ý, `lang` theo bộ bài, theo dõi `compositionstart` /
  `compositionend` để không chấm khi bộ gõ đang soạn chữ (`RainView.vue:139-141, 162-165`); focus ngay trong cú chạm
  (`RainView.vue:105-106`) vì iOS.
- **Điều hướng:** `src/App.vue:13-40` giữ biến `screen` (`home` → `island` → `match` | `rain`, và `settings`), không có
  router, không có lịch sử trình duyệt. Chưa có gì xử lý nút Back của Android.
- **Icon:** chỉ có `public/icon.svg` (`vite.config.ts:22`); chưa có ảnh PNG 1024 px, chưa có splash.
- **CI:** `.github/workflows/ci.yml` chỉ có lint / kiểu / unit / build web / E2E web / unittest công cụ TTS; chưa có job Android.
- **Máy dev:** ổ C còn khoảng 1,4 GB trống (đo 2026-11-18). Android Studio + Android SDK cần nhiều GB, nên hiện chưa cài được
  trên máy này (ảnh hưởng CC-8).
- **Dự án anh em đã có app Capacitor** (`medicine-management`, chỉ đọc để học): Capacitor 7, `vite build --mode capacitor`
  rồi `cap sync`; tắt `vite-plugin-pwa` ở mode đó (`frontend/vite.config.ts:36`, `disable: mode === 'capacitor'`); nút Back
  xử lý ở `src/plugins/native.ts`; icon sinh bằng `@capacitor/assets`; tài liệu vận hành ở `docs/mobile-app.md`. Dự án đó
  chưa có job build Android trên CI.

### Kết quả tra cứu bên ngoài (2026-11-18)

| Điểm | Thực tế | Nguồn |
|---|---|---|
| Phiên bản Capacitor | **8** (bản mới nhất trên npm: `@capacitor/core` 8.6.2). Cần Node ≥ 22, Android Studio ≥ 2025.2.1 (Otter). Mặc định `minSdkVersion 24`, `compileSdk 36`, `targetSdk 36`, AGP 8.13, Gradle 8.14.3 | [environment-setup](https://capacitorjs.com/docs/getting-started/environment-setup), [updating/8-0](https://capacitorjs.com/docs/updating/8-0) |
| Edge-to-edge | Capacitor 8 bỏ `adjustMarginsForEdgeToEdge`, thêm plugin lõi **System Bars** (`insetsHandling: native/css/disable`, biến CSS `--safe-area-inset-*`). WebView < 140 không trả `env(safe-area-inset-*)` đúng | [system-bars](https://capacitorjs.com/docs/apis/system-bars) |
| API đích của Google Play | **Từ 31/8/2026: app mới và bản cập nhật phải nhắm Android 16 (API 36)**; xin gia hạn được tới 1/11/2026 (đã qua) | [target-sdk](https://developer.android.com/google/play/requirements/target-sdk) |
| Android 16 + màn hình lớn | App nhắm API 36 trên màn ≥ 600 dp (máy tính bảng, máy gập) **bị bỏ qua khoá xoay màn và khoá kích thước** | [behavior-changes-16](https://developer.android.com/about/versions/16/behavior-changes-16#adaptive-layouts) |
| Phát âm thanh trong WebView | Capacitor đặt `setMediaPlaybackRequiresUserGesture(false)` cho WebView (`Bridge.java:528`), nên `<audio>` phát được không cần cú chạm. Máy chủ nội bộ của Capacitor trả lời yêu cầu `Range` bằng 206 (`WebViewLocalServer.java:356-372`) | [Bridge.java](https://github.com/ionic-team/capacitor/blob/main/android/capacitor/src/main/java/com/getcapacitor/Bridge.java), [WebViewLocalServer.java](https://github.com/ionic-team/capacitor/blob/main/android/capacitor/src/main/java/com/getcapacitor/WebViewLocalServer.java) |
| Giọng máy trong WebView | Android System WebView **không có** `speechSynthesis` (lỗi Chromium mở từ lâu); phần dự phòng giọng máy của `browserBackend.ts` sẽ im lặng trong app. Cần kiểm lại trên máy thật | [crbug.com/487255](https://crbug.com/487255) (chưa mở được trang để xác nhận trạng thái hiện tại: phải kiểm trên máy thật, task 3) |
| Bàn phím | Plugin `@capacitor/keyboard` 8: `resize` chỉ cho iOS; Android có `resizeOnFullScreen` để sửa lỗi bàn phím không co WebView khi toàn màn hình | [keyboard](https://capacitorjs.com/docs/apis/keyboard) |
| Định dạng phát hành | App mới trên Google Play phải nộp **Android App Bundle (AAB)** từ 8/2021 | [Android Developers Blog](https://android-developers.googleblog.com/2021/06/the-future-of-android-app-bundles-is.html) |
| Giới hạn dung lượng | Tính theo dung lượng tải nén: module gốc **500 MB**; mỗi gói tài nguyên 1,5 GB; tổng cài đặt (install-time) 4 GB; fast-follow + on-demand 30 GB. Game > 200 MB nên dùng **Play Asset Delivery**; gói install-time cần trống gấp đôi khi cài | [size limits](https://support.google.com/googleplay/android-developer/answer/9859372), [asset-delivery](https://developer.android.com/guide/playcore/asset-delivery) |
| Play App Signing | App mới **tự vào** Play App Signing, Google giữ khoá ký app; mình giữ **khoá tải lên (upload key)**. Mất upload key thì xin đặt lại được; tự giữ khoá ký app mà mất thì không cứu được | [Play App Signing](https://support.google.com/googleplay/android-developer/answer/9842756) |
| Thử nghiệm | Internal testing: tối đa 100 người, không qua duyệt dài. **Tài khoản cá nhân tạo sau 13/11/2023** phải chạy closed test ≥ 12 người liên tục ≥ 14 ngày mới được xin lên production | [internal testing](https://support.google.com/googleplay/android-developer/answer/9845334), [testing requirements](https://support.google.com/googleplay/android-developer/answer/14151465) |
| Chính sách Gia đình (Families) | Áp dụng khi nhóm đối tượng có trẻ em: khai nhóm tuổi đúng; quảng cáo cho trẻ / người chưa rõ tuổi chỉ qua SDK được tự chứng nhận cho Families, không cá nhân hoá; **không gửi Advertising ID, IMEI, MAC…** của trẻ; app chỉ cho trẻ không xin quyền vị trí, không khai `AD_ID` khi nhắm API ≥ 33; mọi SDK/API (kể cả đăng nhập) phải cho phép dùng với trẻ em; **app không được chỉ là WebView bọc một website** | [Families policy](https://support.google.com/googleplay/android-developer/answer/9893335), [target audience](https://support.google.com/googleplay/android-developer/answer/9867159) |
| Data safety | Bắt buộc với app ở closed / open / production, **kể cả khi không thu dữ liệu**; phải có link chính sách quyền riêng tư; tính cả dữ liệu do SDK thu. App chỉ ở internal testing được miễn | [Data safety](https://support.google.com/googleplay/android-developer/answer/10787469) |
| Xoá tài khoản | App cho tạo tài khoản phải có cách xoá tài khoản trong app **và** một đường link web | [account deletion](https://support.google.com/googleplay/android-developer/answer/13327111) |

### Quyết định đã thống nhất (ràng buộc đầu vào)

Chỉ gồm những gì kịch bản mục 12.1 / thân kịch bản đã chốt:

1. Engine: Vue 3 + Phaser, **đóng gói app bằng Capacitor**, bản web là PWA (Q-1, Q-28; kịch bản 10.1, 12.1).
2. **Phải chơi được hoàn toàn khi không có mạng** (10.1, 10.4: "Toàn bộ nội dung … được đóng gói trong app").
3. Giọng máy, **tạo sẵn file âm thanh**; app không gọi TTS lúc chơi; chữ phát sinh lúc chơi chưa có file thì dùng giọng
   có sẵn trên máy, máy không có giọng phù hợp thì bỏ qua (10.3).
4. Chọn giọng (Q-23): 2–3 giọng mỗi ngôn ngữ, **1 giọng có sẵn trong app**, còn lại tải thêm khi có mạng, tải xong chơi
   offline; nhân vật giữ giọng cố định.
5. Gõ tiếng Nhật nhận cả bộ gõ của máy và romaji (10.1).
6. Giai đoạn 1 (MVP) ra **bản web + Android cho nhóm thử nghiệm**; **iOS ở giai đoạn 2** (mục 11).
7. Gói bỏ quảng cáo trên app bán qua Google Play; trong app không hiện / nhắc chuyển khoản ngân hàng (10.5, Q-16). Code ở
   spec `mvp-purchases`.
8. Quảng cáo AdMob qua plugin Capacitor, hai tầng công tắc, Mầm không có quảng cáo (Q-11, Q-12). Code ở spec `mvp-ads`.
9. Đăng nhập MVP: Google (trên app dùng đăng nhập Google gốc) + email OTP; chơi khách được (Q-3, Q-26). Code ở spec
   `mvp-accounts`.
10. Bố cục: dọc trên điện thoại, ngang trên máy tính; bàn phím ảo bật thì khu vực chơi co lên, không bị che (10.6).
11. Ghi công VOICEVOX trong app và trong mô tả cửa hàng (10.3, `docs/audio.md` mục 5).

### Điểm chốt thêm (2026-11-18)

Chủ sản phẩm **đồng ý toàn bộ đề xuất** ngày 2026-11-18: mỗi điểm dưới đây chốt theo phần **Đề xuất** của nó (phần tra cứu
và lý do giữ lại để biết vì sao). Điểm nào gắn nhãn **Còn mở** thì chưa chốt — xem `.kiro/specs/mvp-open-questions.md`.

- ~~**Chốt thêm 2026-11-18 — Lưu tiến độ trên Android bằng `@capacitor/preferences`** (`mvp-open-questions.md` mục 6.2) qua lớp `KeyValueStore`; web vẫn dùng `localStorage`. Lần đầu mở bản app có Preferences thì chép dữ liệu cũ từ `localStorage` sang.~~ (đã thay, xem dòng dưới)
- **Chốt thêm 2026-11-18 (thay cho dòng `@capacitor/preferences` ở trên) — Dữ liệu offline trên máy dùng SQLite**, theo mẫu bản offline của medicine-management (`frontend/src/offline/db/`): một lớp `Db` chung; app Android dùng `@capacitor-community/sqlite` (bản 8.x, hợp Capacitor 8); trình duyệt dùng `sql.js` (WASM) và lưu cả file DB vào IndexedDB (gom ghi sau một khoảng trễ ngắn); test dùng `sql.js` trong bộ nhớ. Có bảng `schema_version` + hàm `migrate()` chạy khi mở DB. Lần đầu mở bản có SQLite thì chép dữ liệu cũ (`localStorage`: cài đặt, tiến độ nếu có) vào DB. `ProgressDocV1` vẫn là gói dữ liệu khi đồng bộ với máy chủ (đọc ra từ / ghi vào SQLite). File `.wasm` của sql.js phải nằm trong precache để chơi offline.

- **CC-1 Mã app (`appId` / `applicationId`)** — không đổi được sau khi đăng lên Google Play.
  **Đề xuất:** `com.trungthong.tomo`. Lý do: cùng tiền tố với app anh em (`com.trungthong.pharmacy`), ngắn, không gắn với tên
  game tạm (Q-2 chưa chốt nên tránh đưa tên dài vào mã). Nếu có tên miền riêng cho game thì dùng tên miền đảo ngược.
- **CC-2 Tên hiển thị** — tên trên Google Play (≤ 30 ký tự) và tên dưới icon. Phụ thuộc Q-2 (tên game).
  **Đề xuất:** cửa hàng "Tomo và Quần đảo Tri Thức" (25 ký tự, như `manifest.name` ở `vite.config.ts:14`), dưới icon "Tomo"
  (như `short_name`). Lý do: khớp bản PWA; tên dài bị cắt dưới icon.
- **CC-3 Thư viện thêm vào** (AGENTS mục 6: thêm thư viện phải hỏi).
  **Đề xuất:** `@capacitor/core`, `@capacitor/cli`, `@capacitor/android`, `@capacitor/app` (nút Back, sự kiện vào nền),
  `@capacitor/splash-screen`, `@capacitor/assets` (chỉ dev, sinh icon/splash) — đều bản 8.x / 4.x chính thức. **Chưa** thêm
  `@capacitor/keyboard`, `@capacitor/screen-orientation` trừ khi kiểm máy thật thấy cần (CC-5, CC-6). Lý do: ít phụ thuộc,
  đều do đội Capacitor duy trì, không thu dữ liệu.
- **CC-4 Phiên bản Android thấp nhất (`minSdkVersion`)**.
  **Đề xuất:** 24 (Android 7.0), mặc định của Capacitor 8. Lý do: rộng nhất mà Capacitor 8 hỗ trợ; máy cũ của trẻ em hay là
  máy cũ của bố mẹ. `targetSdk`/`compileSdk` 36 là bắt buộc của Google Play, không phải lựa chọn.
- **CC-5 Xoay màn hình**. Kịch bản 10.6 ghi "dọc trên điện thoại"; Android 16 bỏ qua khoá xoay trên màn ≥ 600 dp.
  **Đề xuất:** khoá **dọc** trên điện thoại bằng `android:screenOrientation="portrait"` trong `AndroidManifest.xml`; máy tính
  bảng tự xoay (Android 16 vốn buộc vậy), giao diện dùng bố cục ngang đã có cho máy tính. Lý do: Mưa Chữ cần chiều cao, trẻ
  hay xoay máy nhầm; không cần plugin.
- **CC-6 Bàn phím ảo**. Cần chọn cách giữ ô gõ Mưa Chữ không bị che trên Android 15/16 (edge-to-edge bắt buộc).
  **Đề xuất:** `windowSoftInputMode="adjustResize"` + System Bars `insetsHandling: 'css'` + giữ `interactive-widget` sẵn có;
  chỉ thêm `@capacitor/keyboard` (đọc chiều cao bàn phím) nếu kiểm máy thật Android 15/16 vẫn bị che. Lý do: không thêm thư viện
  khi chưa chứng minh cần.
- **CC-7 Dung lượng offline — đóng gói âm thanh** (kịch bản **Q-9 còn mở**: đóng gói toàn bộ hay tải từng đảo).
  **Đề xuất cho MVP:** đóng gói **toàn bộ âm thanh của giọng mặc định** (mỗi ngôn ngữ 1 giọng, theo Q-23) vào app; giọng thứ
  2–3 tải thêm (CC-9). Chỉ chuyển sang Play Asset Delivery khi AAB vượt khoảng 150 MB. Lý do: MVP mỗi đảo 2 vùng, ước tính
  của kịch bản 10.3 là "vài chục MB mỗi đảo đầy đủ", nên 3 đảo × 2 vùng × 1 giọng còn xa giới hạn 500 MB của module gốc; đóng
  gói hết thì offline ngay sau khi cài, không có màn tải. Con số thật chỉ biết khi chạy `tools/tts` (manifest đang rỗng).
- **CC-8 Ký app và nơi build**.
  **Đề xuất:** dùng **Play App Signing với khoá ký do Google tạo** (mặc định); chủ sản phẩm tạo **upload key** bằng `keytool`
  một lần, cất ở trình quản lý mật khẩu + một bản sao ngoại tuyến; CI giữ bản base64 của keystore và mật khẩu trong GitHub
  Secrets, build AAB phát hành trên CI (máy dev hết chỗ cho Android SDK). Lý do: mất upload key vẫn xin đặt lại được; không
  phải cài Android Studio trên máy đầy ổ.
- **CC-9 Giọng tải thêm trong app** (Q-23 đã chốt "tải thêm", nhưng chưa có spec cho phần tải và nơi đặt file — Q-29 mở).
  **Đề xuất:** spec này chỉ làm phần **phát** được file đã tải (lưu trong Cache Storage của WebView, phát bằng `blob:` URL);
  màn tải gói giọng và nơi đặt file làm ở một spec riêng `mvp-goi-giong`. Lý do: tách phạm vi, tránh khoá spec Android vào
  quyết định máy chủ.
- **CC-10 Dự phòng giọng máy trong app** — WebView không có `speechSynthesis`, nên đoạn chưa có file sẽ im lặng.
  **Đề xuất:** MVP chấp nhận im lặng (kịch bản 10.3 cho phép "bỏ qua, không đọc"), thêm kiểm tra build báo lỗi nếu có câu cố
  định thiếu file trong giọng mặc định. Thêm plugin TTS gốc (ví dụ `@capacitor-community/text-to-speech`) chỉ khi thấy cần.
  Lý do: mọi câu cố định và bài học đều đã có file tạo sẵn; chỉ chữ phát sinh (hiếm) bị ảnh hưởng.
- **CC-11 Nút Back của Android khi đang chơi**.
  **Đề xuất:** Mưa Chữ / Ghép Đôi: Back = tạm dừng + hỏi "Thoát ván này?" (Ở lại / Thoát); Đảo, Cài đặt: về màn trước; Trang
  chủ: thoát app (không hỏi). Lý do: trẻ hay bấm nhầm Back, mất ván giữa chừng gây khó chịu (nguyên tắc "không phạt nặng");
  ở trang chủ thì thoát như mọi app.
- **CC-12 Cập nhật app**. Trong app không có service worker nên banner "Đã có bản mới" không bao giờ hiện.
  **Đề xuất:** MVP để Google Play tự cập nhật, **không** hiện banner trong app, **không** dùng cập nhật web qua mạng (live
  update kiểu Capgo/Appflow). Lý do: nhóm thử nghiệm nhỏ, Play tự cập nhật; tránh thêm thư viện và tránh rủi ro chính sách.
  Giai đoạn 2 cân nhắc Play In-App Updates.
- **CC-13 Splash và icon**. Phong cách hình (Q-6) chưa chốt.
  **Đề xuất:** splash = màu nền `#f3f7fa` (`background_color` của PWA) + icon ở giữa (kiểu Android 12+), tự ẩn khi Vue đã
  vẽ xong màn đầu; icon tạm sinh từ `public/icon.svg` (xuất PNG 1024 px, nền adaptive `#2f6f8f`), thay khi có hình chính
  thức. Lý do: không chờ Q-6 mới phát cho thử nghiệm được.
- **CC-14 Số phiên bản (`versionCode` / `versionName`)**.
  **Đề xuất:** `versionName` = `version` trong `apps/game/package.json` (đổi từ `0.0.0` sang `0.1.0` cho bản thử đầu);
  `versionCode` = số lần chạy của workflow Android (`github.run_number`) + 1000. Lý do: luôn tăng, không phải sửa tay, không
  trùng.
- **CC-15 Commit thư mục `apps/game/android/`**.
  **Đề xuất:** commit (trừ `build/`, `.gradle/`, `local.properties`, keystore, `google-services.json`). Lý do: Capacitor
  khuyên commit project native vì có chỉnh tay (manifest, gradle); app anh em làm vậy.
- **CC-16 Tài khoản Google Play Console**.
  **Đề xuất:** tài khoản **tổ chức** nếu có pháp nhân (có số D-U-N-S); không thì tài khoản cá nhân và chấp nhận closed test
  12 người × 14 ngày trước khi lên production. Lý do: MVP chỉ cần internal testing, loại tài khoản chỉ ảnh hưởng lúc phát
  hành chính thức; nhưng đổi loại về sau phải chuyển app.
- **CC-17 Nhóm thử nghiệm**.
  **Đề xuất:** internal testing, danh sách người thử quản lý bằng **một Google Group** (thêm / bớt không phải sửa Play
  Console); khoảng 10–20 người, có cả phụ huynh có con 5–14 tuổi và người học tiếng Nhật dùng Gboard / bộ gõ Nhật. Lý do:
  internal testing có ngay sau khi tải lên, tối đa 100 người; cần người thật thử bộ gõ và nhóm tuổi Mầm/Chồi.
- **CC-18 Nhóm tuổi khai trên Google Play** — **Đã chốt 2026-11-18: gồm cả nhóm "5 tuổi trở xuống"** (theo đề xuất bên dưới; `mvp-ads` CC-6 theo cùng quyết định) (bắt Families policy).
  **Đề xuất:** khai 5 trở xuống, 6–8, 9–12, 13–15, 16–17, 18+ (đối tượng hỗn hợp, đúng ba nhóm Mầm/Chồi/Cây). Lý do: kịch
  bản nhắm 5 tuổi trở lên; khai thiếu nhóm trẻ mà hình ảnh hướng trẻ em thì Google tự xếp lại và có thể gỡ app. Hệ quả: áp
  Families policy cho cả app; spec `mvp-ads` và `mvp-accounts` phải tuân theo (bảng ràng buộc ở `design.md` mục 9).
- **CC-19 Chính sách quyền riêng tư**: đặt ở đâu, ai soạn nội dung. Phụ thuộc Q-5 (dữ liệu trẻ em) và Q-29 (nơi đặt web).
  **Đề xuất:** trang tĩnh trong chính bản web (`/privacy.html`, tiếng Việt + tiếng Anh), nội dung do chủ sản phẩm duyệt,
  dev soạn bản nháp theo những gì app thu thật (bảng Data safety ở `docs/mobile-app.md`). Lý do: không cần dịch vụ ngoài, đi
  cùng bản web, sửa được cùng commit khi app đổi.
- **CC-20 Phát hành lên Google Play từ CI**.
  **Đề xuất:** MVP **tải AAB lên tay** trong Play Console; CI chỉ build và lưu AAB làm artifact. Tự động tải lên (service
  account + Play Developer API) làm sau. Lý do: ít bí mật phải cất trên CI; bản thử ít khi phát.

## Thuật ngữ

- **Capacitor**: công cụ bọc bản build web (`dist/`) thành app gốc; trong app, web chạy trong WebView, phục vụ từ
  `https://localhost` bởi máy chủ nội bộ của Capacitor.
- **Bản app / bản web**: cùng code; bản app build bằng `vite build --mode capacitor`, không có service worker.
- **AAB**: Android App Bundle, gói nộp lên Google Play; Google sinh APK cho từng máy.
- **Upload key / khoá ký app**: khoá mình dùng ký AAB trước khi tải lên / khoá Google dùng ký APK giao cho người dùng.
- **Internal testing**: kênh thử nội bộ của Google Play, tối đa 100 người.
- **Families policy**: bộ quy định của Google Play cho app có trẻ em trong đối tượng.
- **Edge-to-edge**: app vẽ tràn dưới thanh trạng thái và thanh điều hướng; bắt buộc khi nhắm Android 15+.

## Yêu cầu

### Yêu cầu 1 — Dự án Capacitor cho Android

**User story:** Là dev, tôi muốn build ra app Android từ đúng code web hiện có, để không phải giữ hai code.

1. `apps/game` có `capacitor.config.ts` với `appId` (CC-1), `appName` (CC-2), `webDir: 'dist'`, `androidScheme: 'https'`.
2. Thư mục `apps/game/android/` sinh bởi Capacitor 8, `minSdkVersion` theo CC-4, `compileSdk` và `targetSdk` = 36.
3. Lệnh `pnpm --filter @study/game build:app` build web ở mode `capacitor` rồi `cap sync android`; lệnh không có trong
   AGENTS mục 4 thì thêm vào bảng lệnh cùng commit.
4. App chỉ xin quyền `INTERNET`; manifest sau khi gộp (merged manifest) không có quyền vị trí, danh bạ, `AD_ID`
   (trừ khi spec `mvp-ads` thêm và ghi lý do).
5. `pnpm build`, `pnpm test`, `pnpm e2e` của bản web không đổi hành vi.

### Yêu cầu 2 — Chơi không cần mạng trong app

**User story:** Là người chơi, tôi cài app xong, tắt mạng vẫn chơi được ngay, có tiếng.

1. Bản app không đăng ký service worker; mọi file game (code, phông, hình, `audio/manifest.json`) nằm trong AAB.
2. Âm thanh của giọng đóng gói (CC-7) nằm trong AAB và phát được khi máy ở chế độ máy bay ngay lần mở đầu.
3. Bản app không chạy `warmAudioCache` cho file đóng gói (không chép file sẵn có vào Cache Storage).
4. Âm thanh của giọng tải thêm (CC-9) phát được từ bộ nhớ của app khi không có mạng.
5. Kiểm tra build báo lỗi khi tổng dung lượng AAB vượt ngưỡng ghi trong `docs/mobile-app.md` (mặc định 150 MB, theo CC-7).

### Yêu cầu 3 — Phát âm thanh trong WebView

1. Tự đọc (`autoRead`) phát được ngay khi vào màn, không cần cú chạm đầu tiên.
2. File `.m4a` phát được trên Android 7 trở lên (CC-4); tua / phát lại một đoạn hoạt động (yêu cầu `Range`).
3. App xuống nền (bấm Home, khoá màn, có cuộc gọi) thì dừng đọc và tạm dừng Mưa Chữ; quay lại không tự đọc lại đoạn cũ.
4. Đoạn không có file và máy không có giọng: không đọc, không treo lượt đọc (theo CC-10).

### Yêu cầu 4 — Bàn phím ảo và bộ gõ tiếng Nhật

1. Mở bàn phím ở Mưa Chữ thì ô gõ và vùng mưa nằm trên bàn phím, không bị che, trên Android 7, 13, 15, 16 (CC-6).
2. Gõ かな bằng Gboard (bàn phím tiếng Nhật) và bằng romaji đều chấm đúng; không chấm khi đang soạn chữ (đang có gạch chân).
3. Gõ tiếng Anh / IT bằng Gboard: từ đúng được chấm **ngay khi gõ xong chữ cuối**, không phải chờ dấu cách hay OK (Gboard
   soạn chữ Latin bằng composition nên quy tắc "đang soạn thì không chấm" phải chỉ áp cho tiếng Nhật).
4. Sau khi trúng một từ, ô gõ được xoá sạch, bộ gõ không chèn lại chữ cũ.
5. Thanh trạng thái / thanh điều hướng không che nội dung (edge-to-edge).

### Yêu cầu 5 — Xoay màn hình

1. Theo CC-5. Màn ≥ 600 dp xoay ngang được, bố cục không vỡ, Mưa Chữ chơi được ở cả hai chiều.
2. Xoay màn hoặc đổi kích thước cửa sổ không làm WebView tải lại (giữ ván đang chơi).

### Yêu cầu 6 — Nút Back

1. Back trên từng màn theo CC-11.
2. Đang mở hộp thoại thì Back đóng hộp thoại trước.
3. Bản web không bị ảnh hưởng.

### Yêu cầu 7 — Cập nhật app

1. Bản app không hiện banner "Đã có bản mới" của PWA.
2. Theo CC-12. Cài đè bản mới (cùng `appId`, cùng khoá ký) giữ nguyên cài đặt và tiến độ (`localStorage`).

### Yêu cầu 8 — Icon, splash, tên

1. Icon adaptive (foreground + background) và icon tròn cho mọi mật độ màn hình, sinh từ ảnh nguồn trong repo (CC-13).
2. Splash không chớp màn trắng giữa splash và màn đầu; tự ẩn khi màn đầu đã vẽ.
3. Tên dưới icon và tên trên cửa hàng theo CC-2.

### Yêu cầu 9 — Ký app và build phát hành

1. Keystore, mật khẩu, `google-services.json` không bao giờ vào git (hook đã chặn; thêm mẫu vào `.gitignore`).
2. Build phát hành ra AAB đã ký bằng upload key (CC-8); `versionCode` tăng mỗi lần (CC-14).
3. Không có keystore thì vẫn build được bản debug.

### Yêu cầu 10 — CI Android

1. Workflow build APK debug cho mọi PR đổi `apps/game/**` hoặc `packages/content/**`, lưu artifact 7 ngày.
2. Workflow build AAB phát hành khi chạy tay (`workflow_dispatch`) hoặc khi đẩy tag `android-v*`, dùng GitHub Secrets (CC-8),
   lưu AAB làm artifact; tải lên Play theo CC-20.
3. Job Android không chạy khi PR chỉ đổi tài liệu.

### Yêu cầu 11 — Google Play: thử nghiệm và hồ sơ cửa hàng

1. App có trên kênh internal testing, người thử (CC-17) cài được từ link mời.
2. Hồ sơ cửa hàng đủ: tên, mô tả ngắn / dài (có ghi công `VOICEVOX:<tên>`), icon 512 px, ảnh tính năng 1024×500, ít nhất 2
   ảnh chụp điện thoại, phân loại nội dung (IARC), nhóm tuổi (CC-18), Data safety, link chính sách quyền riêng tư (CC-19).
3. Bảng ràng buộc Families cho các spec khác (`design.md` mục 9) được kiểm trước khi gửi lên closed test / production.

### Yêu cầu 12 — Tài liệu vận hành

1. Tạo `docs/mobile-app.md`: cài công cụ, build, chạy trên máy thật, tạo upload key, CI secrets, tải lên internal testing,
   thêm người thử, điền hồ sơ cửa hàng / Data safety / nhóm tuổi, phát bản mới, xử lý mất upload key, checklist thử máy thật.
2. Cập nhật `docs/README.md`, `docs/ai/00-overview.md`, `docs/feature-checklist.md`, `AGENTS.md` mục 4 (lệnh mới) và mục 8
   nếu thêm file không được commit.
