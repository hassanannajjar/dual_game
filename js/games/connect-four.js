import { connectFourWinner } from '../logic.js?v=4';

const COLS = 7, ROWS = 6;
const M = { grid: [], mine: 'R', opp: 'Y', cellEls: [] };

function render(ctx) {
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS; r++) {
      const v = M.grid[c][r];
      const cell = M.cellEls[c][r];
      cell.className = 'rounded-full aspect-square ' +
        (v === 'R' ? 'bg-rose-500 shadow-[0_0_10px] shadow-rose-500/60'
          : v === 'Y' ? 'bg-yellow-400 shadow-[0_0_10px] shadow-yellow-400/60'
          : 'bg-slate-900');
    }
  }
}
function drop(c, color, ctx) {
  const row = M.grid[c].length;
  if (row >= ROWS) return { full: true };
  M.grid[c].push(color);
  render(ctx);
  const w = connectFourWinner(M.grid, c, row);
  const boardFull = M.grid.every((col) => col.length >= ROWS);
  return { row, winner: w, boardFull };
}

export default {
  id: 'connect4', name: 'Connect Four', emoji: '🔴', blurb: 'Four in a row',

  start(ctx, { iAmFirst }) {
    M.grid = Array.from({ length: COLS }, () => []);
    M.mine = iAmFirst ? 'R' : 'Y';
    M.opp = iAmFirst ? 'Y' : 'R';
    build(ctx);
  },

  onTurn() { /* clicks gated by ctx.myTurn */ },

  onMessage(msg, ctx) {
    if (msg.type !== 'drop') return;
    const res = drop(msg.c, M.opp, ctx);
    if (res.winner) ctx.endGame('lose');
    else if (res.boardFull) ctx.endGame('draw');
    else ctx.setTurn(true);
  },

  getState() { return { grid: M.grid, mine: M.mine, opp: M.opp }; },
  restore(state, ctx) { M.grid = state.grid; M.mine = state.mine; M.opp = state.opp; build(ctx); },
};

function build(ctx) {
    M.cellEls = [];
    const wrap = ctx.el('div', 'mx-auto', '');
    wrap.style.maxWidth = 'min(92vw, 30rem)';
    wrap.appendChild(ctx.el('p', 'text-center text-slate-400 text-sm mb-3',
      `You are <span class="font-bold ${M.mine === 'R' ? 'text-rose-400' : 'text-yellow-300'}">${M.mine === 'R' ? 'Red' : 'Yellow'}</span>`));
    const board = ctx.el('div', 'grid gap-1.5 p-2 rounded-2xl bg-indigo-950');
    board.style.gridTemplateColumns = `repeat(${COLS}, 1fr)`;
    for (let c = 0; c < COLS; c++) {
      const colEl = ctx.el('button', 'grid gap-1.5 rounded-lg hover:bg-white/5 transition');
      colEl.style.gridTemplateRows = `repeat(${ROWS}, 1fr)`;
      const cells = [];
      // visual top->bottom is row ROWS-1..0
      for (let vr = ROWS - 1; vr >= 0; vr--) {
        const cell = ctx.el('div', 'bg-slate-900 rounded-full aspect-square');
        colEl.appendChild(cell);
        cells[vr] = cell;
      }
      colEl.onclick = () => {
        if (!ctx.myTurn || M.grid[c].length >= ROWS) return;
        const res = drop(c, M.mine, ctx);
        if (res.full) return;
        ctx.send('drop', { c });
        if (res.winner) ctx.endGame('win');
        else if (res.boardFull) ctx.endGame('draw');
        else ctx.setTurn(false);
      };
      M.cellEls.push(cells);
      board.appendChild(colEl);
    }
    wrap.appendChild(board);
    ctx.root.appendChild(wrap);
    render(ctx);
}
