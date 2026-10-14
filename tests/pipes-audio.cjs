const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

const rate = 48000;
const artifactDir = '.tmp/pipes-water';
const url = pathToFileURL(path.resolve('index.html')).href;

function measure(samples, start = 0, end = samples.length / rate) {
  let peak = 0, squares = 0;
  const from = Math.floor(start * rate), to = Math.min(samples.length, Math.floor(end * rate));
  for (let index = from; index < to; index++) {
    assert.ok(Number.isFinite(samples[index]), 'Rendered audio contains only finite samples');
    peak = Math.max(peak, Math.abs(samples[index]));
    squares += samples[index] ** 2;
  }
  return { peak, rms: Math.sqrt(squares / Math.max(1, to - from)) };
}

function audible(samples, start, end, message) {
  const stats = measure(samples, start, end);
  assert.ok(stats.rms > .003 && stats.peak < .15, message);
  return stats;
}

function silent(samples, start, end, message) {
  const stats = measure(samples, start, end);
  assert.ok(stats.peak < .00001, message);
  return stats;
}

function released(nodes, expectedSources) {
  const sources = nodes.filter(node => node.kind === 'source');
  assert.equal(sources.length, expectedSources, 'Each flow creates one audio source');
  assert.ok(sources.every(node => node.starts === 1 && node.stops >= 1 && node.disconnects === 1), 'Every started source stops and disconnects exactly once');
  assert.equal(nodes.filter(node => node.disconnects === 1).length, expectedSources * 4, 'All per-flow sources, filters and gains are disconnected');
  assert.equal(nodes.filter(node => node.disconnects === 0).length, 1, 'Only the shared master gain remains connected');
}

function writeWave(samples) {
  const data = Buffer.alloc(44 + samples.length * 2);
  data.write('RIFF', 0); data.writeUInt32LE(data.length - 8, 4); data.write('WAVEfmt ', 8);
  data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(1, 22);
  data.writeUInt32LE(rate, 24); data.writeUInt32LE(rate * 2, 28);
  data.writeUInt16LE(2, 32); data.writeUInt16LE(16, 34); data.write('data', 36);
  data.writeUInt32LE(samples.length * 2, 40);
  samples.forEach((sample, index) => data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, sample)) * 32767), 44 + index * 2));
  fs.writeFileSync(path.join(artifactDir, 'water-flow.wav'), data);
}

(async () => {
  fs.mkdirSync(artifactDir, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  const errors = [], external = [], statistics = {};
  try {
    async function newAudioPage({ muted = false, duration = 4, failFilter = false, unavailable = false } = {}) {
      const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
      page.on('pageerror', error => errors.push(error.message));
      page.on('request', request => { if (/^https?:/.test(request.url())) external.push(request.url()); });
      await page.addInitScript(({ muted, duration, failFilter, unavailable }) => {
        localStorage.setItem('littleComputer.sound', muted ? 'off' : 'on');
        window.renderContexts = [];
        if (unavailable) {
          window.AudioContext = undefined;
          window.webkitAudioContext = undefined;
          return;
        }
        window.AudioContext = class extends OfflineAudioContext {
          constructor() {
            super(1, 48000 * duration, 48000);
            this.nodes = [];
            this.filtersCreated = 0;
            window.renderContexts.push(this);
          }
          // The test owns offline checkpoints; preparing real-time audio must not skip one.
          resume() { return Promise.resolve(); }
          track(node, kind) {
            const state = { kind, starts: 0, stops: 0, disconnects: 0 };
            this.nodes.push(state);
            const disconnect = node.disconnect.bind(node);
            node.disconnect = (...args) => { state.disconnects++; return disconnect(...args); };
            if (kind === 'source') {
              const start = node.start.bind(node), stop = node.stop.bind(node);
              node.start = (...args) => { state.starts++; return start(...args); };
              node.stop = (...args) => { state.stops++; return stop(...args); };
            }
            return node;
          }
          createGain() { return this.track(super.createGain(), 'gain'); }
          createBufferSource() { return this.track(super.createBufferSource(), 'source'); }
          createBiquadFilter() {
            if (failFilter && ++this.filtersCreated === 2) throw new Error('Filter unavailable');
            return this.track(super.createBiquadFilter(), 'filter');
          }
        };
      }, { muted, duration, failFilter, unavailable });
      await page.goto(url);
      return page;
    }

    async function startRender(page, checkpoints) {
      await page.evaluate(checkpoints => {
        window.stopWater = window.GameAudio.startWater();
        const context = window.renderContexts[0];
        window.checkpointPromises = checkpoints.map(time => context.suspend(time));
        window.renderTask = context.startRendering().then(buffer => Array.from(buffer.getChannelData(0)));
      }, checkpoints);
    }

    const pauseAt = (page, time) => page.waitForFunction(time => window.renderContexts[0].state === 'suspended' && window.renderContexts[0].currentTime >= time - .01, time);
    const resume = page => page.evaluate(() => OfflineAudioContext.prototype.resume.call(window.renderContexts[0]));
    const result = page => page.evaluate(async () => ({ samples: await window.renderTask, nodes: window.renderContexts[0].nodes }));

    const sustained = await newAudioPage();
    await startRender(sustained, [3]);
    await pauseAt(sustained, 3);
    await sustained.evaluate(() => { window.stopWater(); window.stopWater(); });
    await resume(sustained);
    const full = await result(sustained);
    statistics.sustained = {
      overall: measure(full.samples),
      firstSecond: audible(full.samples, .2, .8, 'Flow sounds through the first second'),
      secondSecond: audible(full.samples, 1.2, 1.8, 'Flow sounds through the second second'),
      thirdSecond: audible(full.samples, 2.2, 2.85, 'Looped flow lasts through the longest three-second route'),
      afterStop: silent(full.samples, 3.2, 4, 'Stopping ends rendered flow after its short fade'),
    };
    assert.ok(statistics.sustained.overall.peak > .01 && statistics.sustained.overall.peak < .15, 'Water has audible, moderate peaks');
    released(full.nodes, 1);
    writeWave(full.samples);
    await sustained.close();

    const muted = await newAudioPage({ muted: true });
    await startRender(muted, [3]);
    await pauseAt(muted, 3);
    await muted.evaluate(() => { window.stopWater(); window.stopWater(); });
    await resume(muted);
    const mutedResult = await result(muted);
    statistics.muted = silent(mutedResult.samples, 0, 4, 'Persisted shared mute silences the entire real rendering');
    released(mutedResult.nodes, 1);
    await muted.close();

    const toggled = await newAudioPage({ muted: true });
    await startRender(toggled, [.8, 1.4, 1.9, 2.6]);
    for (const time of [.8, 1.4, 1.9]) {
      await pauseAt(toggled, time);
      await toggled.locator('#home-screen [data-sound]').click();
      await resume(toggled);
    }
    await pauseAt(toggled, 2.6);
    await toggled.evaluate(() => { window.stopWater(); window.stopWater(); });
    await resume(toggled);
    const toggleResult = await result(toggled);
    statistics.toggled = {
      initiallySilent: silent(toggleResult.samples, .1, .7, 'Muted start has no output'),
      enabled: audible(toggleResult.samples, .9, 1.3, 'Enabling the shared control restores an already flowing source'),
      immediatelyMuted: silent(toggleResult.samples, 1.5, 1.8, 'Shared mute immediately silences flowing audio'),
      resumed: audible(toggleResult.samples, 2, 2.5, 'A second enable restores the same flow'),
      stopped: silent(toggleResult.samples, 2.8, 4, 'Stop stays silent after toggling'),
    };
    released(toggleResult.nodes, 1);
    await toggled.close();

    const restarted = await newAudioPage({ duration: 5 });
    await startRender(restarted, [.65, 1, 3.8]);
    await pauseAt(restarted, .65);
    await restarted.evaluate(() => { window.stopWater(); window.stopWater(); });
    await resume(restarted);
    await pauseAt(restarted, 1);
    await restarted.evaluate(() => { window.oldStopWater = window.stopWater; window.stopWater = window.GameAudio.startWater(); window.oldStopWater(); });
    await resume(restarted);
    await pauseAt(restarted, 3.8);
    await restarted.evaluate(() => { window.stopWater(); window.oldStopWater(); window.stopWater(); });
    await resume(restarted);
    const restartResult = await result(restarted);
    statistics.restarted = {
      first: audible(restartResult.samples, .1, .5, 'Initial flow is audible'),
      between: silent(restartResult.samples, .85, .95, 'Stopped first flow does not leak into a new attempt'),
      second: audible(restartResult.samples, 1.2, 3.6, 'New flow works after the first source was cleaned up'),
      stopped: silent(restartResult.samples, 4.1, 5, 'Repeated cleanup leaves both attempts silent'),
    };
    released(restartResult.nodes, 2);
    await restarted.close();

    const suspended = await newAudioPage({ duration: 1 });
    await suspended.evaluate(() => { const stop = window.GameAudio.startWater(); stop(); stop(); });
    await suspended.waitForTimeout(180);
    const suspendedResult = await suspended.evaluate(async () => {
      const context = window.renderContexts[0];
      return { samples: Array.from((await context.startRendering()).getChannelData(0)), nodes: context.nodes };
    });
    statistics.suspended = silent(suspendedResult.samples, 0, 1, 'Stopped suspended context remains silent when later rendered');
    released(suspendedResult.nodes, 1);
    await suspended.close();

    const failed = await newAudioPage({ failFilter: true, duration: 1 });
    const failure = await failed.evaluate(async () => {
      const stop = window.GameAudio.startWater();
      stop(); stop();
      const context = window.renderContexts[0];
      return { samples: Array.from((await context.startRendering()).getChannelData(0)), nodes: context.nodes, cleanupType: typeof stop };
    });
    assert.equal(failure.cleanupType, 'function');
    assert.equal(failure.nodes.filter(node => node.disconnects === 1).length, 2, 'Partial creation failure releases every created per-flow node');
    assert.equal(failure.nodes.filter(node => node.disconnects === 0).length, 1, 'Failed creation preserves the shared master gain');
    statistics.failedCreation = silent(failure.samples, 0, 1, 'Failed audio creation has no rendered output');
    await failed.close();

    const unavailable = await newAudioPage({ unavailable: true });
    assert.equal(await unavailable.evaluate(() => { const stop = window.GameAudio.startWater(); stop(); stop(); return typeof stop; }), 'function', 'Unavailable audio returns a safe repeatable cleanup');
    assert.equal(await unavailable.evaluate(() => window.renderContexts.length), 0, 'Unavailable audio creates no source or context');
    await unavailable.close();

    assert.deepEqual(errors, [], 'Rendering and every cleanup path have no page errors');
    assert.deepEqual(external, [], 'All flow audio is generated offline');
    fs.writeFileSync(path.join(artifactDir, 'audio-metrics.json'), JSON.stringify(statistics, null, 2) + '\n');
    console.log('PASS: real rendered water; finite moderate peaks; three-second loop; stopped tails; shared mute and running restore; repeated stop/restart; suspended cleanup; partial creation failure; unavailable audio; offline.');
    console.log(JSON.stringify(statistics));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
