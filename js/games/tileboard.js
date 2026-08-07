import { move2048Tracked } from '../logic.js?v=42';

// Shared animated 2048 tile board. The GAME stays authoritative over the value grid; this renderer is a
// visual mirror. Layout is 100% responsive: percentage positions + aspect-ratio square + container-query
// font — no clientWidth measuring or ResizeObserver, so it can't mis-size on mobile.
const SLIDE = 100, GAP = 2.6;   // GAP in % of the board

export function makeTileBoard(ctx, opts) {
  const size = opts.size;
  const walls = opts.walls instanceof Set ? opts.walls : new Set((opts.walls || []).map(([x, y]) => x + ',' + y));
  let frozen = opts.frozen instanceof Set ? new Set(opts.frozen) : new Set((opts.frozen || []).map(([x, y]) => x + ',' + y));
  const palette = opts.palette || (() => 'bg-slate-700');
  const cellPct = (100 - GAP * (size + 1)) / size;
  const pos = (i) => GAP + i * (cellPct + GAP);

  const board = ctx.el('div', 'tb-board');
  board.style.setProperty('--tb-fs', (size >= 6 ? 5.5 : size === 5 ? 7 : 8.5) + 'cqw');
  if (opts.boardBg) board.style.background = opts.boardBg;
  const bg = ctx.el('div', 'tb-bg'), layer = ctx.el('div', 'tb-layer');
  board.append(bg, layer);
  if (opts.mount) opts.mount.appendChild(board);

  let tid = 0;
  const tiles = new Map();
  let grid = emptyGrid();
  function emptyGrid() { return Array.from({ length: size }, () => Array(size).fill(null)); }
  function place(el, x, y) { el.style.left = pos(x) + '%'; el.style.top = pos(y) + '%'; el.style.width = cellPct + '%'; el.style.height = cellPct + '%'; }
  function paintTile(t) {
    if (opts.tileStyle) { const s = opts.tileStyle(t.value) || {}; t.in.className = 'tb-tile-in' + (t.frozen ? ' tb-frozen' : ''); t.in.style.background = s.bg || ''; t.in.style.color = s.fg || '#f8fafc'; }
    else { t.in.className = 'tb-tile-in ' + palette(t.value) + (t.frozen ? ' tb-frozen' : ''); t.in.style.background = ''; t.in.style.color = ''; }
    t.in.textContent = t.value >= 1000 ? (t.value / 1000).toFixed(t.value >= 10000 ? 0 : 1) + 'k' : String(t.value);
  }
  const bump = (t) => { t.in.classList.remove('tb-merge'); void t.in.offsetWidth; t.in.classList.add('tb-merge'); };
  const pop = (t) => { t.in.classList.remove('tb-pop'); void t.in.offsetWidth; t.in.classList.add('tb-pop'); };

  function buildBg() {
    bg.innerHTML = '';
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const c = ctx.el('div', 'tb-cell' + (walls.has(x + ',' + y) ? ' tb-wall' : ''));
      place(c, x, y); bg.appendChild(c);
    }
  }
  function addTile(x, y, value, isFrozen, doPop) {
    const el = ctx.el('div', 'tb-tile'), inner = ctx.el('div', '');
    el.appendChild(inner);
    const t = { id: ++tid, x, y, value, frozen: isFrozen, el, in: inner };
    place(el, x, y); paintTile(t); layer.appendChild(el);
    grid[y][x] = t; tiles.set(t.id, t);
    if (doPop) pop(t);
    return t;
  }
  function sync(vgrid, frozenCells) {
    if (frozenCells) frozen = frozenCells instanceof Set ? new Set(frozenCells) : new Set(frozenCells.map(([x, y]) => x + ',' + y));
    layer.innerHTML = ''; tiles.clear(); grid = emptyGrid(); buildBg();
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const v = vgrid[y][x];
      if (v && !walls.has(x + ',' + y)) addTile(x, y, v, frozen.has(x + ',' + y), false);
    }
  }
  function animate(moves) {
    const byDest = new Map();
    for (const m of moves) { const k = m.toX + ',' + m.toY; if (!byDest.has(k)) byDest.set(k, []); byDest.get(k).push(m); }
    const movedIds = new Set(), ng = emptyGrid();
    for (const [k, group] of byDest) {
      const [tx, ty] = k.split(',').map(Number);
      const src = group.map((m) => grid[m.fromY] && grid[m.fromY][m.fromX]).filter(Boolean);
      for (const t of src) { movedIds.add(t.id); t.x = tx; t.y = ty; place(t.el, tx, ty); }
      if (group.length > 1 || group[0].merged) {
        const val = group[0].value * 2, keep = src[0]; ng[ty][tx] = keep;
        setTimeout(() => {
          for (let i = 1; i < src.length; i++) { src[i].el.remove(); tiles.delete(src[i].id); }
          if (keep) { keep.value = val; paintTile(keep); bump(keep); }
        }, SLIDE);
      } else if (src[0]) ng[ty][tx] = src[0];
    }
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { const t = grid[y][x]; if (t && !movedIds.has(t.id)) ng[t.y][t.x] = t; }
    grid = ng;
  }
  function spawnAt(x, y, value) { setTimeout(() => addTile(x, y, value, false, true), SLIDE + 10); }
  function thaw(x, y) { const t = grid[y] && grid[y][x]; if (t && t.frozen) { t.frozen = false; frozen.delete(x + ',' + y); paintTile(t); pop(t); } }

  buildBg();

  return {
    el: board,
    move(dir, gameBoard) { const res = move2048Tracked(gameBoard, dir, walls, frozen); if (res.moved) animate(res.moves); return res; },
    animate, sync, spawnAt, thaw,
    setFrozen(cells) { frozen = cells instanceof Set ? new Set(cells) : new Set((cells || []).map(([x, y]) => x + ',' + y)); },
    isFrozen: (x, y) => frozen.has(x + ',' + y),
    cellAt(clientX, clientY) {
      const r = board.getBoundingClientRect(); if (!r.width) return null;
      const fx = (clientX - r.left) / r.width * 100, fy = (clientY - r.top) / r.height * 100;
      const x = Math.floor((fx - GAP / 2) / (cellPct + GAP)), y = Math.floor((fy - GAP / 2) / (cellPct + GAP));
      return (x < 0 || x >= size || y < 0 || y >= size) ? null : [x, y];
    },
    highlight(x, y, on) { const t = grid[y] && grid[y][x]; if (t) t.in.classList.toggle('tb-tile-sel', !!on); },
    clearHighlights() { for (const t of tiles.values()) t.in.classList.remove('tb-tile-sel'); },
    destroy() { board.remove(); },
  };
}
