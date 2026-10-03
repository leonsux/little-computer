(function createBubblesGame() {
  const buttons = document.querySelector('#bubble-buttons');
  const tip = document.querySelector('#bubble-tip');
  const levels = [
    { name: '浅浅海湾', total: 3 },
    { name: '珊瑚花园', total: 4 },
    { name: '彩虹海底', total: 6 },
  ];
  const colors = ['#efb077', '#ebcd76', '#a4c77c', '#a4cdd1', '#d8a1b3', '#bcb0d7'];
  let active = false;
  let transitioning = false;
  let level = 0;
  let popped = 0;

  function setup(focus = false) {
    popped = 0;
    buttons.replaceChildren();
    buttons.dataset.total = String(levels[level].total);
    document.querySelector('#bubble-level').textContent = levels[level].name;
    tip.textContent = '每个泡泡，都藏着一个朋友。';
    window.GameProgress.render(document.querySelector('#bubble-trail'), levels[level].total, 0, 'mini-fish');
    for (let index = 0; index < levels[level].total; index += 1) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'bubble-button';
      button.style.setProperty('--fish-color', colors[index]);
      button.setAttribute('aria-label', '第 ' + (index + 1) + ' 个泡泡，点击发现小鱼');
      button.innerHTML = '<svg aria-hidden="true"><use href="#mini-fish"/></svg><span class="bubble-shell" aria-hidden="true"></span>';
      button.addEventListener('click', (event) => {
        if (!active || transitioning || button.disabled) return;
        window.GameHelp.hide();
        button.disabled = true;
        button.classList.add('is-popped');
        button.setAttribute('aria-label', '第 ' + (index + 1) + ' 条小鱼，已找到');
        popped += 1;
        tip.textContent = '你好呀，小鱼！';
        window.GameProgress.render(document.querySelector('#bubble-trail'), levels[level].total, popped, 'mini-fish');
        window.GameAudio.play(popped === levels[level].total);
        if (popped === levels[level].total) {
          transitioning = true;
          tip.textContent = '小鱼都出来啦！';
          incrementRecord('littleComputer.bubbleScenes');
          window.LevelTransition.show({
            title: '小鱼都出来啦！',
            note: '下一片海湾马上出现',
            onDone: () => {
              if (!active) return;
              transitioning = false;
              level = (level + 1) % levels.length;
              setup(event.detail === 0);
            },
          });
        } else if (event.detail === 0) buttons.querySelector('button:not(:disabled)').focus();
      });
      buttons.append(button);
    }
    if (focus) buttons.firstElementChild.focus();
  }

  function start() {
    window.showScreen('bubbles');
    active = true;
    transitioning = false;
    level = 0;
    setup();
    window.GameHelp.first('bubbles');
  }

  function stop() {
    active = false;
    transitioning = false;
    window.LevelTransition.cancel();
  }
  window.BubblesGame = { start, stop };
})();
