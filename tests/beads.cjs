const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

const patterns = [
  ['circle', 'star'],
  ['flower', 'leaf'],
  ['circle', 'circle', 'flower'],
  ['leaf', 'star', 'flower'],
  ['star', 'leaf', 'leaf'],
];

(async () => {
  fs.mkdirSync('.tmp/beads-game', { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const errors = [], external = [];
    const observe = target => {
      target.on('pageerror', error => errors.push(error.message));
      target.on('request', request => { if (/^https?:/.test(request.url())) external.push(request.url()); });
    };
    const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
    observe(page);
    await page.addInitScript(() => {
      window.beadTestSounds = 0;
      const context = window.AudioContext || window.webkitAudioContext;
      if (!context) return;
      const createOscillator = context.prototype.createOscillator;
      context.prototype.createOscillator = function () { window.beadTestSounds++; return createOscillator.call(this); };
    });
    const url = pathToFileURL(path.resolve('index.html')).href;
    await page.goto(url);
    const enter = () => page.locator('[data-game="beads"]').click();
    const home = () => page.locator('#beads-screen [data-home]').click();
    const replay = () => page.locator('#beads-screen [data-replay]').click();
    const choice = (key, target = page) => target.locator('#beads-choices [data-bead="' + key + '"]');
    const filled = (target = page) => target.locator('#beads-sequence [data-repeat="2"] .is-filled').evaluateAll(nodes => nodes.map(node => node.dataset.bead));
    const record = () => page.evaluate(() => Number(localStorage.getItem('littleComputer.beadWreaths') || 0));
    const gifts = () => page.locator('#beads-garden .beads-gift').count();
    const waitLevel = (level, target = page) => target.waitForFunction(value => document.querySelector('#beads-stage').dataset.level === String(value), level);
    const fill = async (level, target = page) => {
      for (const bead of patterns[level]) await choice(bead, target).click();
      assert.deepEqual(await filled(target), patterns[level], 'Correct choices remain in the third pattern group');
    };
    const checkPattern = async level => {
      assert.equal(await page.locator('#beads-stage').getAttribute('data-level'), String(level));
      assert.equal(await page.locator('#beads-sequence .beads-group').count(), 3);
      for (const repeat of [0, 1]) {
        assert.deepEqual(await page.locator('#beads-sequence [data-repeat="' + repeat + '"] .beads-slot').evaluateAll(nodes => nodes.map(node => node.dataset.bead)), patterns[level], 'Two complete groups teach the independently specified pattern');
      }
      assert.equal(await page.locator('#beads-sequence [data-repeat="2"] .beads-slot').count(), patterns[level].length);
      assert.equal(await page.locator('#beads-sequence [data-repeat="2"] [data-bead]').count(), 0, 'Empty slots do not expose a filled answer');
      assert.equal(await page.locator('#beads-sequence .is-current').count(), 1);
      assert.equal(await page.locator('#beads-sequence .is-current').getAttribute('data-position'), '0');
    };
    const checkHint = async position => {
      const before = await filled();
      await page.locator('#beads-hint').click();
      assert.deepEqual(await filled(), before, 'Hint never supplies a bead');
      assert.deepEqual(await page.locator('#beads-sequence .is-hint').evaluateAll(nodes => nodes.map(node => [node.parentElement.dataset.repeat, node.dataset.position, node.dataset.bead])), [
        ['0', String(position), patterns[Number(await page.locator('#beads-stage').getAttribute('data-level'))][position]],
        ['1', String(position), patterns[Number(await page.locator('#beads-stage').getAttribute('data-level'))][position]],
      ], 'Hint highlights matching positions in the two examples only');
    };
    const tabTo = async locator => {
      for (let index = 0; index < 30; index++) {
        if (await locator.evaluate(node => node === document.activeElement)) return;
        await page.keyboard.press('Tab');
      }
      assert.fail('Keyboard Tab can reach the requested control');
    };

    await enter();
    assert.ok(await page.locator('[data-demo-panel="beads"]').isVisible(), 'First visit shows a visual demonstration');
    await page.waitForTimeout(250);
    assert.deepEqual(await filled(), []); assert.equal(await record(), 0);
    await page.locator('[data-demo-panel="beads"] [data-close-demo]').click();
    assert.equal(await page.locator('#beads-screen .animal-companions [data-animal]').count(), 4);
    assert.equal(await page.locator('#beads-trail .progress-token').count(), 5);
    await checkPattern(0);
    await choice('circle').hover(); assert.deepEqual(await filled(), [], 'Hover does not fill');
    const box = await choice('circle').boundingBox();
    await page.mouse.move(box.x + 20, box.y + 20); await page.mouse.down();
    assert.deepEqual(await filled(), [], 'Holding does not fill');
    await page.mouse.move(1, 1); await page.mouse.up();
    assert.deepEqual(await filled(), [], 'Cancelled click does not fill');
    assert.ok(await page.locator('#beads-hang').isDisabled());
    await page.locator('#beads-hang').dispatchEvent('click');
    assert.equal(await record(), 0, 'Incomplete work cannot be hung');
    await choice('leaf').click(); assert.deepEqual(await filled(), []);
    assert.ok((await page.locator('#beads-tip').textContent()).trim(), 'A wrong choice has visible gentle guidance');
    await checkHint(0);
    await page.waitForTimeout(1100); await checkHint(0);
    await page.waitForTimeout(900);
    assert.equal(await page.locator('#beads-sequence .is-hint').count(), 2, 'Replaying a hint resets its lifetime');
    await page.waitForTimeout(1050);
    assert.equal(await page.locator('#beads-sequence .is-hint').count(), 0, 'Hint expires without filling');
    await checkHint(0); await choice('circle').click();
    assert.deepEqual(await filled(), ['circle']);
    assert.equal(await page.locator('#beads-sequence .is-hint').count(), 0, 'Choosing a bead clears stale hints');
    assert.equal(await page.locator('#beads-sequence .is-current').getAttribute('data-position'), '1');
    await choice('flower').click(); assert.deepEqual(await filled(), ['circle'], 'Wrong choices preserve earlier correct work');
    await checkHint(1); await replay();
    assert.equal(await page.locator('#beads-sequence .is-hint').count(), 0); await checkPattern(0);
    await page.screenshot({ path: '.tmp/beads-game/initial-desktop.png', fullPage: true });

    for (let level = 0; level < patterns.length; level++) {
      await checkPattern(level);
      await page.evaluate(() => window.scrollTo(0, 0));
      assert.ok(await page.locator('.beads-pattern-area, #beads-choices, .beads-actions').evaluateAll(nodes => nodes.every(node => {
        const box = node.getBoundingClientRect();
        return box.top >= 0 && box.bottom <= innerHeight;
      })), 'Examples, choices and hanging controls fit together at 1366×768');
      for (let position = 0; position < patterns[level].length; position++) {
        await checkHint(position);
        await choice(patterns[level][position]).click();
        assert.deepEqual(await filled(), patterns[level].slice(0, position + 1));
      }
      assert.equal(await record(), level, 'Completing a pattern alone does not count a gift');
      assert.equal(await gifts(), level);
      assert.equal(await page.locator('#beads-sequence .is-current').count(), 0);
      assert.ok(await page.locator('#beads-hang').isEnabled());
      await choice('circle').dispatchEvent('click');
      assert.deepEqual(await filled(), patterns[level], 'The completed row cannot overfill');
      if (level === 4) {
        for (const width of [1920, 1366, 1001, 1000, 999, 768, 641, 640, 390, 320]) {
          await page.setViewportSize({ width, height: 900 });
          await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No page overflow at ' + width);
          assert.ok(await page.locator('#beads-screen header button, #beads-screen footer button, #beads-choices button, .beads-actions button').evaluateAll(nodes => nodes.every(node => {
            const r = node.getBoundingClientRect();
            return r.width >= 99 && r.height >= 79 && r.left >= -1 && r.right <= innerWidth + 1;
          })), 'Large unclipped controls at ' + width);
          assert.ok(await page.locator('#beads-sequence .beads-slot svg, #beads-choices svg').evaluateAll(nodes => nodes.every(node => {
            const r = node.getBoundingClientRect();
            return Math.abs(r.width - r.height) < 1 && node.getAttribute('preserveAspectRatio') !== 'none';
          })), 'Bead graphics keep their proportions at ' + width);
          const layout = await page.locator('.beads-workspace').evaluate(node => {
            const a = node.querySelector('.beads-pattern-area').getBoundingClientRect();
            const b = node.querySelector('.beads-preview-area').getBoundingClientRect();
            return { beside: a.right <= b.left + 1, stacked: a.bottom <= b.top + 1 };
          });
          if (width >= 1366) assert.ok(layout.beside, 'Desktop examples and wreath sit side by side');
          if (width <= 640) {
            assert.ok(layout.stacked, 'Narrow examples and wreath stack');
            assert.ok(await page.locator('#beads-stage').evaluate(node => {
              const pattern = node.querySelector('.beads-pattern-area').getBoundingClientRect();
              const choices = node.querySelector('#beads-choices').getBoundingClientRect();
              const actions = node.querySelector('.beads-actions').getBoundingClientRect();
              const preview = node.querySelector('.beads-preview-area').getBoundingClientRect();
              return choices.top >= pattern.bottom && choices.top - pattern.bottom <= 24 && preview.top >= actions.bottom;
            }), 'Narrow choices follow the examples directly, before the decorative preview');
          }
          await page.screenshot({ path: '.tmp/beads-game/complete-' + width + '.png', fullPage: true });
        }
        await page.setViewportSize({ width: 1366, height: 768 });
      }
      await page.locator('#beads-hang').click();
      await page.locator('#beads-hang').dispatchEvent('click');
      await choice('leaf').dispatchEvent('click');
      assert.equal(await record(), level + 1, 'Celebration rejects duplicate hang and bead input');
      assert.equal(await gifts(), level + 1);
      assert.deepEqual(await filled(), patterns[level]);
      assert.ok(await page.locator('#beads-hang').isDisabled());
      assert.ok(await page.locator('#level-transition').isVisible());
      assert.equal(await page.locator('#beads-trail .is-filled').count(), level + 1);
      await waitLevel((level + 1) % patterns.length);
    }
    assert.equal(await gifts(), 5, 'Five previous wreaths remain visible at the start of the next round');
    await fill(0); assert.equal(await gifts(), 5, 'New work does not clear the previous garden');
    await page.locator('#beads-hang').click();
    assert.equal(await gifts(), 1, 'First hung wreath in the new round replaces the previous collection');
    await waitLevel(1);
    await home();
    assert.ok(await page.locator('[data-game="beads"]').evaluate(node => node === document.activeElement), 'Return restores the home entry focus');

    await page.setViewportSize({ width: 320, height: 900 }); await enter();
    for (let level = 0; level < patterns.length; level++) {
      await fill(level); await page.locator('#beads-hang').click(); await waitLevel((level + 1) % patterns.length);
    }
    assert.equal(await record(), 11, 'Five complete narrow-screen levels remain playable');
    await home(); await page.locator('[data-game="beads"]').focus(); await page.keyboard.press('Enter');
    await tabTo(choice('circle')); await page.keyboard.press('Enter');
    await tabTo(choice('star')); await page.keyboard.press('Space');
    assert.deepEqual(await filled(), patterns[0]);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'beads-hang', 'Keyboard completion focuses the hang button');
    await page.keyboard.press('Enter'); await waitLevel(1);
    assert.ok(await page.locator('#beads-choices button').first().evaluate(node => node === document.activeElement), 'Keyboard transition focuses the first choice');
    assert.equal(await record(), 12);

    await page.locator('#beads-hint').click(); await home();
    assert.equal(await page.locator('#beads-sequence .is-hint').count(), 0, 'Return immediately clears the hint');
    const stopped = await filled();
    await choice('flower').dispatchEvent('click');
    assert.deepEqual(await filled(), stopped, 'Inactive game rejects input');
    await enter(); await fill(0); await page.locator('#beads-hang').click(); await home();
    await page.waitForTimeout(1650);
    assert.ok(await page.locator('#home-screen').isVisible());
    assert.ok(await page.locator('#level-transition').isHidden());
    assert.equal(await page.locator('#beads-stage').getAttribute('data-level'), '0', 'Return cancels pending level advancement');
    await enter(); await fill(0); await page.locator('#beads-hang').click(); await replay();
    await page.waitForTimeout(1650); await checkPattern(0);
    assert.equal(await gifts(), 0, 'Replay clears the current garden'); assert.equal(await record(), 14, 'Replay retains the lifetime record');
    assert.ok(await page.locator('#level-transition').isHidden());
    await page.locator('#beads-screen [data-demo]').click(); await page.waitForTimeout(250);
    assert.deepEqual(await filled(), []); assert.equal(await record(), 14, 'Replaying the demo does not complete work');
    await page.locator('[data-demo-panel="beads"] [data-close-demo]').click();
    await page.locator('#beads-screen [data-sound]').click(); await home(); await enter();
    assert.equal(await page.locator('#beads-screen [data-sound]').textContent(), '声音：关');
    const silent = await page.evaluate(() => window.beadTestSounds);
    await fill(0); await page.locator('#beads-hang').click();
    assert.equal(await page.evaluate(() => window.beadTestSounds), silent, 'Muted matching and celebration schedule no audio');
    await home();
    await page.evaluate(() => { refreshParentPage(); window.showScreen('parent'); });
    assert.equal(await page.locator('#stat-bead-wreaths').textContent(), '15');

    const fallback = await browser.newPage({ viewport: { width: 320, height: 900 }, reducedMotion: 'reduce' });
    observe(fallback);
    await fallback.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', { get() { throw new Error('Storage unavailable'); } });
      window.AudioContext = undefined; window.webkitAudioContext = undefined;
    });
    await fallback.goto(url); await fallback.locator('[data-game="beads"]').click();
    await fallback.locator('#beads-hint').click();
    assert.ok(await fallback.locator('#beads-stage .is-current, #beads-stage .is-hint').evaluateAll(nodes => nodes.every(node => getComputedStyle(node).animationName === 'none')), 'Reduced motion keeps static guidance');
    await fill(0, fallback); await fallback.locator('#beads-hang').click(); await waitLevel(1, fallback);
    assert.equal(await fallback.locator('#beads-garden .beads-gift').count(), 1, 'Unavailable storage and audio still permit completion');

    const limited = await browser.newPage({ viewport: { width: 1366, height: 768 } });
    observe(limited);
    await limited.addInitScript(() => {
      const now = new Date();
      localStorage.setItem('littleComputer.settings', JSON.stringify({ fruitLevels: 4, playLimitMinutes: 15 }));
      localStorage.setItem('littleComputer.seconds.' + now.getFullYear() + '-' + (now.getMonth() + 1) + '-' + now.getDate(), '900');
    });
    await limited.goto(url); await limited.locator('[data-game="beads"]').click();
    assert.ok(await limited.locator('#home-screen').isVisible(), 'Daily limit also locks the new game entry');
    const setElapsed = seconds => limited.evaluate(value => {
      const now = new Date();
      localStorage.setItem('littleComputer.seconds.' + now.getFullYear() + '-' + (now.getMonth() + 1) + '-' + now.getDate(), String(value));
      localStorage.setItem('littleComputer.lastTimeAt', String(Date.now()));
    }, seconds);
    await setElapsed(0); await limited.locator('[data-game="beads"]').click();
    await limited.locator('#beads-hint').click(); await setElapsed(900);
    await limited.waitForFunction(() => !document.querySelector('#home-screen').classList.contains('hidden'));
    assert.equal(await limited.locator('#beads-sequence .is-hint').count(), 0, 'Daily timeout clears a live pattern hint');
    await setElapsed(0); await limited.locator('[data-game="beads"]').click();
    await fill(0, limited); await limited.locator('#beads-hang').click(); await setElapsed(900);
    await limited.waitForFunction(() => !document.querySelector('#home-screen').classList.contains('hidden'));
    await limited.waitForTimeout(1600);
    assert.ok(await limited.locator('#level-transition').isHidden(), 'Daily timeout cancels the celebration');
    assert.equal(await limited.locator('#beads-stage').getAttribute('data-level'), '0', 'Daily timeout cancels pending level advancement');
    assert.equal(await limited.evaluate(() => localStorage.getItem('littleComputer.beadWreaths')), '1', 'Only the manually hung wreath is recorded');
    assert.deepEqual(errors, []); assert.deepEqual(external, []);
    console.log('PASS beads: five independent patterns, real desktop/narrow clicks, wrong and cancelled input, hint lifecycle, explicit hanging and duplicate lock, garden cycle, keyboard/focus, return/replay cleanup, ten widths and core controls together, shared mute/records, daily time limit, reduced motion, optional storage/audio and offline.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
