import { hexConnected } from '../logic.js?v=8';

const N = 11;
const M = { board: [], mine: 'r', opp: 'b', cells: [] };
const empty = () => Array.from({ length: N }, () => Array(N).fill(null));

function paint() {
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const v = M.board[y][x];
    M.cells[y][x].className = 'w-6 h-6 rounded-full shrink-0 ' +
      (v === 'r' ? 'bg-rose-500' : v === 'b' ? 'bg-sky-400' : 'bg-slate-700 hover:bg-slate-500');
  }
}
function build(ctx) {
  M.cells = [];
  const wrap = ctx.el('div', 'mx-auto overflow-auto');
  wrap.style.maxWidth = '96vw';
  wrap.appendChild(ctx.el('p', 'text-center text-slate-400 text-sm mb-2',
    ctx.t('you_are', { x: `<b class="${M.mine === 'r' ? 'text-rose-400' : 'text-sky-400'}">${M.mine === 'r' ? 'Red (top–bottom)' : 'Blue (left–right)'}</b>` })));
  const board = ctx.el('div', 'inline-block p-2 rounded-xl bg-slate-900');
  for (let y = 0; y < N; y++) {
    const row = ctx.el('div', 'flex gap-1 mb-1');
    row.style.marginInlineStart = (y * 0.85) + 'rem';
    M.cells[y] = [];
    for (let x = 0; x < N; x++) {
      const c = ctx.el('button', '');
      c.onclick = () => play(ctx, x, y);
      M.cells[y][x] = c;
      row.appendChild(c);
    }
    board.appendChild(row);
  }
  wrap.appendChild(board);
  ctx.root.appendChild(wrap);
  paint();
}
function play(ctx, x, y) {
  if (!ctx.myTurn || M.board[y][x]) return;
  M.board[y][x] = M.mine; ctx.sound('place'); paint();
  ctx.send('move', { x, y });
  if (hexConnected(M.board, M.mine)) return ctx.endGame('win');
  ctx.setTurn(false);
}

export default {
  id: 'hex', name: 'Hex', emoji: '⬡', blurb: 'Bridge your sides',
  start(ctx, { iAmFirst }) { M.board = empty(); M.mine = iAmFirst ? 'r' : 'b'; M.opp = iAmFirst ? 'b' : 'r'; build(ctx); },
  onMessage(msg, ctx) {
    if (msg.type !== 'move') return;
    M.board[msg.y][msg.x] = M.opp; ctx.sound('place'); paint();
    if (hexConnected(M.board, M.opp)) return ctx.endGame('lose');
    ctx.setTurn(true);
  },
  getState() { return { board: M.board, mine: M.mine, opp: M.opp }; },
  restore(state, ctx) { M.board = state.board; M.mine = state.mine; M.opp = state.opp; build(ctx); },
};
