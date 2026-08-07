import { has2048Move } from '../logic.js?v=40';
import { getSkin } from '../loyalty.js?v=40';
import { makeTileBoard } from './tileboard.js?v=40';

const SKINS = {
  classic: { 0: 'bg-slate-800', 2: 'bg-slate-600', 4: 'bg-slate-500', 8: 'bg-amber-600', 16: 'bg-amber-500', 32: 'bg-orange-500', 64: 'bg-orange-600', 128: 'bg-yellow-500', 256: 'bg-yellow-400 text-slate-900', 512: 'bg-lime-500 text-slate-900', 1024: 'bg-emerald-500 text-slate-900', 2048: 'bg-indigo-500', 4096: 'bg-purple-600', 8192: 'bg-fuchsia-600', 16384: 'bg-rose-600', 32768: 'bg-red-600' },
  neon: { 0: 'bg-slate-800', 2: 'bg-fuchsia-700', 4: 'bg-fuchsia-600', 8: 'bg-pink-500', 16: 'bg-rose-500', 32: 'bg-purple-500', 64: 'bg-violet-500', 128: 'bg-indigo-500', 256: 'bg-cyan-400 text-slate-900', 512: 'bg-emerald-400 text-slate-900', 1024: 'bg-lime-400 text-slate-900', 2048: 'bg-yellow-300 text-slate-900', 4096: 'bg-orange-400 text-slate-900', 8192: 'bg-red-400 text-slate-900', 16384: 'bg-pink-400 text-slate-900', 32768: 'bg-white text-slate-900' },
  pastel: { 0: 'bg-slate-800', 2: 'bg-slate-700', 4: 'bg-teal-300 text-slate-900', 8: 'bg-emerald-300 text-slate-900', 16: 'bg-sky-300 text-slate-900', 32: 'bg-indigo-300 text-slate-900', 64: 'bg-violet-300 text-slate-900', 128: 'bg-pink-300 text-slate-900', 256: 'bg-rose-300 text-slate-900', 512: 'bg-amber-300 text-slate-900', 1024: 'bg-lime-300 text-slate-900', 2048: 'bg-fuchsia-300 text-slate-900', 4096: 'bg-purple-400 text-slate-900', 8192: 'bg-orange-300 text-slate-900', 16384: 'bg-red-300 text-slate-900', 32768: 'bg-white text-slate-900' },
  mono: { 0: 'bg-slate-800', 2: 'bg-slate-700', 4: 'bg-slate-600', 8: 'bg-slate-500', 16: 'bg-slate-400 text-slate-900', 32: 'bg-slate-300 text-slate-900', 64: 'bg-slate-200 text-slate-900', 128: 'bg-zinc-400 text-slate-900', 256: 'bg-zinc-300 text-slate-900', 512: 'bg-zinc-200 text-slate-900', 1024: 'bg-neutral-300 text-slate-900', 2048: 'bg-white text-slate-900', 4096: 'bg-indigo-400 text-slate-900', 8192: 'bg-violet-400 text-slate-900', 16384: 'bg-fuchsia-400 text-slate-900', 32768: 'bg-rose-400 text-slate-900' },
};
const paletteFor = (v) => (SKINS[getSkin()] || SKINS.classic)[v] || 'bg-slate-700';
const M = { size: 4, board: [], best: 0, points: 0, oppBest: 0, oppPoints: 0, myDone: false, oppDone: false, tb: null, statusEl: null, timerEl: null, doneBtn: null, undoBtn: null, undos: [], undoCap: 3, keyHandler: null, timer: null, timeLeft: 0 };

const emptyCells = (b) => { const e = [], n = b.length; for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (!b[y][x]) e.push([x, y]); return e; };
const maxTile = () => Math.max(0, ...M.board.flat());
function spawnCell() { const e = emptyCells(M.board); if (!e.length) return null; const [x, y] = e[Math.floor(Math.random() * e.length)]; const v = Math.random() < 0.9 ? 2 : 4; M.board[y][x] = v; return [x, y, v]; }
function freshBoard() { M.board = Array.from({ length: M.size }, () => Array(M.size).fill(0)); spawnCell(); spawnCell(); }
const fmt = (n) => n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1) + 'k' : String(n);
function perfBonus() { const bt = M.best; if (bt < 8) return null; const k = Math.floor(Math.log2(bt)); return { coins: (k - 2) * 3, xp: (k - 2) * 4 }; }
function updateUndoBtn(ctx) { if (!M.undoBtn) return; const n = M.undos.length; M.undoBtn.disabled = !n || M.myDone; M.undoBtn.textContent = '↩ ' + ctx.t('undo') + (n ? ` (${n})` : ''); }

function paint(ctx) {
  M.best = Math.max(M.best, maxTile());
  updateUndoBtn(ctx);
  if (!M.statusEl) return;
  if (ctx.solo) { M.statusEl.textContent = `Best: ${M.best}  ·  ${fmt(M.points)} pts`; return; }
  let s = `You: ${M.best} (${fmt(M.points)}) · Opp: ${M.oppBest} (${fmt(M.oppPoints)})`;
  if (M.myDone) s += '  —  ' + ctx.t('waiting_finish');
  else if (M.oppDone) s += '  —  ' + ctx.t('opp_finished', { n: M.oppBest });
  M.statusEl.textContent = s;
}
function build(ctx) {
  M.size = Math.max(4, Math.min(6, ctx.config.size || 4));
  M.undoCap = Math.max(0, ctx.config.undos || 3);
  const timed = ctx.config.endMode === 'timed', manual = ctx.config.endMode === 'manual';
  const wrap = ctx.el('div', 'mx-auto space-y-3 select-none'); wrap.style.maxWidth = '26rem';
  M.statusEl = ctx.el('p', 'text-center text-slate-400 text-sm'); wrap.appendChild(M.statusEl);
  if (timed) { M.timerEl = ctx.el('p', 'text-center font-mono text-lg'); wrap.appendChild(M.timerEl); }
  const mount = ctx.el('div', ''); wrap.appendChild(mount);
  if (M.tb) M.tb.destroy();
  M.tb = makeTileBoard(ctx, { size: M.size, palette: paletteFor, mount });
  M.tb.sync(M.board);
  let sx = 0, sy = 0;
  M.tb.el.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
  M.tb.el.addEventListener('touchend', (e) => { const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy; if (Math.abs(dx) < 20 && Math.abs(dy) < 20) return; move(ctx, Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up')); }, { passive: true });
  wrap.appendChild(ctx.el('p', 'text-center text-slate-600 text-xs', ctx.t('swipe_keys')));

  const btns = [], ctrlWrap = ctx.el('div', 'max-w-xs mx-auto');
  M.undoBtn = ctx.el('button', 'py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed font-semibold text-sm', '↩ ' + ctx.t('undo'));
  M.undoBtn.disabled = true;
  M.undoBtn.onclick = () => { if (!M.undos.length || M.myDone) return; const s = M.undos.pop(); M.board = s.board.map((r) => r.slice()); M.points = s.points; M.tb.sync(M.board); ctx.sound('toggle'); paint(ctx); if (!ctx.solo) ctx.send('stat', { best: M.best, points: M.points }); ctx.save(); };
  if (!timed && M.undoCap > 0) btns.push(M.undoBtn);
  const nb = ctx.el('button', 'py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 font-semibold text-sm', ctx.t(ctx.solo ? 'new_game' : 'new_board'));
  nb.onclick = () => { if (ctx.solo) { M.best = 0; M.points = 0; M.myDone = false; } M.undos = []; freshBoard(); M.tb.sync(M.board); ctx.sound('drop'); paint(ctx); if (!ctx.solo) ctx.send('stat', { best: M.best, points: M.points }); ctx.save(); };
  btns.push(nb);
  if (manual) { M.doneBtn = ctx.el('button', 'py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-semibold text-sm', ctx.t('im_done')); M.doneBtn.onclick = () => finish(ctx); btns.push(M.doneBtn); }
  ctrlWrap.className = 'max-w-xs mx-auto grid gap-2 grid-cols-' + Math.min(3, btns.length);
  btns.forEach((b) => ctrlWrap.appendChild(b)); wrap.appendChild(ctrlWrap);

  ctx.root.appendChild(wrap);
  // ponytail: dev/test hook — seed the live board/score from the console (client is already unrefereed).
  window.duel2048 = {
    set: (rows, opts = {}) => { M.board = rows.map((r) => r.slice()); M.size = M.board.length; if (opts.points != null) M.points = opts.points; if (opts.best != null) M.best = opts.best; M.tb.sync(M.board); paint(ctx); },
    push: () => ctx.send('stat', { best: M.best, points: M.points }),
    win: () => { M.myDone = true; ctx.send('win', { best: M.best, points: M.points }); ctx.endGame('win', 'test win'); },
  };
  paint(ctx);
}
function startTimer(ctx) {
  if (ctx.config.endMode !== 'timed') return;
  M.timeLeft = ctx.config.time || 120;
  const render = () => { if (M.timerEl) M.timerEl.textContent = Math.floor(M.timeLeft / 60) + ':' + String(M.timeLeft % 60).padStart(2, '0'); };
  render();
  M.timer = setInterval(() => { M.timeLeft--; render(); if (M.timeLeft <= 0) { clearInterval(M.timer); M.timer = null; finish(ctx); } }, 1000);
}
function soloEnd(ctx, outcome, msg) { M.myDone = true; ctx.endGame(outcome, msg, { perfBonus: perfBonus() }); }
function finish(ctx) {
  if (M.myDone) return;
  if (ctx.solo) { const goal = soloGoal(ctx), won = M.best >= goal; return soloEnd(ctx, won ? 'win' : 'lose', won ? `Reached ${goal}! · ${fmt(M.points)} pts` : `Best ${M.best} · ${fmt(M.points)} pts`); }
  M.myDone = true; if (M.doneBtn) M.doneBtn.disabled = true;
  ctx.send('done', { best: M.best, points: M.points });
  paint(ctx); resolveIfBoth(ctx);
}
function resolveIfBoth(ctx) {
  if (!(M.myDone && M.oppDone)) return;
  const outcome = M.best > M.oppBest ? 'win' : M.best < M.oppBest ? 'lose' : (M.points > M.oppPoints ? 'win' : M.points < M.oppPoints ? 'lose' : 'draw');
  const close = outcome === 'lose' && (M.best === M.oppBest || Math.abs(M.points - M.oppPoints) <= Math.max(M.points, M.oppPoints, 1) * 0.15);
  ctx.endGame(outcome, `You ${M.best}·${fmt(M.points)} — Opp ${M.oppBest}·${fmt(M.oppPoints)}`, { close, perfBonus: perfBonus() });
}
function soloGoal(ctx) { return ctx.config.endMode === 'target' ? (ctx.config.target || 2048) : ctx.config.endMode === 'endless' ? Infinity : 2048; }
function move(ctx, dir) {
  if (M.myDone) return;
  const snap = { board: M.board.map((r) => r.slice()), points: M.points };
  const res = M.tb.move(dir, M.board);
  if (!res.moved) return;
  if (M.undoCap > 0) { M.undos.push(snap); if (M.undos.length > M.undoCap) M.undos.shift(); }
  M.board = res.board; M.points += res.score; ctx.sound('click');
  const sp = spawnCell(); if (sp) M.tb.spawnAt(sp[0], sp[1], sp[2]);
  paint(ctx);
  const max = maxTile();
  if (ctx.solo) {
    if (max >= soloGoal(ctx)) return soloEnd(ctx, 'win', `Reached ${soloGoal(ctx)}! · ${fmt(M.points)} pts`);
    if (!has2048Move(M.board)) {
      if (ctx.config.endMode === 'endless') { freshBoard(); M.undos = []; M.tb.sync(M.board); ctx.toast(ctx.t('board_kept')); ctx.sound('drop'); paint(ctx); return; }
      if (ctx.config.endMode === 'manual') return;
      return soloEnd(ctx, 'lose', `Best ${M.best} · ${fmt(M.points)} pts`);
    }
    return;
  }
  ctx.send('stat', { best: M.best, points: M.points });
  if (ctx.config.endMode === 'target' && M.best >= (ctx.config.target || 1024)) { M.myDone = true; ctx.send('win', { best: M.best, points: M.points }); return ctx.endGame('win', `Reached ${ctx.config.target}!`, { perfBonus: perfBonus() }); }
  if (!has2048Move(M.board)) { freshBoard(); M.undos = []; M.tb.sync(M.board); ctx.toast(ctx.t('board_kept')); ctx.sound('drop'); paint(ctx); }
}

function addKeys(ctx) {
  M.keyHandler = (e) => { const k = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' }[e.key]; if (k) { e.preventDefault(); move(ctx, k); } };
  document.addEventListener('keydown', M.keyHandler);
}
export default {
  id: '2048', name: '2048 Duel', emoji: '🔢', blurb: 'Highest tile wins', usesTurns: false,
  options: [
    { key: 'endMode', label: 'How to end', choices: [{ label: 'Manual', value: 'manual' }, { label: 'Target', value: 'target' }, { label: 'Timed', value: 'timed' }, { label: 'Endless', value: 'endless' }], default: 'manual' },
    { key: 'size', label: 'Board size', choices: [{ label: '4×4', value: 4 }, { label: '5×5', value: 5 }, { label: '6×6', value: 6 }], default: 4 },
    { key: 'undos', label: 'Undos', choices: [{ label: 'Off', value: 0 }, { label: '3', value: 3 }, { label: '∞', value: 99 }], default: 3 },
    { key: 'target', label: 'Target tile', choices: [{ label: '512', value: 512 }, { label: '1024', value: 1024 }, { label: '2048', value: 2048 }, { label: '4096', value: 4096 }, { label: '8192', value: 8192 }, { label: '16384', value: 16384 }], default: 1024, when: (c) => c.endMode === 'target' },
    { key: 'time', label: 'Time limit', choices: [{ label: '1m', value: 60 }, { label: '2m', value: 120 }, { label: '3m', value: 180 }], default: 120, when: (c) => c.endMode === 'timed' },
  ],
  start(ctx) {
    M.best = 0; M.points = 0; M.oppBest = 0; M.oppPoints = 0; M.myDone = false; M.oppDone = false; M.timer = null; M.undos = [];
    M.size = Math.max(4, Math.min(6, ctx.config.size || 4));
    freshBoard(); build(ctx); startTimer(ctx); addKeys(ctx);
  },
  onMessage(msg, ctx) {
    if (msg.type === 'stat') { M.oppBest = msg.best; M.oppPoints = msg.points; paint(ctx); }
    else if (msg.type === 'done') { M.oppDone = true; M.oppBest = msg.best; M.oppPoints = msg.points || 0; paint(ctx); resolveIfBoth(ctx); }
    else if (msg.type === 'win') { M.oppBest = msg.best; M.oppPoints = msg.points; ctx.endGame('lose', 'Opponent hit the target'); }
  },
  stop() { clearInterval(M.timer); M.timer = null; if (M.tb) { M.tb.destroy(); M.tb = null; } if (M.keyHandler) { document.removeEventListener('keydown', M.keyHandler); M.keyHandler = null; } },
  getState() { return { size: M.size, board: M.board, best: M.best, points: M.points, oppBest: M.oppBest, oppPoints: M.oppPoints, myDone: M.myDone, oppDone: M.oppDone, undos: M.undos }; },
  restore(state, ctx) {
    M.size = state.size || (state.board ? state.board.length : 4);
    M.board = state.board; M.best = state.best || 0; M.points = state.points || 0; M.oppBest = state.oppBest || 0; M.oppPoints = state.oppPoints || 0;
    M.myDone = !!state.myDone; M.oppDone = !!state.oppDone; M.timer = null; M.undos = state.undos || [];
    build(ctx); startTimer(ctx); addKeys(ctx);
  },
};
