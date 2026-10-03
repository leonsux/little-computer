(function createStarsGame() {
  const field = document.querySelector('#star-field');
  const guide = document.querySelector('#star-guide');
  const buttons = document.querySelector('#star-buttons');
  const count = document.querySelector('#star-count');
  const target = document.querySelector('#star-target');
  const tip = document.querySelector('#star-tip');
  const levelLabel = document.querySelector('#star-level');
  const thread = document.querySelector('#star-thread');
  const levels = [
    { name: '小三角', points: [[50, 18], [25, 76], [75, 76]], guide: 'M50 18L25 76L75 76Z' },
    { name: '小风筝', points: [[50, 12], [24, 50], [50, 88], [76, 50]], guide: 'M50 12L24 50L50 88L76 50Z' },
    { name: '小房子', points: [[50, 10], [20, 45], [20, 82], [80, 82], [80, 45]], guide: 'M50 10L20 45V82H80V45Z' },
    { name: '小鱼儿', points: [[18, 50], [43, 25], [72, 31], [84, 50], [72, 69], [43, 75]], guide: 'M18 50L43 25Q67 20 84 50Q67 80 43 75Z M18 50L5 27V73Z' },
    { name: '小爱心', points: [[50, 84], [18, 50], [21, 26], [38, 19], [50, 35], [62, 19], [79, 26], [82, 50]], guide: 'M50 84L18 50Q13 27 29 20Q42 15 50 35Q58 15 71 20Q87 27 82 50Z' },
    { name: '小树', points: [[50, 8], [30, 46], [18, 72], [42, 72], [42, 91], [58, 91], [58, 72], [82, 72], [70, 46]], guide: 'M50 8L30 46L18 72H42V91H58V72H82L70 46Z' },
    { name: '小火箭', points: [[50, 7], [29, 34], [29, 57], [16, 75], [37, 71], [50, 91], [63, 71], [84, 75], [71, 57], [71, 34]], guide: 'M50 7Q29 18 29 34V57L16 75L37 71L50 91L63 71L84 75L71 57V34Q71 18 50 7Z' },
    { name: '小花朵', points: [[50, 8], [65, 29], [90, 37], [74, 56], [76, 84], [50, 71], [24, 84], [26, 56], [10, 37], [35, 29]], guide: 'M50 8Q63 9 65 29Q91 21 90 37Q97 53 74 56Q89 81 76 84Q59 93 50 71Q40 92 24 84Q10 76 26 56Q1 48 10 37Q14 20 35 29Q38 8 50 8Z' },
  ];
  let active = false;
  let levelIndex = 0;
  let lit = 0;
  let transitioning = false;

  function render() {
    const level = levels[levelIndex];
    [...buttons.children].forEach((button, index) => {
      button.classList.toggle('is-lit', index < lit);
      button.classList.toggle('is-next', index === lit);
      button.disabled = index !== lit;
      button.setAttribute('aria-label', '第 ' + (index + 1) + ' 颗星星' + (index < lit ? '，已点亮' : ''));
    });
    window.GameProgress.render(document.querySelector('#star-trail'), level.points.length, lit, 'star');
    const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    const points = level.points.slice(0, lit);
    if (lit === level.points.length) points.push(level.points[0]);
    polyline.setAttribute('points', points.map((point) => point.join(',')).join(' '));
    thread.replaceChildren(polyline);
    count.textContent = String(lit);
    target.textContent = String(level.points.length);
    levelLabel.textContent = '第 ' + (levelIndex + 1) + ' 关 · ' + level.name;
    field.classList.toggle('is-complete', lit === level.points.length);
    tip.textContent = lit === level.points.length ? level.name + '拼好啦！' : '一起点亮' + level.name;
  }

  function setupLevel(focus = false) {
    const level = levels[levelIndex];
    lit = 0;
    field.dataset.scene = String(levelIndex);
    guide.replaceChildren();
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', level.guide);
    guide.append(path);
    buttons.replaceChildren();
    level.points.forEach(([x, y], index) => {
      const button = document.createElement('button');
      button.className = 'star-button';
      button.type = 'button';
      button.textContent = '★';
      button.style.left = x + '%';
      button.style.top = y + '%';
      button.addEventListener('click', (event) => {
        if (!active || transitioning || index !== lit) return;
        window.GameHelp.hide();
        lit += 1;
        incrementRecord('littleComputer.starClicks');
        window.GameAudio.play(lit === level.points.length);
        render();
        if (lit === level.points.length) {
          incrementRecord('littleComputer.starRounds');
          transitioning = true;
          const isLastLevel = levelIndex === levels.length - 1;
          window.LevelTransition.show({
            title: level.name + '拼好啦！',
            note: isLastLevel ? '新的图案马上开始' : '下一幅图案马上出现',
            onDone: () => {
              if (!active) return;
              transitioning = false;
              levelIndex = isLastLevel ? 0 : levelIndex + 1;
              setupLevel(event.detail === 0);
            },
          });
        }
        if (event.detail === 0 && lit < level.points.length) buttons.children[lit].focus();
      });
      buttons.append(button);
    });
    render();
    if (focus) buttons.firstElementChild.focus();
  }

  function start() {
    window.LevelTransition.cancel();
    window.showScreen('stars');
    active = true;
    transitioning = false;
    levelIndex = 0;
    setupLevel();
    window.GameHelp.first('stars');
  }

  window.StarsGame = {
    start,
    stop() {
      active = false;
      transitioning = false;
      window.LevelTransition.cancel();
    },
  };
})();
