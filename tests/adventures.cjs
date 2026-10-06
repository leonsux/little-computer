const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
    const errors = [], external = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (/^https?:/.test(request.url())) external.push(request.url()); });
    await page.goto(pathToFileURL(path.resolve('index.html')).href);
    const enter = game => page.locator('[data-game="' + game + '"]').click();
    const home = game => page.locator('#' + game + '-screen [data-home]').click();
    const settle = () => page.waitForTimeout(1650);
    const checkControls = async () => {
      const clipped = await page.locator('.screen:not(.hidden) button:visible').evaluateAll(buttons => buttons.filter(button => {
        const r = button.getBoundingClientRect();
        return r.left < -1 || r.right > innerWidth + 1;
      }).map(button => button.textContent || button.getAttribute('aria-label')));
      assert.deepEqual(clipped, [], 'Visible controls must not be clipped');
    };
    const center = async selector => { const r = await page.locator(selector).first().boundingBox(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; };
    const drag = async (source, target, release = true) => {
      const a = await center(source), b = await center(target);
      await page.mouse.move(a.x, a.y); await page.mouse.down();
      await page.mouse.move(b.x, b.y, { steps: 10 });
      if (release) await page.mouse.up();
    };
    const cell = index => page.locator('.maze-cell[data-cell="' + index + '"]');
    const mazeRoute = async () => {
      const tiles = await page.locator('.maze-cell').evaluateAll(cells => cells.map(cell => cell.dataset.tile));
      const target = tiles.indexOf('c'), queue = [0], previous = new Map([[0, -1]]);
      for (let offset = 0; offset < queue.length && !previous.has(target); offset += 1) {
        const current = queue[offset];
        for (const next of [current - 1, current + 1, current - 9, current + 9]) {
          if (next < 0 || next >= tiles.length || tiles[next] === '#' || previous.has(next) ||
              Math.abs(Math.floor(current / 9) - Math.floor(next / 9)) + Math.abs(current % 9 - next % 9) !== 1) continue;
          previous.set(next, current); queue.push(next);
        }
      }
      const route = [];
      for (let current = target; current !== 0; current = previous.get(current)) route.unshift(current);
      return route;
    };
    const walk = async steps => { for (const index of steps) await cell(index).click(); };

    await enter('maze');
    assert.equal(await page.locator('.maze-cell').count(), 63);
    await page.locator('#maze-title').focus();
    await page.keyboard.press('ArrowLeft');
    assert.equal(await page.locator('.maze-cell.is-current').getAttribute('data-cell'), '0');
    await walk(await mazeRoute());
    assert.ok(await page.locator('#maze-trail .is-filled').count() >= 1);
    await page.locator('[data-replay="maze"]').click();
    assert.equal(await page.locator('#maze-trail .is-filled').count(), 0);
    await home('maze');

    await enter('puzzle');
    assert.deepEqual(await page.locator('.puzzle-piece').evaluateAll(items => items.map(item => item.dataset.piece).sort()), ['0', '1', '2', '3']);
    await page.locator('.puzzle-piece').first().click();
    assert.equal(await page.locator('.puzzle-slot.is-filled').count(), 0, 'Clicking a piece cannot place it');
    await page.locator('#puzzle-hint').click();
    assert.equal(await page.locator('#puzzle-board').getAttribute('class'), 'puzzle-board');
    await page.locator('#puzzle-hint').click();
    assert.equal(await page.locator('.puzzle-slot.is-filled').count(), 0, 'Picture hint never places pieces');
    await drag('.puzzle-piece[data-piece="0"]', '.puzzle-slot[data-piece="1"]');
    assert.equal(await page.locator('.puzzle-slot.is-filled').count(), 0, 'Wrong location returns piece');
    await drag('.puzzle-piece[data-piece="0"]', '.puzzle-slot[data-piece="0"]', false);
    assert.equal(await page.locator('.puzzle-slot.is-target').count(), 1);
    assert.equal(await page.locator('.puzzle-slot.is-filled').count(), 0, 'Hold cannot complete');
    await page.keyboard.press('Escape'); await page.mouse.up();
    assert.equal(await page.locator('.puzzle-slot.is-filled').count(), 0);
    await drag('.puzzle-piece[data-piece="0"]', '.puzzle-slot[data-piece="0"]', false);
    await page.locator('.puzzle-piece.is-dragging').dispatchEvent('pointercancel'); await page.mouse.up();
    assert.equal(await page.locator('.puzzle-slot.is-filled').count(), 0);
    await drag('.puzzle-piece[data-piece="0"]', '.puzzle-slot[data-piece="0"]', false);
    await page.setViewportSize({ width: 1280, height: 800 }); await page.mouse.up();
    assert.equal(await page.locator('.puzzle-slot.is-filled').count(), 0, 'Resize cancels');
    await page.setViewportSize({ width: 1366, height: 900 });
    for (const total of [4, 6, 6]) {
      assert.equal(await page.locator('.puzzle-piece').count(), total);
      if (total === 6) {
        for (const width of [1920, 1366, 768, 390, 320]) {
          await page.setViewportSize({ width, height: 900 });
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Six piece puzzle fits ' + width);
          await checkControls();
          for (const item of await page.locator('.puzzle-piece, .puzzle-slot').all()) { const r = await item.boundingBox(); assert.ok(r.width >= 100 && r.height >= 80); }
          if (width === 390) await page.screenshot({ path: '.tmp/adventure-games/puzzle-mobile.png', fullPage: true });
        }
        await page.setViewportSize({ width: 1366, height: 900 });
      }
      for (const piece of await page.locator('.puzzle-piece').all()) {
        const index = await piece.getAttribute('data-piece');
        const origin = await piece.boundingBox(), target = await center('.puzzle-slot[data-piece="' + index + '"]');
        await page.mouse.move(origin.x + 18, origin.y + 20); await page.mouse.down();
        await page.mouse.move(target.x - origin.width / 2 + 18, target.y - origin.height / 2 + 20, { steps: 10 }); await page.mouse.up();
        if (await page.locator('.puzzle-slot.is-filled').count() === 2) await page.screenshot({ path: '.tmp/adventure-games/puzzle-' + total + '.png', fullPage: true });
      }
      assert.equal(await page.locator('.puzzle-slot.is-filled').count(), total);
      await settle();
    }
    assert.equal(await page.evaluate(() => localStorage.getItem('littleComputer.puzzlePictures')), '3');
    assert.equal(await page.locator('.puzzle-piece').count(), 4);
    for (const [x, y] of [[.5, .15], [.15, .5], [.85, .5], [.5, .85]]) {
      await page.locator('[data-replay="puzzle"]').click();
      const a = await center('.puzzle-piece[data-piece="0"]'), b = await page.locator('.puzzle-slot[data-piece="0"]').boundingBox();
      await page.mouse.move(a.x, a.y); await page.mouse.down();
      await page.mouse.move(b.x + b.width * x, b.y + b.height * y, { steps: 10 }); await page.mouse.up();
      assert.equal(await page.locator('.puzzle-slot.is-filled').count(), 1, 'Whole target accepts at ' + x + ',' + y);
    }
    await page.locator('[data-replay="puzzle"]').click();
    await page.locator('.puzzle-piece[data-piece="0"]').focus(); await page.keyboard.press('Space');
    const a = await center('.puzzle-piece[data-piece="0"]'), b = await center('.puzzle-slot[data-piece="0"]');
    for (let i = 0; i < Math.round(Math.abs(b.x - a.x) / 24); i++) await page.keyboard.press(b.x > a.x ? 'ArrowRight' : 'ArrowLeft');
    for (let i = 0; i < Math.round(Math.abs(b.y - a.y) / 24); i++) await page.keyboard.press(b.y > a.y ? 'ArrowDown' : 'ArrowUp');
    await page.keyboard.press('Space');
    assert.equal(await page.locator('.puzzle-slot.is-filled').count(), 1, 'Keyboard can place a piece');
    await home('puzzle');

    await enter('music');
    await page.locator('.music-instrument[data-note="drum"]').hover();
    assert.equal(await page.locator('.music-step.is-played').count(), 0, 'Hover is not a note');
    await page.locator('#music-listen').click();
    assert.equal(await page.locator('.music-instrument.is-sounding').count(), 1, 'Demonstration has visual notes');
    assert.ok(await page.locator('.music-instrument').first().isDisabled());
    await page.locator('.music-instrument[data-note="drum"]').dispatchEvent('click');
    await page.waitForTimeout(2350);
    assert.equal(await page.locator('.music-step.is-played').count(), 0, 'Demonstration never plays for the child');
    await page.locator('.music-instrument[data-note="keys"]').click();
    assert.equal(await page.locator('.music-step.is-played').count(), 0, 'Out of order does not advance');
    await page.locator('.music-instrument[data-note="drum"]').click();
    await page.locator('.music-instrument[data-note="keys"]').click();
    assert.equal(await page.locator('.music-step.is-played').count(), 1, 'Wrong note preserves earlier notes');
    await page.locator('#music-hint').click();
    assert.ok(await page.locator('#music-score').evaluate(element => element.classList.contains('is-covered')));
    assert.equal(await page.locator('#music-hint').getAttribute('aria-pressed'), 'false');
    await page.locator('#music-hint').click();
    for (const remaining of [['bell', 'drum'], ['keys', 'drum', 'bell', 'keys'], ['bell', 'shaker', 'drum', 'shaker', 'keys']]) {
      if (remaining.length === 5) {
        for (const width of [1920, 1366, 768, 390, 320]) {
          await page.setViewportSize({ width, height: 900 });
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Five note score fits ' + width);
          await checkControls();
          for (const button of await page.locator('.music-instrument').all()) { const r = await button.boundingBox(); assert.ok(r.width >= 100 && r.height >= 80); }
          if (width === 390) await page.screenshot({ path: '.tmp/adventure-games/music-mobile.png', fullPage: true });
        }
        await page.setViewportSize({ width: 1366, height: 900 });
        await page.screenshot({ path: '.tmp/adventure-games/music.png', fullPage: true });
      }
      for (const note of remaining) await page.locator('.music-instrument[data-note="' + note + '"]').click();
      const record = await page.evaluate(() => localStorage.getItem('littleComputer.musicSongs'));
      await page.locator('.music-instrument').first().dispatchEvent('click');
      assert.equal(await page.evaluate(() => localStorage.getItem('littleComputer.musicSongs')), record, 'Celebration locks repeated input');
      await settle();
    }
    assert.equal(await page.evaluate(() => localStorage.getItem('littleComputer.musicSongs')), '3');
    assert.equal(await page.locator('.music-step').count(), 3, 'Songs cycle');
    for (const note of ['drum', 'bell', 'drum']) {
      await page.locator('.music-instrument[data-note="' + note + '"]').focus(); await page.keyboard.press('Enter');
    }
    await home('music'); await settle();
    assert.ok(await page.locator('#home-screen').isVisible());
    await enter('music');
    await page.locator('#music-listen').click();
    await page.locator('[data-replay="music"]').click();
    await page.locator('.music-instrument[data-note="drum"]').click();
    await page.waitForTimeout(2350);
    assert.equal(await page.locator('.music-step.is-played').count(), 1, 'Replay cancels demonstration timers');
    assert.equal(await page.locator('.music-instrument.is-sounding').count(), 0);
    await page.locator('#music-listen').click();
    await home('music');
    await enter('music');
    await page.locator('.music-instrument[data-note="drum"]').click();
    await page.waitForTimeout(2350);
    assert.equal(await page.locator('.music-step.is-played').count(), 1, 'Exit cancels old demonstration timers');
    await home('music');

    await page.locator('[data-parent]').click();
    const question = await page.locator('#math-question').textContent(), numbers = question.match(/\d+/g).map(Number);
    await page.locator('#math-answer').fill(String(question.includes('+') ? numbers[0] + numbers[1] : numbers[0] - numbers[1]));
    await page.locator('[data-submit-parent]').click();
    for (const [id, value] of [['stat-maze-trips', '0'], ['stat-puzzle-pictures', '3'], ['stat-music-songs', '4']]) assert.equal(await page.locator('#' + id).textContent(), value);
    await page.locator('#parent-screen [data-home]').click();
    await page.locator('#home-screen [data-sound]').click();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    for (const game of ['maze', 'puzzle', 'music']) {
      await enter(game);
      assert.equal(await page.locator('#' + game + '-screen [data-sound]').getAttribute('aria-pressed'), 'false');
      await page.locator('[data-demo="' + game + '"]').click();
      assert.equal(await page.locator('[data-demo-panel="' + game + '"] .demo-mouse i').evaluate(element => getComputedStyle(element).animationName), 'none');
      if (game === 'maze') { await walk(await mazeRoute()); assert.ok(await page.locator('#maze-trail .is-filled').count() >= 1); }
      if (game === 'puzzle') {
        await drag('.puzzle-piece[data-piece="0"]', '.puzzle-slot[data-piece="0"]');
        assert.equal(await page.locator('.puzzle-slot.is-filled').count(), 1);
        for (const index of [1, 2, 3]) await drag('.puzzle-piece[data-piece="' + index + '"]', '.puzzle-slot[data-piece="' + index + '"]');
      }
      if (game === 'music') {
        await page.locator('#music-hint').click();
        await page.locator('#music-listen').click();
        assert.equal(await page.locator('.music-instrument.is-sounding').count(), 1, 'Muted demonstration is still visible');
        await page.waitForTimeout(2350);
        for (const note of ['drum', 'bell', 'drum']) await page.locator('.music-instrument[data-note="' + note + '"]').click();
        assert.equal(await page.locator('.music-step.is-played').count(), 3, 'Covered score still permits playing');
      }
      await home(game); await settle();
      assert.ok(await page.locator('#home-screen').isVisible());
      assert.ok(await page.locator('[data-game="' + game + '"]').evaluate(element => {
        const r = element.getBoundingClientRect(); return document.activeElement === element && r.top >= 0 && r.bottom <= innerHeight;
      }), 'Home focuses a visible entry');
    }
    for (const width of [1920, 1366, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await checkControls();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      if (width === 1366) await page.screenshot({ path: '.tmp/adventure-games/home.png', fullPage: true });
    }
    assert.deepEqual(errors, []);
    assert.deepEqual(external, []);
    console.log('PASS: random maze navigation/replay; puzzle real drag/hint/wrong target/cancel/resize/off-center/full target/keyboard/cycle; music ordered notes/wrong-note/hint/demo locks/keyboard/timers/cycle; parent records; visible home focus; muted play; reduced motion; five viewport sizes/unclipped controls; offline.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
