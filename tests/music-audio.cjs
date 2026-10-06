const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

// Measure rendered sound, rather than asserting which synthesis nodes were used.
function spectrum(samples, sampleRate) {
  const size = 4096, real = [], imaginary = new Array(size).fill(0);
  for (let i = 0; i < size; i++) real[i] = samples[i + 240] * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / (size - 1)));
  for (let i = 1, j = 0; i < size; i++) {
    let bit = size >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) [real[i], real[j]] = [real[j], real[i]];
  }
  for (let length = 2; length <= size; length *= 2) {
    for (let offset = 0; offset < size; offset += length) {
      for (let j = 0; j < length / 2; j++) {
        const angle = -2 * Math.PI * j / length, a = offset + j, b = a + length / 2;
        const r = real[b] * Math.cos(angle) - imaginary[b] * Math.sin(angle);
        const im = real[b] * Math.sin(angle) + imaginary[b] * Math.cos(angle);
        real[b] = real[a] - r; imaginary[b] = imaginary[a] - im;
        real[a] += r; imaginary[a] += im;
      }
    }
  }
  let total = 0, bass = 0, bright = 0, treble = 0, peakPower = 0, peakFrequency = 0;
  for (let i = 1; i < size / 2; i++) {
    const power = real[i] ** 2 + imaginary[i] ** 2, frequency = i * sampleRate / size;
    total += power;
    if (frequency < 300) bass += power;
    if (frequency > 1000) bright += power;
    if (frequency > 2000) treble += power;
    if (power > peakPower) { peakPower = power; peakFrequency = frequency; }
  }
  return { bass: bass / total, bright: bright / total, treble: treble / total, peakFrequency };
}

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
    const errors = [], external = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (/^https?:/.test(request.url())) external.push(request.url()); });
    await page.addInitScript(() => {
      window.renderContexts = [];
      window.AudioContext = class extends OfflineAudioContext {
        constructor() { super(1, 48000, 48000); window.renderContexts.push(this); }
      };
    });
    const url = pathToFileURL(path.resolve('index.html')).href;
    const sounds = {};
    for (const note of ['drum', 'bell', 'keys', 'shaker']) {
      await page.goto(url);
      await page.locator('[data-game="music"]').click();
      await page.locator('.music-instrument[data-note="' + note + '"]').click();
      const samples = await page.evaluate(async () => Array.from((await window.renderContexts[0].startRendering()).getChannelData(0)));
      const peak = Math.max(...samples.map(Math.abs));
      assert.ok(peak > 0.01 && peak < 0.2, note + ' has audible output without excessive peaks');
      assert.ok(samples.every(Number.isFinite), note + ' has finite samples');
      assert.ok(samples.slice(36000).every(value => Math.abs(value) < 0.00001), note + ' ends before the next demonstration note');
      sounds[note] = spectrum(samples, 48000);
    }
    assert.ok(sounds.drum.bass > 0.8, 'Drum is a low percussion sound');
    assert.ok(sounds.bell.bright > 0.15, 'Bell has metallic upper partials, not a single sine tone');
    assert.ok(sounds.keys.peakFrequency > 450 && sounds.keys.peakFrequency < 600, 'Xylophone has a pitched wooden strike');
    assert.ok(sounds.keys.bright > 0.01 && sounds.keys.bright < sounds.bell.bright, 'Wooden strike has softer upper partials than bell');
    assert.ok(sounds.shaker.treble > 0.7, 'Shaker is high frequency noise, not a pitched sine tone');

    await page.goto(url);
    await page.locator('[data-game="music"]').click();
    await page.evaluate(() => {
      window.heardNotes = [];
      const playInstrument = window.GameAudio.playInstrument;
      window.GameAudio.playInstrument = note => { window.heardNotes.push(note); playInstrument(note); };
    });
    await page.locator('#music-listen').click();
    await page.waitForTimeout(2350);
    assert.deepEqual(await page.evaluate(() => window.heardNotes), ['drum', 'bell', 'drum'], 'Demonstration uses the same instrument sounds as clicks');
    assert.equal(await page.locator('.music-step.is-played').count(), 0);
    await page.locator('#music-screen [data-sound]').click();
    const muted = await page.evaluate(async () => {
      for (const note of ['drum', 'bell', 'keys', 'shaker']) window.GameAudio.playInstrument(note);
      return Array.from((await window.renderContexts[0].startRendering()).getChannelData(0));
    });
    assert.ok(muted.every(value => value === 0), 'Shared mute silences pending and new instrument sounds');

    await page.goto(url);
    await page.locator('[data-game="music"]').click();
    await page.locator('.music-instrument[data-note="drum"]').click();
    assert.equal(await page.locator('.music-step.is-played').count(), 1, 'Persisted mute still permits playing');
    assert.equal(await page.evaluate(() => window.renderContexts.length), 0, 'Muted play does not create an audio context');
    await page.locator('#music-screen [data-sound]').click();
    await page.evaluate(() => window.GameAudio.playInstrument('unknown'));
    assert.equal(await page.evaluate(() => window.renderContexts.length), 0, 'Invalid instruments do not create audio');
    await page.evaluate(() => { window.AudioContext = undefined; window.webkitAudioContext = undefined; });
    await page.locator('.music-instrument[data-note="bell"]').focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('.music-step.is-played').count(), 2, 'Unavailable audio does not block keyboard play');
    assert.deepEqual(errors, []);
    assert.deepEqual(external, []);
    console.log('PASS: four rendered instrument timbres; finite samples/peak levels/short tails; mouse clicks; demonstration sound routing; shared mute; invalid instrument; unavailable audio; keyboard; offline.');
    console.log(JSON.stringify(sounds));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
