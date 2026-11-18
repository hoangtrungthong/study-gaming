import { expect, test } from '@playwright/test';
import { findItem, muteSpeech, shot, typedAnswer } from './helpers';

test.beforeEach(async ({ page }) => {
  await muteSpeech(page);
});

test('Ghép Đôi: ghép hết các cặp thì hiện kết quả 3 sao và thẻ kiến thức song ngữ', async ({ page }, info) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Tomo và Quần đảo Tri Thức' })).toBeVisible();
  await shot(page, info, 'home');

  await page.getByTestId('island-en').click();
  await page.getByTestId('play-match').click();

  const left = page.locator('[data-testid^="left-"]');
  await expect(left).toHaveCount(4); // nhóm Chồi mặc định: 4 cặp
  const ids = await left.evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')!.slice('left-'.length)));

  await page.getByTestId(`left-${ids[0]}`).click();
  await page.getByTestId(`right-${ids[0]}`).click();
  const card = page.getByTestId('knowledge-card');
  await expect(card).toContainText(findItem('en', ids[0]!).meaningVi);
  await shot(page, info, 'match-card');

  for (const id of ids.slice(1)) {
    await page.getByTestId(`left-${id}`).click();
    await page.getByTestId(`right-${id}`).click();
  }
  const result = page.getByTestId('result');
  await expect(result).toBeVisible();
  await expect(result.getByLabel('3 trên 3 sao')).toBeVisible();
});

test('Ghép Đôi: ghép sai thì không được tính và bị trừ sao', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('island-it').click();
  await page.getByTestId('play-match').click();
  const ids = await page
    .locator('[data-testid^="left-"]')
    .evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')!.slice('left-'.length)));

  await page.getByTestId(`left-${ids[0]}`).click();
  await page.getByTestId(`right-${ids[1]}`).click();
  await expect(page.getByTestId(`right-${ids[1]}`)).toBeEnabled();
  // Ghép sai không bỏ chọn bên trái: chạm tiếp nghĩa đúng là được.
  await expect(page.getByTestId(`left-${ids[0]}`)).toHaveClass(/selected/);
  await page.getByTestId(`right-${ids[0]}`).click();

  for (const id of ids.slice(1)) {
    await page.getByTestId(`left-${id}`).click();
    await page.getByTestId(`right-${id}`).click();
  }
  await expect(page.getByTestId('result').getByLabel('2 trên 3 sao')).toBeVisible();
});

for (const subject of ['ja', 'en'] as const) {
  test(`Mưa Chữ (${subject}): gõ đúng từ trên hạt mưa thì được điểm`, async ({ page }, info) => {
    await page.goto('/');
    await page.getByTestId(`island-${subject}`).click();
    await page.getByTestId('play-rain').click();
    await page.getByTestId('rain-start').click();

    const drop = page.getByTestId('rain-drops').locator('li').first();
    await expect(drop).toBeAttached();
    const id = (await drop.getAttribute('data-item-id'))!;
    await shot(page, info, `rain-${subject}`);

    const input = page.getByTestId('rain-input');
    await input.pressSequentially(typedAnswer(subject, findItem(subject, id)), { delay: 20 });
    await expect(page.getByTestId('rain-score')).toHaveText('1');
    await expect(input).toHaveValue('');
  });
}

test('Cài đặt: chọn nhóm Mầm thì Ghép Đôi chỉ còn 3 cặp', async ({ page }, info) => {
  await page.goto('/');
  await page.getByTestId('open-settings').click();
  await page.getByTestId('age-mam').click();
  await expect(page.getByTestId('age-mam')).toHaveAttribute('aria-pressed', 'true');
  await shot(page, info, 'settings');
  await page.getByRole('button', { name: '← Xong' }).click();
  await page.getByTestId('island-ja').click();
  await page.getByTestId('play-match').click();
  await expect(page.locator('[data-testid^="left-"]')).toHaveCount(3);
});
