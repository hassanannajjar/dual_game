import { move2048Walls, has2048MoveWalls, level2048Config, stars2048 } from '../logic.js?v=39';
import { earnForResult, questEvent } from '../loyalty.js?v=39';

// 2048 Levels — a self-contained campaign (1000+ generated levels) plus a head-to-head "race the same level" mode.
// Solo owns ctx.root across three views (select → play → result). Online mirrors the 2048-duel networking.
// Palette is fixed (no bg-indigo-600) so the accent theme never recolors these tiles.
const TILE = { 0: 'bg-slate-800', 2: 'bg-slate-600', 4: 'bg-slate-500', 8: 'bg-amber-600', 16: 'bg-amber-500', 32: 'bg-orange-500', 64: 'bg-orange-600', 128: 'bg-yellow-500', 256: 'bg-yellow-400 text-slate-900', 512: 'bg-lime-500 text-slate-900', 1024: 'bg-emerald-500 text-slate-900', 2048: 'bg-cyan-500 text-slate-900', 4096: 'bg-fuchsia-600', 8192: 'bg-purple-600', 16384: 'bg-rose-600', 32768: 'bg-red-600' };
const WALL = 'bg-slate-950 border border-slate-700/80';
const KEY = 'arcade:2048campaign';

const M = { view: 'select', n: 1, cfg: null, board: [], walls: new Set(), score: 0, moves: 0, best: 0,
  timeLeft: 0, timer: null, startTs: 0, cells: [], boardEl: null, infoEl: null, chapterView: 0,
  myDone: false, oppBest: 0, oppScore: 0, oppDone: false, ctx: null, keyHandler: null };

const readProg = () => { try { const s = localStorage.getItem(KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; } };
const writeProg = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) {} };
function progress() { return readProg() || { unlocked: 1, score: 0, totalStars: 0, levels: {} }; }
const fmt = (v) => v >= 1000 ? (v / 1000).toFixed(v >= 10000 ? 0 : 1) + 'k' : String(v);
const tileFont = (n) => n >= 6 ? 'text-sm sm:text-base' : n === 5 ? 'text-base sm:text-lg' : 'text-lg sm:text-xl';
const starStr = (s) => '★★★'.slice(0, s) + '☆☆☆'.slice(0, 3 - s);
function perfBonus() { if (M.best < 8) return null; const k = Math.floor(Math.log2(M.best)); return { coins: (k - 2) * 3, xp: (k - 2) * 4 }; }

// ---------- board helpers ----------
function emptyCells(b) { const e = [], n = b.length; for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (!b[y][x] && !M.walls.has(x + ',' + y)) e.push([x, y]); return e; }
function spawn(b) { const e = emptyCells(b); if (!e.length) return; const [x, y] = e[Math.floor(Math.random() * e.length)]; b[y][x] = Math.random() < (M.cfg.spawnFour || 0.1) ? 4 : 2; }
function resetPlay() {
  const c = M.cfg, n = c.size, b = Array.from({ length: n }, () => Array(n).fill(0));
  M.walls = new Set(c.walls.map(([x, y]) => x + ',' + y));
  for (const p of c.preset) if (!M.walls.has(p.x + ',' + p.y)) b[p.y][p.x] = p.v;
  M.board = b; M.score = 0; M.moves = 0; M.best = 0; M.myDone = false;
  spawn(b); spawn(b);
  M.best = maxTile();
  M.timeLeft = c.limitType === 'time' ? c.limit : 0; M.startTs = 0;
}
function maxTile() { let m = 0; for (const r of M.board) for (const v of r) if (v > m) m = v; return m; }

// ---------- rendering ----------
function paintBoard() {
  const n = M.cfg.size, font = tileFont(n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const c = M.cells[y][x], wall = M.walls.has(x + ',' + y), v = M.board[y][x];
    if (wall) { c.textContent = ''; c.className = 'aspect-square rounded-lg ' + WALL; continue; }
    c.textContent = v ? fmt(v) : '';
    c.className = 'aspect-square rounded-lg flex items-center justify-center font-bold transition-colors ' + font + ' ' + (TILE[v] || 'bg-slate-700');
  }
  M.best = Math.max(M.best, maxTile());
  paintInfo();
}
function paintInfo() {
  if (!M.infoEl) return;
  const c = M.cfg;
  let right = '';
  if (c.limitType === 'moves') right = M.ctx.t('lvl_moves_left', { n: Math.max(0, c.limit - M.moves) });
  else if (c.limitType === 'time') right = Math.floor(M.timeLeft / 60) + ':' + String(M.timeLeft % 60).padStart(2, '0');
  else right = M.ctx.t('lvl_moves_used', { n: M.moves });
  let opp = '';
  if (!M.ctx.solo) opp = ` · ${M.ctx.t('lvl_opp')}: ${fmt(M.oppBest)}`;
  M.infoEl.innerHTML = `<span class="text-slate-300 font-semibold">${M.ctx.t('lvl_target')}: ${fmt(c.target)}</span> · ${M.ctx.t('lvl_best')} ${fmt(M.best)}${opp} <span class="float-right tabular-nums">${right}</span>`;
}
function boardGrid(ctx) {
  const n = M.cfg.size;
  M.cells = [];
  const grid = ctx.el('div', 'grid gap-2 p-2 rounded-xl bg-slate-900 touch-none max-w-xs mx-auto');
  grid.style.gridTemplateColumns = `repeat(${n}, minmax(0, 1fr))`;
  for (let y = 0; y < n; y++) { M.cells[y] = []; for (let x = 0; x < n; x++) { const c = ctx.el('div', ''); M.cells[y][x] = c; grid.appendChild(c); } }
  let sx = 0, sy = 0;
  grid.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
  grid.addEventListener('touchend', (e) => { const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy; if (Math.abs(dx) < 20 && Math.abs(dy) < 20) return; move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up')); }, { passive: true });
  return grid;
}

function renderSelect(ctx) {
  clearTimer();
  const p = progress();
  const root = ctx.root; root.innerHTML = '';
  const wrap = ctx.el('div', 'max-w-md mx-auto space-y-3');
  wrap.appendChild(ctx.el('div', 'text-center', `<div class="text-sm text-slate-400">${ctx.t('lvl_progress', { lvl: p.unlocked, stars: p.totalStars, score: fmt(p.score || 0) })}</div>`));
  if (M.chapterView == null) M.chapterView = Math.floor((p.unlocked - 1) / 25);
  const nav = ctx.el('div', 'flex items-center justify-between gap-2');
  const prev = ctx.el('button', 'px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 font-semibold', '◀');
  const next = ctx.el('button', 'px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 font-semibold', '▶');
  const chName = level2048Config(M.chapterView * 25 + 1).name.replace(/ \d+$/, '');
  const title = ctx.el('div', 'flex-1 text-center font-display font-bold', `${ctx.t('lvl_chapter')} ${M.chapterView + 1} · ${chName}`);
  prev.disabled = M.chapterView <= 0;
  prev.onclick = () => { M.chapterView--; renderSelect(ctx); };
  next.onclick = () => { M.chapterView++; renderSelect(ctx); };
  nav.append(prev, title, next); wrap.appendChild(nav);
  const grid = ctx.el('div', 'grid grid-cols-5 gap-2');
  for (let i = 0; i < 25; i++) {
    const n = M.chapterView * 25 + i + 1;
    const rec = p.levels[n], locked = n > (p.unlocked || 1), boss = n % 10 === 0;
    const b = ctx.el('button', 'aspect-square rounded-lg flex flex-col items-center justify-center text-sm font-bold transition ' +
      (locked ? 'bg-slate-900 text-slate-600' : rec ? 'bg-slate-800 hover:bg-slate-700' : 'bg-emerald-600 hover:bg-emerald-500') + (boss ? ' ring-1 ring-amber-400/60' : ''));
    b.innerHTML = locked ? '🔒' : `<span>${n}</span>${rec ? `<span class="text-[9px] text-amber-400 leading-none">${starStr(rec.stars)}</span>` : ''}`;
    if (!locked) b.onclick = () => startLevel(ctx, n);
    grid.appendChild(b);
  }
  wrap.appendChild(grid);
  // jump-to
  const jump = ctx.el('div', 'flex gap-2 justify-center pt-1');
  const inp = ctx.el('input', 'w-24 py-2 px-3 rounded-lg bg-slate-800 text-center focus:outline-none focus:ring-2 focus:ring-emerald-500');
  inp.type = 'number'; inp.min = '1'; inp.placeholder = '#';
  const go = ctx.el('button', 'px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 font-semibold text-sm', ctx.t('lvl_jump'));
  go.onclick = () => { const v = Math.max(1, Math.min(p.unlocked || 1, parseInt(inp.value, 10) || 1)); startLevel(ctx, v); };
  jump.append(inp, go); wrap.appendChild(jump);
  root.appendChild(wrap);
  M.view = 'select';
}
function renderPlay(ctx) {
  const root = ctx.root; root.innerHTML = '';
  const wrap = ctx.el('div', 'max-w-md mx-auto space-y-3 select-none');
  wrap.appendChild(ctx.el('p', 'text-center font-display font-bold', `${ctx.t('lvl_level')} ${M.n} · ${M.cfg.name}${M.cfg.boss ? ' 👑' : ''}`));
  M.infoEl = ctx.el('p', 'text-xs text-slate-400 px-1'); wrap.appendChild(M.infoEl);
  M.boardEl = boardGrid(ctx); wrap.appendChild(M.boardEl);
  wrap.appendChild(ctx.el('p', 'text-center text-slate-600 text-xs', ctx.t('swipe_keys')));
  if (ctx.solo) {
    const row = ctx.el('div', 'grid grid-cols-2 gap-2');
    const retry = ctx.el('button', 'py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 font-semibold text-sm', '↻ ' + ctx.t('retry'));
    retry.onclick = () => startLevel(ctx, M.n);
    const back = ctx.el('button', 'py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 font-semibold text-sm', '≡ ' + ctx.t('lvl_levels'));
    back.onclick = () => renderSelect(ctx);
    row.append(retry, back); wrap.appendChild(row);
  }
  root.appendChild(wrap);
  M.view = 'play';
  paintBoard();
}
function renderResult(ctx, cleared, stars, reward) {
  const root = ctx.root; root.innerHTML = '';
  const wrap = ctx.el('div', 'max-w-md mx-auto space-y-4 text-center pt-6');
  if (cleared) {
    wrap.appendChild(ctx.el('div', 'text-5xl', '🏆'));
    wrap.appendChild(ctx.el('h2', 'text-2xl font-display font-black', ctx.t('lvl_cleared')));
    wrap.appendChild(ctx.el('div', 'text-3xl text-amber-400', starStr(stars)));
    wrap.appendChild(ctx.el('p', 'text-slate-300', `${ctx.t('lvl_best')} ${fmt(M.best)} · ${fmt(M.score)} ${ctx.t('pts')}`));
    if (reward && (reward.coinGain || reward.xpGain)) wrap.appendChild(ctx.el('p', 'text-sm', `<span class="text-amber-300">+${reward.coinGain} 🪙</span> · <span class="text-emerald-300">+${reward.xpGain} XP</span>`));
    const row = ctx.el('div', 'grid grid-cols-2 gap-2 pt-2');
    const nextBtn = ctx.el('button', 'py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-semibold', ctx.t('lvl_next') + ' →');
    nextBtn.onclick = () => startLevel(ctx, M.n + 1);
    const back = ctx.el('button', 'py-3 rounded-xl bg-slate-800 hover:bg-slate-700 font-semibold', ctx.t('lvl_levels'));
    back.onclick = () => renderSelect(ctx);
    row.append(nextBtn, back); wrap.appendChild(row);
  } else {
    wrap.appendChild(ctx.el('div', 'text-5xl', '💥'));
    wrap.appendChild(ctx.el('h2', 'text-xl font-display font-black', ctx.t('lvl_failed')));
    wrap.appendChild(ctx.el('p', 'text-slate-400 text-sm', `${ctx.t('lvl_best')} ${fmt(M.best)} / ${ctx.t('lvl_target')} ${fmt(M.cfg.target)}`));
    const row = ctx.el('div', 'grid grid-cols-2 gap-2 pt-2');
    const retry = ctx.el('button', 'py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-semibold', '↻ ' + ctx.t('retry'));
    retry.onclick = () => startLevel(ctx, M.n);
    const back = ctx.el('button', 'py-3 rounded-xl bg-slate-800 hover:bg-slate-700 font-semibold', ctx.t('lvl_levels'));
    back.onclick = () => renderSelect(ctx);
    row.append(retry, back); wrap.appendChild(row);
  }
  root.appendChild(wrap);
  M.view = 'result';
}

// ---------- flow ----------
function clearTimer() { if (M.timer) { clearInterval(M.timer); M.timer = null; } }
function startTimer(ctx) {
  clearTimer();
  if (M.cfg.limitType !== 'time') return;
  M.timer = setInterval(() => { M.timeLeft--; paintInfo(); if (M.timeLeft <= 0) { clearTimer(); onFail(ctx); } }, 1000);
}
function startLevel(ctx, n) {
  M.n = Math.max(1, n); M.cfg = level2048Config(M.n);
  resetPlay(); renderPlay(ctx); startTimer(ctx);
}
function move(dir) {
  const ctx = M.ctx;
  if (M.view !== 'play' || M.myDone) return;
  const r = move2048Walls(M.board, dir, M.walls);
  if (!r.moved) return;
  M.board = r.board; M.score += r.score; M.moves++; spawn(M.board); ctx.sound('click'); paintBoard();
  if (!ctx.solo) ctx.send('stat', { best: M.best, score: M.score });
  if (M.best >= M.cfg.target) return onWin(ctx);
  if (M.cfg.limitType === 'moves' && M.moves >= M.cfg.limit) return onFail(ctx);
  if (!has2048MoveWalls(M.board, M.walls)) return onFail(ctx);
}
function onWin(ctx) {
  M.myDone = true; clearTimer();
  if (!ctx.solo) { ctx.send('win', { best: M.best, score: M.score }); return ctx.endGame('win', `${ctx.t('lvl_target')} ${fmt(M.cfg.target)}!`, { perfBonus: perfBonus() }); }
  ctx.sound('win');
  const used = M.moves;
  const stars = stars2048(M.cfg.par, used);
  const p = progress(); const prev = p.levels[M.n]; const firstClear = !prev;
  p.levels[M.n] = { stars: Math.max(prev ? prev.stars : 0, stars), bestScore: Math.max(prev ? prev.bestScore : 0, M.score), bestMoves: prev ? Math.min(prev.bestMoves || 1e9, used) : used };
  p.unlocked = Math.max(p.unlocked || 1, M.n + 1);
  p.totalStars = Object.values(p.levels).reduce((a, l) => a + (l.stars || 0), 0);
  if (firstClear) p.score = (p.score || 0) + M.score;
  writeProg(p);
  let reward = null;
  if (firstClear) { const coins = 12 + M.cfg.exp * 3 + stars * 6, xp = 8 + M.cfg.exp * 2 + stars * 4; reward = earnForResult('win', 0, { coins, xp }); try { questEvent({ played: 1, win: true, gameId: 'level2048' }); } catch (e) {} }
  renderResult(ctx, true, stars, reward);
}
function onFail(ctx) {
  M.myDone = true; clearTimer();
  if (!ctx.solo) { ctx.send('done', { best: M.best, score: M.score }); return resolveRace(ctx); }
  ctx.sound('lose'); renderResult(ctx, false, 0, null);
}
function resolveRace(ctx) {
  if (!(M.myDone && M.oppDone)) return;
  const outcome = M.best > M.oppBest ? 'win' : M.best < M.oppBest ? 'lose' : (M.score > M.oppScore ? 'win' : M.score < M.oppScore ? 'lose' : 'draw');
  const close = outcome === 'lose' && (M.best === M.oppBest || Math.abs(M.score - M.oppScore) <= Math.max(M.score, M.oppScore, 1) * 0.15);
  ctx.endGame(outcome, `${fmt(M.best)} — ${fmt(M.oppBest)}`, { close, perfBonus: perfBonus() });
}
function bindKeys(ctx) {
  M.keyHandler = (e) => { const k = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' }[e.key]; if (k) { e.preventDefault(); move(k); } };
  document.addEventListener('keydown', M.keyHandler);
}

export default {
  id: 'level2048', name: '2048 Levels', emoji: '🧩', blurb: '1000+ levels · race a level', usesTurns: false, soloCampaign: true,
  options: [{ key: 'level', label: 'Race level', choices: [{ label: 'Lvl 1', value: 1 }, { label: 'Lvl 25', value: 25 }, { label: 'Lvl 100', value: 100 }, { label: 'Lvl 500', value: 500 }, { label: 'Lvl 1000', value: 1000 }], default: 25 }],
  start(ctx) {
    M.ctx = ctx; M.chapterView = null; bindKeys(ctx);
    if (ctx.solo) { renderSelect(ctx); return; }
    M.n = ctx.config.level || 1; M.cfg = level2048Config(M.n);
    M.oppBest = 0; M.oppScore = 0; M.oppDone = false;
    resetPlay(); renderPlay(ctx); startTimer(ctx);
  },
  onMessage(msg, ctx) {
    if (msg.type === 'stat') { M.oppBest = msg.best; M.oppScore = msg.score; paintInfo(); }
    else if (msg.type === 'done') { M.oppDone = true; M.oppBest = msg.best; M.oppScore = msg.score || 0; resolveRace(ctx); }
    else if (msg.type === 'win') { M.oppBest = msg.best; M.oppScore = msg.score; ctx.endGame('lose', ctx.t('lvl_opp_won')); }
  },
  stop() { clearTimer(); if (M.keyHandler) { document.removeEventListener('keydown', M.keyHandler); M.keyHandler = null; } },
  getState() { return null; },   // solo owns persistence; online race is not resumable
};
