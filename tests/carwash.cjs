const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

(async () => {
  fs.mkdirSync('.tmp/carwash-game', { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
    const errors = [], external = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (/^https?:/.test(request.url())) external.push(request.url()); });
    const url = pathToFileURL(path.resolve('index.html')).href;
    const enter = () => page.locator('[data-game="carwash"]').click();
    const home = () => page.locator('#carwash-screen [data-home]').click();
    const zone = index => page.locator('.carwash-zone').nth(index);
    const state = () => page.locator('.carwash-zone').evaluateAll(buttons => buttons.map(button => Number(button.dataset.clean)));
    const record = () => page.evaluate(() => Number(localStorage.getItem('littleComputer.carwashCars')) || 0);
    const step = () => page.locator('#carwash-stage').getAttribute('data-step');
    const settle = () => page.waitForTimeout(1650);
    const fill = async (keyboard = false) => {
      for (let phase = 0; phase < 3; phase += 1) {
        if (keyboard) { await zone(0).focus(); await page.keyboard.press('Enter'); await page.keyboard.press('Space'); }
        else { await zone(0).click(); await zone(1).click(); }
        assert.equal(await step(), String(phase + 1));
      }
    };
    await page.goto(url);
    assert.equal(await page.locator('[data-game]').count(), 16);
    for (const width of [1920, 1366, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      assert.ok(await page.locator('[data-game="carwash"]').evaluate(button => button.querySelector('b').getBoundingClientRect().right <= button.querySelector('svg').getBoundingClientRect().left), 'Home art does not cover title at ' + width);
    }
    await page.setViewportSize({ width: 1366, height: 900 });
    await enter();
    assert.equal(await page.locator('[data-demo-panel="carwash"]').isVisible(), true);
    await zone(0).hover();
    await page.locator('[data-demo="carwash"]').click();
    assert.deepEqual(await state(), [0, 0], 'Hover and demo cannot wash');
    await page.locator('[data-close-demo]:visible').click();
    await page.locator('#carwash-serve').dispatchEvent('click');
    assert.equal(await record(), 0, 'Dirty car cannot be delivered');
    const r = await zone(0).boundingBox();
    await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
    await page.mouse.down();
    assert.deepEqual(await state(), [0, 0], 'Press alone cannot wash');
    await page.mouse.move(10, 10);
    await page.mouse.up();
    assert.deepEqual(await state(), [0, 0], 'Canceled click cannot wash');
    await zone(0).click();
    assert.deepEqual(await state(), [1, 0]);
    await zone(0).dispatchEvent('click');
    assert.deepEqual(await state(), [1, 0], 'Already brushed half cannot skip ahead');
    assert.equal(await step(), '0');
    await page.screenshot({ path: '.tmp/carwash-game/half-brushed.png', fullPage: true });
    await zone(1).click();
    assert.equal(await step(), '1');
    assert.deepEqual(await state(), [1, 1], 'Both foam patches remain until clicked');
    await zone(1).click();
    await zone(1).dispatchEvent('click');
    assert.deepEqual(await state(), [1, 2]);
    await zone(0).click();
    assert.equal(await step(), '2');
    assert.deepEqual(await state(), [2, 2]);
    await page.locator('#carwash-serve').dispatchEvent('click');
    assert.equal(await record(), 0);
    await zone(1).click();
    await zone(0).click();
    assert.equal(await step(), '3');
    assert.equal(await record(), 0, 'Finishing wash requires an explicit handover');
    assert.equal(await page.locator('#carwash-steps .is-done').count(), 3);
    await page.screenshot({ path: '.tmp/carwash-game/clean-car.png', fullPage: true });
    await page.locator('#carwash-serve').click();
    await page.locator('#carwash-serve').dispatchEvent('click');
    await zone(0).dispatchEvent('click');
    assert.equal(await record(), 1, 'Celebration is counted once');
    assert.equal(await page.locator('#level-transition').isVisible(), true);
    await settle();
    const names = ['小狐狸的旅行巴士', '小乌龟的农场拖拉机', '猫头鹰的冰淇淋车', '小兔的消防车'];
    for (const name of names) {
      assert.equal(await page.locator('#carwash-level').textContent(), name);
      await fill();
      await page.screenshot({ path: '.tmp/carwash-game/vehicle-' + names.indexOf(name) + '.png', fullPage: true });
      await page.locator('#carwash-serve').click();
      await settle();
    }
    assert.equal(await record(), 5);
    assert.equal(await page.locator('#carwash-level').textContent(), '小兔的草莓车', 'Five cars cycle');
    await page.evaluate(() => refreshParentPage());
    assert.equal(await page.locator('#stat-carwash-cars').textContent(), '5');
    await fill(true);
    assert.equal(await page.locator('#carwash-serve').evaluate(button => button === document.activeElement), true);
    await page.keyboard.press('Enter');
    await settle();
    assert.equal(await zone(0).evaluate(button => button === document.activeElement), true, 'New car preserves keyboard operation');
    await page.locator('#carwash-screen [data-sound]').click();
    await home();
    assert.equal(await page.locator('[data-game="carwash"]').evaluate(button => button === document.activeElement), true);
    await enter();
    assert.equal(await page.locator('#carwash-screen [data-sound]').textContent(), '声音：关');
    await fill();
    await page.locator('#carwash-serve').click();
    await home();
    assert.equal(await page.locator('#level-transition').isVisible(), false);
    await settle();
    await enter();
    assert.equal(await page.locator('#carwash-level').textContent(), '小兔的草莓车');
    assert.deepEqual(await state(), [0, 0]);
    await fill();
    await page.locator('#carwash-serve').click();
    await page.locator('[data-replay="carwash"]').click();
    await settle();
    assert.equal(await page.locator('#carwash-level').textContent(), '小兔的草莓车', 'Replay cancels pending next car');
    assert.deepEqual(await state(), [0, 0]);

    for (const width of [1920, 1366, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No page overflow at ' + width);
      for (const button of await page.locator('.carwash-zone, #carwash-serve, #carwash-screen .play-control').all()) {
        const box = await button.boundingBox();
        assert.ok(box.width >= 100 && box.height >= 80, 'Large controls at ' + width);
        assert.ok(box.x >= 0 && box.x + box.width <= width, 'Visible controls at ' + width);
      }
      assert.ok(await zone(0).evaluate(button => {
        const a = button.getBoundingClientRect(), b = button.nextElementSibling.getBoundingClientRect(); return a.right <= b.left + 1;
      }), 'Hit areas do not overlap');
      if (width === 1366 || width === 320) {
        await page.locator('[data-demo="carwash"]').click();
        await page.screenshot({ path: '.tmp/carwash-game/demo-' + width + '.png', fullPage: true });
        await page.locator('[data-close-demo]:visible').click();
      }
    }
    for (let i = 0; i < 5; i += 1) { await fill(); await page.locator('#carwash-serve').click(); await settle(); }
    assert.equal(await page.locator('#carwash-level').textContent(), '小兔的草莓车', 'All five cars work on narrow screens');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await fill();
    assert.equal(await page.locator('#carwash-vehicle').evaluate(node => getComputedStyle(node).animationName), 'none');
    await page.screenshot({ path: '.tmp/carwash-game/narrow-clean.png', fullPage: true });
    assert.deepEqual(errors, []);
    assert.deepEqual(external, []);

    const unavailable = await browser.newPage({ viewport: { width: 1366, height: 900 } });
    const unavailableErrors = [];
    unavailable.on('pageerror', error => unavailableErrors.push(error.message));
    await unavailable.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', { get() { throw new Error('Storage blocked'); } });
      window.AudioContext = undefined; window.webkitAudioContext = undefined;
    });
    await unavailable.goto(url);
    await unavailable.locator('[data-game="carwash"]').click();
    await unavailable.locator('[data-close-demo]:visible').click();
    for (let phase = 0; phase < 3; phase += 1) { await unavailable.locator('.carwash-zone').nth(0).click(); await unavailable.locator('.carwash-zone').nth(1).click(); }
    await unavailable.locator('#carwash-serve').click();
    await unavailable.waitForTimeout(1650);
    assert.equal(await unavailable.locator('#carwash-level').textContent(), names[0]);
    assert.deepEqual(unavailableErrors, [], 'Storage and audio are optional');
    console.log('PASS carwash: five vehicles, phase boundaries, real clicks, keyboard, lifecycle, narrow layouts, sound/storage fallback and offline loading');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
