import type { AudioManifest } from './speaker';

/** Tên bộ nhớ đệm âm thanh; phải trùng `runtimeCaching` trong vite.config.ts. */
export const AUDIO_CACHE = 'tomo-audio-v1';

/**
 * Tải sẵn mọi file âm thanh trong manifest vào bộ nhớ đệm để chơi không cần mạng.
 *
 * Âm thanh không nằm trong precache của Workbox vì precache không trả lời được yêu cầu Range,
 * mà Safari/iOS tải `<audio>` bằng Range. Thay vào đó service worker phục vụ `audio/` bằng
 * CacheFirst có bật rangeRequests, và hàm này lấp đầy bộ nhớ đệm đó khi có mạng.
 * Trả về số file vừa tải thêm.
 */
export async function warmAudioCache(
  manifest: AudioManifest,
  baseUrl: string,
  cacheStorage: CacheStorage | undefined = globalThis.caches,
  batchSize = 8,
): Promise<number> {
  if (!cacheStorage) return 0;
  const urls = [...new Set(Object.values(manifest.clips).flatMap((clips) => Object.values(clips)))].map(
    (path) => baseUrl + path,
  );
  if (urls.length === 0) return 0;
  const cache = await cacheStorage.open(AUDIO_CACHE);
  // Dọn file không còn trong manifest (câu đã sửa / giọng đã đổi thì tên file đổi theo).
  const wanted = new Set(urls.map((u) => new URL(u, location.href).href));
  for (const req of await cache.keys()) if (!wanted.has(req.url)) await cache.delete(req);
  const missing: string[] = [];
  for (const url of urls) if (!(await cache.match(url))) missing.push(url);
  let added = 0;
  for (let i = 0; i < missing.length; i += batchSize) {
    const batch = missing.slice(i, i + batchSize);
    const results = await Promise.allSettled(batch.map((url) => cache.add(url)));
    added += results.filter((r) => r.status === 'fulfilled').length;
  }
  return added;
}
