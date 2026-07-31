import { lineWinner } from '../logic.js?v=3';

const N = 13;
const M = { board: [], mine: 'B', opp: 'W', cells: [] };
const empty = () => Array.from({ length: N }, () => Array(N).fill(null));
const full = (b) => b.every((row) => row.every(Boolean));

function dotCls(v) {
  return 'w-[78%] h-[78%] rounded-full ' +
    (v === 'B' ? 'bg-slate-950 border border-slate-500'
      : v === 'W' ? 'bg-slate-100 border border-slate-400' : 'bg-transparent');
}
function paint() {
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) M.cells[y][x].firstChild.className = dotCls(M.board[y][x]);
}
function build(ctx) {
  M.cells = [];
  const wrap = ctx.el('div', 'mx-auto');
  wrap.style.maxWidth = 'min(94vw, 32rem)';
  wrap.appendChild(ctx.el('p', 'text-center text-slate-400 text-sm mb-2',
    ctx.t('you_are', { x: `<b>${M.mine === 'B' ? ctx.t('black') : ctx.t('white')}</b>` })));
  const grid = ctx.el('div', 'grid gap-px bg-amber-900/40 p-1 rounded-lg');
  grid.style.gridTemplateColumns = `repeat(${N}, 1fr)`;
  for (let y = 0; y < N; y++) {
    M.cells[y] = [];
    for (let x = 0; x < N; x++) {
      const cell = ctx.el('button', 'aspect-square bg-amber-700/30 flex items-center justify-center');
      cell.appendChild(ctx.el('i', dotCls(null)));
      cell.onclick = () => play(ctx, x, y);
      M.cells[y][x] = cell;
      grid.appendChild(cell);
    }
  }
  wrap.appendChild(grid);
  ctx.root.appendChild(wrap);
  paint();
}
function play(ctx, x, y) {
  if (!ctx.myTurn || M.board[y][x]) return;
  M.board[y][x] = M.mine; paint(); ctx.sound('place');
  ctx.send('move', { x, y });
  if (lineWinner(M.board, x, y, 5) === M.mine) return ctx.endGame('win');
  if (full(M.board)) return ctx.endGame('draw');
  ctx.setTurn(false);
}

export default {
  id: 'gomoku', name: 'Gomoku', emoji: '⚫', blurb: 'Five in a row',
  start(ctx, { iAmFirst }) {
    M.board = empty();
    M.mine = iAmFirst ? 'B' : 'W';
    M.opp = iAmFirst ? 'W' : 'B';
    build(ctx);
  },
  onMessage(msg, ctx) {
    if (msg.type !== 'move') return;
    M.board[msg.y][msg.x] = M.opp; paint(); ctx.sound('place');
    if (lineWinner(M.board, msg.x, msg.y, 5) === M.opp) return ctx.endGame('lose');
    if (full(M.board)) return ctx.endGame('draw');
    ctx.setTurn(true);
  },
  getState() { return { board: M.board, mine: M.mine, opp: M.opp }; },
  restore(state, ctx) { M.board = state.board; M.mine = state.mine; M.opp = state.opp; build(ctx); },
};
