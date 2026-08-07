import { move2048Tracked, has2048MoveWalls, level2048Config, stars2048 } from '../logic.js?v=40';
import { earnForResult, questEvent } from '../loyalty.js?v=40';
import { makeTileBoard } from './tileboard.js?v=40';

// 2048 Levels — a self-contained campaign (1000+ generated levels) plus a head-to-head "race the same level" mode.
// Solo owns ctx.root across three views (select → play → result). Rendering uses the shared animated tile board.
const KEY = 'arcade:2048campaign';
// Each chapter gets its own hue family; tiles within a level ramp by value → distinct, evolving look.
const THEME_HUES = [140, 200, 25, 280, 330, 50, 190, 0, 260, 160];
function themeTile(theme) {
  const hue = THEME_HUES[theme % THEME_HUES.length];
  return (v) => { if (!v) return { bg: '', fg: '' }; const exp = Math.log2(v); const light = Math.max(34, 72 - exp * 3.2); return { bg: `hsl(${hue} 68% ${light}%)`, fg: light > 56 ? '#0f172a' : '#f8fafc' }; };
}
const themeBoardBg = (theme) => `hsl(${THEME_HUES[theme % THEME_HUES.length]} 32% 11%)`;

const M = { view: 'select', n: 1, cfg: null, board: [], wallSet: new Set(), frozenSet: new Set(), score: 0, moves: 0, best: 0,
  timeLeft: 0, timer: null, tb: null, infoEl: null, chapterView: null, myDone: false, oppBest: 0, oppScore: 0, oppDone: false, ctx: null, keyHandler: null };

const readProg = () => { try { const s = localStorage.getItem(KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; } };
const writeProg = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) {} };
const progress = () => readProg() || { unlocked: 1, score: 0, totalStars: 0, levels: {} };
const fmt = (v) => v >= 1000 ? (v / 1000).toFixed(v >= 10000 ? 0 : 1) + 'k' : String(v);
const starStr = (s) => '★★★'.slice(0, s) + '☆☆☆'.slice(0, 3 - s);
function perfBonus() { if (M.best < 8) return null; const k = Math.floor(Math.log2(M.best)); return { coins: (k - 2) * 3, xp: (k - 2) * 4 }; }

function emptySpawnCells() { const e = [], n = M.cfg.size; for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (!M.board[y][x] && !M.wallSet.has(x + ',' + y)) e.push([x, y]); return e; }
function spawnCell() { const e = emptySpawnCells(); if (!e.length) return null; const [x, y] = e[Math.floor(Math.random() * e.length)]; const v = Math.random() < (M.cfg.spawnFour || 0.1) ? 4 : 2; M.board[y][x] = v; return [x, y, v]; }
function maxTile() { let m = 0; for (const r of M.board) for (const v of r) if (v > m) m = v; return m; }
function resetPlay() {
  const c = M.cfg, n = c.size, b = Array.from({ length: n }, () => Array(n).fill(0));
  M.wallSet = new Set(c.walls.map(([x, y]) => x + ',' + y));
  M.frozenSet = new Set((c.frozen || []).map((p) => p.x + ',' + p.y));
  for (const p of c.preset) if (!M.wallSet.has(p.x + ',' + p.y)) b[p.y][p.x] = p.v;
  for (const p of (c.frozen || [])) if (!M.wallSet.has(p.x + ',' + p.y)) b[p.y][p.x] = p.v;
  M.board = b; M.score = 0; M.moves = 0; M.myDone = false;
  spawnCell(); spawnCell(); M.best = maxTile();
  M.timeLeft = c.limitType === 'time' ? c.limit : 0;
}

function paintInfo() {
  if (!M.infoEl) return;
  const c = M.cfg;
  let right = c.limitType === 'moves' ? M.ctx.t('lvl_moves_left', { n: Math.max(0, c.limit - M.moves) })
    : c.limitType === 'time' ? Math.floor(M.timeLeft / 60) + ':' + String(M.timeLeft % 60).padStart(2, '0')
      : M.ctx.t('lvl_moves_used', { n: M.moves });
  const opp = M.ctx.solo ? '' : ` · ${M.ctx.t('lvl_opp')}: ${fmt(M.oppBest)}`;
  M.infoEl.innerHTML = `<span class="text-slate-200 font-semibold">${M.ctx.t('lvl_target')}: ${fmt(c.target)}</span> · ${M.ctx.t('lvl_best')} ${fmt(M.best)}${opp} <span class="float-right tabular-nums">${right}</span>`;
}
function destroyBoard() { if (M.tb) { M.tb.destroy(); M.tb = null; } }
function mountBoard(ctx, mount) {
  destroyBoard();
  M.tb = makeTileBoard(ctx, { size: M.cfg.size, walls: M.cfg.walls, frozen: M.cfg.frozen ? M.cfg.frozen.map((p) => [p.x, p.y]) : [], tileStyle: themeTile(M.cfg.theme), boardBg: themeBoardBg(M.cfg.theme), mount });
  M.tb.sync(M.board, [...M.frozenSet].map((k) => k.split(',').map(Number)));
  let sx = 0, sy = 0;
  M.tb.el.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
  M.tb.el.addEventListener('touchend', (e) => { const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy; if (Math.abs(dx) < 20 && Math.abs(dy) < 20) return; move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up')); }, { passive: true });
}

function renderSelect(ctx) {
  clearTimer(); destroyBoard();
  const p = progress(), root = ctx.root; root.innerHTML = '';
  if (M.chapterView == null) M.chapterView = Math.floor((p.unlocked - 1) / 25);
  const wrap = ctx.el('div', 'max-w-md mx-auto space-y-3');
  wrap.appendChild(ctx.el('div', 'text-center text-sm text-slate-400', ctx.t('lvl_progress', { lvl: p.unlocked, stars: p.totalStars, score: fmt(p.score || 0) })));
  const nav = ctx.el('div', 'flex items-center justify-between gap-2');
  const prev = ctx.el('button', 'px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 font-semibold', '◀');
  const next = ctx.el('button', 'px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 font-semibold', '▶');
  const chName = level2048Config(M.chapterView * 25 + 1).name.replace(/ \d+$/, '');
  nav.append(prev, ctx.el('div', 'flex-1 text-center font-display font-bold', `${ctx.t('lvl_chapter')} ${M.chapterView + 1} · ${chName}`), next);
  prev.disabled = M.chapterView <= 0;
  prev.onclick = () => { M.chapterView--; renderSelect(ctx); };
  next.onclick = () => { M.chapterView++; renderSelect(ctx); };
  wrap.appendChild(nav);
  const grid = ctx.el('div', 'grid grid-cols-5 gap-2');
  for (let i = 0; i < 25; i++) {
    const n = M.chapterView * 25 + i + 1, rec = p.levels[n], locked = n > (p.unlocked || 1), boss = n % 10 === 0;
    const b = ctx.el('button', 'aspect-square rounded-lg flex flex-col items-center justify-center text-sm font-bold transition ' +
      (locked ? 'bg-slate-900 text-slate-600' : rec ? 'bg-slate-800 hover:bg-slate-700' : 'bg-emerald-600 hover:bg-emerald-500') + (boss ? ' ring-1 ring-amber-400/60' : ''));
    b.innerHTML = locked ? '🔒' : `<span>${n}</span>${rec ? `<span class="text-[9px] text-amber-400 leading-none">${starStr(rec.stars)}</span>` : ''}`;
    if (!locked) b.onclick = () => startLevel(ctx, n);
    grid.appendChild(b);
  }
  wrap.appendChild(grid);
  const jump = ctx.el('div', 'flex gap-2 justify-center pt-1');
  const inp = ctx.el('input', 'w-24 py-2 px-3 rounded-lg bg-slate-800 text-center focus:outline-none focus:ring-2 focus:ring-emerald-500');
  inp.type = 'number'; inp.min = '1'; inp.placeholder = '#';
  const go = ctx.el('button', 'px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 font-semibold text-sm', ctx.t('lvl_jump'));
  go.onclick = () => startLevel(ctx, Math.max(1, Math.min(p.unlocked || 1, parseInt(inp.value, 10) || 1)));
  jump.append(inp, go); wrap.appendChild(jump);
  root.appendChild(wrap);
  M.view = 'select';
}
function renderPlay(ctx) {
  const root = ctx.root; root.innerHTML = '';
  const wrap = ctx.el('div', 'mx-auto space-y-3 select-none'); wrap.style.maxWidth = '26rem';
  wrap.appendChild(ctx.el('p', 'text-center font-display font-bold', `${ctx.t('lvl_level')} ${M.n} · ${M.cfg.name}${M.cfg.boss ? ' 👑' : ''}`));
  M.infoEl = ctx.el('p', 'text-xs text-slate-400 px-1'); wrap.appendChild(M.infoEl);
  const mount = ctx.el('div', ''); wrap.appendChild(mount);
  wrap.appendChild(ctx.el('p', 'text-center text-slate-600 text-xs', ctx.t('swipe_keys')));
  if (ctx.solo) {
    const row = ctx.el('div', 'max-w-xs mx-auto grid grid-cols-2 gap-2');
    const retry = ctx.el('button', 'py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 font-semibold text-sm', '↻ ' + ctx.t('retry'));
    retry.onclick = () => startLevel(ctx, M.n);
    const back = ctx.el('button', 'py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 font-semibold text-sm', '≡ ' + ctx.t('lvl_levels'));
    back.onclick = () => renderSelect(ctx);
    row.append(retry, back); wrap.appendChild(row);
  }
  root.appendChild(wrap);
  M.view = 'play';
  mountBoard(ctx, mount);
  paintInfo();
}
function renderResult(ctx, cleared, stars, reward) {
  const root = ctx.root; root.innerHTML = '';
  const wrap = ctx.el('div', 'max-w-md mx-auto space-y-4 text-center pt-6');
  if (cleared) {
    wrap.append(ctx.el('div', 'text-5xl', '🏆'), ctx.el('h2', 'text-2xl font-display font-black', ctx.t('lvl_cleared')),
      ctx.el('div', 'text-3xl text-amber-400', starStr(stars)), ctx.el('p', 'text-slate-300', `${ctx.t('lvl_best')} ${fmt(M.best)} · ${fmt(M.score)} ${ctx.t('pts')}`));
    if (reward && (reward.coinGain || reward.xpGain)) wrap.appendChild(ctx.el('p', 'text-sm', `<span class="text-amber-300">+${reward.coinGain} 🪙</span> · <span class="text-emerald-300">+${reward.xpGain} XP</span>`));
    const row = ctx.el('div', 'grid grid-cols-2 gap-2 pt-2');
    const nextBtn = ctx.el('button', 'py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-semibold', ctx.t('lvl_next') + ' →');
    nextBtn.onclick = () => startLevel(ctx, M.n + 1);
    const back = ctx.el('button', 'py-3 rounded-xl bg-slate-800 hover:bg-slate-700 font-semibold', ctx.t('lvl_levels'));
    back.onclick = () => renderSelect(ctx);
    row.append(nextBtn, back); wrap.appendChild(row);
  } else {
    wrap.append(ctx.el('div', 'text-5xl', '💥'), ctx.el('h2', 'text-xl font-display font-black', ctx.t('lvl_failed')),
      ctx.el('p', 'text-slate-400 text-sm', `${ctx.t('lvl_best')} ${fmt(M.best)} / ${ctx.t('lvl_target')} ${fmt(M.cfg.target)}`));
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

function clearTimer() { if (M.timer) { clearInterval(M.timer); M.timer = null; } }
function startTimer(ctx) { clearTimer(); if (M.cfg.limitType !== 'time') return; M.timer = setInterval(() => { M.timeLeft--; paintInfo(); if (M.timeLeft <= 0) { clearTimer(); onFail(ctx); } }, 1000); }
function startLevel(ctx, n) { M.n = Math.max(1, n); M.cfg = level2048Config(M.n); resetPlay(); renderPlay(ctx); startTimer(ctx); }
function thawAround(x, y) {
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const k = (x + dx) + ',' + (y + dy);
    if (M.frozenSet.has(k)) { M.frozenSet.delete(k); if (M.tb) M.tb.thaw(x + dx, y + dy); }
  }
}
function move(dir) {
  const ctx = M.ctx;
  if (M.view !== 'play' || M.myDone) return;
  const res = move2048Tracked(M.board, dir, M.cfg.walls, M.frozenSet);
  if (!res.moved) return;
  M.board = res.board; M.score += res.score; M.moves++;
  if (M.tb) M.tb.animate(res.moves);
  ctx.sound('click');
  const sp = spawnCell(); if (sp && M.tb) M.tb.spawnAt(sp[0], sp[1], sp[2]);
  for (const m of res.moves) if (m.merged) thawAround(m.toX, m.toY);
  M.best = Math.max(M.best, res.max, maxTile()); paintInfo();
  if (!ctx.solo) ctx.send('stat', { best: M.best, score: M.score });
  if (M.best >= M.cfg.target) return onWin(ctx);
  if (M.cfg.limitType === 'moves' && M.moves >= M.cfg.limit) return onFail(ctx);
  if (!has2048MoveWalls(M.board, M.cfg.walls, M.frozenSet)) return onFail(ctx);
}
function onWin(ctx) {
  M.myDone = true; clearTimer();
  if (!ctx.solo) { ctx.send('win', { best: M.best, score: M.score }); return ctx.endGame('win', `${ctx.t('lvl_target')} ${fmt(M.cfg.target)}!`, { perfBonus: perfBonus() }); }
  ctx.sound('win');
  const stars = stars2048(M.cfg.par, M.moves);
  const p = progress(), prev = p.levels[M.n], firstClear = !prev;
  p.levels[M.n] = { stars: Math.max(prev ? prev.stars : 0, stars), bestScore: Math.max(prev ? prev.bestScore : 0, M.score), bestMoves: prev ? Math.min(prev.bestMoves || 1e9, M.moves) : M.moves };
  p.unlocked = Math.max(p.unlocked || 1, M.n + 1);
  p.totalStars = Object.values(p.levels).reduce((a, l) => a + (l.stars || 0), 0);
  if (firstClear) p.score = (p.score || 0) + M.score;
  writeProg(p);
  let reward = null;
  if (firstClear) { const coins = 12 + M.cfg.exp * 3 + stars * 6, xp = 8 + M.cfg.exp * 2 + stars * 4; reward = earnForResult('win', 0, { coins, xp }); try { questEvent({ played: 1, win: true, gameId: 'level2048' }); } catch (e) {} }
  setTimeout(() => renderResult(ctx, true, stars, reward), 320);
}
function onFail(ctx) {
  M.myDone = true; clearTimer();
  if (!ctx.solo) { ctx.send('done', { best: M.best, score: M.score }); return resolveRace(ctx); }
  ctx.sound('lose'); setTimeout(() => renderResult(ctx, false, 0, null), 220);
}
function resolveRace(ctx) {
  if (!(M.myDone && M.oppDone)) return;
  const outcome = M.best > M.oppBest ? 'win' : M.best < M.oppBest ? 'lose' : (M.score > M.oppScore ? 'win' : M.score < M.oppScore ? 'lose' : 'draw');
  const close = outcome === 'lose' && (M.best === M.oppBest || Math.abs(M.score - M.oppScore) <= Math.max(M.score, M.oppScore, 1) * 0.15);
  ctx.endGame(outcome, `${fmt(M.best)} — ${fmt(M.oppBest)}`, { close, perfBonus: perfBonus() });
}
function bindKeys() { M.keyHandler = (e) => { const k = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' }[e.key]; if (k) { e.preventDefault(); move(k); } }; document.addEventListener('keydown', M.keyHandler); }

export default {
  id: 'level2048', name: '2048 Levels', emoji: '🧩', blurb: '1000+ levels · race a level', usesTurns: false, soloCampaign: true,
  options: [{ key: 'level', label: 'Race level', choices: [{ label: 'Lvl 1', value: 1 }, { label: 'Lvl 25', value: 25 }, { label: 'Lvl 100', value: 100 }, { label: 'Lvl 500', value: 500 }, { label: 'Lvl 1000', value: 1000 }], default: 25 }],
  start(ctx) {
    M.ctx = ctx; M.chapterView = null; bindKeys();
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
  stop() { clearTimer(); destroyBoard(); if (M.keyHandler) { document.removeEventListener('keydown', M.keyHandler); M.keyHandler = null; } },
  getState() { return null; },
};
