(function createCarwashGame() {
  const cars = [
    { name: '小兔的草莓车', guest: 'garden-rabbit-art', kind: 'car', color: '#dc929e', patches: [[260, 170, 80, 55], [465, 171, 80, 55]] },
    { name: '大象的旅行巴士', guest: 'animal-elephant', kind: 'bus', color: '#83b4c8', patches: [[180, 118, 76, 54], [355, 190, 76, 54], [525, 120, 76, 54]] },
    { name: '熊猫的农场拖拉机', guest: 'animal-panda', kind: 'tractor', color: '#d9b45f', patches: [[186, 262, 70, 58], [215, 204, 70, 50], [410, 150, 72, 55], [523, 263, 70, 54]] },
    { name: '北极熊的冰淇淋车', guest: 'animal-polarBear', kind: 'icecream', color: '#b2a0ca', patches: [[235, 149, 86, 70], [431, 208, 72, 52], [486, 130, 70, 54], [180, 267, 70, 50]] },
    { name: '长颈鹿的消防车', guest: 'animal-giraffe', kind: 'firetruck', color: '#cc8772', patches: [[235, 150, 76, 68], [126, 206, 70, 52], [430, 204, 70, 52], [488, 126, 70, 54], [523, 267, 70, 50]] },
  ];
  const steps = [
    { name: '刷掉泥巴', symbol: 'wash-brush', prompt: '用泡泡刷，按住鼠标来回刷泥巴。' },
    { name: '冲掉泡泡', symbol: 'wash-shower', prompt: '用小水枪，按住鼠标移动，把泡泡冲干净。' },
  ];
  const stage = document.querySelector('#carwash-stage');
  const vehicle = document.querySelector('#carwash-vehicle');
  const canvas = document.querySelector('#carwash-canvas');
  const context = canvas.getContext('2d');
  const viewport = document.querySelector('#carwash-view');
  const pointer = document.querySelector('#carwash-pointer');
  const tools = document.querySelector('#carwash-tools');
  const recipe = document.querySelector('#carwash-steps');
  const tip = document.querySelector('#carwash-tip');
  const serve = document.querySelector('#carwash-serve');
  let active = false, transitioning = false, level = 0, step = 0, selected = 0;
  let patches = [], stroke = null, cursor = { x: 260, y: 170 }, hint = -1;
  let soundAt = 0;

  function carArt(car) {
    const cab = '<path d="M405 130H503L552 224H405Z" fill="#d5e9e5" stroke="#687f75" stroke-width="7"/>';
    let body;
    if (car.kind === 'car') body = '<path d="M94 242L159 235L225 125Q230 114 250 114H445Q468 114 480 133L543 232L605 248Q625 254 625 275V326H92V269Q92 250 94 242Z" fill="currentColor" stroke="#687f75" stroke-width="7"/><path d="M244 138H330V224H193Z M353 138H433L489 224H353Z" fill="#d5e9e5" stroke="#687f75" stroke-width="6"/>';
    else if (car.kind === 'tractor') body = '<path d="M118 246H325V157H498V245H588V328H118Z" fill="currentColor" stroke="#687f75" stroke-width="7"/><path d="M342 168H476V241H342Z" fill="#d5e9e5" stroke="#687f75" stroke-width="6"/><path d="M314 147H510M195 243V189" stroke="#687f75" stroke-width="14" stroke-linecap="round"/><path d="M151 272H262M151 292H262" stroke="#fff8" stroke-width="8"/>';
    else if (car.kind === 'bus') body = '<rect x="92" y="107" width="532" height="222" rx="36" fill="currentColor" stroke="#687f75" stroke-width="7"/><path d="M122 141H242V220H122Z M264 141H384V220H264Z M406 141H587V220H406Z" fill="#d5e9e5" stroke="#687f75" stroke-width="6"/><path d="M112 252H605" stroke="#fff5" stroke-width="15"/>';
    else body = '<path d="M94 124H394V156H505L568 244H620V328H94Z" fill="currentColor" stroke="#687f75" stroke-width="7"/>' + cab + (car.kind === 'firetruck'
      ? '<path d="M128 90H365M128 111H365M145 88V112M188 88V112M231 88V112M274 88V112M317 88V112M360 88V112" stroke="#a58563" stroke-width="8" stroke-linecap="round"/><rect x="464" y="126" width="35" height="26" rx="8" fill="#e2bb60"/><circle cx="234" cy="226" r="49" fill="#fff5" stroke="#f9e4b4" stroke-width="7"/><circle cx="234" cy="226" r="28" fill="none" stroke="#f9e4b4" stroke-width="7"/>'
      : '<path d="M120 187H365V231H120Z" fill="#fbead2"/><path d="M120 187H365" stroke="#dd93a4" stroke-width="16" stroke-dasharray="25 20"/><use href="#wash-cone" x="194" y="130" width="92" height="164"/>');
    if (car.kind === 'car') body += '<use href="#wash-strawberry" x="217" y="244" width="86" height="76"/>';
    const rearSize = car.kind === 'tractor' ? 70 : 50;
    return '<svg viewBox="0 70 720 340" role="img" aria-label="' + car.name + '" style="color:' + car.color + '"><ellipse cx="357" cy="389" rx="282" ry="17" fill="#729c8624"/>' + body +
      '<circle cx="186" cy="333" r="' + rearSize + '" fill="#637269" stroke="#4f6057" stroke-width="6"/><circle cx="186" cy="333" r="26" fill="#e7d6b1"/><circle cx="523" cy="333" r="50" fill="#637269" stroke="#4f6057" stroke-width="6"/><circle cx="523" cy="333" r="23" fill="#e7d6b1"/><path d="M584 275H611" stroke="#fff0b5" stroke-width="14" stroke-linecap="round"/><path d="M99 276H118" stroke="#edc19c" stroke-width="12" stroke-linecap="round"/><path d="M427 253H453" stroke="#687f75" stroke-width="7" stroke-linecap="round"/><use href="#' + car.guest + '" x="421" y="168" width="72" height="65"/></svg>';
  }

  function cancelStroke() {
    const previous = stroke;
    stroke = null;
    if (previous?.id !== null && previous?.id !== undefined && canvas.hasPointerCapture(previous.id)) canvas.releasePointerCapture(previous.id);
    stage.classList.remove('is-washing');
  }

  function showPointer(point, visible = true) {
    cursor = point;
    pointer.classList.toggle('hidden', !visible || transitioning || step === 2);
    pointer.style.left = point.x / 720 * 100 + '%';
    pointer.style.top = point.y / 340 * 100 + '%';
    pointer.querySelector('use').setAttribute('href', '#' + steps[selected].symbol);
    pointer.dataset.tool = String(selected);
  }

  function render() {
    stage.dataset.step = String(step);
    stage.classList.toggle('is-ready', step === 2);
    stage.classList.toggle('is-complete', transitioning);
    context.clearRect(0, 0, 720, 340);
    patches.forEach((patch, index) => {
      context.drawImage(patch.mud, patch.left, patch.top);
      context.drawImage(patch.foam, patch.left, patch.top);
      if (patch.phase === 2) {
        context.fillStyle = '#fbe6a0';
        context.strokeStyle = '#bca15d';
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(patch.x, patch.y - 13); context.lineTo(patch.x + 4, patch.y - 4);
        context.lineTo(patch.x + 13, patch.y); context.lineTo(patch.x + 4, patch.y + 4);
        context.lineTo(patch.x, patch.y + 13); context.lineTo(patch.x - 4, patch.y + 4);
        context.lineTo(patch.x - 13, patch.y); context.lineTo(patch.x - 4, patch.y - 4);
        context.closePath(); context.fill(); context.stroke();
      }
      if (hint === index) {
        context.strokeStyle = '#355e48'; context.lineWidth = 4; context.setLineDash([10, 8]);
        context.beginPath(); context.ellipse(patch.x, patch.y, patch.rx + 6, patch.ry + 6, 0, 0, Math.PI * 2); context.stroke();
        context.setLineDash([]);
      }
    });
    // Readable state also supports assistive technology and coverage regression checks.
    canvas.dataset.coverage = JSON.stringify(patches.map(patch => ({ x: patch.x, y: patch.y, rx: patch.rx, ry: patch.ry, phase: patch.phase, brushed: patch.cells.filter(cell => cell.state >= 1).length, rinsed: patch.cells.filter(cell => cell.state === 2).length, total: patch.cells.length })));
    canvas.setAttribute('aria-label', step === 2 ? '小车洗干净啦，可以交还给客人' : '洗车区，' + steps[step].name + '，还有 ' + patches.filter(patch => patch.phase === step).length + ' 处。空格开始，方向键移动，空格停止，Escape 取消');
    [...recipe.children].forEach((item, index) => {
      item.classList.toggle('is-current', index === step);
      item.classList.toggle('is-done', index < step);
      if (index === step) item.setAttribute('aria-current', 'step'); else item.removeAttribute('aria-current');
    });
    [...tools.children].forEach((button, index) => {
      button.setAttribute('aria-pressed', String(selected === index));
      button.classList.toggle('is-recommended', level === 0 && step === index);
      button.disabled = transitioning || step === 2;
    });
    serve.disabled = transitioning;
    window.GameProgress.render(document.querySelector('#carwash-trail'), cars.length, level + (transitioning ? 1 : 0), 'wash-car');
  }

  function regionClip(ctx, patch) {
    ctx.clip(patch.clip);
    ctx.beginPath(); ctx.ellipse(patch.rx, patch.ry, patch.rx, patch.ry, 0, 0, Math.PI * 2); ctx.clip();
  }

  function fillFoam(patch) {
    const ctx = patch.foam.getContext('2d');
    ctx.save(); regionClip(ctx, patch);
    ctx.fillStyle = '#e5f5f1'; ctx.fillRect(0, 0, patch.foam.width, patch.foam.height);
    ctx.strokeStyle = '#a9cfce'; ctx.fillStyle = '#f6fffa'; ctx.lineWidth = 2;
    for (let y = 9; y < patch.foam.height; y += 23) {
      for (let x = 10 + (Math.floor(y / 23) % 2) * 10; x < patch.foam.width; x += 25) {
        ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
    }
    ctx.restore();
  }

  function strokeLayer(layer, patch, from, to, erase) {
    const ctx = layer.getContext('2d');
    ctx.save(); regionClip(ctx, patch);
    ctx.globalCompositeOperation = erase ? 'destination-out' : 'source-over';
    ctx.lineWidth = 56; ctx.lineCap = 'round'; ctx.strokeStyle = '#eaf8f5';
    ctx.beginPath(); ctx.moveTo(from.x - patch.left, from.y - patch.top); ctx.lineTo(to.x - patch.left, to.y - patch.top); ctx.stroke();
    if (!erase) {
      ctx.globalCompositeOperation = 'source-atop'; ctx.strokeStyle = '#b5d6d3'; ctx.fillStyle = '#fafffc'; ctx.lineWidth = 2;
      for (const offset of [-12, 10]) {
        ctx.beginPath(); ctx.arc(to.x - patch.left + offset, to.y - patch.top + offset / 2, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
    }
    ctx.restore();
  }

  function distanceToStroke(cell, from, to) {
    const dx = to.x - from.x, dy = to.y - from.y;
    const t = Math.max(0, Math.min(1, ((cell.x - from.x) * dx + (cell.y - from.y) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(cell.x - from.x - t * dx, cell.y - from.y - t * dy);
  }

  function wash(from, to) {
    if (!active || transitioning || step === 2 || Math.hypot(to.x - from.x, to.y - from.y) < 3) return;
    if (selected !== step) {
      tip.textContent = step === 0 ? '厚泥巴要先用泡泡刷，试试粉粉的小刷子。' : '泡泡刷好啦，换小水枪冲一冲吧！';
      return;
    }
    const workingStep = step;
    let changed = false;
    patches.forEach((patch, index) => {
      if (patch.phase !== workingStep) return;
      const visited = patch.cells.filter(cell => cell.state === workingStep && distanceToStroke(cell, from, to) <= 28);
      if (!visited.length) return;
      visited.forEach(cell => { cell.state += 1; });
      changed = true;
      if (hint === index) hint = -1;
      if (workingStep === 0) { strokeLayer(patch.mud, patch, from, to, true); strokeLayer(patch.foam, patch, from, to, false); }
      else strokeLayer(patch.foam, patch, from, to, true);
      const completed = patch.cells.filter(cell => cell.state > workingStep).length;
      if (completed / patch.cells.length >= .85) {
        patch.phase += 1;
        patch.cells.forEach(cell => { cell.state = patch.phase; });
        patch.mud.getContext('2d').clearRect(0, 0, patch.mud.width, patch.mud.height);
        if (workingStep === 0) fillFoam(patch);
        else patch.foam.getContext('2d').clearRect(0, 0, patch.foam.width, patch.foam.height);
      }
    });
    if (!changed) return;
    tip.textContent = steps[step].prompt;
    if (patches.every(patch => patch.phase > step)) {
      step += 1;
      cancelStroke(); // A new stage always requires a new press, even during the first guided car.
      if (level === 0 && step === 1) selected = 1;
      document.querySelector('#carwash-greeting').textContent = step === 2 ? '哇，漂亮的小车露出来啦！' : '泡泡好多呀，冲一冲吧！';
      tip.textContent = step === 2 ? '干净的小车露出来啦，交还给客人吧！' : '泥巴都刷好了，换小水枪，把泡泡冲掉。';
      if (step === 2 && document.activeElement === canvas) serve.focus({ preventScroll: true });
    }
    if (performance.now() - soundAt > 240) { window.GameAudio.play(step === 2, workingStep === 0 ? 440 : 659); soundAt = performance.now(); }
    render(); showPointer(to);
  }

  function setup(focus = false) {
    cancelStroke();
    step = 0; selected = 0; hint = -1; soundAt = 0;
    const car = cars[level];
    document.querySelector('#carwash-level').textContent = car.name;
    document.querySelector('#carwash-guest use').setAttribute('href', '#' + car.guest);
    document.querySelector('#carwash-greeting').textContent = car.kind === 'icecream' ? '我的冰淇淋图案藏在哪里？' : car.kind === 'tractor' ? '轮胎也沾满泥巴啦！' : '帮我的小车洗个澡吧！';
    vehicle.innerHTML = carArt(car);
    const body = vehicle.querySelector('[fill="currentColor"]');
    const outline = new Path2D();
    if (body.tagName === 'path') outline.addPath(new Path2D(body.getAttribute('d')));
    else outline.roundRect(92, 107, 532, 222, 36);
    outline.moveTo(186 + (car.kind === 'tractor' ? 70 : 50), 333); outline.arc(186, 333, car.kind === 'tractor' ? 70 : 50, 0, Math.PI * 2); outline.closePath();
    outline.moveTo(573, 333); outline.arc(523, 333, 50, 0, Math.PI * 2); outline.closePath();
    patches = car.patches.map(([x, y, rx, ry]) => {
      // Jitter stays inside generous preset regions; only points on the real car can count.
      x += Math.floor(Math.random() * 33) - 16; y += Math.floor(Math.random() * 25) - 12;
      const patch = { x, y, rx, ry, left: x - rx, top: y - ry, phase: 0, cells: [], mud: document.createElement('canvas'), foam: document.createElement('canvas'), clip: new Path2D() };
      patch.clip.addPath(outline, new DOMMatrix().translate(-patch.left, -patch.top - 70));
      for (const layer of [patch.mud, patch.foam]) { layer.width = rx * 2; layer.height = ry * 2; }
      for (let cy = y - ry + 5; cy < y + ry; cy += 10) {
        for (let cx = x - rx + 5; cx < x + rx; cx += 10) {
          if (((cx - x) / rx) ** 2 + ((cy - y) / ry) ** 2 <= 1 && context.isPointInPath(outline, cx, cy + 70)) patch.cells.push({ x: cx, y: cy, state: 0 });
        }
      }
      const ctx = patch.mud.getContext('2d');
      ctx.save(); regionClip(ctx, patch); ctx.fillStyle = '#a58a67'; ctx.fillRect(0, 0, rx * 2, ry * 2);
      for (let i = 0; i < 14; i += 1) {
        ctx.fillStyle = i % 2 ? '#b59a74' : '#90795c';
        ctx.beginPath(); ctx.ellipse((i * 47 + 21) % (rx * 2), (i * 31 + 19) % (ry * 2), 12 + i % 9, 6 + i % 5, .4, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore(); return patch;
    });
    cursor = { x: patches[0].x, y: patches[0].y };
    viewport.scrollLeft = 0;
    tip.textContent = steps[0].prompt;
    render(); showPointer(cursor, false);
    if (focus) { canvas.focus({ preventScroll: true }); revealCursor(); }
  }

  function eventPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left) / rect.width * 720, y: (event.clientY - rect.top) / rect.height * 340 };
  }
  function inside(point) { return point.x >= 0 && point.x <= 720 && point.y >= 0 && point.y <= 340; }
  function revealCursor() {
    const scene = canvas.getBoundingClientRect(), frame = viewport.getBoundingClientRect();
    const x = cursor.x / 720 * scene.width + scene.left;
    if (x < frame.left + 32) viewport.scrollLeft -= frame.left + 32 - x;
    else if (x > frame.right - 32) viewport.scrollLeft += x - frame.right + 32;
    showPointer(cursor);
  }
  canvas.addEventListener('pointerdown', event => {
    if (!active || transitioning || step === 2 || event.button !== 0 || !event.isPrimary) return;
    event.preventDefault(); cancelStroke(); window.GameHelp.hide(); canvas.focus({ preventScroll: true });
    const point = eventPoint(event);
    stroke = { id: event.pointerId, mode: 'pointer', last: point, width: innerWidth, height: innerHeight };
    canvas.setPointerCapture(event.pointerId); stage.classList.add('is-washing'); showPointer(point);
  });
  canvas.addEventListener('pointermove', event => {
    if (!active || transitioning) return;
    const point = eventPoint(event);
    if (stroke?.mode === 'pointer' && stroke.id === event.pointerId) {
      if (stroke.width !== innerWidth || stroke.height !== innerHeight || !(event.buttons & 1) || !canvas.hasPointerCapture(stroke.id)) { cancelStroke(); return; }
      if (!inside(point)) { stroke.last = null; showPointer(cursor, false); return; }
      const from = stroke.last;
      if (!from || Math.hypot(point.x - from.x, point.y - from.y) >= 3) {
        stroke.last = point;
        if (from) wash(from, point);
      }
    }
    if (inside(point)) showPointer(point);
  });
  canvas.addEventListener('pointerup', event => { if (stroke?.id === event.pointerId) cancelStroke(); });
  canvas.addEventListener('pointercancel', cancelStroke);
  canvas.addEventListener('lostpointercapture', () => { if (stroke?.mode === 'pointer') cancelStroke(); });
  canvas.addEventListener('pointerleave', () => { if (!stroke) showPointer(cursor, false); });
  canvas.addEventListener('focus', () => { if (active) revealCursor(); });
  canvas.addEventListener('blur', () => { cancelStroke(); showPointer(cursor, false); });
  canvas.addEventListener('keydown', event => {
    if (!active || transitioning || step === 2) return;
    if (event.key === 'Escape') { cancelStroke(); return; }
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault(); if (event.repeat) return;
      window.GameHelp.hide();
      if (stroke) cancelStroke(); else { stroke = { mode: 'keyboard', id: null }; stage.classList.add('is-washing'); }
      return;
    }
    const directions = { ArrowLeft: [-20, 0], ArrowRight: [20, 0], ArrowUp: [0, -20], ArrowDown: [0, 20] };
    if (!directions[event.key]) return;
    event.preventDefault();
    const delta = directions[event.key], from = cursor;
    const to = { x: Math.max(0, Math.min(720, from.x + delta[0])), y: Math.max(0, Math.min(340, from.y + delta[1])) };
    if (stroke?.mode === 'keyboard') wash(from, to);
    showPointer(to); revealCursor();
  });
  window.addEventListener('blur', cancelStroke);
  window.addEventListener('resize', cancelStroke);
  document.addEventListener('scroll', event => { if (event.target !== viewport || stroke?.mode !== 'keyboard') cancelStroke(); }, true);

  steps.forEach((item, index) => {
    const token = document.createElement('span');
    token.innerHTML = '<svg aria-hidden="true"><use href="#' + item.symbol + '"/></svg><b>' + item.name + '</b><i aria-hidden="true">✓</i>';
    recipe.append(token);
    const button = document.createElement('button'); button.type = 'button'; button.dataset.tool = String(index);
    button.className = 'carwash-tool';
    button.innerHTML = '<svg aria-hidden="true"><use href="#' + item.symbol + '"/></svg><span>' + (index === 0 ? '泡泡刷' : '小水枪') + '</span>';
    button.addEventListener('click', () => {
      if (!active || transitioning || step === 2) return;
      cancelStroke(); window.GameHelp.hide(); selected = index;
      tip.textContent = selected === step ? steps[step].prompt : step === 0 ? '厚泥巴要先刷一刷，试试泡泡刷。' : '泡泡要用小水枪冲掉哦。';
      render(); showPointer(cursor, false);
    }); tools.append(button);
  });
  serve.addEventListener('click', event => {
    if (!active || transitioning) return;
    window.GameHelp.hide(); cancelStroke();
    if (step !== 2) {
      hint = patches.findIndex(patch => patch.phase === step);
      document.querySelector('#carwash-greeting').textContent = step === 0 ? '这里还有泥巴，我们接着洗吧！' : '这里还有泡泡，冲一冲就好啦！';
      cursor = { x: patches[hint].x, y: patches[hint].y };
      tip.textContent = steps[step].prompt; render(); revealCursor();
      if (event.detail === 0) canvas.focus({ preventScroll: true });
      return;
    }
    transitioning = true; showPointer(cursor, false);
    document.querySelector('#carwash-greeting').textContent = '谢谢你，小车变漂亮啦！';
    tip.textContent = '挥挥手，下一位朋友马上来！'; render();
    incrementRecord('littleComputer.carwashCars'); window.GameAudio.play(true);
    window.LevelTransition.show({ title: '小车洗干净，出发啦！', note: '下一位朋友马上来', onDone: () => {
      if (!active) return;
      transitioning = false; level = (level + 1) % cars.length; setup(event.detail === 0);
    } });
  });
  function start() {
    window.showScreen('carwash'); active = true; transitioning = false; level = 0; setup(); window.GameHelp.first('carwash');
  }
  function stop() { active = false; transitioning = false; cancelStroke(); showPointer(cursor, false); window.LevelTransition.cancel(); }
  window.CarwashGame = { start, stop };
})();
