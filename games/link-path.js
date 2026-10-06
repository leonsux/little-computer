(function createLinkPaths() {
  function findPath(board, columns, first, second) {
    if (first === second || !board[first] || !board[second]) return null;
    const rows = Math.ceil(board.length / columns);
    const cell = index => [Math.floor(index / columns) + 1, index % columns + 1];
    const start = cell(first), end = cell(second);
    const directions = [[0, 1], [1, 0], [0, -1], [-1, 0]];
    const queue = [{ row: start[0], column: start[1], direction: -1, turns: 0, path: [start] }];
    const best = new Map();
    for (let head = 0; head < queue.length; head += 1) {
      const current = queue[head];
      for (let direction = 0; direction < directions.length; direction += 1) {
        const turns = current.turns + (current.direction !== -1 && current.direction !== direction ? 1 : 0);
        if (turns > 2) continue;
        const row = current.row + directions[direction][0], column = current.column + directions[direction][1];
        if (row < 0 || row > rows + 1 || column < 0 || column > columns + 1) continue;
        const atEnd = row === end[0] && column === end[1];
        const inside = row > 0 && row <= rows && column > 0 && column <= columns;
        if (!atEnd && inside && board[(row - 1) * columns + column - 1]) continue;
        const key = row + ',' + column + ',' + direction;
        if ((best.get(key) ?? Infinity) <= turns) continue;
        best.set(key, turns);
        const path = [...current.path, [row, column]];
        if (atEnd) {
          return path.filter((point, index) => index === 0 || index === path.length - 1 ||
            (path[index - 1][0] !== path[index + 1][0] && path[index - 1][1] !== path[index + 1][1]));
        }
        queue.push({ row, column, direction, turns, path });
      }
    }
    return null;
  }
  function findPair(board, columns) {
    for (let first = 0; first < board.length; first += 1) {
      if (!board[first]) continue;
      for (let second = first + 1; second < board.length; second += 1) {
        if (board[first] !== board[second]) continue;
        const path = findPath(board, columns, first, second);
        if (path) return { first, second, path };
      }
    }
    return null;
  }
  // Preserve empty cells and picture counts, and guarantee a move without retry loops.
  function arrange(board, columns) {
    const result = [...board];
    const slots = board.map((picture, index) => picture ? index : -1).filter(index => index >= 0);
    for (let index = slots.length - 1; index > 0; index -= 1) {
      const other = Math.floor(Math.random() * (index + 1));
      [result[slots[index]], result[slots[other]]] = [result[slots[other]], result[slots[index]]];
    }
    if (findPair(result, columns) || slots.length === 0) return result;
    for (const first of slots) {
      for (const second of slots) {
        if (first >= second || !findPath(result, columns, first, second)) continue;
        const partner = slots.find(index => index !== first && result[index] === result[first]);
        [result[second], result[partner]] = [result[partner], result[second]];
        return result;
      }
    }
    return result;
  }
  window.LinkPaths = { findPath, findPair, arrange };
})();
