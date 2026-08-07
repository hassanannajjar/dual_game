import { loaMoves, loaWinner } from '../logic.js?v=48';

// Lines of Action. Player 1 (indigo) sits on the top & bottom edges, player 2 (amber) on the left & right edges.
// A piece moves exactly as many squares as there are pieces on that line; connect all your pieces into one group to win.
const M = { b: [], size: 8, mine: 1, opp: 2, sel: null, legal: [], last: null, cells: [], msgEl: null };

function fresh(n) {
  const b = Array.from({ length: n }, () => Array(n).fill(0));
  for (let x = 1; x < n - 1; x++) { b[0][x] = 1; b[n - 1][x] = 1; }
  for (let y = 1; y < n - 1; y++) { b[y][0] = 2; b[y][n - 1] = 2; }
  return b;
}
function groups(b, color) {
  const n = b.length, seen = new Set(); let g = 0;
  const key = (x, y) => y * n + x;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    if (b[y][x] !== color || seen.has(key(x, y))) continue;
    g++; const st = [[x, y]]; seen.add(key(x, y));
    while (st.length) { const [cx, cy] = st.pop();
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; const nx = cx + dx, ny = cy + dy; if (nx >= 0 && nx < n && ny >= 0 && ny < n && b[ny][nx] === color && !seen.has(key(nx, ny))) { seen.add(key(nx, ny)); st.push([nx, ny]); } }
    }
  }
  return g;
}
function pieceCls(v) {
  return v === 1 ? 'bg-indigo-500 shadow-[0_0_8px] shadow-indigo-500/50'
    : v === 2 ? 'bg-amber-400 shadow-[0_0_8px] shadow-amber-400/50' : '';
}
function paint(ctx) {
  const n = M.size, legalSet = new Set(M.legal.map(([x, y]) => x + ',' + y));
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const cell = M.cells[y][x], v = M.b[y][x], light = (x + y) % 2 === 0;
    cell.className = 'relative aspect-square flex items-center justify-center ' + (light ? 'bg-emerald-900/40' : 'bg-emerald-950/60');
    if (M.last && ((M.last.from[0] === x && M.last.from[1] === y) || (M.last.to[0] === x && M.last.to[1] === y))) cell.className += ' ring-2 ring-inset ring-sky-300/60';
    if (M.sel && M.sel[0] === x && M.sel[1] === y) cell.className += ' ring-4 ring-inset ring-sky-400';
    else if (legalSet.has(x + ',' + y)) cell.className += ' ring-4 ring-inset ring-sky-300/50';
    cell.firstChild.className = 'w-[70%] h-[70%] rounded-full transition-transform ' + pieceCls(v);
  }
  if (M.msgEl) M.msgEl.textContent = ctx.myTurn ? ctx.t('your_move') : ctx.t('opp_move');
}
function build(ctx) {
  M.cells = [];
  const wrap = ctx.el('div', 'mx-auto'); wrap.style.maxWidth = 'min(94vw, 30rem)';
  M.msgEl = ctx.el('p', 'text-center text-slate-400 text-sm mb-2'); wrap.appendChild(M.msgEl);
  const grid = ctx.el('div', 'grid gap-px bg-emerald-950/80 p-1 rounded-lg');
  grid.style.gridTemplateColumns = `repeat(${M.size}, 1fr)`;
  for (let y = 0; y < M.size; y++) { M.cells[y] = []; for (let x = 0; x < M.size; x++) {
    const cell = ctx.el('button', ''); cell.appendChild(ctx.el('div', '')); cell.onclick = () => click(ctx, x, y);
    M.cells[y][x] = cell; grid.appendChild(cell);
  } }
  wrap.appendChild(grid);
  wrap.appendChild(ctx.el('p', 'text-center text-slate-500 text-xs mt-2',
    ctx.t('you_are', { x: `<span class="font-bold ${M.mine === 1 ? 'text-indigo-400' : 'text-amber-400'}">●</span>` })));
  ctx.root.appendChild(wrap);
  paint(ctx);
}
function endIfWon(ctx) {
  const w = loaWinner(M.b);
  if (!w) return false;
  ctx.endGame(w === M.mine ? 'win' : 'lose');
  return true;
}
function apply(from, to) { M.b[to[1]][to[0]] = M.b[from[1]][from[0]]; M.b[from[1]][from[0]] = 0; M.last = { from, to }; }
function click(ctx, x, y) {
  if (!ctx.myTurn) return;
  if (M.sel && M.legal.some(([lx, ly]) => lx === x && ly === y)) {
    const from = M.sel, cap = !!M.b[y][x]; apply(from, [x, y]); M.sel = null; M.legal = [];
    ctx.sound(cap ? 'capture' : 'place'); paint(ctx); ctx.send('move', { from, to: [x, y] });
    if (endIfWon(ctx)) return; ctx.setTurn(false); return;
  }
  if (M.b[y][x] === M.mine) { M.sel = [x, y]; M.legal = loaMoves(M.b, x, y); ctx.sound('click'); paint(ctx); }
  else { M.sel = null; M.legal = []; paint(ctx); }
}

export default {
  id: 'loa', name: 'Lines of Action', emoji: '🟣', blurb: 'Connect all your pieces',
  options: [{ key: 'size', label: 'Board size', choices: [{ label: '6×6', value: 6 }, { label: '8×8', value: 8 }], default: 8 }],
  start(ctx, { iAmFirst }) {
    M.size = ctx.config.size === 6 ? 6 : 8; M.b = fresh(M.size);
    M.mine = iAmFirst ? 1 : 2; M.opp = iAmFirst ? 2 : 1; M.sel = null; M.legal = []; M.last = null;
    build(ctx);
  },
  onTurn(mine, ctx) { M.sel = null; M.legal = []; paint(ctx); },
  onMessage(msg, ctx) {
    if (msg.type !== 'move') return;
    const cap = !!M.b[msg.to[1]][msg.to[0]]; apply(msg.from, msg.to); ctx.sound(cap ? 'capture' : 'place'); paint(ctx);
    if (endIfWon(ctx)) return; ctx.setTurn(true);
  },
  botMove(level) {
    const n = M.size, p = M.opp, moves = [];
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (M.b[y][x] === p) for (const to of loaMoves(M.b, x, y)) moves.push({ from: [x, y], to });
    if (!moves.length) return null;
    if (level === 'easy') return Object.assign({ type: 'move' }, moves[Math.floor(Math.random() * moves.length)]);
    let best = moves[0], bs = 1e9;
    for (const m of moves) {
      const b0 = M.b.map((r) => r.slice()); const cap = b0[m.to[1]][m.to[0]] && b0[m.to[1]][m.to[0]] !== p;
      b0[m.to[1]][m.to[0]] = p; b0[m.from[1]][m.from[0]] = 0;
      if (loaWinner(b0) === p) return Object.assign({ type: 'move' }, m);   // winning move
      let s = groups(b0, p) - (cap ? 0.5 : 0) + (level === 'hard' ? 0 : Math.random());   // fewer groups = better
      if (s < bs) { bs = s; best = m; }
    }
    return Object.assign({ type: 'move' }, best);
  },
  getState() { return { b: M.b, size: M.size, mine: M.mine, opp: M.opp, last: M.last }; },
  restore(state, ctx) { M.b = state.b; M.size = state.size || state.b.length; M.mine = state.mine; M.opp = state.opp; M.last = state.last || null; M.sel = null; M.legal = []; build(ctx); },
};
