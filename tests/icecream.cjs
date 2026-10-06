const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

(async () => {
  fs.mkdirSync('.tmp/icecream-game', { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
    const errors = [], external = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (/^https?:/.test(request.url())) external.push(request.url()); });
    await page.goto(pathToFileURL(path.resolve('index.html')).href);
    const enter = () => page.locator('[data-game="icecream"]').click();
    const home = () => page.locator('#icecream-screen [data-home]').click();
    const flavor = name => page.locator('.icecream-flavor[data-flavor="' + name + '"]');
    const made = () => page.locator('#icecream-made .icecream-scoop').count();
    const record = () => page.evaluate(() => Number(localStorage.getItem('littleComputer.icecreamOrders')) || 0);
    const order = () => page.locator('#icecream-order .icecream-scoop').evaluateAll(balls => balls.map(ball => ball.dataset.flavor));
    const settle = () => page.waitForTimeout(1650);
    const fill = async () => { for (const name of await order()) await flavor(name).click(); };

    await page.screenshot({ path: '.tmp/icecream-game/home.png', fullPage: true });
    await enter();
    assert.equal(await page.locator('[data-demo-panel="icecream"]').isVisible(), true);
    await page.locator('[data-demo="icecream"]').click();
    await flavor('strawberry').hover();
    assert.equal(await made(), 0, 'Demonstration and hovering cannot make a scoop');
    assert.equal(await record(), 0);
    assert.equal(await page.locator('#icecream-serve').isDisabled(), true);
    assert.equal(await page.locator('#icecream-undo').isDisabled(), true);
    await flavor('chocolate').click();
    await page.locator('#icecream-serve').click();
    assert.equal(await record(), 0, 'Wrong flavor is not served');
    assert.equal(await made(), 1, 'Wrong order stays available for undo');
    await flavor('vanilla').dispatchEvent('click');
    assert.equal(await made(), 1, 'Cannot overfill the cone');
    await page.locator('#icecream-undo').click();
    assert.equal(await made(), 0);

    const roundSizes = [2, 2, 3, 3, 3];
    const scoopCounts = [1, 2, 2, 3, 3];
    let expected = 0;
    for (let round = 0; round < roundSizes.length; round += 1) {
      for (let guest = 0; guest < roundSizes[round]; guest += 1) {
        assert.equal((await order()).length, scoopCounts[round]);
        assert.equal(await page.locator('#icecream-served .icecream-gift').count(), guest);
        assert.equal(await page.locator('.icecream-flavor').count(), round < 2 ? 3 : 4);
        const names = await order();
        if (round === 1 && guest === 0) {
          await flavor(names[1]).click();
          await page.locator('#icecream-serve').click();
          assert.equal(await record(), expected, 'Incomplete cone is not served');
          await flavor(names[0]).click();
          await page.locator('#icecream-serve').click();
          assert.equal(await record(), expected, 'Reversed order is not served');
          await page.locator('#icecream-undo').click();
          await page.locator('#icecream-undo').click();
        }
        await fill();
        assert.deepEqual(await page.locator('#icecream-made .icecream-scoop').evaluateAll(balls => balls.map(ball => ball.dataset.flavor)), names);
        assert.equal(await page.locator('#icecream-recipe .is-done').count(), names.length);
        if (round === 3 && guest === 0) {
          for (const width of [1920, 1366, 768, 390, 320]) {
            await page.setViewportSize({ width, height: 900 });
            await page.waitForTimeout(100);
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No horizontal overflow at ' + width);
            const clipped = await page.locator('#icecream-screen button:visible').evaluateAll(buttons => buttons.filter(button => {
              const r = button.getBoundingClientRect(); return r.left < -1 || r.right > innerWidth + 1;
            }).map(button => button.textContent));
            assert.deepEqual(clipped, []);
            for (const button of await page.locator('.icecream-flavor, #icecream-serve, #icecream-undo').all()) {
              const r = await button.boundingBox(); assert.ok(r.width >= 100 && r.height >= 80, 'Large click targets');
            }
            const pictures = await page.locator('#icecream-order .icecream-scoop, #icecream-made .icecream-scoop').evaluateAll(balls => balls.map(ball => {
              const r = ball.getBoundingClientRect(), stage = document.querySelector('#icecream-stage').getBoundingClientRect();
              return r.left >= stage.left && r.right <= stage.right && r.top >= stage.top && r.bottom <= stage.bottom;
            }));
            assert.ok(pictures.every(Boolean), 'Scoops remain inside the visible stage');
            if (width === 1366 || width === 320) await page.screenshot({ path: '.tmp/icecream-game/shop-' + width + '.png', fullPage: true });
          }
          await page.setViewportSize({ width: 1366, height: 900 });
        }
        await page.locator('#icecream-serve').click();
        expected += 1;
        await page.locator('#icecream-serve').dispatchEvent('click');
        await flavor(names[0]).dispatchEvent('click');
        await page.locator('#icecream-undo').dispatchEvent('click');
        assert.equal(await record(), expected, 'Repeated actions during celebration cannot count twice');
        assert.equal(await page.locator('#icecream-served .icecream-gift').count(), guest + 1);
        assert.equal(await page.locator('#level-transition').isVisible(), true);
        await settle();
        assert.equal(await made(), 0);
      }
    }
    assert.equal(await page.locator('#icecream-level').textContent(), '小店开张啦', 'All five rounds cycle');
    assert.equal(await record(), 13);
    await page.evaluate(() => refreshParentPage());
    assert.equal(await page.locator('#stat-icecream-orders').textContent(), '13');

    await flavor('strawberry').focus();
    await page.keyboard.press('Enter');
    assert.equal(await made(), 1);
    assert.equal(await page.locator('#icecream-serve').evaluate(button => button === document.activeElement), true);
    await page.keyboard.press('Space');
    assert.equal(await record(), 14);
    await home();
    assert.equal(await page.locator('[data-game="icecream"]').evaluate(button => button === document.activeElement), true);
    await settle();
    assert.equal(await page.locator('#home-screen').isVisible(), true);
    assert.equal(await page.locator('#icecream-level').textContent(), '小店开张啦', 'Leaving cancels pending customer change');
    await enter();
    await flavor('strawberry').click();
    await page.locator('#icecream-screen [data-replay]').click();
    assert.equal(await made(), 0, 'Replay resets the current order');
    assert.equal(await record(), 14, 'Replay keeps cumulative records');
    await page.locator('#icecream-screen [data-sound]').click();
    await home();
    assert.equal(await page.locator('#home-screen [data-sound]').getAttribute('aria-pressed'), 'false');
    await page.reload();
    await enter();
    assert.equal(await page.locator('#icecream-screen [data-sound]').getAttribute('aria-pressed'), 'false');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await fill();
    await page.locator('#icecream-serve').click();
    await page.screenshot({ path: '.tmp/icecream-game/reduced-motion.png', fullPage: true });
    assert.equal(await page.locator('#level-transition').isVisible(), true);
    await page.locator('#icecream-screen [data-replay]').click();
    await settle();
    assert.equal(await made(), 0, 'Replay cancels celebration callback');
    assert.deepEqual(await order(), ['strawberry']);

    await page.setViewportSize({ width: 320, height: 900 });
    for (let guest = 0; guest < 2; guest += 1) {
      await fill();
      await page.locator('#icecream-serve').click();
      await settle();
    }
    await flavor('chocolate').focus();
    await page.keyboard.press('Space');
    await page.locator('#icecream-undo').focus();
    await page.keyboard.press('Enter');
    assert.equal(await made(), 0, 'Keyboard can undo in the narrow layout');
    await fill();
    assert.equal(await made(), 2, 'Real narrow-screen clicks can make a double scoop');
    await page.locator('#icecream-serve').click();
    await home();
    await settle();
    assert.equal(await page.locator('#home-screen').isVisible(), true);

    const fallback = await browser.newPage();
    await fallback.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', { get() { throw new Error('storage unavailable'); } });
      window.AudioContext = undefined; window.webkitAudioContext = undefined;
    });
    fallback.on('pageerror', error => errors.push(error.message));
    await fallback.goto(pathToFileURL(path.resolve('index.html')).href);
    await fallback.locator('[data-game="icecream"]').click();
    await fallback.locator('.icecream-flavor[data-flavor="strawberry"]').click();
    await fallback.locator('#icecream-serve').click();
    assert.equal(await fallback.locator('#level-transition').isVisible(), true, 'Storage and audio failure do not prevent play');
    assert.deepEqual(errors, []);
    assert.deepEqual(external, []);
    console.log('Icecream: five rounds / thirteen orders, mistakes, undo, lock, keyboard, navigation, replay, sound, fallback and responsive checks passed.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
