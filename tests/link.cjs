const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const pairCounts = [6, 8, 10, 12, 14, 16, 18, 20, 22, 24];

const context = { window: {} };
vm.runInNewContext(fs.readFileSync('games/link-path.js', 'utf8'), context);
const { findPath, findPair, arrange } = context.window.LinkPaths;
const plain = value => JSON.parse(JSON.stringify(value));
assert.equal(findPath(['a', 'a'], 2, 0, 0), null, 'A tile cannot connect to itself');
assert.equal(findPath(['a', null], 2, 0, 1), null, 'An empty cell cannot be selected');
assert.equal(findPath(['a', 'a'], 2, -1, 1), null, 'Invalid endpoints are ignored');
assert.equal(findPath(['a', null, 'a'], 3, 0, 2).length, 2, 'Straight connection');
assert.equal(findPath(['a', null, 'x', 'a'], 2, 0, 3).length, 3, 'One turn');
const outside = findPath(['a', 'x', 'a'], 3, 0, 2);
assert.equal(outside.length, 4, 'Two turns around the outer border');
assert.ok(outside.some(([row]) => row === 0 || row === 2));
const snake = new Array(25).fill('x');
for (const index of [7, 12, 13]) snake[index] = null;
snake[6] = snake[18] = 'a';
assert.equal(findPath(snake, 5, 6, 18), null, 'A route requiring three turns is rejected');
snake[11] = snake[16] = snake[17] = null;
assert.ok(findPath(snake, 5, 6, 18), 'Removing blocking tiles opens a route');

// Independent oracle enumerates straight segments and all possible corner points.
function segmentClear(board, columns, a, b, endpoints) {
  if (a[0] !== b[0] && a[1] !== b[1]) return false;
  const dr = Math.sign(b[0] - a[0]), dc = Math.sign(b[1] - a[1]);
  let [row, column] = a;
  for (;;) {
    const index = (row - 1) * columns + column - 1;
    if (row >= 1 && row <= Math.ceil(board.length / columns) && column >= 1 && column <= columns && board[index] && !endpoints.includes(index)) return false;
    if (row === b[0] && column === b[1]) return true;
    row += dr; column += dc;
  }
}
function oracle(board, columns, first, second) {
  const a = [Math.floor(first / columns) + 1, first % columns + 1];
  const b = [Math.floor(second / columns) + 1, second % columns + 1];
  const clear = (p, q) => segmentClear(board, columns, p, q, [first, second]);
  if (clear(a, b)) return true;
  for (const corner of [[a[0], b[1]], [b[0], a[1]]]) if (clear(a, corner) && clear(corner, b)) return true;
  for (let row = 0; row <= Math.ceil(board.length / columns) + 1; row++) {
    const p = [row, a[1]], q = [row, b[1]];
    if (clear(a, p) && clear(p, q) && clear(q, b)) return true;
  }
  for (let column = 0; column <= columns + 1; column++) {
    const p = [a[0], column], q = [b[0], column];
    if (clear(a, p) && clear(p, q) && clear(q, b)) return true;
  }
  return false;
}
let seed = 20261004;
const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
for (let test = 0; test < 400; test++) {
  const columns = test < 300 ? test % 3 + 2 : test % 7 + 6;
  const board = Array.from({ length: columns * 4 }, () => random() < .6 ? 'x' : null);
  const first = Math.floor(random() * board.length);
  let second = Math.floor(random() * board.length);
  if (first === second) second = (second + 1) % board.length;
  board[first] = board[second] = 'a';
  const route = findPath(board, columns, first, second);
  assert.equal(Boolean(route), oracle(board, columns, first, second), 'Path agrees with independent oracle at fixture ' + test);
  if (route) {
    assert.ok(route.length <= 4);
    for (let i = 1; i < route.length; i++) assert.ok(segmentClear(board, columns, route[i - 1], route[i], [first, second]), 'Route does not cross occupied tiles');
  }
}
const stuck = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'h', 'g', 'f', 'e', 'd', 'c', 'b', 'a'];
assert.equal(findPair(stuck, 4), null, 'Deadlock fixture really has no move');
const unchangedShuffleMath = Object.create(Math);
unchangedShuffleMath.random = () => 1 - Number.EPSILON;
const fallbackContext = { window: {}, Math: unchangedShuffleMath };
vm.runInNewContext(fs.readFileSync('games/link-path.js', 'utf8'), fallbackContext);
const rescued = fallbackContext.window.LinkPaths.arrange(stuck, 4);
assert.ok(findPair(rescued, 4), 'Deterministic fallback rescues a deadlock even when shuffle changes nothing');
assert.deepEqual(plain(rescued).sort(), [...stuck].sort());
for (let i = 0; i < 100; i++) {
  const fixed = arrange(stuck, 4);
  assert.ok(findPair(fixed, 4), 'Rearrangement always supplies a legal move');
  assert.deepEqual(plain(fixed).sort(), [...stuck].sort(), 'Rearrangement preserves every picture');
}
const holes = [null, 'a', null, 'b', 'b', null, 'a', null];
const fixed = plain(arrange(holes, 2));
assert.deepEqual(fixed.map((item, index) => item === null ? index : -1).filter(index => index >= 0), [0, 2, 5, 7], 'Completed positions remain empty');
assert.ok(findPair(fixed, 2));

(async () => {
  fs.mkdirSync('.tmp/link-game', { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
    const errors = [], external = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (/^https?:/.test(request.url())) external.push(request.url()); });
    await page.goto(pathToFileURL(path.resolve('index.html')).href);
    const enter = () => page.locator('[data-game="link"]').click();
    const home = () => page.locator('#link-screen [data-home]').click();
    const resize = async width => {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    };
    const card = index => page.locator('.link-card').nth(index);
    const getPair = () => page.evaluate(() => {
      const cards = [...document.querySelectorAll('.link-card')];
      const board = cards.map(card => card.classList.contains('is-matched') ? null : card.dataset.picture);
      const columns = Number(document.querySelector('#link-cards').style.getPropertyValue('--link-columns'));
      return window.LinkPaths.findPair(board, columns);
    });
    const checkFit = async () => {
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      for (const button of await page.locator('#link-screen button:visible').all()) {
        const r = await button.boundingBox();
        assert.ok(r.width >= 100 && r.height >= 80, 'Large targets');
        assert.ok(r.x >= 0 && r.x + r.width <= await page.evaluate(() => innerWidth), 'Visible controls fit');
      }
    };
    await enter();
    await card(0).hover();
    assert.equal(await page.locator('.link-card.is-selected').count(), 0, 'Hover is not a click');
    await page.locator('[data-demo="link"]').click();
    assert.equal(await page.locator('.link-card.is-matched').count(), 0, 'Demonstration cannot match pictures');
    await page.locator('#link-hint').click();
    assert.equal(await page.locator('.link-card.is-hint').count(), 2);
    assert.equal(await page.locator('.link-card.is-matched').count(), 0, 'Hints still require both clicks');
    await card(0).click();
    await card(0).click();
    assert.equal(await page.locator('.link-card.is-selected').count(), 0, 'Clicking the same tile deselects');
    const firstKind = await card(0).getAttribute('data-picture');
    await card(0).click();
    await page.locator('.link-card:not([data-picture="' + firstKind + '"])').first().click();
    assert.equal(await page.locator('.link-card.is-matched').count(), 0, 'Different pictures cannot connect');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.link-card.is-selected').count(), 0);
    // Force the verified deadlock arrangement once in the product recovery path.
    await page.evaluate(() => {
      window.moveChecks = 0;
      const findPair = window.LinkPaths.findPair;
      window.LinkPaths.findPair = (...args) => { window.moveChecks++; return window.moveChecks === 1 ? null : findPair(...args); };
      const arrange = window.LinkPaths.arrange;
      let fixtureShown = false;
      window.LinkPaths.arrange = (...args) => {
        if (args[0].length === 16 && !fixtureShown) {
          fixtureShown = true;
          return ['rabbit', 'rabbit', 'butterfly', 'flower', 'apple', 'pear', 'star', 'bell', 'bell', 'star', 'pear', 'apple', 'flower', 'butterfly', 'fish', 'fish'];
        }
        return arrange(...args);
      };
    });
    for (const [level, pairs] of pairCounts.entries()) {
      assert.equal(await page.locator('#link-stage').getAttribute('data-level'), String(level + 1));
      assert.equal(await page.locator('.link-card').count(), pairs * 2);
      assert.ok((await page.locator('#link-level').textContent()).includes(' / 10 关'));
      const pictureCounts = await page.locator('.link-card').evaluateAll(cards => cards.reduce((counts, card) => {
        counts[card.dataset.picture] = (counts[card.dataset.picture] || 0) + 1;
        return counts;
      }, {}));
      assert.equal(Object.keys(pictureCounts).length, pairs, 'Each level has the expected picture variety');
      assert.ok(Object.values(pictureCounts).every(count => count === 2), 'Every picture has exactly one partner');
      assert.ok(await page.locator('.link-card use').evaluateAll(uses => uses.every(use => document.querySelector(use.getAttribute('href')))), 'All pictures resolve to existing symbols');
      for (const width of [1920, 1366, 768, 390, 320]) {
        await resize(width);
        await checkFit();
        assert.ok(await getPair(), 'Responsive layout always has an available connection');
        if (level === 4 && width === 390) await page.screenshot({ path: '.tmp/link-game/level-5-mobile.png', fullPage: true });
        if (level === 9 && width === 390) await page.screenshot({ path: '.tmp/link-game/level-10-mobile.png', fullPage: true });
      }
      await resize(1366);
      if (level === 1) {
        const blocked = await page.evaluate(() => {
          const cards = [...document.querySelectorAll('.link-card')], board = cards.map(card => card.dataset.picture);
          for (let i = 0; i < board.length; i++) for (let j = i + 1; j < board.length; j++) {
            if (board[i] === board[j] && !window.LinkPaths.findPath(board, 4, i, j)) return [i, j];
          }
        });
        assert.ok(blocked, 'Fixture supplies an identical blocked pair');
        await card(blocked[0]).click(); await card(blocked[1]).click();
        assert.equal(await page.locator('.link-card.is-matched').count(), 0, 'Blocked identical pictures cannot connect');
        await page.keyboard.press('Escape');
      }
      await page.screenshot({ path: '.tmp/link-game/level-' + (level + 1) + '.png', fullPage: true });
      for (let i = 0; i < pairs; i++) {
        const pair = await getPair();
        assert.ok(pair);
        await card(pair.first).click();
        assert.equal(await page.locator('.link-card.is-matched').count(), i * 2, 'First click never matches alone');
        await card(pair.second).click();
        assert.equal(await page.locator('.link-card.is-matched').count(), (i + 1) * 2);
        assert.equal(await page.locator('#link-trail .is-filled').count(), i + 1);
        if (i === 0 && level === 0) {
          const points = await page.locator('#link-line polyline').getAttribute('points');
          assert.ok(points.split(' ').length >= 2 && points.split(' ').length <= 4, 'Successful connection is drawn');
          await page.screenshot({ path: '.tmp/link-game/connection.png', fullPage: true });
          await card(pair.first).dispatchEvent('click');
          assert.equal(await page.locator('.link-card.is-matched').count(), 2, 'Matched tile cannot count twice');
        }
      }
      assert.equal(await page.evaluate(() => localStorage.getItem('littleComputer.linkBoards')), String(level + 1));
      await card(0).dispatchEvent('click');
      assert.equal(await page.evaluate(() => localStorage.getItem('littleComputer.linkBoards')), String(level + 1), 'Celebration locks repeat completion');
      assert.equal(await page.locator('#link-stage').getAttribute('data-level'), String(level + 1));
      if (level === 9) assert.ok((await page.locator('.level-transition-card').textContent()).includes('全部 10 关完成'));
      await page.waitForTimeout(1650);
    }
    assert.equal(await page.locator('#link-stage').getAttribute('data-level'), '1', 'Ten levels cycle');
    assert.ok(await page.evaluate(() => window.moveChecks > 1), 'Recovery move checks ran');
    const pair = await getPair();
    for (const index of [pair.first, pair.second]) { await card(index).focus(); await page.keyboard.press('Enter'); }
    assert.equal(await page.locator('.link-card.is-matched').count(), 2, 'Keyboard connects pictures');
    await page.locator('[data-replay="link"]').click();
    await page.waitForTimeout(700);
    assert.equal(await page.locator('.link-card.is-matched').count(), 0);
    assert.equal(await page.locator('#link-line polyline').count(), 0, 'Replay clears old line callbacks');
    await page.locator('#link-screen [data-sound]').click();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.locator('[data-demo="link"]').click();
    assert.equal(await page.locator('[data-demo-panel="link"] .demo-mouse i').evaluate(el => getComputedStyle(el).animationName), 'none');
    for (let i = 0; i < pairCounts[0]; i++) {
      const pair = await getPair();
      for (const index of [pair.first, pair.second]) { await card(index).focus(); await page.keyboard.press('Space'); }
    }
    assert.equal(await page.locator('.link-card.is-matched').count(), pairCounts[0] * 2, 'Muted keyboard play still completes');
    assert.equal(await page.evaluate(() => localStorage.getItem('littleComputer.linkBoards')), '11');
    await home();
    await page.waitForTimeout(1650);
    assert.ok(await page.locator('#home-screen').isVisible(), 'Leaving cancels the pending level switch');
    assert.ok(await page.locator('[data-game="link"]').evaluate(el => document.activeElement === el && el.getBoundingClientRect().top >= 0 && el.getBoundingClientRect().bottom <= innerHeight));
    await enter();
    assert.equal(await page.locator('#link-stage').getAttribute('data-level'), '1');
    assert.equal(await page.locator('#link-screen [data-sound]').getAttribute('aria-pressed'), 'false', 'Shared mute is restored');
    assert.equal(await page.locator('.link-card.is-matched').count(), 0);
    await home();
    await page.locator('[data-parent]').click();
    const question = await page.locator('#math-question').textContent(), numbers = question.match(/\d+/g).map(Number);
    await page.locator('#math-answer').fill(String(question.includes('+') ? numbers[0] + numbers[1] : numbers[0] - numbers[1]));
    await page.locator('[data-submit-parent]').click();
    assert.equal(await page.locator('#stat-link-boards').textContent(), '11');
    await page.locator('#parent-screen [data-home]').click();
    await page.screenshot({ path: '.tmp/link-game/home.png', fullPage: true });
    await resize(320);
    await enter();
    for (const [level, pairs] of pairCounts.entries()) {
      assert.equal(await page.locator('#link-stage').getAttribute('data-level'), String(level + 1));
      await checkFit();
      for (let i = 0; i < pairs; i++) {
        const pair = await getPair();
        assert.ok(pair);
        await card(pair.first).click(); await card(pair.second).click();
        assert.equal(await page.locator('.link-card.is-matched').count(), (i + 1) * 2, 'Real clicks complete narrow layout');
      }
      await page.waitForTimeout(1650);
    }
    await home();
    for (const width of [1920, 1366, 768, 390, 320]) {
      await resize(width);
      const homeWidth = await page.evaluate(() => ({ viewport: innerWidth, content: document.documentElement.scrollWidth }));
      if (homeWidth.content > homeWidth.viewport) {
        await page.screenshot({ path: '.tmp/link-game/home-overflow.png', fullPage: true });
      }
      assert.ok(homeWidth.content <= homeWidth.viewport, 'Home fits the viewport: ' + JSON.stringify(homeWidth));
      assert.equal(await page.locator('[data-game]').count(), 16, 'All sixteen entries remain available');
    }
    assert.deepEqual(errors, []);
    assert.deepEqual(external, []);
    console.log('PASS: straight/one-turn/two-turn/outer-border paths; blocked/three-turn paths; 400 oracle fixtures; 100 deadlock rearrangements; preserved holes/counts; ten levels/cycle/picture pairs/symbols; real clicks/wrong pictures/same tile/blocked pair; hint/demo; drawn routes; keyboard/Escape; replay/exit cleanup; mute/reduced motion; parent stats; five widths/large controls; offline.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
