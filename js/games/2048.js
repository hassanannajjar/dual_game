import { move2048, has2048Move } from '../logic.js?v=6';

const COLORS = { 0: 'bg-slate-800', 2: 'bg-slate-600', 4: 'bg-slate-500', 8: 'bg-amber-600', 16: 'bg-amber-500', 32: 'bg-orange-500', 64: 'bg-orange-600', 128: 'bg-yellow-500', 256: 'bg-yellow-400 text-slate-900', 512: 'bg-lime-500 text-slate-900', 1024: 'bg-emerald-500 text-slate-900', 2048: 'bg-indigo-500' };
const M = { board: [], oppMax: 0, cells: [], statusEl: null, keyHandler: null };

const emptyCells = (b) => { const e = []; for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) if (!b[y][x]) e.push([x, y]); return e; };
function spawn() { const e = emptyCells(M.board); if (!e.length) return; const [x, y] = e[Math.floor(Math.random() * e.length)]; M.board[y][x] = Math.random() < 0.9 ? 2 : 4; }
function paint() {
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
    const v = M.board[y][x], c = M.cells[y][x];
    c.textContent = v || '';
    c.className = 'aspect-square rounded-lg flex items-center justify-center font-bold text-xl ' + (COLORS[v] || 'bg-indigo-600');
  }
  const max = Math.max(...M.board.flat());
  M.statusEl.textContent = `You: ${max}   ·   Opponent: ${M.oppMax || 0}`;
}
function build(ctx) {
  M.cells = [];
  const wrap = ctx.el('div', 'max-w-xs mx-auto space-y-3 select-none');
  M.statusEl = ctx.el('p', 'text-center text-slate-400 text-sm');
  wrap.appendChild(M.statusEl);
  const grid = ctx.el('div', 'grid grid-cols-4 gap-2 p-2 rounded-xl bg-slate-900 touch-none');
  for (let y = 0; y < 4; y++) { M.cells[y] = []; for (let x = 0; x < 4; x++) { const c = ctx.el('div', ''); M.cells[y][x] = c; grid.appendChild(c); } }
  wrap.appendChild(grid);
  wrap.appendChild(ctx.el('p', 'text-center text-slate-600 text-xs', 'Swipe or use arrow keys'));
  ctx.root.appendChild(wrap);
  // swipe
  let sx = 0, sy = 0;
  grid.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
  grid.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) < 20 && Math.abs(dy) < 20) return;
    move(ctx, Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
  }, { passive: true });
  paint();
}
function move(ctx, dir) {
  const r = move2048(M.board, dir);
  if (!r.moved) return;
  M.board = r.board; spawn(); ctx.sound('click'); paint();
  const max = Math.max(...M.board.flat());
  ctx.send('max', { max });
  if (max >= 2048) { ctx.send('win', {}); return ctx.endGame('win', 'Reached 2048!'); }
  if (!has2048Move(M.board)) { ctx.send('lost', { max }); return ctx.endGame('lose', 'Board full'); }
  ctx.save();
}

export default {
  id: '2048', name: '2048 Duel', emoji: '🔢', blurb: 'Race to 2048', usesTurns: false,
  start(ctx) {
    M.board = Array.from({ length: 4 }, () => Array(4).fill(0)); M.oppMax = 0;
    spawn(); spawn(); build(ctx);
    M.keyHandler = (e) => { const k = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' }[e.key]; if (k) { e.preventDefault(); move(ctx, k); } };
    document.addEventListener('keydown', M.keyHandler);
  },
  onMessage(msg, ctx) {
    if (msg.type === 'max') { M.oppMax = msg.max; paint(); }
    else if (msg.type === 'win') ctx.endGame('lose', 'Opponent reached 2048');
    else if (msg.type === 'lost') ctx.endGame('win', 'Opponent is stuck');
  },
  stop() { if (M.keyHandler) { document.removeEventListener('keydown', M.keyHandler); M.keyHandler = null; } },
  getState() { return { board: M.board, oppMax: M.oppMax }; },
  restore(state, ctx) {
    M.board = state.board; M.oppMax = state.oppMax || 0; build(ctx);
    M.keyHandler = (e) => { const k = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' }[e.key]; if (k) { e.preventDefault(); move(ctx, k); } };
    document.addEventListener('keydown', M.keyHandler);
  },
};
