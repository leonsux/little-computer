(function createDressupGame() {
  const items = {
    straw: { name: '草帽', group: 'hat', kind: 'straw', color: '#dfbf7a' },
    sun: { name: '遮阳帽', group: 'hat', kind: 'sun', color: '#eaa1ab' },
    cap: { name: '露营帽', group: 'hat', kind: 'cap', color: '#8fb8aa' },
    top: { name: '礼帽', group: 'hat', kind: 'top', color: '#968db6' },
    rainPink: { name: '粉雨衣', group: 'body', kind: 'rain', color: '#e9a4b4' },
    rainBlue: { name: '蓝雨衣', group: 'body', kind: 'rain', color: '#8cbccd' },
    coatMint: { name: '绿外套', group: 'body', kind: 'coat', color: '#9bbb99' },
    coatPink: { name: '粉外套', group: 'body', kind: 'coat', color: '#dca0b0' },
    scarfBlue: { name: '蓝围巾', group: 'neck', kind: 'scarf', color: '#8bb8c9' },
    scarfPink: { name: '粉围巾', group: 'neck', kind: 'scarf', color: '#e4a1b5' },
    bowRose: { name: '粉领结', group: 'neck', kind: 'bow', color: '#d68f9b' },
    bowGold: { name: '黄领结', group: 'neck', kind: 'bow', color: '#e4be6e' },
    carrot: { name: '胡萝卜包', group: 'bag', kind: 'bag', color: '#e5ae75', mark: 'adventure-carrot' },
    flower: { name: '小花背包', group: 'bag', kind: 'bag', color: '#d8a2b9', mark: 'garden-flower-art' },
    star: { name: '星星背包', group: 'bag', kind: 'bag', color: '#91b6c8', mark: 'shape-star' },
    bootsYellow: { name: '黄雨靴', group: 'feet', kind: 'boots', color: '#e6bf73' },
    bootsBlue: { name: '蓝雨靴', group: 'feet', kind: 'boots', color: '#89b7c9' },
  };
  const groups = { hat: '帽子', body: '衣服', neck: '围巾领结', bag: '背包', feet: '雨靴' };
  const scenes = [
    { name: '小兔去野餐', animal: 'rabbit', greeting: '帮我挑帽子和背包吧！', wishes: [['straw', 'sun'], ['carrot', 'flower']], choices: { hat: ['straw', 'sun', 'cap'], bag: ['carrot', 'flower', 'star'] }, effect: 'picnic' },
    { name: '大象踩水坑', animal: 'elephant', greeting: '我要去踩小水坑！', wishes: [['rainPink', 'rainBlue'], ['bootsYellow', 'bootsBlue']], choices: { body: ['rainPink', 'rainBlue', 'coatMint'], feet: ['bootsYellow', 'bootsBlue'] }, effect: 'puddle' },
    { name: '熊猫去旅行', animal: 'panda', greeting: '陪我准备小旅行吧！', wishes: [['sun', 'straw'], ['scarfBlue', 'scarfPink'], ['flower', 'star']], choices: { hat: ['sun', 'straw', 'cap'], neck: ['scarfBlue', 'scarfPink', 'bowRose'], bag: ['flower', 'star', 'carrot'] }, effect: 'flowers' },
    { name: '北极熊参加派对', animal: 'polarBear', greeting: '我要穿漂亮衣服去派对！', wishes: [['top'], ['bowRose', 'bowGold'], ['coatMint', 'coatPink']], choices: { hat: ['top', 'straw', 'sun'], neck: ['bowRose', 'bowGold', 'scarfBlue'], body: ['coatMint', 'coatPink', 'rainBlue'] }, effect: 'party' },
    { name: '长颈鹿去露营', animal: 'giraffe', greeting: '穿好衣服，去看小星星！', wishes: [['cap', 'sun'], ['coatMint', 'coatPink'], ['star', 'carrot']], choices: { hat: ['cap', 'sun', 'straw'], body: ['coatMint', 'coatPink', 'rainBlue'], bag: ['star', 'carrot', 'flower'] }, effect: 'camp' },
  ];
  const stage = document.querySelector('#dress-stage');
  const portrait = document.querySelector('#dress-character');
  const wishes = document.querySelector('#dress-wishes');
  const tabs = document.querySelector('#dress-tabs');
  const closet = document.querySelector('#dress-choices');
  const depart = document.querySelector('#dress-depart');
  const gallery = document.querySelector('#dress-outing');
  const tip = document.querySelector('#dress-tip');
  const previous = [];
  let active = false, transitioning = false, level = 0, outfit = {}, target = [], category = '', wardrobe = {};

  // Pictures, worn items and gallery figures share the same local clothing art.
  function clothing(key) {
    const item = items[key], c = item.color, edge = '#866d5d';
    let art = '';
    if (item.kind === 'straw') art = '<path d="M31 63L40 25Q70 7 100 25L109 63Z" fill="' + c + '"/><path d="M37 48H103" stroke="#b68a61" stroke-width="12"/><ellipse cx="70" cy="65" rx="62" ry="14" fill="' + c + '"/><path d="M17 66H123M48 30H92M45 38H95" stroke="#fff6" stroke-width="3"/>';
    if (item.kind === 'sun') art = '<path d="M26 63Q28 16 70 16Q112 16 114 63Z" fill="' + c + '"/><path d="M8 65Q28 47 70 53Q111 47 132 65Q121 88 70 77Q18 89 8 65Z" fill="' + c + '"/><path d="M36 45Q70 35 103 45" fill="none" stroke="#fff4" stroke-width="9"/><path d="M91 44L108 37L108 54Z" fill="#fff5d7"/>';
    if (item.kind === 'cap') art = '<path d="M20 65Q20 21 64 20Q106 18 115 63Z" fill="' + c + '"/><path d="M70 58Q123 55 133 72Q127 89 68 76Z" fill="' + c + '"/><path d="M65 23V57" stroke="#fff5" stroke-width="4"/><path d="M39 46L48 30L57 46Z" fill="#fff5d7"/>';
    if (item.kind === 'top') art = '<path d="M37 63L31 13H109L103 63Z" fill="' + c + '"/><path d="M37 49H103" stroke="#d7c9d8" stroke-width="12"/><ellipse cx="70" cy="66" rx="58" ry="12" fill="' + c + '"/>';
    if (item.kind === 'coat' || item.kind === 'rain') art = '<path d="M45 9L22 23L5 55L27 68L40 44L34 93H106L100 44L113 68L135 55L118 23L95 9Q70 27 45 9Z" fill="' + c + '"/><path d="M70 21V91" stroke="#fff8" stroke-width="3"/><path d="M45 9L53 34L70 22L87 34L95 9" fill="#fff5d7"/><circle cx="76" cy="46" r="3" fill="' + edge + '"/><circle cx="76" cy="63" r="3" fill="' + edge + '"/><path d="M44 69H57V79H44ZM85 69H98V79H85Z" fill="#fff5"/>' + (item.kind === 'rain' ? '<path d="M32 89H108M14 51L31 61M109 61L126 51" stroke="#fff7" stroke-width="5"/>' : '');
    if (item.kind === 'scarf') art = '<path d="M50 39L42 92H68L79 38Z" fill="' + c + '"/><path d="M21 22Q70 45 119 22V46Q71 69 21 46Z" fill="' + c + '"/><path d="M26 36Q70 57 114 36M46 75H68" fill="none" stroke="#fff6" stroke-width="6"/><path d="M46 91V99M55 91V99M64 91V99" stroke="' + c + '" stroke-width="4"/>';
    if (item.kind === 'bow') art = '<path d="M65 50L21 24Q12 50 21 77L65 58M75 50L119 24Q128 50 119 77L75 58" fill="' + c + '"/><rect x="59" y="43" width="22" height="23" rx="6" fill="' + c + '"/><path d="M27 40L55 52M85 52L113 40" stroke="#fff5" stroke-width="4"/>';
    if (item.kind === 'bag') art = '<path d="M48 21V13Q70 0 92 13V21" fill="none" stroke="' + edge + '" stroke-width="7"/><rect x="31" y="20" width="78" height="73" rx="20" fill="' + c + '"/><rect x="39" y="49" width="62" height="36" rx="10" fill="#fff5d7"/><svg x="52" y="51" width="36" height="32"><use href="#' + item.mark + '"/></svg>';
    if (item.kind === 'boots') art = '<path d="M20 14H53V60Q77 64 70 86H10V73L20 62Z M87 14H120V60Q143 64 136 86H77V73L87 62Z" fill="' + c + '"/><path d="M11 80H70M78 80H136M22 23H51M89 23H118" stroke="#fff6" stroke-width="5"/>';
    return '<g stroke="' + edge + '" stroke-width="2.5" stroke-linejoin="round">' + art + '</g>';
  }
  function icon(key) { return '<svg viewBox="0 0 140 105" aria-hidden="true">' + clothing(key) + '</svg>'; }
  function animalArt(scene, selection) {
    const animal = scene.animal;
    const fur = { rabbit: '#fff4df', elephant: '#aacbd2', panda: '#fff9ed', polarBear: '#fffaf0', giraffe: '#eccb82' }[animal];
    const friend = window.GameAnimals.friends.find(item => item.key === animal);
    const limb = animal === 'panda' ? '#536366' : fur;
    let head;
    if (friend) head = '<svg x="40" y="72" width="160" height="128" viewBox="0 0 200 160"><use href="#' + friend.symbol + '-head" width="200" height="160"/></svg>';
    if (animal === 'rabbit') head = '<path d="M77 117Q52 11 78 17Q99 19 102 109M138 109Q143 17 167 17Q191 16 164 116" fill="' + fur + '"/><path d="M78 92L77 35M159 92L167 35" stroke="#e6bca9" stroke-width="9" stroke-linecap="round"/><ellipse cx="120" cy="143" rx="49" ry="43" fill="' + fur + '"/>';
    const positions = { hat: 'translate(50 32)', body: 'translate(47 184) scale(1.04)', neck: 'translate(69 165) scale(.73)', feet: 'translate(53 222) scale(.96)', bag: 'translate(150 191) scale(.58)' };
    const worn = group => selection[group] ? '<g data-worn="' + selection[group] + '" transform="' + positions[group] + '">' + clothing(selection[group]) + '</g>' : '';
    const face = friend ? '' : '<circle cx="99" cy="143" r="4"/><circle cx="141" cy="143" r="4"/><path d="M115 155H125L120 160Z"/><path d="M111 166Q120 175 129 166" fill="none" stroke="#68564b" stroke-width="2.5" stroke-linecap="round"/>';
    const cheeks = friend ? '' : '<g fill="#e8b59c"><ellipse cx="87" cy="157" rx="8" ry="5"/><ellipse cx="153" cy="157" rx="8" ry="5"/></g>';
    return '<svg viewBox="0 0 240 320" data-animal="' + animal + '" role="img" aria-label="' + scene.name + '，' + (Object.values(selection).map(key => items[key].name).join('、') || '等你来换装') + '"><ellipse cx="120" cy="307" rx="78" ry="9" fill="#74917922"/>' + '<g fill="' + fur + '" stroke="#947c65" stroke-width="3"><ellipse cx="120" cy="237" rx="49" ry="55"/><ellipse fill="' + limb + '" cx="57" cy="239" rx="15" ry="31" transform="rotate(14 57 239)"/><ellipse fill="' + limb + '" cx="183" cy="239" rx="15" ry="31" transform="rotate(-14 183 239)"/><ellipse fill="' + limb + '" cx="88" cy="294" rx="24" ry="11"/><ellipse fill="' + limb + '" cx="152" cy="294" rx="24" ry="11"/></g>' + worn('body') + worn('bag') + worn('feet') + '<g stroke="' + (friend ? 'none' : '#947c65') + '" stroke-width="3" stroke-linejoin="round">' + head + '</g><g fill="#68564b">' + face + '</g>' + cheeks + worn('neck') + worn('hat') + '</svg>';
  }
  function surprise(scene) {
    const content = { picnic: '<svg><use href="#adventure-carrot"/></svg>', puddle: '<span class="dress-splash">﹏</span>', flowers: '<svg><use href="#garden-flower-art"/></svg>', party: '<span class="dress-party-stars">✦ ♡ ✦</span>', camp: '<span class="dress-tent"><i>✦</i></span>' }[scene.effect];
    return '<span class="dress-surprise dress-surprise-' + scene.effect + '" aria-hidden="true">' + content + '</span>';
  }
  function matches(group) { return outfit[group] === target.find(key => items[key].group === group); }
  function complete() { return target.every(key => outfit[items[key].group] === key); }
  function render() {
    portrait.innerHTML = animalArt(scenes[level], outfit) + (transitioning ? surprise(scenes[level]) : '');
    stage.classList.toggle('is-leaving', transitioning);
    wishes.querySelectorAll('[data-wish]').forEach(token => {
      const group = items[token.dataset.wish].group;
      token.classList.toggle('is-done', matches(group));
      token.classList.toggle('is-current', group === category && !matches(group));
      token.setAttribute('aria-label', items[token.dataset.wish].name + (matches(group) ? '，已穿好' : '，还想要'));
    });
    tabs.querySelectorAll('button').forEach(button => {
      button.disabled = transitioning;
      button.setAttribute('aria-selected', String(button.dataset.category === category));
      button.tabIndex = button.dataset.category === category ? 0 : -1;
    });
    closet.querySelectorAll('button').forEach(button => {
      button.disabled = transitioning;
      button.setAttribute('aria-pressed', String(outfit[category] === button.dataset.item));
    });
    depart.disabled = !complete() || transitioning;
    document.querySelector('#dress-ready').textContent = complete() ? '配齐啦，出发去玩吧！' : '先看小图片，喜欢哪件就点哪件。';
    window.GameProgress.render(document.querySelector('#dress-trail'), scenes.length, level + Number(transitioning), 'garden-rabbit-art');
  }
  function showCategory(group, focus = false) {
    if (!active || transitioning || !wardrobe[group]) return;
    category = group;
    closet.setAttribute('aria-labelledby', 'dress-tab-' + group);
    closet.replaceChildren();
    wardrobe[group].forEach(key => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'dress-choice';
      button.dataset.item = key;
      button.setAttribute('aria-label', '穿上' + items[key].name);
      button.innerHTML = icon(key) + '<span>' + items[key].name + '</span>';
      button.addEventListener('click', () => {
        if (!active || transitioning || category !== items[key].group) return;
        window.GameHelp.hide();
        const changed = outfit[category] !== key;
        outfit[category] = key;
        if (changed) window.GameAudio.play(false, 523);
        tip.textContent = matches(category) ? (complete() ? '都穿好啦，点击「出发啦」和朋友去玩！' : '这件配好啦！也可以先选别的装扮。') : '这件也很可爱，看看朋友图片里的愿望，可以直接换一件。';
        render();
      });
      closet.append(button);
    });
    render();
    if (focus) tabs.querySelector('[data-category="' + group + '"]').focus({ preventScroll: true });
  }
  function shuffle(values) {
    const shuffled = [...values];
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
  function setup(focus = false) {
    outfit = {};
    const scene = scenes[level];
    target = scene.wishes.map(options => options[Math.floor(Math.random() * options.length)]);
    if (target.join() === previous[level]?.join()) {
      const index = scene.wishes.findIndex(options => options.length > 1);
      target[index] = scene.wishes[index][(scene.wishes[index].indexOf(target[index]) + 1) % scene.wishes[index].length];
    }
    previous[level] = [...target];
    wardrobe = Object.fromEntries(Object.entries(scene.choices).map(([group, keys]) => [group, shuffle(keys)]));
    document.querySelector('#dress-level').textContent = scene.name;
    document.querySelector('#dress-greeting').textContent = scene.greeting;
    stage.dataset.scene = scene.effect;
    wishes.replaceChildren();
    target.forEach(key => {
      const token = document.createElement('span');
      token.className = 'dress-wish';
      token.dataset.wish = key;
      token.innerHTML = icon(key) + '<small>' + items[key].name + '</small><b aria-hidden="true">✓</b>';
      wishes.append(token);
    });
    tabs.replaceChildren();
    Object.keys(wardrobe).forEach(group => {
      const button = document.createElement('button');
      button.type = 'button';
      button.id = 'dress-tab-' + group;
      button.dataset.category = group;
      button.className = 'dress-tab';
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-controls', 'dress-choices');
      button.innerHTML = icon(scene.choices[group][0]) + '<span>' + groups[group] + '</span>';
      button.addEventListener('click', () => showCategory(group));
      button.addEventListener('keydown', event => {
        const keys = Object.keys(wardrobe), index = keys.indexOf(group);
        let next;
        if (event.key === 'ArrowRight') next = (index + 1) % keys.length;
        if (event.key === 'ArrowLeft') next = (index + keys.length - 1) % keys.length;
        if (event.key === 'Home') next = 0;
        if (event.key === 'End') next = keys.length - 1;
        if (next === undefined) return;
        event.preventDefault();
        showCategory(keys[next], true);
      });
      tabs.append(button);
    });
    tip.textContent = '先穿哪件都可以。选错了，换一件就好。';
    showCategory(Object.keys(wardrobe)[0], focus);
  }
  depart.addEventListener('click', event => {
    if (!active || transitioning || !complete()) return;
    window.GameHelp.hide();
    transitioning = true;
    if (gallery.children.length === scenes.length) gallery.replaceChildren();
    const friend = document.createElement('div');
    friend.className = 'dress-friend';
    friend.dataset.scene = scenes[level].effect;
    friend.innerHTML = animalArt(scenes[level], outfit) + surprise(scenes[level]);
    gallery.append(friend);
    document.querySelector('#dress-greeting').textContent = '谢谢你，我要去玩啦！♡';
    tip.textContent = level === scenes.length - 1 ? '朋友到齐啦，看看我们的郊游合影！' : '穿好的朋友在下面等你，一起出发吧！';
    incrementRecord('littleComputer.dressFriends');
    render();
    window.GameAudio.play(true);
    window.LevelTransition.show({ title: level === scenes.length - 1 ? '朋友到齐，一起去玩！' : '穿好啦，开心出发！', note: level === scenes.length - 1 ? '合影留下，再换一组新装扮' : '下一位朋友马上来', onDone: () => {
      if (!active) return;
      transitioning = false;
      level = (level + 1) % scenes.length;
      setup(event.detail === 0);
    } });
  });
  function start() {
    window.showScreen('dressup');
    active = true;
    transitioning = false;
    level = 0;
    gallery.replaceChildren();
    setup();
    window.GameHelp.first('dressup');
  }
  function stop() { active = false; transitioning = false; window.LevelTransition.cancel(); }
  window.DressupGame = { start, stop };
})();
