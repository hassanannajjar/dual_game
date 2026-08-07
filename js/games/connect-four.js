import { connectFourWinner } from '../logic.js?v=42';

let COLS = 7, ROWS = 6;
const M = { grid: [], mine: 'R', opp: 'Y', cellEls: [], lastMove: null };

function render(ctx) {
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS; r++) {
      const v = M.grid[c][r];
      const cell = M.cellEls[c][r];
      cell.className = 'rounded-full aspect-square ' +
        (v === 'R' ? 'bg-rose-500 shadow-[0_0_10px] shadow-rose-500/60'
          : v === 'Y' ? 'bg-yellow-400 shadow-[0_0_10px] shadow-yellow-400/60'
          : 'bg-slate-900');
      if (v && M.lastMove && M.lastMove[0] === c && M.lastMove[1] === r) cell.className += ' ring-2 ring-white/80';   // last-move marker
    }
  }
}
function winCells(col, row) {
  const player = M.grid[col][row];
  for (const [dc, dr] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
    const line = [[col, row]];
    for (const sign of [1, -1]) { let c = col + dc * sign, r = row + dr * sign; while (c >= 0 && c < COLS && r >= 0 && r < ROWS && M.grid[c][r] === player) { line.push([c, r]); c += dc * sign; r += dr * sign; } }
    if (line.length >= 4) return line;
  }
  return [];
}
function highlightWin(ctx, c, row) { ctx.flashWin(winCells(c, row).map(([cx, cy]) => M.cellEls[cx][cy])); }
function drop(c, color, ctx) {
  const row = M.grid[c].length;
  if (row >= ROWS) return { full: true };
  M.grid[c].push(color);
  M.lastMove = [c, row];
  render(ctx);
  const cell = M.cellEls[c] && M.cellEls[c][row];
  if (cell) { cell.classList.add('disc-drop'); setTimeout(() => cell.classList.remove('disc-drop'), 420); }
  const w = connectFourWinner(M.grid, c, row, ROWS);
  const boardFull = M.grid.every((col) => col.length >= ROWS);
  return { row, winner: w, boardFull };
}

export default {
  id: 'connect4', name: 'Connect Four', emoji: '🔴', blurb: 'Four in a row',
  options: [
    { key: 'c4size', label: 'Board size', choices: [{ label: '7×6', value: '7x6' }, { label: '9×7', value: '9x7' }], default: '7x6' },
  ],

  start(ctx, { iAmFirst }) {
    const [c, r] = (ctx.config.c4size || '7x6').split('x').map(Number);
    COLS = c || 7; ROWS = r || 6;
    M.grid = Array.from({ length: COLS }, () => []);
    M.mine = iAmFirst ? 'R' : 'Y';
    M.opp = iAmFirst ? 'Y' : 'R';
    build(ctx);
  },

  onTurn() { /* clicks gated by ctx.myTurn */ },

  onMessage(msg, ctx) {
    if (msg.type !== 'drop') return;
    const res = drop(msg.c, M.opp, ctx);
    if (res.winner) { highlightWin(ctx, msg.c, res.row); ctx.endGame('lose'); }
    else if (res.boardFull) ctx.endGame('draw');
    else ctx.setTurn(true);
  },

  botMove(level) {
    const valid = [];
    for (let c = 0; c < COLS; c++) if (M.grid[c].length < ROWS) valid.push(c);
    if (!valid.length) return null;
    const winsAt = (c, color) => { const row = M.grid[c].length; if (row >= ROWS) return false; M.grid[c].push(color); const w = connectFourWinner(M.grid, c, row, ROWS) === color; M.grid[c].pop(); return w; };
    const center = (cols) => cols.slice().sort((a, b) => Math.abs(a - 3) - Math.abs(b - 3))[0];
    let c;
    if (level === 'easy') c = valid[Math.floor(Math.random() * valid.length)];
    else {
      c = valid.find((k) => winsAt(k, M.opp));                                  // win now
      if (c == null) c = valid.find((k) => winsAt(k, M.mine));                  // block human
      if (c == null && level === 'hard') {                                     // avoid giving human a win
        const safe = valid.filter((k) => { const row = M.grid[k].length; M.grid[k].push(M.opp); const bad = [...Array(COLS).keys()].some((k2) => M.grid[k2].length < ROWS && winsAt(k2, M.mine)); M.grid[k].pop(); return !bad; });
        c = center(safe.length ? safe : valid);
      }
      if (c == null) c = center(valid);
    }
    return { type: 'drop', c };
  },
  getState() { return { grid: M.grid, mine: M.mine, opp: M.opp, cols: COLS, rows: ROWS }; },
  restore(state, ctx) { M.grid = state.grid; COLS = state.cols || state.grid.length; ROWS = state.rows || 6; M.mine = state.mine; M.opp = state.opp; build(ctx); },
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
        if (res.winner) { highlightWin(ctx, c, res.row); ctx.endGame('win'); }
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
