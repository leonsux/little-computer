(function createJuiceGame() {
  const fruits = {
    apple: { name: '苹果', symbol: 'play-apple', color: [225, 126, 123] },
    pear: { name: '梨子', symbol: 'play-pear', color: [178, 199, 108] },
    strawberry: { name: '草莓', symbol: 'wash-strawberry', color: [233, 145, 162] },
    orange: { name: '橙子', symbol: 'juice-orange', color: [241, 179, 93] },
  };
  const orders = [
    { name: '一杯小清甜', fruits: ['apple'] },
    { name: '两种水果的相遇', fruits: ['pear', 'orange'] },
    { name: '粉粉的好朋友', fruits: ['strawberry', 'apple'] },
    { name: '三种水果一起玩', fruits: ['orange', 'pear', 'strawberry'] },
    { name: '苹果多一点', fruits: ['apple', 'apple', 'pear'] },
  ];
  const stage = document.querySelector('#juice-stage');
  const bins = document.querySelector('#juice-fruits');
  const recipe = document.querySelector('#juice-recipe');
  const contents = document.querySelector('#juice-contents');
  const tip = document.querySelector('#juice-tip');
  const undo = document.querySelector('#juice-undo');
  const mix = document.querySelector('#juice-mix');
  const serve = document.querySelector('#juice-serve');
  const shelf = document.querySelector('#juice-shelf');
  let active = false, transitioning = false, blended = false, level = 0, selection = [];
  function picture(key) { return '<svg aria-hidden="true" viewBox="0 0 100 100"><use href="#' + fruits[key].symbol + '" width="100" height="100"/></svg>'; }
  function drink() {
    const color = [0, 1, 2].map(channel => Math.round(selection.reduce((sum, key) => sum + fruits[key].color[channel], 0) / selection.length));
    return '<svg class="juice-drink" viewBox="0 0 120 150" role="img" aria-label="做好的果汁"><path d="M24 35H96L87 131Q60 140 33 131Z" fill="rgb(' + color.join(',') + ')" stroke="#7b9586" stroke-width="4"/><path d="M28 51H92M42 64V110" stroke="#fff6" stroke-width="7" stroke-linecap="round"/><path d="M69 89L82 12H101" fill="none" stroke="#7ab5b3" stroke-width="7" stroke-linecap="round"/><circle cx="44" cy="81" r="5" fill="#fff8"/></svg>';
  }
  function matches() {
    const desired = orders[level].fruits;
    return selection.length === desired.length && Object.keys(fruits).every(key => selection.filter(item => item === key).length === desired.filter(item => item === key).length);
  }
  function render() {
    const remaining = [...selection];
    [...recipe.children].forEach(token => {
      const found = remaining.indexOf(token.dataset.fruit);
      token.classList.toggle('is-done', found !== -1);
      if (found !== -1) remaining.splice(found, 1);
    });
    contents.innerHTML = blended ? drink() : selection.map(key => '<span class="juice-chunk" data-fruit="' + key + '">' + picture(key) + '</span>').join('');
    contents.setAttribute('aria-label', blended ? '已打成果汁' : selection.length ? selection.map(key => fruits[key].name).join('、') : '空果汁杯');
    stage.classList.toggle('is-blended', blended);
    stage.classList.toggle('is-served', transitioning);
    [...bins.children].forEach(button => { button.disabled = transitioning || blended || selection.length === orders[level].fruits.length; });
    undo.disabled = transitioning || !selection.length;
    mix.disabled = transitioning || blended || !selection.length;
    serve.disabled = transitioning || !blended;
    window.GameProgress.render(document.querySelector('#juice-trail'), orders.length, level + Number(transitioning), 'juice-glass');
  }
  function setup(focus = false) {
    selection = []; blended = false;
    const friend = window.GameAnimals.friends[level % window.GameAnimals.friends.length];
    document.querySelector('#juice-level').textContent = orders[level].name;
    document.querySelector('#juice-guest use').setAttribute('href', '#' + friend.symbol);
    document.querySelector('#juice-greeting').textContent = friend.name + '想喝这一杯';
    recipe.innerHTML = orders[level].fruits.map(key => '<span class="juice-order-fruit" data-fruit="' + key + '" role="img" aria-label="' + fruits[key].name + '">' + picture(key) + '<i>✓</i></span>').join('');
    tip.textContent = '看水果图片，先放哪种都可以。放好后点「打成果汁」。';
    render();
    if (focus) bins.firstElementChild.focus({ preventScroll: true });
  }
  Object.entries(fruits).forEach(([key, data]) => {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'juice-fruit'; button.dataset.fruit = key;
    button.innerHTML = picture(key) + '<span>' + data.name + '</span>';
    button.addEventListener('click', event => {
      if (!active || transitioning || blended || selection.length >= orders[level].fruits.length) return;
      window.GameHelp.hide(); selection.push(key); render(); window.GameAudio.play(false);
      tip.textContent = selection.length === orders[level].fruits.length ? '水果放好啦，点「打成果汁」试试看。' : '放进去一个啦，继续看图片。';
      if (event.detail === 0 && button.disabled) mix.focus({ preventScroll: true });
    });
    bins.append(button);
  });
  undo.addEventListener('click', () => {
    if (!active || transitioning || !selection.length) return;
    window.GameHelp.hide(); selection.pop(); blended = false; render();
    tip.textContent = '拿回最后一个水果啦，换一个也可以。';
    if (undo.disabled) bins.firstElementChild.focus({ preventScroll: true });
  });
  mix.addEventListener('click', event => {
    if (!active || transitioning || blended || !selection.length) return;
    window.GameHelp.hide();
    if (!matches()) { tip.textContent = '看看朋友的水果图片，还可以拿回一个再试。'; return; }
    blended = true; render(); window.GameAudio.play(false);
    tip.textContent = '咕噜咕噜，果汁做好啦！亲手递给朋友吧。';
    if (event.detail === 0) serve.focus({ preventScroll: true });
  });
  serve.addEventListener('click', event => {
    if (!active || transitioning || !blended || !matches()) return;
    window.GameHelp.hide(); transitioning = true; incrementRecord('littleComputer.juiceOrders');
    const gift = document.createElement('span'); gift.className = 'juice-gift'; gift.innerHTML = drink(); shelf.append(gift);
    document.querySelector('#juice-greeting').textContent = '谢谢你，清清甜甜！♡';
    tip.textContent = '朋友收到了你做的果汁。'; render(); window.GameAudio.play(true);
    window.LevelTransition.show({ title: '清甜的果汁送到啦！', note: '下一位朋友马上来', onDone: () => {
      if (!active) return;
      transitioning = false; level = (level + 1) % orders.length;
      if (level === 0) shelf.replaceChildren();
      setup(event.detail === 0);
    } });
  });
  function start() { window.showScreen('juice'); active = true; transitioning = false; level = 0; shelf.replaceChildren(); setup(); window.GameHelp.first('juice'); }
  function stop() { active = false; transitioning = false; window.LevelTransition.cancel(); }
  window.JuiceGame = { start, stop };
})();
