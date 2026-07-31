import { move2048, has2048Move } from '../logic.js?v=8';

const COLORS = { 0: 'bg-slate-800', 2: 'bg-slate-600', 4: 'bg-slate-500', 8: 'bg-amber-600', 16: 'bg-amber-500', 32: 'bg-orange-500', 64: 'bg-orange-600', 128: 'bg-yellow-500', 256: 'bg-yellow-400 text-slate-900', 512: 'bg-lime-500 text-slate-900', 1024: 'bg-emerald-500 text-slate-900', 2048: 'bg-indigo-500' };
const M = { board: [], score: 0, oppMax: 0, oppScore: 0, myDone: false, oppDone: false, cells: [], statusEl: null, keyHandler: null };

const emptyCells = (b) => { const e = []; for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) if (!b[y][x]) e.push([x, y]); return e; };
const maxTile = () => Math.max(...M.board.flat());
function spawn() { const e = emptyCells(M.board); if (!e.length) return; const [x, y] = e[Math.floor(Math.random() * e.length)]; M.board[y][x] = Math.random() < 0.9 ? 2 : 4; }
function paint(ctx) {
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
    const v = M.board[y][x], c = M.cells[y][x];
    c.textContent = v || '';
    c.className = 'aspect-square rounded-lg flex items-center justify-center font-bold text-xl ' + (COLORS[v] || 'bg-indigo-600');
  }
  if (!M.statusEl) return;
  if (ctx.solo) { M.statusEl.textContent = `Best: ${maxTile()}  ·  Score ${M.score}`; return; }
  let s = `You: ${maxTile()}   ·   Opponent: ${M.oppMax || 0}`;
  if (M.myDone) s += '  —  ' + ctx.t('waiting_finish');
  else if (M.oppDone) s += '  —  ' + ctx.t('opp_finished', { n: M.oppMax });
  M.statusEl.textContent = s;
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
  let sx = 0, sy = 0;
  grid.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
  grid.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) < 20 && Math.abs(dy) < 20) return;
    move(ctx, Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
  }, { passive: true });
  paint(ctx);
}
function resolveIfBoth(ctx) {
  if (!(M.myDone && M.oppDone)) return;
  const my = maxTile(), op = M.oppMax || 0;
  const outcome = my > op ? 'win' : my < op ? 'lose' : (M.score > M.oppScore ? 'win' : M.score < M.oppScore ? 'lose' : 'draw');
  ctx.endGame(outcome, `${ctx.t('best_tile')}: ${my} · ${op}`);
}
function move(ctx, dir) {
  if (M.myDone) return;
  const r = move2048(M.board, dir);
  if (!r.moved) return;
  M.board = r.board; M.score += r.score; spawn(); ctx.sound('click'); paint(ctx);
  const max = maxTile();
  if (ctx.solo) {
    if (max >= 2048) { M.myDone = true; return ctx.endGame('win', 'Reached 2048!'); }
    if (!has2048Move(M.board)) { M.myDone = true; return ctx.endGame('lose', `${ctx.t('best_tile')}: ${max}`); }
    ctx.save(); return;
  }
  // duel: play until stuck; highest tile wins
  ctx.send('max', { max });
  if (!has2048Move(M.board)) {
    M.myDone = true; ctx.send('done', { max, score: M.score }); paint(ctx); resolveIfBoth(ctx);
  } else ctx.save();
}

export default {
  id: '2048', name: '2048 Duel', emoji: '🔢', blurb: 'Highest tile wins', usesTurns: false,
  start(ctx) {
    M.board = Array.from({ length: 4 }, () => Array(4).fill(0));
    M.score = 0; M.oppMax = 0; M.oppScore = 0; M.myDone = false; M.oppDone = false;
    spawn(); spawn(); build(ctx);
    M.keyHandler = (e) => { const k = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' }[e.key]; if (k) { e.preventDefault(); move(ctx, k); } };
    document.addEventListener('keydown', M.keyHandler);
  },
  onMessage(msg, ctx) {
    if (msg.type === 'max') { M.oppMax = msg.max; paint(ctx); }
    else if (msg.type === 'done') { M.oppDone = true; M.oppMax = msg.max; M.oppScore = msg.score || 0; paint(ctx); resolveIfBoth(ctx); }
  },
  stop() { if (M.keyHandler) { document.removeEventListener('keydown', M.keyHandler); M.keyHandler = null; } },
  getState() { return { board: M.board, score: M.score, oppMax: M.oppMax, oppScore: M.oppScore, myDone: M.myDone, oppDone: M.oppDone }; },
  restore(state, ctx) {
    M.board = state.board; M.score = state.score || 0; M.oppMax = state.oppMax || 0; M.oppScore = state.oppScore || 0;
    M.myDone = !!state.myDone; M.oppDone = !!state.oppDone;
    build(ctx);
    M.keyHandler = (e) => { const k = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' }[e.key]; if (k) { e.preventDefault(); move(ctx, k); } };
    document.addEventListener('keydown', M.keyHandler);
  },
};
