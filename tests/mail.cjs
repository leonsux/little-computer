const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

(async () => {
  fs.mkdirSync('.tmp/mail-game', { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
    const errors = [], external = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (/^https?:/.test(request.url())) external.push(request.url()); });
    await page.goto(pathToFileURL(path.resolve('index.html')).href);
    const enter = () => page.locator('[data-game="mail"]').click();
    const home = () => page.locator('#mail-screen [data-home]').click();
    const replay = () => page.locator('#mail-screen [data-replay]').click();
    const source = key => page.locator('.mail-letter[data-friend="' + key + '"]:not(:disabled)').first();
    const target = key => page.locator('.mail-house[data-friend="' + key + '"]');
    const count = () => page.locator('.mail-letter.is-delivered').count();
    const record = () => page.evaluate(() => Number(localStorage.getItem('littleComputer.mailLetters') || 0));
    const settle = () => page.waitForTimeout(1600);
    async function prepare(element, destination) {
      const a = await element.boundingBox(), b = await destination.boundingBox();
      const min = Math.min(a.y, b.y), max = Math.max(a.y + a.height, b.y + b.height), height = page.viewportSize().height;
      assert.ok(max - min < height - 8, 'Letter and mailbox can be viewed together');
      if (min < 8 || max > height - 8) { await page.evaluate(delta => window.scrollBy(0, delta), (min + max) / 2 - height / 2); await page.waitForTimeout(80); }
      return [await element.boundingBox(), await destination.boundingBox()];
    }
    async function drag(key, to = key, options = {}) {
      const [a, b] = await prepare(source(key), target(to));
      const grabX = a.x + a.width * (options.offCenter ? .15 : .5), grabY = a.y + a.height * (options.offCenter ? .2 : .5);
      const x = b.x + b.width * (options.x ?? .5), y = b.y + b.height * (options.y ?? .5);
      await page.mouse.move(grabX, grabY); await page.mouse.down();
      await page.mouse.move(grabX + x - a.x - a.width / 2, grabY + y - a.y - a.height / 2, { steps: 8 });
      if (options.release !== false) await page.mouse.up();
    }
    await enter();
    await page.locator('[data-demo-panel="mail"] [data-close-demo]').click();
    await source('elephant').hover(); await source('elephant').click();
    assert.equal(await count(), 0, 'Hover and click do not deliver');
    await drag('elephant', 'panda'); assert.equal(await count(), 0, 'Wrong friend refuses mail'); assert.equal(await record(), 0);
    await drag('elephant', 'panda', { release: false }); assert.equal(await page.locator('.mail-house.is-target').count(), 0); await page.mouse.up();
    for (const cancel of ['escape', 'pointercancel', 'capture', 'blur', 'resize', 'scroll']) {
      if (cancel === 'scroll') await page.setViewportSize({ width: 320, height: 600 });
      await drag('elephant', 'elephant', { release: false });
      assert.equal(await count(), 0, 'Holding over target does not deliver');
      assert.equal(await page.locator('.mail-house.is-target').count(), 1);
      if (cancel === 'escape') await page.keyboard.press('Escape');
      if (cancel === 'pointercancel') await source('elephant').dispatchEvent('pointercancel');
      if (cancel === 'capture') await source('elephant').dispatchEvent('lostpointercapture');
      if (cancel === 'blur') await page.evaluate(() => window.dispatchEvent(new Event('blur')));
      if (cancel === 'resize') await page.setViewportSize({ width: 1300, height: 850 });
      if (cancel === 'scroll') { await page.evaluate(() => window.scrollBy(0, 100)); await page.waitForTimeout(80); }
      await page.mouse.up(); assert.equal(await count(), 0); assert.equal(await page.locator('.mail-letter.is-dragging').count(), 0);
      assert.equal(await page.locator('.mail-house.is-target').count(), 0);
      await page.setViewportSize({ width: 1366, height: 900 });
    }
    for (const point of [{x:.5,y:.05},{x:.5,y:.95},{x:.05,y:.5},{x:.95,y:.5},{x:.5,y:.5}]) {
      await replay(); await drag('elephant', 'elephant', { ...point, offCenter: true, release: false });
      assert.equal(await page.locator('.mail-house.is-target').count(), 1, 'Entire mailbox accepts the letter center');
      assert.equal(await count(), 0); await page.mouse.up(); assert.equal(await count(), 1);
      await page.locator('.mail-letter').dispatchEvent('pointerup', { pointerId: 1, clientX: 1, clientY: 1 });
      await settle();
    }
    assert.equal(await record(), 5);
    await replay();
    for (let index = 0; index < 5; index++) {
      assert.equal(await page.locator('.mail-letter').count(), [1,2,3,4,4][index]);
      const keys = await page.locator('.mail-letter').evaluateAll(nodes => nodes.map(node => node.dataset.friend).reverse());
      for (const key of keys) { await drag(key); }
      if (index === 4) {
        assert.equal(await target('giraffe').getAttribute('data-received'), '2', 'Two letters can go to the same mailbox');
        assert.equal(await target('giraffe').locator('.mail-received svg').count(), 2);
        await page.screenshot({ path: '.tmp/mail-game/completed-desktop.png', fullPage: true });
      }
      assert.equal(await count(), keys.length); await settle();
    }
    assert.equal(await record(), 19); assert.equal(await page.locator('#mail-level').textContent(), '第一封问候');
    await home(); assert.equal(await page.locator('[data-game="mail"]').evaluate(node => node === document.activeElement), true);
    for (const width of [1920, 1366, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 900 }); await enter();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No page overflow at ' + width);
      assert.ok(await page.locator('#mail-screen header button, #mail-screen footer button, .mail-letter, .mail-house').evaluateAll(nodes => nodes.every(node => { const r = node.getBoundingClientRect(); return r.width >= 99 && r.height >= 79 && r.left >= -1 && r.right <= innerWidth + 1; })), 'All targets remain large and visible at ' + width);
      await home();
    }
    await page.setViewportSize({ width: 320, height: 900 }); await enter();
    for (let index = 0; index < 5; index++) {
      const keys = await page.locator('.mail-letter').evaluateAll(nodes => nodes.map(node => node.dataset.friend));
      for (const key of keys) await drag(key);
      if (index === 3) { await page.waitForTimeout(350); await page.screenshot({ path: '.tmp/mail-game/completed-narrow.png', fullPage: true }); }
      await settle();
    }
    assert.equal(await record(), 33);
    for (const point of [{x:.5,y:.05},{x:.5,y:.95},{x:.05,y:.5},{x:.95,y:.5}]) {
      await replay(); await drag('elephant', 'elephant', { ...point, release: false });
      assert.equal(await page.locator('.mail-house.is-target').count(), 1, 'Full mailbox target works on narrow screens');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Dragging near an edge does not create page overflow');
      await page.keyboard.press('Escape'); await page.mouse.up(); assert.equal(await count(), 0);
    }
    const element = source('elephant'); const [a,b] = await prepare(element, target('elephant'));
    await element.focus(); await page.keyboard.press('Space');
    const dx = b.x + b.width / 2 - a.x - a.width / 2, dy = b.y + b.height / 2 - a.y - a.height / 2;
    for (let n = 0; n < Math.abs(Math.round(dx / 24)); n++) await page.keyboard.press(dx >= 0 ? 'ArrowRight' : 'ArrowLeft');
    for (let n = 0; n < Math.abs(Math.round(dy / 24)); n++) await page.keyboard.press(dy >= 0 ? 'ArrowDown' : 'ArrowUp');
    assert.equal(await page.locator('.mail-house.is-target').count(), 1); await page.keyboard.press('Space');
    assert.equal(await count(), 1); await home(); await settle(); assert.ok(await page.locator('#level-transition').isHidden());
    await enter(); await drag('elephant'); await replay(); await settle(); assert.equal(await count(), 0); assert.equal(await page.locator('#mail-level').textContent(), '第一封问候');
    await page.locator('#mail-screen [data-demo]').click(); await page.waitForTimeout(250); assert.equal(await count(), 0);
    await page.locator('#mail-screen [data-sound]').click(); await home(); await enter(); assert.equal(await page.locator('#mail-screen [data-sound]').textContent(), '声音：关');
    await page.evaluate(() => { window.showScreen('parent'); refreshParentPage(); }); assert.equal(await page.locator('#stat-mail-letters').textContent(), '35');
    const fallback = await browser.newPage({ viewport: { width: 320, height: 900 }, reducedMotion: 'reduce' });
    fallback.on('pageerror', error => errors.push(error.message));
    await fallback.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new Error('unavailable'); } }); window.AudioContext = undefined; window.webkitAudioContext = undefined; });
    await fallback.goto(pathToFileURL(path.resolve('index.html')).href); await fallback.locator('[data-game="mail"]').click();
    await fallback.locator('[data-demo-panel="mail"] [data-close-demo]').click();
    const fsource = fallback.locator('.mail-letter'), ftarget = fallback.locator('.mail-house[data-friend="elephant"]');
    await fsource.scrollIntoViewIfNeeded(); const fr = await fsource.boundingBox(), tr = await ftarget.boundingBox();
    await fallback.mouse.move(fr.x + fr.width / 2, fr.y + fr.height / 2); await fallback.mouse.down(); await fallback.mouse.move(tr.x + tr.width / 2, tr.y + tr.height / 2, { steps: 8 }); await fallback.mouse.up();
    await fallback.waitForTimeout(1600); assert.equal(await fallback.locator('#mail-level').textContent(), '给两位朋友写信');
    assert.deepEqual(errors, []); assert.deepEqual(external, []);
    console.log('PASS mail: five routes, 14 letters/cycle, real full-target drops and off-center grabs, wrong recipient, duplicate recipient, cancel/resize/scroll/blur, keyboard, repeated delivery lock, lifecycle, desktop/narrow, records, optional storage/audio, reduced motion and offline.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
