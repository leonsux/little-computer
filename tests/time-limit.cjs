const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  const url = pathToFileURL(path.resolve('index.html')).href;
  const now = Date.now();
  const date = new Date(now);
  const dayKey = 'littleComputer.seconds.' + date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate();
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
    await page.addInitScript(({ dayKey: key, timestamp }) => {
      localStorage.setItem('littleComputer.settings', JSON.stringify({ fruitLevels: 4, playLimitMinutes: 15 }));
      localStorage.setItem(key, '900'); localStorage.setItem('littleComputer.lastTimeAt', String(timestamp));
    }, { dayKey, timestamp: now - 60000 });
    await page.goto(url);
    await page.locator('[data-game="icecream"]').click();
    assert.ok(await page.locator('#home-screen').isVisible(), 'A child cannot start a game after the limit');
    assert.match(await page.locator('#toast').textContent(), /游戏时间到了/);

    async function parentAnswer() {
      await page.locator('[data-parent]').click();
      const question = await page.locator('#math-question').textContent();
      const match = question.match(/(\d+)\s*([+−])\s*(\d+)/);
      assert.ok(match, 'Parent challenge is visible');
      const answer = match[2] === '−' ? Number(match[1]) - Number(match[3]) : Number(match[1]) + Number(match[3]);
      await page.locator('#math-answer').fill(String(answer)); await page.locator('[data-submit-parent]').click();
      assert.ok(await page.locator('#parent-screen').isVisible(), 'Only the parent challenge opens settings');
    }
    await parentAnswer();
    assert.equal(await page.locator('#play-limit-setting').inputValue(), '15');
    await page.locator('#play-limit-setting').selectOption('0'); await page.locator('#save-settings').click();
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('littleComputer.settings')).playLimitMinutes), 0);
    const beforeNonGameTime = await page.evaluate(key => localStorage.getItem(key), dayKey);
    await page.waitForTimeout(1200);
    assert.equal(await page.evaluate(key => localStorage.getItem(key), dayKey), beforeNonGameTime, 'Parent page does not consume play time');
    await page.locator('#parent-screen [data-home]').click();
    await page.waitForTimeout(1200);
    assert.equal(await page.evaluate(key => localStorage.getItem(key), dayKey), beforeNonGameTime, 'Home page does not consume play time');
    await page.locator('[data-game="icecream"]').click();
    assert.ok(await page.locator('#icecream-screen').isVisible(), 'Parent can remove the limit');

    await page.locator('#icecream-screen [data-home]').click();
    await parentAnswer(); await page.locator('#play-limit-setting').selectOption('15'); await page.locator('#save-settings').click();
    await page.locator('#parent-screen [data-home]').click();
    await page.evaluate(({ key, timestamp }) => { localStorage.setItem(key, '899'); localStorage.setItem('littleComputer.lastTimeAt', String(timestamp)); }, { dayKey, timestamp: Date.now() });
    await page.locator('[data-game="stars"]').click();
    await page.waitForTimeout(2300);
    assert.ok(await page.locator('#home-screen').isVisible(), 'The current game closes when the limit is reached');
    assert.match(await page.locator('#toast').textContent(), /游戏时间到了/);
    await page.reload(); await page.locator('[data-game="stars"]').click();
    assert.ok(await page.locator('#home-screen').isVisible(), 'The lock survives refresh');
    await parentAnswer(); await page.locator('#play-limit-setting').selectOption('0'); await page.locator('#save-settings').click();
    await page.locator('#parent-screen [data-home]').click(); await page.locator('[data-game="stars"]').click();
    assert.ok(await page.locator('#stars-screen').isVisible(), 'Only the parent can unlock after refresh');
    console.log('PASS time-limit: parent-only daily setting, immediate child lock, active-game timeout, refresh persistence and parent unlock.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
