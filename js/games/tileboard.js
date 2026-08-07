import { move2048Tracked } from '../logic.js?v=44';

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
  // Deferred visuals (merge collapse, spawn) run via schedule(); flush() settles them instantly so a fast
  // next move never reads an unsettled grid (fixes "merge sometimes doesn't work").
  let pending = [];
  function schedule(fn, ms) { const id = setTimeout(() => { const i = pending.findIndex((p) => p.id === id); if (i >= 0) pending.splice(i, 1); fn(); }, ms); pending.push({ id, fn }); }
  function flush() { const ps = pending; pending = []; for (const p of ps) { clearTimeout(p.id); p.fn(); } }
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
    flush();
    if (frozenCells) frozen = frozenCells instanceof Set ? new Set(frozenCells) : new Set(frozenCells.map(([x, y]) => x + ',' + y));
    layer.innerHTML = ''; tiles.clear(); grid = emptyGrid(); buildBg();
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const v = vgrid[y][x];
      if (v && !walls.has(x + ',' + y)) addTile(x, y, v, frozen.has(x + ',' + y), false);
    }
  }
  function animate(moves) {
    flush();
    const byDest = new Map();
    for (const m of moves) { const k = m.toX + ',' + m.toY; if (!byDest.has(k)) byDest.set(k, []); byDest.get(k).push(m); }
    const movedIds = new Set(), ng = emptyGrid();
    for (const [k, group] of byDest) {
      const [tx, ty] = k.split(',').map(Number);
      const src = group.map((m) => grid[m.fromY] && grid[m.fromY][m.fromX]).filter(Boolean);
      for (const t of src) { movedIds.add(t.id); t.x = tx; t.y = ty; place(t.el, tx, ty); }
      if (group.length > 1 || group[0].merged) {
        const val = group[0].value * 2, keep = src[0], extra = src.slice(1); ng[ty][tx] = keep;
        schedule(() => {
          for (const s of extra) { s.el.remove(); tiles.delete(s.id); }
          if (keep) { keep.value = val; paintTile(keep); bump(keep); }
        }, SLIDE);
      } else if (src[0]) ng[ty][tx] = src[0];
    }
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { const t = grid[y][x]; if (t && !movedIds.has(t.id)) ng[t.y][t.x] = t; }
    grid = ng;
  }
  function spawnAt(x, y, value) { schedule(() => { if (!grid[y][x]) addTile(x, y, value, false, true); }, SLIDE + 10); }
  function thaw(x, y) { const t = grid[y] && grid[y][x]; if (t && t.frozen) { t.frozen = false; frozen.delete(x + ',' + y); paintTile(t); pop(t); } }

  // ---------- tool effects ----------
  const centerPct = (x, y) => [pos(x) + cellPct / 2, pos(y) + cellPct / 2];
  function ringAt(x, y, color) { const [cx, cy] = centerPct(x, y); const e = ctx.el('div', 'fx-ring'); e.style.left = cx + '%'; e.style.top = cy + '%'; e.style.width = cellPct + '%'; e.style.height = cellPct + '%'; e.style.borderColor = color || '#fff'; layer.appendChild(e); setTimeout(() => e.remove(), 540); }
  function starsAt(x, y) { const [cx, cy] = centerPct(x, y); for (let i = 0; i < 6; i++) { const a = (i / 6) * 6.28, r = cellPct * 0.5, e = ctx.el('div', 'fx-star', '✦'); e.style.left = (cx + Math.cos(a) * r) + '%'; e.style.top = (cy + Math.sin(a) * r) + '%'; e.style.color = ['#ffd54a', '#fff', '#ffb84a'][i % 3]; layer.appendChild(e); setTimeout(() => e.remove(), 660); } }
  function fragAt(x, y, color) { const [cx, cy] = centerPct(x, y); for (let i = 0; i < 8; i++) { const e = ctx.el('div', 'fx-frag'); e.style.left = cx + '%'; e.style.top = cy + '%'; e.style.width = '6cqw'; e.style.height = '6cqw'; e.style.background = color || '#f87171'; layer.appendChild(e); requestAnimationFrame(() => { const a = Math.random() * 6.28, d = cellPct * (0.6 + Math.random()); e.style.transition = 'left .5s ease-out, top .5s ease-out, opacity .5s ease-out'; e.style.left = (cx + Math.cos(a) * d) + '%'; e.style.top = (cy + Math.sin(a) * d) + '%'; e.style.opacity = '0'; }); setTimeout(() => e.remove(), 560); } }
  function glide(fx, fy, tx, ty, cb) { const t = grid[fy] && grid[fy][fx]; if (!t) { cb && cb(); return; } t.el.style.zIndex = '5'; t.in.classList.add('fx-glow'); place(t.el, tx, ty); setTimeout(() => { t.in.classList.remove('fx-glow'); t.el.style.zIndex = ''; ringAt(tx, ty, '#a5f3fc'); cb && cb(); }, SLIDE + 40); }
  function addFx(x, y) { const t = grid[y] && grid[y][x]; if (t) { t.in.classList.add('fx-aura'); setTimeout(() => t.in.classList.remove('fx-aura'), 520); } ringAt(x, y, '#ffffff'); }
  function doubleFx(x, y) { const t = grid[y] && grid[y][x]; if (t) { t.in.classList.add('fx-flip'); setTimeout(() => t.in.classList.remove('fx-flip'), 320); } ringAt(x, y, '#ffd54a'); starsAt(x, y); }
  function bombFx(cells) { if (cells[0]) ringAt(cells[0][0], cells[0][1], '#f87171'); for (const [x, y] of cells) fragAt(x, y, '#f87171'); }
  function vortex(cb) {
    for (const t of tiles.values()) { t.el.style.transition = 'left .28s ease-in, top .28s ease-in, transform .28s ease-in'; t.el.style.left = (50 - cellPct / 2) + '%'; t.el.style.top = (50 - cellPct / 2) + '%'; t.el.style.transform = 'scale(0.3) rotate(200deg)'; }
    setTimeout(() => { cb && cb(); }, 300);
  }

  buildBg();

  return {
    el: board,
    move(dir, gameBoard) { const res = move2048Tracked(gameBoard, dir, walls, frozen); if (res.moved) animate(res.moves); return res; },
    animate, sync, spawnAt, thaw,
    glide, addFx, doubleFx, bombFx, vortex,
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
    destroy() { for (const p of pending) clearTimeout(p.id); pending = []; board.remove(); },
  };
}
