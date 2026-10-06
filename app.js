const screens = {
  home: document.querySelector('#home-screen'),
  garden: document.querySelector('#garden-screen'),
  stars: document.querySelector('#stars-screen'),
  fruit: document.querySelector('#fruit-screen'),
  drawing: document.querySelector('#drawing-screen'),
  bubbles: document.querySelector('#bubbles-screen'),
  memory: document.querySelector('#memory-screen'),
  train: document.querySelector('#train-screen'),
  maze: document.querySelector('#maze-screen'),
  puzzle: document.querySelector('#puzzle-screen'),
  music: document.querySelector('#music-screen'),
  link: document.querySelector('#link-screen'),
  icecream: document.querySelector('#icecream-screen'),
  hideout: document.querySelector('#hideout-screen'),
  builder: document.querySelector('#builder-screen'),
  cake: document.querySelector('#cake-screen'),
  carwash: document.querySelector('#carwash-screen'),
  'drawing-finish': document.querySelector('#drawing-finish-screen'),
  parent: document.querySelector('#parent-screen'),
};

const toast = document.querySelector('#toast');
const parentModal = document.querySelector('#parent-modal');
const mathAnswer = document.querySelector('#math-answer');
const mathError = document.querySelector('#math-error');

let audioContext;
let parentChallengeAnswer = 0;
let parentAttempts = 0;
let parentLockedUntil = 0;

const defaultSettings = { fruitLevels: 4 };

function getSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem('littleComputer.settings') || '{}') || {};
    return {
      fruitLevels: [1, 2, 3, 4].includes(Number(saved.fruitLevels)) ? Number(saved.fruitLevels) : defaultSettings.fruitLevels,
    };
  } catch (_) {
    return { ...defaultSettings };
  }
}

function saveSettings(settings) {
  localStorage.setItem('littleComputer.settings', JSON.stringify(settings));
}

function todayKey() {
  const now = new Date();
  return `littleComputer.seconds.${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}

function recordTodayTime() {
  try {
    const now = Date.now();
    const previous = Number(localStorage.getItem('littleComputer.lastTimeAt') || now);
    const seconds = Math.min(Math.max(0, Math.round((now - previous) / 1000)), 60);
    localStorage.setItem(todayKey(), String(Number(localStorage.getItem(todayKey()) || 0) + seconds));
    localStorage.setItem('littleComputer.lastTimeAt', String(now));
  } catch (_) { /* Storage is optional for playing. */ }
}

function readNumber(key) {
  try { return Math.max(0, Number(localStorage.getItem(key)) || 0); } catch (_) { return 0; }
}

function refreshParentPage() {
  const settings = getSettings();
  document.querySelector('#today-minutes').textContent = String(Math.floor(readNumber(todayKey()) / 60));
  document.querySelector('#stat-star-clicks').textContent = String(readNumber('littleComputer.starClicks'));
  document.querySelector('#stat-star-rounds').textContent = String(readNumber('littleComputer.starRounds'));
  document.querySelector('#stat-fruit-rounds').textContent = String(readNumber('littleComputer.fruitRounds'));
  document.querySelector('#stat-garden-rounds').textContent = String(readNumber('littleComputer.gardenRounds'));
  document.querySelector('#stat-drawing-count').textContent = String(readNumber('littleComputer.drawingCount'));
  document.querySelector('#stat-bubble-scenes').textContent = String(readNumber('littleComputer.bubbleScenes'));
  document.querySelector('#stat-memory-boards').textContent = String(readNumber('littleComputer.memoryBoards'));
  document.querySelector('#stat-train-trips').textContent = String(readNumber('littleComputer.trainTrips'));
  document.querySelector('#stat-maze-trips').textContent = String(readNumber('littleComputer.mazeTrips'));
  document.querySelector('#stat-puzzle-pictures').textContent = String(readNumber('littleComputer.puzzlePictures'));
  document.querySelector('#stat-music-songs').textContent = String(readNumber('littleComputer.musicSongs'));
  document.querySelector('#stat-link-boards').textContent = String(readNumber('littleComputer.linkBoards'));
  document.querySelector('#stat-icecream-orders').textContent = String(readNumber('littleComputer.icecreamOrders'));
  document.querySelector('#stat-hideout-scenes').textContent = String(readNumber('littleComputer.hideoutScenes'));
  document.querySelector('#stat-builder-models').textContent = String(readNumber('littleComputer.builderModels'));
  document.querySelector('#stat-cake-orders').textContent = String(readNumber('littleComputer.cakeOrders'));
  document.querySelector('#stat-carwash-cars').textContent = String(readNumber('littleComputer.carwashCars'));
  document.querySelector('#fruit-level-setting').value = String(settings.fruitLevels);
}

function openParentPage() {
  refreshParentPage();
  showScreen('parent');
}

function createParentChallenge() {
  const left = randomBetween(12, 39);
  const right = randomBetween(11, 28);
  const subtraction = Math.random() > 0.5;
  const first = subtraction ? Math.max(left, right) : left;
  const second = subtraction ? Math.min(left, right) : right;
  parentChallengeAnswer = subtraction ? first - second : first + second;
  document.querySelector('#math-question').textContent = `${first} ${subtraction ? '−' : '+'} ${second} = ?`;
}

function incrementRecord(key) {
  try { localStorage.setItem(key, String(readNumber(key) + 1)); } catch (_) { /* Keep playing if storage is unavailable. */ }
}

let soundEnabled = true;
let masterGain;
try { soundEnabled = localStorage.getItem('littleComputer.sound') !== 'off'; } catch (_) {}

function syncSoundButtons() {
  document.querySelectorAll('[data-sound]').forEach((button) => {
    button.textContent = soundEnabled ? '声音：开' : '声音：关';
    button.setAttribute('aria-pressed', String(soundEnabled));
  });
}

// Picture tokens show what is left without asking a child to read a score.
window.GameProgress = {
  render(container, total, completed, symbol) {
    container.setAttribute('aria-label', '已完成 ' + completed + ' 个，共 ' + total + ' 个');
    container.replaceChildren();
    for (let index = 0; index < total; index += 1) {
      const token = document.createElement('span');
      token.className = 'progress-token' + (index < completed ? ' is-filled' : '');
      if (symbol === 'star') token.textContent = '★';
      else {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const use = document.createElementNS(svg.namespaceURI, 'use');
        use.setAttribute('href', '#' + symbol);
        svg.append(use);
        token.append(svg);
      }
      container.append(token);
    }
  },
};

function prepareGameAudio() {
  audioContext ??= new (window.AudioContext || window.webkitAudioContext)();
  if (!masterGain) {
    masterGain = audioContext.createGain();
    masterGain.connect(audioContext.destination);
  }
  masterGain.gain.value = soundEnabled ? 1 : 0;
  if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
}

window.GameAudio = {
  play(complete = false, pitch = null) {
    if (!soundEnabled) return;
    try {
      prepareGameAudio();
      const now = audioContext.currentTime;
      (complete ? [523, 659, 784] : pitch === null ? [659, 784] : [pitch]).forEach((frequency, index) => {
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        const start = now + index * .1;
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(.0001, start);
        gain.gain.exponentialRampToValueAtTime(.045, start + .02);
        gain.gain.exponentialRampToValueAtTime(.0001, start + .25);
        oscillator.connect(gain).connect(masterGain);
        oscillator.start(start);
        oscillator.stop(start + .28);
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
      });
    } catch (_) { /* All sound has an equivalent visual response. */ }
  },
  playInstrument(instrument) {
    if (!soundEnabled || !['drum', 'bell', 'keys', 'shaker'].includes(instrument)) return;
    try {
      prepareGameAudio();
      const now = audioContext.currentTime;
      const tone = (frequency, volume, duration, endFrequency = null) => {
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        oscillator.frequency.setValueAtTime(frequency, now);
        if (endFrequency !== null) oscillator.frequency.exponentialRampToValueAtTime(endFrequency, now + duration);
        gain.gain.setValueAtTime(.0001, now);
        gain.gain.exponentialRampToValueAtTime(volume, now + .003);
        gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
        oscillator.connect(gain).connect(masterGain);
        oscillator.start(now);
        oscillator.stop(now + duration + .015);
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
      };
      const noise = (duration, volume, cutoff, delay = 0) => {
        const buffer = audioContext.createBuffer(1, Math.ceil(audioContext.sampleRate * duration), audioContext.sampleRate);
        const samples = buffer.getChannelData(0);
        for (let index = 0; index < samples.length; index++) samples[index] = Math.random() * 2 - 1;
        const source = audioContext.createBufferSource();
        const filter = audioContext.createBiquadFilter();
        const gain = audioContext.createGain();
        const start = now + delay;
        source.buffer = buffer;
        filter.type = 'highpass';
        filter.frequency.value = cutoff;
        filter.Q.value = .7;
        gain.gain.setValueAtTime(.0001, now);
        gain.gain.setValueAtTime(.0001, start);
        gain.gain.exponentialRampToValueAtTime(volume, start + .003);
        gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
        source.connect(filter).connect(gain).connect(masterGain);
        source.start(start);
        source.stop(start + duration);
        source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
      };
      if (instrument === 'drum') {
        // A falling bass pitch with a brief noisy stick attack.
        tone(160, .075, .3, 55);
        noise(.035, .025, 800);
      } else if (instrument === 'bell') {
        // Inharmonic metal partials ring longer than the wooden bars.
        tone(880, .035, .62);
        tone(2440, .02, .38);
        tone(4660, .008, .18);
      } else if (instrument === 'keys') {
        tone(523, .065, .34);
        tone(1570, .015, .12);
        tone(2630, .006, .07);
      } else {
        // Two short bursts of filtered noise make a shake, without a fixed pitch.
        noise(.12, .065, 3200);
        noise(.12, .05, 3200, .085);
      }
    } catch (_) { /* Playing and visual cues remain available without audio. */ }
  },
};
document.querySelectorAll('[data-sound]').forEach((button) => button.addEventListener('click', () => {
  soundEnabled = !soundEnabled;
  if (masterGain) masterGain.gain.value = soundEnabled ? 1 : 0;
  try { localStorage.setItem('littleComputer.sound', soundEnabled ? 'on' : 'off'); } catch (_) {}
  syncSoundButtons();
}));
syncSoundButtons();

let demoTimer;
const demonstrated = new Set();
window.GameHelp = {
  hide() {
    clearTimeout(demoTimer);
    document.querySelectorAll('[data-demo-panel]').forEach((panel) => {
      panel.classList.add('hidden');
      panel.classList.remove('is-playing');
    });
  },
  show(name) {
    this.hide();
    const panel = document.querySelector('[data-demo-panel="' + name + '"]');
    if (!panel) return;
    panel.classList.remove('hidden');
    void panel.offsetWidth;
    panel.classList.add('is-playing');
    demonstrated.add(name);
    demoTimer = setTimeout(() => this.hide(), 6500);
  },
  first(name) { if (!demonstrated.has(name)) this.show(name); },
};

let levelTransitionTimer;
const levelTransition = document.querySelector('#level-transition');
window.LevelTransition = {
  show({ title = '完成啦！', note = '下一关马上开始', onDone }) {
    this.cancel();
    document.querySelector('#level-transition-title').textContent = title;
    document.querySelector('#level-transition-note').textContent = note;
    levelTransition.classList.remove('hidden');
    void levelTransition.offsetWidth;
    levelTransition.classList.add('is-showing');
    levelTransitionTimer = window.setTimeout(() => {
      this.cancel();
      onDone?.();
    }, 1500);
  },
  cancel() {
    window.clearTimeout(levelTransitionTimer);
    levelTransition.classList.add('hidden');
    levelTransition.classList.remove('is-showing');
  },
};
document.querySelectorAll('[data-demo]').forEach((button) => button.addEventListener('click', () => window.GameHelp.show(button.dataset.demo)));
document.querySelectorAll('[data-close-demo]').forEach((button) => button.addEventListener('click', () => window.GameHelp.hide()));
document.addEventListener('pointerdown', (event) => {
  if (event.target.closest('.star-button, .fruit-item, #drawing-canvas')) window.GameHelp.hide();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') window.GameHelp.hide();
});

function showScreen(name) {
  window.LevelTransition.cancel();
  if (name !== 'garden') window.GardenGame?.stop();
  if (name !== 'stars') window.StarsGame?.stop();
  if (name !== 'fruit') window.FruitGame?.stop();
  if (name !== 'drawing') window.DrawingGame?.stop();
  if (name !== 'bubbles') window.BubblesGame?.stop();
  if (name !== 'memory') window.MemoryGame?.stop();
  if (name !== 'train') window.TrainGame?.stop();
  if (name !== 'maze') window.MazeGame?.stop();
  if (name !== 'puzzle') window.PuzzleGame?.stop();
  if (name !== 'music') window.MusicGame?.stop();
  if (name !== 'link') window.LinkGame?.stop();
  if (name !== 'icecream') window.IcecreamGame?.stop();
  if (name !== 'hideout') window.HideoutGame?.stop();
  if (name !== 'builder') window.BuilderGame?.stop();
  if (name !== 'cake') window.CakeGame?.stop();
  if (name !== 'carwash') window.CarwashGame?.stop();
  window.GameHelp.hide();
  Object.values(screens).forEach((screen) => screen.classList.add('hidden'));
  screens[name].classList.remove('hidden');
  window.scrollTo(0, 0);
  if (name === 'home') {
    const entry = screens.home.querySelector('[data-game="' + showScreen.previousGame + '"]');
    entry?.focus({ preventScroll: true });
    entry?.scrollIntoView({ block: 'nearest' });
  } else if (['garden', 'stars', 'fruit', 'drawing', 'bubbles', 'memory', 'train', 'maze', 'puzzle', 'music', 'link', 'icecream', 'hideout', 'builder', 'cake', 'carwash'].includes(name)) {
    showScreen.previousGame = name;
    const title = screens[name].querySelector('h2');
    title.tabIndex = -1;
    title.focus({ preventScroll: true });
  }
}
window.showScreen = showScreen;

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove('show'), 2200);
}

function openParentModal() {
  createParentChallenge();
  parentAttempts = 0;
  parentLockedUntil = 0;
  mathError.textContent = '';
  mathAnswer.value = '';
  document.querySelector('[data-submit-parent]').disabled = false;
  parentModal.classList.remove('hidden');
  mathAnswer.focus();
}

function closeParentModal() {
  parentModal.classList.add('hidden');
}

document.querySelector('[data-game="stars"]').addEventListener('click', () => window.StarsGame.start());
document.querySelector('[data-game="fruit"]').addEventListener('click', () => window.FruitGame.start());
document.querySelector('[data-game="bubbles"]').addEventListener('click', () => window.BubblesGame.start());
document.querySelector('[data-game="memory"]').addEventListener('click', () => window.MemoryGame.start());
document.querySelector('[data-game="train"]').addEventListener('click', () => window.TrainGame.start());
document.querySelector('[data-game="maze"]').addEventListener('click', () => window.MazeGame.start());
document.querySelector('[data-game="puzzle"]').addEventListener('click', () => window.PuzzleGame.start());
document.querySelector('[data-game="music"]').addEventListener('click', () => window.MusicGame.start());
document.querySelector('[data-game="link"]').addEventListener('click', () => window.LinkGame.start());
document.querySelector('[data-game="icecream"]').addEventListener('click', () => window.IcecreamGame.start());
document.querySelector('[data-game="hideout"]').addEventListener('click', () => window.HideoutGame.start());
document.querySelector('[data-game="builder"]').addEventListener('click', () => window.BuilderGame.start());
document.querySelector('[data-game="cake"]').addEventListener('click', () => window.CakeGame.start());
document.querySelector('[data-game="carwash"]').addEventListener('click', () => window.CarwashGame.start());
document.querySelectorAll('[data-game="drawing"], [data-drawing-replay]').forEach((button) => button.addEventListener('click', () => window.DrawingGame?.start()));
document.querySelectorAll('[data-home]').forEach((button) => button.addEventListener('click', () => showScreen('home')));
document.querySelectorAll('[data-replay]').forEach((button) => button.addEventListener('click', () => {
  const game = { stars: window.StarsGame, fruit: window.FruitGame, bubbles: window.BubblesGame, memory: window.MemoryGame, train: window.TrainGame, maze: window.MazeGame, puzzle: window.PuzzleGame, music: window.MusicGame, link: window.LinkGame, icecream: window.IcecreamGame, hideout: window.HideoutGame, builder: window.BuilderGame, cake: window.CakeGame, carwash: window.CarwashGame }[button.dataset.replay];
  game.start();
}));
document.querySelector('[data-parent]').addEventListener('click', openParentModal);
document.querySelector('[data-close-modal]').addEventListener('click', closeParentModal);
document.querySelector('[data-submit-parent]').addEventListener('click', () => {
  if (Date.now() < parentLockedUntil) {
    mathError.textContent = '请稍等一下，再试试看。';
    return;
  }
  if (Number(mathAnswer.value.trim()) === parentChallengeAnswer) {
    closeParentModal();
    openParentPage();
  } else {
    parentAttempts += 1;
    if (parentAttempts >= 3) {
      parentLockedUntil = Date.now() + 10000;
      parentAttempts = 0;
      document.querySelector('[data-submit-parent]').disabled = true;
      mathError.textContent = '先休息 10 秒，再请爸爸妈妈试试。';
      window.setTimeout(() => {
        document.querySelector('[data-submit-parent]').disabled = false;
        mathError.textContent = '';
      }, 10000);
      return;
    }
    mathError.textContent = '再算一算吧～';
    mathAnswer.focus();
  }
});
document.querySelector('#save-settings').addEventListener('click', () => {
  saveSettings({
    fruitLevels: Number(document.querySelector('#fruit-level-setting').value),
  });
  document.querySelector('#settings-saved').textContent = '设置已保存，下次游戏开始时生效。';
});
mathAnswer.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') document.querySelector('[data-submit-parent]').click();
});
recordTodayTime();
window.setInterval(recordTodayTime, 30000);
window.addEventListener('beforeunload', recordTodayTime);
