(function createMailGame() {
  const friends = window.GameAnimals.friends;
  const levels = [
    { name: '第一封问候', houses: ['elephant', 'panda'], letters: ['elephant'] },
    { name: '给两位朋友写信', houses: ['panda', 'polarBear'], letters: ['panda', 'polarBear'] },
    { name: '森林里的问候', houses: ['giraffe', 'elephant', 'panda'], letters: ['giraffe', 'elephant', 'panda'] },
    { name: '大家都有好消息', houses: friends.map(friend => friend.key), letters: friends.map(friend => friend.key) },
    { name: '长颈鹿收到两封信', houses: friends.map(friend => friend.key), letters: ['giraffe', 'polarBear', 'giraffe', 'elephant'] },
  ];
  const stage = document.querySelector('#mail-stage');
  const houses = document.querySelector('#mail-houses');
  const letters = document.querySelector('#mail-letters');
  const tip = document.querySelector('#mail-tip');
  let active = false, transitioning = false, level = 0, placed = 0, drag = null;
  function friend(key) { return friends.find(item => item.key === key); }
  function shuffle(items) {
    const shuffled = [...items];
    for (let index = shuffled.length - 1; index > 0; index--) {
      const choice = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[choice]] = [shuffled[choice], shuffled[index]];
    }
    return shuffled;
  }
  function portrait(key) { return '<svg aria-hidden="true" viewBox="0 0 200 160"><use href="#' + friend(key).symbol + '-head" width="200" height="160"/></svg>'; }
  function cancelDrag() {
    if (!drag) return;
    const previous = drag; drag = null;
    previous.element.style.transform = '';
    previous.element.classList.remove('is-dragging');
    previous.element.setAttribute('aria-pressed', 'false');
    if (previous.pointerId !== null && previous.element.hasPointerCapture(previous.pointerId)) previous.element.releasePointerCapture(previous.pointerId);
    houses.querySelectorAll('.is-target').forEach(house => house.classList.remove('is-target'));
  }
  function abortDrag() { if (drag) { cancelDrag(); tip.textContent = '信回到桌上啦，慢慢再送一次。'; } }
  function stillValid() {
    if (!drag) return false;
    if (drag.width !== innerWidth || drag.height !== innerHeight || drag.scrollX !== scrollX || drag.scrollY !== scrollY) { abortDrag(); return false; }
    return true;
  }
  function destination() {
    if (!drag || Math.hypot(drag.dx, drag.dy) < 16) return null;
    const rect = drag.element.getBoundingClientRect(), x = rect.left + rect.width / 2, y = rect.top + rect.height / 2;
    return [...houses.children].find(house => {
      const bounds = house.getBoundingClientRect();
      return house.dataset.friend === drag.element.dataset.friend && x >= bounds.left && x <= bounds.right && y >= bounds.top && y <= bounds.bottom;
    });
  }
  function move(dx, dy) {
    if (!stillValid()) return;
    const bounds = stage.getBoundingClientRect();
    drag.dx = Math.max(bounds.left - drag.origin.left - drag.origin.width / 2 + 3, Math.min(bounds.right - drag.origin.left - drag.origin.width / 2 - 3, dx));
    drag.dy = Math.max(bounds.top - drag.origin.top - drag.origin.height / 2 + 3, Math.min(bounds.bottom - drag.origin.top - drag.origin.height / 2 - 3, dy));
    drag.element.style.transform = 'translate(' + drag.dx + 'px, ' + drag.dy + 'px)';
    const target = destination();
    [...houses.children].forEach(house => house.classList.toggle('is-target', house === target));
    tip.textContent = target ? '头像一样啦，松开把信送进去。' : '按住信封，送到头像一样的邮箱。';
  }
  function begin(element, pointerId, x = 0, y = 0) {
    if (!active || transitioning || drag || element.disabled) return;
    window.GameHelp.hide();
    drag = { element, pointerId, x, y, dx: 0, dy: 0, origin: element.getBoundingClientRect(), width: innerWidth, height: innerHeight, scrollX, scrollY };
    element.classList.add('is-dragging'); element.setAttribute('aria-pressed', 'true');
    if (pointerId !== null) element.setPointerCapture(pointerId);
    tip.textContent = '拿起信啦，找找' + friend(element.dataset.friend).name + '的邮箱。';
  }
  function finish() {
    if (!stillValid()) return;
    const target = destination(), { element, pointerId } = drag;
    cancelDrag();
    if (!target) { tip.textContent = '信回来了，看看头像，再试一次吧。'; return; }
    element.disabled = true; element.classList.add('is-delivered');
    const received = Number(target.dataset.received || 0) + 1;
    target.dataset.received = String(received); target.classList.add('has-mail');
    target.querySelector('.mail-received').innerHTML += '<svg aria-hidden="true"><use href="#mail-envelope"/></svg>';
    target.setAttribute('aria-label', friend(element.dataset.friend).name + '的邮箱，收到 ' + received + ' 封信');
    target.querySelector('.mail-thanks').textContent = '收到啦，谢谢你！';
    placed += 1; incrementRecord('littleComputer.mailLetters');
    window.GameProgress.render(document.querySelector('#mail-trail'), levels[level].letters.length, placed, 'mail-envelope');
    const complete = placed === levels[level].letters.length;
    tip.textContent = complete ? '这一袋信都送到啦，朋友们好开心！' : '送到一封啦，还有朋友等着问候。';
    window.GameAudio.play(complete);
    if (complete) {
      transitioning = true;
      window.LevelTransition.show({ title: '小小心意送到啦！', note: '下一袋信马上来', onDone: () => {
        if (!active) return;
        transitioning = false; level = (level + 1) % levels.length; setup(pointerId === null);
      } });
    } else if (pointerId === null) letters.querySelector('button:not(:disabled)').focus({ preventScroll: true });
  }
  function setup(focus = false) {
    cancelDrag(); placed = 0;
    document.querySelector('#mail-level').textContent = levels[level].name;
    houses.replaceChildren(); letters.replaceChildren();
    shuffle(levels[level].houses).forEach(key => {
      const house = document.createElement('div'); house.className = 'mail-house'; house.dataset.friend = key;
      house.setAttribute('role', 'region'); house.setAttribute('aria-label', friend(key).name + '的邮箱');
      house.innerHTML = '<span class="mail-house-roof" aria-hidden="true"></span>' + portrait(key) + '<b>' + friend(key).name + '</b><span class="mail-slot" aria-hidden="true"></span><span class="mail-received" aria-hidden="true"></span><small class="mail-thanks"></small>';
      houses.append(house);
    });
    shuffle(levels[level].letters).forEach(key => {
      const element = document.createElement('button'); element.type = 'button'; element.className = 'mail-letter'; element.dataset.friend = key;
      element.setAttribute('aria-pressed', 'false'); element.setAttribute('aria-label', '给' + friend(key).name + '的信，空格拿起，方向键移动，空格放下');
      element.innerHTML = '<svg class="mail-paper" aria-hidden="true"><use href="#mail-envelope"/></svg>' + portrait(key) + '<span class="mail-letter-check" aria-hidden="true">✓</span>';
      element.addEventListener('pointerdown', event => {
        if (event.button !== 0 || !event.isPrimary) return;
        event.preventDefault(); element.focus({ preventScroll: true }); begin(element, event.pointerId, event.clientX, event.clientY);
      });
      element.addEventListener('pointermove', event => { if (drag?.element === element && drag.pointerId === event.pointerId) move(event.clientX - drag.x, event.clientY - drag.y); });
      element.addEventListener('pointerup', event => {
        if (drag?.element === element && drag.pointerId === event.pointerId) { move(event.clientX - drag.x, event.clientY - drag.y); finish(); }
      });
      element.addEventListener('pointercancel', abortDrag);
      element.addEventListener('lostpointercapture', () => { if (drag?.element === element) abortDrag(); });
      element.addEventListener('keydown', event => {
        if (event.key === ' ' || event.key === 'Enter') {
          event.preventDefault(); if (event.repeat) return;
          if (!drag) begin(element, null); else if (drag.element === element && drag.pointerId === null) finish();
        } else if (event.key.startsWith('Arrow') && drag?.element === element && drag.pointerId === null) {
          event.preventDefault(); const delta = event.shiftKey ? 8 : 24;
          move(drag.dx + (event.key === 'ArrowRight' ? delta : event.key === 'ArrowLeft' ? -delta : 0), drag.dy + (event.key === 'ArrowDown' ? delta : event.key === 'ArrowUp' ? -delta : 0));
        }
      });
      element.addEventListener('blur', () => { if (drag?.element === element && drag.pointerId === null) abortDrag(); });
      letters.append(element);
    });
    window.GameProgress.render(document.querySelector('#mail-trail'), levels[level].letters.length, 0, 'mail-envelope');
    tip.textContent = '看看信封和邮箱的头像，先送哪封都可以。';
    if (focus) letters.firstElementChild.focus({ preventScroll: true });
  }
  function start() { window.showScreen('mail'); active = true; transitioning = false; level = 0; setup(); window.GameHelp.first('mail'); }
  function stop() { active = false; transitioning = false; cancelDrag(); window.LevelTransition.cancel(); }
  document.addEventListener('keydown', event => { if (event.key === 'Escape') abortDrag(); });
  window.addEventListener('resize', abortDrag); window.addEventListener('scroll', abortDrag); window.addEventListener('blur', abortDrag);
  document.addEventListener('visibilitychange', () => { if (document.hidden) abortDrag(); });
  window.MailGame = { start, stop };
})();
