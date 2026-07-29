import { ticTacToeWinner } from '../logic.js?v=1';

const M = { cells: [], mine: 'X', opp: 'O', btns: [] };

function render(ctx) {
  for (let i = 0; i < 9; i++) {
    const v = M.cells[i];
    const b = M.btns[i];
    b.textContent = v || '';
    b.className = 'aspect-square rounded-xl bg-slate-800 border border-slate-700 text-5xl font-black flex ' +
      'items-center justify-center transition ' +
      (v === 'X' ? 'text-indigo-400' : v === 'O' ? 'text-amber-400' : 'text-transparent') +
      (!v && ctx.myTurn ? ' hover:border-indigo-500 cursor-pointer' : '');
  }
}
function place(i, mark, ctx) {
  M.cells[i] = mark;
  render(ctx);
  const w = ticTacToeWinner(M.cells);
  if (w === 'draw') { ctx.endGame('draw'); return true; }
  if (w) { ctx.endGame(w === M.mine ? 'win' : 'lose'); return true; }
  return false;
}

function build(ctx) {
  M.btns = [];
  const wrap = ctx.el('div', 'max-w-xs mx-auto');
  wrap.appendChild(ctx.el('p', 'text-center text-slate-400 text-sm mb-3',
    `You are <span class="font-bold ${M.mine === 'X' ? 'text-indigo-400' : 'text-amber-400'}">${M.mine}</span>`));
  const grid = ctx.el('div', 'grid grid-cols-3 gap-2');
  for (let i = 0; i < 9; i++) {
    const b = ctx.el('button', '');
    b.onclick = () => {
      if (!ctx.myTurn || M.cells[i]) return;
      const ended = place(i, M.mine, ctx);
      ctx.send('move', { i });
      if (!ended) ctx.setTurn(false);
    };
    M.btns.push(b);
    grid.appendChild(b);
  }
  wrap.appendChild(grid);
  ctx.root.appendChild(wrap);
  render(ctx);
}

export default {
  id: 'ttt', name: 'Tic-Tac-Toe', emoji: '⭕', blurb: 'Three in a row',

  start(ctx, { iAmFirst }) {
    M.cells = Array(9).fill(null);
    M.mine = iAmFirst ? 'X' : 'O';
    M.opp = iAmFirst ? 'O' : 'X';
    build(ctx);
  },

  onTurn(mine, ctx) { render(ctx); },

  onMessage(msg, ctx) {
    if (msg.type !== 'move') return;
    const ended = place(msg.i, M.opp, ctx);
    if (!ended) ctx.setTurn(true);
  },

  getState() { return { cells: M.cells, mine: M.mine, opp: M.opp }; },
  restore(state, ctx) { M.cells = state.cells; M.mine = state.mine; M.opp = state.opp; build(ctx); },
};
