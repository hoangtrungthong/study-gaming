# Thiết kế — App Android cho MVP (mvp-android)

> **Cập nhật 2026-11-18:** chủ sản phẩm đồng ý toàn bộ đề xuất — mọi chỗ ghi `(CC-n)` / `[CC-x]` / "Chặn bởi CC-n" nay là **đã chốt** theo đề xuất, trừ các điểm gắn nhãn **Còn mở** ở `requirements.md` (xem `../mvp-cho-chot.md`).

> Đi cùng `requirements.md`. Chỗ nào phụ thuộc "Chờ chốt" thì ghi `(CC-n)` và viết theo **đề xuất**; nếu chủ sản phẩm chọn
> khác thì sửa mục đó trước khi code.

## 1. Tổng quan các lớp

```
apps/game/src (Vue + Phaser, chung cho web và app)
  ├─ platform.ts            ← MỚI: isNativeApp() = Capacitor.isNativePlatform(); điểm duy nhất hỏi "đang trong app?"
  ├─ main.ts                ← web: setupPwa(registerSW); app: setupNative()
  ├─ native/                ← MỚI, chỉ chạy trong app (import động, web không tải)
  │    ├─ backButton.ts     ← luật nút Back (TS thuần, unit test) + nối @capacitor/app
  │    ├─ lifecycle.ts      ← vào nền / ra nền → speaker.stop(), tạm dừng Mưa Chữ
  │    └─ splash.ts         ← ẩn splash khi màn đầu đã vẽ
  ├─ audio/
  │    ├─ index.ts          ← app: không warmAudioCache cho file đóng gói
  │    ├─ clipSource.ts     ← MỚI: đổi đường dẫn clip → URL phát (file đóng gói | blob từ Cache Storage cho giọng tải thêm)
  │    └─ browserBackend.ts ← không đổi cách phát; speechSynthesis vắng thì trả false (đã có)
  └─ games/rain/RainView.vue← quy tắc composition theo ngôn ngữ (Yêu cầu 4.3)

apps/game/capacitor.config.ts   ← MỚI
apps/game/android/              ← MỚI, sinh bởi `cap add android`, chỉnh tay manifest / gradle (CC-15)
apps/game/resources/            ← MỚI, ảnh nguồn icon / splash cho @capacitor/assets (CC-13)
apps/game/vite.config.ts        ← mode 'capacitor': VitePWA({ disable: true }), lọc audio theo CC-7
.github/workflows/android.yml   ← MỚI
docs/mobile-app.md              ← MỚI
```

Nguyên tắc: **một code**. Mọi nhánh "app hay web" đi qua `isNativeApp()` để test được bằng cách mock một hàm; không rải
`Capacitor.isNativePlatform()` khắp nơi. Code chỉ dành cho app nằm trong `src/native/` và được `import()` động để bản web không
kéo theo plugin.

## 2. Build

### 2.1. Mode `capacitor` của Vite

```ts
// vite.config.ts (phác)
export default defineConfig(({ mode }) => ({
  plugins: [vue(), VitePWA({ disable: mode === 'capacitor', /* cấu hình cũ */ })],
  define: { __NATIVE_BUILD__: JSON.stringify(mode === 'capacitor') },
}));
```

- `disable: true` vẫn cung cấp module ảo `virtual:pwa-register` (hàm rỗng), nên `main.ts` không vỡ — app anh em dùng đúng cách
  này (`medicine-management/frontend/vite.config.ts:36`). Dù vậy `main.ts` sẽ chỉ gọi `setupPwa` khi `!isNativeApp()`.
- Không sinh `sw.js`, `manifest.webmanifest`; `index.html` giữ nguyên (meta `interactive-widget` vẫn có ích cho WebView mới).

### 2.2. Âm thanh trong bản app (CC-7, CC-9)

- `tools/tts` ghi mọi giọng vào `public/audio/<giọng>/`. Vite chép cả `public/` vào `dist/`. Theo đề xuất CC-7, bản app chỉ
  mang **giọng mặc định** của mỗi ngôn ngữ: thêm một plugin Vite nhỏ (chạy ở `closeBundle`, chỉ mode `capacitor`) xoá thư mục
  giọng không mặc định khỏi `dist/audio/` và ghi `dist/audio/manifest.json` chỉ còn các giọng đóng gói, kèm trường
  `bundled: true` cho từng giọng. "Giọng mặc định" = giọng đầu tiên của mỗi ngôn ngữ trong `tools/tts/voices.json` (đúng thứ tự
  `Speaker` đang ưu tiên, `docs/am-thanh.md` mục 1).
- Logic chọn giọng giữ / bỏ là hàm TS thuần `pickBundledVoices(manifest)` có unit test; plugin Vite chỉ gọi nó.
- Nếu chủ sản phẩm chọn đóng gói **mọi** giọng (khác CC-7) thì bỏ bước lọc, phần còn lại không đổi.
- Nếu AAB vượt ngưỡng (Yêu cầu 2.5): chuyển âm thanh sang **Play Asset Delivery** gói `install-time` (vẫn offline ngay khi cài,
  giới hạn 1,5 GB/gói) — đây là nhánh dự phòng, không làm trong MVP nếu chưa vượt.
- AAPT mặc định không nén lại `.m4a` (đã là định dạng nén), nên máy chủ nội bộ của Capacitor đọc và trả `Range` được.

### 2.3. Lệnh

| Lệnh (thêm vào `apps/game/package.json`) | Việc |
|---|---|
| `build:app` | `vue-tsc --noEmit && vite build --mode capacitor && cap sync android` |
| `app:android` | `cap open android` (mở Android Studio, máy có cài) |
| `app:icons` | `capacitor-assets generate --android --assetPath resources` |
| `app:size` | `node scripts/check-app-size.mjs <đường dẫn aab>` — báo lỗi khi vượt ngưỡng (Yêu cầu 2.5) |

Gradle (trong `apps/game/android`): `./gradlew assembleDebug` (APK debug), `./gradlew bundleRelease` (AAB, cần biến ký).

## 3. Cấu hình Capacitor và Android

```ts
// apps/game/capacitor.config.ts (theo đề xuất)
const config: CapacitorConfig = {
  appId: 'com.trungthong.tomo',          // CC-1 — không đổi được sau khi lên Play
  appName: 'Tomo',                        // CC-2 — tên dưới icon
  webDir: 'dist',
  server: { androidScheme: 'https' },     // origin https://localhost: localStorage / Cache Storage bền qua các bản cập nhật
  android: { allowMixedContent: false },
  plugins: {
    SystemBars: { insetsHandling: 'css', style: 'DARK' },   // CC-6, edge-to-edge
    SplashScreen: { launchAutoHide: false, backgroundColor: '#f3f7fa' },  // CC-13
  },
};
```

`AndroidManifest.xml` (chỉnh tay sau `cap add android`):

| Thuộc tính | Giá trị | Vì sao |
|---|---|---|
| `android:screenOrientation` | `portrait` | CC-5; Android 16 tự bỏ qua trên màn ≥ 600 dp |
| `android:configChanges` | thêm `density` vào danh sách mặc định | Capacitor 8 khuyên, để đổi kích thước không tải lại WebView (Yêu cầu 5.2) |
| `android:windowSoftInputMode` | `adjustResize` | CC-6 |
| `android:allowBackup` | `true` (mặc định) | Đổi máy vẫn giữ tiến độ của khách qua sao lưu Google; xem lại khi `mvp-tai-khoan` lưu token |
| Quyền | chỉ `INTERNET` | Yêu cầu 1.4, Families |

`MainActivity`: gọi `EdgeToEdge.enable(this)` trong `onCreate` như tài liệu System Bars khuyên khi `insetsHandling` khác
`disable`. CSS: các phần sát mép (thanh tiêu đề, ô gõ Mưa Chữ, banner) thêm `padding` bằng
`max(env(safe-area-inset-*), var(--safe-area-inset-*, 0px))`.

`variables.gradle`: `minSdkVersion = 24` (CC-4), `compileSdkVersion = 36`, `targetSdkVersion = 36`.

`app/build.gradle` — ký phát hành đọc biến môi trường, không có thì bỏ qua (Yêu cầu 9.3):

```groovy
signingConfigs {
  release {
    def ks = System.getenv('ANDROID_KEYSTORE_PATH')
    if (ks) {
      storeFile file(ks)
      storePassword System.getenv('ANDROID_KEYSTORE_PASSWORD')
      keyAlias System.getenv('ANDROID_KEY_ALIAS')
      keyPassword System.getenv('ANDROID_KEY_PASSWORD')
    }
  }
}
buildTypes { release { if (System.getenv('ANDROID_KEYSTORE_PATH')) signingConfig signingConfigs.release } }
defaultConfig {
  versionCode (System.getenv('ANDROID_VERSION_CODE') ?: '1') as int      // CC-14
  versionName System.getenv('ANDROID_VERSION_NAME') ?: '0.1.0'
}
```

## 4. Offline trong app

| Thứ | Bản web | Bản app |
|---|---|---|
| Code, phông, hình, `manifest.json` | Precache Workbox | Nằm trong AAB, phục vụ từ `https://localhost` |
| Âm thanh giọng mặc định | Runtime cache `tomo-audio-v1` + `warmAudioCache` | Nằm trong AAB; **không** warm cache |
| Âm thanh giọng tải thêm (CC-9) | Như trên | Cache Storage `tomo-audio-v1` của WebView; phát bằng `blob:` URL |
| Cấu hình quảng cáo từ xa, API máy chủ | Cùng origin | URL tuyệt đối từ biến `VITE_WEB_ORIGIN` (phụ thuộc Q-29; dùng ở `mvp-quang-cao`, `mvp-tai-khoan`) |

`src/audio/clipSource.ts`:

```ts
/** Đổi đường dẫn clip trong manifest thành URL phát được. */
export async function resolveClipUrl(path: string, opts: { native: boolean; bundled: boolean; base: string; caches?: CacheStorage }): Promise<string | null>
```

- Web: trả `base + path` (service worker lo phần offline) — giữ nguyên hành vi.
- App, giọng `bundled`: trả `base + path`.
- App, giọng không `bundled`: tìm trong Cache Storage; có thì `URL.createObjectURL(blob)` (thu hồi URL cũ khi phát xong);
  không có thì `null` → `Speaker` coi như không có file (dùng giọng mặc định / bỏ qua).
- `Speaker.say` đang dùng đường dẫn đồng bộ; đổi `SpeakerBackend.playFile` để nhận URL đã giải quyết trước khi phát (ít đụng
  nhất: `Speaker` gọi `resolveClipUrl` rồi mới `playFile`). Unit test trong `speaker.test.ts` + `clipSource.test.ts`.

`src/audio/index.ts`: `if (navigator.onLine && !isNativeApp()) warmAudioCache(...)` (Yêu cầu 2.3).

## 5. Âm thanh và vòng đời app

- **Tự phát:** Capacitor đã đặt `setMediaPlaybackRequiresUserGesture(false)` (`Bridge.java:528`), nên `autoRead` phát được
  không cần chạm. Không cần code thêm; checklist máy thật kiểm.
- **Không có `speechSynthesis`:** `browserBackend.ts:11` đã xử lý `synth` vắng → `speakSystem` trả `false` → `Speaker` bỏ qua
  đoạn đó (CC-10). Thêm kiểm tra `tools/tts`/test nội dung: mọi câu trong `phrases.ts` và mọi thẻ của bộ bài đều có file trong
  giọng mặc định (chạy khi manifest không rỗng).
- **Vào nền:** `src/native/lifecycle.ts` nghe `App.addListener('pause')` và `document.visibilitychange` (cả web cũng nên dừng
  khi ẩn tab, nên phần nghe `visibilitychange` đặt ở `App.vue`, dùng chung): `speaker.stop()`, phát sự kiện `app-hidden` để
  `RainView` tạm dừng (`paused: () => …` đã có chỗ ở `RainView.vue:117`). Ra lại thì **không** tự chơi tiếp: hiện nút
  "Chơi tiếp" (trẻ cần thời gian nhìn lại màn).

## 6. Bàn phím và bộ gõ

- **Co màn khi bàn phím bật (CC-6):** `adjustResize` + edge-to-edge. Với WebView ≥ 108, `interactive-widget=resizes-content`
  (`index.html:7`) làm viewport co theo bàn phím. Kiểm trên Android 7 (WebView cũ), 13, 15, 16. Nếu Android 15/16 vẫn che ô
  gõ: thêm `@capacitor/keyboard`, nghe `keyboardWillShow` để đặt biến CSS `--kb-height` cho vùng chơi (cần hỏi thêm thư viện).
- **Composition theo ngôn ngữ (Yêu cầu 4.3):** Gboard dùng composition cả khi gõ chữ Latin (gạch chân từ đang gõ), nên quy tắc
  hiện tại `if (composing) return` (`RainView.vue:142`) làm từ tiếng Anh chỉ được chấm khi bấm dấu cách / OK. Đổi thành hàm
  thuần trong `RainGame.ts` hoặc file luật riêng:

  ```ts
  /** Bộ gõ đang soạn chữ có nên chặn chấm không. Chỉ tiếng Nhật: chữ đang soạn có thể còn đổi (かな → 漢字). */
  export function blocksWhileComposing(termLang: SpeechLang, mode: RainMode): boolean
  ```

  Chế độ "Nghĩa tiếng Việt" gõ tiếng Việt (Telex của Gboard cũng dùng composition) → không chặn. Unit test đủ bảng
  ngôn ngữ × chế độ.
- **Xoá ô sau khi trúng (Yêu cầu 4.4):** gán `typed = ''` giữa lúc bộ gõ đang soạn làm Gboard chèn lại chữ cũ. Cách làm: khi
  trúng trong lúc composing, `input.blur()` rồi `input.focus()` ở khung hình kế tiếp (kết thúc phiên soạn chữ), sau đó mới
  xoá. Không test được bằng jsdom → E2E web phủ luồng chung, checklist máy thật phủ Gboard.
- Giữ nguyên `autocomplete/autocorrect/spellcheck` đã tắt và `lang` theo bộ bài (Gboard đổi bàn phím theo `lang` không ổn định;
  hướng dẫn người thử bật bàn phím Nhật trong Gboard).

## 7. Nút Back

`src/native/backButton.ts`:

```ts
export type BackAction = 'close-dialog' | 'confirm-quit-game' | 'go' | 'exit-app';
/** Luật nút Back (CC-11). Thuần, có unit test cho mọi màn. */
export function backAction(state: { screen: Screen; dialogOpen: boolean; inGame: boolean }): { action: BackAction; to?: Screen }
```

| Màn | Back |
|---|---|
| Hộp thoại đang mở | Đóng hộp thoại |
| `match`, `rain` đang chơi | Tạm dừng + hỏi "Thoát ván này?" (CC-11) |
| `match`, `rain` đã xong | Về `island` |
| `island`, `settings` | Về `home` |
| `home` | `App.exitApp()` |

`App.vue` đưa `screen` và trạng thái hộp thoại cho hàm này qua một `provide/inject` nhỏ; `setupNative()` gắn
`App.addListener('backButton', …)`. Hộp thoại "Thoát ván này?" là component dùng chung, chữ tiếng Việt, được đọc to
(nguyên tắc "nghe thay vì đọc": `viSegment`). Bản web không gắn listener (Yêu cầu 6.3).

## 8. Cập nhật app (CC-12)

- Bản app: `updateReady` không bao giờ bật (không có service worker); banner trong `App.vue` vì vậy không hiện — thêm unit test
  khẳng định `setupPwa` không được gọi khi `isNativeApp()`.
- Google Play tự cập nhật. Dữ liệu (`localStorage` khoá `tomo.settings.v1`, Cache Storage) nằm ở origin `https://localhost`
  của app, giữ nguyên khi cài đè cùng `appId` + cùng khoá ký (Play App Signing đảm bảo khoá ký không đổi).
- Không dùng live update (tải web mới qua mạng) trong MVP.

## 9. Google Play: ký, thử nghiệm, hồ sơ, Families

### 9.1. Ký (CC-8)

1. Chủ sản phẩm chạy `keytool -genkeypair -v -keystore tomo-upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000`
   **ngoài repo**; cất file + mật khẩu ở trình quản lý mật khẩu và một bản sao ngoại tuyến.
2. Lần tải AAB đầu tiên: Play Console đăng ký app vào Play App Signing với khoá ký do Google tạo.
3. GitHub Secrets: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.
4. Mất upload key: tạo khoá mới, xuất PEM, xin "upload key reset" trong Play Console (vài ngày).

### 9.2. Kênh thử (CC-16, CC-17)

Internal testing → link mời → người thử cài từ Play. Data safety chưa bắt buộc ở internal testing, nhưng điền sẵn để lên
closed test không bị chặn. Tài khoản cá nhân: closed test ≥ 12 người × 14 ngày trước production.

### 9.3. Hồ sơ cửa hàng

| Mục | Nội dung / nguồn |
|---|---|
| Tên, mô tả ngắn (≤ 80), mô tả dài (≤ 4000) | Tiếng Việt; mô tả dài có dòng ghi công `VOICEVOX:<tên>` lấy từ manifest âm thanh |
| Icon 512×512, ảnh tính năng 1024×500 | Sinh từ `apps/game/resources/` (CC-13) |
| Ảnh chụp | ≥ 2 ảnh điện thoại; chụp bằng Playwright khổ điện thoại (`apps/game/test-results/`) hoặc máy thật |
| Phân loại nội dung | Bảng câu hỏi IARC: không bạo lực, không mua bán ngoài (mua trong app có khi `mvp-mua-ban` xong) |
| Nhóm tuổi | CC-18 |
| Data safety | Bảng nháp ở `docs/mobile-app.md`; bản app thuần (spec này) không gửi dữ liệu nào ra ngoài; tài khoản / mua / quảng cáo bổ sung theo spec của chúng |
| Chính sách quyền riêng tư | CC-19 |
| Xoá tài khoản | Bắt buộc khi `mvp-tai-khoan` cho tạo tài khoản: nút trong app + link web |
| Quảng cáo | Khai "có quảng cáo" khi build có `ADS_ENABLED=true` |

### 9.4. Ràng buộc Families cho các spec khác (khi CC-18 chọn có nhóm trẻ em)

| Spec | Ràng buộc |
|---|---|
| `mvp-quang-cao` | Chỉ SDK quảng cáo trong danh sách Families Self-Certified (AdMob có); với trẻ / người chưa rõ tuổi: không cá nhân hoá, gắn cờ `tagForChildDirectedTreatment` / `maxAdContentRating`; không quảng cáo toàn màn hình lúc mở app; xem lại quyền `AD_ID` (Families: app **chỉ** cho trẻ không khai `AD_ID` khi nhắm API ≥ 33; app hỗn hợp không gửi AAID của trẻ) |
| `mvp-tai-khoan` | Dịch vụ đăng nhập phải cho phép dùng với đối tượng trẻ em; không gửi định danh máy; có xoá tài khoản trong app + web |
| `mvp-mua-ban` | Nút mua ở Góc phụ huynh (kịch bản 10.5); khai "có mua trong app" trên hồ sơ |
| Spec này | Không xin quyền vị trí / danh bạ; app không phải WebView bọc website (nội dung nằm trong AAB) |

## 10. CI (`.github/workflows/android.yml`)

```yaml
on:
  pull_request: { paths: ['apps/game/**', 'packages/content/**', '.github/workflows/android.yml'] }
  workflow_dispatch:
  push: { tags: ['android-v*'] }
jobs:
  android:
    runs-on: ubuntu-latest        # có sẵn Android SDK
    steps:
      - checkout; pnpm/action-setup; setup-node 22 (cache pnpm); pnpm install --frozen-lockfile
      - actions/setup-java@v4 (temurin 21)
      - pnpm --filter @study/game build:app
      - debug (PR): ./gradlew assembleDebug → upload-artifact app-debug.apk (7 ngày)
      - release (dispatch/tag): giải base64 keystore vào $RUNNER_TEMP, đặt ANDROID_* + ANDROID_VERSION_CODE=$((1000+run_number))
        → ./gradlew bundleRelease → node scripts/check-app-size.mjs → upload-artifact app-release.aab
```

- Keystore chỉ ghi vào `$RUNNER_TEMP`, xoá ở bước `always()` cuối; không `echo` biến bí mật.
- Release không chạy trên PR từ fork (secrets không có).
- `ci.yml` hiện có không đổi; job Android tách file để chỉ chạy khi cần.

## 11. Test

| Loại | Phủ gì |
|---|---|
| Unit (Vitest, 100% dòng file đổi) | `platform.ts` (mock `@capacitor/core`), `backAction`, `blocksWhileComposing`, `pickBundledVoices`, `resolveClipUrl` (web / app bundled / app tải thêm có-không có cache), `audio/index.ts` không warm trong app, `main` không gọi `setupPwa` trong app (tách hàm `bootstrap(native)` để test), `lifecycle` (pause → `speaker.stop`), `check-app-size.mjs` |
| E2E web (Playwright, như hiện tại) | Không hồi quy: `play.spec.ts`, `offline.spec.ts` xanh; thêm ca tab ẩn → dừng đọc; Mưa Chữ tiếng Anh chấm ngay khi gõ xong khi có composition giả (gửi `compositionstart` + `input`) |
| Build | `pnpm build` (web) vẫn có `sw.js`; `vite build --mode capacitor` không có `sw.js`, `dist/audio` chỉ có giọng mặc định |
| CI Android | APK debug build được trên PR |
| Máy thật (checklist ở `docs/mobile-app.md`) | Android 7 (hoặc giả lập API 24), 13, 15, 16; máy tính bảng hoặc giả lập ≥ 600 dp: cài từ internal testing, chế độ máy bay lần mở đầu, tự đọc, Gboard かな + romaji + tiếng Anh + Telex, bàn phím không che, xoay, Back từng màn, vào nền / ra nền, cài đè bản mới giữ tiến độ, TalkBack đọc được nút chính |
