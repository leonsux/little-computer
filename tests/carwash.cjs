const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

(async () => {
  fs.mkdirSync('.tmp/carwash-upgrade', { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 1000 } });
    const errors = [], external = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (/^https?:/.test(request.url())) external.push(request.url()); });
    await page.goto(pathToFileURL(path.resolve('index.html')).href);
    const canvas = page.locator('#carwash-canvas');
    const view = page.locator('#carwash-view');
    const tool = n => page.locator('.carwash-tool[data-tool="' + n + '"]');
    const enter = () => page.locator('[data-game="carwash"]').click();
    const home = () => page.locator('#carwash-screen [data-home]').click();
    const state = () => canvas.evaluate(node => JSON.parse(node.dataset.coverage));
    const phase = () => page.locator('#carwash-stage').getAttribute('data-step');
    const record = () => page.evaluate(() => Number(localStorage.getItem('littleComputer.carwashCars')) || 0);
    const settle = () => page.waitForTimeout(1650);
    const shot = name => page.screenshot({ path: '.tmp/carwash-upgrade/' + name + '.png', fullPage: true });
    const prepare = async x => {
      await view.scrollIntoViewIfNeeded();
      await view.evaluate((node, center) => { node.scrollLeft = Math.max(0, center - node.clientWidth / 2); }, x);
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    };
    const point = async (x, y) => {
      const box = await canvas.boundingBox(); return { x: box.x + x, y: box.y + y };
    };
    const sweep = async points => {
      const first = await point(points[0].x, points[0].y);
      await page.mouse.move(first.x, first.y); await page.mouse.down();
      for (const p of points.slice(1)) { const q = await point(p.x, p.y); await page.mouse.move(q.x, q.y, { steps: 5 }); }
      await page.mouse.up();
    };
    const scrub = async patch => {
      await prepare(patch.x);
      const points = [];
      let row = 0;
      for (let y = patch.y - patch.ry + 10; y <= patch.y + patch.ry - 5; y += 24) {
        const left = patch.x - patch.rx + 7, right = patch.x + patch.rx - 7;
        points.push({ x: row % 2 ? right : left, y }, { x: row % 2 ? left : right, y }); row += 1;
      }
      await sweep(points);
    };
    const fill = async () => {
      for (let step = Number(await phase()); step < 2; step += 1) {
        await tool(step).click();
        for (const patch of await state()) if (patch.phase === step) await scrub(patch);
        assert.equal(await phase(), String(step + 1), 'Broad real strokes cover the whole task');
      }
    };
    await enter();
    assert.equal(await page.locator('[data-demo-panel="carwash"]').isVisible(), true);
    const untouched = await state();
    await page.locator('[data-demo="carwash"]').click();
    assert.deepEqual(await state(), untouched, 'Demo never changes coverage');
    await page.locator('[data-close-demo]:visible').click();
    await shot('initial');
    await prepare(untouched[0].x);
    const start = await point(untouched[0].x, untouched[0].y);
    await page.mouse.move(start.x, start.y);
    for (let i = 0; i < 12; i += 1) await page.mouse.click(start.x, start.y);
    await page.mouse.down(); await page.waitForTimeout(400); await page.mouse.up();
    await page.mouse.click(start.x, start.y, { button: 'right' });
    await canvas.dispatchEvent('click');
    await page.mouse.move(start.x + 70, start.y, { steps: 10 });
    assert.deepEqual(await state(), untouched, 'Clicks, stationary holds, right clicks and hover cannot wash');
    await tool(1).click(); await scrub(untouched[0]);
    assert.deepEqual(await state(), untouched, 'Water cannot remove thick mud');
    await tool(0).click(); await prepare(untouched[0].x);
    const strip = [{ x: untouched[0].x - 40, y: untouched[0].y }, { x: untouched[0].x + 40, y: untouched[0].y }];
    await sweep(strip);
    const partial = await state();
    assert.ok(partial[0].brushed > 0 && partial[0].phase === 0, 'A stroke leaves partial progress');
    assert.equal(partial[1].brushed, 0, 'Other dirt remains untouched');
    await sweep(strip);
    assert.deepEqual(await state(), partial, 'Repeating one strip cannot accumulate fake coverage');
    await shot('partial-brush');
    const partialPixel = await canvas.evaluate((node, p) => Array.from(node.getContext('2d').getImageData(p.x, p.y, 1, 1).data), partial[0]);
    assert.ok(partialPixel[0] > 200, 'The brushed trail visibly becomes foam');

    // Losing capture, Escape, blur, scroll and viewport changes stop input without erasing prior work.
    for (const interrupt of ['pointercancel', 'capture', 'escape', 'blur', 'resize', 'scroll']) {
      await prepare(partial[0].x);
      const a = await point(partial[0].x - 40, partial[0].y);
      await page.mouse.move(a.x, a.y); await page.mouse.down();
      if (interrupt === 'pointercancel') await canvas.dispatchEvent('pointercancel');
      if (interrupt === 'capture') await canvas.evaluate(node => node.releasePointerCapture(1));
      if (interrupt === 'escape') await page.keyboard.press('Escape');
      if (interrupt === 'blur') await page.evaluate(() => window.dispatchEvent(new Event('blur')));
      if (interrupt === 'resize') await page.setViewportSize({ width: 1365, height: 1000 });
      if (interrupt === 'scroll') await page.evaluate(() => document.dispatchEvent(new Event('scroll')));
      const b = await point(partial[0].x + 40, partial[0].y + 45);
      await page.mouse.move(b.x, b.y, { steps: 6 }); await page.mouse.up();
      assert.deepEqual(await state(), partial, interrupt + ' prevents continued painting');
      await page.setViewportSize({ width: 1366, height: 1000 });
    }
    await page.locator('#carwash-serve').click();
    assert.equal(await record(), 0, 'Early delivery does not count');
    assert.match(await page.locator('#carwash-greeting').textContent(), /还有泥巴/);
    assert.deepEqual(await state(), partial, 'A hint preserves partial work');
    await fill();
    assert.equal(await tool(1).getAttribute('aria-pressed'), 'true', 'First car guides the tool change');
    assert.equal(await page.locator('#carwash-steps .is-done').count(), 2);
    assert.equal(await record(), 0, 'Washing requires explicit handover');
    assert.ok((await state()).every(p => p.phase === 2));
    await shot('clean-car');
    await page.locator('#carwash-serve').click();
    await page.locator('#carwash-serve').dispatchEvent('click');
    await canvas.dispatchEvent('click');
    assert.equal(await record(), 1, 'Delivery celebration counts once');
    await settle();
    const expectedCounts = [3, 4, 4, 5];
    for (let i = 0; i < 4; i += 1) {
      assert.equal(await page.locator('#carwash-guest use').getAttribute('href'), '#animal-' + ['elephant', 'panda', 'polarBear', 'giraffe'][i]);
      assert.equal((await state()).length, expectedCounts[i], 'Vehicle has a distinct task');
      assert.ok((await state()).every(p => p.total > 30 && p.rx * 2 >= 100 && p.ry * 2 >= 80));
      await tool(0).click();
      for (const p of await state()) await scrub(p);
      assert.equal(await phase(), '1');
      assert.equal(await tool(0).getAttribute('aria-pressed'), 'true', 'Later cars require a deliberate tool choice');
      const foamy = await state();
      await scrub(foamy[0]);
      assert.deepEqual(await state(), foamy, 'Brush cannot rinse foam');
      await page.locator('#carwash-serve').click();
      assert.match(await page.locator('#carwash-greeting').textContent(), /还有泡泡/);
      await shot('foam-' + i);
      await fill(); await shot('vehicle-' + i);
      await page.locator('#carwash-serve').click(); await settle();
    }
    assert.equal(await record(), 5);
    assert.equal(await page.locator('#carwash-level').textContent(), '小兔的草莓车');
    await page.evaluate(() => refreshParentPage());
    assert.equal(await page.locator('#stat-carwash-cars').textContent(), '5');
    assert.notDeepEqual((await state()).map(p => [p.x, p.y]), untouched.map(p => [p.x, p.y]), 'Preset positions vary across visits');

    const cursor = () => page.locator('#carwash-pointer').evaluate(node => ({ x: parseFloat(node.style.left) * 7.2, y: parseFloat(node.style.top) * 3.4 }));
    const keyMove = async target => {
      for (const axis of ['x', 'y']) {
        for (let i = 0; i < 40; i += 1) {
          const at = await cursor(), difference = target[axis] - at[axis];
          if (Math.abs(difference) <= 10) break;
          await page.keyboard.press(axis === 'x' ? difference > 0 ? 'ArrowRight' : 'ArrowLeft' : difference > 0 ? 'ArrowDown' : 'ArrowUp');
        }
      }
    };
    for (let step = 0; step < 2; step += 1) {
      await tool(step).focus(); await page.keyboard.press('Enter');
      for (const p of await state()) {
        if (p.phase !== step) continue;
        await canvas.focus();
        await keyMove({ x: p.x - p.rx + 10, y: p.y - p.ry + 10 });
        const beforeKeys = await state();
        await page.keyboard.press('Space'); await page.waitForTimeout(100);
        assert.deepEqual(await state(), beforeKeys, 'Keyboard start alone cannot clean');
        for (let row = 0, y = p.y - p.ry + 10; y < p.y + p.ry; row += 1, y += 20) {
          await keyMove({ x: row % 2 ? p.x - p.rx + 10 : p.x + p.rx - 10, y });
        }
        if (await canvas.evaluate(node => node === document.activeElement)) await page.keyboard.press('Escape');
      }
      assert.equal(await phase(), String(step + 1), 'Keyboard uses the same coverage rules');
    }
    assert.equal(await page.locator('#carwash-serve').evaluate(node => node === document.activeElement), true);
    await page.keyboard.press('Enter'); await settle();
    assert.equal(await canvas.evaluate(node => node === document.activeElement), true, 'Next vehicle returns keyboard focus to washing');
    await page.locator('#carwash-screen [data-sound]').click();
    await home();
    assert.equal(await page.locator('[data-game="carwash"]').evaluate(node => node === document.activeElement), true);
    await enter(); assert.equal(await page.locator('#carwash-screen [data-sound]').textContent(), '声音：关');
    await fill(); await page.locator('#carwash-serve').click(); await home(); await settle();
    assert.equal(await page.locator('#level-transition').isVisible(), false);
    await enter(); assert.equal(await phase(), '0');
    await fill(); await page.locator('#carwash-serve').click(); await page.locator('[data-replay="carwash"]').click(); await settle();
    assert.equal(await page.locator('#carwash-level').textContent(), '小兔的草莓车');
    assert.ok((await state()).every(p => p.brushed === 0));

    for (const width of [1920, 1366, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No page overflow at ' + width);
      for (const button of await page.locator('#carwash-screen .play-control, .carwash-tool, #carwash-serve').all()) {
        const box = await button.boundingBox();
        assert.ok(box.width >= 100 && box.height >= 80 && box.x >= 0 && box.x + box.width <= width, 'Large visible controls at ' + width);
      }
      assert.equal((await canvas.boundingBox()).width, 720, 'Narrow screens preserve the large car and dirt');
      // Moving tools at the canvas edges must not expand either scrollable axis.
      await prepare(360);
      const dimensions = await view.evaluate(node => ({ width: node.scrollWidth, height: node.scrollHeight, pageHeight: document.documentElement.scrollHeight }));
      const frame = await view.boundingBox();
      const board = await canvas.boundingBox();
      const left = Math.max(frame.x, board.x) + 2, right = Math.min(frame.x + frame.width, board.x + board.width) - 2;
      for (const selected of [0, 1]) {
        await tool(selected).click();
        await prepare(360);
        for (const [x, y] of [[left, 2], [right, 2], [left, 338], [right, 338], [(left + right) / 2, 170]]) {
          const currentBoard = await canvas.boundingBox();
          await page.mouse.move(x, currentBoard.y + y);
          await page.mouse.down();
          assert.deepEqual(await view.evaluate(node => ({ width: node.scrollWidth, height: node.scrollHeight, pageHeight: document.documentElement.scrollHeight })), dimensions, 'Tool edges keep scroll extents stable at ' + width);
          await page.mouse.up();
        }
      }
      assert.equal(dimensions.height, 340, 'Tool graphics never create vertical scrolling');
      if (width >= 1366) assert.equal(await view.evaluate(node => node.scrollWidth === node.clientWidth), true, 'Desktop washing has no internal horizontal scrollbar');
      else if (width <= 390) assert.ok(await view.evaluate(node => node.scrollWidth > node.clientWidth), 'Narrow screens retain useful horizontal scrolling');
      await page.locator('[data-demo="carwash"]').click();
      if (width === 1366 || width === 320) await shot('demo-' + width);
      await page.locator('[data-close-demo]:visible').click();
    }
    for (let i = 0; i < 5; i += 1) {
      await fill(); await shot('narrow-' + i);
      await page.locator('#carwash-serve').click(); await settle();
    }
    assert.equal(await page.locator('#carwash-level').textContent(), '小兔的草莓车', 'All tasks work with real narrow-screen strokes and scroll');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await fill(); await page.locator('#carwash-serve').click();
    assert.equal(await page.locator('#carwash-vehicle').evaluate(node => getComputedStyle(node).animationName), 'none');
    assert.deepEqual(errors, []); assert.deepEqual(external, []);

    const fallback = await browser.newPage({ viewport: { width: 1366, height: 1000 } });
    const fallbackErrors = [];
    fallback.on('pageerror', error => fallbackErrors.push(error.message));
    await fallback.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', { get() { throw new Error('Storage blocked'); } });
      window.AudioContext = undefined; window.webkitAudioContext = undefined;
    });
    await fallback.goto(pathToFileURL(path.resolve('index.html')).href);
    await fallback.locator('[data-game="carwash"]').click();
    await fallback.locator('[data-close-demo]:visible').click();
    for (let step = 0; step < 2; step += 1) {
      await fallback.locator('.carwash-tool').nth(step).click();
      const node = fallback.locator('#carwash-canvas'), box = await node.boundingBox();
      for (const p of await node.evaluate(n => JSON.parse(n.dataset.coverage))) {
        await fallback.mouse.move(box.x + p.x - p.rx + 8, box.y + p.y - p.ry + 10); await fallback.mouse.down();
        let row = 0;
        for (let y = p.y - p.ry + 10; y <= p.y + p.ry - 5; y += 24) {
          await fallback.mouse.move(box.x + (row % 2 ? p.x - p.rx + 8 : p.x + p.rx - 8), box.y + y, { steps: 6 }); row += 1;
        }
        await fallback.mouse.up();
      }
    }
    assert.equal(await fallback.locator('#carwash-stage').getAttribute('data-step'), '2');
    await fallback.locator('#carwash-serve').click(); await fallback.waitForTimeout(1650);
    assert.equal(await fallback.locator('#carwash-level').textContent(), '大象的旅行巴士');
    assert.deepEqual(fallbackErrors, []);
    console.log('PASS carwash: real brush/rinse coverage, input/tool boundaries, five distinct/random tasks, keyboard, retained work, lifecycle, narrow scroll, reduced motion, optional storage/audio and offline');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
