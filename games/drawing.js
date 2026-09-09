(function createDrawingGame() {
  const canvas = document.querySelector('#drawing-canvas');
  const frame = document.querySelector('.canvas-frame');
  const empty = document.querySelector('#drawing-empty');
  const clearConfirm = document.querySelector('#clear-confirm');
  const preview = document.querySelector('#drawing-preview');
  const background = '#fffdf7';
  let context;
  let drawing = false;
  let hasDrawing = false;
  let color = '#ef6f61';
  let size = 8;
  let erasing = false;

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const pixelRatio = window.devicePixelRatio || 1;
    canvas.width = Math.floor(rect.width * pixelRatio);
    canvas.height = Math.floor(rect.height * pixelRatio);
    context = canvas.getContext('2d');
    context.scale(pixelRatio, pixelRatio);
    context.fillStyle = background;
    context.fillRect(0, 0, rect.width, rect.height);
    context.lineCap = 'round';
    context.lineJoin = 'round';
  }

  function resetDrawing() {
    resizeCanvas();
    hasDrawing = false;
    empty.classList.remove('hidden');
    clearConfirm.classList.add('hidden');
    erasing = false;
    document.querySelector('#eraser-tool').classList.remove('active');
  }

  function pointFromEvent(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function beginStroke(event) {
    drawing = true;
    hasDrawing = true;
    empty.classList.add('hidden');
    canvas.setPointerCapture(event.pointerId);
    const point = pointFromEvent(event);
    context.beginPath();
    context.moveTo(point.x, point.y);
    context.strokeStyle = erasing ? background : color;
    context.lineWidth = size;
    context.lineTo(point.x + .01, point.y + .01);
    context.stroke();
  }

  function continueStroke(event) {
    if (!drawing) return;
    const point = pointFromEvent(event);
    context.lineTo(point.x, point.y);
    context.stroke();
  }

  function endStroke() {
    drawing = false;
    context.closePath();
  }

  function start() {
    resetDrawing();
    window.showScreen('drawing');
    window.requestAnimationFrame(resizeCanvas);
  }

  function selectColor(event) {
    color = event.currentTarget.dataset.color;
    erasing = false;
    document.querySelectorAll('.color-tool').forEach((button) => button.classList.toggle('active', button === event.currentTarget));
    document.querySelector('#eraser-tool').classList.remove('active');
  }

  function selectSize(event) {
    size = Number(event.currentTarget.dataset.size);
    document.querySelectorAll('.size-tool').forEach((button) => button.classList.toggle('active', button === event.currentTarget));
  }

  function toggleEraser() {
    erasing = !erasing;
    document.querySelector('#eraser-tool').classList.toggle('active', erasing);
  }

  function saveDrawing() {
    const link = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10);
    link.download = `我的画-${stamp}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    localStorage.setItem('littleComputer.drawingCount', String(Number(localStorage.getItem('littleComputer.drawingCount') || 0) + 1));
    window.setTimeout(() => {
      preview.src = link.href;
      window.showScreen('drawing-finish');
      window.playVictorySound();
      window.createFireworks('drawing-fireworks');
    }, 120);
  }

  canvas.addEventListener('pointerdown', beginStroke);
  canvas.addEventListener('pointermove', continueStroke);
  canvas.addEventListener('pointerup', endStroke);
  canvas.addEventListener('pointercancel', endStroke);
  document.querySelectorAll('.color-tool').forEach((button) => button.addEventListener('click', selectColor));
  document.querySelectorAll('.size-tool').forEach((button) => button.addEventListener('click', selectSize));
  document.querySelector('#eraser-tool').addEventListener('click', toggleEraser);
  document.querySelector('#clear-drawing').addEventListener('click', () => clearConfirm.classList.remove('hidden'));
  document.querySelector('#cancel-clear').addEventListener('click', () => clearConfirm.classList.add('hidden'));
  document.querySelector('#confirm-clear').addEventListener('click', resetDrawing);
  document.querySelector('#save-drawing').addEventListener('click', saveDrawing);
  window.DrawingGame = { start };
}());
