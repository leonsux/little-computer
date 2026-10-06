const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

function neighbors(index) {
  return [index - 1, index + 1, index - 9, index + 9].filter(next => next >= 0 && next < 63 &&
    Math.abs(Math.floor(index / 9) - Math.floor(next / 9)) + Math.abs(index % 9 - next % 9) === 1);
}
function route(tiles, start, target) {
  const queue = [start], previous = new Map([[start, -1]]);
  for (let offset = 0; offset < queue.length; offset += 1) {
    for (const next of neighbors(queue[offset])) {
      if (tiles[next] === '#' || previous.has(next)) continue;
      previous.set(next, queue[offset]); queue.push(next);
    }
  }
  assert.ok(previous.has(target), 'Target is reachable');
  const result = [];
  for (let current = target; current !== start; current = previous.get(current)) result.unshift(current);
  return result;
}
function terrain(tiles) { return tiles.map(tile => tile === '#' ? '#' : '.').join(''); }

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
    const errors = [], external = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (/^https?:/.test(request.url())) external.push(request.url()); });
    await page.addInitScript(() => {
      window.mazeAudioFrequencies = [];
      const start = OscillatorNode.prototype.start;
      OscillatorNode.prototype.start = function (...args) {
        window.mazeAudioFrequencies.push(this.frequency.value);
        return start.apply(this, args);
      };
    });
    await page.goto(pathToFileURL(path.resolve('index.html')).href);
    const enter = () => page.locator('[data-game="maze"]').click();
    const home = () => page.locator('#maze-screen [data-home]').click();
    const read = () => page.locator('.maze-cell').evaluateAll(cells => cells.map(cell => cell.dataset.tile));
    const position = async () => Number(await page.locator('.maze-cell.is-current').getAttribute('data-cell'));
    const go = async (tiles, target, mouse = false) => {
      let current = await position();
      for (const next of route(tiles, current, target)) {
        if (mouse) await page.locator('.maze-cell[data-cell="' + next + '"]').click();
        else {
          await page.keyboard.press(next - current === 1 ? 'ArrowRight' : next - current === -1 ? 'ArrowLeft' : next > current ? 'ArrowDown' : 'ArrowUp');
        }
        assert.equal(await position(), next, 'Each action moves exactly one cell');
        current = next;
      }
    };

    await enter();
    let tiles = await read();
    assert.equal(tiles.length, 63);
    assert.equal(tiles.filter(tile => tile === 'c').length, 6);
    await page.locator('#maze-title').focus();
    await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowUp');
    assert.equal(await position(), 0, 'Map boundaries cannot be crossed');
    const first = neighbors(0).find(index => tiles[index] !== '#');
    await page.keyboard.press(first === 1 ? 'ArrowRight' : 'ArrowDown');
    assert.equal(await position(), first, 'Arrows work immediately after entering, without selecting a road');
    const wall = neighbors(first).find(index => tiles[index] === '#');
    if (wall !== undefined) {
      await page.keyboard.press(wall - first === 1 ? 'ArrowRight' : wall - first === -1 ? 'ArrowLeft' : wall > first ? 'ArrowDown' : 'ArrowUp');
      assert.equal(await position(), first, 'Arrow cannot cross a tree');
    }
    await go(tiles, 0);
    await page.locator('.maze-cell[data-cell="62"]').click();
    assert.equal(await position(), 0, 'Click cannot jump across the map');
    await page.locator('[data-demo="maze"]').click();
    assert.equal(await page.locator('#maze-trail .is-filled').count(), 0, 'Demo does not collect');
    await page.locator('[data-close-demo]:visible').click();
    await page.screenshot({ path: '.tmp/maze-random/desktop.png', fullPage: true });

    const pickup = tiles.flatMap((tile, index) => tile === 'c' ? [index] : [])
      .sort((a, b) => route(tiles, 0, a).length - route(tiles, 0, b).length)[0];
    const pickupRoute = route(tiles, 0, pickup), previousCell = pickupRoute.at(-2);
    await page.locator('#maze-title').focus();
    await go(tiles, pickup);
    const effect = page.locator('.maze-cell[data-cell="' + pickup + '"]');
    assert.ok(await effect.evaluate(cell => cell.classList.contains('is-collecting')));
    assert.equal(await page.evaluate(() => window.mazeAudioFrequencies.filter(value => value === 1047).length), 1, 'Pickup plays its own short high note');
    assert.equal(await effect.evaluate(cell => getComputedStyle(cell, '::before').pointerEvents), 'none');
    assert.equal(await effect.evaluate(cell => getComputedStyle(cell, '::after').pointerEvents), 'none');
    assert.equal(await page.locator('#level-transition').isVisible(), false, 'Pickup does not open a blocking celebration');
    await page.keyboard.press(previousCell - pickup === 1 ? 'ArrowRight' : previousCell - pickup === -1 ? 'ArrowLeft' : previousCell > pickup ? 'ArrowDown' : 'ArrowUp');
    assert.equal(await position(), previousCell, 'Arrow movement continues immediately during pickup');
    assert.ok(await effect.evaluate(cell => cell.classList.contains('is-collecting')), 'The next render retains the local effect');
    await effect.click();
    assert.equal(await position(), pickup, 'Mouse input also works while the effect is showing');
    assert.equal(await page.evaluate(() => window.mazeAudioFrequencies.filter(value => value === 1047).length), 1, 'Revisiting does not replay the pickup sound');
    await page.waitForTimeout(600);
    assert.equal(await page.locator('.maze-cell.is-collecting').count(), 0, 'Effects clean up after a short pulse');
    await home(); await enter(); tiles = await read();

    // Check many generated maps independently from the generator, including a fixed RNG.
    const maps = await page.evaluate(() => {
      const result = [], original = Math.random;
      try {
        for (const mode of ['random', 'zero', 'high']) {
          Math.random = mode === 'random' ? original : () => mode === 'zero' ? 0 : .999999;
          for (let index = 0; index < (mode === 'random' ? 500 : 100); index += 1) {
            window.MazeGame.start();
            result.push([...document.querySelectorAll('.maze-cell')].map(cell => cell.dataset.tile));
          }
        }
      } finally { Math.random = original; }
      return result;
    });
    let previous = terrain(tiles);
    for (const map of maps) {
      assert.notEqual(terrain(map), previous, 'Terrain changes even with a fixed random generator');
      assert.equal(map.filter(tile => tile === 'c').length, 6);
      assert.equal(map.filter(tile => tile !== '#').length, 39);
      for (let index = 0; index < map.length; index++) if (map[index] !== '#') route(map, 0, index);
      previous = terrain(map);
    }
    await home(); await enter();
    assert.notEqual(terrain(await read()), previous);
    previous = terrain(await read());
    await page.reload(); await enter();
    assert.notEqual(terrain(await read()), previous, 'New terrain also differs after refreshing');

    await page.locator('#maze-title').focus();
    tiles = await read();
    await go(tiles, 8);
    await page.keyboard.press('ArrowRight');
    assert.equal(await position(), 8, 'Right edge does not wrap into the next row');
    await page.locator('[data-replay="maze"]').click();
    // Find a fresh map with a collectible off the direct home route to exercise early return.
    for (let attempt = 0; attempt < 100; attempt++) {
      tiles = await read();
      const direct = route(tiles, 0, 62);
      if (tiles.some((tile, index) => tile === 'c' && !direct.includes(index))) break;
      await page.locator('[data-replay="maze"]').click();
    }
    await page.locator('#maze-title').focus();
    await go(tiles, 62);
    assert.ok(await page.locator('#maze-trail .is-filled').count() < 6);
    assert.equal(await page.evaluate(() => localStorage.getItem('littleComputer.mazeTrips')), null, 'Early home is not a completed game');
    const carrots = tiles.flatMap((tile, index) => tile === 'c' ? [index] : []);
    for (const carrot of carrots) {
      if (!await page.locator('.maze-cell[data-cell="' + carrot + '"]').evaluate(cell => cell.classList.contains('is-visited'))) await go(tiles, carrot);
    }
    assert.equal(await page.locator('#maze-trail .is-filled').count(), 6);
    const lastCarrot = await position();
    await go(tiles, neighbors(lastCarrot).find(index => tiles[index] !== '#'), true);
    await go(tiles, lastCarrot, true);
    assert.equal(await page.locator('#maze-trail .is-filled').count(), 6, 'Revisiting cannot collect twice');
    await go(tiles, 62);
    assert.equal(await page.evaluate(() => localStorage.getItem('littleComputer.mazeTrips')), '1');
    await page.locator('.maze-cell[data-cell="62"]').dispatchEvent('click');
    await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(1800);
    assert.deepEqual(await read(), tiles, 'Finishing retains the same single map');
    assert.equal(await position(), 62);
    assert.equal(await page.locator('.maze-cell:not(:disabled)').count(), 0, 'Completed game locks movement');
    assert.equal(await page.evaluate(() => localStorage.getItem('littleComputer.mazeTrips')), '1');
    assert.equal(await page.locator('#level-transition').isVisible(), false);
    await page.screenshot({ path: '.tmp/maze-random/complete.png', fullPage: true });

    await page.locator('[data-replay="maze"]').click();
    assert.notEqual(terrain(await read()), terrain(tiles));
    assert.equal(await position(), 0);
    assert.equal(await page.locator('#maze-trail .is-filled').count(), 0);
    assert.ok(await page.locator('.maze-cell:not(:disabled)').count() > 0);
    for (const width of [1920, 1366, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      tiles = await read();
      await page.locator('#maze-title').focus();
      await go(tiles, 60);
      assert.ok(await page.locator('.maze-cell.is-current').evaluate(cell => {
        const r = cell.getBoundingClientRect(), v = document.querySelector('#maze-viewport').getBoundingClientRect();
        return r.left >= v.left && r.right <= v.right && r.top >= v.top && r.bottom <= v.bottom;
      }), 'Camera keeps the player completely visible at ' + width);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      for (const control of await page.locator('#maze-screen .play-header button, #maze-screen .play-footer button').all()) {
        const r = await control.boundingBox(); assert.ok(r.x >= 0 && r.x + r.width <= width);
      }
      for (const cell of await page.locator('.maze-cell').all()) { const r = await cell.boundingBox(); assert.ok(r.width >= 100 && r.height >= 80); }
      if (width === 390) await page.screenshot({ path: '.tmp/maze-random/mobile.png', fullPage: true });
      await page.locator('[data-replay="maze"]').click();
    }
    await page.setViewportSize({ width: 1366, height: 900 });
    await home();
    const before = await position();
    await page.keyboard.press('ArrowRight');
    assert.equal(await position(), before, 'Arrows outside the game do not move the rabbit');
    assert.ok(await page.locator('[data-game="maze"]').evaluate(element => document.activeElement === element));

    await page.locator('[data-parent]').click();
    const question = await page.locator('#math-question').textContent(), numbers = question.match(/\d+/g).map(Number);
    await page.locator('#math-answer').fill(String(question.includes('+') ? numbers[0] + numbers[1] : numbers[0] - numbers[1]));
    await page.locator('[data-submit-parent]').click();
    assert.equal(await page.locator('#stat-maze-trips').textContent(), '1');
    await page.locator('#parent-screen [data-home]').click();
    await page.locator('#home-screen [data-sound]').click();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await enter(); tiles = await read();
    await page.locator('#maze-title').focus();
    const mutedNotes = await page.evaluate(() => window.mazeAudioFrequencies.length);
    const mutedCarrots = tiles.flatMap((tile, index) => tile === 'c' ? [index] : [])
      .sort((a, b) => route(tiles, 0, a).length - route(tiles, 0, b).length);
    await go(tiles, mutedCarrots[0]);
    assert.ok(await page.locator('.maze-cell.is-current').evaluate(cell => cell.classList.contains('is-collecting')));
    assert.equal(await page.locator('.maze-cell.is-current').evaluate(cell => getComputedStyle(cell, '::before').animationName), 'none', 'Reduced motion keeps a static cue');
    assert.equal(await page.locator('.maze-cell.is-current').evaluate(cell => getComputedStyle(cell, '::after').animationName), 'none');
    await page.screenshot({ path: '.tmp/maze-random/pickup.png', fullPage: true });
    for (const carrot of mutedCarrots.slice(1)) {
      if (!await page.locator('.maze-cell[data-cell="' + carrot + '"]').evaluate(cell => cell.classList.contains('is-visited'))) await go(tiles, carrot);
    }
    assert.equal(await page.evaluate(() => window.mazeAudioFrequencies.length), mutedNotes, 'Muted collection creates no audio sources');
    await go(tiles, 62);
    await home(); await page.waitForTimeout(1800);
    assert.ok(await page.locator('#home-screen').isVisible(), 'Leaving cancels the completion callback');
    await enter();
    assert.equal(await position(), 0);
    assert.equal(await page.locator('#maze-trail .is-filled').count(), 0);
    assert.equal(await page.locator('#maze-screen [data-sound]').getAttribute('aria-pressed'), 'false');

    tiles = await read();
    const exitPickup = tiles.findIndex(tile => tile === 'c');
    await page.locator('#maze-title').focus(); await go(tiles, exitPickup);
    await page.evaluate(() => { window.oldPickup = document.querySelector('.maze-cell.is-current'); });
    await home();
    assert.equal(await page.evaluate(() => window.oldPickup.classList.contains('is-collecting')), false, 'Leaving clears the active pickup cue');
    await enter(); tiles = await read();
    await page.locator('#maze-title').focus(); await go(tiles, tiles.findIndex(tile => tile === 'c'));
    await page.locator('[data-replay="maze"]').click();
    assert.equal(await page.locator('.maze-cell.is-collecting').count(), 0, 'Changing maps clears active effects');

    const unavailable = await browser.newPage({ viewport: { width: 1366, height: 900 } });
    unavailable.on('pageerror', error => errors.push(error.message));
    await unavailable.addInitScript(() => {
      Storage.prototype.getItem = () => { throw new Error('Storage unavailable'); };
      Storage.prototype.setItem = () => { throw new Error('Storage unavailable'); };
      window.AudioContext = window.webkitAudioContext = class { constructor() { throw new Error('Audio unavailable'); } };
    });
    await unavailable.goto(pathToFileURL(path.resolve('index.html')).href);
    await unavailable.locator('[data-game="maze"]').click();
    const firstMap = await unavailable.locator('.maze-cell').evaluateAll(cells => cells.map(cell => cell.dataset.tile));
    await unavailable.locator('[data-replay="maze"]').click();
    const secondMap = await unavailable.locator('.maze-cell').evaluateAll(cells => cells.map(cell => cell.dataset.tile));
    assert.notEqual(terrain(firstMap), terrain(secondMap), 'Storage failures still allow new terrain');
    await unavailable.locator('#maze-title').focus();
    let audioPosition = 0;
    const audioTarget = secondMap.findIndex(tile => tile === 'c');
    for (const next of route(secondMap, 0, audioTarget)) {
      await unavailable.keyboard.press(next - audioPosition === 1 ? 'ArrowRight' : next - audioPosition === -1 ? 'ArrowLeft' : next > audioPosition ? 'ArrowDown' : 'ArrowUp');
      audioPosition = next;
    }
    assert.equal(Number(await unavailable.locator('.maze-cell.is-current').getAttribute('data-cell')), audioTarget, 'Unavailable audio does not stop collection');
    assert.ok(await unavailable.locator('.maze-cell.is-current').evaluate(cell => cell.classList.contains('is-collecting')));
    await unavailable.close();
    assert.deepEqual(errors, []); assert.deepEqual(external, []);
    console.log('PASS: 700 connected/distinct maps; arrow/click boundaries; nonblocking pickup audio/effects/revisit/cleanup; single-map completion; replay/reentry/reload; five viewports/camera; stats/mute/reduced motion/exit/storage/audio unavailable; offline.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
