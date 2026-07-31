import { sudokuGen, sudokuValid } from '../logic.js?v=7';

const CLUES = { easy: 44, medium: 34, hard: 28 };
const M = { grid: [], given: [], sel: null, cells: [], over: false, level: 'easy', statusEl: null };

function conflict(x, y) {
  const v = M.grid[y][x]; if (!v) return false;
  M.grid[y][x] = 0; const ok = sudokuValid(M.grid, x, y, v); M.grid[y][x] = v; return !ok;
}
function paint() {
  for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) {
    const c = M.cells[y * 9 + x], v = M.grid[y][x];
    c.textContent = v || '';
    const given = M.given[y][x], sel = M.sel && M.sel[0] === x && M.sel[1] === y, bad = conflict(x, y);
    c.className = 'aspect-square flex items-center justify-center text-lg font-bold ' +
      (bad ? 'bg-rose-900/70 text-rose-300' : sel ? 'bg-indigo-700/60' : given ? 'bg-slate-800 text-slate-200' : 'bg-slate-900 text-indigo-300') +
      (x % 3 === 0 ? ' border-l-2 border-l-slate-600' : ' border-l border-l-slate-800') +
      (y % 3 === 0 ? ' border-t-2 border-t-slate-600' : ' border-t border-t-slate-800') +
      (x === 8 ? ' border-r-2 border-r-slate-600' : '') + (y === 8 ? ' border-b-2 border-b-slate-600' : '');
  }
}
function complete() { for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) if (!M.grid[y][x] || conflict(x, y)) return false; return true; }
function place(ctx, v) {
  if (M.over || !M.sel) return; const [x, y] = M.sel; if (M.given[y][x]) return;
  M.grid[y][x] = v; ctx.sound(v ? 'click' : 'drop'); paint();
  if (complete()) { M.over = true; ctx.sound('win'); ctx.endGame('win', 'Solved!'); }
}
function newPuzzle(ctx, lv) {
  M.level = lv; M.over = false; M.sel = null;
  const { puzzle } = sudokuGen(Math.random, CLUES[lv]);
  M.grid = puzzle.map((r) => r.slice());
  M.given = puzzle.map((r) => r.map((v) => v !== 0));
  build(ctx);
}
function build(ctx) {
  M.cells = []; const root = ctx.root; root.innerHTML = '';
  const wrap = ctx.el('div', 'mx-auto space-y-3 select-none'); wrap.style.maxWidth = 'min(94vw, 26rem)';
  const diff = ctx.el('div', 'grid grid-cols-3 gap-2');
  for (const lv of ['easy', 'medium', 'hard']) { const b = ctx.el('button', 'py-2 rounded-lg text-sm font-semibold ' + (M.level === lv ? 'bg-indigo-600' : 'bg-slate-800 text-slate-400'), ctx.t('diff_' + lv)); b.onclick = () => newPuzzle(ctx, lv); diff.appendChild(b); }
  wrap.appendChild(diff);
  const grid = ctx.el('div', 'grid grid-cols-9 bg-slate-800 rounded overflow-hidden');
  for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) { const c = ctx.el('button', ''); c.onclick = () => { if (!M.given[y][x]) { M.sel = [x, y]; paint(); } }; M.cells.push(c); grid.appendChild(c); }
  wrap.appendChild(grid);
  const pad = ctx.el('div', 'grid grid-cols-5 gap-2');
  for (let v = 1; v <= 9; v++) { const b = ctx.el('button', 'py-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-lg font-bold', '' + v); b.onclick = () => place(ctx, v); pad.appendChild(b); }
  const er = ctx.el('button', 'py-3 rounded-lg bg-slate-700 hover:bg-slate-600 text-lg', '⌫'); er.onclick = () => place(ctx, 0); pad.appendChild(er);
  wrap.appendChild(pad);
  ctx.root.appendChild(wrap);
  paint();
}

export default {
  id: 'sudoku', name: 'Sudoku', emoji: '🔢', blurb: 'Fill the grid', solo: true, usesTurns: false,
  start(ctx) { newPuzzle(ctx, M.level || 'easy'); },
  getState() { return null; },
  restore(_, ctx) { newPuzzle(ctx, M.level || 'easy'); },
};
