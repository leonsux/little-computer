(function createMusicGame() {
  const instruments = document.querySelector('#music-instruments');
  const score = document.querySelector('#music-score');
  const hint = document.querySelector('#music-hint');
  const listen = document.querySelector('#music-listen');
  const tip = document.querySelector('#music-tip');
  const notes = {
    drum: { name: '小鼓', color: '#e4aa96' },
    bell: { name: '铃铛', color: '#e8cf89' },
    keys: { name: '木琴', color: '#a0c5c8' },
    shaker: { name: '沙锤', color: '#bbce9d' },
  };
  const songs = [
    { name: '小鼓和铃铛', sequence: ['drum', 'bell', 'drum'] },
    { name: '木琴来做客', sequence: ['keys', 'drum', 'bell', 'keys'] },
    { name: '大家一起演奏', sequence: ['bell', 'shaker', 'drum', 'shaker', 'keys'] },
  ];
  let active = false, transitioning = false, demonstrating = false, covered = false;
  let level = 0, played = 0, demoIndex = -1;
  let demoTimer, flashTimer;

  function clearFlash() { instruments.querySelectorAll('.is-sounding').forEach(button => button.classList.remove('is-sounding')); }
  function cancelDemo() {
    clearTimeout(demoTimer);
    clearTimeout(flashTimer);
    demonstrating = false;
    demoIndex = -1;
    clearFlash();
  }
  function sound(note) {
    clearTimeout(flashTimer);
    clearFlash();
    instruments.querySelector('[data-note="' + note + '"]').classList.add('is-sounding');
    window.GameAudio.playInstrument(note);
    flashTimer = setTimeout(clearFlash, 500);
  }
  function render() {
    [...score.children].forEach((step, index) => {
      step.classList.toggle('is-played', index < played);
      step.classList.toggle('is-next', index === played && !demonstrating && !transitioning);
      step.classList.toggle('is-listening', index === demoIndex);
      step.setAttribute('aria-label', '第 ' + (index + 1) + ' 个声音，' + (covered ? '乐谱已盖住' : notes[step.dataset.note].name) + (index < played ? '，已演奏' : ''));
    });
    score.classList.toggle('is-covered', covered);
    hint.setAttribute('aria-pressed', String(!covered));
    hint.textContent = covered ? '看看乐谱' : '盖住乐谱';
    listen.disabled = demonstrating || transitioning;
    listen.textContent = demonstrating ? '正在示范' : '听一遍';
    [...instruments.children].forEach(button => { button.disabled = demonstrating || transitioning; });
    window.GameProgress.render(document.querySelector('#music-trail'), songs[level].sequence.length, played, 'music-bell');
  }
  function demonstrate() {
    if (!active || transitioning || demonstrating) return;
    window.GameHelp.hide();
    cancelDemo();
    demonstrating = true;
    tip.textContent = '看亮起的乐器，听听它们的顺序。';
    const tick = index => {
      if (!active || !demonstrating) return;
      if (index === songs[level].sequence.length) {
        cancelDemo();
        tip.textContent = '轮到你啦，按自己的速度来。';
        render();
        return;
      }
      demoIndex = index;
      sound(songs[level].sequence[index]);
      render();
      demoTimer = setTimeout(() => tick(index + 1), 750);
    };
    tick(0);
  }
  function play(note, keyboard) {
    if (!active || transitioning || demonstrating) return;
    window.GameHelp.hide();
    sound(note);
    if (songs[level].sequence[played] !== note) {
      tip.textContent = '这个声音也好听，看看乐谱再接着奏。';
      return;
    }
    played += 1;
    const complete = played === songs[level].sequence.length;
    tip.textContent = complete ? '小乐句奏完啦，真好听！' : '接上啦，下一个是什么声音？';
    if (complete) {
      transitioning = true;
      incrementRecord('littleComputer.musicSongs');
      window.GameAudio.play(true);
      window.LevelTransition.show({ title: '小乐队奏完啦！', note: '下一段小乐句马上来', onDone: () => {
        if (!active) return;
        transitioning = false;
        level = (level + 1) % songs.length;
        setup(keyboard);
      } });
    }
    render();
  }
  function setup(focus = false) {
    cancelDemo();
    covered = false;
    played = 0;
    document.querySelector('#music-level').textContent = songs[level].name;
    tip.textContent = '照着乐谱奏，也可以盖住它试试。';
    score.replaceChildren();
    songs[level].sequence.forEach((note, index) => {
      const step = document.createElement('span');
      step.className = 'music-step';
      step.dataset.note = note;
      step.style.setProperty('--note-color', notes[note].color);
      step.innerHTML = '<svg aria-hidden="true"><use href="#music-' + note + '"/></svg><b aria-hidden="true">' + (index + 1) + '</b><i aria-hidden="true">✓</i>';
      score.append(step);
    });
    instruments.replaceChildren();
    Object.entries(notes).forEach(([note, data]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'music-instrument';
      button.dataset.note = note;
      button.style.setProperty('--note-color', data.color);
      button.setAttribute('aria-label', '演奏' + data.name);
      button.innerHTML = '<svg aria-hidden="true"><use href="#music-' + note + '"/></svg><span>' + data.name + '</span>';
      button.addEventListener('click', event => play(note, event.detail === 0));
      instruments.append(button);
    });
    render();
    if (focus) instruments.firstElementChild.focus();
  }
  hint.addEventListener('click', () => { if (!active || transitioning) return; covered = !covered; render(); });
  listen.addEventListener('click', demonstrate);
  function start() { window.showScreen('music'); active = true; transitioning = false; level = 0; setup(); window.GameHelp.first('music'); }
  function stop() { active = false; transitioning = false; cancelDemo(); window.LevelTransition.cancel(); }
  window.MusicGame = { start, stop };
})();
