const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const { trace } = require('../games/pipes-path.js');
const solutions = [
  { cells: [0, 0, 0, 10, 10, 10, 0, 0, 0], source: 1, goal: 1, length: 3 },
  { cells: [10, 12, 0, 0, 5, 0, 0, 3, 10], source: 0, goal: 2, length: 5 },
  { cells: [0, 6, 10, 0, 5, 0, 10, 9, 0], source: 2, goal: 0, length: 5 },
  { cells: [10, 12, 0, 6, 9, 0, 3, 10, 10], source: 0, goal: 2, length: 7 },
  { cells: [10, 10, 12, 6, 10, 9, 3, 10, 10], source: 0, goal: 2, length: 9 },
];
for (const solution of solutions) {
  const result = trace(solution.cells, 3, solution.source, solution.goal);
  assert.equal(result.complete, true, 'Known route reaches the garden');
  assert.equal(result.wet.length, solution.length);
}
assert.deepEqual(trace([0, 0, 0, 5, 10, 10, 0, 0, 0], 3, 1, 1), { wet: [], blocked: 3, complete: false }, 'Source requires a left opening');
assert.deepEqual(trace([0, 0, 0, 10, 5, 10, 0, 0, 0], 3, 1, 1), { wet: [3], blocked: 4, complete: false }, 'Adjacent pipe must face the incoming opening');
assert.equal(trace(solutions[0].cells, 3, 1, 0).complete, false, 'Wrong exit row cannot water the garden');
assert.deepEqual(trace([12, 0, 0, 0, 0, 0, 0, 0, 0], 3, 0, 0), { wet: [0], blocked: 0, complete: false }, 'A pipe aimed at grass points back to its own turnable tile');
assert.equal(trace([9, 0, 0, 0, 0, 0, 0, 0, 0], 3, 0, 0).complete, false, 'Top boundary stops water');
assert.equal(trace([10, 10, 10, 10, 10, 10, 10, 10, 10], 3, 0, 2).complete, false, 'Right boundary never wraps into another row');
assert.equal(trace([6, 12, 0, 3, 9, 0, 0, 0, 0], 3, 0, 0).complete, false, 'Closed disconnected loop is not a source-to-garden route');
assert.equal(trace([14, 10, 10, 0, 0, 0, 0, 0, 0], 3, 0, 0).complete, false, 'A three-way pipe cannot be treated as a two-ended pipe');

(async () => {
  fs.mkdirSync('.tmp/pipes-game', { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
    const errors = [], external = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (/^https?:/.test(request.url())) external.push(request.url()); });
    const url = pathToFileURL(path.resolve('index.html')).href;
    await page.goto(url);
    assert.equal(await page.locator('[data-game]').count(), 22);
    assert.ok(await page.locator('.home-note').evaluate(node => node.getBoundingClientRect().bottom <= innerHeight), 'Twenty home entries still fit a desktop screen');
    const enter = () => page.locator('[data-game="pipes"]').click();
    const home = () => page.locator('#pipes-screen [data-home]').click();
    const masks = () => page.locator('#pipes-board > *').evaluateAll(nodes => nodes.map(node => Number(node.dataset.mask || 0)));
    const tile = index => page.locator('#pipes-board button[data-cell="' + index + '"]');
    const water = page.locator('#pipes-water');
    const stage = page.locator('#pipes-stage');
    const record = () => page.evaluate(() => Number(localStorage.getItem('littleComputer.pipeGardens') || 0));
    const flowDone = (scope = page) => scope.waitForFunction(() => !document.querySelector('#pipes-stage').classList.contains('is-flowing'), null, { timeout: 7000 });
    const settle = async () => { await flowDone(); await page.waitForTimeout(1600); };
    const instrumentAudio = scope => scope.evaluate(() => {
      const startWater = window.GameAudio.startWater;
      window.__waterAudio = { starts: 0, stops: 0, active: 0 };
      window.GameAudio.startWater = function (...args) {
        const stats = window.__waterAudio;
        stats.starts++; stats.active++;
        const stop = startWater.apply(this, args);
        let stopped = false;
        return () => {
          if (!stopped) { stopped = true; stats.stops++; stats.active--; }
          stop();
        };
      };
    });
    const audio = () => page.evaluate(() => ({ ...window.__waterAudio }));
    const assertDirectedPaths = async (scope, solution) => {
      const route = trace(solution.cells, 3, solution.source, solution.goal).wet;
      const geometry = await scope.locator('.pipe-tile .pipe-water').evaluateAll(nodes => Object.fromEntries(nodes.map(node => {
        const first = node.getPointAtLength(0), last = node.getPointAtLength(node.getTotalLength());
        return [node.closest('.pipe-tile').dataset.cell, [[first.x, first.y], [last.x, last.y]]];
      })));
      const endpoint = (index, next) => next === index - 3 ? [50, 0] : next === index + 1 ? [100, 50] : next === index + 3 ? [50, 100] : [0, 50];
      route.forEach((index, position) => {
        const incoming = position ? endpoint(index, route[position - 1]) : [0, 50];
        const outgoing = position < route.length - 1 ? endpoint(index, route[position + 1]) : [100, 50];
        assert.deepEqual(geometry[index], [incoming, outgoing], 'Water path follows the actual entry and exit at cell ' + index);
      });
    };
    await instrumentAudio(page);
    const solve = async (target, keyboard = false, scope = page) => {
      for (let index = 0; index < 9; index++) {
        if (!target[index]) continue;
        const button = scope.locator('#pipes-board button[data-cell="' + index + '"]');
        for (let turn = 0; Number(await button.getAttribute('data-mask')) !== target[index]; turn++) {
          assert.ok(turn < 4, 'Every generated tile can rotate to the known solution');
          if (keyboard) { await button.focus(); await scope.keyboard.press('Enter'); }
          else await button.click();
        }
      }
    };
    await enter();
    assert.ok(await page.locator('[data-demo-panel="pipes"]').isVisible());
    await page.locator('[data-demo-panel="pipes"] [data-close-demo]').click();
    const initial = await masks();
    assert.equal(trace(initial, 3, 1, 1).complete, false, 'Initial route never starts solved');
    await tile(3).hover(); assert.deepEqual(await masks(), initial);
    const box = await tile(3).boundingBox();
    await page.mouse.move(box.x + 20, box.y + 20); await page.mouse.down();
    assert.deepEqual(await masks(), initial, 'Holding does not rotate');
    await page.mouse.move(1, 1); await page.mouse.up(); assert.deepEqual(await masks(), initial, 'Cancelled click does not rotate');
    await page.locator('#pipes-hint').click();
    assert.deepEqual(await masks(), initial, 'Hint never rotates a pipe');
    assert.equal(await page.locator('#pipes-board .is-blocked').count(), 1);
    assert.equal(await page.locator('#pipes-board .is-wet').count(), 0, 'Hint never releases water');
    await solve([0, 0, 0, 10, 5, 0, 0, 0, 0]);
    const broken = await masks();
    await water.click();
    assert.ok(await stage.evaluate(node => node.classList.contains('is-flowing')), 'Broken routes also animate from the tap');
    assert.equal(await record(), 0, 'Release does not record a garden before water arrives');
    assert.equal(await page.locator('.pipes-bloom').isVisible(), false);
    assert.deepEqual(await audio(), { starts: 1, stops: 0, active: 1 }, 'A single water sound lives for the flow');
    await flowDone();
    assert.deepEqual(await masks(), broken, 'Broken water route retains all pipe directions');
    assert.equal(await record(), 0);
    assert.equal(await page.locator('#pipes-board .is-wet').count(), 1);
    assert.equal(await tile(4).evaluate(node => node.classList.contains('is-blocked')), true, 'Water stops at the first disconnected opening');
    assert.ok(await water.isEnabled());
    assert.deepEqual(await audio(), { starts: 1, stops: 1, active: 0 }, 'Failed flow stops its sound exactly once');
    await page.locator('#pipes-screen [data-demo]').click();
    await page.waitForTimeout(200); assert.deepEqual(await masks(), broken); assert.equal(await record(), 0);
    await page.locator('[data-demo-panel="pipes"] [data-close-demo]').click();
    await page.screenshot({ path: '.tmp/pipes-game/initial-desktop.png', fullPage: true });
    for (let level = 0; level < 5; level++) {
      const before = await masks(), solution = solutions[level];
      assert.equal(trace(before, 3, solution.source, solution.goal).complete, false);
      await solve(solution.cells);
      assert.equal(await record(), level, 'Solving alone never counts completion');
      await page.locator('#pipes-hint').click();
      assert.equal(await page.locator('#pipes-board .is-wet').count(), 0, 'Solved hint still does not release water');
      const audioBefore = await audio();
      await water.click();
      assert.ok(await stage.evaluate(node => node.classList.contains('is-flowing')));
      assert.equal(await record(), level, 'Gardens only count when the last water segment arrives');
      assert.equal(await page.locator('.pipes-bloom').isVisible(), false);
      assert.ok(await water.isDisabled()); assert.ok(await page.locator('#pipes-hint').isDisabled());
      assert.ok(await page.locator('.pipe-tile').evaluateAll(nodes => nodes.every(node => node.disabled)), 'All rotations are locked while water moves');
      await water.dispatchEvent('click'); await tile(solution.source * 3).dispatchEvent('click'); await page.locator('#pipes-hint').dispatchEvent('click');
      assert.deepEqual(await masks(), solution.cells);
      assert.equal((await audio()).starts, audioBefore.starts + 1, 'Repeated release cannot create another water sound');
      const route = trace(solution.cells, 3, solution.source, solution.goal).wet;
      await page.waitForFunction(index => document.querySelector('[data-cell="' + index + '"]').classList.contains('is-filling'), route[0]);
      assert.equal(await tile(route.at(-1)).evaluate(node => node.classList.contains('is-wet')), false, 'Last pipe waits for the leading water');
      if (level === 0) await page.screenshot({ path: '.tmp/pipes-game/flow-desktop.png', fullPage: true });
      await page.waitForFunction(index => document.querySelector('[data-cell="' + index + '"]').classList.contains('is-filling'), route[1]);
      assert.ok(await tile(route[0]).evaluate(node => node.classList.contains('is-wet')), 'Finished segments retain their water while the next fills');
      assert.equal(await record(), level);
      await flowDone();
      assert.equal(await record(), level + 1, 'Celebration blocks repeated releases and rotations');
      assert.deepEqual(await masks(), solution.cells);
      assert.equal(await page.locator('#pipes-board .is-wet').count(), solution.length);
      assert.ok(await water.isDisabled()); assert.ok(await page.locator('#level-transition').isVisible());
      assert.ok(await page.locator('.pipes-bloom').isVisible());
      assert.deepEqual(await audio(), { starts: audioBefore.starts + 1, stops: audioBefore.stops + 1, active: 0 }, 'Successful flow stops its water sound before celebrating');
      await assertDirectedPaths(page, solution);
      if (level === 4) await page.screenshot({ path: '.tmp/pipes-game/bloom-desktop.png', fullPage: true });
      await settle();
    }
    assert.equal(await page.locator('#pipes-level').textContent(), '直直的小水路');
    assert.notDeepEqual(await masks(), initial, 'Next round changes the pipe directions');
    await tile(3).focus(); const beforeKey = (await masks())[3]; await page.keyboard.press('Space');
    assert.equal((await masks())[3], ((beforeKey << 1) & 15) | (beforeKey >> 3));
    await page.keyboard.press('ArrowRight'); assert.equal(await page.evaluate(() => document.activeElement.dataset.cell), '4');
    await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight');
    assert.equal(await page.evaluate(() => document.activeElement.dataset.cell), '5', 'Arrow focus never wraps rows');
    await solve(solutions[0].cells, true); await water.focus(); await page.keyboard.press('Enter'); await settle();
    assert.equal(await page.evaluate(() => document.activeElement.dataset.cell), '0', 'Keyboard completion focuses next board');
    await home(); assert.equal(await page.locator('[data-game="pipes"]').evaluate(node => node === document.activeElement), true);
    for (const width of [1920, 1366, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 900 }); await enter();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Page has no horizontal overflow at ' + width);
      assert.ok(await page.locator('#pipes-screen header button, #pipes-screen footer button, .pipes-actions button, .pipe-tile').evaluateAll(nodes => nodes.every(node => { const r = node.getBoundingClientRect(); return r.width >= 99 && r.height >= 79; })), 'Large targets at ' + width);
      assert.ok(await page.locator('#pipes-screen header button, #pipes-screen footer button, .pipes-actions button').evaluateAll(nodes => nodes.every(node => { const r = node.getBoundingClientRect(); return r.left >= -1 && r.right <= innerWidth + 1; })), 'Navigation is never clipped');
      const view = page.locator('.pipes-view');
      const size = await view.evaluate(node => [node.scrollWidth, node.scrollHeight]);
      await tile(3).hover(); await tile(5).hover();
      assert.deepEqual(await view.evaluate(node => [node.scrollWidth, node.scrollHeight]), size, 'Hover never changes scroll extents');
      await solve(solutions[0].cells); await water.click();
      assert.deepEqual(await view.evaluate(node => [node.scrollWidth, node.scrollHeight]), size, 'Tap animation keeps scroll extents at ' + width);
      await page.waitForFunction(() => document.querySelector('[data-cell="3"]').classList.contains('is-filling'));
      assert.deepEqual(await view.evaluate(node => [node.scrollWidth, node.scrollHeight]), size, 'Moving water keeps scroll extents at ' + width);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Flow creates no page overflow at ' + width);
      await flowDone();
      assert.deepEqual(await view.evaluate(node => [node.scrollWidth, node.scrollHeight]), size, 'Bloom keeps scroll extents at ' + width);
      await home();
    }
    await enter();
    for (let level = 0; level < 5; level++) {
      await solve(solutions[level].cells); await water.click();
      await flowDone();
      if (level === 4) await page.screenshot({ path: '.tmp/pipes-game/bloom-narrow.png', fullPage: true });
      await settle();
    }
    const previous = await masks(); await page.locator('#pipes-screen [data-replay]').click();
    assert.notDeepEqual(await masks(), previous, 'Replay changes the board without clearing records');
    const beforeCancel = await record();
    await solve(solutions[0].cells); await water.click();
    await page.waitForFunction(() => document.querySelector('[data-cell="3"]').classList.contains('is-filling'));
    await home(); await settle();
    assert.equal(await record(), beforeCancel, 'Leaving before water arrives never records completion');
    assert.equal((await audio()).active, 0, 'Leaving stops the water sound');
    assert.equal(await page.locator('.is-filling').count(), 0, 'Leaving clears moving water');
    await enter(); await solve(solutions[0].cells); await water.click();
    await page.locator('#pipes-screen [data-replay]').click(); await settle();
    assert.equal(await record(), beforeCancel, 'Replay during water movement never records completion');
    assert.equal((await audio()).active, 0, 'Replay stops the water sound');
    assert.ok(await stage.evaluate(node => !node.classList.contains('is-flowing')));
    assert.equal(await page.locator('#pipes-board .is-wet').count(), 0, 'Replay clears the cancelled flow');
    await solve(solutions[0].cells); await water.click(); await flowDone();
    const completed = await record(); await home(); await settle();
    assert.ok(await page.locator('#home-screen').isVisible()); assert.ok(await page.locator('#level-transition').isHidden());
    await enter(); await solve(solutions[0].cells); await water.click(); await flowDone();
    await page.locator('#pipes-screen [data-replay]').click(); await settle();
    assert.equal(await page.locator('#pipes-level').textContent(), '直直的小水路'); assert.ok(await page.locator('#level-transition').isHidden());
    assert.equal(await record(), completed + 1);
    await solve(solutions[0].cells); await water.click();
    await page.waitForFunction(() => document.querySelector('[data-cell="3"]').classList.contains('is-filling'));
    await page.emulateMedia({ reducedMotion: 'reduce' }); await flowDone();
    assert.equal(await record(), completed + 2, 'Enabling reduced motion finishes the existing route once');
    assert.equal(await page.locator('#pipes-board .is-wet').count(), 3);
    assert.equal(await page.locator('.is-filling').count(), 0);
    assert.equal((await audio()).active, 0, 'Reduced motion stops the running water sound');
    await home(); await page.emulateMedia({ reducedMotion: 'no-preference' }); await enter();
    await page.locator('#pipes-screen [data-sound]').click();
    await solve(solutions[0].cells); const mutedAudio = await audio(); await water.click();
    assert.equal((await audio()).starts, mutedAudio.starts + 1);
    await page.locator('#pipes-screen [data-sound]').click();
    assert.equal(await page.locator('#pipes-screen [data-sound]').textContent(), '声音：开');
    assert.ok(await stage.evaluate(node => node.classList.contains('is-flowing')), 'Unmuting preserves the current water movement');
    await page.locator('#pipes-screen [data-sound]').click(); await flowDone();
    assert.equal((await audio()).starts, mutedAudio.starts + 1, 'Sound toggles never restart a flowing sound');
    assert.equal((await audio()).active, 0);
    assert.equal(await record(), completed + 3, 'Muted water remains playable');
    await home(); await enter();
    assert.equal(await page.locator('#pipes-screen [data-sound]').textContent(), '声音：关');
    await page.evaluate(() => { refreshParentPage(); window.showScreen('parent'); });
    assert.equal(await page.locator('#stat-pipe-gardens').textContent(), String(completed + 3));
    const fallback = await browser.newPage({ viewport: { width: 320, height: 900 }, reducedMotion: 'reduce' });
    fallback.on('pageerror', error => errors.push(error.message));
    fallback.on('request', request => { if (/^https?:/.test(request.url())) external.push(request.url()); });
    await fallback.addInitScript(() => {
      Math.random = () => 0;
      Object.defineProperty(window, 'localStorage', { get() { throw new Error('unavailable'); } });
      window.AudioContext = undefined; window.webkitAudioContext = undefined;
    });
    await fallback.goto(url); await instrumentAudio(fallback); await fallback.locator('[data-game="pipes"]').click();
    const fixed = await fallback.locator('.pipe-tile').evaluateAll(nodes => nodes.map(node => node.dataset.mask));
    await fallback.locator('#pipes-screen [data-replay]').click();
    assert.notDeepEqual(await fallback.locator('.pipe-tile').evaluateAll(nodes => nodes.map(node => node.dataset.mask)), fixed, 'Fixed randomness still gives a different replay');
    await solve(solutions[0].cells, false, fallback); await fallback.locator('#pipes-water').click();
    assert.equal(await fallback.locator('#pipes-board .is-wet').count(), 3, 'Reduced motion immediately draws static water');
    assert.equal(await fallback.locator('.is-filling').count(), 0, 'Reduced motion skips segment movement');
    assert.equal(await fallback.locator('.pipes-bloom').isVisible(), false, 'Short water sound still precedes the static bloom');
    await flowDone(fallback);
    assert.deepEqual(await fallback.evaluate(() => ({ ...window.__waterAudio })), { starts: 1, stops: 1, active: 0 }, 'Unavailable audio still returns a usable flow cleanup');
    assert.equal(await fallback.locator('.pipes-bloom').evaluate(node => getComputedStyle(node).animationName), 'none');
    await fallback.waitForTimeout(1600); assert.equal(await fallback.locator('.pipe-tile').count(), 5);
    assert.deepEqual(errors, []); assert.deepEqual(external, []);
    console.log('PASS pipes: reciprocal routes and boundaries; five solvable/random boards; real clicks; directed progressive water; arrival-only records; broken-route retention; water-sound cleanup and mute; duplicate lock; keyboard; return/replay cancellation; stable scroll extents at five widths; narrow completion; optional storage/audio; reduced motion and live changes; offline');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
