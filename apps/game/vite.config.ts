/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // Chạy trong Docker trên Windows: ổ gắn vào container không báo đổi file, phải dò định kỳ (docker-compose.yml).
  server: process.env.VITE_USE_POLLING ? { watch: { usePolling: true, interval: 300 } } : {},
  plugins: [
    vue(),
    VitePWA({
      // Hỏi trước khi cập nhật (src/pwa.ts): không tự tải lại giữa ván chơi.
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Tomo và Quần đảo Tri Thức',
        short_name: 'Tomo',
        description: 'Học tiếng Anh, tiếng Nhật và IT qua trò chơi',
        lang: 'vi',
        theme_color: '#2f6f8f',
        background_color: '#f3f7fa',
        display: 'standalone',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
      workbox: {
        // Toàn bộ game và phông chữ được lưu sẵn để chơi không cần mạng.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,json}'],
        // Âm thanh: không precache (precache không trả lời được yêu cầu Range mà Safari/iOS dùng cho <audio>).
        // Phục vụ bằng CacheFirst có rangeRequests; src/audio/offlineCache.ts tải sẵn khi có mạng.
        runtimeCaching: [
          {
            urlPattern: ({ url }) => /\/audio\/.+\.(m4a|ogg|mp3|wav)$/.test(url.pathname),
            handler: 'CacheFirst',
            options: { cacheName: 'tomo-audio-v1', rangeRequests: true },
          },
        ],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        navigateFallback: 'index.html',
        // Lần cài đầu nắm quyền trang ngay để chơi offline được luôn; bản cập nhật vẫn chờ người chơi đồng ý (không skipWaiting).
        clientsClaim: true,
      },
    }),
  ],
  build: {
    chunkSizeWarningLimit: 2000,
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
    coverage: {
      include: ['src/**/*.{ts,vue}'],
      exclude: ['src/**/*.test.ts', 'src/env.d.ts'],
    },
  },
});
