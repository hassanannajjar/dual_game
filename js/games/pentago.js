import { pentagoRotate, pentagoWinner } from '../logic.js?v=42';

// 6x6. A turn = place a marble on an empty cell, then rotate one 3x3 quadrant 90°. First 5-in-a-row wins.
const M = { b: [], mine: 1, opp: 2, phase: 'place', pending: null, cells: [], rotWrap: null, msgEl: null };
const fresh = () => Array.from({ length: 6 }, () => Array(6).fill(0));
const QUAD = [{ n: 'TL', q: 0 }, { n: 'TR', q: 1 }, { n: 'BL', q: 2 }, { n: 'BR', q: 3 }];

function beadCls(v) {
  return v === 1 ? 'bg-sky-400 shadow-[0_0_8px] shadow-sky-400/60'
    : v === 2 ? 'bg-rose-500 shadow-[0_0_8px] shadow-rose-500/60' : 'bg-slate-800/60';
}
function winLineCells(b, p) {
  const dirs = [[1, 0], [0, 1], [1, 1], [1, -1]];
  for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) { if (b[y][x] !== p) continue;
    for (const [dx, dy] of dirs) { const line = [[x, y]]; let cx = x + dx, cy = y + dy;
      while (cx >= 0 && cx < 6 && cy >= 0 && cy < 6 && b[cy][cx] === p) { line.push([cx, cy]); cx += dx; cy += dy; }
      if (line.length >= 5) return line; }
  }
  return [];
}
function paint(ctx) {
  for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) {
    const cell = M.cells[y][x], v = M.b[y][x];
    const pend = M.pending && M.pending[0] === x && M.pending[1] === y;
    cell.firstChild.className = 'w-[74%] h-[74%] rounded-full transition-transform ' + (pend ? beadCls(M.mine) + ' animate-pulse' : beadCls(v));
  }
  if (M.rotWrap) M.rotWrap.classList.toggle('hidden', M.phase !== 'rotate');
  if (M.msgEl) M.msgEl.textContent = !ctx.myTurn ? ctx.t('opp_move') : M.phase === 'place' ? ctx.t('pentago_place') : ctx.t('pentago_rotate');
}
function build(ctx) {
  M.cells = [];
  const wrap = ctx.el('div', 'mx-auto'); wrap.style.maxWidth = 'min(92vw, 26rem)';
  M.msgEl = ctx.el('p', 'text-center text-slate-400 text-sm mb-2'); wrap.appendChild(M.msgEl);
  const grid = ctx.el('div', 'grid gap-1.5 p-2 rounded-2xl bg-indigo-950');
  grid.style.gridTemplateColumns = 'repeat(6, 1fr)';
  for (let y = 0; y < 6; y++) { M.cells[y] = []; for (let x = 0; x < 6; x++) {
    const q = (y < 3 ? 0 : 2) + (x < 3 ? 0 : 1);
    const cell = ctx.el('button', 'aspect-square rounded-md flex items-center justify-center ' + ((q % 2) === (q < 2 ? 1 : 0) ? 'bg-indigo-900/50' : 'bg-indigo-900/30'));
    cell.appendChild(ctx.el('div', '')); cell.onclick = () => place(ctx, x, y);
    M.cells[y][x] = cell; grid.appendChild(cell);
  } }
  wrap.appendChild(grid);
  // rotate controls
  M.rotWrap = ctx.el('div', 'hidden grid grid-cols-4 gap-2 mt-3');
  for (const { n, q } of QUAD) {
    const box = ctx.el('div', 'flex flex-col items-center gap-1');
    box.appendChild(ctx.el('span', 'text-[10px] text-slate-500', n));
    const row = ctx.el('div', 'flex gap-1');
    for (const dir of ['ccw', 'cw']) {
      const b = ctx.el('button', 'w-9 h-9 rounded-lg bg-slate-800 hover:bg-slate-700 text-lg font-bold', dir === 'cw' ? '↻' : '↺');
      b.onclick = () => rotate(ctx, q, dir);
      row.appendChild(b);
    }
    box.appendChild(row); M.rotWrap.appendChild(box);
  }
  wrap.appendChild(M.rotWrap);
  wrap.appendChild(ctx.el('p', 'text-center text-slate-500 text-xs mt-2',
    ctx.t('you_are', { x: `<span class="font-bold ${M.mine === 1 ? 'text-sky-400' : 'text-rose-400'}">●</span>` })));
  ctx.root.appendChild(wrap);
  paint(ctx);
}
function place(ctx, x, y) {
  if (!ctx.myTurn || M.phase !== 'place' || M.b[y][x]) return;
  M.pending = [x, y]; M.phase = 'rotate'; ctx.sound('place'); paint(ctx);
}
function finish(ctx, mine) {
  const w = pentagoWinner(M.b);
  if (w === 1 || w === 2) { const line = winLineCells(M.b, w); if (line.length) ctx.flashWin(line.map(([x, y]) => M.cells[y][x])); ctx.endGame(w === M.mine ? 'win' : 'lose'); return true; }
  if (w === 0) { ctx.endGame('draw'); return true; }
  return false;
}
function rotate(ctx, q, dir) {
  if (!ctx.myTurn || M.phase !== 'rotate' || !M.pending) return;
  const [x, y] = M.pending; M.b[y][x] = M.mine;
  M.b = pentagoRotate(M.b, q, dir);
  M.pending = null; M.phase = 'place'; ctx.sound('drop'); paint(ctx);
  ctx.send('turn', { cell: [x, y], q, dir });
  if (finish(ctx, true)) return;
  ctx.setTurn(false);
}

export default {
  id: 'pentago', name: 'Pentago', emoji: '🔵', blurb: 'Place, rotate, five in a row',
  start(ctx, { iAmFirst }) { M.b = fresh(); M.mine = iAmFirst ? 1 : 2; M.opp = iAmFirst ? 2 : 1; M.phase = 'place'; M.pending = null; build(ctx); },
  onTurn(mine, ctx) { if (mine) { M.phase = 'place'; M.pending = null; } paint(ctx); },
  onMessage(msg, ctx) {
    if (msg.type !== 'turn') return;
    M.b[msg.cell[1]][msg.cell[0]] = M.opp;
    M.b = pentagoRotate(M.b, msg.q, msg.dir);
    ctx.sound('drop'); paint(ctx);
    if (finish(ctx, false)) return;
    ctx.setTurn(true);
  },
  botMove(level) {
    const empties = [];
    for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) if (!M.b[y][x]) empties.push([x, y]);
    if (!empties.length) return null;
    const tryMove = (cell, q, dir) => { const b0 = M.b.map((r) => r.slice()); b0[cell[1]][cell[0]] = M.opp; const b1 = pentagoRotate(b0, q, dir); return b1; };
    // 1) immediate win, 2) block opponent's immediate win, else heuristic/random
    let block = null;
    for (const cell of empties) for (const { q } of QUAD) for (const dir of ['cw', 'ccw']) {
      const b1 = tryMove(cell, q, dir);
      if (pentagoWinner(b1) === M.opp) return { type: 'turn', cell, q, dir };
      if (!block) { const bo = M.b.map((r) => r.slice()); bo[cell[1]][cell[0]] = M.mine; const b2 = pentagoRotate(bo, q, dir); if (pentagoWinner(b2) === M.mine) block = { type: 'turn', cell, q, dir }; }
    }
    if (block && level !== 'easy') return block;
    const cell = empties[Math.floor(Math.random() * empties.length)];
    const q = Math.floor(Math.random() * 4), dir = Math.random() < 0.5 ? 'cw' : 'ccw';
    return { type: 'turn', cell, q, dir };
  },
  getState() { return { b: M.b, mine: M.mine, opp: M.opp }; },
  restore(state, ctx) { M.b = state.b; M.mine = state.mine; M.opp = state.opp; M.phase = 'place'; M.pending = null; build(ctx); },
};
