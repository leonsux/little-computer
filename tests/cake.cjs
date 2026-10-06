const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

(async () => {
  fs.mkdirSync('.tmp/cake-game', { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
    const errors = [], external = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (/^https?:/.test(request.url())) external.push(request.url()); });
    const url = pathToFileURL(path.resolve('index.html')).href;
    await page.goto(url);
    const enter = () => page.locator('[data-game="cake"]').click();
    const home = () => page.locator('#cake-screen [data-home]').click();
    const ingredient = key => page.locator('.cake-ingredient[data-ingredient="' + key + '"]');
    const selection = () => page.locator('#cake-made .cake-piece').evaluateAll(nodes => nodes.map(node => node.dataset.ingredient));
    const order = () => page.locator('#cake-recipe > span').evaluateAll(nodes => nodes.map(node => node.dataset.ingredient));
    const record = () => page.evaluate(() => Number(localStorage.getItem('littleComputer.cakeOrders')) || 0);
    const settle = () => page.waitForTimeout(1650);
    const fill = async () => { for (const key of await order()) await ingredient(key).click(); };
    await page.locator('[data-game="cake"]').scrollIntoViewIfNeeded();
    for (const width of [1920, 1366, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(100);
      assert.ok(await page.locator('[data-game="cake"]').evaluate(button => {
        const title = button.querySelector('b').getBoundingClientRect();
        const art = button.querySelector('.cake-entry-art').getBoundingClientRect();
        const entry = button.getBoundingClientRect();
        return title.right <= art.left && art.left >= entry.left && art.right <= entry.right;
      }), 'Home title and artwork do not overlap at ' + width);
    }
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.screenshot({ path: '.tmp/cake-game/home.png', fullPage: true });
    await enter();
    assert.equal(await page.locator('[data-demo-panel="cake"]').isVisible(), true);
    await page.locator('[data-demo="cake"]').click();
    await ingredient('vanilla').hover();
    assert.deepEqual(await selection(), [], 'Hover and demo cannot make a cake');
    assert.equal(await record(), 0);
    assert.equal(await page.locator('#cake-serve').isDisabled(), true);
    assert.equal(await page.locator('#cake-undo').isDisabled(), true);
    await ingredient('strawberry').dispatchEvent('click');
    assert.deepEqual(await selection(), [], 'Later category cannot skip a step');
    await ingredient('chocolate').click();
    await page.locator('#cake-serve').click();
    assert.equal(await record(), 0, 'Incomplete cake cannot be served');
    assert.deepEqual(await selection(), ['chocolate']);
    await ingredient('cream').click();
    await ingredient('strawberry').click();
    await page.locator('#cake-serve').click();
    assert.equal(await record(), 0, 'Wrong base remains editable without reward');
    assert.equal(await page.locator('#cake-recipe .is-next').count(), 1);
    assert.equal(await ingredient('candle').count(), 0);
    await ingredient('vanilla').dispatchEvent('click');
    assert.equal((await selection()).length, 3, 'Cannot add to a complete cake');
    for (let i = 0; i < 3; i += 1) await page.locator('#cake-undo').click();
    assert.deepEqual(await selection(), []);
    assert.equal(await ingredient('vanilla').isEnabled(), true);

    const sizes = [2, 2, 2, 2, 3], steps = [3, 3, 3, 5, 6];
    let expected = 0;
    for (let round = 0; round < sizes.length; round += 1) {
      for (let guest = 0; guest < sizes[round]; guest += 1) {
        const keys = await order();
        assert.equal(keys.length, steps[round]);
        assert.equal(await page.locator('#cake-served .cake-gift').count(), guest);
        assert.equal(await ingredient('candle').count(), round === 4 ? 1 : 0);
        if (round === 1 && guest === 0) {
          await ingredient(keys[0]).click();
          await ingredient('cream').click();
          await ingredient(keys[2]).click();
          await page.locator('#cake-serve').click();
          assert.equal(await record(), expected, 'Wrong cream is rejected');
          await page.locator('#cake-undo').click();
          await page.locator('#cake-undo').click();
          assert.deepEqual(await selection(), [keys[0]], 'Undo preserves earlier work');
          await ingredient(keys[1]).click();
          await ingredient(keys[2]).click();
        } else if (round === 2 && guest === 0) {
          await ingredient(keys[0]).click();
          await ingredient(keys[1]).click();
          await ingredient('blueberry').click();
          await page.locator('#cake-serve').click();
          assert.equal(await record(), expected, 'Wrong fruit is rejected');
          await page.locator('#cake-undo').click();
          await ingredient(keys[2]).click();
        } else await fill();
        assert.deepEqual(await selection(), keys);
        assert.equal(await page.locator('#cake-recipe .is-done').count(), keys.length);
        assert.equal(await page.locator('.cake-ingredient:not(:disabled)').count(), 0);
        if (round === 4 && guest === 0) {
          for (const width of [1920, 1366, 768, 390, 320]) {
            await page.setViewportSize({ width, height: 900 });
            await page.waitForTimeout(100);
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No overflow at ' + width);
            assert.deepEqual(await page.locator('#cake-screen button:visible').evaluateAll(buttons => buttons.filter(button => {
              const r = button.getBoundingClientRect(); return r.left < -1 || r.right > innerWidth + 1;
            }).map(button => button.textContent)), []);
            for (const button of await page.locator('.cake-ingredient, #cake-serve, #cake-undo').all()) {
              const r = await button.boundingBox(); assert.ok(r.width >= 100 && r.height >= 80, 'Large targets at ' + width);
            }
            assert.ok(await page.locator('#cake-order .cake-piece, #cake-made .cake-piece').evaluateAll(nodes => nodes.every(node => {
              const r = node.getBoundingClientRect(), s = document.querySelector('#cake-stage').getBoundingClientRect();
              return r.left >= s.left && r.right <= s.right && r.top >= s.top && r.bottom <= s.bottom;
            })), 'Cake stays in its stage');
            if (width === 1366 || width === 320) await page.screenshot({ path: '.tmp/cake-game/birthday-' + width + '.png', fullPage: true });
          }
          await page.setViewportSize({ width: 1366, height: 900 });
        }
        await page.locator('#cake-serve').click();
        expected += 1;
        await page.locator('#cake-serve').dispatchEvent('click');
        await page.locator('#cake-undo').dispatchEvent('click');
        await ingredient(keys[0]).dispatchEvent('click');
        assert.equal(await record(), expected, 'Celebration cannot count twice');
        assert.equal(await page.locator('#cake-served .cake-gift').count(), guest + 1);
        assert.equal(await page.locator('#level-transition').isVisible(), true);
        await settle();
        assert.deepEqual(await selection(), []);
      }
    }
    assert.equal(await record(), 11);
    assert.equal(await page.locator('#cake-level').textContent(), '蛋糕店开张啦', 'Five rounds cycle');
    await page.evaluate(() => refreshParentPage());
    assert.equal(await page.locator('#stat-cake-orders').textContent(), '11');

    await ingredient('vanilla').focus();
    await page.keyboard.press('Enter');
    assert.equal(await ingredient('cream').evaluate(node => node === document.activeElement), true);
    await page.keyboard.press('Space');
    assert.equal(await ingredient('strawberry').evaluate(node => node === document.activeElement), true);
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#cake-serve').evaluate(node => node === document.activeElement), true);
    await page.keyboard.press('Space');
    assert.equal(await record(), 12);
    await home();
    assert.equal(await page.locator('[data-game="cake"]').evaluate(node => node === document.activeElement), true);
    await settle();
    assert.equal(await page.locator('#home-screen').isVisible(), true);
    assert.deepEqual(await order(), ['vanilla', 'cream', 'strawberry'], 'Leaving cancels customer change');
    await enter();
    await ingredient('vanilla').click();
    await page.locator('#cake-screen [data-replay]').click();
    assert.deepEqual(await selection(), []);
    assert.equal(await record(), 12);
    await page.locator('#cake-screen [data-sound]').click();
    await home();
    assert.equal(await page.locator('#home-screen [data-sound]').getAttribute('aria-pressed'), 'false');
    await page.reload();
    await enter();
    assert.equal(await page.locator('#cake-screen [data-sound]').getAttribute('aria-pressed'), 'false');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.locator('[data-demo="cake"]').click();
    assert.equal(await page.locator('.cake-demo-art svg').first().evaluate(node => getComputedStyle(node).animationName), 'none');
    await fill();
    await page.locator('#cake-serve').click();
    assert.equal(await page.locator('#level-transition').isVisible(), true);
    await page.screenshot({ path: '.tmp/cake-game/reduced-motion.png', fullPage: true });
    await page.locator('#cake-screen [data-replay]').click();
    await settle();
    assert.deepEqual(await selection(), [], 'Replay cancels celebration');
    assert.deepEqual(await order(), ['vanilla', 'cream', 'strawberry']);

    await page.setViewportSize({ width: 320, height: 900 });
    for (let i = 0; i < 11; i += 1) {
      await fill();
      await page.locator('#cake-serve').click();
      await settle();
    }
    assert.deepEqual(await order(), ['vanilla', 'cream', 'strawberry'], 'Real narrow clicks complete all eleven orders');
    await ingredient('chocolate').focus();
    await page.keyboard.press('Space');
    await page.locator('#cake-undo').focus();
    await page.keyboard.press('Enter');
    assert.deepEqual(await selection(), []);
    await home();

    const fallback = await browser.newPage();
    await fallback.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', { get() { throw new Error('storage unavailable'); } });
      window.AudioContext = undefined; window.webkitAudioContext = undefined;
    });
    fallback.on('pageerror', error => errors.push(error.message));
    fallback.on('request', request => { if (/^https?:/.test(request.url())) external.push(request.url()); });
    await fallback.goto(url);
    await fallback.locator('[data-game="cake"]').click();
    for (const key of ['vanilla', 'cream', 'strawberry']) await fallback.locator('.cake-ingredient[data-ingredient="' + key + '"]').click();
    await fallback.locator('#cake-serve').click();
    assert.equal(await fallback.locator('#level-transition').isVisible(), true);
    await fallback.locator('#cake-screen [data-home]').click();
    await settle();
    assert.equal(await fallback.locator('#home-screen').isVisible(), true);
    assert.deepEqual(errors, []);
    assert.deepEqual(external, []);
    console.log('Cake: five rounds / eleven orders, desktop and narrow clicks, wrong ingredients, step guards, undo, lock, keyboard, navigation, replay, mute, fallback and responsive checks passed.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
