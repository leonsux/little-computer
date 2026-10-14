(function createBeadsGame() {
  const beads = {
    circle: { name: '圆珠', pitch: 523 },
    star: { name: '星星', pitch: 659 },
    flower: { name: '小花', pitch: 784 },
    leaf: { name: '叶子', pitch: 587 },
  };
  const patterns = [
    { name: '圆珠和星星做朋友', beads: ['circle', 'star'] },
    { name: '小花和叶子排排坐', beads: ['flower', 'leaf'] },
    { name: '两颗圆珠一朵花', beads: ['circle', 'circle', 'flower'] },
    { name: '花园里的三位朋友', beads: ['leaf', 'star', 'flower'] },
    { name: '星星带着两片叶子', beads: ['star', 'leaf', 'leaf'] },
  ];
  const stage = document.querySelector('#beads-stage');
  const sequence = document.querySelector('#beads-sequence');
  const choices = document.querySelector('#beads-choices');
  const preview = document.querySelector('#beads-preview');
  const garden = document.querySelector('#beads-garden');
  const hint = document.querySelector('#beads-hint');
  const hang = document.querySelector('#beads-hang');
  const tip = document.querySelector('#beads-tip');
  let active = false, transitioning = false, level = 0, filled = 0, hintTimer;

  function picture(key) {
    return '<svg aria-hidden="true" viewBox="0 0 100 100"><use href="#beads-' + key + '" width="100" height="100"/></svg>';
  }

  function wreath(complete = false) {
    const pattern = patterns[level].beads;
    const total = pattern.length * 3;
    const count = complete ? total : pattern.length * 2 + filled;
    let decorations = '';
    for (let index = 0; index < total; index++) {
      const angle = (index / total * Math.PI * 2) - Math.PI / 2;
      const x = 150 + Math.cos(angle) * 88;
      const y = 145 + Math.sin(angle) * 88;
      decorations += index < count
        ? '<use href="#beads-' + pattern[index % pattern.length] + '" x="' + (x - 26) + '" y="' + (y - 26) + '" width="52" height="52"/>'
        : '<circle cx="' + x + '" cy="' + y + '" r="19" fill="#fffdf5" stroke="#adbca3" stroke-width="2" stroke-dasharray="4 4"/>';
    }
    return '<svg class="beads-wreath-art" viewBox="0 0 300 280" role="img" aria-label="' + (complete || count === total ? '做好的花环' : '正在制作的花环') + '"><path d="M139 37L150 13L161 37" fill="none" stroke="#a9876d" stroke-width="4" stroke-linecap="round"/><circle cx="150" cy="145" r="88" fill="none" stroke="#acc598" stroke-width="12"/><circle cx="150" cy="145" r="88" fill="none" stroke="#dce4b6" stroke-width="3"/>' + decorations + '<g transform="translate(0 -100)"><path d="M149 246Q105 208 109 239Q117 259 149 246M151 246Q195 208 191 239Q183 259 151 246M147 246L129 271L151 263L172 271L154 246" fill="#e7a9a0" stroke="#bb7b77" stroke-width="2" stroke-linejoin="round"/><ellipse cx="150" cy="246" rx="8" ry="7" fill="#f5c5b8"/></g></svg>';
  }

  function clearHint() {
    window.GameClock.clearTimeout(hintTimer);
    sequence.querySelectorAll('.is-hint').forEach(slot => slot.classList.remove('is-hint'));
  }

  function render() {
    const pattern = patterns[level].beads;
    sequence.innerHTML = [0, 1, 2].map(repeat => '<div class="beads-group" data-repeat="' + repeat + '" role="group" aria-label="' + (repeat < 2 ? '第 ' + (repeat + 1) + ' 组样例' : '接着补这一组') + '">' + pattern.map((key, position) => {
      const known = repeat < 2 || position < filled;
      const current = repeat === 2 && position === filled;
      return '<span class="beads-slot' + (repeat === 2 && known ? ' is-filled' : '') + (current ? ' is-current' : '') + '" data-position="' + position + '"' + (known ? ' data-bead="' + key + '"' : '') + ' role="img" aria-label="' + (known ? beads[key].name : current ? '下一个空位' : '待补的空位') + '">' + (known ? picture(key) : '<b aria-hidden="true">' + (current ? '？' : '·') + '</b>') + '</span>';
    }).join('') + '</div>').join('');
    preview.innerHTML = wreath();
    const ready = filled === pattern.length;
    stage.classList.toggle('is-ready', ready);
    stage.classList.toggle('is-hung', transitioning);
    choices.querySelectorAll('button').forEach(button => { button.disabled = transitioning || ready; });
    hint.disabled = transitioning || ready;
    hang.disabled = transitioning || !ready;
    window.GameProgress.render(document.querySelector('#beads-trail'), patterns.length, level + Number(transitioning), 'beads-wreath');
  }

  function setup(focus = false) {
    clearHint();
    filled = 0;
    stage.dataset.level = level;
    const friend = window.GameAnimals.friends[level % window.GameAnimals.friends.length];
    document.querySelector('#beads-level').textContent = patterns[level].name;
    document.querySelector('#beads-friend use').setAttribute('href', '#' + friend.symbol);
    document.querySelector('#beads-greeting').textContent = friend.name + '等着你的花环';
    tip.textContent = '看看前两组，下一颗选谁呢？';
    render();
    if (focus) choices.firstElementChild.focus({ preventScroll: true });
  }

  Object.entries(beads).forEach(([key, data]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'beads-choice';
    button.dataset.bead = key;
    button.innerHTML = picture(key) + '<span>' + data.name + '</span>';
    button.addEventListener('click', event => {
      const pattern = patterns[level].beads;
      if (!active || transitioning || filled >= pattern.length) return;
      window.GameHelp.hide();
      clearHint();
      if (key !== pattern[filled]) {
        tip.textContent = '再看看前面，找到一样的位置，慢慢来。';
        return;
      }
      filled++;
      render();
      window.GameAudio.play(false, data.pitch);
      tip.textContent = filled === pattern.length ? '花环做好啦，亲手把它挂起来吧！' : '这颗排好啦，接着选下一颗。';
      if (event.detail === 0 && filled === pattern.length) hang.focus({ preventScroll: true });
    });
    choices.append(button);
  });

  hint.addEventListener('click', () => {
    if (!active || transitioning || filled === patterns[level].beads.length) return;
    window.GameHelp.hide();
    clearHint();
    sequence.querySelectorAll('.beads-group:not([data-repeat="2"]) .beads-slot[data-position="' + filled + '"]').forEach(slot => slot.classList.add('is-hint'));
    tip.textContent = '亮起来的两颗在同一个位置，下一颗也这样排。';
    hintTimer = window.GameClock.setTimeout(clearHint, 1800);
  });

  hang.addEventListener('click', event => {
    if (!active || transitioning || filled !== patterns[level].beads.length) return;
    window.GameHelp.hide();
    clearHint();
    transitioning = true;
    if (garden.children.length === patterns.length) garden.replaceChildren();
    const gift = document.createElement('span');
    gift.className = 'beads-gift';
    gift.innerHTML = wreath(true);
    garden.append(gift);
    garden.setAttribute('aria-label', '作品花园，挂好了 ' + garden.children.length + ' 个花环');
    incrementRecord('littleComputer.beadWreaths');
    document.querySelector('#beads-greeting').textContent = '谢谢你，花园更漂亮啦！';
    tip.textContent = level === patterns.length - 1 ? '五个花环排排挂，花园开派对啦！' : '挂好啦！你的花环留在花园里。';
    render();
    window.GameAudio.play(true);
    window.LevelTransition.show({ title: '花环挂好啦！', note: level === patterns.length - 1 ? '作品留下，再做一组新花环' : '下一位朋友在等你', onDone: () => {
      if (!active) return;
      transitioning = false;
      level = (level + 1) % patterns.length;
      setup(event.detail === 0);
    } });
  });

  function start() {
    window.showScreen('beads');
    active = true;
    transitioning = false;
    level = 0;
    garden.replaceChildren();
    garden.setAttribute('aria-label', '作品花园');
    setup();
    window.GameHelp.first('beads');
  }

  function stop() {
    active = false;
    transitioning = false;
    clearHint();
    window.LevelTransition.cancel();
  }

  window.BeadsGame = { start, stop };
})();
