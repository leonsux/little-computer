(function createMemoryGame() {
  const cards = document.querySelector('#memory-cards');
  const stage = document.querySelector('#memory-stage');
  const tip = document.querySelector('#memory-tip');
  const hint = document.querySelector('#memory-hint');
  const pictures = {
    rabbit: ['garden-rabbit-art', '小兔'], fish: ['mini-fish', '小鱼'],
    butterfly: ['garden-butterfly-art', '蝴蝶'], flower: ['garden-flower-art', '小花'],
    apple: ['play-apple', '苹果'], pear: ['play-pear', '梨子'],
  };
  const levels = [['rabbit', 'fish'], ['butterfly', 'flower', 'pear'], ['rabbit', 'fish', 'butterfly', 'apple']];
  let active = false;
  let transitioning = false;
  let level = 0;
  let matched = new Set();
  let open = [];
  let hintVisible = false;
  let mismatchTimer;

  function render() {
    [...cards.children].forEach((card, index) => {
      const shown = matched.has(index) || open.includes(index);
      card.classList.toggle('is-open', shown);
      card.classList.toggle('is-matched', matched.has(index));
      card.disabled = transitioning || matched.has(index);
      card.setAttribute('aria-pressed', String(shown));
      card.setAttribute('aria-label', '第 ' + (index + 1) + ' 张卡片，' +
        (shown || hintVisible ? pictures[card.dataset.picture][1] : '点击翻开') + (matched.has(index) ? '，已找到朋友' : ''));
    });
    stage.classList.toggle('show-hints', hintVisible);
    hint.setAttribute('aria-pressed', String(hintVisible));
    hint.textContent = hintVisible ? '收起提示' : '看看提示';
    window.GameProgress.render(document.querySelector('#memory-trail'), levels[level].length, matched.size / 2, 'garden-butterfly-art');
  }

  function setup(focus = false) {
    clearTimeout(mismatchTimer);
    mismatchTimer = undefined;
    open = [];
    matched = new Set();
    hintVisible = false;
    const deck = [...levels[level], ...levels[level]];
    for (let index = deck.length - 1; index > 0; index -= 1) {
      const other = Math.floor(Math.random() * (index + 1));
      [deck[index], deck[other]] = [deck[other], deck[index]];
    }
    cards.dataset.pairs = String(levels[level].length);
    document.querySelector('#memory-level').textContent = ['两个小伙伴', '花园里的朋友', '朋友来聚会'][level];
    tip.textContent = '先翻一张，再找它的朋友。';
    cards.replaceChildren();
    deck.forEach((picture, index) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'memory-card';
      card.dataset.picture = picture;
      card.innerHTML = '<span class="memory-back" aria-hidden="true">？</span><svg class="memory-front" aria-hidden="true"><use href="#' + pictures[picture][0] + '"/></svg><span class="memory-check" aria-hidden="true">✓</span>';
      card.addEventListener('click', (event) => {
        if (!active || transitioning || mismatchTimer || matched.has(index) || open.includes(index)) return;
        window.GameHelp.hide();
        open.push(index);
        tip.textContent = '再翻一张，看看是不是它的朋友。';
        if (open.length === 2) {
          const [first, second] = open;
          if (deck[first] === deck[second]) {
            matched.add(first);
            matched.add(second);
            open = [];
            tip.textContent = '找到朋友啦！';
            const complete = matched.size === deck.length;
            window.GameAudio.play(complete);
            if (complete) {
              transitioning = true;
              incrementRecord('littleComputer.memoryBoards');
              window.LevelTransition.show({
                title: '朋友都找到啦！', note: '新的朋友马上来',
                onDone: () => {
                  if (!active) return;
                  transitioning = false;
                  level = (level + 1) % levels.length;
                  setup(event.detail === 0);
                },
              });
            }
          } else {
            tip.textContent = '再翻翻别的，朋友就在这里。';
            mismatchTimer = setTimeout(() => {
              mismatchTimer = undefined;
              if (!active) return;
              open = [];
              tip.textContent = '慢慢找，相同的朋友想坐在一起。';
              render();
              if (event.detail === 0) cards.querySelector('button:not(:disabled)').focus();
            }, 1100);
          }
        }
        render();
        if (event.detail === 0 && !transitioning && !mismatchTimer) {
          const next = [...cards.children].find((item, i) => !item.disabled && !open.includes(i));
          next?.focus();
        }
      });
      cards.append(card);
    });
    render();
    if (focus) cards.firstElementChild.focus();
  }

  hint.addEventListener('click', () => {
    if (!active || transitioning) return;
    hintVisible = !hintVisible;
    render();
  });
  function start() {
    window.showScreen('memory');
    active = true;
    transitioning = false;
    level = 0;
    setup();
    window.GameHelp.first('memory');
  }
  function stop() {
    active = false;
    transitioning = false;
    clearTimeout(mismatchTimer);
    mismatchTimer = undefined;
    window.LevelTransition.cancel();
  }
  window.MemoryGame = { start, stop };
})();
