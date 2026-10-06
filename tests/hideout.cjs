const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

(async () => {
  fs.mkdirSync('.tmp/hideout-game', { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
    const errors = [], external = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (/^https?:/.test(request.url())) external.push(request.url()); });
    await page.goto(pathToFileURL(path.resolve('index.html')).href);
    const enter = () => page.locator('[data-game="hideout"]').click();
    const home = () => page.locator('#hideout-screen [data-home]').click();
    const spot = name => page.locator('.hideout-spot[data-friend="' + name + '"]').first();
    const names = { 小兔: 'rabbit', 蝴蝶: 'butterfly', 小乌龟: 'turtle', 小狐狸: 'fox', 猫头鹰: 'owl', 小鱼: 'fish' };
    const next = async () => spot(names[await page.locator('#hideout-friend').textContent()]);
    const found = () => page.locator('.hideout-spot.is-found').count();
    const record = () => page.evaluate(() => Number(localStorage.getItem('littleComputer.hideoutScenes')) || 0);
    const settle = () => page.waitForTimeout(1650);
    const finish = async () => { while (!(await page.locator('#hideout-hint').isDisabled())) await (await next()).click(); };

    await enter();
    assert.equal(await page.locator('[data-demo-panel="hideout"]').isVisible(), true);
    await spot('rabbit').hover();
    assert.equal(await found(), 0, 'Hover cannot find a friend');
    await page.locator('[data-demo="hideout"]').click();
    assert.equal(await found(), 0, 'Demo does not complete the task');
    await page.locator('#hideout-hint').click();
    assert.equal(await page.locator('.hideout-spot.is-hint').count(), 1);
    assert.equal(await spot('rabbit').evaluate(button => button.classList.contains('is-hint')), true);
    assert.equal(await found(), 0, 'Hint points at a hiding place, without revealing or counting it');
    assert.equal(await page.locator('.hideout-spot.is-open').count(), 0);
    await page.waitForTimeout(2350);
    assert.equal(await page.locator('.hideout-spot.is-hint').count(), 0, 'Hint expires');
    await spot('flower').click();
    await page.waitForTimeout(1200);
    assert.equal(await spot('flower').getAttribute('aria-pressed'), 'true', 'Small surprises stay visible');
    assert.equal(await found(), 0);
    await spot('butterfly').click();
    assert.equal(await spot('butterfly').getAttribute('aria-pressed'), 'true');
    assert.equal(await found(), 0, 'Another friend is not the requested friend');
    await page.waitForTimeout(1200);
    assert.equal(await spot('butterfly').getAttribute('aria-pressed'), 'false', 'Other friends hide again');
    await spot('butterfly').click();
    await spot('rabbit').click();
    assert.equal(await page.locator('#hideout-friend').textContent(), '蝴蝶');
    await spot('rabbit').dispatchEvent('click');
    assert.equal(await found(), 1, 'A found animal cannot count again');
    await spot('butterfly').click();
    await page.waitForTimeout(1200);
    assert.equal(await found(), 2, 'A friend found during a previous peek stays found');
    assert.equal(await spot('butterfly').getAttribute('aria-pressed'), 'true');
    await spot('turtle').click();
    await spot('turtle').dispatchEvent('click');
    assert.equal(await record(), 1, 'Celebration is counted once');
    assert.equal(await page.locator('#level-transition').isVisible(), true);
    assert.equal(await page.locator('#hideout-hint').isDisabled(), true);
    await settle();

    const totals = [4, 5, 7, 8, 9], animals = [3, 4, 5, 6, 6];
    for (let level = 1; level < 5; level += 1) {
      assert.equal(await page.locator('.hideout-spot').count(), totals[level]);
      assert.equal(await page.locator('#hideout-trail .progress-token').count(), animals[level]);
      const symbols = await page.locator('.hideout-animal use').evaluateAll(uses => uses.map(use => {
        const symbol = document.querySelector(use.getAttribute('href')); return Boolean(symbol && symbol.tagName.toLowerCase() === 'symbol');
      }));
      assert.ok(symbols.every(Boolean), 'All local pictures exist');
      await page.locator('#hideout-hint').click();
      assert.equal(await found(), 0);
      if (level === 4) {
        for (const width of [1920, 1366, 768, 390, 320]) {
          await page.setViewportSize({ width, height: 900 });
          await page.waitForTimeout(100);
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No overflow at ' + width);
          const clipped = await page.locator('#hideout-screen button:visible').evaluateAll(buttons => buttons.filter(button => {
            const r = button.getBoundingClientRect(); return r.left < -1 || r.right > innerWidth + 1;
          }).map(button => button.textContent || button.getAttribute('aria-label')));
          assert.deepEqual(clipped, [], 'All controls fit ' + width);
          for (const button of await page.locator('.hideout-spot, #hideout-hint').all()) {
            const r = await button.boundingBox(); assert.ok(r.width >= 100 && r.height >= 80, 'Large targets');
          }
          if (width === 1366 || width === 320) await page.screenshot({ path: '.tmp/hideout-game/scene-' + width + '.png', fullPage: true });
        }
        // Finish the largest scene with actual clicks and scrolling in the narrow viewport.
        assert.equal(await page.locator('.hideout-spot').count(), 9);
      }
      await finish();
      assert.equal(await found(), animals[level]);
      assert.equal(await record(), level + 1);
      await settle();
    }
    assert.equal(await page.locator('.hideout-spot').count(), 4, 'Five scenes cycle');
    assert.equal(await page.locator('#hideout-level').textContent(), '草地上的悄悄话');
    await page.evaluate(() => refreshParentPage());
    assert.equal(await page.locator('#stat-hideout-scenes').textContent(), '5');
    const arrangements = new Set();
    for (let replay = 0; replay < 8; replay += 1) {
      await page.locator('#hideout-screen [data-replay]').click();
      arrangements.add((await page.locator('.hideout-spot').evaluateAll(buttons => buttons.map(button => button.dataset.friend))).join(','));
    }
    assert.ok(arrangements.size > 1, 'Replaying shuffles hiding places');
    await page.setViewportSize({ width: 1366, height: 900 });
    for (let friend = 0; friend < 3; friend += 1) {
      const target = await next(); await target.focus(); await page.keyboard.press(friend % 2 ? 'Space' : 'Enter');
      assert.equal(await found(), friend + 1, 'Keyboard click finds a friend');
    }
    assert.equal(await record(), 6);
    await home();
    assert.equal(await page.locator('[data-game="hideout"]').evaluate(button => button === document.activeElement), true);
    await settle();
    assert.equal(await page.locator('#home-screen').isVisible(), true);
    assert.equal(await page.locator('.hideout-spot').count(), 4, 'Leaving cancels the next scene');
    await enter();
    await spot('butterfly').click();
    await page.locator('#hideout-hint').click();
    await home();
    await enter();
    await page.waitForTimeout(2350);
    assert.equal(await found(), 0);
    assert.equal(await page.locator('.hideout-spot.is-open, .hideout-spot.is-hint').count(), 0, 'Leaving clears peek and hint timers');
    await finish();
    await page.locator('#hideout-screen [data-replay]').click();
    await settle();
    assert.equal(await page.locator('.hideout-spot').count(), 4, 'Replay cancels celebration callbacks');
    assert.equal(await found(), 0);
    await page.locator('#hideout-screen [data-sound]').click();
    await home();
    assert.equal(await page.locator('#home-screen [data-sound]').getAttribute('aria-pressed'), 'false');
    await page.reload();
    await enter();
    assert.equal(await page.locator('#hideout-screen [data-sound]').getAttribute('aria-pressed'), 'false');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.locator('#hideout-hint').click();
    const reduced = await page.locator('.hideout-spot.is-hint').evaluate(button => ({ border: getComputedStyle(button).borderTopStyle, animation: getComputedStyle(button.querySelector('svg')).animationName }));
    assert.equal(reduced.border, 'dashed');
    assert.equal(reduced.animation, 'none', 'Reduced motion retains a static hint');
    await finish();
    assert.equal(await page.locator('#level-transition').isVisible(), true);
    await page.screenshot({ path: '.tmp/hideout-game/reduced-motion.png', fullPage: true });
    await home();
    await page.screenshot({ path: '.tmp/hideout-game/home.png', fullPage: true });

    const fallback = await browser.newPage();
    fallback.on('pageerror', error => errors.push(error.message));
    await fallback.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', { get() { throw new Error('storage unavailable'); } });
      window.AudioContext = undefined; window.webkitAudioContext = undefined;
    });
    await fallback.goto(pathToFileURL(path.resolve('index.html')).href);
    await fallback.locator('[data-game="hideout"]').click();
    for (const friend of ['rabbit', 'butterfly', 'turtle']) await fallback.locator('.hideout-spot[data-friend="' + friend + '"]').click();
    assert.equal(await fallback.locator('#level-transition').isVisible(), true, 'Storage and audio are optional');
    assert.deepEqual(errors, []);
    assert.deepEqual(external, []);
    console.log('PASS: five hideout scenes/cycle; clues, peeks, surprises, hints, retained friends, real narrow clicks, keyboard, replay, timer cleanup, shared mute, storage/audio fallback and offline.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
