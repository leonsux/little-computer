(function createIcecreamGame() {
  const flavors = {
    strawberry: { name: '草莓', color: '#eaa4af', symbol: 'garden-flower-art' },
    vanilla: { name: '香草', color: '#f4df9a', symbol: 'shape-star' },
    chocolate: { name: '巧克力', color: '#b58a70', symbol: 'garden-seed-art' },
    mint: { name: '薄荷', color: '#a6cdb1', symbol: 'garden-sprout-art' },
  };
  const guests = [
    { name: '小兔', symbol: 'garden-rabbit-art' },
    { name: '蝴蝶', symbol: 'garden-butterfly-art' },
    { name: '小鱼', symbol: 'mini-fish' },
  ];
  // Orders list scoops from the cone upwards; the picture and recipe use that same order.
  const rounds = [
    { name: '小店开张啦', orders: [['strawberry'], ['vanilla']] },
    { name: '双球好朋友', orders: [['vanilla', 'strawberry'], ['chocolate', 'vanilla']] },
    { name: '薄荷来做客', orders: [['mint', 'strawberry'], ['chocolate', 'mint'], ['strawberry', 'strawberry']] },
    { name: '三球小彩虹', orders: [['vanilla', 'mint', 'strawberry'], ['chocolate', 'vanilla', 'mint'], ['strawberry', 'chocolate', 'vanilla']] },
    { name: '花园甜点派对', orders: [['mint', 'vanilla', 'mint'], ['strawberry', 'mint', 'chocolate'], ['chocolate', 'strawberry', 'strawberry']] },
  ];
  const stage = document.querySelector('#icecream-stage');
  const bins = document.querySelector('#icecream-flavors');
  const recipe = document.querySelector('#icecream-recipe');
  const made = document.querySelector('#icecream-made');
  const tip = document.querySelector('#icecream-tip');
  const undo = document.querySelector('#icecream-undo');
  const serve = document.querySelector('#icecream-serve');
  const served = document.querySelector('#icecream-served');
  let active = false, transitioning = false;
  let round = 0, customer = 0, scoops = [];

  function currentOrder() { return rounds[round].orders[customer]; }
  function scoop(flavor) {
    const data = flavors[flavor];
    const ball = document.createElement('span');
    ball.className = 'icecream-scoop';
    ball.dataset.flavor = flavor;
    ball.style.setProperty('--scoop-color', data.color);
    ball.innerHTML = '<svg aria-hidden="true"><use href="#' + data.symbol + '"/></svg>';
    return ball;
  }
  function confection(container, selection) {
    const stack = document.createElement('div');
    stack.className = 'icecream-stack';
    selection.forEach(flavor => stack.append(scoop(flavor)));
    const cone = document.createElement('span');
    cone.className = 'icecream-cone';
    cone.setAttribute('aria-hidden', 'true');
    container.replaceChildren(stack, cone);
    container.setAttribute('aria-label', selection.length ? '从下到上：' + selection.map(flavor => flavors[flavor].name).join('、') : '空蛋筒，还没有冰淇淋球');
  }
  function render() {
    const order = currentOrder();
    confection(made, scoops);
    let prefix = 0;
    while (prefix < scoops.length && scoops[prefix] === order[prefix]) prefix += 1;
    [...recipe.children].forEach((step, index) => {
      step.classList.toggle('is-done', index < prefix);
      step.classList.toggle('is-next', index === prefix && !transitioning);
      step.setAttribute('aria-current', index === prefix && !transitioning ? 'step' : 'false');
    });
    [...made.querySelectorAll('.icecream-scoop')].forEach((ball, index) => {
      ball.classList.toggle('is-different', index >= prefix && !transitioning);
    });
    [...bins.children].forEach(button => { button.disabled = transitioning || scoops.length === order.length; });
    undo.disabled = transitioning || !scoops.length;
    serve.disabled = transitioning || !scoops.length;
    stage.classList.toggle('is-served', transitioning);
    window.GameProgress.render(document.querySelector('#icecream-trail'), rounds[round].orders.length, customer + (transitioning ? 1 : 0), 'garden-rabbit-art');
  }
  function setup(focus = false) {
    scoops = [];
    const guest = guests[(round + customer) % guests.length];
    document.querySelector('#icecream-level').textContent = rounds[round].name;
    document.querySelector('#icecream-guest use').setAttribute('href', '#' + guest.symbol);
    document.querySelector('#icecream-greeting').textContent = guest.name + '来啦！';
    confection(document.querySelector('#icecream-order'), currentOrder());
    recipe.replaceChildren();
    currentOrder().forEach((flavor, index) => {
      const step = document.createElement('span');
      step.className = 'icecream-recipe-step';
      step.dataset.flavor = flavor;
      step.setAttribute('aria-label', '第 ' + (index + 1) + ' 球，' + flavors[flavor].name);
      step.append(scoop(flavor));
      const number = document.createElement('b');
      number.textContent = String(index + 1);
      step.append(number);
      recipe.append(step);
    });
    bins.replaceChildren();
    Object.entries(flavors).forEach(([flavor, data]) => {
      if (flavor === 'mint' && round < 2) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'icecream-flavor';
      button.dataset.flavor = flavor;
      button.setAttribute('aria-label', '加一球' + data.name);
      button.append(scoop(flavor));
      const label = document.createElement('span');
      label.textContent = data.name;
      button.append(label);
      button.addEventListener('click', () => {
        if (!active || transitioning || scoops.length >= currentOrder().length) return;
        window.GameHelp.hide();
        scoops.push(flavor);
        window.GameAudio.play(false, 440 + scoops.length * 110);
        tip.textContent = scoops.length === currentOrder().length ? '叠好啦，看看和客人的一样吗？' : '加上了一球，再选下一种口味吧。';
        render();
        // A full cone disables flavor buttons; keep keyboard focus on an available action.
        if (document.activeElement === button && button.disabled) serve.focus({ preventScroll: true });
      });
      bins.append(button);
    });
    tip.textContent = '先看图片，第一球在最下面。点错了可以撤回。';
    render();
    if (focus) bins.firstElementChild.focus({ preventScroll: true });
  }
  undo.addEventListener('click', () => {
    if (!active || transitioning || !scoops.length) return;
    window.GameHelp.hide();
    scoops.pop();
    tip.textContent = '拿回一球啦，换个口味试试看。';
    render();
    if (undo.disabled) bins.firstElementChild.focus({ preventScroll: true });
  });
  serve.addEventListener('click', event => {
    if (!active || transitioning || !scoops.length) return;
    window.GameHelp.hide();
    const order = currentOrder();
    if (scoops.length !== order.length || scoops.some((flavor, index) => flavor !== order[index])) {
      tip.textContent = '朋友想要图片里的那一份，看看口味和上下顺序；可以撤回再试。';
      return;
    }
    transitioning = true;
    incrementRecord('littleComputer.icecreamOrders');
    const gift = document.createElement('div');
    gift.className = 'icecream-gift';
    gift.setAttribute('role', 'img');
    confection(gift, scoops);
    served.append(gift);
    document.querySelector('#icecream-greeting').textContent = '谢谢你，好好吃！♡';
    tip.textContent = '朋友收到了甜甜的冰淇淋！';
    render();
    window.GameAudio.play(true);
    window.LevelTransition.show({ title: '甜甜的心意送到啦！', note: '下一位朋友马上来', onDone: () => {
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
    window.showScreen('icecream');
    active = true;
    transitioning = false;
    round = 0;
    customer = 0;
    served.replaceChildren();
    setup();
    window.GameHelp.first('icecream');
  }
  function stop() { active = false; transitioning = false; window.LevelTransition.cancel(); }
  window.IcecreamGame = { start, stop };
})();
