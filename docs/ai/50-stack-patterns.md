# study-gaming: Mẫu dùng thư viện

> Viết ngày 2026-11-17. Phiên bản: Vue 3.5, Phaser 4.2, Vite 8, vite-plugin-pwa 2, Vitest 5, Playwright 1.65,
> TypeScript 6.0, wanakana 5.3 (`apps/game/package.json`, `packages/content/package.json`).

## Phaser 4

- Import: `import * as Phaser from 'phaser'` (gói chỉ có ESM named exports).
- Tải lazy: `RainView.vue` gọi `await import('./RainScene')` khi bắt đầu, nên trang chủ không phải tải ~1,4 MB Phaser.
  Sau `await` phải kiểm component còn sống (`unmounted`, `phase`, `playArea`) trước khi dựng cảnh.
- Canvas sắc nét: kích thước = CSS × `devicePixelRatio` (tối đa 3), hiển thị `zoom: 1 / ratio`, `Scale.NONE`,
  tự `resize` bằng `ResizeObserver` (`startRainScene`, `RainScene.ts:138`). Mọi kích thước vẽ nhân `pixelRatio`.
- Bước thời gian giới hạn 100 ms (`update`) để chuyển tab quay lại hạt mưa không rơi một mạch.
- Cảnh chỉ đọc trạng thái từ `RainController`; luật nằm ở `RainGame`.

## Nhập liệu tiếng Nhật

- Ô gõ là `<input>` HTML (không phải canvas) để bộ gõ của máy hoạt động.
- Không chấm khi đang soạn chữ bằng bộ gõ (`compositionstart` → `composing = true`), chấm ở `compositionend`.
- iOS chỉ bật bàn phím khi `focus()` được gọi đồng bộ trong lần chạm: ô gõ luôn có sẵn trong DOM, `start()` gọi
  `input.focus()` trước mọi `await`.

## wanakana

- Chấm: `toHiragana(text)` (Hepburn) và `toHiragana(text, { IMEMode: true })` + `n` cuối → ん (bộ gõ); nhận cả hai.
- Xem trước: `IMEMode: true`, giữ `n` cuối để gõ tiếp.
- `toHiragana('コーヒー')` cho こうひい nên với かな/カナ tự kéo dài `ー` bằng `expandLongVowels` trước.

## vite-plugin-pwa / Workbox

- `registerType: 'prompt'`, `injectRegister: false`; đăng ký ở `main.ts` qua `registerSW` từ `virtual:pwa-register`,
  bọc trong `src/pwa.ts` để test được.
- `clientsClaim: true`, không `skipWaiting`: lần cài đầu nắm quyền trang ngay, bản cập nhật chờ người chơi bấm Tải lại.
- Âm thanh dùng `runtimeCaching` CacheFirst `rangeRequests: true`, tên cache `tomo-audio-v1` (trùng `AUDIO_CACHE` trong
  `src/audio/offlineCache.ts`). Đổi tên cache thì đổi cả hai.
- Thêm định dạng âm thanh vào `tools/tts/generate.py` (`CLIP_EXTS`) thì thêm vào `urlPattern`; test
  `test_every_clip_format_is_cached_for_offline` sẽ đỏ nếu quên.

## Vitest

- `apps/game/vite.config.ts` → `test.environment: 'jsdom'`, độ phủ tính trên toàn bộ `src/**/*.{ts,vue}`.
- Mock module âm thanh: `vi.hoisted` + `vi.mock('../audio', async () => (await import('../test/audioMock')).createAudioMock())`,
  rồi `await import()` component sau khi mock.
- Phaser: mock `./rain/RainScene`, giữ `RainController` để test tự gọi `game.tick()` và `onEvents()`.
- Hẹn giờ: `vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval'] })`, nhớ `vi.useRealTimers()` ở `afterEach`.

## Playwright

- `apps/game/playwright.config.ts`: build thật (vue-tsc + vite build) rồi `vite preview` cổng 4173, để có service worker.
- Hai project: `desktop` 1280×800 và `phone` (Pixel 7).
- `muteSpeech(page)` thay `speechSynthesis` để test không phụ thuộc máy.
- Kiểm offline: chờ `navigator.serviceWorker.ready` và có `controller`, rồi `context.setOffline(true)` và tải lại.

## Python (tools/tts)

- Chỉ dùng thư viện chuẩn trong phần lõi; bộ đọc nạp lazy trong `vieneu_engine` / `kokoro_engine` / `voicevox_engine`.
- Nén AAC bằng ffmpeg trong PATH hoặc `imageio-ffmpeg`; ghi ra `*.part.m4a` rồi đổi tên.
- Kokoro cần PyTorch: nên để môi trường ảo riêng với VieNeu.
