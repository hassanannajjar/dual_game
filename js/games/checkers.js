import { checkerMoves, checkerHasMove } from '../logic.js?v=3';

const M = { board: [], mine: 'b', opp: 'r', cells: [], sel: null, dests: [], mustCont: null };

function startBoard() {
  const b = Array.from({ length: 8 }, () => Array(8).fill(null));
  for (let y = 0; y < 3; y++) for (let x = 0; x < 8; x++) if ((x + y) % 2 === 1) b[y][x] = 'r';
  for (let y = 5; y < 8; y++) for (let x = 0; x < 8; x++) if ((x + y) % 2 === 1) b[y][x] = 'b';
  return b;
}
const count = (me) => M.board.flat().filter((p) => p && p.toLowerCase() === me).length;
const hasMove = (me) => checkerHasMove(M.board, me);
function anyJumps(me) {
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++)
    if (M.board[y][x] && M.board[y][x].toLowerCase() === me && checkerMoves(M.board, x, y).jumps.length) return true;
  return false;
}

function paint(ctx) {
  const destSet = new Set(M.dests.map((d) => d.to[1] * 8 + d.to[0]));
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    const cell = M.cells[y][x];
    const dark = (x + y) % 2 === 1;
    const sel = M.sel && M.sel[0] === x && M.sel[1] === y;
    cell.className = 'aspect-square flex items-center justify-center ' +
      (dark ? 'bg-amber-950' : 'bg-amber-200/10') + (sel ? ' ring-2 ring-emerald-400' : '');
    const p = M.board[y][x];
    const dot = cell.firstChild;
    dot.textContent = (p === 'R' || p === 'B') ? '♔' : '';
    dot.className = 'w-[76%] h-[76%] rounded-full flex items-center justify-center text-sm font-bold ' +
      (!p ? (destSet.has(y * 8 + x) ? 'bg-emerald-400/40' : 'bg-transparent')
        : p.toLowerCase() === 'r' ? 'bg-rose-500 text-rose-950' : 'bg-sky-400 text-sky-950');
  }
}
function build(ctx) {
  M.cells = [];
  const wrap = ctx.el('div', 'mx-auto');
  wrap.style.maxWidth = 'min(92vw, 28rem)';
  wrap.appendChild(ctx.el('p', 'text-center text-slate-400 text-sm mb-2',
    ctx.t('you_are', { x: `<b class="${M.mine === 'r' ? 'text-rose-400' : 'text-sky-400'}">${M.mine === 'r' ? 'Red' : 'Blue'}</b>` })));
  const grid = ctx.el('div', 'grid rounded-lg overflow-hidden');
  grid.style.gridTemplateColumns = 'repeat(8, 1fr)';
  for (let y = 0; y < 8; y++) {
    M.cells[y] = [];
    for (let x = 0; x < 8; x++) {
      const cell = ctx.el('button', '');
      cell.appendChild(ctx.el('span', ''));
      cell.onclick = () => click(ctx, x, y);
      M.cells[y][x] = cell;
      grid.appendChild(cell);
    }
  }
  wrap.appendChild(grid);
  ctx.root.appendChild(wrap);
  paint(ctx);
}
function selectPiece(ctx, x, y) {
  const { steps, jumps } = checkerMoves(M.board, x, y);
  const forced = anyJumps(M.mine) || M.mustCont;
  M.sel = [x, y];
  const jd = jumps.map((j) => ({ to: j.to, jump: true, cap: j.cap }));
  M.dests = forced ? jd : [...jd, ...steps.map((s) => ({ to: s, jump: false }))];
  paint(ctx);
}
function click(ctx, x, y) {
  if (!ctx.myTurn) return;
  if (M.sel) {
    const d = M.dests.find((d) => d.to[0] === x && d.to[1] === y);
    if (d) return doMove(ctx, d);
  }
  if (M.mustCont) { if (x === M.mustCont[0] && y === M.mustCont[1]) selectPiece(ctx, x, y); return; }
  const p = M.board[y][x];
  if (p && p.toLowerCase() === M.mine) selectPiece(ctx, x, y);
}
function applyMove(from, to, jump, cap, king) {
  const [fx, fy] = from, [tx, ty] = to;
  let p = M.board[fy][fx];
  M.board[fy][fx] = null;
  if (jump && cap) M.board[cap[1]][cap[0]] = null;
  if (king) p = p.toUpperCase();
  M.board[ty][tx] = p;
}
function doMove(ctx, d) {
  const [fx, fy] = M.sel, [tx, ty] = d.to;
  const piece = M.board[fy][fx];
  const king = (piece === 'r' && ty === 7) || (piece === 'b' && ty === 0);
  applyMove([fx, fy], [tx, ty], d.jump, d.cap, king);
  ctx.sound(d.jump ? 'capture' : 'place');
  const cont = d.jump && !king && checkerMoves(M.board, tx, ty).jumps.length > 0;
  ctx.send('move', { from: [fx, fy], to: [tx, ty], jump: d.jump, cap: d.cap || null, king, done: !cont });
  if (cont) { M.mustCont = [tx, ty]; selectPiece(ctx, tx, ty); return; }
  M.sel = null; M.dests = []; M.mustCont = null; paint(ctx);
  if (!count(M.opp) || !hasMove(M.opp)) return ctx.endGame('win');
  ctx.setTurn(false);
}

export default {
  id: 'checkers', name: 'Checkers', emoji: '🔴', blurb: 'Jump and king',
  start(ctx, { iAmFirst }) {
    M.board = startBoard();
    M.mine = iAmFirst ? 'b' : 'r';
    M.opp = iAmFirst ? 'r' : 'b';
    M.sel = null; M.dests = []; M.mustCont = null;
    build(ctx);
  },
  onTurn(mine, ctx) { M.sel = null; M.dests = []; M.mustCont = null; paint(ctx); },
  onMessage(msg, ctx) {
    if (msg.type !== 'move') return;
    applyMove(msg.from, msg.to, msg.jump, msg.cap, msg.king);
    ctx.sound(msg.jump ? 'capture' : 'place'); paint(ctx);
    if (msg.done) {
      if (!count(M.mine) || !hasMove(M.mine)) return ctx.endGame('lose');
      ctx.setTurn(true);
    }
  },
  getState() { return { board: M.board, mine: M.mine, opp: M.opp }; },
  restore(state, ctx) { M.board = state.board; M.mine = state.mine; M.opp = state.opp; M.sel = null; M.dests = []; M.mustCont = null; build(ctx); },
};
