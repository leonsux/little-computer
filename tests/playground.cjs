const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    headless: true,
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
    const errors = [], external = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (/^https?:/.test(request.url())) external.push(request.url()); });
    await page.goto(pathToFileURL(path.resolve('index.html')).href);
    const enter = game => page.locator('[data-game="' + game + '"]').click();
    const home = game => page.locator('#' + game + '-screen [data-home]').click();
    const center = async selector => {
      const r = await page.locator(selector).first().boundingBox();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    };
    const drag = async (source, target, release = true) => {
      const a = await center(source), b = await center(target);
      await page.mouse.move(a.x, a.y);
      await page.mouse.down();
      await page.mouse.move(b.x, b.y, { steps: 8 });
      if (release) await page.mouse.up();
    };
    const settle = () => page.waitForTimeout(1700);

    await enter('garden');
    assert.equal(await page.locator('[data-plant="0"]').getAttribute('data-growth'), '0');
    await page.locator('[data-plant="0"]').hover();
    assert.equal(await page.locator('[data-plant="0"]').getAttribute('data-growth'), '1', 'Movement sprouts a seed');
    await page.locator('[data-garden-step="1"]').click();
    await page.locator('[data-plant="0"]').hover();
    await page.waitForTimeout(800);
    assert.equal(await page.locator('[data-plant="0"]').getAttribute('data-growth'), '2');
    assert.ok(await page.locator('[data-plant="0"] .plant-butterfly').isVisible());
    await page.locator('[data-garden-step="2"]').click();
    await page.locator('[data-plant="0"]').hover();
    assert.equal(await page.locator('[data-plant="0"]').getAttribute('data-growth'), '2', 'Hover cannot open a bud');
    await page.locator('[data-plant="0"]').click();
    assert.equal(await page.locator('[data-plant="0"]').getAttribute('data-growth'), '3');
    await page.locator('[data-garden-step="3"]').click();
    for (let i = 0; i < 3; i++) await drag('#garden-can', '[data-plant="' + i + '"]');
    await settle();
    assert.equal(await page.locator('#garden-field').getAttribute('data-step'), '0', 'Starting at the final skill returns to the first unfinished skill');
    assert.equal(await page.evaluate(() => localStorage.getItem('littleComputer.gardenRounds')), null, 'Partial practice is not a full round');
    await home('garden');

    await enter('stars');
    const totals = [3, 4, 5, 6, 8, 9, 10, 10];
    for (const total of totals) {
      assert.equal(await page.locator('.star-button:visible').count(), total, 'Future stars stay visible');
      assert.equal(await page.locator('.star-button.is-next').count(), 1);
      await page.locator('.star-button.is-next').hover();
      assert.equal(await page.locator('#star-count').textContent(), '0', 'Hover never lights a star');
      for (let i = 0; i < total; i++) {
        const p = await center('.star-button.is-next');
        await page.mouse.click(p.x, p.y);
        assert.equal(await page.locator('#star-count').textContent(), String(i + 1));
        assert.equal(await page.locator('#star-trail .is-filled').count(), i + 1);
      }
      assert.equal(await page.locator('.star-button.is-lit').count(), total);
      assert.equal(await page.locator('#star-thread polyline').getAttribute('points').then(points => points.split(' ').length), total + 1, 'Completed constellation closes its thread');
      await page.screenshot({ path: '.tmp/playground-redesign/pattern-' + await page.locator('#star-field').getAttribute('data-scene') + '.png' });
      await settle();
    }
    assert.equal(await page.locator('#star-target').textContent(), '3', 'Eight patterns cycle');
    assert.equal(await page.evaluate(() => localStorage.getItem('littleComputer.starRounds')), '8');
    for (let i = 0; i < 3; i++) await page.locator('.star-button.is-next').click();
    await home('stars');
    assert.ok(await page.locator('[data-game="stars"]').evaluate(el => el === document.activeElement));
    await settle();
    assert.ok(await page.locator('#home-screen').isVisible(), 'Leaving during celebration cancels the callback');

    await enter('fruit');
    await page.locator('[data-fruit-step="3"]').click();
    await drag('.fruit-item[data-fruit="apple"]', '#basket-pear', false);
    assert.equal(await page.locator('#basket-pear.is-target').count(), 0, 'Wrong kind never highlights as an accepted drop');
    await page.mouse.up();
    assert.equal(await page.locator('#fruit-count').textContent(), '0');
    for (const item of await page.locator('.fruit-item').all()) {
      const kind = await item.getAttribute('data-fruit');
      const a = await item.boundingBox(), b = await center(kind === 'apple' ? '#basket' : '#basket-pear');
      await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
      await page.mouse.down();
      await page.mouse.move(b.x, b.y, { steps: 8 });
      await page.mouse.up();
    }
    assert.equal(await page.evaluate(() => localStorage.getItem('littleComputer.fruitRounds')), null, 'One selected lesson is not a full round');
    await settle();
    for (const total of [1, 3, 3]) {
      for (let i = 0; i < total; i++) await drag('.fruit-item:not(:disabled)', '#basket');
      await settle();
    }
    assert.equal(await page.evaluate(() => localStorage.getItem('littleComputer.fruitRounds')), '1');
    await drag('.fruit-item', '#basket', false);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.mouse.up();
    assert.equal(await page.locator('#fruit-count').textContent(), '0', 'Resize cancels an active delivery');
    await home('fruit');

    await enter('drawing');
    const bitmap = () => page.locator('#drawing-canvas').evaluate(canvas => canvas.toDataURL());
    const a = await page.locator('#drawing-canvas').boundingBox();
    await page.mouse.move(a.x + a.width * .2, a.y + a.height * .3);
    await page.mouse.down();
    await page.mouse.move(a.x + a.width * .7, a.y + a.height * .6, { steps: 10 });
    await page.mouse.up();
    const art = await bitmap();
    for (const theme of ['小花园', '大海', '天空']) {
      await page.locator('#next-idea').click();
      assert.ok(await page.locator('#drawing-reference').isVisible());
      assert.match(await page.locator('#drawing-prompt').textContent(), new RegExp(theme));
      assert.equal(await bitmap(), art, 'An inspiration reference never modifies the draft or exported artwork');
    }
    await home('drawing');
    await page.reload();
    await enter('drawing');
    assert.match(await page.locator('#drawing-prompt').textContent(), /天空/);
    assert.equal(await bitmap(), art, 'Both theme choice and artwork survive a reload');
    await page.locator('[data-idea="free"]').click();
    assert.ok(await page.locator('#drawing-reference').isHidden());
    assert.equal(await bitmap(), art);
    await page.locator('.drawing-more summary').click();
    await page.locator('#eraser-tool').click();
    assert.equal(await page.locator('[data-color][aria-pressed="true"]').count(), 0, 'Eraser is the only active drawing tool');
    await page.locator('[data-color="#ef6f61"]').click();
    assert.equal(await page.locator('#eraser-tool').getAttribute('aria-pressed'), 'false');
    await home('drawing');

    for (const width of [1920, 1366, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Home fits ' + width);
      for (const game of ['garden', 'stars', 'fruit', 'drawing']) {
        await enter(game);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), game + ' fits ' + width);
        if (game === 'stars') {
          const shape = await page.locator('.star-constellation').boundingBox();
          assert.ok(Math.abs(shape.width - shape.height) < 1, 'Constellations preserve shape on every viewport');
          for (let i = 0; i < 3; i++) await page.locator('.star-button.is-next').click();
          assert.equal(await page.locator('#star-count').textContent(), '3', 'Real clicks work at ' + width);
        }
        await home(game);
      }
    }
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await enter('stars');
    for (let i = 0; i < 3; i++) await page.locator('.star-button.is-next').click();
    assert.equal(await page.locator('.firework-burst').first().evaluate(el => getComputedStyle(el).opacity), '1', 'Reduced motion retains static celebration artwork');
    assert.equal(await page.locator('.firework-burst').first().evaluate(el => getComputedStyle(el).animationName), 'none');
    await home('stars');
    await settle();
    assert.ok(await page.locator('#home-screen').isVisible());
    assert.deepEqual(errors, []);
    assert.deepEqual(external, []);
    console.log('PASS: growth/story feedback; arbitrary lesson order; eight visible constellations and real clicks; transition exit; sorting feedback; resize cancellation; inspiration/draft isolation and restoration; five viewport sizes; offline.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
