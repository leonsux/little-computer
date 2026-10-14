(function createPipePaths() {
  // Direction bits: north, east, south, west. Each pipe has exactly two openings.
  function trace(cells, columns, sourceRow, goalRow) {
    const wet = [], seen = new Set();
    const rows = cells.length / columns;
    let index = sourceRow * columns, incoming = 3;
    const delta = [-columns, 1, columns, -1];
    while (index >= 0 && index < cells.length && !seen.has(index)) {
      const mask = cells[index];
      const openings = [0, 1, 2, 3].filter(direction => mask & (1 << direction));
      if (openings.length !== 2 || !openings.includes(incoming)) return { wet, blocked: index, complete: false };
      wet.push(index); seen.add(index);
      const outgoing = openings.find(direction => direction !== incoming);
      const row = Math.floor(index / columns), column = index % columns;
      if (outgoing === 1 && column === columns - 1 && row === goalRow) return { wet, blocked: null, complete: true };
      if ((outgoing === 0 && row === 0) || (outgoing === 2 && row === rows - 1) ||
          (outgoing === 3 && column === 0) || (outgoing === 1 && column === columns - 1)) return { wet, blocked: index, complete: false };
      const next = index + delta[outgoing];
      if (!(cells[next] & (1 << ((outgoing + 2) % 4)))) return { wet, blocked: cells[next] ? next : index, complete: false };
      index = next; incoming = (outgoing + 2) % 4;
    }
    return { wet, blocked: index, complete: false };
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { trace };
  else window.PipePaths = { trace };
})();
