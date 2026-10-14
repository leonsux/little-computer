(function createBoxRules() {
  const levels = [
    { name: '绕到箱子后面', rows: ['#######', '#   . #', '#   @ #', '#  $  #', '#     #', '#######'] },
    { name: '绕过小隔墙', rows: ['#######', '#     #', '#  #$ #', '#@ .  #', '#     #', '#######'] },
    { name: '两箱分开走', rows: ['#######', '# .$. #', '#     #', '#  # @#', '# $   #', '#     #', '#######'] },
    { name: '狭道让一让', rows: ['#######', '#     #', '# .#$ #', '#  #. #', '#   $ #', '#@    #', '#######'] },
    { name: '留出站脚处', rows: ['#######', '#  .$ #', '# # $ #', '#   # #', '# .   #', '#@    #', '#######'] },
    { name: '三箱换站位', rows: ['########', '# .$ . #', '# $$#  #', '#      #', '# # .  #', '#  @   #', '########'] },
    { name: '窄门搬运', rows: ['########', '#.     #', '#$$##. #', '#      #', '#.$#   #', '#   @  #', '########'] },
    { name: '仓库大挑战', rows: ['########', '# ...  #', '# $ #$ #', '# #    #', '#   $# #', '#  @   #', '########'] },
  ];
  const directions = { up: [0, -1], right: [1, 0], down: [0, 1], left: [-1, 0] };
  function parse(rows) {
    const tiles = rows.join('');
    return {
      columns: rows[0].length, rows: rows.length,
      walls: [...tiles].flatMap((tile, index) => tile === '#' ? [index] : []),
      goals: [...tiles].flatMap((tile, index) => '.+*'.includes(tile) ? [index] : []),
      player: [...tiles].findIndex(tile => '@+'.includes(tile)),
      boxes: [...tiles].flatMap((tile, index) => '$*'.includes(tile) ? [index] : []),
    };
  }
  function neighbor(map, index, direction) {
    const delta = directions[direction];
    if (!delta) return -1;
    const x = index % map.columns + delta[0], y = Math.floor(index / map.columns) + delta[1];
    return x < 0 || x >= map.columns || y < 0 || y >= map.rows ? -1 : y * map.columns + x;
  }
  function step(map, state, direction) {
    const next = neighbor(map, state.player, direction);
    if (next < 0 || map.walls.includes(next)) return null;
    const boxes = [...state.boxes], box = boxes.indexOf(next);
    if (box !== -1) {
      const beyond = neighbor(map, next, direction);
      if (beyond < 0 || map.walls.includes(beyond) || boxes.includes(beyond)) return null;
      boxes[box] = beyond;
    }
    return { player: next, boxes };
  }
  function complete(map, state) { return state.boxes.length > 0 && state.boxes.every(box => map.goals.includes(box)); }
  function inCorner(map, box) {
    if (map.goals.includes(box)) return false;
    const blocked = direction => {
      const next = neighbor(map, box, direction);
      return next < 0 || map.walls.includes(next);
    };
    return (blocked('up') || blocked('down')) && (blocked('left') || blocked('right'));
  }
  const api = { levels, parse, neighbor, step, complete, inCorner };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else window.BoxesRules = api;
})();
