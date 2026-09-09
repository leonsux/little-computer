(function createFruitGame() {
  const levels = [
    [{ emoji: '🍎', name: '苹果' }],
    [{ emoji: '🍌', name: '香蕉' }, { emoji: '🍊', name: '橙子' }],
    [{ emoji: '🍓', name: '草莓' }, { emoji: '🍇', name: '葡萄' }, { emoji: '🍉', name: '西瓜' }],
    [{ emoji: '🍑', name: '桃子' }, { emoji: '🍐', name: '梨子' }, { emoji: '🍍', name: '菠萝' }, { emoji: '🧸', name: '玩具熊', distractor: true }],
  ];
  const screen = document.querySelector('#fruit-screen');
  const items = document.querySelector('#fruit-items');
  const basket = document.querySelector('#basket');
  const basketContents = document.querySelector('#basket-contents');
  const count = document.querySelector('#fruit-count');
  const total = document.querySelector('#fruit-total');
  const instruction = document.querySelector('#fruit-instruction');
  const tip = document.querySelector('#fruit-tip');
  let level = 0;
  let placed = 0;
  let dragState = null;
  let audioContext;

  function configuredLevels() {
    let settings = {};
    try { settings = JSON.parse(localStorage.getItem('littleComputer.settings') || '{}'); } catch (_) { settings = {}; }
    const levelCount = Math.min(4, Math.max(1, Number(settings.fruitLevels) || 4));
    return levels.slice(0, levelCount);
  }

  function tone(frequency, start, duration, volume = 0.09, type = 'sine') {
    audioContext ??= new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.03);
  }

  function playFruitSound(kind) {
    try {
      audioContext ??= new (window.AudioContext || window.webkitAudioContext)();
      if (audioContext.state === 'suspended') audioContext.resume();
      const now = audioContext.currentTime;
      if (kind === 'success') {
        tone(587.33, now, .2, .08);
        tone(783.99, now + .07, .25, .07);
      } else if (kind === 'wrong') {
        tone(220, now, .16, .035, 'triangle');
      } else {
        [523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => tone(frequency, now + index * .12, .34, .09));
      }
    } catch (_) {
      // 浏览器不支持 Web Audio 时，游戏仍然可以正常操作。
    }
  }

  function shuffle(list) {
    return [...list].sort(() => Math.random() - 0.5);
  }

  function start() {
    level = 0;
    setupLevel();
    window.showScreen('fruit');
  }

  function setupLevel() {
    const current = configuredLevels()[level];
    placed = 0;
    count.textContent = '0';
    total.textContent = String(current.filter((item) => !item.distractor).length);
    instruction.textContent = level === 3 ? '把水果放进篮子，玩具熊不用动哦！' : '把水果放进篮子吧！';
    tip.textContent = '按住水果，送它回家';
    items.innerHTML = '';
    basketContents.innerHTML = '';
    shuffle(current).forEach((item, index) => {
      const element = document.createElement('button');
      element.className = 'fruit-item';
      element.type = 'button';
      element.textContent = item.emoji;
      element.setAttribute('aria-label', item.name);
      element.dataset.distractor = String(Boolean(item.distractor));
      element.style.left = `${(index % 2) * 48 + (index > 1 ? 10 : 0)}%`;
      element.style.top = `${Math.floor(index / 2) * 47 + 4}%`;
      element.addEventListener('pointerdown', beginDrag);
      items.append(element);
    });
  }

  function beginDrag(event) {
    const element = event.currentTarget;
    if (element.classList.contains('correct')) return;
    const rect = element.getBoundingClientRect();
    dragState = { element, offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top, origin: { left: element.style.left, top: element.style.top } };
    element.classList.add('dragging');
    element.setPointerCapture(event.pointerId);
    element.addEventListener('pointermove', moveDrag);
    element.addEventListener('pointerup', endDrag, { once: true });
    element.addEventListener('pointercancel', endDrag, { once: true });
  }

  function moveDrag(event) {
    if (!dragState) return;
    const rect = items.getBoundingClientRect();
    dragState.element.style.left = `${event.clientX - rect.left - dragState.offsetX}px`;
    dragState.element.style.top = `${event.clientY - rect.top - dragState.offsetY}px`;
    const basketRect = basket.getBoundingClientRect();
    const inside = event.clientX > basketRect.left && event.clientX < basketRect.right && event.clientY > basketRect.top && event.clientY < basketRect.bottom;
    basket.classList.toggle('is-target', inside);
  }

  function endDrag(event) {
    if (!dragState) return;
    const { element, origin } = dragState;
    const basketRect = basket.getBoundingClientRect();
    const inside = event.clientX > basketRect.left && event.clientX < basketRect.right && event.clientY > basketRect.top && event.clientY < basketRect.bottom;
    element.classList.remove('dragging');
    basket.classList.remove('is-target');
    element.removeEventListener('pointermove', moveDrag);
    if (inside && element.dataset.distractor !== 'true') {
      placed += 1;
      count.textContent = String(placed);
      playFruitSound('success');
      const basketFruit = document.createElement('span');
      basketFruit.className = 'basket-fruit';
      basketFruit.textContent = element.textContent;
      basketContents.append(basketFruit);
      element.classList.add('correct');
      tip.textContent = placed === Number(total.textContent) ? '太棒啦！' : '叮！放得真好！';
      window.setTimeout(() => {
        element.remove();
        if (placed === Number(total.textContent)) nextLevel();
      }, 380);
    } else {
      playFruitSound('wrong');
      element.style.left = origin.left;
      element.style.top = origin.top;
      element.classList.add('returning');
      tip.textContent = element.dataset.distractor === 'true' ? '这是玩具熊，水果才去篮子里哦～' : '再试试～';
      window.setTimeout(() => element.classList.remove('returning'), 400);
    }
    dragState = null;
  }

  function nextLevel() {
    if (level === configuredLevels().length - 1) {
      const completed = Number(localStorage.getItem('littleComputer.fruitRounds') || 0);
      localStorage.setItem('littleComputer.fruitRounds', String(completed + 1));
      window.setTimeout(() => {
        window.showScreen('fruit-finish');
        window.playVictorySound();
        window.createFireworks('fruit-fireworks');
      }, 240);
      return;
    }
    level += 1;
    window.setTimeout(setupLevel, 450);
  }

  window.FruitGame = { start };
}());
