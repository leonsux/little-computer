
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const output = path.resolve('.tmp/garden-redesign');
const url = pathToFileURL(path.resolve('index.html')).href;
const executablePath = process.env.BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

(async () => {
  const browser = await chromium.launch({ executablePath, headless: true });
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const requests = [];
  page.on('request', (request) => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
  await page.goto(url);
  await page.screenshot({ path: path.join(output, 'home.png'), fullPage: true });
  const visible = (selector) => page.locator(selector).isVisible();
  const count = () => page.locator('.garden-plant.is-done').count();
  const center = async (selector) => {
    const b = await page.locator(selector).boundingBox();
    assert.ok(b, selector + ' is visible');
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  };
  const moveTo = async (selector) => {
    const p = await center(selector);
    await page.mouse.move(p.x, p.y, { steps: 8 });
  };
  const dragTo = async (selector) => {
    const p = await center('#garden-can');
    const t = await center(selector);
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await page.mouse.move(t.x, t.y, { steps: 12 });
    await page.mouse.up();
  };
  await page.locator('[data-game="garden"]').click();
  assert.ok(await visible('#garden-screen'));
  await page.screenshot({ path: path.join(output, 'garden-move.png'), fullPage: true });
  assert.equal(await count(), 0);
  for (let i = 0; i < 3; i++) await moveTo('[data-plant="' + i + '"]');
  assert.equal(await count(), 3, 'Moving over three flowers completes movement');
  assert.ok(await visible('#level-transition'), 'Completion prompt is visible');
  await page.waitForTimeout(900);
  assert.equal(await count(), 3, 'Celebration keeps the completed scene visible');
  await page.waitForTimeout(800);
  assert.equal(await count(), 0);
  await moveTo('[data-plant="1"]');
  await page.waitForTimeout(800);
  assert.equal(await count(), 0, 'Aim only accepts highlighted target');
  await moveTo('[data-plant="0"]');
  await page.waitForTimeout(200);
  await page.mouse.move(5, 5);
  await page.waitForTimeout(800);
  assert.equal(await count(), 0, 'Leaving cancels hold');
  const aim = await center('[data-plant="0"]');
  for (let i = 0; i < 7; i++) {
    await page.mouse.move(aim.x + (i % 2 ? 20 : -20), aim.y);
    await page.waitForTimeout(120);
  }
  assert.equal(await count(), 0, 'Continuous large motion does not count as steady aim');
  await page.mouse.move(5, 5);
  for (let i = 0; i < 3; i++) {
    await moveTo('[data-plant="' + i + '"]');
    await page.waitForTimeout(800);
    assert.equal(await count(), i + 1);
  }
  await page.waitForTimeout(3100);
  await moveTo('[data-plant="0"]');
  await page.waitForTimeout(800);
  assert.equal(await count(), 0, 'Hover never counts as click');
  await page.locator('[data-plant="2"]').click();
  assert.equal(await count(), 0, 'Out-of-order click does not progress');
  for (let i = 0; i < 3; i++) await page.locator('[data-plant="' + i + '"]').click();
  assert.equal(await count(), 3);
  await page.waitForTimeout(3100);
  await page.screenshot({ path: path.join(output, 'garden-drag.png'), fullPage: true });
  await page.locator('#garden-can').click();
  assert.equal(await count(), 0, 'Clicking a can does not count as dragging');
  const origin = await center('#garden-can');
  await page.mouse.move(origin.x, origin.y);
  await page.mouse.down();
  await page.mouse.move(origin.x + 35, origin.y + 10);
  await page.mouse.up();
  assert.equal(await count(), 0, 'Missed drop does not progress');
  assert.deepEqual(await center('#garden-can'), origin, 'Missed drop returns can');
  await dragTo('[data-plant="2"] .plant-pot');
  assert.equal(await count(), 0, 'Wrong pot does not progress');
  await page.mouse.move(origin.x, origin.y);
  await page.mouse.down();
  await page.mouse.move(origin.x + 70, origin.y - 30);
  await page.locator('#garden-can').dispatchEvent('pointercancel');
  await page.mouse.up();
  assert.equal(await page.locator('#garden-can.is-dragging').count(), 0, 'Pointer cancellation releases drag');
  assert.deepEqual(await center('#garden-can'), origin);
  await dragTo('[data-plant="0"] .plant-pot');
  assert.equal(await count(), 1);
  await page.mouse.move(origin.x, origin.y);
  await page.mouse.down();
  await page.mouse.move(origin.x + 100, origin.y - 30);
  await page.keyboard.press('Escape');
  await page.mouse.up();
  assert.equal(await page.locator('#garden-can.is-dragging').count(), 0);
  assert.equal(await count(), 1, 'Escape preserves previously watered flowers');
  await dragTo('[data-plant="1"] .plant-pot');
  await dragTo('[data-plant="2"] .plant-pot');
  assert.equal(await count(), 3);
  assert.equal(await page.evaluate(() => localStorage.getItem('littleComputer.gardenRounds')), '1');
  assert.match(await page.locator('#garden-feedback').textContent(), /小花园开花/);
  await page.screenshot({ path: path.join(output, 'garden-finish.png'), fullPage: true });
  await page.waitForTimeout(3100);
  assert.equal(await count(), 0, 'Final step automatically starts a new round');
  assert.equal(await page.evaluate(() => localStorage.getItem('littleComputer.gardenRounds')), '1', 'No duplicate completion records');
  await page.locator('[data-garden-step="1"]').click();
  await moveTo('[data-plant="0"]');
  await page.locator('#garden-screen [data-home]').click();
  await page.waitForTimeout(800);
  assert.equal(await count(), 0, 'Exit cancels pending hold');
  await page.locator('[data-game="garden"]').click();
  await page.locator('#garden-sound').click();
  assert.equal(await page.locator('#garden-sound').getAttribute('aria-pressed'), 'false');
  await page.locator('[data-garden-step="3"]').click();
  await page.keyboard.press('Tab');
  await page.locator('#garden-can').focus();
  await page.keyboard.press('Space');
  const kFrom = await center('#garden-can');
  const kTo = await center('[data-plant="0"] .plant-pot');
  for (let i = 0; i < Math.round(Math.abs(kTo.x - kFrom.x) / 24); i++) await page.keyboard.press(kTo.x >= kFrom.x ? 'ArrowRight' : 'ArrowLeft');
  for (let i = 0; i < Math.round(Math.abs(kTo.y - kFrom.y) / 24); i++) await page.keyboard.press(kTo.y >= kFrom.y ? 'ArrowDown' : 'ArrowUp');
  await page.keyboard.press('Space');
  assert.equal(await count(), 1, 'Keyboard grab, move and release waters a flower');
  await page.locator('#garden-can').focus();
  await page.keyboard.press('Space');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#garden-can.is-dragging').count(), 0);
  await page.locator('#garden-replay').click();
  await page.keyboard.press('Tab');
  for (let i = 0; i < 3; i++) await page.locator('[data-plant="' + i + '"]').focus();
  assert.equal(await count(), 3, 'Keyboard focus supports movement practice');
  await page.waitForTimeout(3100);
  await page.waitForTimeout(800);
  for (let i = 1; i < 3; i++) {
    await page.locator('[data-plant="' + i + '"]').focus();
    await page.waitForTimeout(800);
  }
  assert.equal(await count(), 3, 'Keyboard focus supports steady aim');
  await page.waitForTimeout(3100);
  assert.equal(await count(), 0, 'Keyboard focus does not bypass click stage');
  for (let i = 0; i < 3; i++) {
    await page.locator('[data-plant="' + i + '"]').focus();
    await page.keyboard.press('Enter');
  }
  assert.equal(await count(), 3, 'Keyboard activation supports click practice');
  await page.waitForTimeout(3100);
  await page.locator('#garden-demonstrate').click();
  await page.waitForTimeout(3400);
  assert.equal(await count(), 0, 'Demonstration never earns progress');
  await page.locator('#garden-screen [data-home]').click();
  for (const [game, screen] of [['stars', 'stars'], ['fruit', 'fruit'], ['drawing', 'drawing']]) {
    await page.locator('[data-game="' + game + '"]').click();
    assert.ok(await visible('#' + screen + '-screen'), game + ' still opens');
    if (game === 'stars') {
      await page.locator('.star-button:not(:disabled)').click();
      assert.equal(await page.locator('#star-count').textContent(), '1');
      await page.waitForTimeout(500);
    }
    if (game === 'drawing') {
      const b = await page.locator('#drawing-canvas').boundingBox();
      await page.mouse.move(b.x + 30, b.y + 30);
      await page.mouse.down();
      await page.mouse.move(b.x + 100, b.y + 100, { steps: 5 });
      await page.mouse.up();
      assert.ok(!(await visible('#drawing-empty')));
    }
    await page.locator('#' + screen + '-screen [data-home]').click();
  }
  await page.locator('[data-parent]').click();
  const nums = (await page.locator('#math-question').textContent()).match(/\d+/g).map(Number);
  const question = await page.locator('#math-question').textContent();
  await page.locator('#math-answer').fill(String(question.includes('+') ? nums[0] + nums[1] : nums[0] - nums[1]));
  await page.locator('[data-submit-parent]').click();
  assert.ok(await visible('#parent-screen'));
  assert.equal(await page.locator('#stat-garden-rounds').textContent(), '1');
  await page.locator('#parent-screen [data-home]').click();
  for (const [width, height] of [[1920, 1080], [1440, 900], [768, 1024], [390, 844], [320, 740]]) {
    await page.setViewportSize({ width, height });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Home fits ' + width);
    await page.locator('[data-game="garden"]').click();
    await page.locator('[data-garden-step="3"]').click();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Garden fits ' + width);
    for (const p of await page.locator('.garden-plant').all()) {
      const b = await p.boundingBox();
      assert.ok(b.width >= 100 && b.height >= 80, 'Target size stays usable');
    }
    if (width === 390) await page.screenshot({ path: path.join(output, 'garden-mobile.png'), fullPage: true });
    await page.locator('#garden-screen [data-home]').click();
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.locator('[data-game="garden"]').click();
  assert.equal(await page.locator('.demo-pointer').evaluate((el) => getComputedStyle(el).animationName), 'none');
  assert.deepEqual(requests, [], 'All assets load offline');
  assert.deepEqual(errors, [], 'No page errors');
  console.log('PASS: four mouse stages, failed/wrong drops, cancellation, replay, keyboard drag, mute, legacy navigation/drawing/click, parent stats, five viewport sizes, reduced motion, offline loading.');
  await browser.close();
})().catch((error) => { console.error(error); process.exit(1); });
