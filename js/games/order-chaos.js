import { lineWinner } from '../logic.js?v=45';

const N = 6;
const M = { board: [], role: 'order', sym: 'X', cells: [], symBtns: {}, roleEl: null };
const full = (b) => b.every((row) => row.every(Boolean));

function paint(ctx) {
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const v = M.board[y][x];
    const c = M.cells[y][x];
    c.textContent = v || '';
    c.className = 'aspect-square rounded-lg bg-slate-800 flex items-center justify-center text-2xl font-black ' +
      (v === 'X' ? 'text-indigo-400' : v === 'O' ? 'text-amber-400' : (ctx.myTurn ? 'hover:bg-slate-700' : ''));
  }
  for (const s of ['X', 'O']) M.symBtns[s].className = 'px-4 py-2 rounded-lg font-black text-lg ' + (M.sym === s ? 'bg-indigo-600' : 'bg-slate-700');
}
function build(ctx) {
  M.cells = []; M.symBtns = {};
  const wrap = ctx.el('div', 'mx-auto');
  wrap.style.maxWidth = 'min(92vw, 26rem)';
  M.roleEl = ctx.el('p', 'text-center text-slate-400 text-sm mb-2',
    M.role === 'order' ? '<b class="text-emerald-400">Order</b> — make 5 in a row' : '<b class="text-rose-400">Chaos</b> — stop 5 in a row');
  wrap.appendChild(M.roleEl);
  const grid = ctx.el('div', 'grid gap-1.5 mb-3');
  grid.style.gridTemplateColumns = `repeat(${N}, 1fr)`;
  for (let y = 0; y < N; y++) { M.cells[y] = []; for (let x = 0; x < N; x++) { const c = ctx.el('button', ''); c.onclick = () => play(ctx, x, y); M.cells[y][x] = c; grid.appendChild(c); } }
  wrap.appendChild(grid);
  const sel = ctx.el('div', 'flex items-center justify-center gap-3');
  sel.appendChild(ctx.el('span', 'text-sm text-slate-400', 'Place:'));
  for (const s of ['X', 'O']) { const b = ctx.el('button', '', s); b.onclick = () => { M.sym = s; paint(ctx); }; M.symBtns[s] = b; sel.appendChild(b); }
  wrap.appendChild(sel);
  ctx.root.appendChild(wrap);
  paint(ctx);
}
function play(ctx, x, y) {
  if (!ctx.myTurn || M.board[y][x]) return;
  M.board[y][x] = M.sym; ctx.sound('place'); paint(ctx);
  ctx.send('move', { x, y, sym: M.sym });
  if (lineWinner(M.board, x, y, 5)) return ctx.endGame(M.role === 'order' ? 'win' : 'lose');
  if (full(M.board)) return ctx.endGame(M.role === 'chaos' ? 'win' : 'lose');
  ctx.setTurn(false);
}

export default {
  id: 'order', name: 'Order & Chaos', emoji: '🔠', blurb: 'Make or break five', category: 'strategy', difficulty: 'medium',
  start(ctx, { iAmFirst }) {
    M.board = Array.from({ length: N }, () => Array(N).fill(null));
    M.role = iAmFirst ? 'order' : 'chaos'; M.sym = 'X';
    build(ctx);
  },
  onTurn(mine, ctx) { paint(ctx); },
  onMessage(msg, ctx) {
    if (msg.type !== 'move') return;
    M.board[msg.y][msg.x] = msg.sym; ctx.sound('place'); paint(ctx);
    if (lineWinner(M.board, msg.x, msg.y, 5)) return ctx.endGame(M.role === 'order' ? 'win' : 'lose');
    if (full(M.board)) return ctx.endGame(M.role === 'chaos' ? 'win' : 'lose');
    ctx.setTurn(true);
  },
  botMove(level) {
    const botRole = M.role === 'order' ? 'chaos' : 'order';
    const empties = [];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (!M.board[y][x]) empties.push([x, y]);
    if (!empties.length) return null;
    const makes5 = (x, y, s) => { M.board[y][x] = s; const w = !!lineWinner(M.board, x, y, 5); M.board[y][x] = null; return w; };
    if (level !== 'easy') {
      if (botRole === 'order') { for (const [x, y] of empties) for (const s of ['X', 'O']) if (makes5(x, y, s)) return { type: 'move', x, y, sym: s }; }
      else { for (const [x, y] of empties) for (const s of ['X', 'O']) if (makes5(x, y, s)) { const o = s === 'X' ? 'O' : 'X'; if (!makes5(x, y, o)) return { type: 'move', x, y, sym: o }; } }
    }
    const [x, y] = empties[Math.floor(Math.random() * empties.length)];
    let sym = Math.random() < 0.5 ? 'X' : 'O';
    if (botRole === 'chaos' && makes5(x, y, sym)) sym = sym === 'X' ? 'O' : 'X';
    return { type: 'move', x, y, sym };
  },
  getState() { return { board: M.board, role: M.role, sym: M.sym }; },
  restore(state, ctx) { M.board = state.board; M.role = state.role; M.sym = state.sym; build(ctx); },
};
