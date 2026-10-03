const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
    const errors = [], external = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (/^https?:/.test(request.url())) external.push(request.url()); });
    await page.goto(pathToFileURL(path.resolve('index.html')).href);
    const enter = game => page.locator('[data-game="' + game + '"]').click();
    const home = async game => {
      await page.locator('#' + game + '-screen [data-home]').click();
      assert.ok(await page.locator('[data-game="' + game + '"]').evaluate(element => {
        const rect = element.getBoundingClientRect();
        return document.activeElement === element && rect.top >= 0 && rect.bottom <= innerHeight;
      }), 'Returning focuses the visible game entry');
    };
    const settle = () => page.waitForTimeout(1700);
    const center = async selector => {
      const r = await page.locator(selector).first().boundingBox();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    };
    const drag = async (source, target, release = true) => {
      const a = await center(source), b = await center(target);
      await page.mouse.move(a.x, a.y);
      await page.mouse.down();
      await page.mouse.move(b.x, b.y, { steps: 10 });
      if (release) await page.mouse.up();
    };

    await enter('bubbles');
    await page.locator('.bubble-button').first().hover();
    assert.equal(await page.locator('.bubble-button.is-popped').count(), 0, 'Hover never pops a bubble');
    await page.locator('[data-demo="bubbles"]').click();
    assert.equal(await page.locator('.bubble-button.is-popped').count(), 0, 'Demonstration never completes a bubble');
    await page.locator('.bubble-button').first().click();
    await page.locator('.bubble-button').first().dispatchEvent('click');
    assert.equal(await page.locator('.bubble-button.is-popped').count(), 1, 'Repeated clicks cannot pop twice');
    await page.screenshot({ path: '.tmp/new-games/bubbles.png', fullPage: true });
    for (let i = 0; i < 2; i++) await page.locator('.bubble-button:not(:disabled)').first().click();
    assert.equal(await page.evaluate(() => localStorage.getItem('littleComputer.bubbleScenes')), '1');
    await page.waitForTimeout(900);
    assert.equal(await page.locator('.bubble-button.is-popped').count(), 3);
    await page.waitForTimeout(800);
    assert.equal(await page.locator('.bubble-button').count(), 4);
    for (const total of [4, 6]) {
      for (let i = 0; i < total; i++) await page.locator('.bubble-button:not(:disabled)').first().click();
      await settle();
    }
    assert.equal(await page.locator('.bubble-button').count(), 3, 'Bubble scenes cycle');
    assert.equal(await page.evaluate(() => localStorage.getItem('littleComputer.bubbleScenes')), '3');
    for (let i = 0; i < 3; i++) {
      await page.locator('.bubble-button:not(:disabled)').first().focus();
      await page.keyboard.press(i % 2 ? 'Space' : 'Enter');
    }
    await home('bubbles');
    await settle();
    assert.ok(await page.locator('#home-screen').isVisible(), 'Leaving during celebration cancels advancement');
    await enter('bubbles');
    await page.locator('.bubble-button').first().click();
    await page.locator('[data-replay="bubbles"]').click();
    assert.equal(await page.locator('.bubble-button.is-popped').count(), 0, 'Replay starts fresh');
    await home('bubbles');

    await enter('memory');
    await page.locator('.memory-card').first().hover();
    assert.equal(await page.locator('.memory-card.is-open').count(), 0);
    await page.locator('#memory-hint').click();
    assert.equal(await page.locator('.memory-front:visible').count(), 4, 'Hints expose pictures');
    assert.equal(await page.locator('.memory-card.is-matched').count(), 0, 'Hints never match cards');
    await page.locator('#memory-hint').click();
    const firstKind = await page.locator('.memory-card').first().getAttribute('data-picture');
    await page.locator('.memory-card').first().click();
    await page.locator('.memory-card').first().dispatchEvent('click');
    assert.equal(await page.locator('.memory-card.is-open').count(), 1, 'A card cannot match itself');
    await page.locator('.memory-card:not([data-picture="' + firstKind + '"])').first().click();
    await page.locator('.memory-card:not(.is-open)').first().click();
    assert.equal(await page.locator('.memory-card.is-open').count(), 2, 'A third card waits for the mismatched pair to close');
    assert.equal(await page.locator('.memory-card.is-matched').count(), 0);
    await page.waitForTimeout(1250);
    assert.equal(await page.locator('.memory-card.is-open').count(), 0, 'Mismatches close gently');
    await page.locator('#memory-hint').click();
    await page.screenshot({ path: '.tmp/new-games/memory.png', fullPage: true });
    for (const pairs of [2, 3, 4]) {
      assert.equal(await page.locator('.memory-card').count(), pairs * 2);
      if (pairs === 4) {
        for (const width of [768, 390, 320]) {
          await page.setViewportSize({ width, height: 900 });
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Eight cards fit ' + width);
        }
        await page.setViewportSize({ width: 1366, height: 768 });
      }
      const kinds = await page.locator('.memory-card').evaluateAll(cards => [...new Set(cards.map(card => card.dataset.picture))]);
      for (const kind of kinds) {
        const pair = page.locator('.memory-card[data-picture="' + kind + '"]');
        await pair.nth(0).click();
        await pair.nth(1).click();
      }
      assert.equal(await page.locator('.memory-card.is-matched').count(), pairs * 2, 'Matched pictures stay visible');
      await settle();
    }
    assert.equal(await page.locator('.memory-card').count(), 4);
    assert.equal(await page.evaluate(() => localStorage.getItem('littleComputer.memoryBoards')), '3');
    for (const kind of await page.locator('.memory-card').evaluateAll(cards => [...new Set(cards.map(card => card.dataset.picture))])) {
      for (const card of await page.locator('.memory-card[data-picture="' + kind + '"]').all()) {
        await card.focus();
        await page.keyboard.press('Enter');
      }
    }
    await home('memory');
    await settle();
    assert.ok(await page.locator('#home-screen').isVisible());
    await enter('memory');
    const kind = await page.locator('.memory-card').first().getAttribute('data-picture');
    await page.locator('.memory-card').first().click();
    await page.locator('.memory-card:not([data-picture="' + kind + '"])').first().click();
    await page.locator('[data-replay="memory"]').click();
    await page.waitForTimeout(1250);
    assert.equal(await page.locator('.memory-card.is-open').count(), 0, 'Replay cancels the old mismatch callback');
    await home('memory');

    await enter('train');
    await page.locator('.train-piece').first().click();
    assert.equal(await page.locator('.train-slot.is-filled').count(), 0, 'Clicking alone never delivers a shape');
    await drag('.train-piece[data-shape="circle"]', '.train-slot[data-shape="square"]');
    assert.equal(await page.locator('.train-slot.is-filled').count(), 0, 'Wrong shape returns');
    await drag('.train-piece[data-shape="circle"]', '.train-slot[data-shape="circle"]', false);
    assert.equal(await page.locator('.train-slot.is-target').count(), 1);
    assert.equal(await page.locator('.train-slot.is-filled').count(), 0, 'Holding inside a slot cannot complete delivery');
    await page.keyboard.press('Escape');
    await page.mouse.up();
    assert.equal(await page.locator('.train-slot.is-filled').count(), 0);
    await drag('.train-piece[data-shape="circle"]', '.train-slot[data-shape="circle"]', false);
    await page.locator('.train-piece.is-dragging').dispatchEvent('pointercancel');
    await page.mouse.up();
    assert.equal(await page.locator('.train-piece.is-dragging').count(), 0);
    assert.equal(await page.locator('.train-slot.is-filled').count(), 0);
    await drag('.train-piece[data-shape="circle"]', '.train-slot[data-shape="circle"]', false);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.mouse.up();
    assert.equal(await page.locator('.train-slot.is-filled').count(), 0, 'Resize cancels dragging');
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.screenshot({ path: '.tmp/new-games/train.png', fullPage: true });
    for (const total of [3, 3, 4]) {
      assert.equal(await page.locator('.train-piece').count(), total);
      if (total === 4) {
        for (const width of [768, 390, 320]) {
          await page.setViewportSize({ width, height: 900 });
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Four slots fit ' + width);
        }
        await page.setViewportSize({ width: 1366, height: 768 });
      }
      for (const piece of await page.locator('.train-piece').all()) {
        const shape = await piece.getAttribute('data-shape');
        const a = await piece.boundingBox(), b = await center('.train-slot[data-shape="' + shape + '"]');
        // Pick off center to verify that the object center defines acceptance.
        await page.mouse.move(a.x + 18, a.y + 20);
        await page.mouse.down();
        await page.mouse.move(b.x - a.width / 2 + 18, b.y - a.height / 2 + 20, { steps: 10 });
        await page.mouse.up();
      }
      assert.equal(await page.locator('.train-slot.is-filled').count(), total);
      await settle();
    }
    assert.equal(await page.evaluate(() => localStorage.getItem('littleComputer.trainTrips')), '3');
    assert.equal(await page.locator('.train-piece').count(), 3);
    await page.locator('.train-piece').first().focus();
    await page.keyboard.press('Space');
    const a = await center('.train-piece'), b = await center('.train-slot[data-shape="circle"]');
    for (let i = 0; i < Math.round(Math.abs(b.x - a.x) / 24); i++) await page.keyboard.press(b.x > a.x ? 'ArrowRight' : 'ArrowLeft');
    for (let i = 0; i < Math.round(Math.abs(b.y - a.y) / 24); i++) await page.keyboard.press(b.y > a.y ? 'ArrowDown' : 'ArrowUp');
    await page.keyboard.press('Space');
    assert.equal(await page.locator('.train-slot.is-filled').count(), 1, 'Keyboard grab/move/release delivers');
    for (const [x, y] of [[.5, .15], [.15, .5], [.85, .5], [.5, .5], [.5, .85]]) {
      await page.locator('[data-replay="train"]').click();
      const origin = await center('.train-piece'), target = await page.locator('.train-slot[data-shape="circle"]').boundingBox();
      await page.mouse.move(origin.x, origin.y);
      await page.mouse.down();
      await page.mouse.move(target.x + target.width * x, target.y + target.height * y, { steps: 10 });
      assert.equal(await page.locator('.train-slot.is-target').count(), 1, 'Full slot highlights at ' + x + ',' + y);
      await page.mouse.up();
      assert.equal(await page.locator('.train-slot.is-filled').count(), 1, 'Full slot accepts at ' + x + ',' + y);
    }
    await home('train');

    for (const width of [1920, 1366, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await enter('bubbles');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      for (const button of await page.locator('.bubble-button').all()) {
        const r = await button.boundingBox();
        assert.ok(r.width >= 100 && r.height >= 80);
      }
      if (width === 390) await page.screenshot({ path: '.tmp/new-games/bubbles-mobile.png', fullPage: true });
      await home('bubbles');
      await enter('memory');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      for (const card of await page.locator('.memory-card').all()) {
        const r = await card.boundingBox();
        assert.ok(r.width >= 100 && r.height >= 80);
      }
      if (width === 390) await page.screenshot({ path: '.tmp/new-games/memory-mobile.png', fullPage: true });
      await home('memory');
      await enter('train');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      for (const element of await page.locator('.train-piece, .train-slot').all()) {
        const r = await element.boundingBox();
        assert.ok(r.width >= 100 && r.height >= 80);
      }
      if (width === 390) await page.screenshot({ path: '.tmp/new-games/train-mobile.png', fullPage: true });
      await home('train');
    }
    await page.locator('[data-parent]').click();
    const question = await page.locator('#math-question').textContent();
    const numbers = question.match(/\d+/g).map(Number);
    await page.locator('#math-answer').fill(String(question.includes('+') ? numbers[0] + numbers[1] : numbers[0] - numbers[1]));
    await page.locator('[data-submit-parent]').click();
    for (const [id, value] of [['stat-bubble-scenes', '4'], ['stat-memory-boards', '4'], ['stat-train-trips', '3']]) {
      assert.equal(await page.locator('#' + id).textContent(), value, 'Parent page reads completed scenes');
    }
    await page.locator('#parent-screen [data-home]').click();
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.locator('#home-screen [data-sound]').click();
    for (const game of ['bubbles', 'memory', 'train']) {
      await enter(game);
      assert.equal(await page.locator('#' + game + '-screen [data-sound]').getAttribute('aria-pressed'), 'false');
      assert.equal(await page.locator('#' + game + '-screen .discovery-stage').evaluate(element => getComputedStyle(element).animationName), 'none');
      if (game === 'bubbles') {
        await page.locator('.bubble-button').first().click();
        assert.equal(await page.locator('.bubble-button.is-popped').count(), 1, 'Muted click retains visual response');
        assert.equal(await page.locator('.bubble-button.is-popped svg').first().evaluate(element => getComputedStyle(element).animationName), 'none');
      } else if (game === 'memory') {
        const kind = await page.locator('.memory-card').first().getAttribute('data-picture');
        await page.locator('.memory-card').first().click();
        await page.locator('.memory-card:not([data-picture="' + kind + '"])').first().click();
        await home('memory');
        await enter('memory');
        await page.locator('.memory-card').first().click();
        await page.waitForTimeout(1250);
        assert.equal(await page.locator('.memory-card.is-open').count(), 1, 'Leaving cancels old mismatch timer');
      } else {
        await drag('.train-piece[data-shape="circle"]', '.train-slot[data-shape="circle"]');
        assert.equal(await page.locator('.train-slot.is-filled').count(), 1, 'Muted drag retains visual response');
      }
      await home(game);
    }
    assert.deepEqual(errors, []);
    assert.deepEqual(external, []);
    console.log('PASS: bubbles click/keyboard/demo/replay/scenes; memory hints/mismatch/duplicate/keyboard/replay/exit/boards; train matching/full targets/cancel/resize/off-center/keyboard/scenes; transition exit; visible home focus; parent records; muted play; reduced motion; five viewport sizes; offline.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
