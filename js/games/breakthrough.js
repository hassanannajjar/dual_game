import { breakthroughMoves, breakthroughWinner } from '../logic.js?v=39';

// Player 1 (indigo) starts on the top two rows and races DOWN to the last row.
// Player 2 (rose) starts on the bottom two rows and races UP to row 0.
const M = { b: [], size: 8, mine: 1, opp: 2, sel: null, legal: [], last: null, cells: [], msgEl: null };

function freshBoard(n) {
  const b = Array.from({ length: n }, () => Array(n).fill(0));
  for (let x = 0; x < n; x++) { b[0][x] = 1; b[1][x] = 1; b[n - 1][x] = 2; b[n - 2][x] = 2; }
  return b;
}
function pieceCls(v) {
  return v === 1 ? 'bg-indigo-500 shadow-[0_0_8px] shadow-indigo-500/50'
    : v === 2 ? 'bg-rose-500 shadow-[0_0_8px] shadow-rose-500/50' : '';
}
function paint(ctx) {
  const n = M.size, legalSet = new Set(M.legal.map(([x, y]) => x + ',' + y));
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const cell = M.cells[y][x], v = M.b[y][x], light = (x + y) % 2 === 0;
    cell.className = 'relative aspect-square flex items-center justify-center ' + (light ? 'bg-amber-200/90' : 'bg-amber-700/80');
    if (M.last && ((M.last.from[0] === x && M.last.from[1] === y) || (M.last.to[0] === x && M.last.to[1] === y))) cell.className += ' ring-2 ring-inset ring-emerald-300/70';
    if (M.sel && M.sel[0] === x && M.sel[1] === y) cell.className += ' ring-4 ring-inset ring-emerald-400';
    else if (legalSet.has(x + ',' + y)) cell.className += ' ring-4 ring-inset ring-emerald-300/50';
    const dot = cell.firstChild;
    dot.className = 'w-[70%] h-[70%] rounded-full transition-transform ' + pieceCls(v);
  }
  if (M.msgEl) M.msgEl.textContent = ctx.myTurn ? ctx.t('your_move') : ctx.t('opp_move');
}
function build(ctx) {
  M.cells = [];
  const wrap = ctx.el('div', 'mx-auto'); wrap.style.maxWidth = 'min(94vw, 30rem)';
  M.msgEl = ctx.el('p', 'text-center text-slate-400 text-sm mb-2');
  wrap.appendChild(M.msgEl);
  const grid = ctx.el('div', 'grid gap-px bg-amber-950/60 p-1 rounded-lg');
  grid.style.gridTemplateColumns = `repeat(${M.size}, 1fr)`;
  for (let y = 0; y < M.size; y++) {
    M.cells[y] = [];
    for (let x = 0; x < M.size; x++) {
      const cell = ctx.el('button', ''); cell.appendChild(ctx.el('div', ''));
      cell.onclick = () => click(ctx, x, y);
      M.cells[y][x] = cell; grid.appendChild(cell);
    }
  }
  wrap.appendChild(grid);
  wrap.appendChild(ctx.el('p', 'text-center text-slate-500 text-xs mt-2',
    ctx.t('you_are', { x: `<span class="font-bold ${M.mine === 1 ? 'text-indigo-400' : 'text-rose-400'}">● ${M.mine === 1 ? ctx.t('bt_down') : ctx.t('bt_up')}</span>` })));
  ctx.root.appendChild(wrap);
  paint(ctx);
}
function applyMove(from, to) {
  M.b[to[1]][to[0]] = M.b[from[1]][from[0]];
  M.b[from[1]][from[0]] = 0;
  M.last = { from, to };
}
function winCellsFor(p) { const out = []; const n = M.size; for (let x = 0; x < n; x++) { if (p === 1 && M.b[n - 1][x] === 1) out.push(M.cells[n - 1][x]); if (p === 2 && M.b[0][x] === 2) out.push(M.cells[0][x]); } return out; }
function endIfWon(ctx, moverIsMe) {
  const w = breakthroughWinner(M.b);
  if (!w) return false;
  const cells = winCellsFor(w); if (cells.length) ctx.flashWin(cells);
  ctx.endGame(w === M.mine ? 'win' : 'lose');
  return true;
}
function click(ctx, x, y) {
  if (!ctx.myTurn) return;
  if (M.sel && M.legal.some(([lx, ly]) => lx === x && ly === y)) {
    const from = M.sel; applyMove(from, [x, y]); M.sel = null; M.legal = [];
    ctx.sound(M.b[y][x] ? 'capture' : 'place'); paint(ctx);
    ctx.send('move', { from, to: [x, y] });
    if (endIfWon(ctx, true)) return;
    ctx.setTurn(false);
    return;
  }
  if (M.b[y][x] === M.mine) { M.sel = [x, y]; M.legal = breakthroughMoves(M.b, x, y); ctx.sound('click'); paint(ctx); }
  else { M.sel = null; M.legal = []; paint(ctx); }
}

export default {
  id: 'breakthrough', name: 'Breakthrough', emoji: '♟️', blurb: 'Race a pawn to the far side',
  options: [{ key: 'size', label: 'Board size', choices: [{ label: '6×6', value: 6 }, { label: '8×8', value: 8 }], default: 8 }],
  start(ctx, { iAmFirst }) {
    M.size = ctx.config.size === 6 ? 6 : 8;
    M.b = freshBoard(M.size);
    M.mine = iAmFirst ? 1 : 2; M.opp = iAmFirst ? 2 : 1; M.sel = null; M.legal = []; M.last = null;
    build(ctx);
  },
  onTurn(mine, ctx) { M.sel = null; M.legal = []; paint(ctx); },
  onMessage(msg, ctx) {
    if (msg.type !== 'move') return;
    const cap = !!M.b[msg.to[1]][msg.to[0]];
    applyMove(msg.from, msg.to); ctx.sound(cap ? 'capture' : 'place'); paint(ctx);
    if (endIfWon(ctx, false)) return;
    ctx.setTurn(true);
  },
  botMove(level) {
    const n = M.size, p = M.opp, dir = p === 1 ? 1 : -1, goal = p === 1 ? n - 1 : 0, moves = [];
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (M.b[y][x] === p) for (const [tx, ty] of breakthroughMoves(M.b, x, y)) moves.push({ from: [x, y], to: [tx, ty] });
    if (!moves.length) return null;
    const score = (m) => {
      let s = 0; const [fx, fy] = m.from, [tx, ty] = m.to;
      if (M.b[ty][tx] && M.b[ty][tx] !== p) s += 50;                 // capture
      if (ty === goal) s += 1000;                                    // winning move
      s += (p === 1 ? ty : n - 1 - ty) * 4;                          // advancement
      // penalize landing where an enemy can immediately capture (straight-diagonal threat)
      const ey = ty - dir;
      if (ey >= 0 && ey < n) { for (const ex of [tx - 1, tx + 1]) if (ex >= 0 && ex < n && M.b[ey][ex] && M.b[ey][ex] !== p) { s -= 20; break; } }
      return s;
    };
    if (level === 'easy') return Object.assign({ type: 'move' }, moves[Math.floor(Math.random() * moves.length)]);
    let best = moves[0], bs = -1e9;
    for (const m of moves) { const s = score(m) + (level === 'hard' ? 0 : Math.random() * 6); if (s > bs) { bs = s; best = m; } }
    return Object.assign({ type: 'move' }, best);
  },
  getState() { return { b: M.b, size: M.size, mine: M.mine, opp: M.opp, last: M.last }; },
  restore(state, ctx) { M.b = state.b; M.size = state.size || state.b.length; M.mine = state.mine; M.opp = state.opp; M.last = state.last || null; M.sel = null; M.legal = []; build(ctx); },
};
