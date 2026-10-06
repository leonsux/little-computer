(function createFruitGame() {
  const stage = document.querySelector('.fruit-stage');
  const items = document.querySelector('#fruit-items');
  const baskets = [...stage.querySelectorAll('.basket')];
  const tip = document.querySelector('#fruit-tip');
  const lessonButtons = [...document.querySelectorAll('[data-fruit-step]')];
  const lessons = [
    { title: '先送一个', hint: '把苹果送进篮子吧', fruits: ['apple'] },
    { title: '再送几个', hint: '一个一个，送进同一个篮子', fruits: ['apple', 'pear', 'apple'] },
    { title: '送远一点', hint: '按住水果，送到远处的篮子', fruits: ['apple', 'pear', 'apple'] },
    { title: '分开放好', hint: '看篮子上的图案，把水果送回家', fruits: ['apple', 'pear', 'apple', 'pear'] },
  ];
  let active = false;
  let level = 0;
  let levelCount = 4;
  let placed = 0;
  let recorded = false;
  let drag = null;
  let transitioning = false;
  let completed = new Set();

  function renderProgress() {
    window.GameProgress.render(document.querySelector('#fruit-trail'), lessons[level].fruits.length, placed, 'garden-basket-art');
    lessonButtons.forEach((button, index) => {
      button.disabled = index >= levelCount;
      button.classList.toggle('is-complete', completed.has(index));
      if (index === level) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    });
  }

  function art(kind) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const use = document.createElementNS(svg.namespaceURI, 'use');
    svg.setAttribute('aria-hidden', 'true');
    use.setAttribute('href', '#play-' + kind);
    svg.append(use);
    return svg;
  }

  function cancelDrag() {
    if (!drag) return;
    const previous = drag;
    drag = null;
    previous.element.style.transform = '';
    previous.element.classList.remove('dragging');
    if (previous.pointerId !== null && previous.element.hasPointerCapture(previous.pointerId)) {
      previous.element.releasePointerCapture(previous.pointerId);
    }
    baskets.forEach((basket) => basket.classList.remove('is-target'));
  }

  function dropTarget() {
    if (!drag || Math.hypot(drag.dx, drag.dy) < 16) return null;
    const rect = drag.element.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    return baskets.find((basket) => {
      if (basket.classList.contains('hidden')) return false;
      const r = basket.getBoundingClientRect();
      return x >= r.left - 12 && x <= r.right + 12 && y >= r.top - 12 && y <= r.bottom + 12;
    });
  }

  function move(dx, dy) {
    if (!validDrag()) return;
    const bounds = stage.getBoundingClientRect();
    drag.dx = Math.max(bounds.left - drag.origin.left + 3, Math.min(bounds.right - drag.origin.right - 3, dx));
    drag.dy = Math.max(bounds.top - drag.origin.top + 3, Math.min(bounds.bottom - drag.origin.bottom - 3, dy));
    drag.element.style.transform = 'translate(' + drag.dx + 'px, ' + drag.dy + 'px)';
    const destination = dropTarget();
    const correct = destination && (level !== 3 || destination === baskets[drag.element.dataset.fruit === 'pear' ? 1 : 0]);
    baskets.forEach((basket) => basket.classList.toggle('is-target', correct && basket === destination));
    tip.textContent = correct ? '到篮子啦，松开吧' : destination ? '看看图案，送到另一个篮子吧' : '按住水果，慢慢送过去';
  }

  function begin(element, pointerId, x = 0, y = 0) {
    if (!active || transitioning || drag || element.disabled) return;
    window.GameHelp.hide();
    drag = { element, pointerId, x, y, dx: 0, dy: 0, origin: element.getBoundingClientRect(), viewWidth: innerWidth, viewHeight: innerHeight };
    element.classList.add('dragging');
    if (pointerId !== null) element.setPointerCapture(pointerId);
    tip.textContent = '拿起来啦，送进篮子吧';
  }

  function validDrag() {
    if (!drag) return false;
    // Some browsers deliver pointerup before resize, after the viewport has already changed.
    if (drag.viewWidth !== innerWidth || drag.viewHeight !== innerHeight) {
      cancelDrag();
      tip.textContent = '水果回来了，再送一次吧';
      return false;
    }
    return true;
  }

  function finish() {
    if (!validDrag()) return;
    const destination = dropTarget();
    const { element, pointerId } = drag;
    const correct = destination && (level !== 3 || destination === baskets[element.dataset.fruit === 'pear' ? 1 : 0]);
    cancelDrag();
    if (!correct) {
      tip.textContent = destination ? '看看篮子上的图案，再送一次吧' : '水果回来了，再送一次吧';
      return;
    }
    element.disabled = true;
    element.classList.add('correct');
    destination.querySelector('.basket-contents').append(art(element.dataset.fruit));
    placed += 1;
    document.querySelector('#fruit-count').textContent = String(placed);
    const complete = placed === lessons[level].fruits.length;
    window.GameAudio.play(complete);
    tip.textContent = complete ? '都放好啦，谢谢你！' : '放好一个啦，还有朋友等你';
    if (complete) completed.add(level);
    renderProgress();
    if (completed.size === levelCount && !recorded) {
      recorded = true;
      incrementRecord('littleComputer.fruitRounds');
    }
    if (complete) {
      transitioning = true;
      const finished = completed.size === levelCount;
      window.LevelTransition.show({
        title: level === 3 ? '水果都回家啦！' : '篮子装好啦！',
        note: finished ? '马上再玩一遍' : '下一关马上开始',
        onDone: () => {
          if (!active) return;
          transitioning = false;
          if (finished) start();
          else {
            const following = lessons.findIndex((_, index) => index > level && index < levelCount && !completed.has(index));
            level = following >= 0 ? following : lessons.findIndex((_, index) => index < levelCount && !completed.has(index));
            setupLevel(pointerId === null);
          }
        },
      });
    }
    if (pointerId === null) {
      if (!complete) items.querySelector('.fruit-item:not(:disabled)').focus();
    }
  }

  function setupLevel(focus = false) {
    cancelDrag();
    placed = 0;
    const lesson = lessons[level];
    stage.dataset.level = String(level);
    document.querySelector('#fruit-lesson').textContent = lesson.title;
    document.querySelector('#fruit-instruction').textContent = lesson.hint;
    document.querySelector('#fruit-count').textContent = '0';
    document.querySelector('#fruit-total').textContent = String(lesson.fruits.length);
    tip.textContent = '按住，移动，再松开。';
    baskets.forEach((basket) => basket.querySelector('.basket-contents').replaceChildren());
    baskets[1].classList.toggle('hidden', level !== 3);
    baskets[0].querySelector('.basket-example').classList.toggle('hidden', level !== 3);
    baskets[0].querySelector('.basket-label').textContent = level === 3 ? '苹果住这里' : '送到这里';
    baskets[0].setAttribute('aria-label', level === 3 ? '苹果篮' : '水果篮');
    items.replaceChildren();
    renderProgress();
    lesson.fruits.forEach((kind) => {
      const element = document.createElement('button');
      element.type = 'button';
      element.className = 'fruit-item';
      element.dataset.fruit = kind;
      element.setAttribute('aria-label', (kind === 'apple' ? '苹果' : '梨子') + '，空格拿起，方向键移动，空格放下');
      element.append(art(kind));
      element.addEventListener('pointerdown', (event) => {
        if (event.button !== 0 || !event.isPrimary || drag) return;
        event.preventDefault();
        element.focus({ preventScroll: true });
        begin(element, event.pointerId, event.clientX, event.clientY);
      });
      element.addEventListener('pointermove', (event) => {
        if (drag?.element === element && drag.pointerId === event.pointerId) move(event.clientX - drag.x, event.clientY - drag.y);
      });
      element.addEventListener('pointerup', (event) => {
        if (drag?.element === element && drag.pointerId === event.pointerId) {
          move(event.clientX - drag.x, event.clientY - drag.y);
          finish();
        }
      });
      element.addEventListener('pointercancel', cancelDrag);
      element.addEventListener('lostpointercapture', () => { if (drag?.element === element) cancelDrag(); });
      element.addEventListener('keydown', (event) => {
        if (event.key === ' ' || event.key === 'Enter') {
          event.preventDefault();
          if (event.repeat) return;
          if (!drag) begin(element, null);
          else if (drag.element === element && drag.pointerId === null) finish();
        } else if (event.key.startsWith('Arrow') && drag?.element === element && drag.pointerId === null) {
          event.preventDefault();
          const amount = event.shiftKey ? 8 : 24;
          move(drag.dx + (event.key === 'ArrowRight' ? amount : event.key === 'ArrowLeft' ? -amount : 0),
            drag.dy + (event.key === 'ArrowDown' ? amount : event.key === 'ArrowUp' ? -amount : 0));
        }
      });
      element.addEventListener('blur', () => { if (drag?.element === element && drag.pointerId === null) cancelDrag(); });
      items.append(element);
    });
    if (focus) items.firstElementChild.focus();
  }

  function start() {
    window.LevelTransition.cancel();
    window.showScreen('fruit');
    active = true;
    transitioning = false;
    level = 0;
    levelCount = getSettings().fruitLevels;
    recorded = false;
    completed = new Set();
    setupLevel();
    window.GameHelp.first('fruit');
  }

  function stop() { active = false; transitioning = false; cancelDrag(); window.LevelTransition.cancel(); }
  lessonButtons.forEach((button, index) => button.addEventListener('click', (event) => {
    if (!active || transitioning || index >= levelCount || index === level) return;
    level = index;
    setupLevel(event.detail === 0);
  }));
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') cancelDrag(); });
  window.addEventListener('blur', cancelDrag);
  window.addEventListener('resize', cancelDrag);
  document.addEventListener('visibilitychange', () => { if (document.hidden) cancelDrag(); });
  window.FruitGame = { start, stop };
})();
