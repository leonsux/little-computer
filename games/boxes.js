(function createBoxesGame() {
  const rules = window.BoxesRules;
  const screen = document.querySelector('#boxes-screen');
  const stage = document.querySelector('#boxes-stage');
  const board = document.querySelector('#boxes-board');
  const view = document.querySelector('#boxes-view');
  const tip = document.querySelector('#boxes-tip');
  const undo = document.querySelector('#boxes-undo');
  const picker = document.querySelector('#boxes-levels');
  const reset = document.querySelector('#boxes-reset');
  let active = false, finished = false, level = 0, map, state, history = [];
  const arrows = { ArrowUp: 'up', ArrowRight: 'right', ArrowDown: 'down', ArrowLeft: 'left' };
  const picture = symbol => '<svg aria-hidden="true"><use href="#' + symbol + '"/></svg>';

  function followPlayer() {
    const cell = board.children[state.player].getBoundingClientRect(), bounds = view.getBoundingClientRect();
    if (cell.left < bounds.left + 4) view.scrollLeft += cell.left - bounds.left - 4;
    else if (cell.right > bounds.right - 4) view.scrollLeft += cell.right - bounds.right + 4;
    if (cell.top < bounds.top + 4) view.scrollTop += cell.top - bounds.top - 4;
    else if (cell.bottom > bounds.bottom - 4) view.scrollTop += cell.bottom - bounds.bottom + 4;
  }
  function render() {
    [...board.children].forEach((cell, index) => {
      const wall = map.walls.includes(index), box = state.boxes.includes(index), goal = map.goals.includes(index), player = state.player === index;
      const adjacent = ['up', 'right', 'down', 'left'].some(direction => rules.neighbor(map, state.player, direction) === index);
      cell.className = 'boxes-cell' + (wall ? ' is-wall' : '') + (goal ? ' is-goal' : '') + (box ? ' has-box' : '') + (player ? ' has-player' : '') + (box && goal ? ' is-delivered' : '') + (adjacent && !wall && !finished ? ' is-near' : '');
      cell.dataset.box = String(box); cell.dataset.goal = String(goal); cell.dataset.player = String(player);
      cell.disabled = wall || finished;
      cell.tabIndex = player ? 0 : -1;
      cell.setAttribute('aria-current', player ? 'location' : 'false');
      cell.setAttribute('aria-label', '第 ' + (Math.floor(index / map.columns) + 1) + ' 行第 ' + (index % map.columns + 1) + ' 格，' + (wall ? '木栅栏' : player ? '小熊在这里' : box ? (goal ? '已放到星形垫的箱子' : '箱子') : goal ? '星形垫' : '空地'));
      cell.innerHTML = (goal ? '<span class="boxes-target" aria-hidden="true">★</span>' : '') +
        (wall ? '<span class="boxes-fence" aria-hidden="true"></span>' : player ? picture('animal-polarBear') : box ? picture('boxes-crate') : '') +
        (box && goal ? '<span class="boxes-check" aria-hidden="true">✓</span>' : '');
    });
    undo.disabled = finished || !history.length;
    screen.querySelectorAll('[data-box-direction]').forEach(button => { button.disabled = finished; });
    [...picker.children].forEach((button, index) => button.setAttribute('aria-pressed', String(index === level)));
    const delivered = state.boxes.filter(box => map.goals.includes(box)).length;
    window.GameProgress.render(document.querySelector('#boxes-trail'), map.goals.length, delivered, 'boxes-crate');
    document.querySelector('#boxes-status').textContent = '把箱子都推到星形垫上';
    stage.classList.toggle('is-complete', finished);
  }
  function move(direction, keyboard = false) {
    if (!active || finished) return;
    window.GameHelp.hide();
    const next = rules.step(map, state, direction);
    if (!next) { tip.textContent = '这边推不动，绕到另一侧试试。也可以撤销。'; return; }
    const pushed = state.boxes.includes(next.player);
    history.push(state); state = next;
    finished = rules.complete(map, state);
    tip.textContent = finished ? '箱子都到家啦！' : pushed && state.boxes.some(box => rules.inCorner(map, box)) ? '箱子靠到角落了。点「退一步」，换个方向想想。' : pushed ? '留一条路，让小熊能绕到箱子另一侧。' : '站到箱子后面，才能往前推。';
    render(); followPlayer();
    if (keyboard && !finished) board.children[state.player].focus({ preventScroll: true });
    if (pushed || finished) window.GameAudio.play(finished, finished ? null : 392);
    if (finished) {
      incrementRecord('littleComputer.boxBoards');
      window.LevelTransition.show({ title: '仓库整理好啦！', note: level === rules.levels.length - 1 ? '完成大挑战，再来一轮' : '下一间仓库等着你', onDone: () => {
        if (!active) return;
        setup((level + 1) % rules.levels.length, keyboard);
      } });
    }
  }
  function setup(index, keyboard = false) {
    window.LevelTransition.cancel(); window.GameHelp.hide();
    level = index; finished = false; history = [];
    map = rules.parse(rules.levels[level].rows);
    state = { player: map.player, boxes: [...map.boxes] };
    stage.dataset.level = String(level);
    document.querySelector('#boxes-level').textContent = '第 ' + (level + 1) + ' 间 · ' + rules.levels[level].name;
    board.style.setProperty('--columns', map.columns);
    board.replaceChildren();
    for (let index = 0; index < map.columns * map.rows; index++) {
      const cell = document.createElement('button');
      cell.type = 'button'; cell.dataset.cell = String(index);
      cell.addEventListener('click', event => {
        if (!active || finished) return;
        const direction = ['up', 'right', 'down', 'left'].find(direction => rules.neighbor(map, state.player, direction) === index);
        if (direction) move(direction, event.detail === 0);
        else if (index !== state.player) { window.GameHelp.hide(); tip.textContent = '点小熊旁边的一格，或者点方向按钮走。'; }
      });
      board.append(cell);
    }
    tip.textContent = '只能推，不能拉。想一想，小熊要站在哪里？';
    render(); followPlayer();
    if (keyboard) board.children[state.player].focus({ preventScroll: true });
  }
  rules.levels.forEach((item, index) => {
    const button = document.createElement('button'); button.type = 'button';
    button.textContent = String(index + 1); button.dataset.level = String(index);
    button.setAttribute('aria-label', '第 ' + (index + 1) + ' 关，' + item.name);
    button.addEventListener('click', () => { if (active) setup(index); }); picker.append(button);
  });
  screen.querySelectorAll('[data-box-direction]').forEach(button => button.addEventListener('click', event => move(button.dataset.boxDirection, event.detail === 0)));
  undo.addEventListener('click', event => {
    if (!active || finished || !history.length) return;
    window.GameHelp.hide(); state = history.pop(); render(); followPlayer();
    tip.textContent = '退回一步啦，可以试试别的路线。';
    if (event.detail === 0) board.children[state.player].focus({ preventScroll: true });
  });
  reset.addEventListener('click', event => { if (active) setup(level, event.detail === 0); });
  screen.addEventListener('keydown', event => {
    if (!active || event.altKey || event.ctrlKey || event.metaKey || !(event.key in arrows)) return;
    event.preventDefault();
    // Each press is one deliberate step; holding a key must not accidentally push a box into a corner.
    if (!event.repeat) move(arrows[event.key], true);
  });
  window.addEventListener('resize', () => { if (active) followPlayer(); });
  function start() {
    window.showScreen('boxes');
    if (screen.classList.contains('hidden')) return;
    active = true; setup(0); window.GameHelp.first('boxes');
  }
  function stop() { active = false; window.LevelTransition.cancel(); }
  window.BoxesGame = { start, stop };
})();
