(function createPuzzleGame() {
  const stage = document.querySelector('#puzzle-stage');
  const board = document.querySelector('#puzzle-board');
  const pieces = document.querySelector('#puzzle-pieces');
  const hint = document.querySelector('#puzzle-hint');
  const tip = document.querySelector('#puzzle-tip');
  const scenes = [
    { name: '花园里的小兔', art: 'puzzle-garden', rows: 2 },
    { name: '海底的小伙伴', art: 'puzzle-ocean', rows: 3 },
    { name: '小屋前的聚会', art: 'puzzle-house', rows: 3 },
  ];
  let active = false, transitioning = false, level = 0, placed = 0, showHint = true;
  let drag = null;

  function picture(index) {
    const rowHeight = 600 / scenes[level].rows;
    return '<svg aria-hidden="true" viewBox="' + (index % 2 * 300) + ' ' + (Math.floor(index / 2) * rowHeight) + ' 300 ' + rowHeight + '"><use href="#' + scenes[level].art + '" width="600" height="600"/></svg>';
  }
  function renderHint() {
    board.classList.toggle('show-picture', showHint);
    hint.setAttribute('aria-pressed', String(showHint));
    hint.textContent = showHint ? '收起底图' : '看看底图';
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
  function abortDrag() {
    if (!drag) return;
    cancelDrag();
    tip.textContent = '小碎片回来了，慢慢再试一次。';
  }
  function validDrag() {
    if (!drag) return false;
    if (drag.width !== innerWidth || drag.height !== innerHeight || drag.scrollY !== scrollY || drag.scrollX !== scrollX) {
      abortDrag();
      return false;
    }
    return true;
  }
  function destination() {
    if (!drag || Math.hypot(drag.dx, drag.dy) < 16) return null;
    const rect = drag.element.getBoundingClientRect();
    const x = rect.left + rect.width / 2, y = rect.top + rect.height / 2;
    const slot = board.children[Number(drag.element.dataset.piece)];
    if (slot.classList.contains('is-filled')) return null;
    const target = slot.getBoundingClientRect();
    return x >= target.left - 8 && x <= target.right + 8 && y >= target.top - 8 && y <= target.bottom + 8 ? slot : null;
  }
  function move(dx, dy) {
    if (!validDrag()) return;
    const bounds = stage.getBoundingClientRect();
    drag.dx = Math.max(bounds.left - drag.origin.left + 3, Math.min(bounds.right - drag.origin.right - 3, dx));
    drag.dy = Math.max(bounds.top - drag.origin.top + 3, Math.min(bounds.bottom - drag.origin.bottom - 3, dy));
    drag.element.style.transform = 'translate(' + drag.dx + 'px, ' + drag.dy + 'px)';
    const target = destination();
    [...board.children].forEach(slot => slot.classList.toggle('is-target', slot === target));
    tip.textContent = target ? '画面对上啦，松开吧。' : '找找颜色和线条，哪里接得上？';
  }
  function begin(element, pointerId, x = 0, y = 0) {
    if (!active || transitioning || drag || element.disabled) return;
    window.GameHelp.hide();
    drag = { element, pointerId, x, y, dx: 0, dy: 0, origin: element.getBoundingClientRect(), width: innerWidth, height: innerHeight, scrollY, scrollX };
    element.classList.add('is-dragging');
    element.setAttribute('aria-pressed', 'true');
    if (pointerId !== null) element.setPointerCapture(pointerId);
  }
  function finish() {
    if (!validDrag()) return;
    const target = destination();
    const { element, pointerId } = drag;
    cancelDrag();
    if (!target) { tip.textContent = '这里还没接上，看看底图再试试。'; return; }
    target.classList.add('is-filled');
    target.setAttribute('aria-label', target.getAttribute('aria-label') + '，已拼好');
    element.disabled = true;
    element.classList.add('is-placed');
    placed += 1;
    const complete = placed === scenes[level].rows * 2;
    window.GameProgress.render(document.querySelector('#puzzle-trail'), scenes[level].rows * 2, placed, 'adventure-puzzle');
    window.GameAudio.play(complete);
    tip.textContent = complete ? '原来是这么美的画面！' : '接上一块啦，继续拼吧。';
    if (complete) {
      transitioning = true;
      incrementRecord('littleComputer.puzzlePictures');
      window.LevelTransition.show({ title: '小画面拼好啦！', note: '下一幅画面马上来', onDone: () => {
        if (!active) return;
        transitioning = false;
        level = (level + 1) % scenes.length;
        setup(pointerId === null);
      } });
    } else if (pointerId === null) pieces.querySelector('button:not(:disabled)').focus();
  }
  function setup(focus = false) {
    cancelDrag();
    placed = 0;
    showHint = level === 0;
    document.querySelector('#puzzle-level').textContent = scenes[level].name;
    stage.dataset.rows = String(scenes[level].rows);
    tip.textContent = showHint ? '照着底图，把碎片送回家。' : '试着自己拼，也可以打开底图。';
    const order = Array.from({ length: scenes[level].rows * 2 }, (_, index) => index);
    for (let index = order.length - 1; index > 0; index -= 1) {
      const other = Math.floor(Math.random() * (index + 1));
      [order[index], order[other]] = [order[other], order[index]];
    }
    // Avoid the one shuffle that would make the tray already match the board.
    if (order.every((value, index) => value === index)) order.push(order.shift());
    board.replaceChildren();
    pieces.replaceChildren();
    order.forEach((_, index) => {
      const slot = document.createElement('div');
      slot.className = 'puzzle-slot';
      slot.dataset.piece = String(index);
      slot.setAttribute('role', 'region');
      slot.setAttribute('aria-label', '第 ' + (Math.floor(index / 2) + 1) + ' 行第 ' + (index % 2 + 1) + ' 个拼图位置');
      slot.innerHTML = picture(index);
      board.append(slot);
    });
    order.forEach(index => {
      const element = document.createElement('button');
      element.type = 'button';
      element.className = 'puzzle-piece';
      element.dataset.piece = String(index);
      element.setAttribute('aria-label', '第 ' + (index + 1) + ' 块图片，空格拿起，方向键移动，空格放下');
      element.setAttribute('aria-pressed', 'false');
      element.innerHTML = picture(index);
      element.addEventListener('pointerdown', event => {
        if (event.button !== 0 || !event.isPrimary) return;
        event.preventDefault();
        element.focus({ preventScroll: true });
        begin(element, event.pointerId, event.clientX, event.clientY);
      });
      element.addEventListener('pointermove', event => { if (drag?.element === element && drag.pointerId === event.pointerId) move(event.clientX - drag.x, event.clientY - drag.y); });
      element.addEventListener('pointerup', event => {
        if (drag?.element !== element || drag.pointerId !== event.pointerId) return;
        move(event.clientX - drag.x, event.clientY - drag.y);
        finish();
      });
      element.addEventListener('pointercancel', abortDrag);
      element.addEventListener('lostpointercapture', () => { if (drag?.element === element) abortDrag(); });
      element.addEventListener('blur', () => { if (drag?.element === element && drag.pointerId === null) abortDrag(); });
      element.addEventListener('keydown', event => {
        if (event.key === ' ' || event.key === 'Enter') {
          event.preventDefault();
          if (event.repeat) return;
          if (!drag) begin(element, null);
          else if (drag.element === element && drag.pointerId === null) finish();
        } else if (event.key.startsWith('Arrow') && drag?.element === element && drag.pointerId === null) {
          event.preventDefault();
          const delta = event.shiftKey ? 8 : 24;
          move(drag.dx + (event.key === 'ArrowRight' ? delta : event.key === 'ArrowLeft' ? -delta : 0), drag.dy + (event.key === 'ArrowDown' ? delta : event.key === 'ArrowUp' ? -delta : 0));
        }
      });
      pieces.append(element);
    });
    renderHint();
    window.GameProgress.render(document.querySelector('#puzzle-trail'), scenes[level].rows * 2, 0, 'adventure-puzzle');
    if (focus) pieces.firstElementChild.focus();
  }
  hint.addEventListener('click', () => { if (!active || transitioning) return; showHint = !showHint; renderHint(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') abortDrag(); });
  window.addEventListener('resize', abortDrag);
  window.addEventListener('blur', abortDrag);
  window.addEventListener('scroll', abortDrag);
  document.addEventListener('visibilitychange', () => { if (document.hidden) abortDrag(); });
  function start() { window.showScreen('puzzle'); active = true; transitioning = false; level = 0; setup(); window.GameHelp.first('puzzle'); }
  function stop() { active = false; transitioning = false; cancelDrag(); window.LevelTransition.cancel(); }
  window.PuzzleGame = { start, stop };
})();
