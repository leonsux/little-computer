(function createCakeGame() {
  const ingredients = {
    vanilla: { name: '香草蛋糕', group: 'base', color: '#e5be77' },
    chocolate: { name: '巧克力蛋糕', group: 'base', color: '#ab7962' },
    cream: { name: '白奶油', group: 'cream', color: '#fff6db' },
    pink: { name: '草莓奶油', group: 'cream', color: '#efb4c3' },
    strawberry: { name: '草莓', group: 'fruit', color: '#dd8085' },
    blueberry: { name: '蓝莓', group: 'fruit', color: '#899bc3' },
    candle: { name: '生日蜡烛', group: 'candle', color: '#92b8be' },
  };
  const prompts = { base: '选一层蛋糕', cream: '抹上软软的奶油', fruit: '摆上水果', candle: '插上生日蜡烛' };
  const guests = [
    { name: '小兔', symbol: 'garden-rabbit-art' },
    { name: '小狐狸', symbol: 'hideout-fox' },
    { name: '猫头鹰', symbol: 'hideout-owl' },
    { name: '小乌龟', symbol: 'hideout-turtle' },
  ];
  const rounds = [
    { name: '蛋糕店开张啦', orders: [['vanilla', 'cream', 'strawberry'], ['chocolate', 'cream', 'blueberry']] },
    { name: '粉粉的奶油', orders: [['vanilla', 'pink', 'blueberry'], ['chocolate', 'pink', 'strawberry']] },
    { name: '朋友来野餐', orders: [['chocolate', 'cream', 'strawberry'], ['vanilla', 'pink', 'strawberry']] },
    { name: '双层小惊喜', orders: [['vanilla', 'pink', 'chocolate', 'cream', 'strawberry'], ['chocolate', 'cream', 'vanilla', 'pink', 'blueberry']] },
    { name: '生日快乐呀', orders: [['vanilla', 'cream', 'vanilla', 'pink', 'strawberry', 'candle'], ['chocolate', 'pink', 'vanilla', 'cream', 'blueberry', 'candle'], ['vanilla', 'cream', 'chocolate', 'pink', 'strawberry', 'candle']] },
  ];
  const stage = document.querySelector('#cake-stage');
  const pantry = document.querySelector('#cake-pantry');
  const recipe = document.querySelector('#cake-recipe');
  const made = document.querySelector('#cake-made');
  const tip = document.querySelector('#cake-tip');
  const undo = document.querySelector('#cake-undo');
  const serve = document.querySelector('#cake-serve');
  const served = document.querySelector('#cake-served');
  let active = false, transitioning = false, round = 0, customer = 0, layers = [];

  function order() { return rounds[round].orders[customer]; }
  function nextGroup() { return ingredients[order()[layers.length]]?.group; }
  function artwork(key) {
    const { group, color } = ingredients[key];
    let drawing;
    if (group === 'base') drawing = '<rect x="8" y="8" width="184" height="46" rx="12" fill="' + color + '" stroke="#8d6955" stroke-width="3"/><path d="M18 21H180M26 38H35M54 38H63M82 38H91M110 38H119M138 38H147M166 38H175" stroke="#fff6" stroke-width="4" stroke-linecap="round"/>';
    if (group === 'cream') drawing = '<path d="M8 15Q8 6 20 6H180Q192 6 192 15V23Q183 38 174 25Q164 11 153 26Q143 39 132 25Q122 11 110 25Q99 39 88 25Q77 11 65 25Q54 39 43 25Q32 11 21 26Q8 39 8 23Z" fill="' + color + '" stroke="#b78c77" stroke-width="3"/><path d="M22 13H174" stroke="#fff9" stroke-width="4" stroke-linecap="round"/>';
    if (key === 'strawberry') drawing = [38, 100, 162].map(x => '<g transform="translate(' + (x - 22) + ' 4)"><path d="M4 16Q0 2 22 8Q44 2 40 16Q34 43 22 46Q10 43 4 16Z" fill="' + color + '" stroke="#a45d61" stroke-width="2"/><path d="M11 9L22 1L32 9L22 14Z" fill="#7eab78"/><path d="M13 23H14M28 24H29M21 34H22" stroke="#ffe5a7" stroke-width="3" stroke-linecap="round"/></g>').join('');
    if (key === 'blueberry') drawing = [38, 100, 162].map(x => '<g><circle cx="' + x + '" cy="29" r="21" fill="' + color + '" stroke="#6475a0" stroke-width="2"/><path d="M' + (x - 9) + ' 18L' + x + ' 22L' + (x + 9) + ' 18L' + x + ' 13Z" fill="#d2dbee"/><circle cx="' + (x - 7) + '" cy="30" r="4" fill="#fff4"/></g>').join('');
    if (group === 'candle') drawing = '<rect x="89" y="21" width="22" height="36" rx="4" fill="' + color + '" stroke="#648c94" stroke-width="2"/><path d="M90 27L110 37M90 41L110 51" stroke="#fff6" stroke-width="5"/><path d="M100 3Q78 23 100 21Q117 20 100 3Z" fill="#e6b85c" stroke="#c39348" stroke-width="2"/>';
    return '<svg viewBox="0 0 200 60" aria-hidden="true">' + drawing + '</svg>';
  }
  function piece(key) {
    const node = document.createElement('span');
    node.className = 'cake-piece cake-' + ingredients[key].group;
    node.dataset.ingredient = key;
    node.innerHTML = artwork(key);
    return node;
  }
  function confection(container, selection) {
    const stack = document.createElement('div');
    stack.className = 'cake-stack';
    selection.forEach(key => stack.append(piece(key)));
    const plate = document.createElement('span');
    plate.className = 'cake-plate';
    plate.setAttribute('aria-hidden', 'true');
    container.replaceChildren(stack, plate);
    container.setAttribute('aria-label', selection.length ? '从下到上：' + selection.map(key => ingredients[key].name).join('、') : '空盘子，等你来做蛋糕');
  }
  function focusIngredient() { pantry.querySelector('button:not(:disabled)')?.focus({ preventScroll: true }); }
  function render() {
    confection(made, layers);
    let prefix = 0;
    while (prefix < layers.length && layers[prefix] === order()[prefix]) prefix += 1;
    [...recipe.children].forEach((step, i) => {
      step.classList.toggle('is-done', i < prefix);
      step.classList.toggle('is-next', i === prefix && !transitioning);
      step.setAttribute('aria-current', i === prefix && !transitioning ? 'step' : 'false');
    });
    made.querySelectorAll('.cake-piece').forEach((node, i) => node.classList.toggle('is-different', i >= prefix && !transitioning));
    pantry.querySelectorAll('button').forEach(button => {
      button.disabled = transitioning || ingredients[button.dataset.ingredient].group !== nextGroup();
    });
    document.querySelector('#cake-step').textContent = transitioning ? '心意送到啦！' : (prompts[nextGroup()] || '做好啦，递给朋友吧');
    undo.disabled = transitioning || !layers.length;
    serve.disabled = transitioning || !layers.length;
    stage.classList.toggle('is-served', transitioning);
    window.GameProgress.render(document.querySelector('#cake-trail'), rounds[round].orders.length, customer + Number(transitioning), 'garden-rabbit-art');
  }
  function setup(focus = false) {
    layers = [];
    const guest = guests[(round + customer) % guests.length];
    document.querySelector('#cake-level').textContent = rounds[round].name;
    document.querySelector('#cake-guest use').setAttribute('href', '#' + guest.symbol);
    document.querySelector('#cake-greeting').textContent = guest.name + (round === 4 ? '过生日啦！' : '来做客啦！');
    stage.classList.toggle('is-birthday', round === 4);
    confection(document.querySelector('#cake-order'), order());
    recipe.replaceChildren();
    order().forEach((key, i) => {
      const step = document.createElement('span');
      step.className = 'cake-recipe-step';
      step.dataset.ingredient = key;
      step.setAttribute('aria-label', '第 ' + (i + 1) + ' 步，' + ingredients[key].name);
      step.append(piece(key));
      const number = document.createElement('b');
      number.textContent = String(i + 1);
      step.append(number);
      recipe.append(step);
    });
    pantry.replaceChildren();
    Object.entries(ingredients).forEach(([key, data]) => {
      if (key === 'candle' && round < 4) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'cake-ingredient';
      button.dataset.ingredient = key;
      button.setAttribute('aria-label', '加入' + data.name);
      button.innerHTML = artwork(key);
      const label = document.createElement('span');
      label.textContent = data.name;
      button.append(label);
      button.addEventListener('click', event => {
        if (!active || transitioning || data.group !== nextGroup()) return;
        window.GameHelp.hide();
        layers.push(key);
        window.GameAudio.play(false, 440 + layers.length * 80);
        tip.textContent = nextGroup() ? '加好啦，再看下一步的小图片。' : '蛋糕做好啦！看看和客人的一样吗？';
        render();
        if (event.detail === 0) {
          if (nextGroup()) focusIngredient();
          else serve.focus({ preventScroll: true });
        }
      });
      pantry.append(button);
    });
    tip.textContent = '看小图片，从左往右做。点错了可以拿回一步。';
    render();
    if (focus) focusIngredient();
  }
  undo.addEventListener('click', event => {
    if (!active || transitioning || !layers.length) return;
    window.GameHelp.hide();
    layers.pop();
    tip.textContent = '拿回来啦，换一种再试试看。';
    render();
    if (undo.disabled || event.detail === 0) focusIngredient();
  });
  serve.addEventListener('click', event => {
    if (!active || transitioning || !layers.length) return;
    window.GameHelp.hide();
    if (layers.length !== order().length || layers.some((key, i) => key !== order()[i])) {
      tip.textContent = '朋友想要图片里的蛋糕，可以拿回一步，换一换。';
      return;
    }
    transitioning = true;
    incrementRecord('littleComputer.cakeOrders');
    const gift = document.createElement('div');
    gift.className = 'cake-confection cake-gift';
    gift.setAttribute('role', 'img');
    confection(gift, layers);
    served.append(gift);
    document.querySelector('#cake-greeting').textContent = round === 4 ? '谢谢你，生日真快乐！♡' : '谢谢你，真好吃！♡';
    tip.textContent = '你的蛋糕让朋友笑起来啦！';
    render();
    window.GameAudio.play(true);
    window.LevelTransition.show({ title: round === 4 ? '生日快乐，小伙伴！' : '香香的蛋糕送到啦！', note: '下一位朋友马上来', onDone: () => {
      if (!active) return;
      transitioning = false;
      customer += 1;
      if (customer === rounds[round].orders.length) {
        customer = 0;
        round = (round + 1) % rounds.length;
        served.replaceChildren();
      }
      setup(event.detail === 0);
    } });
  });
  function start() {
    window.showScreen('cake');
    active = true;
    transitioning = false;
    round = 0;
    customer = 0;
    served.replaceChildren();
    setup();
    window.GameHelp.first('cake');
  }
  function stop() { active = false; transitioning = false; window.LevelTransition.cancel(); }
  window.CakeGame = { start, stop };
})();
