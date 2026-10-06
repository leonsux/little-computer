const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

(async () => {
  fs.mkdirSync('.tmp/builder-game', { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
    const errors = [], external = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (/^https?:/.test(request.url())) external.push(request.url()); });
    await page.goto(pathToFileURL(path.resolve('index.html')).href);
    const enter = () => page.locator('[data-game="builder"]').click();
    const home = () => page.locator('#builder-screen [data-home]').click();
    const replay = () => page.locator('#builder-screen [data-replay]').click();
    const source = index => page.locator('.builder-piece[data-part="' + index + '"]');
    const target = index => page.locator('.builder-slot[data-part="' + index + '"]');
    const count = () => page.locator('.builder-slot.is-filled').count();
    const record = () => page.evaluate(() => Number(localStorage.getItem('littleComputer.builderModels')) || 0);
    const settle = () => page.waitForTimeout(1650);
    async function prepare(a, b) {
      let first = await a.boundingBox(), second = await b.boundingBox();
      const min = Math.min(first.y, second.y), max = Math.max(first.y + first.height, second.y + second.height);
      const height = page.viewportSize().height;
      assert.ok(max - min < height - 8, 'Source and target can be viewed together');
      if (min < 8 || max > height - 8) {
        await page.evaluate(delta => window.scrollBy(0, delta), (min + max) / 2 - height / 2);
        await page.waitForTimeout(100);
      }
      return [await a.boundingBox(), await b.boundingBox()];
    }
    async function drag(from, to = from, options = {}) {
      const element = source(from), destination = target(to);
      const [a, b] = await prepare(element, destination);
      const grabX = a.x + a.width * (options.offCenter ? .15 : .5), grabY = a.y + a.height * (options.offCenter ? .2 : .5);
      const x = b.x + b.width * (options.x ?? .5), y = b.y + b.height * (options.y ?? .5);
      await page.mouse.move(grabX, grabY); await page.mouse.down();
      await page.mouse.move(grabX + x - a.x - a.width / 2, grabY + y - a.y - a.height / 2, { steps: 10 });
      if (options.release !== false) await page.mouse.up();
    }
    const finish = async () => {
      const indices = await page.locator('.builder-piece:not(:disabled)').evaluateAll(elements => elements.map(element => Number(element.dataset.part)));
      for (const index of indices) await drag(index);
    };

    await enter();
    assert.equal(await page.locator('[data-demo-panel="builder"]').isVisible(), true);
    await source(0).hover();
    await source(0).click();
    assert.equal(await count(), 0, 'A click or hover cannot replace dragging');
    await page.locator('[data-demo="builder"]').click();
    assert.equal(await count(), 0, 'Demo cannot place a block');
    await drag(0, 1);
    assert.equal(await count(), 0, 'A beam cannot go in a roof outline');
    await drag(0, 0, { release: false });
    assert.equal(await count(), 0, 'Holding does not count');
    assert.equal(await page.locator('.builder-slot.is-target').count(), 1);
    await source(0).dispatchEvent('pointercancel'); await page.mouse.up();
    assert.equal(await count(), 0, 'Pointer cancellation does not place a block');
    await drag(0, 0, { release: false });
    await page.keyboard.press('Escape'); await page.mouse.up();
    assert.equal(await count(), 0);
    await drag(0, 0, { release: false });
    await page.evaluate(() => window.dispatchEvent(new Event('blur'))); await page.mouse.up();
    assert.equal(await count(), 0);
    await drag(0, 0, { release: false });
    await page.setViewportSize({ width: 1280, height: 900 }); await page.mouse.up();
    assert.equal(await count(), 0, 'Resizing aborts a drag');
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.waitForTimeout(100);
    await drag(0, 0, { release: false });
    await page.evaluate(() => {
      const descriptor = Object.getOwnPropertyDescriptor(window, 'innerWidth');
      const width = innerWidth;
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: width + 1 });
      const piece = document.querySelector('.builder-piece[data-part="0"]');
      const r = piece.getBoundingClientRect();
      piece.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }));
      Object.defineProperty(window, 'innerWidth', descriptor);
    });
    await page.mouse.up();
    assert.equal(await count(), 0, 'Viewport changes are detected before a resize event');
    assert.equal(await page.locator('.builder-piece.is-dragging').count(), 0);

    for (const region of [{ x: .5, y: .1 }, { x: .5, y: .9 }, { x: .1, y: .5 }, { x: .9, y: .5 }, { x: .5, y: .5 }]) {
      await replay();
      await drag(0, 0, { ...region, offCenter: true, release: false });
      assert.equal(await page.locator('.builder-slot.is-target').count(), 1, 'The whole visible outline accepts a centered block');
      assert.equal(await count(), 0);
      await page.mouse.up();
      assert.equal(await count(), 1, 'Full-frame drop is accepted on release');
    }
    await replay();
    // The circular window overlaps the wall. Place it first, and preserve it when the wall is added.
    await drag(2);
    await drag(1);
    await page.screenshot({ path: '.tmp/builder-game/house-progress.png', fullPage: true });
    await drag(0);
    assert.equal(await count(), 3);
    assert.equal(await record(), 1);
    assert.equal(await page.locator('#builder-surprise').isVisible(), true);
    assert.equal(await page.locator('#level-transition').isVisible(), true);
    await source(0).dispatchEvent('pointerup', { pointerId: 1 });
    assert.equal(await record(), 1);
    await settle();

    const sizes = [3, 3, 5, 6, 7];
    for (let level = 1; level < 5; level += 1) {
      assert.equal(await page.locator('.builder-piece').count(), sizes[level]);
      if (level === 1) {
        await drag(0, 1);
        await drag(1, 0);
        assert.equal(await count(), 2, 'Identical square blocks can swap places');
      }
      if (level === 4) {
        for (const width of [1920, 1366, 768, 390, 320]) {
          await page.setViewportSize({ width, height: 900 }); await page.waitForTimeout(100);
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No horizontal overflow at ' + width);
          const clipped = await page.locator('#builder-screen button:visible, .builder-slot').evaluateAll(elements => elements.filter(element => {
            const r = element.getBoundingClientRect(); return r.left < -1 || r.right > innerWidth + 1;
          }).map(element => element.getAttribute('aria-label') || element.textContent));
          assert.deepEqual(clipped, [], 'Controls and all building slots are visible');
          for (const element of await page.locator('.builder-piece, .builder-slot').all()) {
            const r = await element.boundingBox(); assert.ok(r.width >= 100 && r.height >= 80);
          }
          if (width === 1366 || width === 320) await page.screenshot({ path: '.tmp/builder-game/castle-' + width + '.png', fullPage: true });
        }
        await drag(0, 0, { release: false });
        await page.evaluate(() => window.scrollBy(0, 20)); await page.mouse.up();
        assert.equal(await count(), 0, 'Scrolling during a drag returns the block');
      }
      await finish();
      assert.equal(await record(), level + 1);
      if (level === 3) assert.equal(await page.locator('.builder-flame').isVisible(), true, 'Completed rocket lights up');
      await settle();
    }
    assert.equal(await page.locator('#builder-level').textContent(), '小兔的新家', 'Five models cycle');
    await page.evaluate(() => refreshParentPage());
    assert.equal(await page.locator('#stat-builder-models').textContent(), '5');
    // Complete all five models with real drag input in a narrow viewport.
    for (let level = 0; level < 5; level += 1) {
      await finish();
      assert.equal(await count(), sizes[level]);
      await settle();
    }
    assert.equal(await record(), 10);

    await page.setViewportSize({ width: 1366, height: 900 }); await page.waitForTimeout(100);
    for (let index = 0; index < 3; index += 1) {
      const [a, b] = await prepare(source(index), target(index));
      await source(index).focus(); await page.keyboard.press('Space');
      const dx = b.x + b.width / 2 - a.x - a.width / 2, dy = b.y + b.height / 2 - a.y - a.height / 2;
      for (const [distance, negative, positive] of [[dx, 'ArrowLeft', 'ArrowRight'], [dy, 'ArrowUp', 'ArrowDown']]) {
        const steps = Math.round(Math.abs(distance) / 8);
        for (let step = 0; step < steps; step += 1) await page.keyboard.press('Shift+' + (distance < 0 ? negative : positive));
      }
      await page.keyboard.press('Enter');
      assert.equal(await count(), index + 1, 'Keyboard can place blocks');
    }
    assert.equal(await record(), 11);
    await home(); await settle();
    assert.equal(await page.locator('[data-game="builder"]').evaluate(button => button === document.activeElement), true);
    assert.equal(await page.locator('#builder-level').textContent(), '小兔的新家', 'Leaving cancels pending next model');
    await enter();
    await finish(); await replay(); await settle();
    assert.equal(await count(), 0, 'Replay cancels pending next model');
    await source(0).focus(); await page.keyboard.press('Space'); await page.keyboard.press('Escape');
    assert.equal(await source(0).getAttribute('aria-pressed'), 'false');
    await page.locator('#builder-screen [data-sound]').click(); await home();
    assert.equal(await page.locator('#home-screen [data-sound]').getAttribute('aria-pressed'), 'false');
    await page.reload(); await enter();
    assert.equal(await page.locator('#builder-screen [data-sound]').getAttribute('aria-pressed'), 'false');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await finish();
    assert.equal(await page.locator('#builder-surprise').isVisible(), true);
    await page.screenshot({ path: '.tmp/builder-game/reduced-motion.png', fullPage: true });
    await home();
    await page.screenshot({ path: '.tmp/builder-game/home.png', fullPage: true });
    const fallback = await browser.newPage();
    fallback.on('pageerror', error => errors.push(error.message));
    await fallback.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', { get() { throw new Error('storage unavailable'); } });
      window.AudioContext = undefined; window.webkitAudioContext = undefined;
    });
    await fallback.goto(pathToFileURL(path.resolve('index.html')).href);
    await fallback.locator('[data-game="builder"]').click();
    const block = fallback.locator('.builder-piece[data-part="0"]'), slot = fallback.locator('.builder-slot[data-part="0"]');
    const a = await block.boundingBox(), b = await slot.boundingBox();
    await fallback.mouse.move(a.x + a.width / 2, a.y + a.height / 2); await fallback.mouse.down();
    await fallback.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 10 }); await fallback.mouse.up();
    assert.equal(await fallback.locator('.builder-slot.is-filled').count(), 1, 'Storage and audio are optional');
    assert.deepEqual(errors, []); assert.deepEqual(external, []);
    console.log('PASS: five builder models; real desktop/narrow drags; full target frames; interchangeable blocks; overlapping parts; wrong drops/cancel/resize/scroll; keyboard; cycle/replay/navigation; mute, records, reduced motion and storage/audio fallback; offline.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
