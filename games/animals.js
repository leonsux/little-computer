(function createAnimalFriends() {
  const friends = [
    { key: 'elephant', name: '大象', symbol: 'animal-elephant', clue: '大大的耳朵和长鼻子' },
    { key: 'panda', name: '熊猫', symbol: 'animal-panda', clue: '黑耳朵和黑眼圈' },
    { key: 'polarBear', name: '北极熊', symbol: 'animal-polarBear', clue: '白白的圆耳朵' },
    { key: 'giraffe', name: '长颈鹿', symbol: 'animal-giraffe', clue: '小角和长长的脖子' },
  ];
  // Companions stay within the title area and never intercept game input.
  document.querySelectorAll('.screen > header h2').forEach(title => {
    if (title.closest('#parent-screen')) return;
    const companions = document.createElement('span');
    companions.className = 'animal-companions';
    companions.setAttribute('aria-hidden', 'true');
    companions.innerHTML = friends.map(friend => '<svg data-animal="' + friend.key + '" focusable="false"><use href="#' + friend.symbol + '-head"/></svg>').join('');
    title.append(companions);
  });
  window.GameAnimals = { friends };
})();
