(function createCarwashGame() {
  const cars = [
    { name: '小兔的草莓车', guest: 'garden-rabbit-art', kind: 'car', color: '#dc929e' },
    { name: '小狐狸的旅行巴士', guest: 'hideout-fox', kind: 'bus', color: '#83b4c8' },
    { name: '小乌龟的农场拖拉机', guest: 'hideout-turtle', kind: 'tractor', color: '#d9b45f' },
    { name: '猫头鹰的冰淇淋车', guest: 'hideout-owl', kind: 'icecream', color: '#b2a0ca' },
    { name: '小兔的消防车', guest: 'garden-rabbit-art', kind: 'firetruck', color: '#cc8772' },
  ];
  const steps = [
    { name: '刷出泡泡', symbol: 'wash-brush', prompt: '点点两块泥巴，刷出软软的泡泡。' },
    { name: '冲掉泡泡', symbol: 'wash-shower', prompt: '点点两团泡泡，冲出干净的车身。' },
    { name: '擦出星星', symbol: 'wash-cloth', prompt: '点点两片水珠，把小车擦得亮晶晶。' },
  ];
  const stage = document.querySelector('#carwash-stage');
  const vehicle = document.querySelector('#carwash-vehicle');
  const zones = document.querySelector('#carwash-zones');
  const recipe = document.querySelector('#carwash-steps');
  const tip = document.querySelector('#carwash-tip');
  const serve = document.querySelector('#carwash-serve');
  let active = false, transitioning = false, level = 0, step = 0;
  let cleaned = [0, 0];

  function carArt(car) {
    const cab = '<path d="M405 130H503L552 224H405Z" fill="#d5e9e5" stroke="#687f75" stroke-width="7"/>';
    let body;
    if (car.kind === 'car') body = '<path d="M94 242L159 235L225 125Q230 114 250 114H445Q468 114 480 133L543 232L605 248Q625 254 625 275V326H92V269Q92 250 94 242Z" fill="currentColor" stroke="#687f75" stroke-width="7"/><path d="M244 138H330V224H193Z M353 138H433L489 224H353Z" fill="#d5e9e5" stroke="#687f75" stroke-width="6"/>';
    else if (car.kind === 'tractor') body = '<path d="M118 246H325V157H498V245H588V328H118Z" fill="currentColor" stroke="#687f75" stroke-width="7"/><path d="M342 168H476V241H342Z" fill="#d5e9e5" stroke="#687f75" stroke-width="6"/><path d="M314 147H510M195 243V189" stroke="#687f75" stroke-width="14" stroke-linecap="round"/><path d="M151 272H262M151 292H262" stroke="#fff8" stroke-width="8"/>';
    else if (car.kind === 'bus') body = '<rect x="92" y="107" width="532" height="222" rx="36" fill="currentColor" stroke="#687f75" stroke-width="7"/><path d="M122 141H242V220H122Z M264 141H384V220H264Z M406 141H587V220H406Z" fill="#d5e9e5" stroke="#687f75" stroke-width="6"/><path d="M112 252H605" stroke="#fff5" stroke-width="15"/>';
    else body = '<path d="M94 124H394V156H505L568 244H620V328H94Z" fill="currentColor" stroke="#687f75" stroke-width="7"/>' + cab + (car.kind === 'firetruck'
      ? '<path d="M128 90H365M128 111H365M145 88V112M188 88V112M231 88V112M274 88V112M317 88V112M360 88V112" stroke="#a58563" stroke-width="8" stroke-linecap="round"/><rect x="464" y="126" width="35" height="26" rx="8" fill="#e2bb60"/><circle cx="234" cy="226" r="49" fill="#fff5" stroke="#f9e4b4" stroke-width="7"/><circle cx="234" cy="226" r="28" fill="none" stroke="#f9e4b4" stroke-width="7"/>'
      : '<path d="M120 187H365V231H120Z" fill="#fbead2"/><path d="M120 187H365" stroke="#dd93a4" stroke-width="16" stroke-dasharray="25 20"/><use href="#wash-cone" x="194" y="130" width="92" height="164"/>');
    const rearSize = car.kind === 'tractor' ? 70 : 50;
    return '<svg viewBox="0 70 720 340" role="img" aria-label="' + car.name + '" style="color:' + car.color + '"><ellipse cx="357" cy="389" rx="282" ry="17" fill="#729c8624"/>' + body +
      '<circle cx="186" cy="333" r="' + rearSize + '" fill="#637269" stroke="#4f6057" stroke-width="6"/><circle cx="186" cy="333" r="26" fill="#e7d6b1"/><circle cx="523" cy="333" r="50" fill="#637269" stroke="#4f6057" stroke-width="6"/><circle cx="523" cy="333" r="23" fill="#e7d6b1"/><path d="M584 275H611" stroke="#fff0b5" stroke-width="14" stroke-linecap="round"/><path d="M99 276H118" stroke="#edc19c" stroke-width="12" stroke-linecap="round"/><path d="M427 253H453" stroke="#687f75" stroke-width="7" stroke-linecap="round"/><use href="#' + car.guest + '" x="421" y="168" width="72" height="65"/></svg>';
  }

  function render() {
    stage.dataset.step = String(step);
    stage.classList.toggle('is-ready', step === 3);
    stage.classList.toggle('is-complete', transitioning);
    [...zones.children].forEach((button, index) => {
      button.dataset.clean = String(cleaned[index]);
      button.disabled = transitioning || cleaned[index] > step || step === 3;
      const part = index === 0 ? '车后面' : '车前面';
      button.setAttribute('aria-label', part + '，' + (cleaned[index] > step || step === 3 ? '这一步完成啦' : steps[step].name));
    });
    [...recipe.children].forEach((item, index) => {
      item.classList.toggle('is-current', index === step);
      item.classList.toggle('is-done', index < step);
      if (index === step) item.setAttribute('aria-current', 'step');
      else item.removeAttribute('aria-current');
    });
    document.querySelector('#carwash-tool').innerHTML = '<svg aria-hidden="true"><use href="#' + (steps[step]?.symbol || 'shape-star') + '"/></svg><span>' + (steps[step]?.name || '洗好啦！') + '</span>';
    serve.disabled = step !== 3 || transitioning;
    window.GameProgress.render(document.querySelector('#carwash-trail'), cars.length, level + (transitioning ? 1 : 0), 'wash-car');
  }

  function wash(index, keyboard) {
    if (!active || transitioning || step === 3 || cleaned[index] > step) return;
    window.GameHelp.hide();
    cleaned[index] += 1;
    window.GameAudio.play(false, [440, 659, 880][step]);
    if (cleaned.every(value => value > step)) step += 1;
    tip.textContent = steps[step]?.prompt || '亮晶晶的小车洗好啦，交还给客人吧！';
    render();
    if (keyboard) (step === 3 ? serve : zones.querySelector('button:not(:disabled)'))?.focus({ preventScroll: true });
  }

  function setup(focus = false) {
    step = 0;
    cleaned = [0, 0];
    const car = cars[level];
    document.querySelector('#carwash-level').textContent = car.name;
    document.querySelector('#carwash-guest use').setAttribute('href', '#' + car.guest);
    document.querySelector('#carwash-greeting').textContent = '帮我的小车洗个澡吧！';
    vehicle.innerHTML = carArt(car);
    tip.textContent = steps[0].prompt;
    render();
    if (focus) zones.firstElementChild.focus({ preventScroll: true });
  }

  steps.forEach(item => {
    const token = document.createElement('span');
    token.innerHTML = '<svg aria-hidden="true"><use href="#' + item.symbol + '"/></svg><b>' + item.name + '</b><i aria-hidden="true">✓</i>';
    recipe.append(token);
  });
  ['车后面', '车前面'].forEach((part, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'carwash-zone';
    button.innerHTML = '<svg aria-hidden="true" viewBox="0 0 120 110"><g class="wash-mud"><path d="M19 51Q4 29 30 26Q23 3 51 18Q71 0 81 24Q112 14 101 44Q124 64 99 76Q101 102 73 86Q52 110 42 84Q11 94 18 70Q0 62 19 51Z" fill="#a58a67" stroke="#826d53" stroke-width="3"/><path d="M35 39Q50 30 63 36M73 60L86 64M29 66L40 71" fill="none" stroke="#c7ad85" stroke-width="7" stroke-linecap="round"/></g><g class="wash-foam" fill="#f1fbfa" stroke="#88b9c3" stroke-width="3"><circle cx="30" cy="58" r="23"/><circle cx="60" cy="43" r="29"/><circle cx="88" cy="59" r="24"/><circle cx="59" cy="75" r="24"/><circle cx="92" cy="25" r="9"/><circle cx="18" cy="23" r="7"/></g><g class="wash-water" fill="#9bd4dc" stroke="#71aab5" stroke-width="2"><path d="M33 25Q4 62 33 66Q61 62 33 25Z M78 47Q48 84 78 88Q108 84 78 47Z M81 10Q64 32 81 35Q98 32 81 10Z"/></g><g class="wash-shine" fill="#ffedaa" stroke="#c5a14d" stroke-width="2"><path d="M56 12L66 45L98 55L66 65L56 97L46 65L14 55L46 45Z"/><path d="M100 8L104 20L116 24L104 28L100 40L96 28L84 24L96 20Z"/></g></svg><span class="carwash-zone-mark" aria-hidden="true">✓</span>';
    button.addEventListener('click', event => wash(index, event.detail === 0));
    zones.append(button);
  });
  serve.addEventListener('click', event => {
    if (!active || transitioning || step !== 3) return;
    window.GameHelp.hide();
    transitioning = true;
    document.querySelector('#carwash-greeting').textContent = '谢谢你，小车变漂亮啦！';
    tip.textContent = '下一位朋友马上来！';
    render();
    incrementRecord('littleComputer.carwashCars');
    window.GameAudio.play(true);
    const keyboard = event.detail === 0;
    window.LevelTransition.show({ title: '小车亮晶晶，出发啦！', note: '下一位朋友马上来', onDone: () => {
      if (!active) return;
      transitioning = false;
      level = (level + 1) % cars.length;
      setup(keyboard);
    } });
  });
  function start() {
    window.showScreen('carwash');
    active = true;
    transitioning = false;
    level = 0;
    setup();
    window.GameHelp.first('carwash');
  }
  function stop() { active = false; transitioning = false; window.LevelTransition.cancel(); }
  window.CarwashGame = { start, stop };
})();
