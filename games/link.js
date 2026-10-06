(function createLinkGame() {
  const stage = document.querySelector('#link-stage');
  const board = document.querySelector('#link-board');
  const cards = document.querySelector('#link-cards');
  const line = document.querySelector('#link-line');
  const tip = document.querySelector('#link-tip');
  const hint = document.querySelector('#link-hint');
  const pictures = {
    rabbit: ['garden-rabbit-art', '小兔'], fish: ['mini-fish', '小鱼'],
    butterfly: ['garden-butterfly-art', '蝴蝶'], flower: ['garden-flower-art', '小花'],
    apple: ['play-apple', '苹果'], pear: ['play-pear', '梨子'],
    star: ['shape-star', '星星'], bell: ['music-bell', '铃铛'],
    tree: ['adventure-tree', '小树'], carrot: ['adventure-carrot', '胡萝卜'],
    train: ['mini-train', '小火车'], circle: ['shape-circle', '圆形'],
    square: ['shape-square', '方形'], triangle: ['shape-triangle', '三角形'],
    house: ['adventure-house', '小屋'], pencil: ['garden-pencil-art', '画笔'],
    drum: ['music-drum', '小鼓'], keys: ['music-keys', '木琴'],
    basket: ['garden-basket-art', '篮子'],
    seed: ['garden-seed-art', '种子'], sprout: ['garden-sprout-art', '嫩芽'],
    bud: ['garden-bud-art', '花苞'], pot: ['garden-pot-art', '花盆'],
    can: ['garden-can-art', '水壶'],
  };
  const pictureOrder = Object.keys(pictures);
  const levels = [
    { name: '伙伴来做客', columns: 4, pictures: pictureOrder.slice(0, 6) },
    { name: '花园找朋友', columns: 4, pictures: pictureOrder.slice(0, 8) },
    { name: '水果来做客', columns: 5, pictures: pictureOrder.slice(0, 10) },
    { name: '热闹的小花园', columns: 6, pictures: pictureOrder.slice(0, 12) },
    { name: '大家来聚会', columns: 7, pictures: pictureOrder.slice(0, 14) },
    { name: '森林小旅行', columns: 8, pictures: pictureOrder.slice(0, 16) },
    { name: '玩具小火车', columns: 9, pictures: pictureOrder.slice(0, 18) },
    { name: '音乐游乐会', columns: 10, pictures: pictureOrder.slice(0, 20) },
    { name: '花园大野餐', columns: 11, pictures: pictureOrder.slice(0, 22) },
    { name: '朋友大联欢', columns: 12, pictures: pictureOrder.slice(0, 24) },
  ];
  let active = false, transitioning = false;
  let level = 0, columns = 2, selected = null;
  let deck = [], matched = new Set(), hints = [];
  let lineTimer;

  function currentBoard() { return deck.map((picture, index) => matched.has(index) ? null : picture); }
  function clearLine() { clearTimeout(lineTimer); line.replaceChildren(); }
  function updateColumns() {
    columns = Math.min(levels[level].columns, Math.max(2, Math.floor((stage.clientWidth - 36 + 12) / 112)));
    cards.style.setProperty('--link-columns', columns);
  }
  function ensureMove() {
    const current = currentBoard();
    if (matched.size === deck.length || window.LinkPaths.findPair(current, columns)) return false;
    const arranged = window.LinkPaths.arrange(current, columns);
    deck = deck.map((picture, index) => matched.has(index) ? picture : arranged[index]);
    selected = null;
    hints = [];
    tip.textContent = '朋友换了个位置，继续找一找。';
    return true;
  }
  function render() {
    [...cards.children].forEach((card, index) => {
      const done = matched.has(index);
      card.dataset.picture = deck[index];
      card.classList.toggle('is-matched', done);
      card.classList.toggle('is-selected', index === selected);
      card.classList.toggle('is-hint', hints.includes(index));
      card.disabled = transitioning || done;
      card.setAttribute('aria-pressed', String(index === selected));
      card.setAttribute('aria-label', '第 ' + (index + 1) + ' 张，' + pictures[deck[index]][1] + (done ? '，已连好' : ''));
      card.querySelector('use').setAttribute('href', '#' + pictures[deck[index]][0]);
    });
    hint.disabled = transitioning;
    window.GameProgress.render(document.querySelector('#link-trail'), levels[level].pictures.length, matched.size / 2, 'garden-butterfly-art');
  }
  function drawPath(path) {
    clearLine();
    const origin = board.getBoundingClientRect(), first = cards.firstElementChild.getBoundingClientRect();
    const rows = Math.ceil(deck.length / columns);
    const x = column => column === 0 ? 8 : column === columns + 1 ? origin.width - 8 : first.left - origin.left + 50 + (column - 1) * 112;
    const y = row => row === 0 ? 8 : row === rows + 1 ? origin.height - 8 : first.top - origin.top + 50 + (row - 1) * 112;
    line.setAttribute('viewBox', '0 0 ' + origin.width + ' ' + origin.height);
    const route = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    route.setAttribute('points', path.map(([row, column]) => x(column) + ',' + y(row)).join(' '));
    line.append(route);
    lineTimer = setTimeout(clearLine, 650);
  }
  function choose(index, keyboard) {
    if (!active || transitioning || matched.has(index)) return;
    window.GameHelp.hide();
    hints = [];
    if (selected === null || selected === index) {
      selected = selected === index ? null : index;
      tip.textContent = selected === null ? '点一张，再找一样的朋友。' : '再点一张一样的，看看能不能连起来。';
    } else if (deck[selected] !== deck[index]) {
      selected = index;
      tip.textContent = '这两张不一样，再找找它的朋友。';
    } else {
      const path = window.LinkPaths.findPath(currentBoard(), columns, selected, index);
      if (!path) {
        tip.textContent = '这里被朋友挡住啦，试试别的一对。';
      } else {
        matched.add(selected);
        matched.add(index);
        selected = null;
        drawPath(path);
        tip.textContent = '连上啦，朋友找到彼此了！';
        const complete = matched.size === deck.length;
        window.GameAudio.play(complete);
        if (complete) {
          transitioning = true;
          incrementRecord('littleComputer.linkBoards');
          window.LevelTransition.show({ title: '朋友都连好啦！', note: level === levels.length - 1 ? '全部 ' + levels.length + ' 关完成，新一轮马上开始' : '下一关的朋友马上来', onDone: () => {
            if (!active) return;
            transitioning = false;
            level = (level + 1) % levels.length;
            setup(keyboard);
          } });
        } else if (ensureMove()) clearLine();
      }
    }
    render();
    if (keyboard && matched.has(index) && !transitioning) cards.querySelector('button:not(:disabled)')?.focus();
  }
  function setup(focus = false) {
    clearLine();
    selected = null;
    hints = [];
    matched = new Set();
    deck = [...levels[level].pictures, ...levels[level].pictures];
    updateColumns();
    deck = window.LinkPaths.arrange(deck, columns);
    stage.dataset.level = String(level + 1);
    document.querySelector('#link-level').textContent = '第 ' + (level + 1) + ' / ' + levels.length + ' 关 · ' + levels[level].name;
    tip.textContent = '点一张，再找一样的朋友。';
    cards.replaceChildren();
    deck.forEach((picture, index) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'link-card';
      card.innerHTML = '<svg aria-hidden="true"><use/></svg><span class="link-check" aria-hidden="true">✓</span>';
      card.addEventListener('click', event => choose(index, event.detail === 0));
      cards.append(card);
    });
    render();
    if (focus) cards.firstElementChild.focus();
  }
  hint.addEventListener('click', () => {
    if (!active || transitioning) return;
    window.GameHelp.hide();
    const pair = window.LinkPaths.findPair(currentBoard(), columns);
    hints = pair ? [pair.first, pair.second] : [];
    tip.textContent = '亮边的两张可以连，自己点一点吧。';
    render();
  });
  window.addEventListener('resize', () => {
    if (!active) return;
    clearLine();
    hints = [];
    updateColumns();
    if (!transitioning) ensureMove();
    render();
  });
  document.querySelector('#link-screen').addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !active || transitioning) return;
    selected = null;
    hints = [];
    render();
    tip.textContent = '点一张，再找一样的朋友。';
  });
  function start() { window.showScreen('link'); active = true; transitioning = false; level = 0; setup(); window.GameHelp.first('link'); }
  function stop() { active = false; transitioning = false; selected = null; hints = []; clearLine(); window.LevelTransition.cancel(); }
  window.LinkGame = { start, stop };
})();
