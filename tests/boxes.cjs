const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const rules = require('../games/boxes-rules.js');
const directions = ['up', 'right', 'down', 'left'];
const keys = { up: 'ArrowUp', right: 'ArrowRight', down: 'ArrowDown', left: 'ArrowLeft' };

// Independent breadth-first search: parse the authored text maps, never call the game's movement rules.
function search(rows, predicate) {
  const width = rows[0].length, flat = rows.join('');
  const boxes = [...flat].flatMap((c, i) => '$*'.includes(c) ? [i] : []);
  const goals = [...flat].flatMap((c, i) => '.+*'.includes(c) ? [i] : []);
  const player = [...flat].findIndex(c => '@+'.includes(c));
  const id = state => state.player + ':' + [...state.boxes].sort((a, b) => a - b).join(',');
  const queue = [{ player, boxes, moves: [] }], seen = new Set([id(queue[0])]);
  const solved = predicate || (state => state.boxes.every(box => goals.includes(box)));
  for (let offset = 0; offset < queue.length; offset++) {
    const current = queue[offset];
    if (solved(current, flat, width, goals)) return current.moves;
    for (let d = 0; d < 4; d++) {
      const [dx, dy] = [[0, -1], [1, 0], [0, 1], [-1, 0]][d];
      const x = current.player % width + dx, y = Math.floor(current.player / width) + dy;
      if (x < 0 || x >= width || y < 0 || y >= rows.length) continue;
      const next = y * width + x;
      if (flat[next] === '#') continue;
      const moved = [...current.boxes], boxIndex = moved.indexOf(next);
      if (boxIndex !== -1) {
        const bx = x + dx, by = y + dy, destination = by * width + bx;
        if (bx < 0 || bx >= width || by < 0 || by >= rows.length || flat[destination] === '#' || moved.includes(destination)) continue;
        moved[boxIndex] = destination;
      }
      const state = { player: next, boxes: moved, moves: [...current.moves, directions[d]] };
      const key = id(state);
      if (!seen.has(key)) { seen.add(key); queue.push(state); }
    }
    assert.ok(queue.length < 200000, 'Authored boards remain small enough for an exhaustive solvability check');
  }
  return null;
}
const solutions = rules.levels.map(level => search(level.rows));
assert.deepEqual(solutions.map(moves => moves.length), [8, 9, 16, 17, 27, 31, 32, 44], 'Independent shortest routes substantiate increasing planning difficulty');
for (const [index, level] of rules.levels.entries()) {
  assert.ok(level.rows.every(row => row.length === level.rows[0].length));
  const map = rules.parse(level.rows);
  assert.equal(map.boxes.length, map.goals.length); assert.ok(!rules.complete(map, map));
  let state = { player: map.player, boxes: [...map.boxes] };
  for (const direction of solutions[index]) {
    const previous = JSON.stringify(state), next = rules.step(map, state, direction);
    assert.ok(next); assert.equal(JSON.stringify(state), previous, 'Movement must not mutate an undo snapshot'); state = next;
  }
  assert.ok(rules.complete(map, state));
}
const fixture = rules.parse(['######', '#@$$.#', '#    #', '######']);
assert.equal(rules.step(fixture, fixture, 'right'), null, 'Cannot push two boxes together');
assert.equal(rules.step(fixture, fixture, 'up'), null, 'Cannot enter walls');
assert.equal(rules.step(fixture, fixture, 'invalid'), null);
const edge = rules.parse(['@  ', ' $ ', '  .']);
assert.equal(rules.step(edge, edge, 'left'), null, 'Left boundary never wraps to another row');
assert.equal(rules.step(edge, edge, 'up'), null);
assert.equal(rules.step(edge, { player: 2, boxes: [5] }, 'down').boxes[0], 8);
assert.equal(rules.step(edge, { player: 5, boxes: [8] }, 'down'), null, 'Boxes cannot leave the board');
const goalMap = rules.parse(['######', '#@$. #', '#    #', '######']);
const onGoal = rules.step(goalMap, goalMap, 'right');
assert.ok(rules.complete(goalMap, onGoal));
const offGoal = rules.step(goalMap, onGoal, 'right');
assert.ok(!rules.complete(goalMap, offGoal), 'A filled target is not permanently locked');
assert.ok(rules.inCorner(goalMap, offGoal.boxes[0]));
assert.ok(!rules.inCorner(goalMap, onGoal.boxes[0]));

(async () => {
  fs.mkdirSync('.tmp/boxes-game', { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const errors = [], external = [];
    const observe = page => {
      page.on('pageerror', error => errors.push(error.message));
      page.on('request', request => { if (/^https?:/.test(request.url())) external.push(request.url()); });
    };
    const page = await browser.newPage({ viewport: { width: 1366, height: 768 } }); observe(page);
    const url = pathToFileURL(path.resolve('index.html')).href;
    await page.goto(url);
    assert.equal(await page.locator('[data-game]').count(), 22);
    assert.ok(await page.locator('[data-game]').evaluateAll(nodes => nodes.every(node => node.getBoundingClientRect().bottom <= innerHeight)), 'All home entries still fit at 1366×768');
    await page.screenshot({ path: '.tmp/boxes-game/home.png', fullPage: true });
    const enter = () => page.locator('[data-game="boxes"]').click();
    const home = () => page.locator('#boxes-screen [data-home]').click();
    const state = (target = page) => target.locator('#boxes-board .boxes-cell').evaluateAll(nodes => ({ player: nodes.findIndex(node => node.dataset.player === 'true'), boxes: nodes.filter(node => node.dataset.box === 'true').map(node => Number(node.dataset.cell)) }));
    const record = () => page.evaluate(() => Number(localStorage.getItem('littleComputer.boxBoards') || 0));
    const step = (direction, target = page) => target.locator('[data-box-direction="' + direction + '"]').click();
    const travel = async (moves, target = page) => { for (const direction of moves) await step(direction, target); };
    const select = async (level, target = page) => {
      const details = target.locator('.boxes-level-picker');
      if (!await details.evaluate(node => node.open)) await details.locator('summary').click();
      await target.locator('#boxes-levels [data-level="' + level + '"]').click();
      await details.locator('summary').click();
    };
    const waitLevel = (level, target = page) => target.waitForFunction(value => document.querySelector('#boxes-stage').dataset.level === String(value), level);
    await enter(); assert.ok(await page.locator('[data-demo-panel="boxes"]').isVisible());
    const initial = await state(); await page.waitForTimeout(200); assert.deepEqual(await state(), initial, 'Demo does not play');
    await page.locator('[data-demo-panel="boxes"] [data-close-demo]').click();
    const direction = page.locator('[data-box-direction="up"]');
    await direction.hover(); assert.deepEqual(await state(), initial);
    const r = await direction.boundingBox(); await page.mouse.move(r.x + 20, r.y + 20); await page.mouse.down();
    assert.deepEqual(await state(), initial, 'Holding does not move');
    await page.mouse.move(1, 1); await page.mouse.up(); assert.deepEqual(await state(), initial, 'Cancelled click does not move');
    await page.locator('#boxes-board [data-cell="8"]').click(); assert.deepEqual(await state(), initial, 'Distant squares cannot teleport the bear');
    await step(solutions[0][0]); assert.notDeepEqual(await state(), initial);
    await page.locator('#boxes-undo').click(); assert.deepEqual(await state(), initial); assert.ok(await page.locator('#boxes-undo').isDisabled());
    await page.locator('#boxes-undo').dispatchEvent('click'); assert.deepEqual(await state(), initial);
    const firstOffset = { up: -7, right: 1, down: 7, left: -1 }[solutions[0][0]];
    await page.locator('#boxes-board [data-cell="' + (initial.player + firstOffset) + '"]').click();
    assert.equal((await state()).player, initial.player + firstOffset, 'A real adjacent-cell click walks exactly one square');
    await page.locator('#boxes-undo').click(); assert.deepEqual(await state(), initial);
    const cornerPath = search(rules.levels[0].rows, (state, flat, width, goals) => state.boxes.some(box => !goals.includes(box) && (flat[box - width] === '#' || flat[box + width] === '#') && (flat[box - 1] === '#' || flat[box + 1] === '#')));
    assert.ok(cornerPath); await travel(cornerPath.slice(0, -1)); const beforeCorner = await state();
    await step(cornerPath.at(-1)); assert.match(await page.locator('#boxes-tip').textContent(), /角落/);
    assert.equal(await record(), 0); await page.locator('#boxes-undo').click(); assert.deepEqual(await state(), beforeCorner, 'Undo restores both box and bear after a corner push');
    await page.locator('#boxes-reset').click(); assert.deepEqual(await state(), initial);
    await page.screenshot({ path: '.tmp/boxes-game/desktop.png', fullPage: true });

    for (let level = 0; level < rules.levels.length; level++) {
      await waitLevel(level); await travel(solutions[level]);
      assert.equal(await record(), level + 1);
      assert.equal(await page.locator('.boxes-cell.is-delivered').count(), rules.parse(rules.levels[level].rows).goals.length);
      const completed = await state();
      await page.locator('[data-box-direction="left"]').dispatchEvent('click'); await page.locator('#boxes-undo').dispatchEvent('click');
      assert.deepEqual(await state(), completed); assert.equal(await record(), level + 1, 'Celebration locks repeat input');
      if (level === 7) await page.screenshot({ path: '.tmp/boxes-game/complete.png', fullPage: true });
      await waitLevel((level + 1) % 8);
    }
    await select(7); assert.equal(await record(), 8, 'Free level selection does not count as completion');
    for (const width of [1920, 1366, 1101, 1100, 768, 641, 640, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No page overflow at ' + width);
      assert.ok(await page.locator('#boxes-screen header button, .boxes-actions button, .boxes-pad button, #boxes-screen footer button, .boxes-level-picker summary').evaluateAll(nodes => nodes.every(node => {
        const r = node.getBoundingClientRect(); return r.width >= 99 && r.height >= 79 && r.left >= -1 && r.right <= innerWidth + 1;
      })), 'Large visible controls at ' + width);
      assert.ok(await page.locator('.boxes-cell').evaluateAll(nodes => nodes.every(node => { const r = node.getBoundingClientRect(); return r.width >= 99 && r.height >= 79; })), 'Scrolling preserves full-size tiles');
      if ([1366, 320].includes(width)) await page.screenshot({ path: '.tmp/boxes-game/hard-' + width + '.png', fullPage: true });
    }
    await travel(solutions[7]); await waitLevel(0); assert.equal(await record(), 9, 'Hardest board is mouse-playable at 320px');
    const bounds = await page.locator('#boxes-view').boundingBox();
    const bear = await page.locator('.boxes-cell.has-player').boundingBox();
    assert.ok(bear.x >= bounds.x - 1 && bear.x + bear.width <= bounds.x + bounds.width + 1, 'Viewport follows the bear on setup');
    await home(); assert.ok(await page.locator('[data-game="boxes"]').evaluate(node => node === document.activeElement));
    await page.locator('[data-game="boxes"]').press('Enter');
    for (const direction of solutions[0]) await page.keyboard.press(keys[direction]);
    await waitLevel(1); assert.equal(await record(), 10); assert.ok(await page.locator('.boxes-cell.has-player').evaluate(node => node === document.activeElement));
    const keyboardInitial = await state();
    await page.locator('#boxes-screen').dispatchEvent('keydown', { key: 'ArrowRight', repeat: true });
    assert.deepEqual(await state(), keyboardInitial, 'Held arrow does not accidentally push repeatedly');
    await page.locator('#boxes-reset').click(); assert.equal(await page.locator('#boxes-stage').getAttribute('data-level'), '1', 'Reset restarts the selected board');
    await select(0); await travel(solutions[0]); await home(); await page.waitForTimeout(1600);
    assert.ok(await page.locator('#home-screen').isVisible()); assert.equal(await page.locator('#boxes-stage').getAttribute('data-level'), '0');
    const stopped = await state(); await page.locator('[data-box-direction="down"]').dispatchEvent('click'); assert.deepEqual(await state(), stopped, 'Inactive game rejects input');
    await enter(); await travel(solutions[0]); await page.locator('#boxes-reset').click(); await page.waitForTimeout(1600);
    assert.deepEqual(await state(), initial); assert.ok(await page.locator('#level-transition').isHidden());
    await page.locator('#boxes-screen [data-sound]').click(); await home(); await enter();
    assert.equal(await page.locator('#boxes-screen [data-sound]').textContent(), '声音：关');
    await home(); await page.evaluate(() => { refreshParentPage(); window.showScreen('parent'); });
    assert.equal(await page.locator('#stat-box-boards').textContent(), '12');

    const fallback = await browser.newPage({ viewport: { width: 320, height: 900 }, reducedMotion: 'reduce' }); observe(fallback);
    await fallback.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', { get() { throw new Error('Storage unavailable'); } });
      window.AudioContext = undefined; window.webkitAudioContext = undefined;
    });
    await fallback.goto(url); await fallback.locator('[data-game="boxes"]').click();
    await travel(solutions[0], fallback); await waitLevel(1, fallback);
    const limited = await browser.newPage(); observe(limited); await limited.goto(url);
    await limited.locator('[data-game="boxes"]').click(); await travel(solutions[0], limited);
    await limited.evaluate(() => {
      const now = new Date();
      localStorage.setItem('littleComputer.settings', JSON.stringify({ playLimitMinutes: 15 }));
      localStorage.setItem('littleComputer.seconds.' + now.getFullYear() + '-' + (now.getMonth() + 1) + '-' + now.getDate(), '900');
    });
    await limited.waitForFunction(() => !document.querySelector('#home-screen').classList.contains('hidden'));
    await limited.waitForTimeout(1600);
    assert.equal(await limited.locator('#boxes-stage').getAttribute('data-level'), '0', 'Daily timeout cancels pending advancement');
    await limited.locator('[data-game="boxes"]').click(); assert.ok(await limited.locator('#home-screen').isVisible());
    assert.deepEqual(errors, []); assert.deepEqual(external, []);
    console.log('PASS boxes: independent shortest routes ' + solutions.map(s => s.length).join('/') + '; walls, boundaries, single-box push, corners/undo; all eight real-click boards and cycle; hardest narrow board; keyboard; free selection; reset/exit/time-limit cleanup; records; nine widths; optional storage/audio; reduced motion; offline.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
