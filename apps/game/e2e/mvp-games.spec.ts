import { expect, test, type Page } from '@playwright/test';
import {
  decks,
  findKana,
  isWall,
  islandContent,
  levelMaze,
  levelSentences,
  loadKanaStrokes,
  parseMaze,
  runMaze,
  type Block,
  type BlockKind,
  type Dir,
  type LearnItem,
  type MazeMap,
  type Subject,
} from '@study/content';
import { currentSpeech, findItem, muteSpeech, shot, typedAnswer } from './helpers';

// Chặn service worker để bản kê âm thanh dưới đây luôn trống: mọi câu đọc đi qua giọng giả của `muteSpeech`.
test.use({ serviceWorkers: 'block' });

test.beforeEach(async ({ page }) => {
  await muteSpeech(page);
  await page.route('**/audio/manifest.json', (route) => route.fulfill({ json: { voices: [], clips: {} } }));
});

async function openGame(page: Page, subject: Subject, game: string): Promise<void> {
  await page.goto('/');
  await page.getByTestId(`island-${subject}`).click();
  await page.getByTestId(`play-${game}`).click();
}

/** Câu đọc của một từ (giống `termSegment`): tiếng Nhật đọc cách đọc かな. */
const spokenOf = (item: LearnItem) => item.reading ?? item.term;

/** Từ Tomo đang đọc làm đề, trong số `candidates` (đề chỉ cho nghe, không hiện chữ). */
async function heardItem(page: Page, subject: Subject, candidates: readonly LearnItem[]): Promise<LearnItem> {
  const lang = decks[subject].termLang;
  let found: LearnItem | undefined;
  await expect
    .poll(async () => {
      const said = (await currentSpeech(page)).filter((s) => s.lang === lang).map((s) => s.text);
      found = candidates.find((item) => said.includes(spokenOf(item)));
      return found?.id;
    })
    .toBeTruthy();
  return found!;
}

async function testIds(page: Page, prefix: string): Promise<string[]> {
  return page
    .locator(`[data-testid^="${prefix}"]`)
    .evaluateAll((els, p) => els.map((e) => e.getAttribute('data-testid')!.slice(p.length)), prefix);
}

// ---------- G2 Hứng Sao ----------

/** Từ đúng của đề đang hiện: nghĩa tiếng Việt trên đề (sao sai không trùng nghĩa với đề). */
async function starAnswer(page: Page, subject: Subject): Promise<LearnItem> {
  const meaning = (await page.getByTestId('star-prompt').locator('span').nth(1).textContent())!.trim();
  const item = decks[subject].items.find((i) => i.meaningVi === meaning);
  if (!item) throw new Error(`Không có từ nghĩa "${meaning}"`);
  return item;
}

/** Hứng sao bằng nút trợ năng (bàn phím): nút ẩn khỏi mắt nhưng focus và Enter được. */
async function catchStar(page: Page, id: string): Promise<void> {
  await page.getByTestId(`star-catch-${id}`).press('Enter');
}

async function playStar(page: Page, subject: Subject, wrongInRound?: number): Promise<void> {
  await page.getByTestId('star-start').click();
  await expect(page.getByTestId('star-sky').locator('canvas')).toBeVisible();
  const rounds = 8; // nhóm Chồi
  for (let round = 1; round <= rounds; round++) {
    await expect(page.getByText(`⭐ ${round}/${rounds}`)).toBeVisible();
    const answer = await starAnswer(page, subject);
    await expect(page.getByTestId(`star-catch-${answer.id}`)).toBeAttached();
    if (round === wrongInRound) {
      const falling = page.getByTestId('star-falling').locator('li');
      await expect(falling).toHaveCount(3); // 1 sao đúng + 2 sao sai
      const ids = await falling.evaluateAll((els) => els.map((e) => e.getAttribute('data-item-id')!));
      const wrong = ids.find((id) => id !== answer.id)!;
      await catchStar(page, wrong);
      // Sao sai biến mất, đề không đổi.
      await expect(page.getByTestId(`star-catch-${wrong}`)).toHaveCount(0);
      await expect(falling).toHaveCount(2);
      await expect(page.getByText(`⭐ ${round}/${rounds}`)).toBeVisible();
    }
    await catchStar(page, answer.id);
  }
}

// ---------- W1 Viết Lại Từ ----------

/** Gõ đúng hết các từ của Viết Lại Từ; `mistakeAt`: gõ một từ khác trước ở lượt đó. */
async function playWrite(page: Page, subject: Subject, mistakeAt?: number): Promise<void> {
  // Số lượt: tối đa WRITE_ROUNDS của nhóm Chồi, ít hơn khi lượt chính chỉ gặp ít từ mới (App chỉ hỏi từ vừa gặp).
  const progress = page.getByText(/^1\/\d+$/);
  await expect(progress).toBeVisible();
  const rounds = Number((await progress.textContent())!.split('/')[1]);
  expect(rounds).toBeGreaterThan(0);
  const input = page.getByTestId('write-input');
  for (let round = 1; round <= rounds; round++) {
    await expect(page.getByText(`${round}/${rounds}`, { exact: true })).toBeVisible();
    const item = await heardItem(page, subject, decks[subject].items);
    if (round === mistakeAt) {
      const first = [...spokenOf(item)][0];
      const other = decks[subject].items.find((i) => [...spokenOf(i)][0] !== first)!;
      await input.pressSequentially(typedAnswer(subject, other), { delay: 10 });
      await page.getByTestId('write-check').click();
      // Gõ sai: ô chữ đầu báo đỏ, chưa được sang từ sau.
      await expect(page.getByTestId('write-box').first()).toHaveClass(/bad/);
      await expect(page.getByTestId('write-done')).toBeHidden();
      await input.fill('');
    }
    await input.pressSequentially(typedAnswer(subject, item), { delay: 10 });
    await page.getByTestId('write-check').click();
    await expect(page.getByTestId('write-done')).toContainText(item.term);
    await page.getByTestId('write-next').click();
  }
}

test('Hứng Sao (en): hứng đúng mọi sao được 3 sao, rồi "Tiếp: Viết Lại Từ" gõ lại từ mới', async ({ page }, info) => {
  await openGame(page, 'en', 'star');
  await playStar(page, 'en');
  const result = page.getByTestId('result');
  await expect(result.getByLabel('3 trên 3 sao')).toBeVisible();
  await shot(page, info, 'star-result');

  await result.getByTestId('result-next').click();
  await expect(page.getByRole('heading', { name: 'Viết Lại Từ' })).toBeVisible();
  await shot(page, info, 'write-en');
  await playWrite(page, 'en');
  await expect(page.getByTestId('result').getByLabel('3 trên 3 sao')).toBeVisible();
  // Viết Lại Từ là bước cuối của màn: không còn nút "Tiếp".
  await expect(page.getByTestId('result-next')).toHaveCount(0);
});

test('Hứng Sao (ja): hứng nhầm sao sai thì sao đó biến mất, đề giữ nguyên và chỉ còn 2 sao', async ({ page }) => {
  await openGame(page, 'ja', 'star');
  await playStar(page, 'ja', 2);
  await expect(page.getByTestId('result').getByLabel('2 trên 3 sao')).toBeVisible();
});

// ---------- G3 Xếp Câu ----------

type TrayPiece = { index: string; text: string };

async function trayPieces(page: Page): Promise<TrayPiece[]> {
  return page.locator('[data-testid^="sentence-chunk-"]').evaluateAll((els) =>
    els.map((e) => ({
      index: e.getAttribute('data-testid')!.slice('sentence-chunk-'.length),
      text: e.querySelector('.main')!.textContent!,
    })),
  );
}

/** Chạm khối có chữ `text` trong khay rồi chạm chỗ trống `slot`. */
async function placeChunk(page: Page, text: string, slot: number): Promise<void> {
  const piece = (await trayPieces(page)).find((p) => p.text === text)!;
  await page.getByTestId(`sentence-chunk-${piece.index}`).click();
  await page.getByTestId(`sentence-slot-${slot}`).click();
  await expect(page.getByTestId(`sentence-slot-${slot}`).locator('.main')).toHaveText(text);
}

/** Câu đang xếp: nghĩa tiếng Việt trên đề + đúng bộ khối trong khay. */
async function currentSentence(page: Page, subject: Subject) {
  const textVi = (await page.locator('.prompt .vi').textContent())!.trim();
  const tray = (await trayPieces(page)).map((p) => p.text).sort();
  const sentence = levelSentences(subject, islandContent(subject, 'sentence')).find(
    (s) => s.textVi === textVi && JSON.stringify([...s.chunks].sort()) === JSON.stringify(tray),
  );
  if (!sentence) throw new Error(`Không tìm thấy câu "${textVi}"`);
  return sentence;
}

async function playSentence(page: Page, subject: Subject, mistakeAt?: number): Promise<void> {
  const total = 5; // nhóm Chồi
  for (let n = 1; n <= total; n++) {
    await expect(page.getByText(`${n}/${total}`, { exact: true })).toBeVisible();
    const sentence = await currentSentence(page, subject);
    const accepted = [sentence.chunks, ...(sentence.accept ?? [])].map((o) => JSON.stringify(o));
    // Xoay các khối từng bước, lấy thứ tự đầu tiên không được chấp nhận (câu mọi thứ tự đều đúng thì không có).
    const rotations = sentence.chunks.map((_, k) => [...sentence.chunks.slice(k), ...sentence.chunks.slice(0, k)]);
    const wrong = rotations.find((o) => !accepted.includes(JSON.stringify(o)));
    if (n === mistakeAt && !wrong) mistakeAt++; // câu này không xếp sai được: để câu sau
    if (n === mistakeAt && wrong) {
      for (const [slot, text] of wrong.entries()) await placeChunk(page, text, slot);
      await page.getByTestId('sentence-done').click();
      // Câu sai: khối sai chỗ về khay (ít nhất một chỗ trống lại), nút Xong khoá lại, vẫn ở câu này.
      await expect(page.getByLabel(/^Chỗ trống số \d+$/).first()).toBeVisible();
      await expect(page.getByTestId('sentence-done')).toBeDisabled();
      await expect(page.getByText(`${n}/${total}`, { exact: true })).toBeVisible();
    }
    // Thứ tự được chấp nhận khớp với các khối còn nằm trên câu.
    const filled = await page
      .locator('[data-testid^="sentence-slot-"]')
      .evaluateAll((els) => els.map((e) => e.querySelector('.main')?.textContent ?? null));
    const order = [sentence.chunks, ...(sentence.accept ?? [])].find((o) =>
      filled.every((t, i) => t === null || t === o[i]),
    )!;
    for (const [slot, text] of order.entries()) if (filled[slot] === null) await placeChunk(page, text, slot);
    await page.getByTestId('sentence-done').click();
  }
}

test('Xếp Câu (en): xếp đúng mọi câu thì được 3 sao', async ({ page }, info) => {
  await openGame(page, 'en', 'sentence');
  await expect(page.locator('[data-testid^="sentence-chunk-"]').first()).toBeVisible();
  await shot(page, info, 'sentence-en');
  await playSentence(page, 'en');
  await expect(page.getByTestId('result').getByLabel('3 trên 3 sao')).toBeVisible();
  // Màn Xếp Câu đảo Anh không có từ mới: không có bước Viết Lại Từ.
  await expect(page.getByTestId('result-next')).toHaveCount(0);
});

test('Xếp Câu (ja): xếp sai thì khối sai về khay, được làm lại và còn 2 sao', async ({ page }) => {
  await openGame(page, 'ja', 'sentence');
  await playSentence(page, 'ja', 1);
  const result = page.getByTestId('result');
  await expect(result.getByLabel('2 trên 3 sao')).toBeVisible();
  await expect(result.getByTestId('result-next')).toHaveText('Tiếp: Viết Lại Từ');
});

// ---------- G4 Nghe Chọn ----------

async function playListen(page: Page, subject: Subject, mistakeAt?: number): Promise<void> {
  const rounds = 8; // nhóm Chồi
  for (let round = 1; round <= rounds; round++) {
    await expect(page.getByText(`${round}/${rounds}`, { exact: true })).toBeVisible();
    const options = (await testIds(page, 'listen-option-')).map((id) => findItem(subject, id));
    expect(options).toHaveLength(4);
    const answer = await heardItem(page, subject, options);
    if (round === mistakeAt) {
      const wrong = options.find((o) => o.id !== answer.id)!;
      await page.getByTestId(`listen-option-${wrong.id}`).click();
      // Chọn sai: lựa chọn đó bị loại, chưa sang đề sau.
      await expect(page.getByTestId(`listen-option-${wrong.id}`)).toBeDisabled();
      await expect(page.getByTestId(`listen-option-${wrong.id}`)).toHaveClass(/out/);
      await expect(page.getByTestId('listen-next')).toBeHidden();
    }
    await page.getByTestId(`listen-option-${answer.id}`).click();
    await expect(page.getByTestId('knowledge-card')).toContainText(answer.meaningVi);
    await page.getByTestId('listen-next').click();
  }
}

test('Nghe Chọn (en): chọn đúng từ vừa nghe ở mọi đề thì được 3 sao', async ({ page }, info) => {
  await openGame(page, 'en', 'listen');
  await expect(page.locator('[data-testid^="listen-option-"]')).toHaveCount(4);
  await shot(page, info, 'listen-en');
  await playListen(page, 'en');
  await expect(page.getByTestId('result').getByLabel('3 trên 3 sao')).toBeVisible();
});

test('Nghe Chọn (it): chọn sai thì lựa chọn bị loại và còn 2 sao', async ({ page }) => {
  await openGame(page, 'it', 'listen');
  await playListen(page, 'it', 3);
  await expect(page.getByTestId('result').getByLabel('2 trên 3 sao')).toBeVisible();
});

// ---------- G5 Lật Thẻ Nhớ ----------

/** Cặp thẻ (chỉ số) theo từ, đọc mặt trước của thẻ úp: thẻ từ có chữ, thẻ nghĩa có hình + nghĩa. */
async function memoryPairs(page: Page, subject: Subject): Promise<[number, number][]> {
  const faces = await page.locator('[data-testid^="memory-card-"]').evaluateAll((els) =>
    els.map((e) => ({
      term: e.querySelector('.term')?.textContent ?? null,
      meaning: e.querySelector('.meaning')?.textContent ?? null,
    })),
  );
  const idOf = (f: (typeof faces)[number]) =>
    decks[subject].items.find((i) => (f.term !== null ? i.term === f.term : i.meaningVi === f.meaning))!.id;
  const ids = faces.map(idOf);
  return ids.flatMap((id, i) =>
    faces[i]!.term !== null ? [[i, ids.findIndex((x, j) => x === id && j !== i)]] : [],
  ) as [number, number][];
}

async function playMemory(page: Page, subject: Subject, withMistake = false): Promise<void> {
  const cards = page.locator('[data-testid^="memory-card-"]');
  await expect(cards).toHaveCount(12); // nhóm Chồi: 6 cặp
  const pairs = await memoryPairs(page, subject);
  expect(pairs).toHaveLength(6);
  if (withMistake) {
    const [a] = pairs[0]!;
    const [, b] = pairs[1]!;
    await page.getByTestId(`memory-card-${a}`).click();
    await page.getByTestId(`memory-card-${b}`).click();
    await expect(page.getByTestId(`memory-card-${b}`)).toHaveClass(/up/);
    // Lật sai: hai thẻ úp lại, chưa ghép được cặp nào.
    await expect(page.getByTestId(`memory-card-${a}`)).not.toHaveClass(/up/);
    await expect(page.getByTestId(`memory-card-${b}`)).not.toHaveClass(/up/);
    await expect(page.getByText('0/6', { exact: true })).toBeVisible();
  }
  for (const [n, [a, b]] of pairs.entries()) {
    await page.getByTestId(`memory-card-${a}`).click();
    await page.getByTestId(`memory-card-${b}`).click();
    if (n < pairs.length - 1) await expect(page.getByText(`${n + 1}/6`, { exact: true })).toBeVisible();
  }
}

test('Lật Thẻ Nhớ (ja): lật đúng mọi cặp được 3 sao, rồi Viết Lại Từ gõ romaji', async ({ page }, info) => {
  await openGame(page, 'ja', 'memory');
  await playMemory(page, 'ja');
  const result = page.getByTestId('result');
  await expect(result.getByLabel('3 trên 3 sao')).toBeVisible();
  await shot(page, info, 'memory-result');

  await result.getByTestId('result-next').click();
  await expect(page.getByRole('heading', { name: 'Viết Lại Từ' })).toBeVisible();
  await playWrite(page, 'ja');
  await expect(page.getByTestId('result').getByLabel('3 trên 3 sao')).toBeVisible();
  await shot(page, info, 'write-ja-result');
});

test('Lật Thẻ Nhớ (en): lật hai thẻ khác cặp thì cả hai úp lại và còn 2 sao', async ({ page }) => {
  await openGame(page, 'en', 'memory');
  await playMemory(page, 'en', true);
  await expect(page.getByTestId('result').getByLabel('2 trên 3 sao')).toBeVisible();
});

// ---------- W1 Viết Lại Từ (vào thẳng từ đảo) ----------

test('Viết Lại Từ (ja): gõ sai thì ô chữ báo đỏ, gõ lại đúng mới sang từ sau, còn 2 sao', async ({ page }) => {
  await openGame(page, 'ja', 'write');
  await playWrite(page, 'ja', 2);
  await expect(page.getByTestId('result').getByLabel('2 trên 3 sao')).toBeVisible();
});

test('Viết Lại Từ (en): gõ sai một từ thì còn 2 sao', async ({ page }) => {
  await openGame(page, 'en', 'write');
  await playWrite(page, 'en', 1);
  await expect(page.getByTestId('result').getByLabel('2 trên 3 sao')).toBeVisible();
});

// ---------- J1 Vẽ Kana ----------

type Point = [number, number];
const BOX = 109; // khung toạ độ nét của KanjiVG và của bảng vẽ

/** Lấy thưa các điểm của nét mẫu (giữ điểm đầu, điểm cuối). */
function sparse(points: readonly Point[], step = 8): Point[] {
  const out: Point[] = [points[0]!];
  for (const p of points.slice(1, -1)) {
    const last = out.at(-1)!;
    if (Math.hypot(p[0] - last[0], p[1] - last[1]) >= step) out.push(p);
  }
  out.push(points.at(-1)!);
  return out;
}

const nextFrame = (page: Page) => page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => r())));

/** Vẽ một nét lên bảng: chuột trên máy tính, chạm thật (touch) trên điện thoại. */
async function drawStroke(page: Page, points: readonly Point[], touch: boolean): Promise<void> {
  const board = page.getByTestId('kana-board');
  const box = (await board.boundingBox())!;
  const screen = sparse(points).map(([x, y]) => ({
    x: box.x + (x / BOX) * box.width,
    y: box.y + (y / BOX) * box.height,
  }));
  if (touch) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [screen[0]!] });
    for (const p of screen.slice(1)) {
      await nextFrame(page);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [p] });
    }
    await nextFrame(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await cdp.detach();
    return;
  }
  await page.mouse.move(screen[0]!.x, screen[0]!.y);
  await page.mouse.down();
  for (const p of screen.slice(1)) {
    await nextFrame(page);
    await page.mouse.move(p.x, p.y);
  }
  await nextFrame(page);
  await page.mouse.up();
}

async function playKana(page: Page, touch: boolean, mistake = false): Promise<void> {
  const all = await loadKanaStrokes();
  const chars = islandContent('ja', 'kana').kana!;
  const board = page.getByTestId('kana-board');
  // Màn Vẽ Kana vừa khít màn hình điện thoại: thêm chỗ cuộn để phép kiểm "vẽ không cuộn trang" có ý nghĩa
  // (bỏ `touch-action: none` của bảng vẽ thì vuốt trên bảng sẽ cuộn trang).
  if (touch) await page.addStyleTag({ content: 'body { padding-bottom: 100vh; }' });
  await board.scrollIntoViewIfNeeded();
  const scrollY = await page.evaluate(() => window.scrollY);
  for (const [n, char] of chars.entries()) {
    const strokes = findKana(all, char)!.strokes as Point[][];
    await expect(page.getByTestId('kana-char')).toContainText(char);
    for (const [s, stroke] of strokes.entries()) {
      await expect(board).toHaveAttribute('aria-label', `Bảng tô chữ ${char}, nét ${s + 1} trên ${strokes.length}`);
      if (mistake && n === 0 && s === 0) {
        // Vẽ ngược chiều: nét bị từ chối, mũi tên nhấp nháy, vẫn là nét 1.
        await drawStroke(page, [...stroke].reverse(), touch);
        await expect(board.locator('polyline.next')).toHaveClass(/blink/);
        await expect(board).toHaveAttribute('aria-label', `Bảng tô chữ ${char}, nét 1 trên ${strokes.length}`);
      }
      await drawStroke(page, stroke, touch);
      // Vẽ không được cuộn trang.
      expect(await page.evaluate(() => window.scrollY)).toBe(scrollY);
    }
  }
}

test('Vẽ Kana: tô đúng thứ tự nét của mọi chữ thì được 3 sao, trang không cuộn khi vẽ', async ({ page }, info) => {
  test.setTimeout(120_000);
  await openGame(page, 'ja', 'kana');
  await expect(page.locator('.kana')).toHaveAttribute('data-ready', 'true');
  await shot(page, info, 'kana');
  await playKana(page, !!info.project.use.hasTouch);
  await expect(page.getByTestId('result').getByLabel('3 trên 3 sao')).toBeVisible();
});

test('Vẽ Kana: vẽ ngược chiều thì nét bị từ chối và còn 2 sao', async ({ page }, info) => {
  test.setTimeout(120_000);
  await openGame(page, 'ja', 'kana');
  await expect(page.locator('.kana')).toHaveAttribute('data-ready', 'true');
  await playKana(page, !!info.project.use.hasTouch, true);
  await expect(page.getByTestId('result').getByLabel('2 trên 3 sao')).toBeVisible();
});

// ---------- I1 Đưa Bit Về Nhà ----------

const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];

/** Chương trình ngắn nhất chỉ gồm đi tới / rẽ (tìm theo chiều rộng trên ô + hướng). */
function plainSolution(map: MazeMap, kinds: readonly BlockKind[]): BlockKind[] {
  type State = [number, number, Dir];
  const key = ([x, y, d]: State) => `${x},${y},${d}`;
  const start: State = [map.start.x, map.start.y, map.start.dir];
  const prev = new Map<string, { from: string; kind: BlockKind } | null>([[key(start), null]]);
  const queue: State[] = [start];
  while (queue.length > 0) {
    const [x, y, d] = queue.shift()!;
    if (x === map.home.x && y === map.home.y) {
      const out: BlockKind[] = [];
      for (let p = prev.get(key([x, y, d])); p; p = prev.get(p.from)) out.unshift(p.kind);
      return out;
    }
    const next: [State, BlockKind][] = [[[x, y, ((d + 3) % 4) as Dir], 'left']];
    if (kinds.includes('right')) next.push([[x, y, ((d + 1) % 4) as Dir], 'right']);
    if (!isWall(map, x + DX[d]!, y + DY[d]!)) next.push([[x + DX[d]!, y + DY[d]!, d], 'forward']);
    for (const [s, kind] of next) {
      if (prev.has(key(s))) continue;
      prev.set(key(s), { from: key([x, y, d]), kind });
      queue.push(s);
    }
  }
  throw new Error('Mê cung không có lời giải');
}

const asBlocks = (kinds: BlockKind[]) => kinds.map((kind) => ({ kind }) as Block);

async function buildProgram(page: Page, kinds: BlockKind[]): Promise<void> {
  for (const [i, kind] of kinds.entries()) {
    await page.getByTestId(`maze-palette-${kind}`).click();
    await expect(page.getByTestId(`maze-block-${i}`)).toBeVisible();
  }
}

function mazeData() {
  const maze = levelMaze(islandContent('it', 'maze'))!;
  const map = parseMaze(maze);
  const solution = plainSolution(map, maze.blocks);
  expect(runMaze(map, asBlocks(solution)).outcome).toBe('home');
  return { maze, map, solution };
}

test('Đưa Bit Về Nhà: xếp đúng chương trình ngắn nhất, Bit về nhà ngay lần đầu được 3 sao', async ({ page }, info) => {
  const { maze, solution } = mazeData();
  expect(solution.length).toBeLessThanOrEqual(maze.optimal);
  await openGame(page, 'it', 'maze');
  await buildProgram(page, solution);
  await shot(page, info, 'maze-program');
  await page.getByTestId('maze-run').click();
  await expect(page.getByTestId('result').getByLabel('3 trên 3 sao')).toBeVisible();
});

test('Đưa Bit Về Nhà: chương trình đâm vào tường thì khối lỗi bị tô đỏ, sửa xong còn 2 sao', async ({ page }) => {
  const { map, solution } = mazeData();
  // Đi thẳng tới khi đâm tường.
  const wrong: BlockKind[] = [];
  let run = runMaze(map, []);
  while (run.outcome !== 'wall') {
    wrong.push('forward');
    run = runMaze(map, asBlocks(wrong));
  }
  await openGame(page, 'it', 'maze');
  await buildProgram(page, wrong);
  await page.getByTestId('maze-run').click();
  await expect(page.getByTestId(`maze-block-${run.failedAt!.join('-')}`)).toHaveClass(/failed/);
  await expect(page.getByTestId('maze-run')).toBeEnabled();
  await expect(page.getByTestId('result')).toHaveCount(0);

  // Bỏ hết khối rồi xếp lại đúng.
  for (let i = wrong.length - 1; i >= 0; i--) await page.getByTestId(`maze-remove-${i}`).click();
  await expect(page.locator('[data-testid^="maze-block-"]')).toHaveCount(0);
  await buildProgram(page, solution);
  await page.getByTestId('maze-run').click();
  await expect(page.getByTestId('result').getByLabel('2 trên 3 sao')).toBeVisible();
});
