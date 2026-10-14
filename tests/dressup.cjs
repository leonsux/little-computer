const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const groups = {
  straw: 'hat', sun: 'hat', cap: 'hat', top: 'hat',
  rainPink: 'body', rainBlue: 'body', coatMint: 'body', coatPink: 'body',
  scarfBlue: 'neck', scarfPink: 'neck', bowRose: 'neck', bowGold: 'neck',
  carrot: 'bag', flower: 'bag', star: 'bag', bootsYellow: 'feet', bootsBlue: 'feet',
};
(async () => {
  fs.mkdirSync('.tmp/dressup-game', { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
    const errors = [], external = [];
    function observe(p) {
      p.on('pageerror', error => errors.push(error.message));
      p.on('request', request => { if (/^https?:/.test(request.url())) external.push(request.url()); });
    }
    observe(page);
    const url = pathToFileURL(path.resolve('index.html')).href;
    await page.goto(url);
    const enter = () => page.locator('[data-game="dressup"]').click();
    const home = () => page.locator('#dressup-screen [data-home]').click();
    const wish = () => page.locator('.dress-wish').evaluateAll(nodes => nodes.map(node => node.dataset.wish));
    const worn = () => page.locator('#dress-character [data-worn]').evaluateAll(nodes => nodes.map(node => node.dataset.worn).sort());
    const record = () => page.evaluate(() => Number(localStorage.getItem('littleComputer.dressFriends')) || 0);
    const countFriends = () => page.locator('.dress-friend').count();
    const tab = group => page.locator('.dress-tab[data-category="' + group + '"]');
    const choose = async key => {
      await tab(groups[key]).click();
      await page.locator('.dress-choice[data-item="' + key + '"]').click();
    };
    const fill = async () => { for (const key of (await wish()).reverse()) await choose(key); };
    const settle = () => page.waitForTimeout(1650);
    assert.equal(await page.locator('[data-game]').count(), 22);
    for (const width of [1920, 1366, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(100);
      assert.ok(await page.locator('[data-game="dressup"]').evaluate(button => {
        const title = button.querySelector('b').getBoundingClientRect(), art = button.querySelector(':scope > svg').getBoundingClientRect();
        return title.right <= art.left || art.right <= title.left || title.bottom <= art.top || art.bottom <= title.top;
      }), 'Home title does not overlap art at ' + width);
    }
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.locator('.dress-home').screenshot({ path: '.tmp/dressup-game/home.png' });
    await enter();
    assert.equal(await page.locator('[data-demo-panel="dressup"]').isVisible(), true);
    await page.locator('.dress-choice').first().hover();
    await page.locator('[data-demo="dressup"]').click();
    assert.deepEqual(await worn(), [], 'Hover and demonstration cannot dress');
    await page.locator('#dress-depart').dispatchEvent('click');
    assert.equal(await record(), 0);
    assert.equal(await countFriends(), 0);
    await page.screenshot({ path: '.tmp/dressup-game/demo.png', fullPage: true });
    await page.locator('[data-demo-panel="dressup"] [data-close-demo]').click();
    const box = await page.locator('.dress-choice').first().boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    assert.deepEqual(await worn(), [], 'Press alone cannot dress');
    await page.mouse.move(5, 5);
    await page.mouse.up();
    assert.deepEqual(await worn(), [], 'Canceled click cannot dress');
    const originalWishes = [];
    const names = ['小兔去野餐', '大象踩水坑', '熊猫去旅行', '北极熊参加派对', '长颈鹿去露营'];
    let expected = 0;
    for (let scene = 0; scene < 5; scene += 1) {
      assert.equal(await page.locator('#dress-character > svg').getAttribute('data-animal'), ['rabbit', 'elephant', 'panda', 'polarBear', 'giraffe'][scene]);
      assert.equal(await page.locator('#dress-level').textContent(), names[scene]);
      const keys = await wish();
      originalWishes.push(keys);
      assert.equal(keys.length, scene < 2 ? 2 : 3);
      assert.equal(await countFriends(), scene);
      for (const key of [...keys].reverse()) {
        await tab(groups[key]).click();
        const choices = await page.locator('.dress-choice').evaluateAll(nodes => nodes.map(node => node.dataset.item));
        assert.ok(choices.length >= 2 && choices.length <= 3);
        assert.ok(choices.includes(key));
        assert.ok(choices.every(value => groups[value] === groups[key]));
        const wrong = choices.find(value => value !== key);
        const before = await worn();
        await page.locator('.dress-choice[data-item="' + wrong + '"]').click();
        assert.deepEqual(await worn(), [...before.filter(value => groups[value] !== groups[key]), wrong].sort(), 'Replacing a category preserves all others');
        assert.equal(await page.locator('#dress-depart').isDisabled(), true);
        await page.locator('#dress-depart').dispatchEvent('click');
        assert.equal(await record(), expected);
        await page.locator('.dress-choice[data-item="' + key + '"]').click();
        await page.locator('.dress-choice[data-item="' + key + '"]').click();
        assert.equal(await record(), expected, 'Repeated selection cannot count completion');
      }
      assert.deepEqual(await worn(), [...keys].sort(), 'Any dressing order works');
      assert.equal(await page.locator('.dress-wish.is-done').count(), keys.length);
      assert.equal(await page.locator('#dress-depart').isEnabled(), true);
      assert.ok(await page.locator('.dress-wish').evaluateAll(nodes => nodes.every(node => {
        const worn = document.querySelector('#dress-character [data-worn="' + node.dataset.wish + '"]');
        return worn.innerHTML === node.querySelector('svg').innerHTML;
      })), 'Wish and worn item use identical artwork');
      if (scene === 0) {
        const key = keys[0];
        await tab(groups[key]).click();
        const wrong = await page.locator('.dress-choice').evaluateAll((nodes, current) => nodes.map(node => node.dataset.item).find(value => value !== current), key);
        await choose(wrong);
        assert.equal(await page.locator('#dress-depart').isDisabled(), true, 'Changing a completed item reopens the wish');
        assert.equal(await page.locator('.dress-wish.is-done').count(), 1);
        await choose(key);
      }
      await page.screenshot({ path: '.tmp/dressup-game/outfit-' + scene + '.png', fullPage: true });
      await page.locator('#dress-depart').click();
      expected += 1;
      await page.locator('#dress-depart').dispatchEvent('click');
      await page.locator('.dress-choice').first().dispatchEvent('click');
      await tab(groups[keys[0]]).dispatchEvent('click');
      assert.equal(await record(), expected, 'Celebration counts once and locks choices');
      assert.equal(await countFriends(), scene + 1);
      assert.equal(await page.locator('#dress-character .dress-surprise').count(), 1);
      assert.equal(await page.locator('#level-transition').isVisible(), true);
      assert.deepEqual(await page.locator('.dress-friend').last().locator('[data-worn]').evaluateAll(nodes => nodes.map(node => node.dataset.worn).sort()), [...keys].sort());
      await settle();
      assert.deepEqual(await worn(), []);
    }
    assert.equal(await countFriends(), 5, 'Group photo stays visible into the next round');
    assert.equal(await page.locator('#dress-level').textContent(), names[0]);
    assert.notDeepEqual(await wish(), originalWishes[0], 'New round changes the same friend’s wishes');
    await page.evaluate(() => refreshParentPage());
    assert.equal(await page.locator('#stat-dress-friends').textContent(), '5');

    for (const width of [1920, 1366, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(100);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No overflow at ' + width);
      for (const group of await page.locator('.dress-tab').evaluateAll(nodes => nodes.map(node => node.dataset.category))) {
        await tab(group).click();
        for (const button of await page.locator('.dress-tab, .dress-choice, #dress-depart, #dressup-screen .play-control').all()) {
          const r = await button.boundingBox();
          assert.ok(r.width >= 100 && r.height >= 80, 'Large targets at ' + width);
          assert.ok(r.x >= 0 && r.x + r.width <= width + 1, 'Visible targets at ' + width);
        }
      }
      if (width === 1366 || width === 320) await page.screenshot({ path: '.tmp/dressup-game/photo-' + width + '.png', fullPage: true });
    }
    await fill();
    await page.locator('#dress-depart').click();
    assert.equal(await countFriends(), 1, 'Next round replaces photo only on its first departure');
    await settle();
    for (let scene = 1; scene < 5; scene += 1) {
      assert.notDeepEqual(await wish(), originalWishes[scene], 'Each friend’s next wishes differ');
      await fill();
      await page.locator('#dress-depart').click();
      await settle();
    }
    assert.equal(await countFriends(), 5, 'All five scenes complete with real narrow-screen clicks');

    await page.setViewportSize({ width: 1366, height: 900 });
    const keys = await wish();
    const tabGroups = keys.map(key => groups[key]);
    await tab(tabGroups[0]).focus();
    await page.keyboard.press('ArrowRight');
    assert.equal(await tab(tabGroups[1]).evaluate(node => node === document.activeElement), true);
    await page.keyboard.press('Home');
    assert.equal(await tab(tabGroups[0]).getAttribute('aria-selected'), 'true');
    await page.keyboard.press('End');
    assert.equal(await tab(tabGroups[1]).getAttribute('aria-selected'), 'true');
    for (const key of keys) {
      await tab(groups[key]).focus();
      await page.keyboard.press('Enter');
      await page.locator('.dress-choice[data-item="' + key + '"]').focus();
      await page.keyboard.press('Space');
    }
    await page.locator('#dress-depart').focus();
    await page.keyboard.press('Enter');
    await settle();
    assert.equal(await page.locator('.dress-tab').first().evaluate(node => node === document.activeElement), true, 'Next friend restores keyboard focus');
    await page.locator('#dressup-screen [data-sound]').click();
    await home();
    assert.equal(await page.locator('[data-game="dressup"]').evaluate(node => node === document.activeElement), true);
    assert.equal(await page.locator('#home-screen [data-sound]').getAttribute('aria-pressed'), 'false');
    await page.reload();
    await enter();
    assert.equal(await page.locator('#dressup-screen [data-sound]').getAttribute('aria-pressed'), 'false');
    const beforeReplay = await wish();
    await choose(beforeReplay[0]);
    const keptRecord = await record();
    await page.locator('[data-replay="dressup"]').click();
    assert.notDeepEqual(await wish(), beforeReplay);
    assert.deepEqual(await worn(), []);
    assert.equal(await countFriends(), 0);
    assert.equal(await record(), keptRecord);
    await fill();
    await page.locator('#dress-depart').click();
    const lastLevel = await page.locator('#dress-level').textContent();
    await home();
    await settle();
    assert.equal(await page.locator('#home-screen').isVisible(), true);
    assert.equal(await page.locator('#dress-level').textContent(), lastLevel, 'Home cancels pending next friend');
    await enter();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await fill();
    await page.locator('#dress-depart').click();
    assert.equal(await page.locator('#dress-character > svg').evaluate(node => getComputedStyle(node).animationName), 'none');
    assert.equal(await page.locator('#dress-character .dress-surprise').isVisible(), true);
    await page.locator('[data-replay="dressup"]').click();
    await settle();
    assert.equal(await page.locator('#dress-level').textContent(), names[0]);
    assert.deepEqual(await worn(), [], 'Replay cancels the departure callback');

    const fallback = await browser.newPage();
    observe(fallback);
    await fallback.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', { get() { throw new Error('Storage blocked'); } });
      window.AudioContext = undefined; window.webkitAudioContext = undefined;
      Math.random = () => 0;
    });
    await fallback.goto(url);
    await fallback.locator('[data-game="dressup"]').click();
    const initial = await fallback.locator('.dress-wish').evaluateAll(nodes => nodes.map(node => node.dataset.wish));
    await fallback.locator('[data-replay="dressup"]').click();
    const fresh = await fallback.locator('.dress-wish').evaluateAll(nodes => nodes.map(node => node.dataset.wish));
    assert.notDeepEqual(fresh, initial, 'Fixed random value still changes the next outfit');
    for (const key of fresh) {
      await fallback.locator('.dress-tab[data-category="' + groups[key] + '"]').click();
      await fallback.locator('.dress-choice[data-item="' + key + '"]').click();
    }
    await fallback.locator('#dress-depart').click();
    await fallback.waitForTimeout(1650);
    assert.equal(await fallback.locator('#dress-level').textContent(), names[1]);
    assert.equal(await fallback.locator('.dress-friend').count(), 1);
    assert.deepEqual(errors, []);
    assert.deepEqual(external, []);
    console.log('PASS dressup: five scenes, real desktop/narrow clicks, free order, replacement, varied wishes, explicit departure, gallery/cycle, keyboard tabs, lifecycle, mute, reduced motion, fixed randomness, storage/audio fallback and offline.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
