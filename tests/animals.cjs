const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

(async () => {
  fs.mkdirSync('.tmp/animal-friends', { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
    const errors = [], external = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (/^https?:/.test(request.url())) external.push(request.url()); });
    await page.goto(pathToFileURL(path.resolve('index.html')).href);
    const animals = ['elephant', 'panda', 'polarBear', 'giraffe'];
    const games = await page.locator('[data-game]').evaluateAll(buttons => buttons.map(button => button.dataset.game));
    assert.equal(games.length, 22);
    const enter = key => page.locator('[data-game="' + key + '"]').click();
    const home = key => page.locator('#' + key + '-screen [data-home]').click();
    assert.ok(await page.evaluate(() => [...document.querySelectorAll('use')].every(use => document.querySelector(use.getAttribute('href')))), 'Every local picture reference exists');
    for (const width of [1920, 1366, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      for (const key of games) {
        await enter(key);
        const scope = page.locator('#' + key + '-screen');
        assert.deepEqual(await scope.locator('header .animal-companions svg').evaluateAll(nodes => nodes.map(node => node.dataset.animal)), animals, key + ' has all four friends');
        assert.ok(await scope.locator('header .animal-companions').evaluate(group => {
          const r = group.getBoundingClientRect(), title = group.parentElement.getBoundingClientRect();
          const controls = [...group.closest('header').querySelectorAll('button')].map(button => button.getBoundingClientRect());
          return r.width > 0 && r.height > 0 && r.left >= -1 && r.right <= innerWidth + 1 && r.left >= title.left - 1 && r.right <= title.right + 1 &&
            controls.every(button => button.left >= -1 && button.right <= innerWidth + 1 && (r.right <= button.left || r.left >= button.right || r.bottom <= button.top || r.top >= button.bottom)) && getComputedStyle(group).pointerEvents === 'none';
        }), key + ' companions fit without covering controls at ' + width);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), key + ' no horizontal overflow at ' + width);
        assert.ok(await scope.locator('h2').evaluate(node => getComputedStyle(node).userSelect === 'none'), 'Title cannot be selected');
        if (width === 1366 && ['garden', 'music', 'icecream', 'hideout', 'dressup'].includes(key)) await page.screenshot({ path: '.tmp/animal-friends/' + key + '-desktop.png', fullPage: true });
        await home(key);
      }
    }
    await page.setViewportSize({ width: 1366, height: 900 });
    await enter('link');
    assert.deepEqual(await page.locator('.link-card').evaluateAll(cards => [...new Set(cards.map(card => card.dataset.picture))].filter(key => ['elephant', 'panda', 'polarBear', 'giraffe'].includes(key)).sort()), [...animals].sort());
    await home('link');
    await enter('drawing');
    const canvas = page.locator('#drawing-canvas');
    await canvas.scrollIntoViewIfNeeded();
    const r = await canvas.boundingBox();
    await page.mouse.move(r.x + 30, r.y + 30); await page.mouse.down();
    await page.mouse.move(r.x + 100, r.y + 70, { steps: 5 }); await page.mouse.up();
    const bitmap = await canvas.evaluate(node => node.toDataURL());
    const draft = await page.evaluate(() => localStorage.getItem('littleComputer.drawingDraft'));
    const seen = new Set();
    for (let index = 0; index < 7; index++) {
      await page.locator('#next-idea').click();
      for (const href of await page.locator('#drawing-reference use').evaluateAll(nodes => nodes.map(node => node.getAttribute('href')))) seen.add(href);
      assert.equal(await canvas.evaluate(node => node.toDataURL()), bitmap, 'Animal references do not alter artwork');
      assert.equal(await page.evaluate(() => localStorage.getItem('littleComputer.drawingDraft')), draft, 'Reference choice does not alter the saved draft');
    }
    for (const animal of animals) assert.ok(seen.has('#animal-' + animal), animal + ' can be a drawing reference');
    await page.locator('#save-drawing').click();
    assert.equal(await page.locator('#drawing-preview').getAttribute('src'), bitmap, 'Export source contains only the child’s drawing');
    await page.locator('#drawing-finish-screen [data-home]').click();
    const title = await page.locator('#home-title').boundingBox();
    await page.mouse.move(title.x + 2, title.y + 10); await page.mouse.down();
    await page.mouse.move(title.x + title.width - 2, title.y + 10, { steps: 10 }); await page.mouse.up();
    assert.equal(await page.evaluate(() => getSelection().toString()), '', 'Real mouse drag cannot select text');
    assert.ok(await page.locator('h1, h2, h3, p, label, button, small').evaluateAll(nodes => nodes.every(node => getComputedStyle(node).userSelect === 'none')), 'All page text uses the same selection rule');
    await page.locator('[data-parent]').click(); await page.locator('#math-answer').fill('123');
    assert.equal(await page.locator('#math-answer').inputValue(), '123', 'Parent input remains editable');
    await page.locator('[data-close-modal]').click();
    await page.evaluate(() => {
      const preview = document.createElement('div'); preview.id = 'animal-preview';
      preview.style.cssText = 'position:fixed;inset:0;background:#f5f8ef;display:flex;align-items:center;justify-content:center;gap:25px;z-index:99';
      preview.innerHTML = window.GameAnimals.friends.map(friend => '<figure style="margin:0;text-align:center"><svg width="200" height="240"><use href="#' + friend.symbol + '"/></svg><figcaption style="font-size:25px;color:#304e42">' + friend.name + '</figcaption></figure>').join('');
      document.body.append(preview);
    });
    await page.locator('#animal-preview').screenshot({ path: '.tmp/animal-friends/portraits.png' });
    assert.deepEqual(errors, []); assert.deepEqual(external, []);
    console.log('PASS: four distinct local animals in all 22 games; five widths; companions never cover controls; matching pictures; four drawing references preserve draft and export; real text-selection drag blocked; parent typing works; offline.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
