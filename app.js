const screens = {
  home: document.querySelector('#home-screen'),
  stars: document.querySelector('#stars-screen'),
  fruit: document.querySelector('#fruit-screen'),
  drawing: document.querySelector('#drawing-screen'),
  finish: document.querySelector('#finish-screen'),
  'fruit-finish': document.querySelector('#fruit-finish-screen'),
  'drawing-finish': document.querySelector('#drawing-finish-screen'),
  parent: document.querySelector('#parent-screen'),
};

const starField = document.querySelector('#star-field');
const starCount = document.querySelector('#star-count');
const starTip = document.querySelector('#star-tip');
const toast = document.querySelector('#toast');
const parentModal = document.querySelector('#parent-modal');
const mathAnswer = document.querySelector('#math-answer');
const mathError = document.querySelector('#math-error');

let foundStars = 0;
let starTarget = 20;
let audioContext;
let parentChallengeAnswer = 0;
let parentAttempts = 0;
let parentLockedUntil = 0;

const defaultSettings = { starTarget: 20, fruitLevels: 4 };

function getSettings() {
  try {
    return { ...defaultSettings, ...JSON.parse(localStorage.getItem('littleComputer.settings') || '{}') };
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
  const now = Date.now();
  const previous = Number(localStorage.getItem('littleComputer.lastTimeAt') || now);
  const seconds = Math.min(Math.max(0, Math.round((now - previous) / 1000)), 60);
  localStorage.setItem(todayKey(), String(Number(localStorage.getItem(todayKey()) || 0) + seconds));
  localStorage.setItem('littleComputer.lastTimeAt', String(now));
}

function readNumber(key) {
  return Number(localStorage.getItem(key) || 0);
}

function refreshParentPage() {
  const settings = getSettings();
  document.querySelector('#today-minutes').textContent = String(Math.floor(readNumber(todayKey()) / 60));
  document.querySelector('#stat-star-clicks').textContent = String(readNumber('littleComputer.starClicks'));
  document.querySelector('#stat-star-rounds').textContent = String(readNumber('littleComputer.starRounds'));
  document.querySelector('#stat-fruit-rounds').textContent = String(readNumber('littleComputer.fruitRounds'));
  document.querySelector('#stat-drawing-count').textContent = String(readNumber('littleComputer.drawingCount'));
  document.querySelector('#star-target-setting').value = String(settings.starTarget);
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

function playVictorySound() {
  try {
    audioContext ??= new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === 'suspended') audioContext.resume();
    const now = audioContext.currentTime;
    [523.25, 659.25, 783.99, 1046.5, 1318.51].forEach((frequency, index) => {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = index === 4 ? 'triangle' : 'sine';
      oscillator.frequency.value = frequency;
      const start = now + index * 0.11;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(index === 4 ? 0.12 : 0.08, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.38);
      oscillator.connect(gain).connect(audioContext.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.42);
    });
  } catch (_) {
    // 浏览器不支持 Web Audio 时，游戏仍然可以正常完成。
  }
}

function createFireworks(layerId) {
  const layer = document.querySelector(`#${layerId}`);
  if (!layer) return;
  layer.innerHTML = '';
  for (let burstIndex = 0; burstIndex < 3; burstIndex += 1) {
    const burst = document.createElement('span');
    burst.className = 'firework';
    for (let particleIndex = 0; particleIndex < 8; particleIndex += 1) {
      const particle = document.createElement('i');
      particle.style.setProperty('--rotation', `${particleIndex * 45}deg`);
      burst.append(particle);
    }
    layer.append(burst);
  }
}
window.playVictorySound = playVictorySound;
window.createFireworks = createFireworks;

function showScreen(name) {
  Object.values(screens).forEach((screen) => screen.classList.add('hidden'));
  screens[name].classList.remove('hidden');
}
window.showScreen = showScreen;

function playChime() {
  try {
    audioContext ??= new (window.AudioContext || window.webkitAudioContext)();
    const now = audioContext.currentTime;
    [523.25, 659.25].forEach((frequency, index) => {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, now + index * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.12, now + index * 0.08 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.08 + 0.32);
      oscillator.connect(gain).connect(audioContext.destination);
      oscillator.start(now + index * 0.08);
      oscillator.stop(now + index * 0.08 + 0.34);
    });
  } catch (_) {
    // 音效不可用时不影响游戏本身。
  }
}

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function placeStar(star) {
  const field = starField.getBoundingClientRect();
  const size = randomBetween(82, 126);
  const safeX = Math.max(22, field.width * 0.08);
  const safeY = Math.max(22, field.height * 0.08);
  const left = randomBetween(safeX, Math.max(safeX, field.width - size - safeX));
  const top = randomBetween(safeY, Math.max(safeY, field.height - size - safeY));
  star.style.setProperty('--star-size', `${size}px`);
  star.style.left = `${left}px`;
  star.style.top = `${top}px`;
}

function beginStars() {
  starTarget = getSettings().starTarget;
  foundStars = 0;
  starCount.textContent = '0';
  document.querySelector('#star-target').textContent = String(starTarget);
  starTip.textContent = '找到一颗亮晶晶的星星吧！';
  starField.innerHTML = '';
  showScreen('stars');
  requestAnimationFrame(() => {
    const star = document.createElement('button');
    star.className = 'star-button';
    star.type = 'button';
    star.textContent = '★';
    star.setAttribute('aria-label', '一颗星星');
    star.addEventListener('click', () => collectStar(star));
    starField.append(star);
    placeStar(star);
  });
}

function createStarBurst(star) {
  const starRect = star.getBoundingClientRect();
  const fieldRect = starField.getBoundingClientRect();
  const burst = document.createElement('span');
  burst.className = 'star-burst';
  burst.setAttribute('aria-hidden', 'true');
  burst.style.left = `${starRect.left - fieldRect.left + starRect.width / 2}px`;
  burst.style.top = `${starRect.top - fieldRect.top + starRect.height / 2}px`;
  for (let index = 0; index < 8; index += 1) burst.append(document.createElement('i'));
  starField.append(burst);
  window.setTimeout(() => burst.remove(), 650);
}

function collectStar(star) {
  if (star.classList.contains('collected')) return;
  foundStars += 1;
  createStarBurst(star);
  star.classList.add('collected');
  starCount.textContent = String(foundStars);
  const progress = document.querySelector('.progress-pill');
  progress.classList.remove('bump');
  void progress.offsetWidth;
  progress.classList.add('bump');
  playChime();
  const saved = Number(localStorage.getItem('littleComputer.starClicks') || 0);
  localStorage.setItem('littleComputer.starClicks', String(saved + 1));
  if (foundStars >= starTarget) {
    const rounds = readNumber('littleComputer.starRounds');
    localStorage.setItem('littleComputer.starRounds', String(rounds + 1));
    document.querySelector('#finish-subtitle').textContent = `你找到了 ${starTarget} 颗星星！`;
    playVictorySound();
    createFireworks('stars-fireworks');
    setTimeout(() => showScreen('finish'), 320);
    return;
  }
  starTip.textContent = foundStars >= 10 ? '星星藏得更远啦，继续找找看！' : '找到了！再找一颗吧！';
  setTimeout(() => {
    star.classList.remove('collected');
    placeStar(star);
  }, 240);
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

document.querySelectorAll('[data-game="stars"], [data-replay]').forEach((button) => button.addEventListener('click', beginStars));
document.querySelectorAll('[data-game="fruit"], [data-fruit-replay]').forEach((button) => button.addEventListener('click', () => window.FruitGame?.start()));
document.querySelectorAll('[data-game="drawing"], [data-drawing-replay]').forEach((button) => button.addEventListener('click', () => window.DrawingGame?.start()));
document.querySelectorAll('[data-home]').forEach((button) => button.addEventListener('click', () => showScreen('home')));
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
    starTarget: Number(document.querySelector('#star-target-setting').value),
    fruitLevels: Number(document.querySelector('#fruit-level-setting').value),
  });
  document.querySelector('#settings-saved').textContent = '设置已保存，下次游戏开始时生效。';
});
mathAnswer.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') document.querySelector('[data-submit-parent]').click();
});
window.addEventListener('resize', () => {
  const star = starField.querySelector('.star-button:not(.collected)');
  if (star) placeStar(star);
});
recordTodayTime();
window.setInterval(recordTodayTime, 30000);
window.addEventListener('beforeunload', recordTodayTime);
