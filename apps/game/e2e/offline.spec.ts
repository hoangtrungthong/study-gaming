import { expect, test } from '@playwright/test';
import { muteSpeech } from './helpers';

test('Chơi được khi mất mạng sau lần mở đầu tiên', async ({ page, context }) => {
  await muteSpeech(page);
  await page.goto('/');
  // Chờ service worker cài xong và nắm quyền trang.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise<void>((resolve) =>
        navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true }),
      );
    }
  });

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Tomo và Quần đảo Tri Thức' })).toBeVisible();

  // Mưa Chữ tải cảnh Phaser theo kiểu lazy: phải có sẵn trong bộ nhớ đệm.
  await page.getByTestId('island-ja').click();
  await page.getByTestId('play-rain').click();
  await page.getByTestId('rain-start').click();
  await expect(page.getByTestId('rain-sky').locator('canvas')).toBeVisible();
  await expect(page.getByTestId('rain-drops').locator('li').first()).toBeAttached();

  const fontsOk = await page.evaluate(async () => {
    await document.fonts.ready;
    return document.fonts.check('16px "Noto Sans JP"', 'ねこ');
  });
  expect(fontsOk).toBe(true);

  // Vẽ Kana: chunk của trò và dữ liệu nét (kana-strokes.json) đều tải lazy, phải có sẵn khi mất mạng.
  await page.locator('.back').click();
  await page.getByTestId('play-kana').click();
  await expect(page.getByTestId('kana-board')).toBeVisible();
  await expect(page.getByTestId('kana-char')).not.toBeEmpty();
  await context.setOffline(false);
});
