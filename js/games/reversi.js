import { reversiFlips, reversiLegalMoves, reversiCounts } from '../logic.js?v=26';

const M = { board: [], mine: 'B', opp: 'B', cells: [], scoreEl: null };
function start() {
  const b = Array.from({ length: 8 }, () => Array(8).fill(null));
  b[3][3] = 'W'; b[3][4] = 'B'; b[4][3] = 'B'; b[4][4] = 'W';
  return b;
}
function discCls(v, hint) {
  if (v) return 'w-[80%] h-[80%] rounded-full ' + (v === 'B' ? 'bg-slate-950' : 'bg-slate-100');
  return hint ? 'w-3 h-3 rounded-full bg-white/20' : 'hidden';
}
function paint(ctx) {
  const legal = ctx.myTurn ? reversiLegalMoves(M.board, M.mine) : [];
  const legalSet = new Set(legal.map(([x, y]) => y * 8 + x));
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    M.cells[y][x].firstChild.className = discCls(M.board[y][x], legalSet.has(y * 8 + x));
  }
  const c = reversiCounts(M.board);
  const mineN = M.mine === 'B' ? c.B : c.W, oppN = M.mine === 'B' ? c.W : c.B;
  M.scoreEl.innerHTML = `<span class="text-emerald-400">${mineN}</span> — <span class="text-amber-400">${oppN}</span>`;
}
function build(ctx) {
  M.cells = [];
  const wrap = ctx.el('div', 'mx-auto');
  wrap.style.maxWidth = 'min(92vw, 28rem)';
  M.scoreEl = ctx.el('div', 'text-center text-2xl font-black mb-2');
  wrap.appendChild(M.scoreEl);
  const grid = ctx.el('div', 'grid gap-1 p-2 rounded-xl bg-emerald-900');
  grid.style.gridTemplateColumns = 'repeat(8, 1fr)';
  for (let y = 0; y < 8; y++) {
    M.cells[y] = [];
    for (let x = 0; x < 8; x++) {
      const cell = ctx.el('button', 'aspect-square rounded bg-emerald-700 flex items-center justify-center');
      cell.appendChild(ctx.el('i', 'hidden'));
      cell.onclick = () => play(ctx, x, y);
      M.cells[y][x] = cell;
      grid.appendChild(cell);
    }
  }
  wrap.appendChild(grid);
  ctx.root.appendChild(wrap);
  paint(ctx);
}
function apply(x, y, player) {
  const flips = reversiFlips(M.board, x, y, player);
  if (!flips.length) return false;
  M.board[y][x] = player;
  for (const [fx, fy] of flips) M.board[fy][fx] = player;
  return true;
}
function finish(ctx) {
  const c = reversiCounts(M.board);
  const mineN = M.mine === 'B' ? c.B : c.W, oppN = M.mine === 'B' ? c.W : c.B;
  ctx.endGame(mineN > oppN ? 'win' : mineN < oppN ? 'lose' : 'draw', `${mineN}–${oppN}`);
}
function afterMove(ctx, moverWasMine) {
  const iCan = reversiLegalMoves(M.board, M.mine).length > 0;
  const oppCan = reversiLegalMoves(M.board, M.opp).length > 0;
  if (!iCan && !oppCan) return finish(ctx);
  if (moverWasMine) { if (oppCan) ctx.setTurn(false); else { ctx.toast('Opponent passes'); ctx.setTurn(true); } }
  else { if (iCan) ctx.setTurn(true); else { ctx.toast('You pass'); ctx.setTurn(false); } }
}
function play(ctx, x, y) {
  if (!ctx.myTurn || !apply(x, y, M.mine)) return;
  ctx.sound('flip'); paint(ctx);
  ctx.send('move', { x, y });
  afterMove(ctx, true);
}

export default {
  id: 'reversi', name: 'Reversi', emoji: '⚪', blurb: 'Flip to win',
  start(ctx, { iAmFirst }) {
    M.board = start();
    M.mine = iAmFirst ? 'B' : 'W';
    M.opp = iAmFirst ? 'W' : 'B';
    build(ctx);
  },
  onTurn(mine, ctx) { paint(ctx); },
  onMessage(msg, ctx) {
    if (msg.type !== 'move') return;
    apply(msg.x, msg.y, M.opp); ctx.sound('flip'); paint(ctx);
    afterMove(ctx, false);
  },
  botMove(level) {
    const legal = reversiLegalMoves(M.board, M.opp);
    if (!legal.length) return null;
    if (level === 'easy') { const [x, y] = legal[Math.floor(Math.random() * legal.length)]; return { type: 'move', x, y }; }
    const corner = (x, y) => (x === 0 || x === 7) && (y === 0 || y === 7);
    const nearCorner = (x, y) => (x <= 1 || x >= 6) && (y <= 1 || y >= 6) && !corner(x, y);
    const edge = (x, y) => x === 0 || x === 7 || y === 0 || y === 7;
    let best = null, bestScore = -1e9;
    for (const [x, y] of legal) {
      const flips = reversiFlips(M.board, x, y, M.opp).length;
      let w = flips;
      if (level === 'hard') { w = flips; if (corner(x, y)) w += 100; else if (nearCorner(x, y)) w -= 40; else if (edge(x, y)) w += 8; }
      if (w > bestScore) { bestScore = w; best = [x, y]; }
    }
    return { type: 'move', x: best[0], y: best[1] };
  },
  getState() { return { board: M.board, mine: M.mine, opp: M.opp }; },
  restore(state, ctx) { M.board = state.board; M.mine = state.mine; M.opp = state.opp; build(ctx); },
};
