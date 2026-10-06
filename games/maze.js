(function createMazeGame() {
  const screen = document.querySelector('#maze-screen');
  const board = document.querySelector('#maze-board');
  const viewport = document.querySelector('#maze-viewport');
  const stage = screen.querySelector('.maze-stage');
  const tip = document.querySelector('#maze-tip');
  const columns = 9, rows = 7, carrotCount = 6;
  let active = false, finished = false, position = 0, lastArrowAt = -Infinity;
  let scene;
  let collected = new Set(), visited = new Set();
  const pickupEffects = new Map();
  let previousTerrain = '';
  try { previousTerrain = localStorage.getItem('littleComputer.mazeTerrain') || ''; } catch (_) {}

  function neighbors(index, step = 1) {
    const row = Math.floor(index / columns), column = index % columns;
    return [
      column >= step ? index - step : -1,
      column + step < columns ? index + step : -1,
      row >= step ? index - columns * step : -1,
      row + step < rows ? index + columns * step : -1,
    ].filter(value => value >= 0);
  }

  function generate() {
    const tiles = Array(columns * rows).fill('#');
    // Omit one old corridor. Every edge in the room grid has an alternate route,
    // so generation remains connected while guaranteeing a different terrain.
    const oldCorridors = [];
    if (previousTerrain.length === tiles.length && /^[.#]+$/.test(previousTerrain)) {
      [...previousTerrain].forEach((tile, index) => {
        const row = Math.floor(index / columns), column = index % columns;
        if (tile === '.' && row % 2 !== column % 2) oldCorridors.push(index);
      });
    }
    const blocked = oldCorridors.length ? oldCorridors[Math.floor(Math.random() * oldCorridors.length)] : -1;
    const rooms = new Set([0]), stack = [0];
    tiles[0] = '.';
    while (stack.length) {
      const current = stack[stack.length - 1];
      const choices = neighbors(current, 2).filter(next => !rooms.has(next) && (current + next) / 2 !== blocked);
      if (!choices.length) { stack.pop(); continue; }
      const next = choices[Math.floor(Math.random() * choices.length)];
      rooms.add(next);
      tiles[(current + next) / 2] = '.';
      tiles[next] = '.';
      stack.push(next);
    }
    const distances = Array(tiles.length).fill(-1), queue = [0];
    distances[0] = 0;
    for (let offset = 0; offset < queue.length; offset += 1) {
      for (const next of neighbors(queue[offset])) {
        if (tiles[next] === '#' || distances[next] !== -1) continue;
        distances[next] = distances[queue[offset]] + 1;
        queue.push(next);
      }
    }
    const home = tiles.length - 1;
    const choices = [...rooms].filter(index => index !== home && distances[index] >= 4);
    for (let index = choices.length - 1; index > 0; index -= 1) {
      const other = Math.floor(Math.random() * (index + 1));
      [choices[index], choices[other]] = [choices[other], choices[index]];
    }
    previousTerrain = tiles.join('');
    try { localStorage.setItem('littleComputer.mazeTerrain', previousTerrain); } catch (_) { /* Maps still change in memory. */ }
    return { tiles, home, carrots: new Set(choices.slice(0, carrotCount)) };
  }

  function showPlayer() {
    const rect = board.children[position].getBoundingClientRect(), bounds = viewport.getBoundingClientRect();
    if (rect.left < bounds.left + 8) viewport.scrollLeft += rect.left - bounds.left - 8;
    else if (rect.right > bounds.right - 8) viewport.scrollLeft += rect.right - bounds.right + 8;
    if (rect.top < bounds.top + 8) viewport.scrollTop += rect.top - bounds.top - 8;
    else if (rect.bottom > bounds.bottom - 8) viewport.scrollTop += rect.bottom - bounds.bottom + 8;
  }

  function render() {
    const ready = collected.size === carrotCount;
    [...board.children].forEach((cell, index) => {
      const wall = scene.tiles[index] === '#';
      const carrot = scene.carrots.has(index) && !collected.has(index);
      const home = index === scene.home;
      cell.classList.toggle('is-current', index === position);
      cell.classList.toggle('is-near', !wall && neighbors(position).includes(index) && !finished);
      cell.classList.toggle('is-visited', visited.has(index));
      cell.classList.toggle('is-ready', home && ready);
      cell.disabled = wall || finished;
      cell.setAttribute('aria-current', index === position ? 'location' : 'false');
      cell.setAttribute('aria-label', '第 ' + (Math.floor(index / columns) + 1) + ' 行第 ' + (index % columns + 1) + ' 格，' +
        (wall ? '树丛' : index === position ? '小兔在这里' : home ? '小兔的家' : carrot ? '胡萝卜' : '小路') +
        (!wall && neighbors(position).includes(index) && !finished ? '，可以走过去' : ''));
      const symbol = wall ? 'adventure-tree' : index === position ? 'garden-rabbit-art' : home ? 'adventure-house' : carrot ? 'adventure-carrot' : null;
      cell.innerHTML = symbol ? '<svg aria-hidden="true"><use href="#' + symbol + '"/></svg>' : '<span aria-hidden="true">' + (visited.has(index) ? '·' : '') + '</span>';
    });
    window.GameProgress.render(document.querySelector('#maze-trail'), carrotCount, collected.size, 'adventure-carrot');
  }

  function clearPickupEffects() {
    pickupEffects.forEach((timer, cell) => {
      clearTimeout(timer);
      cell.classList.remove('is-collecting');
    });
    pickupEffects.clear();
  }

  function showPickup(index) {
    const cell = board.children[index];
    cell.classList.add('is-collecting');
    pickupEffects.set(cell, setTimeout(() => {
      cell.classList.remove('is-collecting');
      pickupEffects.delete(cell);
    }, 550));
  }

  function walk(index, keyboard = false) {
    if (!active || finished || index === position) return;
    window.GameHelp.hide();
    if (!neighbors(position).includes(index) || scene.tiles[index] === '#') {
      tip.textContent = '树丛过不去，换个方向试试吧。';
      return;
    }
    position = index;
    visited.add(index);
    const pickup = scene.carrots.has(index) && !collected.has(index);
    if (pickup) collected.add(index);
    const atHome = index === scene.home;
    finished = atHome && collected.size === carrotCount;
    tip.textContent = finished ? '带齐宝物，小兔回家啦！' : atHome ? '还有胡萝卜等着你，出去找找吧。' :
      collected.size === carrotCount ? '胡萝卜齐啦，找到小屋吧。' : '可以走回头路，慢慢找宝物。';
    window.GameAudio.play(finished, pickup ? 1047 : null);
    if (finished) {
      stage.classList.add('is-finished');
      incrementRecord('littleComputer.mazeTrips');
      window.LevelTransition.show({ title: '小兔带着宝物回家啦！', note: '这片森林探索完成啦', onDone: () => {
        if (active) tip.textContent = '宝物都找齐啦！点「换张地图」再去探险。';
      } });
    }
    render();
    if (pickup) showPickup(index);
    if (keyboard && !finished) board.children[position].focus({ preventScroll: true });
    showPlayer();
  }

  function setup() {
    clearPickupEffects();
    scene = generate();
    position = 0;
    finished = false;
    lastArrowAt = -Infinity;
    collected = new Set();
    visited = new Set([position]);
    stage.classList.remove('is-finished');
    document.querySelector('#maze-level').textContent = '随机森林 · 找齐 6 个胡萝卜';
    board.dataset.columns = String(columns);
    board.dataset.rows = String(rows);
    board.replaceChildren();
    scene.tiles.forEach((tile, index) => {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'maze-cell' + (tile === '#' ? ' is-wall' : '');
      cell.dataset.tile = tile === '#' ? '#' : index === 0 ? 's' : index === scene.home ? 'g' : scene.carrots.has(index) ? 'c' : '.';
      cell.dataset.cell = String(index);
      cell.addEventListener('click', event => walk(index, event.detail === 0));
      board.append(cell);
    });
    render();
    viewport.scrollTop = 0;
    viewport.scrollLeft = 0;
  }

  screen.addEventListener('keydown', event => {
    const offsets = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -columns, ArrowDown: columns };
    if (!active || event.altKey || event.ctrlKey || event.metaKey || !(event.key in offsets)) return;
    event.preventDefault();
    if (finished) return;
    const now = performance.now();
    if (event.repeat && now - lastArrowAt < 140) return;
    lastArrowAt = now;
    walk(position + offsets[event.key], true);
  });
  window.addEventListener('resize', () => { if (active) showPlayer(); });
  function start() {
    window.showScreen('maze');
    active = true;
    setup();
    window.GameHelp.first('maze');
  }
  function stop() { active = false; clearPickupEffects(); window.LevelTransition.cancel(); }
  window.MazeGame = { start, stop };
})();
