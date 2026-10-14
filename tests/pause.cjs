const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

(async () => {
  const output = path.resolve('.tmp/global-pause');
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
    const errors = [], requests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
    const url = pathToFileURL(path.resolve('index.html')).href;
    await page.goto(url);
    const enter = name => page.locator('[data-game="' + name + '"]').click();
    const home = name => page.locator('#' + name + '-screen [data-home]').click();
    const pause = () => page.locator('#pause-play').click();
    const resume = () => page.locator('#resume-play').click();
    const used = () => page.evaluate(() => currentPlayedSeconds());
    const remaining = () => page.locator('#play-time-value').textContent();

    assert.equal(await remaining(), '时间不限');
    await pause();
    assert.ok(await page.locator('#pause-dialog').isVisible(), 'Unlimited play can pause');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'resume-play');
    assert.ok(await page.locator('#pause-dialog').isVisible(), 'Escape cannot dismiss pause');
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#pause-dialog').isVisible(), false, 'Keyboard can resume');

    await page.evaluate(() => { saveSettings({ fruitLevels: 4, playLimitMinutes: 15 }); refreshPlayTime(); });
    assert.equal(await remaining(), '15:00');
    await page.waitForTimeout(1100);
    assert.equal(await used(), 0, 'Home never consumes time');
    await enter('stars');
    await page.locator('.star-button.is-next').click();
    await page.waitForTimeout(1100);
    await pause();
    const frozenTime = await used(), frozenDisplay = await remaining();
    const frozenCount = await page.locator('#star-count').textContent();
    const starBox = await page.locator('.star-button.is-next').boundingBox();
    await page.mouse.click(starBox.x + starBox.width / 2, starBox.y + starBox.height / 2);
    await page.locator('.star-button.is-next').evaluate(node => node.click());
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Space');
    // Space activates the focused resume button; pause again to check background keys and elapsed time.
    if (!(await page.locator('#pause-dialog').isVisible())) await pause();
    const pausedAt = await used();
    await page.waitForTimeout(1600);
    assert.equal(await used(), pausedAt, 'Pause consumes no daily time');
    assert.equal(await remaining(), frozenDisplay, 'Countdown stays frozen');
    assert.equal(await page.locator('#star-count').textContent(), frozenCount, 'Overlay and capture block clicks');
    assert.ok(frozenTime >= 1 && frozenTime < 3);
    await page.screenshot({ path: path.join(output, 'pause-desktop.png') });
    await resume();
    await page.waitForTimeout(1100);
    assert.ok(await used() > pausedAt + 1, 'Resume continues counting');
    assert.equal(await page.locator('#star-count').textContent(), frozenCount, 'Resume preserves progress');

    // A pending celebration must retain its remaining delay, then advance exactly once.
    await page.locator('.star-button.is-next').click();
    await page.locator('.star-button.is-next').click();
    await pause();
    const level = await page.locator('#star-level').textContent();
    await page.waitForTimeout(1800);
    assert.equal(await page.locator('#star-level').textContent(), level);
    await resume();
    await page.waitForTimeout(1600);
    assert.match(await page.locator('#star-level').textContent(), /第 2 关/);
    await home('stars');

    // Game-local callbacks freeze too, rather than flipping cards behind the modal.
    await enter('memory');
    const pictures = await page.locator('.memory-card').evaluateAll(nodes => nodes.map(node => node.dataset.picture));
    const different = pictures.findIndex(picture => picture !== pictures[0]);
    await page.locator('.memory-card').nth(0).click();
    await page.locator('.memory-card').nth(different).click();
    await pause();
    await page.waitForTimeout(1300);
    assert.equal(await page.locator('.memory-card.is-open').count(), 2);
    await resume();
    await page.waitForTimeout(1200);
    assert.equal(await page.locator('.memory-card.is-open').count(), 0);
    await home('memory');

    // A keyboard-held envelope is cancelled safely, without delivery or lost board progress.
    await enter('mail');
    const letter = page.locator('.mail-letter').first();
    await letter.focus(); await page.keyboard.press('Space'); await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator('.mail-letter.is-dragging').count(), 1);
    await pause();
    assert.equal(await page.locator('.mail-letter.is-dragging').count(), 0);
    assert.equal(await page.locator('.mail-letter.is-delivered').count(), 0);
    await resume(); await home('mail');

    // Pausing suspends water sound and staged flow; resume finishes the same garden.
    await enter('pipes');
    for (const index of [3, 4, 5]) {
      const tile = page.locator('#pipes-board [data-cell="' + index + '"]');
      for (let turn = 0; Number(await tile.getAttribute('data-mask')) !== 10; turn++) {
        assert.ok(turn < 4); await tile.click();
      }
    }
    await page.locator('#pipes-water').click();
    await pause();
    const wet = await page.locator('#pipes-board .is-wet').count();
    await page.waitForTimeout(1400);
    assert.equal(await page.locator('#pipes-board .is-wet').count(), wet);
    assert.equal(await page.evaluate(() => readNumber('littleComputer.pipeGardens')), 0);
    assert.equal(await page.evaluate(() => audioContext.state), 'suspended');
    await resume();
    await page.waitForFunction(() => audioContext.state === 'running');
    assert.equal(await page.evaluate(() => audioContext.state), 'running');
    await page.waitForTimeout(1400);
    assert.equal(await page.evaluate(() => readNumber('littleComputer.pipeGardens')), 1);
    await home('pipes');

    // Every game shares the bar; at narrow widths it remains visible after scrolling.
    const names = await page.locator('[data-game]').evaluateAll(nodes => nodes.map(node => node.dataset.game));
    for (const name of names) {
      await enter(name);
      assert.ok(await page.locator('#play-time-bar').isVisible(), name + ' has global time');
      await pause(); await page.keyboard.press('ArrowDown');
      assert.ok(await page.locator('#pause-dialog').isVisible());
      await resume(); await home(name);
    }
    for (const width of [1920, 1366, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await enter('boxes');
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      const bar = await page.locator('#play-time-bar').boundingBox();
      assert.equal(bar.y, 0, 'Time remains on screen while scrolling');
      const button = await page.locator('#pause-play').boundingBox();
      assert.ok(button.width >= 100 && button.height >= 80);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await pause();
      const dialog = await page.locator('#pause-dialog').boundingBox();
      assert.equal(dialog.width, width); assert.equal(dialog.height, 900);
      if (width === 320) await page.screenshot({ path: path.join(output, 'pause-narrow.png') });
      await resume(); await home('boxes');
    }

    await page.setViewportSize({ width: 1366, height: 768 });
    await page.screenshot({ path: path.join(output, 'home-countdown.png'), fullPage: true });
    await pause(); await page.reload();
    assert.ok(await page.locator('#pause-dialog').isVisible(), 'Refresh preserves pause');
    await resume();

    // Near expiry remains paused indefinitely; resuming reaches the existing parent-only lock.
    await page.evaluate(() => { localStorage.setItem(todayKey(), '898'); recordTodayTime(); });
    await enter('stars'); await pause();
    await page.waitForTimeout(2200);
    assert.ok(await page.locator('#stars-screen').isVisible());
    await resume();
    await page.waitForFunction(() => !document.querySelector('#home-screen').classList.contains('hidden'), undefined, { timeout: 5000 });
    assert.ok(await page.locator('#home-screen').isVisible());
    assert.equal(await remaining(), '00:00');
    await enter('stars');
    assert.ok(await page.locator('#home-screen').isVisible(), 'Pause cannot bypass the daily lock');

    await page.locator('[data-parent]').click();
    assert.ok(await page.locator('#pause-play').isDisabled(), 'Parent challenge cannot be covered by another modal');
    const question = await page.locator('#math-question').textContent();
    const match = question.match(/(\d+)\s*([+−])\s*(\d+)/);
    await page.locator('#math-answer').fill(String(match[2] === '−' ? Number(match[1]) - Number(match[3]) : Number(match[1]) + Number(match[3])));
    await page.locator('[data-submit-parent]').click();
    assert.ok(await page.locator('#play-time-bar').isVisible());
    await pause(); await resume();
    await page.locator('#play-limit-setting').selectOption('0'); await page.locator('#save-settings').click();
    assert.equal(await remaining(), '时间不限');

    const fallback = await browser.newPage({ reducedMotion: 'reduce', viewport: { width: 320, height: 900 } });
    await fallback.addInitScript(() => {
      Storage.prototype.getItem = Storage.prototype.setItem = () => { throw new Error('Unavailable'); };
      window.AudioContext = window.webkitAudioContext = undefined;
    });
    await fallback.goto(url); await fallback.locator('[data-game="stars"]').click();
    await fallback.locator('.star-button.is-next').click();
    await fallback.locator('#pause-play').click(); await fallback.waitForTimeout(1100);
    await fallback.locator('#resume-play').click();
    assert.equal(await fallback.locator('#star-count').textContent(), '1', 'Pause works without storage or audio');
    assert.deepEqual(errors, []); assert.deepEqual(requests, []);
    console.log('PASS pause: global countdown, all 22 games, full-screen input blocking, frozen accounting and callbacks, safe drag cancellation, audio, persistence, parent lock and narrow layouts.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
