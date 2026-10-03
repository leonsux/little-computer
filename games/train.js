(function createTrainGame() {
  const stage = document.querySelector('#train-stage');
  const slots = document.querySelector('#train-slots');
  const pieces = document.querySelector('#train-pieces');
  const tip = document.querySelector('#train-tip');
  const kinds = {
    circle: { name: '圆形', color: '#eaa18c' }, square: { name: '方形', color: '#93bdce' },
    triangle: { name: '三角形', color: '#e9cf76' }, star: { name: '星形', color: '#a2c58a' },
  };
  const levels = [
    { name: '小火车来啦', slots: ['circle', 'square', 'triangle'], pieces: ['circle', 'square', 'triangle'] },
    { name: '换个座位', slots: ['triangle', 'circle', 'square'], pieces: ['circle', 'square', 'triangle'] },
    { name: '星星也上车', slots: ['square', 'star', 'circle', 'triangle'], pieces: ['circle', 'triangle', 'square', 'star'] },
  ];
  let active = false;
  let transitioning = false;
  let level = 0;
  let placed = 0;
  let drag = null;

  function cancelDrag() {
    if (!drag) return;
    const previous = drag;
    drag = null;
    previous.element.style.transform = '';
    previous.element.classList.remove('is-dragging');
    previous.element.setAttribute('aria-pressed', 'false');
    if (previous.pointerId !== null && previous.element.hasPointerCapture(previous.pointerId)) previous.element.releasePointerCapture(previous.pointerId);
    slots.querySelectorAll('.is-target').forEach(slot => slot.classList.remove('is-target'));
  }

  function abortDrag() {
    if (!drag) return;
    cancelDrag();
    tip.textContent = '图形回来了，再送一次吧。';
  }

  function dragStillValid() {
    if (!drag) return false;
    // Resize can be delivered after pointerup. Check the current viewport before accepting a drop.
    if (drag.viewWidth !== innerWidth || drag.viewHeight !== innerHeight) {
      abortDrag();
      return false;
    }
    return true;
  }

  function destination() {
    if (!drag || Math.hypot(drag.dx, drag.dy) < 16) return null;
    const rect = drag.element.getBoundingClientRect();
    const x = rect.left + rect.width / 2, y = rect.top + rect.height / 2;
    return [...slots.children].find(slot => {
      if (slot.classList.contains('is-filled') || slot.dataset.shape !== drag.element.dataset.shape) return false;
      const r = slot.getBoundingClientRect();
      return x >= r.left - 12 && x <= r.right + 12 && y >= r.top - 12 && y <= r.bottom + 12;
    });
  }

  function move(dx, dy) {
    if (!dragStillValid()) return;
    const bounds = stage.getBoundingClientRect();
    drag.dx = Math.max(bounds.left - drag.origin.left + 3, Math.min(bounds.right - drag.origin.right - 3, dx));
    drag.dy = Math.max(bounds.top - drag.origin.top + 3, Math.min(bounds.bottom - drag.origin.bottom - 3, dy));
    drag.element.style.transform = 'translate(' + drag.dx + 'px, ' + drag.dy + 'px)';
    const target = destination();
    [...slots.children].forEach(slot => slot.classList.toggle('is-target', slot === target));
    tip.textContent = target ? '找到座位啦，松开吧。' : '按住图形，找到一样的轮廓。';
  }

  function begin(element, pointerId, x = 0, y = 0) {
    if (!active || transitioning || drag || element.disabled) return;
    window.GameHelp.hide();
    drag = { element, pointerId, x, y, dx: 0, dy: 0, origin: element.getBoundingClientRect(), viewWidth: innerWidth, viewHeight: innerHeight };
    element.classList.add('is-dragging');
    element.setAttribute('aria-pressed', 'true');
    if (pointerId !== null) element.setPointerCapture(pointerId);
    tip.textContent = '拿起来啦，送进一样的车厢。';
  }

  function finish() {
    if (!dragStillValid()) return;
    const target = destination();
    const { element, pointerId } = drag;
    cancelDrag();
    if (!target) {
      tip.textContent = '图形回来了，看看轮廓再试试。';
      return;
    }
    element.disabled = true;
    element.classList.add('is-placed');
    target.classList.add('is-filled');
    target.setAttribute('aria-label', kinds[element.dataset.shape].name + '车厢，已装好');
    placed += 1;
    window.GameProgress.render(document.querySelector('#train-trail'), levels[level].slots.length, placed, 'mini-train');
    const complete = placed === levels[level].slots.length;
    tip.textContent = complete ? '装好啦，小火车出发！' : '坐好一个啦，还有朋友等你。';
    window.GameAudio.play(complete);
    if (complete) {
      transitioning = true;
      stage.classList.add('is-complete');
      incrementRecord('littleComputer.trainTrips');
      window.LevelTransition.show({
        title: '小火车出发啦！', note: '下一列小火车马上来',
        onDone: () => {
          if (!active) return;
          transitioning = false;
          level = (level + 1) % levels.length;
          setup(pointerId === null);
        },
      });
    } else if (pointerId === null) pieces.querySelector('button:not(:disabled)').focus();
  }

  function setup(focus = false) {
    cancelDrag();
    placed = 0;
    stage.classList.remove('is-complete');
    document.querySelector('#train-level').textContent = levels[level].name;
    tip.textContent = '看看形状，慢慢送过去。';
    slots.dataset.total = String(levels[level].slots.length);
    slots.replaceChildren();
    pieces.replaceChildren();
    window.GameProgress.render(document.querySelector('#train-trail'), levels[level].slots.length, 0, 'mini-train');
    levels[level].slots.forEach(kind => {
      const slot = document.createElement('div');
      slot.className = 'train-slot';
      slot.dataset.shape = kind;
      slot.style.setProperty('--shape-color', kinds[kind].color);
      slot.setAttribute('role', 'region');
      slot.setAttribute('aria-label', kinds[kind].name + '车厢');
      slot.innerHTML = '<svg aria-hidden="true"><use href="#shape-' + kind + '"/></svg>';
      slots.append(slot);
    });
    levels[level].pieces.forEach(kind => {
      const element = document.createElement('button');
      element.type = 'button';
      element.className = 'train-piece';
      element.dataset.shape = kind;
      element.style.setProperty('--shape-color', kinds[kind].color);
      element.setAttribute('aria-pressed', 'false');
      element.setAttribute('aria-label', kinds[kind].name + '，空格拿起，方向键移动，空格放下');
      element.innerHTML = '<svg aria-hidden="true"><use href="#shape-' + kind + '"/></svg>';
      element.addEventListener('pointerdown', event => {
        if (event.button !== 0 || !event.isPrimary) return;
        event.preventDefault();
        element.focus({ preventScroll: true });
        begin(element, event.pointerId, event.clientX, event.clientY);
      });
      element.addEventListener('pointermove', event => {
        if (drag?.element === element && drag.pointerId === event.pointerId) move(event.clientX - drag.x, event.clientY - drag.y);
      });
      element.addEventListener('pointerup', event => {
        if (drag?.element === element && drag.pointerId === event.pointerId) {
          move(event.clientX - drag.x, event.clientY - drag.y);
          finish();
        }
      });
      element.addEventListener('pointercancel', abortDrag);
      element.addEventListener('lostpointercapture', () => { if (drag?.element === element) abortDrag(); });
      element.addEventListener('keydown', event => {
        if (event.key === ' ' || event.key === 'Enter') {
          event.preventDefault();
          if (event.repeat) return;
          if (!drag) begin(element, null);
          else if (drag.element === element && drag.pointerId === null) finish();
        } else if (event.key.startsWith('Arrow') && drag?.element === element && drag.pointerId === null) {
          event.preventDefault();
          const delta = event.shiftKey ? 8 : 24;
          move(drag.dx + (event.key === 'ArrowRight' ? delta : event.key === 'ArrowLeft' ? -delta : 0),
            drag.dy + (event.key === 'ArrowDown' ? delta : event.key === 'ArrowUp' ? -delta : 0));
        }
      });
      element.addEventListener('blur', () => { if (drag?.element === element && drag.pointerId === null) abortDrag(); });
      pieces.append(element);
    });
    if (focus) pieces.firstElementChild.focus();
  }

  function start() {
    window.showScreen('train');
    active = true;
    transitioning = false;
    level = 0;
    setup();
    window.GameHelp.first('train');
  }
  function stop() {
    active = false;
    transitioning = false;
    cancelDrag();
    window.LevelTransition.cancel();
  }
  document.addEventListener('keydown', event => { if (event.key === 'Escape') abortDrag(); });
  window.addEventListener('blur', abortDrag);
  window.addEventListener('resize', abortDrag);
  document.addEventListener('visibilitychange', () => { if (document.hidden) abortDrag(); });
  window.TrainGame = { start, stop };
})();
