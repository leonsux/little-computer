(function createBuilderGame() {
  const stage = document.querySelector('#builder-stage');
  const board = document.querySelector('#builder-board');
  const pieces = document.querySelector('#builder-pieces');
  const tip = document.querySelector('#builder-tip');
  const surprise = document.querySelector('#builder-surprise');
  const names = { cube: '方形积木', beam: '长方积木', roof: '三角积木', wheel: '圆形积木' };
  // Coordinates use square units. Parts keep their symbol proportions, including wide beams.
  const models = [
    { name: '小兔的新家', scene: 'house', columns: 2, rows: 2, parts: [
      ['beam', 0, 1, 2, '#e8c884'], ['roof', 0, 0, 2, '#d99680'], ['wheel', .5, 1, 1, '#8ebbc7'],
    ] },
    { name: '小桥连起两岸', scene: 'bridge', columns: 3, rows: 2, parts: [
      ['cube', 0, 1, 1, '#a7bb97'], ['cube', 2, 1, 1, '#a7bb97'], ['beam', .5, 0, 2, '#d7b58a'],
    ] },
    { name: '玩具小火车', scene: 'train', columns: 3, rows: 3, parts: [
      ['beam', .5, 1, 2, '#d99680'], ['cube', 1.5, 0, 1, '#8ebbc7'], ['cube', .5, 0, 1, '#e8c884'],
      ['wheel', .5, 2, 1, '#99b694'], ['wheel', 1.5, 2, 1, '#99b694'],
    ] },
    { name: '小火箭去看星星', scene: 'rocket', columns: 3, rows: 3, parts: [
      ['cube', 1, 2, 1, '#8ebbc7'], ['cube', 1, 1, 1, '#8ebbc7'], ['roof', 1, 0, 1, '#d99680'],
      ['roof', 0, 2, 1, '#e8c884'], ['roof', 2, 2, 1, '#e8c884'], ['wheel', 1, 1, 1, '#e8c884'],
    ] },
    { name: '朋友们的积木城堡', scene: 'castle', columns: 3, rows: 3, parts: [
      ['beam', .5, 2, 2, '#d7b58a'], ['cube', 0, 1, 1, '#a7bb97'], ['cube', 2, 1, 1, '#a7bb97'],
      ['roof', 0, 0, 1, '#d99680'], ['roof', 2, 0, 1, '#d99680'],
      ['wheel', 0, 1, 1, '#e8c884'], ['wheel', 2, 1, 1, '#e8c884'],
    ] },
  ];
  let active = false, transitioning = false, level = 0;
  let placed = new Set(), drag = null;

  function picture(part) {
    const width = part[0] === 'beam' || part[0] === 'roof' ? 200 : 100;
    return '<svg aria-hidden="true" viewBox="0 0 ' + width + ' 100" preserveAspectRatio="xMidYMax meet"><use href="#builder-' + part[0] + '" width="' + width + '" height="100"/></svg>';
  }
  function render() {
    const next = models[level].parts.findIndex((_, index) => !placed.has(index));
    [...board.children].forEach((slot, index) => {
      slot.classList.toggle('is-filled', placed.has(index));
      slot.classList.toggle('is-next', index === next && !transitioning);
      slot.setAttribute('aria-label', '第 ' + (index + 1) + ' 块' + names[models[level].parts[index][0]] + '的位置' + (placed.has(index) ? '，已经搭好' : ''));
    });
    window.GameProgress.render(document.querySelector('#builder-trail'), models[level].parts.length, placed.size, 'builder-cube');
  }
  function cancelDrag() {
    if (!drag) return;
    const previous = drag;
    drag = null;
    previous.element.style.transform = '';
    previous.element.classList.remove('is-dragging');
    previous.element.setAttribute('aria-pressed', 'false');
    if (previous.pointerId !== null && previous.element.hasPointerCapture(previous.pointerId)) previous.element.releasePointerCapture(previous.pointerId);
    board.querySelectorAll('.is-target').forEach(slot => slot.classList.remove('is-target'));
  }
  function abortDrag() { if (drag) { cancelDrag(); tip.textContent = '积木回到桌上啦，慢慢再试一次。'; } }
  function validDrag() {
    if (!drag) return false;
    if (drag.width !== innerWidth || drag.height !== innerHeight || drag.scrollX !== scrollX || drag.scrollY !== scrollY) { abortDrag(); return false; }
    return true;
  }
  function destination() {
    if (!drag || Math.hypot(drag.dx, drag.dy) < 16) return null;
    const r = drag.element.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    return [...board.children].find(slot => {
      if (placed.has(Number(slot.dataset.part)) || slot.dataset.shape !== drag.element.dataset.shape) return false;
      const target = slot.getBoundingClientRect();
      return x >= target.left && x <= target.right && y >= target.top && y <= target.bottom;
    }) || null;
  }
  function move(dx, dy) {
    if (!validDrag()) return;
    const bounds = stage.getBoundingClientRect();
    // Keep the center in the play area, so every edge of a visible target remains reachable.
    const x = drag.origin.left + drag.origin.width / 2, y = drag.origin.top + drag.origin.height / 2;
    drag.dx = Math.max(bounds.left + 3 - x, Math.min(bounds.right - 3 - x, dx));
    drag.dy = Math.max(bounds.top + 3 - y, Math.min(bounds.bottom - 3 - y, dy));
    drag.element.style.transform = 'translate(' + drag.dx + 'px, ' + drag.dy + 'px)';
    const target = destination();
    [...board.children].forEach(slot => slot.classList.toggle('is-target', slot === target));
    tip.textContent = target ? '位置对上啦，松开就搭好了。' : '找找一样的轮廓，把积木送过去。';
  }
  function begin(element, pointerId, x = 0, y = 0) {
    if (!active || transitioning || drag || element.disabled) return;
    window.GameHelp.hide();
    drag = { element, pointerId, x, y, dx: 0, dy: 0, origin: element.getBoundingClientRect(), width: innerWidth, height: innerHeight, scrollX, scrollY };
    element.classList.add('is-dragging');
    element.setAttribute('aria-pressed', 'true');
    if (pointerId !== null) element.setPointerCapture(pointerId);
    tip.textContent = '拿起一块啦，按住送到它的轮廓。';
  }
  function finish() {
    if (!validDrag()) return;
    const target = destination(), { element, pointerId } = drag;
    cancelDrag();
    if (!target) { tip.textContent = '这里还不合适，积木回来了。再看看轮廓吧。'; return; }
    placed.add(Number(target.dataset.part));
    target.style.setProperty('--block-color', models[level].parts[Number(element.dataset.part)][4]);
    element.disabled = true;
    element.classList.add('is-placed');
    transitioning = placed.size === models[level].parts.length;
    render();
    window.GameAudio.play(transitioning);
    tip.textContent = transitioning ? '小世界搭好啦，看看谁来玩！' : '搭上一块啦，小世界长大了一点！';
    if (transitioning) {
      stage.classList.add('is-complete');
      [...pieces.children].forEach(piece => { piece.disabled = true; });
      incrementRecord('littleComputer.builderModels');
      window.LevelTransition.show({ title: models[level].name + '搭好啦！', note: '下一件积木作品马上来', onDone: () => {
        if (!active) return;
        transitioning = false;
        level = (level + 1) % models.length;
        setup(pointerId === null);
      } });
    } else if (pointerId === null) pieces.querySelector('button:not(:disabled)')?.focus({ preventScroll: true });
  }
  function setup(focus = false) {
    cancelDrag();
    placed = new Set();
    const model = models[level];
    stage.dataset.model = model.scene;
    stage.classList.remove('is-complete');
    document.querySelector('#builder-level').textContent = model.name;
    board.style.setProperty('--columns', model.columns);
    board.style.setProperty('--rows', model.rows);
    board.replaceChildren();
    pieces.replaceChildren();
    model.parts.forEach((part, index) => {
      const slot = document.createElement('div');
      slot.className = 'builder-slot';
      slot.dataset.part = String(index);
      slot.dataset.shape = part[0];
      slot.setAttribute('role', 'region');
      slot.style.setProperty('--x', part[1]); slot.style.setProperty('--y', part[2]); slot.style.setProperty('--w', part[3]);
      slot.style.setProperty('--block-color', part[4]);
      slot.innerHTML = picture(part);
      board.append(slot);
    });
    const order = model.parts.map((_, index) => index);
    for (let index = order.length - 1; index > 0; index -= 1) {
      const other = Math.floor(Math.random() * (index + 1));
      [order[index], order[other]] = [order[other], order[index]];
    }
    order.forEach(index => {
      const part = model.parts[index];
      const element = document.createElement('button');
      element.type = 'button';
      element.className = 'builder-piece';
      element.dataset.part = String(index);
      element.dataset.shape = part[0];
      element.style.setProperty('--block-color', part[4]);
      element.setAttribute('aria-label', '第 ' + (index + 1) + ' 块' + names[part[0]] + '，空格拿起，方向键移动，空格放下');
      element.setAttribute('aria-pressed', 'false');
      element.innerHTML = picture(part);
      element.addEventListener('pointerdown', event => {
        if (event.button !== 0 || !event.isPrimary) return;
        event.preventDefault(); element.focus({ preventScroll: true });
        begin(element, event.pointerId, event.clientX, event.clientY);
      });
      element.addEventListener('pointermove', event => { if (drag?.element === element && drag.pointerId === event.pointerId) move(event.clientX - drag.x, event.clientY - drag.y); });
      element.addEventListener('pointerup', event => {
        if (drag?.element !== element || drag.pointerId !== event.pointerId) return;
        move(event.clientX - drag.x, event.clientY - drag.y); finish();
      });
      element.addEventListener('pointercancel', abortDrag);
      element.addEventListener('lostpointercapture', () => { if (drag?.element === element) abortDrag(); });
      element.addEventListener('blur', () => { if (drag?.element === element && drag.pointerId === null) abortDrag(); });
      element.addEventListener('keydown', event => {
        if (event.key === ' ' || event.key === 'Enter') {
          event.preventDefault(); if (event.repeat) return;
          if (!drag) begin(element, null);
          else if (drag.element === element && drag.pointerId === null) finish();
        } else if (event.key.startsWith('Arrow') && drag?.element === element && drag.pointerId === null) {
          event.preventDefault(); const delta = event.shiftKey ? 8 : 24;
          move(drag.dx + (event.key === 'ArrowRight' ? delta : event.key === 'ArrowLeft' ? -delta : 0), drag.dy + (event.key === 'ArrowDown' ? delta : event.key === 'ArrowUp' ? -delta : 0));
        }
      });
      pieces.append(element);
    });
    surprise.innerHTML = model.scene === 'rocket' ? '<span class="builder-flame">✦</span>' : '<svg><use href="#' + (model.scene === 'bridge' || model.scene === 'train' ? 'mini-train' : 'garden-rabbit-art') + '"/></svg><span>♡</span>';
    tip.textContent = '照着轮廓搭，先搭哪一块都可以。';
    render();
    if (focus) pieces.firstElementChild.focus({ preventScroll: true });
  }
  document.addEventListener('keydown', event => { if (event.key === 'Escape') abortDrag(); });
  window.addEventListener('resize', abortDrag);
  window.addEventListener('scroll', abortDrag);
  window.addEventListener('blur', abortDrag);
  document.addEventListener('visibilitychange', () => { if (document.hidden) abortDrag(); });
  function start() { window.showScreen('builder'); active = true; transitioning = false; level = 0; setup(); window.GameHelp.first('builder'); }
  function stop() { active = false; transitioning = false; cancelDrag(); window.LevelTransition.cancel(); }
  window.BuilderGame = { start, stop };
})();
