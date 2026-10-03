(function createDrawingGame() {
  const canvas = document.querySelector('#drawing-canvas');
  const context = canvas.getContext('2d');
  const frame = document.querySelector('.canvas-frame');
  const empty = document.querySelector('#drawing-empty');
  const cursor = document.querySelector('#drawing-cursor');
  const confirm = document.querySelector('#clear-confirm');
  const status = document.querySelector('#drawing-status');
  const preview = document.querySelector('#drawing-preview');
  const undo = document.querySelector('#undo-drawing');
  const save = document.querySelector('#save-drawing');
  const key = 'littleComputer.drawingDraft';
  const background = '#fffdf7';
  const colors = [...document.querySelectorAll('[data-color]')].map((button) => button.dataset.color);
  let commands = [];
  let revision = 0;
  let recordedRevision = -1;
  let color = colors[0];
  let size = 8;
  let erasing = false;
  let stroke = null;
  let pointerId = null;
  let active = false;
  let pen = { x: 800, y: 500 };
  let confirmOrigin;
  const ideas = {
    free: { prompt: '今天，想画些什么？', art: '' },
    garden: { prompt: '给小花园添一点颜色吧', art: '<use href="#garden-flower-art" x="48" y="0" width="100" height="140"/><use href="#garden-butterfly-art" x="145" y="15" width="65" height="52"/>' },
    sea: { prompt: '大海里，会住着谁呢？', art: '<path d="M12 98q22-22 44 0t44 0t44 0t44 0t44 0M12 120q22-22 44 0t44 0t44 0t44 0t44 0" fill="none" stroke="#80b8c6" stroke-width="7" stroke-linecap="round"/><path d="M67 60Q110 8 159 60Q112 104 67 60L38 36V84Z" fill="#efc66e" stroke="#a28546" stroke-width="3"/><circle cx="139" cy="53" r="4" fill="#53645b"/>' },
    sky: { prompt: '画一片属于你的天空吧', art: '<circle cx="57" cy="48" r="27" fill="#edca64"/><path d="M57 9V1M57 95V87M18 48H9M105 48H97M27 19L20 12M88 80L95 87" stroke="#edca64" stroke-width="5" stroke-linecap="round"/><path d="M114 103Q102 86 124 78Q118 53 146 56Q163 26 184 59Q216 52 210 82Q240 102 218 111H125Z" fill="#b6d8de"/><path d="M92 31q12-17 25 0m52-10q12-17 25 0" fill="none" stroke="#6d9197" stroke-width="4" stroke-linecap="round"/>' },
  };
  let idea = 'free';
  try {
    const savedIdea = localStorage.getItem('littleComputer.drawingIdea');
    if (Object.hasOwn(ideas, savedIdea)) idea = savedIdea;
  } catch (_) { /* The reference is optional. */ }

  function selectIdea(name) {
    if (!Object.hasOwn(ideas, name)) return;
    idea = name;
    const reference = document.querySelector('#drawing-reference');
    reference.innerHTML = ideas[name].art ? '<svg viewBox="0 0 240 145" aria-hidden="true">' + ideas[name].art + '</svg><small>看看参考，画出你的想法。</small>' : '';
    reference.classList.toggle('hidden', !ideas[name].art);
    document.querySelector('#drawing-prompt').textContent = ideas[name].prompt;
    document.querySelectorAll('[data-idea]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.idea === name)));
    document.querySelector('#next-idea').setAttribute('aria-pressed', String(name !== 'free'));
    try { localStorage.setItem('littleComputer.drawingIdea', name); } catch (_) {}
  }

  function validCommand(command) {
    if (!command || typeof command !== 'object') return false;
    if (command.type === 'clear') return true;
    return command.type === 'line' && (colors.includes(command.color) || command.color === background) &&
      [8, 18, 34].includes(command.size) && Array.isArray(command.points) && command.points.length > 0 &&
      command.points.every((p) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite) &&
        p[0] >= 0 && p[0] <= 1600 && p[1] >= 0 && p[1] <= 1000);
  }

  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const draft = JSON.parse(raw);
      if (draft.version !== 1 || !Array.isArray(draft.commands) || !draft.commands.every(validCommand)) throw new Error('Invalid draft');
      commands = draft.commands;
      revision = Number.isSafeInteger(draft.revision) ? draft.revision : 0;
      recordedRevision = Number.isSafeInteger(draft.recordedRevision) ? draft.recordedRevision : -1;
    }
  } catch (_) {
    status.textContent = '这次没有读到草稿，画好后记得导出图片。';
  }

  function persist() {
    try {
      localStorage.setItem(key, JSON.stringify({ version: 1, commands, revision, recordedRevision }));
      status.textContent = '草稿已留在这台电脑，下次可以接着画。';
    } catch (_) {
      status.textContent = '这次没能保存草稿。画还在，请先查看作品并导出图片。';
    }
  }

  function hasArt() {
    let present = false;
    commands.forEach((command) => { present = command.type !== 'clear'; });
    return present;
  }

  function updateTools() {
    empty.classList.toggle('hidden', hasArt() || Boolean(stroke));
    undo.disabled = commands.length === 0;
    save.disabled = !hasArt();
  }

  function syncPalette() {
    document.querySelectorAll('[data-color]').forEach((button) => {
      const selected = !erasing && button.dataset.color === color;
      button.classList.toggle('active', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    document.querySelector('#eraser-tool').setAttribute('aria-pressed', String(erasing));
  }

  function drawLine(command) {
    context.beginPath();
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.lineWidth = command.size;
    context.strokeStyle = command.color;
    const [first, ...rest] = command.points;
    context.moveTo(first[0], first[1]);
    if (rest.length === 0) context.lineTo(first[0] + .01, first[1] + .01);
    rest.forEach((point) => context.lineTo(point[0], point[1]));
    context.stroke();
  }

  function render() {
    context.fillStyle = background;
    context.fillRect(0, 0, canvas.width, canvas.height);
    commands.forEach((command) => {
      if (command.type === 'clear') {
        context.fillStyle = background;
        context.fillRect(0, 0, canvas.width, canvas.height);
      } else drawLine(command);
    });
    if (stroke) drawLine(stroke);
    updateTools();
  }

  function positionCursor() {
    const r = canvas.getBoundingClientRect();
    const f = frame.getBoundingClientRect();
    cursor.style.left = r.left - f.left + pen.x / canvas.width * r.width + 'px';
    cursor.style.top = r.top - f.top + pen.y / canvas.height * r.height + 'px';
  }

  function fitCanvas() {
    if (!active) return;
    const width = Math.max(1, Math.min(frame.clientWidth - 28, (frame.clientHeight - 28) * 1.6));
    canvas.style.width = width + 'px';
    canvas.style.height = width / 1.6 + 'px';
    positionCursor();
  }

  function point(event) {
    const rect = canvas.getBoundingClientRect();
    return [
      Math.max(0, Math.min(1600, (event.clientX - rect.left) / rect.width * 1600)),
      Math.max(0, Math.min(1000, (event.clientY - rect.top) / rect.height * 1000)),
    ];
  }

  function begin(point, id) {
    if (!active || stroke) return;
    window.GameHelp.hide();
    pointerId = id;
    stroke = { type: 'line', color: erasing ? background : color, size, points: [point] };
    drawLine(stroke);
    empty.classList.add('hidden');
    if (id !== null) canvas.setPointerCapture(id);
  }

  function extend(point) {
    if (!stroke) return;
    const previous = stroke.points[stroke.points.length - 1];
    if (Math.hypot(point[0] - previous[0], point[1] - previous[1]) < 1.5) return;
    stroke.points.push(point);
    drawLine({ ...stroke, points: [previous, point] });
  }

  function finish(cancel = false) {
    if (!stroke) return;
    const previous = stroke;
    const previousId = pointerId;
    stroke = null;
    pointerId = null;
    if (previousId !== null && canvas.hasPointerCapture(previousId)) canvas.releasePointerCapture(previousId);
    if (!cancel) {
      commands.push(previous);
      revision += 1;
      persist();
    }
    render();
  }

  function start() {
    window.showScreen('drawing');
    active = true;
    selectIdea(idea);
    confirm.classList.add('hidden');
    render();
    fitCanvas();
    window.GameHelp.first('drawing');
  }

  function stop() {
    finish();
    active = false;
    confirm.classList.add('hidden');
  }

  function requestBlank() {
    finish();
    window.GameHelp.hide();
    confirmOrigin = document.activeElement;
    confirm.classList.remove('hidden');
    document.querySelector('#cancel-clear').focus();
  }

  function closeConfirm() {
    confirm.classList.add('hidden');
    if (confirmOrigin?.isConnected) confirmOrigin.focus();
  }

  canvas.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || !event.isPrimary || stroke) return;
    event.preventDefault();
    canvas.focus({ preventScroll: true });
    begin(point(event), event.pointerId);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (stroke && pointerId === event.pointerId) extend(point(event));
  });
  canvas.addEventListener('pointerup', (event) => {
    if (stroke && pointerId === event.pointerId) { extend(point(event)); finish(); }
  });
  canvas.addEventListener('pointercancel', () => finish(true));
  canvas.addEventListener('lostpointercapture', () => finish());
  canvas.addEventListener('blur', () => { if (pointerId === null) finish(); });
  canvas.addEventListener('keydown', (event) => {
    if (!active) return;
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      if (event.repeat) return;
      if (stroke && pointerId === null) finish();
      else if (!stroke) begin([pen.x, pen.y], null);
    } else if (event.key.startsWith('Arrow')) {
      event.preventDefault();
      const delta = event.shiftKey ? 8 : 24;
      pen.x = Math.max(0, Math.min(1600, pen.x + (event.key === 'ArrowRight' ? delta : event.key === 'ArrowLeft' ? -delta : 0)));
      pen.y = Math.max(0, Math.min(1000, pen.y + (event.key === 'ArrowDown' ? delta : event.key === 'ArrowUp' ? -delta : 0)));
      if (stroke && pointerId === null) extend([pen.x, pen.y]);
      positionCursor();
    } else if (event.key === 'Escape') finish();
  });

  document.querySelectorAll('[data-color]').forEach((button) => button.addEventListener('click', () => {
    color = button.dataset.color;
    erasing = false;
    syncPalette();
  }));
  document.querySelectorAll('[data-idea]').forEach((button) => button.addEventListener('click', () => selectIdea(button.dataset.idea)));
  document.querySelector('#next-idea').addEventListener('click', () => {
    const names = ['garden', 'sea', 'sky'];
    selectIdea(names[(names.indexOf(idea) + 1) % names.length]);
  });
  document.querySelectorAll('[data-size]').forEach((button) => button.addEventListener('click', () => {
    size = Number(button.dataset.size);
    document.querySelectorAll('[data-size]').forEach((item) => {
      item.classList.toggle('active', item === button);
      item.setAttribute('aria-pressed', String(item === button));
    });
  }));
  document.querySelector('#eraser-tool').addEventListener('click', () => {
    erasing = !erasing;
    syncPalette();
  });
  undo.addEventListener('click', () => {
    if (!commands.length) return;
    commands.pop();
    revision += 1;
    render();
    persist();
  });
  document.querySelector('#clear-drawing').addEventListener('click', requestBlank);
  document.querySelector('#cancel-clear').addEventListener('click', closeConfirm);
  document.querySelector('#confirm-clear').addEventListener('click', () => {
    commands.push({ type: 'clear' });
    revision += 1;
    closeConfirm();
    render();
    persist();
    canvas.focus();
  });
  confirm.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') { event.preventDefault(); closeConfirm(); }
    if (event.key === 'Tab') {
      event.preventDefault();
      const cancel = document.querySelector('#cancel-clear');
      const accept = document.querySelector('#confirm-clear');
      (document.activeElement === cancel ? accept : cancel).focus();
    }
  });
  save.addEventListener('click', () => {
    finish();
    if (!hasArt()) return;
    preview.src = canvas.toDataURL('image/png');
    if (recordedRevision !== revision) {
      recordedRevision = revision;
      incrementRecord('littleComputer.drawingCount');
      persist();
    }
    document.querySelector('#drawing-export-status').textContent = '想留下图片，可以点“导出图片”。';
    window.showScreen('drawing-finish');
    window.GameAudio.play(true);
  });
  document.querySelector('#export-drawing').addEventListener('click', () => {
    if (!preview.getAttribute('src')) return;
    const link = document.createElement('a');
    link.download = 'my-drawing-' + new Date().toISOString().slice(0, 10) + '.png';
    link.href = preview.src;
    link.click();
    document.querySelector('#drawing-export-status').textContent = '已发起图片下载，可以继续画。';
  });
  document.querySelector('#new-drawing').addEventListener('click', () => {
    start();
    requestBlank();
    confirmOrigin = document.querySelector('#save-drawing');
  });
  new ResizeObserver(fitCanvas).observe(frame);
  window.addEventListener('blur', () => finish());
  window.addEventListener('beforeunload', () => finish());
  document.addEventListener('visibilitychange', () => { if (document.hidden) finish(); });
  window.DrawingGame = { start, stop };
})();
