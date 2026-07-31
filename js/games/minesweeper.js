import { msReveal, msCount, msNeighbors } from '../logic.js?v=6';

const LEVELS = { easy: [8, 8, 10], medium: [10, 12, 22], hard: [12, 16, 40] };
const NUMCLR = ['', 'text-sky-400', 'text-emerald-400', 'text-rose-400', 'text-indigo-300', 'text-amber-400', 'text-cyan-300', 'text-slate-200', 'text-slate-400'];
const M = { W: 8, H: 8, N: 10, mines: null, open: null, flags: null, started: false, over: false, flagMode: false, cells: {}, statusEl: null, flagBtn: null };

function build(ctx) {
  M.cells = {};
  const root = ctx.root; root.innerHTML = '';
  const wrap = ctx.el('div', 'mx-auto space-y-3 select-none'); wrap.style.maxWidth = 'min(96vw, 30rem)';
  const diff = ctx.el('div', 'grid grid-cols-3 gap-2');
  for (const lv of ['easy', 'medium', 'hard']) { const b = ctx.el('button', 'py-2 rounded-lg text-sm font-semibold ' + (M.level === lv ? 'bg-indigo-600' : 'bg-slate-800 text-slate-400'), ctx.t('diff_' + lv)); b.onclick = () => { newBoard(ctx, lv); }; diff.appendChild(b); }
  wrap.appendChild(diff);
  const bar = ctx.el('div', 'flex items-center justify-between');
  M.statusEl = ctx.el('p', 'text-sm text-slate-400');
  M.flagBtn = ctx.el('button', 'px-3 py-1.5 rounded-lg text-sm font-semibold', '');
  M.flagBtn.onclick = () => { M.flagMode = !M.flagMode; paintFlagBtn(); };
  bar.append(M.statusEl, M.flagBtn); wrap.appendChild(bar); paintFlagBtn();
  const grid = ctx.el('div', 'grid gap-0.5 mx-auto'); grid.style.gridTemplateColumns = `repeat(${M.W}, 1fr)`;
  for (let y = 0; y < M.H; y++) for (let x = 0; x < M.W; x++) { const c = ctx.el('button', 'aspect-square rounded-sm text-sm font-bold flex items-center justify-center'); c.oncontextmenu = (e) => { e.preventDefault(); flag(ctx, x, y); }; c.onclick = () => cell(ctx, x, y); M.cells[x + ',' + y] = c; grid.appendChild(c); }
  wrap.appendChild(grid);
  root.appendChild(wrap);
  paint();
}
function paintFlagBtn() { M.flagBtn.textContent = M.flagMode ? '🚩 ON' : '🚩 Flag'; M.flagBtn.className = 'px-3 py-1.5 rounded-lg text-sm font-semibold ' + (M.flagMode ? 'bg-rose-600' : 'bg-slate-800'); }
function newBoard(ctx, lv) { M.level = lv;[M.H, M.W, M.N] = LEVELS[lv]; M.mines = new Set(); M.open = new Set(); M.flags = new Set(); M.started = false; M.over = false; build(ctx); }
function placeMines(fx, fy) {
  const safe = new Set([fx + ',' + fy]); for (const [nx, ny] of msNeighbors(fx, fy, M.W, M.H)) safe.add(nx + ',' + ny);
  let placed = 0;
  while (placed < M.N) { const x = Math.floor(Math.random() * M.W), y = Math.floor(Math.random() * M.H), k = x + ',' + y; if (safe.has(k) || M.mines.has(k)) continue; M.mines.add(k); placed++; }
  M.started = true;
}
function paint() {
  for (let y = 0; y < M.H; y++) for (let x = 0; x < M.W; x++) {
    const k = x + ',' + y, c = M.cells[k];
    if (M.open.has(k)) { const n = msCount(M.mines, x, y, M.W, M.H); c.textContent = n || ''; c.className = 'aspect-square rounded-sm text-sm font-bold flex items-center justify-center bg-slate-800 ' + (NUMCLR[n] || ''); }
    else if (M.over && M.mines.has(k)) { c.textContent = '💣'; c.className = 'aspect-square rounded-sm text-sm flex items-center justify-center bg-rose-900'; }
    else { c.textContent = M.flags.has(k) ? '🚩' : ''; c.className = 'aspect-square rounded-sm text-sm flex items-center justify-center bg-slate-700 hover:bg-slate-600'; }
  }
  if (M.statusEl) M.statusEl.textContent = `${M.N - M.flags.size} 💣  ·  ${M.W}×${M.H}`;
}
function cell(ctx, x, y) {
  if (M.over) return; const k = x + ',' + y;
  if (M.flagMode) return flag(ctx, x, y);
  if (M.flags.has(k) || M.open.has(k)) return;
  if (!M.started) placeMines(x, y);
  if (M.mines.has(k)) { M.over = true; ctx.sound('lose'); paint(); return ctx.endGame('lose', 'Boom 💥'); }
  for (const o of msReveal(M.mines, x, y, M.W, M.H)) M.open.add(o);
  ctx.sound('place'); paint();
  if (M.open.size === M.W * M.H - M.N) { M.over = true; ctx.sound('win'); return ctx.endGame('win', 'Cleared!'); }
}
function flag(ctx, x, y) { if (M.over) return; const k = x + ',' + y; if (M.open.has(k)) return; if (M.flags.has(k)) M.flags.delete(k); else M.flags.add(k); ctx.sound('click'); paint(); }

export default {
  id: 'minesweeper', name: 'Minesweeper', emoji: '💣', blurb: 'Clear the field', solo: true, usesTurns: false,
  start(ctx) { newBoard(ctx, M.level || 'easy'); },
  getState() { return null; },
  restore(_, ctx) { newBoard(ctx, M.level || 'easy'); },
};
