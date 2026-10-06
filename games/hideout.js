(function createHideoutGame() {
  const friends = {
    rabbit: { name: '小兔', symbol: 'garden-rabbit-art', clue: '长长的耳朵' },
    butterfly: { name: '蝴蝶', symbol: 'garden-butterfly-art', clue: '花花的小翅膀' },
    turtle: { name: '小乌龟', symbol: 'hideout-turtle', clue: '圆圆的小脑袋' },
    fox: { name: '小狐狸', symbol: 'hideout-fox', clue: '尖尖的橘色耳朵' },
    owl: { name: '猫头鹰', symbol: 'hideout-owl', clue: '紫色的小耳尖' },
    fish: { name: '小鱼', symbol: 'mini-fish', clue: '金色的小鱼鳍' },
  };
  const scenes = [
    { name: '草地上的悄悄话', theme: 'meadow', friends: ['rabbit', 'butterfly', 'turtle'], extras: ['flower'] },
    { name: '小狐狸来玩啦', theme: 'garden', friends: ['fox', 'rabbit', 'turtle', 'butterfly'], extras: ['star'] },
    { name: '森林里的新朋友', theme: 'forest', friends: ['owl', 'fox', 'butterfly', 'rabbit', 'turtle'], extras: ['flower', 'star'] },
    { name: '池塘边的聚会', theme: 'pond', friends: ['fish', 'turtle', 'rabbit', 'owl', 'butterfly', 'fox'], extras: ['flower', 'star'] },
    { name: '晚霞里的捉迷藏', theme: 'sunset', friends: ['fox', 'owl', 'fish', 'butterfly', 'turtle', 'rabbit'], extras: ['flower', 'star', 'flower'] },
  ];
  const covers = { bush: '树丛', house: '小屋', pot: '花盆', rock: '小石头' };
  const spots = document.querySelector('#hideout-spots');
  const stage = document.querySelector('#hideout-stage');
  const tip = document.querySelector('#hideout-tip');
  const clue = document.querySelector('#hideout-clue');
  const hint = document.querySelector('#hideout-hint');
  let active = false, transitioning = false, level = 0, found = 0;
  let deck = [], matched = new Set(), opened = new Set(), highlighted = -1;
  let hintTimer;
  const peekTimers = new Map();

  function clearHint() { clearTimeout(hintTimer); highlighted = -1; }
  function clearTimers() {
    clearHint();
    peekTimers.forEach(timer => clearTimeout(timer));
    peekTimers.clear();
    opened.clear();
  }
  function currentFriend() { return scenes[level].friends[found]; }
  function render() {
    [...spots.children].forEach((button, index) => {
      const isFound = matched.has(index), isOpen = isFound || opened.has(index);
      button.classList.toggle('is-found', isFound);
      button.classList.toggle('is-open', isOpen);
      button.classList.toggle('is-hint', index === highlighted);
      button.disabled = transitioning || isFound;
      button.setAttribute('aria-pressed', String(isOpen));
      const animal = friends[deck[index]];
      button.setAttribute('aria-label', '第 ' + (index + 1) + ' 处' + covers[button.dataset.cover] + '，' +
        (animal ? isFound ? animal.name + '，已经找到' : isOpen ? animal.name + '正在打招呼' : '露出' + animal.clue : isOpen ? '发现小惊喜' : '里面藏着小惊喜'));
    });
    clue.classList.toggle('is-complete', transitioning);
    document.querySelector('#hideout-friend').textContent = transitioning ? '朋友找齐啦！' : friends[currentFriend()].name;
    if (!transitioning) clue.querySelector('use').setAttribute('href', '#' + friends[currentFriend()].symbol);
    hint.disabled = transitioning;
    window.GameProgress.render(document.querySelector('#hideout-trail'), scenes[level].friends.length, found, 'garden-butterfly-art');
  }
  function reveal(index, keyboard) {
    if (!active || transitioning || matched.has(index)) return;
    window.GameHelp.hide();
    clearHint();
    clearTimeout(peekTimers.get(index));
    peekTimers.delete(index);
    const friend = deck[index];
    if (friend !== currentFriend()) {
      opened.add(index);
      tip.textContent = friends[friend] ? friends[friend].name + '也想和你打招呼，接着找' + friends[currentFriend()].name + '吧。' : '发现一份小惊喜，朋友还躲在别的地方呢。';
      window.GameAudio.play(false, friends[friend] ? 392 : 523);
      // Surprises remain visible. Other friends hide again and can still be found later.
      if (friends[friend]) {
        peekTimers.set(index, setTimeout(() => {
          peekTimers.delete(index);
          if (!active) return;
          opened.delete(index);
          render();
        }, 1100));
      }
      render();
      return;
    }
    opened.delete(index);
    matched.add(index);
    found += 1;
    transitioning = found === scenes[level].friends.length;
    tip.textContent = transitioning ? '朋友都出来啦，一起去下个地方玩！' : '找到' + friends[friend].name + '啦！再看看下一位朋友。';
    render();
    window.GameAudio.play(transitioning);
    if (transitioning) {
      clearTimers();
      incrementRecord('littleComputer.hideoutScenes');
      window.LevelTransition.show({ title: '藏起来的朋友都找到啦！', note: '新的藏身处马上来', onDone: () => {
        if (!active) return;
        transitioning = false;
        level = (level + 1) % scenes.length;
        setup(keyboard);
      } });
    } else if (keyboard) spots.querySelector('button:not(:disabled)')?.focus({ preventScroll: true });
  }
  function setup(focus = false) {
    clearTimers();
    matched = new Set();
    found = 0;
    deck = [...scenes[level].friends, ...scenes[level].extras];
    for (let index = deck.length - 1; index > 0; index -= 1) {
      const other = Math.floor(Math.random() * (index + 1));
      [deck[index], deck[other]] = [deck[other], deck[index]];
    }
    stage.dataset.scene = scenes[level].theme;
    spots.dataset.total = String(deck.length);
    document.querySelector('#hideout-level').textContent = scenes[level].name;
    spots.replaceChildren();
    const coverNames = Object.keys(covers);
    deck.forEach((friend, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'hideout-spot';
      button.dataset.friend = friend;
      button.dataset.cover = coverNames[(index + level) % coverNames.length];
      const symbol = friends[friend]?.symbol || (friend === 'star' ? 'shape-star' : 'garden-flower-art');
      button.innerHTML = '<svg class="hideout-animal" aria-hidden="true"><use href="#' + symbol + '"/></svg>' +
        '<span class="hideout-cover" aria-hidden="true"></span><span class="hideout-check" aria-hidden="true">✓</span>';
      button.addEventListener('click', event => reveal(index, event.detail === 0));
      spots.append(button);
    });
    tip.textContent = '谁露出了一点点？先找' + friends[currentFriend()].name + '吧。';
    render();
    if (focus) spots.firstElementChild.focus({ preventScroll: true });
  }
  hint.addEventListener('click', () => {
    if (!active || transitioning) return;
    window.GameHelp.hide();
    clearHint();
    highlighted = deck.indexOf(currentFriend());
    tip.textContent = '这里有小动静，点开看看吧！';
    render();
    hintTimer = setTimeout(() => { highlighted = -1; if (active) render(); }, 2200);
  });
  function start() {
    window.showScreen('hideout');
    active = true;
    transitioning = false;
    level = 0;
    setup();
    window.GameHelp.first('hideout');
  }
  function stop() { active = false; transitioning = false; clearTimers(); window.LevelTransition.cancel(); }
  window.HideoutGame = { start, stop };
})();
