(function createPipesGame() {
  const levels = [
    { name: '直直的小水路', path: [3, 4, 5] },
    { name: '拐个弯去浇花', path: [0, 1, 4, 7, 8] },
    { name: '爬上小山坡', path: [6, 7, 4, 1, 2] },
    { name: '绕过小石头', path: [0, 1, 4, 3, 6, 7, 8] },
    { name: '弯弯的花园水路', path: [0, 1, 2, 5, 4, 3, 6, 7, 8] },
  ];
  const board = document.querySelector('#pipes-board');
  const stage = document.querySelector('#pipes-stage');
  const tip = document.querySelector('#pipes-tip');
  const water = document.querySelector('#pipes-water');
  const hint = document.querySelector('#pipes-hint');
  const lastBoards = new Map();
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const flowDuration = 300;
  let active = false, transitioning = false, flowing = false, level = 0, cells = [], wet = [], blocked = null;
  let waterRoute = [], flowingCell = null, flowTimer, finishFlow, stopWaterSound;
  const rotate = mask => ((mask << 1) & 15) | (mask >> 3);
  const sourceRow = () => Math.floor(levels[level].path[0] / 3);
  const goalRow = () => Math.floor(levels[level].path.at(-1) / 3);
  const trace = () => window.PipePaths.trace(cells, 3, sourceRow(), goalRow());
  function pipeIncoming(index) {
    const position = waterRoute.indexOf(index);
    if (position === -1) return -1;
    if (position === 0) return 3;
    const previous = waterRoute[position - 1];
    return previous === index - 3 ? 0 : previous === index + 1 ? 1 : previous === index + 3 ? 2 : 3;
  }
  function pipePicture(mask, incoming) {
    const points = [[50, 0], [100, 50], [50, 100], [0, 50]];
    const directions = [0, 1, 2, 3].filter(direction => mask & (1 << direction));
    const ends = directions.includes(incoming) ? [points[incoming], points[directions.find(direction => direction !== incoming)]] : directions.map(direction => points[direction]);
    const line = 'M' + ends[0].join(' ') + 'L50 50L' + ends[1].join(' ');
    return '<svg viewBox="0 0 100 100" aria-hidden="true"><path d="' + line + '" class="pipe-outline"/><path d="' + line + '" class="pipe-core"/><path d="' + line + '" class="pipe-water" pathLength="100"/><path d="' + line + '" class="pipe-current" pathLength="100"/></svg><span class="pipe-turn" aria-hidden="true">↻</span>';
  }
  function cancelFlow() {
    window.GameClock.clearTimeout(flowTimer); finishFlow = null;
    stopWaterSound?.(); stopWaterSound = null;
    flowing = false; flowingCell = null;
    stage.classList.remove('is-flowing');
    board.querySelector('.is-filling')?.classList.remove('is-filling');
  }
  function update() {
    const directions = ['上', '右', '下', '左'];
    [...board.children].forEach((tile, index) => {
      if (!cells[index]) return;
      const incoming = pipeIncoming(index);
      if (tile.dataset.mask !== String(cells[index]) || tile.dataset.incoming !== String(incoming)) {
        tile.innerHTML = pipePicture(cells[index], incoming);
        tile.dataset.mask = String(cells[index]); tile.dataset.incoming = String(incoming);
      }
      tile.classList.toggle('is-wet', wet.includes(index));
      tile.classList.toggle('is-filling', flowingCell === index);
      tile.classList.toggle('is-blocked', blocked === index);
      tile.disabled = transitioning || flowing;
      tile.setAttribute('aria-label', '第 ' + (Math.floor(index / 3) + 1) + ' 行第 ' + (index % 3 + 1) + ' 列水管，通向' + directions.filter((_, direction) => cells[index] & (1 << direction)).join('和') + '，点击转动');
    });
    water.disabled = hint.disabled = transitioning || flowing;
    stage.classList.toggle('is-flowing', flowing);
    stage.classList.toggle('is-complete', transitioning);
    window.GameProgress.render(document.querySelector('#pipes-trail'), levels.length, level + Number(transitioning), 'garden-flower-art');
  }
  function setup(focus = false) {
    cancelFlow(); waterRoute = []; wet = []; blocked = null; cells = Array(9).fill(0);
    const path = levels[level].path;
    const direction = (from, to) => to === from - 3 ? 0 : to === from + 1 ? 1 : to === from + 3 ? 2 : 3;
    path.forEach((index, position) => {
      const incoming = position ? direction(index, path[position - 1]) : 3;
      const outgoing = position < path.length - 1 ? direction(index, path[position + 1]) : 1;
      let mask = (1 << incoming) | (1 << outgoing);
      for (let turn = Math.floor(Math.random() * 4); turn > 0; turn--) mask = rotate(mask);
      cells[index] = mask;
    });
    if (trace().complete) cells[path[0]] = rotate(cells[path[0]]);
    if (cells.join(',') === lastBoards.get(level)) {
      cells[path[0]] = rotate(cells[path[0]]);
      if (trace().complete) cells[path[1]] = rotate(cells[path[1]]);
    }
    lastBoards.set(level, cells.join(','));
    board.replaceChildren();
    cells.forEach((mask, index) => {
      const tile = document.createElement(mask ? 'button' : 'span');
      tile.className = mask ? 'pipe-tile' : 'pipe-meadow';
      tile.dataset.cell = String(index);
      if (mask) {
        tile.type = 'button';
        tile.addEventListener('click', () => {
          if (!active || transitioning || flowing) return;
          window.GameHelp.hide(); cells[index] = rotate(cells[index]); waterRoute = []; wet = []; blocked = null; update();
          tip.textContent = '转好啦，看看两头接上了吗？接好后点「放水啦」。'; window.GameAudio.play(false);
        });
        tile.addEventListener('keydown', event => {
          const steps = { ArrowUp: -3, ArrowRight: 1, ArrowDown: 3, ArrowLeft: -1 };
          if (!(event.key in steps)) return;
          event.preventDefault();
          const next = index + steps[event.key];
          if (next < 0 || next > 8 || ((event.key === 'ArrowLeft' || event.key === 'ArrowRight') && Math.floor(next / 3) !== Math.floor(index / 3))) return;
          board.querySelector('button[data-cell="' + next + '"]')?.focus();
        });
      } else {
        tile.setAttribute('aria-hidden', 'true'); tile.innerHTML = '<svg><use href="#garden-seed-art"/></svg>';
      }
      board.append(tile);
    });
    stage.style.setProperty('--source-row', sourceRow() + 1);
    stage.style.setProperty('--goal-row', goalRow() + 1);
    document.querySelector('#pipes-level').textContent = levels[level].name;
    const friend = window.GameAnimals.friends[level % window.GameAnimals.friends.length];
    document.querySelector('#pipes-friend use').setAttribute('href', '#' + friend.symbol + '-head');
    document.querySelector('#pipes-greeting').textContent = '帮' + friend.name + '的小花喝到水';
    tip.textContent = '从左边的龙头看起，点水管转一转，让管口连起来。'; update();
    if (focus) board.querySelector('button').focus();
  }
  hint.addEventListener('click', () => {
    if (!active || transitioning || flowing) return;
    window.GameHelp.hide(); blocked = trace().blocked; update();
    tip.textContent = blocked === null ? '水路已经接好了，亲手点「放水啦」吧。' : '圈起来的地方还没接通，看看它和旁边的管口。';
  });
  water.addEventListener('click', event => {
    if (!active || transitioning || flowing) return;
    window.GameHelp.hide(); const result = trace();
    flowing = true; waterRoute = result.wet; wet = []; blocked = null; flowingCell = null;
    stopWaterSound = window.GameAudio.startWater();
    stage.style.setProperty('--flow-duration', flowDuration + 'ms'); update();
    tip.textContent = '咕噜咕噜，看看小水流走到哪里。';
    finishFlow = () => {
      if (!active || !flowing) return;
      cancelFlow(); wet = result.wet; blocked = result.blocked;
      if (!result.complete) {
        update(); tip.textContent = '水在这里停住啦。转一转断口，再放水试试。';
        if (event.detail === 0) board.querySelector('button[data-cell="' + blocked + '"]')?.focus({ preventScroll: true });
        return;
      }
      transitioning = true; incrementRecord('littleComputer.pipeGardens'); update(); window.GameAudio.play(true);
      tip.textContent = '咕噜咕噜，小花喝到水，开花啦！';
      window.LevelTransition.show({ title: '小花喝到水啦！', note: '再去照顾一座小花园', onDone: () => {
        if (!active) return;
        transitioning = false; level = (level + 1) % levels.length; setup(event.detail === 0);
      } });
    };
    if (reducedMotion.matches) {
      wet = result.wet; update(); flowTimer = window.GameClock.setTimeout(() => finishFlow?.(), 250);
      return;
    }
    let position = 0;
    const advance = () => {
      if (!active || !flowing) return;
      if (flowingCell !== null) wet.push(flowingCell);
      if (position === waterRoute.length) { finishFlow?.(); return; }
      flowingCell = waterRoute[position++]; update();
      flowTimer = window.GameClock.setTimeout(advance, flowDuration);
    };
    flowTimer = window.GameClock.setTimeout(advance, flowDuration);
  });
  reducedMotion.addEventListener('change', event => { if (event.matches) finishFlow?.(); });
  function start() { cancelFlow(); window.showScreen('pipes'); active = true; transitioning = false; level = 0; setup(); window.GameHelp.first('pipes'); }
  function stop() { active = false; transitioning = false; cancelFlow(); window.LevelTransition.cancel(); }
  window.PipesGame = { start, stop };
})();
