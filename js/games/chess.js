import { chessInitial, chessLegalMoves, chessApply, chessStatus, chessInCheck } from '../logic.js?v=10';

const SOLID = { K: '♚', Q: '♛', R: '♜', B: '♝', N: '♞', P: '♟' };
const M = { state: null, mine: 'w', sel: null, legal: [], promo: null, cells: {}, promoEl: null, msgEl: null };
const isWhite = (p) => p && p === p.toUpperCase();
const key = (x, y) => x + ',' + y;
function kingPos(board, color) { const k = color === 'w' ? 'K' : 'k'; for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if (board[y][x] === k) return [x, y]; return null; }

function paint(ctx) {
  const st = M.state, chk = chessInCheck(st, st.turn);
  const kp = chk ? kingPos(st.board, st.turn) : null;
  const legalSet = new Set(M.legal.map(([x, y]) => key(x, y)));
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    const cell = M.cells[key(x, y)], p = st.board[y][x], light = (x + y) % 2 === 0;
    cell.textContent = p ? SOLID[p.toUpperCase()] : '';
    let cls = 'aspect-square flex items-center justify-center text-3xl leading-none select-none ' + (light ? 'bg-amber-200' : 'bg-amber-700');
    cls += p ? (isWhite(p) ? ' text-slate-50' : ' text-slate-900') : '';
    if (M.sel && M.sel[0] === x && M.sel[1] === y) cls += ' ring-4 ring-emerald-400 ring-inset';
    else if (legalSet.has(key(x, y))) cls += ' ring-4 ring-emerald-400/50 ring-inset';
    if (kp && kp[0] === x && kp[1] === y) cls += ' bg-rose-500';
    cell.className = cls;
  }
  M.msgEl.textContent = st.turn === M.mine ? (chk ? 'Check! Your move' : 'Your move') : 'Opponent thinking…';
}
function build(ctx) {
  M.cells = {};
  const wrap = ctx.el('div', 'mx-auto');
  wrap.style.maxWidth = 'min(94vw, 30rem)';
  M.msgEl = ctx.el('p', 'text-center text-slate-400 text-sm mb-2');
  wrap.appendChild(M.msgEl);
  const grid = ctx.el('div', 'grid rounded-lg overflow-hidden');
  grid.style.gridTemplateColumns = 'repeat(8, 1fr)';
  for (let d = 0; d < 64; d++) {
    const dr = Math.floor(d / 8), dc = d % 8;
    const x = M.mine === 'w' ? dc : 7 - dc, y = M.mine === 'w' ? dr : 7 - dr;
    const cell = ctx.el('button', '');
    cell.onclick = () => click(ctx, x, y);
    M.cells[key(x, y)] = cell;
    grid.appendChild(cell);
  }
  wrap.appendChild(grid);
  M.promoEl = ctx.el('div', 'hidden justify-center gap-2 mt-3');
  for (const pc of ['Q', 'R', 'B', 'N']) {
    const b = ctx.el('button', 'w-12 h-12 rounded-lg bg-slate-800 hover:bg-slate-700 text-3xl ' + (M.mine === 'w' ? 'text-slate-50' : 'text-slate-900'), SOLID[pc]);
    b.onclick = () => { if (M.promo) { const { from, to } = M.promo; M.promo = null; M.promoEl.classList.add('hidden'); doMove(ctx, from, to, pc); } };
    M.promoEl.appendChild(b);
  }
  wrap.appendChild(M.promoEl);
  ctx.root.appendChild(wrap);
  paint(ctx);
}
function afterMove(ctx, mineMoved) {
  paint(ctx);
  const st = chessStatus(M.state);
  if (st === 'checkmate') return ctx.endGame(mineMoved ? 'win' : 'lose', 'Checkmate');
  if (st === 'stalemate') return ctx.endGame('draw', 'Stalemate');
  if (st === 'check') ctx.sound('capture');
  ctx.setTurn(!mineMoved ? true : false);
}
function doMove(ctx, from, to, promo) {
  const captured = M.state.board[to[1]][to[0]];
  M.state = chessApply(M.state, from, to, promo);
  M.sel = null; M.legal = [];
  ctx.sound(captured ? 'capture' : 'place');
  ctx.send('move', { from, to, promo: promo || null });
  afterMove(ctx, true);
}
function click(ctx, x, y) {
  if (!ctx.myTurn || M.state.turn !== M.mine || M.promo) return;
  if (M.sel && M.legal.some(([lx, ly]) => lx === x && ly === y)) {
    const p = M.state.board[M.sel[1]][M.sel[0]];
    if (p.toUpperCase() === 'P' && (y === 0 || y === 7)) { M.promo = { from: M.sel, to: [x, y] }; M.promoEl.classList.remove('hidden'); return; }
    return doMove(ctx, M.sel, [x, y]);
  }
  const p = M.state.board[y][x];
  if (p && (isWhite(p) ? 'w' : 'b') === M.mine) { M.sel = [x, y]; M.legal = chessLegalMoves(M.state, [x, y]); paint(ctx); }
  else { M.sel = null; M.legal = []; paint(ctx); }
}

export default {
  id: 'chess', name: 'Chess', emoji: '♞', blurb: 'The classic duel', category: 'strategy', difficulty: 'hard',
  start(ctx, { iAmFirst }) {
    M.state = chessInitial();
    M.mine = iAmFirst ? 'w' : 'b'; M.sel = null; M.legal = []; M.promo = null;
    build(ctx);
  },
  onTurn(mine, ctx) { M.sel = null; M.legal = []; paint(ctx); },
  onMessage(msg, ctx) {
    if (msg.type !== 'move') return;
    const captured = M.state.board[msg.to[1]][msg.to[0]];
    M.state = chessApply(M.state, msg.from, msg.to, msg.promo);
    ctx.sound(captured ? 'capture' : 'place');
    afterMove(ctx, false);
  },
  getState() { return { state: M.state, mine: M.mine }; },
  restore(state, ctx) { M.state = state.state; M.mine = state.mine; M.sel = null; M.legal = []; M.promo = null; build(ctx); },
};
