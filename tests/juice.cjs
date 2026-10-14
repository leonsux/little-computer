const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

(async () => {
  fs.mkdirSync('.tmp/juice-game', { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
    const errors = [], external = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (/^https?:/.test(request.url())) external.push(request.url()); });
    await page.goto(pathToFileURL(path.resolve('index.html')).href);
    const enter = () => page.locator('[data-game="juice"]').click();
    const home = () => page.locator('#juice-screen [data-home]').click();
    const fruit = key => page.locator('#juice-fruits [data-fruit="' + key + '"]');
    const count = () => page.evaluate(() => Number(localStorage.getItem('littleComputer.juiceOrders') || 0));
    const order = () => page.locator('#juice-recipe > span').evaluateAll(nodes => nodes.map(node => node.dataset.fruit));
    const settle = () => page.waitForTimeout(1600);
    await enter();
    await page.locator('[data-demo-panel="juice"] [data-close-demo]').click();
    await fruit('apple').hover();
    assert.equal(await page.locator('.juice-chunk').count(), 0, 'Hover does not add fruit');
    const button = await fruit('apple').boundingBox();
    await page.mouse.move(button.x + 20, button.y + 20); await page.mouse.down();
    assert.equal(await page.locator('.juice-chunk').count(), 0, 'Holding does not add fruit');
    await page.mouse.move(1, 1); await page.mouse.up();
    assert.equal(await page.locator('.juice-chunk').count(), 0, 'Cancelled click does not add fruit');
    assert.ok(await page.locator('#juice-mix').isDisabled());
    assert.ok(await page.locator('#juice-serve').isDisabled());
    await fruit('pear').click(); await page.locator('#juice-mix').click();
    assert.equal(await page.locator('.juice-chunk').count(), 1, 'Wrong fruit is retained');
    assert.ok(await page.locator('#juice-serve').isDisabled()); assert.equal(await count(), 0);
    await page.locator('#juice-undo').click(); await fruit('apple').click();
    assert.ok(await page.locator('#juice-serve').isDisabled(), 'Adding fruit does not mix or serve');
    await page.locator('#juice-mix').click();
    assert.equal(await page.locator('#juice-contents .juice-drink').count(), 1);
    assert.equal(await count(), 0, 'Mixing does not deliver');
    await page.locator('#juice-undo').click();
    assert.ok(await page.locator('#juice-serve').isDisabled(), 'Undo cancels blending');
    assert.equal(await page.locator('#juice-contents .juice-drink').count(), 0);
    await page.locator('#juice-screen [data-replay]').click();
    const expected = [['apple'], ['pear', 'orange'], ['strawberry', 'apple'], ['orange', 'pear', 'strawberry'], ['apple', 'apple', 'pear']];
    const guests = new Set();
    for (let index = 0; index < expected.length; index++) {
      assert.deepEqual(await order(), expected[index]);
      guests.add(await page.locator('#juice-guest use').getAttribute('href'));
      for (const key of [...expected[index]].reverse()) await fruit(key).click();
      assert.equal(await page.locator('#juice-recipe .is-done').count(), expected[index].length, 'Order is matched without an order requirement');
      assert.ok(await fruit('apple').isDisabled(), 'Cup cannot overfill');
      await page.locator('#juice-mix').click();
      if (index === 3) await page.screenshot({ path: '.tmp/juice-game/mixed-desktop.png', fullPage: true });
      await page.locator('#juice-serve').click();
      await page.locator('#juice-serve').dispatchEvent('click');
      assert.equal(await count(), index + 1, 'Repeated delivery is locked');
      assert.equal(await page.locator('.juice-gift').count(), index + 1);
      await settle();
    }
    assert.equal(guests.size, 4); assert.deepEqual(await order(), expected[0]);
    assert.equal(await page.locator('.juice-gift').count(), 0, 'New round starts a new shelf');
    await home(); assert.equal(await page.locator('[data-game="juice"]').evaluate(node => node === document.activeElement), true);
    for (const width of [1920, 1366, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 900 }); await enter();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      assert.ok(await page.locator('#juice-screen header button, #juice-screen footer button, #juice-fruits button, #juice-mix, #juice-undo, #juice-serve').evaluateAll(nodes => nodes.every(node => { const r = node.getBoundingClientRect(); return r.width >= 99 && r.height >= 79 && r.left >= -1 && r.right <= innerWidth + 1; })), 'Controls remain large and inside the viewport at ' + width);
      await home();
    }
    await page.setViewportSize({ width: 320, height: 900 }); await enter();
    for (let index = 0; index < 5; index++) {
      for (const key of await order()) await fruit(key).click();
      await page.locator('#juice-mix').click();
      if (index === 4) await page.screenshot({ path: '.tmp/juice-game/mixed-narrow.png', fullPage: true });
      await page.locator('#juice-serve').click(); await settle();
    }
    assert.equal(await count(), 10);
    await fruit('apple').focus(); await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'juice-mix');
    await page.keyboard.press('Space'); assert.equal(await page.evaluate(() => document.activeElement.id), 'juice-serve');
    await page.keyboard.press('Enter'); await home(); await settle();
    assert.ok(await page.locator('#home-screen').isVisible()); assert.ok(await page.locator('#level-transition').isHidden());
    await enter(); await fruit('apple').click(); await page.locator('#juice-mix').click(); await page.locator('#juice-serve').click();
    await page.locator('#juice-screen [data-replay]').click(); await settle();
    assert.deepEqual(await order(), expected[0]); assert.equal(await page.locator('.juice-gift').count(), 0); assert.equal(await page.locator('.juice-chunk').count(), 0);
    await page.locator('#juice-screen [data-demo]').click(); await page.waitForTimeout(250);
    assert.equal(await page.locator('.juice-chunk').count(), 0); assert.equal(await count(), 12);
    await page.locator('#juice-screen [data-sound]').click(); await home(); await enter();
    assert.equal(await page.locator('#juice-screen [data-sound]').textContent(), '声音：关');
    await page.evaluate(() => { window.showScreen('parent'); refreshParentPage(); });
    assert.equal(await page.locator('#stat-juice-orders').textContent(), '12');
    await page.locator('#parent-screen [data-home]').click();
    const fallback = await browser.newPage({ viewport: { width: 320, height: 900 }, reducedMotion: 'reduce' });
    fallback.on('pageerror', error => errors.push(error.message));
    await fallback.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', { get() { throw new Error('unavailable'); } });
      window.AudioContext = undefined; window.webkitAudioContext = undefined;
    });
    await fallback.goto(pathToFileURL(path.resolve('index.html')).href); await fallback.locator('[data-game="juice"]').click();
    await fallback.locator('#juice-fruits [data-fruit="apple"]').click(); await fallback.locator('#juice-mix').click(); await fallback.locator('#juice-serve').click();
    await fallback.waitForTimeout(1600); assert.equal(await fallback.locator('#juice-level').textContent(), '两种水果的相遇');
    assert.deepEqual(errors, []); assert.deepEqual(external, []);
    console.log('PASS juice: five orders, unordered fruit counts, wrong ingredients/undo, explicit mixing and serving, repeat lock, desktop/narrow clicks, keyboard, lifecycle, demo, shared mute, records, optional storage/audio, reduced motion and offline.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
