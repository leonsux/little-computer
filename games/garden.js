
(function createGardenGame() {
  const screen = document.querySelector('#garden-screen');
  const field = document.querySelector('#garden-field');
  const plants = [...document.querySelectorAll('[data-plant]')];
  const stepButtons = [...document.querySelectorAll('[data-garden-step]')];
  const can = document.querySelector('#garden-can');
  const feedback = document.querySelector('#garden-feedback');
  const next = document.querySelector('#garden-next');
  const demo = document.querySelector('#garden-demo');
  const instructions = [
    ['叫醒小种子', '动动鼠标，碰一碰三个小花盆。', '移动鼠标 → 小种子'],
    ['让蝴蝶歇一歇', '移到圈起来的嫩芽上，停稳一小会儿。', '移过去 → 停稳'],
    ['小花，开门啦', '找到圈起来的花苞，按一下鼠标左键。', '移过去 → 按一下'],
    ['给小花浇水', '按住水壶，送到圈起来的花盆，再松手。', '按住 → 移动 → 松开'],
  ];
  const scenes = ['小种子醒来啦', '蝴蝶来做客', '花苞要开花', '小花想喝水'];
  const growthArt = ['garden-seed-art', 'garden-sprout-art', 'garden-bud-art', 'garden-flower-art', 'garden-flower-art'];
  let step = 0;
  let done = instructions.map(() => new Set());
  let recorded = false;
  let active = false;
  let keyboard = false;
  let holdTimer;
  let holdIndex = -1;
  let holdOrigin;
  let drag = null;
  let transitioning = false;

  function stopHold() {
    clearTimeout(holdTimer);
    holdIndex = -1;
    holdOrigin = null;
    plants.forEach((plant) => plant.classList.remove('is-holding'));
  }

  function stopDemo() {
    demo.classList.remove('is-playing');
  }

  function targetIndex() {
    return plants.findIndex((_, index) => !done[step].has(index));
  }

  function render() {
    const complete = done[step].size === plants.length;
    const allComplete = done.every((items) => items.size === plants.length);
    plants.forEach((plant, index) => {
      const growth = step + (done[step].has(index) ? 1 : 0);
      plant.dataset.growth = String(growth);
      plant.querySelector('svg use').setAttribute('href', '#' + growthArt[growth]);
      let butterfly = plant.querySelector('.plant-butterfly');
      if (!butterfly) {
        butterfly = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        butterfly.classList.add('plant-butterfly');
        butterfly.setAttribute('aria-hidden', 'true');
        const use = document.createElementNS(butterfly.namespaceURI, 'use');
        use.setAttribute('href', '#garden-butterfly-art');
        butterfly.append(use);
        plant.append(butterfly);
      }
      butterfly.classList.toggle('hidden', step !== 1 || !done[step].has(index));
      plant.classList.toggle('is-done', done[step].has(index));
      plant.classList.toggle('is-target', step !== 0 && index === targetIndex());
      plant.querySelector('.plant-mark').textContent = done[step].has(index) ? '✓' : '';
      plant.setAttribute('aria-label', '第 ' + (index + 1) + ' 盆花' + (done[step].has(index) ? '，已完成' : ''));
      plant.tabIndex = step === 3 ? -1 : 0;
    });
    stepButtons.forEach((button, index) => {
      if (index === step) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
      button.classList.toggle('is-complete', done[index].size === plants.length);
    });
    can.classList.toggle('hidden', step !== 3 || complete);
    window.GameProgress.render(document.querySelector('#garden-trail'), plants.length, done[step].size, 'garden-flower-art');
    document.querySelector('#garden-scene-name').textContent = scenes[step];
    document.querySelector('#garden-progress').textContent = complete ? '这次练习完成啦' : '慢慢来，每一朵花都等你';
    next.classList.toggle('hidden', !complete);
    next.textContent = allComplete ? '再玩一遍 ↺' : '接着玩 →';
    if (allComplete) {
      feedback.textContent = '小花园开花啦，谢谢你！';
      if (!recorded) {
        recorded = true;
        try {
          const count = Number(localStorage.getItem('littleComputer.gardenRounds')) || 0;
          localStorage.setItem('littleComputer.gardenRounds', String(count + 1));
        } catch (_) {
          // Practice remains available when local storage is blocked.
        }
      }
    }
  }

  function succeed(index) {
    if (!active || transitioning || done[step].has(index)) return;
    stopHold();
    stopDemo();
    done[step].add(index);
    window.GameAudio.play();
    feedback.textContent = ['发芽啦！', '蝴蝶停好啦！', '小花开啦！', '喝到水啦，谢谢你！'][step];
    if (done[step].size === plants.length) feedback.textContent = '三朵小花都开心啦！';
    render();
    if (done[step].size === plants.length) {
      transitioning = true;
      const finalStep = done.every((items) => items.size === plants.length);
      window.LevelTransition.show({
        title: finalStep ? '小花园开花啦！' : '三朵小花都开心啦！',
        note: finalStep ? '马上再玩一遍' : '下一种玩法马上开始',
        onDone: () => {
          if (!active) return;
          transitioning = false;
          if (finalStep) start();
          else {
            const following = done.findIndex((items, index) => index > step && items.size < plants.length);
            selectStep(following >= 0 ? following : done.findIndex((items) => items.size < plants.length), keyboard);
          }
        },
      });
    }
  }

  function demonstrate() {
    stopDemo();
    void demo.offsetWidth;
    demo.classList.add('is-playing');
  }

  function cancelDrag() {
    const previous = drag;
    drag = null;
    if (previous && previous.pointerId !== null && can.hasPointerCapture(previous.pointerId)) {
      can.releasePointerCapture(previous.pointerId);
    }
    can.style.transform = '';
    can.classList.remove('is-dragging');
    plants.forEach((plant) => plant.classList.remove('is-over'));
  }

  function selectStep(index, focusGame = false) {
    stopHold();
    cancelDrag();
    stopDemo();
    step = index;
    field.dataset.step = String(step);
    demo.dataset.step = String(step);
    document.querySelector('#garden-instruction').textContent = instructions[step][0];
    document.querySelector('#garden-description').textContent = instructions[step][1];
    demo.querySelector('.demo-caption').textContent = instructions[step][2];
    feedback.textContent = '';
    render();
    demonstrate();
    if (focusGame) {
      const target = step === 3 ? can : plants[Math.max(0, targetIndex())];
      if (!target.classList.contains('hidden')) target.focus();
    }
  }

  function start() {
    window.LevelTransition.cancel();
    active = true;
    transitioning = false;
    done = instructions.map(() => new Set());
    recorded = false;
    window.showScreen('garden');
    selectStep(0, keyboard);
  }

  function stop() {
    active = false;
    transitioning = false;
    window.LevelTransition.cancel();
    stopHold();
    cancelDrag();
    stopDemo();
  }

  function beginHold(index, point) {
    if (!active || transitioning) return;
    if (index !== targetIndex() || done[step].has(index)) return;
    if (holdIndex === index) {
      if (!point || !holdOrigin || Math.hypot(point.x - holdOrigin.x, point.y - holdOrigin.y) < 14) return;
    }
    stopHold();
    holdIndex = index;
    holdOrigin = point;
    plants[index].classList.add('is-holding');
    holdTimer = setTimeout(() => {
      if (active && step === 1 && holdIndex === index && !document.hidden) succeed(index);
    }, 700);
  }

  plants.forEach((plant, index) => {
    plant.addEventListener('pointermove', (event) => {
      if (!active || event.pointerType === 'touch' || drag) return;
      stopDemo();
      if (step === 0) succeed(index);
      if (step === 1) beginHold(index, { x: event.clientX, y: event.clientY });
    });
    plant.addEventListener('pointerleave', () => {
      if (holdIndex === index) stopHold();
    });
    plant.addEventListener('pointerdown', (event) => {
      if (step === 1 && event.pointerType === 'touch') beginHold(index, null);
    });
    plant.addEventListener('pointerup', (event) => {
      if (event.pointerType === 'touch') stopHold();
    });
    plant.addEventListener('pointercancel', stopHold);
    plant.addEventListener('click', (event) => {
      if (!active) return;
      stopDemo();
      if (step === 2 && index === targetIndex()) succeed(index);
      else if (step === 0 && (keyboard || event.pointerType === 'touch')) succeed(index);
    });
    plant.addEventListener('focus', () => {
      if (!active || !keyboard) return;
      if (step === 0) succeed(index);
      if (step === 1) beginHold(index, null);
    });
    plant.addEventListener('blur', () => {
      if (holdIndex === index) stopHold();
    });
  });

  function dropTarget() {
    if (!drag || Math.hypot(drag.dx, drag.dy) < 16) return -1;
    const index = targetIndex();
    if (index < 0) return -1;
    const rect = plants[index].getBoundingClientRect();
    const x = drag.origin.left + drag.origin.width / 2 + drag.dx;
    const y = drag.origin.top + drag.origin.height / 2 + drag.dy;
    const tolerance = 12;
    return x >= rect.left - tolerance && x <= rect.right + tolerance &&
      y >= rect.top - tolerance && y <= rect.bottom + tolerance ? index : -1;
  }

  function moveCan(dx, dy) {
    if (!drag) return;
    const bounds = field.getBoundingClientRect();
    drag.dx = Math.max(bounds.left - drag.origin.left, Math.min(bounds.right - drag.origin.right, dx));
    drag.dy = Math.max(bounds.top - drag.origin.top, Math.min(bounds.bottom - drag.origin.bottom, dy));
    can.style.transform = 'translate(' + drag.dx + 'px, ' + drag.dy + 'px)';
    const target = dropTarget();
    plants.forEach((plant, index) => plant.classList.toggle('is-over', index === target));
    feedback.textContent = target >= 0 ? '到花盆啦，松开吧' : '按住水壶，送到圈起来的花盆';
  }

  function beginDrag(pointerId, x = 0, y = 0) {
    if (!active || step !== 3 || targetIndex() < 0 || drag) return;
    stopDemo();
    drag = { pointerId, x, y, dx: 0, dy: 0, origin: can.getBoundingClientRect() };
    can.classList.add('is-dragging');
    if (pointerId !== null) can.setPointerCapture(pointerId);
    feedback.textContent = '拿起来啦，送到圈起来的花盆';
  }

  function endDrag() {
    if (!drag) return;
    const index = dropTarget();
    const wasKeyboard = drag.pointerId === null;
    cancelDrag();
    if (index >= 0) {
      succeed(index);
      if (wasKeyboard && done[step].size === plants.length) next.focus();
    } else {
      feedback.textContent = '水壶回来了，再送一次吧';
    }
  }

  can.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || !event.isPrimary) return;
    event.preventDefault();
    can.focus({ preventScroll: true });
    beginDrag(event.pointerId, event.clientX, event.clientY);
  });
  can.addEventListener('pointermove', (event) => {
    if (drag && event.pointerId === drag.pointerId) moveCan(event.clientX - drag.x, event.clientY - drag.y);
  });
  can.addEventListener('pointerup', (event) => {
    if (drag && event.pointerId === drag.pointerId) {
      moveCan(event.clientX - drag.x, event.clientY - drag.y);
      endDrag();
    }
  });
  can.addEventListener('pointercancel', cancelDrag);
  can.addEventListener('lostpointercapture', cancelDrag);
  can.addEventListener('keydown', (event) => {
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      if (event.repeat) return;
      if (drag?.pointerId === null) endDrag();
      else if (!drag) beginDrag(null);
    } else if (event.key.startsWith('Arrow') && drag?.pointerId === null) {
      event.preventDefault();
      const delta = event.shiftKey ? 8 : 24;
      moveCan(drag.dx + (event.key === 'ArrowRight' ? delta : event.key === 'ArrowLeft' ? -delta : 0),
        drag.dy + (event.key === 'ArrowDown' ? delta : event.key === 'ArrowUp' ? -delta : 0));
    }
  });
  can.addEventListener('blur', () => {
    if (drag?.pointerId === null) cancelDrag();
  });
  document.addEventListener('keydown', (event) => {
    keyboard = true;
    if (event.key === 'Escape') {
      stopHold();
      cancelDrag();
      stopDemo();
    }
  }, true);
  document.addEventListener('pointerdown', () => { keyboard = false; }, true);
  window.addEventListener('blur', () => { stopHold(); cancelDrag(); });
  window.addEventListener('resize', () => { stopHold(); cancelDrag(); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { stopHold(); cancelDrag(); stopDemo(); }
  });
  stepButtons.forEach((button, index) => button.addEventListener('click', () => {
    if (!transitioning) selectStep(index, keyboard);
  }));
  document.querySelector('[data-game="garden"]').addEventListener('click', start);
  document.querySelector('#garden-replay').addEventListener('click', start);
  document.querySelector('#garden-demonstrate').addEventListener('click', demonstrate);
  next.addEventListener('click', () => {
    if (transitioning) return;
    if (done.every((items) => items.size === plants.length)) start();
    else {
      const remaining = instructions.findIndex((_, index) => index > step && done[index].size < plants.length);
      selectStep(remaining >= 0 ? remaining : done.findIndex((items) => items.size < plants.length), keyboard);
    }
  });
  window.GardenGame = { start, stop };
})();
