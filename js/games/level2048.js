import { move2048Tracked, has2048MoveWalls, level2048Config, stars2048 } from '../logic.js?v=46';
import { earnForResult, questEvent, getCoins, spendCoins } from '../loyalty.js?v=46';
import { makeTileBoard } from './tileboard.js?v=46';
import { getBoard, publishScore, isOnline } from '../presence.js?v=46';
import { myProfileSummary, openPeerProfile } from '../profile.js?v=46';

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// 2048 Levels — campaign (1000+ generated levels) + head-to-head race. Solo owns ctx.root across views.
const KEY = 'arcade:2048campaign';

// ---------- curated per-level palettes (each value a distinct, harmonious color) ----------
const PALETTES = [
  ['#ffd98a', '#ffbf6b', '#ffa15c', '#ff7f5c', '#ff5e73', '#ef4c8b', '#cf47a6', '#a544c0', '#7b46cf', '#5a4fd6', '#3f63cf', '#3f86c9', '#46b0c0'], // Sunset
  ['#d7f6ff', '#a9e7fb', '#7cd2f2', '#55b8e8', '#3f9bda', '#2f80c6', '#2266b0', '#1b5099', '#17417d', '#123566', '#0f2c54', '#0d2444', '#0b1d38'], // Ocean
  ['#eef9c9', '#d3f0a0', '#b3e56a', '#8fd857', '#64c94b', '#3fb552', '#1fa05c', '#128a63', '#0e7a66', '#0d6a66', '#0c5b60', '#0b4d55', '#0a4048'], // Forest
  ['#f2e6d4', '#f4d9b0', '#f7bd77', '#f6a15c', '#f4854f', '#ef6a45', '#e64f3f', '#d43f57', '#b83f79', '#9a3f95', '#7d3fa8', '#613fb0', '#4a3690'], // Ember
  ['#c9fff0', '#9bf6dd', '#6fead0', '#4fdccb', '#3fc9db', '#3fa9e3', '#3f88e3', '#4f66e3', '#6f47e0', '#9040d6', '#b03fc6', '#c93fa6', '#d43f86'], // Aurora
  ['#ffe3f1', '#ffc2e2', '#ff9ed2', '#ff7abd', '#ff5aa6', '#f43f93', '#d63fa2', '#b23fb4', '#8f3fc2', '#6f3fcb', '#5142cf', '#3f5fc4', '#3f86b0'], // Candy
  ['#fff3c4', '#ffe08a', '#ffcf5c', '#f6b73c', '#e79b2f', '#cf7f2f', '#b6642f', '#944e3f', '#6f4a63', '#524a86', '#3f52a8', '#3f6fc0', '#3f97c9'], // Royal
  ['#ffe0ec', '#ffb8d4', '#ff8fbf', '#f56aab', '#e04f9c', '#c43f98', '#a33f9e', '#7f3faa', '#5f3fb2', '#4a3fba', '#3f52b0', '#3f74a0', '#3f9488'], // Berry
  ['#eef1f6', '#d6dde7', '#b8c2d1', '#97a3b8', '#7a889f', '#616f88', '#4d5b72', '#6a5750', '#8a6a45', '#ad853f', '#d0a63f', '#ecc457', '#ffe07a'], // Mono-lux
  ['#aeffe0', '#7bff6b', '#c8ff4f', '#ffe14f', '#ffb14f', '#ff6f6f', '#ff4fa8', '#e84ff0', '#a84fff', '#6f6fff', '#4fb0ff', '#4fe8ff', '#4fffd0'], // Neon
];
function lum(hex) { const h = hex.replace('#', ''); const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; }
const textFor = (hex) => lum(hex) > 0.6 ? '#1e293b' : '#f8fafc';
const paletteFor = (n) => PALETTES[(n * 5) % PALETTES.length];
function tileStyleFor(pal) { return (v) => { if (!v) return { bg: '', fg: '' }; const i = Math.max(0, Math.min(12, Math.floor(Math.log2(v)) - 1)); const bg = pal[i]; return { bg, fg: textFor(bg) }; }; }
const BOARD_BG = '#0b1020';

// ---------- help tools ----------
const SVG = (p) => `<svg viewBox="0 0 24 24" class="w-5 h-5 mx-auto" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const ICONS = {
  undo: SVG('<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>'),
  swap: SVG('<path d="M7 4 3 8l4 4"/><path d="M3 8h13"/><path d="M17 20l4-4-4-4"/><path d="M21 16H8"/>'),
  delete: SVG('<path d="M4 7h16"/><path d="M9 7V5h6v2"/><path d="M6 7l1 13h10l1-13"/>'),
  move: SVG('<path d="M12 3v18M3 12h18"/><path d="M12 3 9 6M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/>'),
  add: SVG('<path d="M12 5v14M5 12h14"/>'),
  double: '<span class="font-black text-sm">×2</span>',
  bomb: SVG('<circle cx="10.5" cy="14.5" r="6"/><path d="M15 9l2-2M17 6l2-1M17 6l1-2"/>'),
  shuffle: SVG('<path d="M3 7h4l10 10h4"/><path d="M17 7h4l-3-3M18 20l3-3h-4M3 17h4l3-3"/>'),
};
const TOOLS = [
  { key: 'undo', kind: 'instant', milestone: 128, price: 20 },
  { key: 'swap', kind: 'twoTile', milestone: 256, price: 40 },
  { key: 'delete', kind: 'tile', milestone: 512, price: 40 },
  { key: 'move', kind: 'moveTile', milestone: 1024, price: 50 },
  { key: 'add', kind: 'empty', milestone: 2048, price: 30 },
  { key: 'double', kind: 'tile', milestone: 4096, price: 60 },
  { key: 'bomb', kind: 'tile', milestone: 8192, price: 80 },
  { key: 'shuffle', kind: 'instant', milestone: 0, price: 40 },
];
const DEFAULT_TOOLS = { undo: 3, swap: 1, delete: 1, move: 1, add: 1, double: 1, bomb: 1, shuffle: 1 };

const M = { view: 'select', n: 1, cfg: null, pal: null, board: [], wallSet: new Set(), frozenSet: new Set(), score: 0, moves: 0, best: 0,
  timeLeft: 0, timer: null, tb: null, infoEl: null, powersEl: null, chapterView: null,
  tools: {}, milestones: new Set(), powerMode: null, selCell: null, undoSnap: null, _shop: null, _card: null,
  startTs: 0, toolsUsed: 0, champShowAll: false,
  failed: false, failEl: null, myDone: false, oppBest: 0, oppScore: 0, oppDone: false, ctx: null, keyHandler: null };

const readProg = () => { try { const s = localStorage.getItem(KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; } };
const writeProg = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) {} };
const progress = () => readProg() || { unlocked: 1, score: 0, totalStars: 0, levels: {}, tools: {} };
const getTools = () => Object.assign({}, DEFAULT_TOOLS, progress().tools || {});
function saveTools() { const p = progress(); p.tools = Object.assign({}, M.tools); writeProg(p); }
const toolCount = (k) => M.tools[k] || 0;
function consume(k) { M.tools[k] = Math.max(0, (M.tools[k] || 0) - 1); M.toolsUsed++; saveTools(); }
const fmt = (v) => v >= 1000 ? (v / 1000).toFixed(v >= 10000 ? 0 : 1) + 'k' : String(v);
const starStr = (s) => '★★★'.slice(0, s) + '☆☆☆'.slice(0, 3 - s);
function perfBonus() { if (M.best < 8) return null; const k = Math.floor(Math.log2(M.best)); return { coins: (k - 2) * 3, xp: (k - 2) * 4 }; }
const mmss = (s) => (s == null || s >= 1e9) ? '—' : Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
// Players by 2048 campaign progress: the presence board (peers who broadcast c2048) + always-me from local progress.
function champList() {
  const board = (getBoard() || []).map((e) => Object.assign({}, e));
  const mine = progress(), myC = { last: mine.unlocked || 1, stars: mine.totalStars || 0 };
  const me = board.find((e) => e.isMe);
  if (me) me.prof = Object.assign({}, me.prof, { c2048: myC });
  else board.push({ isMe: true, name: M.ctx ? M.ctx.t('lvl_you') : 'You', avatar: '🎮', online: isOnline(), prof: { c2048: myC } });
  return board.filter((e) => e.prof && e.prof.c2048)
    .sort((a, b) => (b.prof.c2048.last - a.prof.c2048.last) || (b.prof.c2048.stars - a.prof.c2048.stars));
}

function emptySpawnCells() { const e = [], n = M.cfg.size; for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (!M.board[y][x] && !M.wallSet.has(x + ',' + y)) e.push([x, y]); return e; }
function spawnCell() { const e = emptySpawnCells(); if (!e.length) return null; const [x, y] = e[Math.floor(Math.random() * e.length)]; const v = Math.random() < (M.cfg.spawnFour || 0.1) ? 4 : 2; M.board[y][x] = v; return [x, y, v]; }
function maxTile() { let m = 0; for (const r of M.board) for (const v of r) if (v > m) m = v; return m; }
const frozenList = () => [...M.frozenSet].map((k) => k.split(',').map(Number));
function syncBoard() { if (M.tb) M.tb.sync(M.board, frozenList()); }
function resetPlay() {
  const c = M.cfg, n = c.size, b = Array.from({ length: n }, () => Array(n).fill(0));
  M.wallSet = new Set(c.walls.map(([x, y]) => x + ',' + y));
  M.frozenSet = new Set((c.frozen || []).map((p) => p.x + ',' + p.y));
  for (const p of c.preset) if (!M.wallSet.has(p.x + ',' + p.y)) b[p.y][p.x] = p.v;
  for (const p of (c.frozen || [])) if (!M.wallSet.has(p.x + ',' + p.y)) b[p.y][p.x] = p.v;
  M.board = b; M.score = 0; M.moves = 0; M.myDone = false; M.failed = false;
  M.startTs = Date.now(); M.toolsUsed = 0;
  M.tools = getTools(); M.milestones = new Set(); M.powerMode = null; M.selCell = null; M.undoSnap = null;
  spawnCell(); spawnCell(); M.best = maxTile();
  M.timeLeft = c.limitType === 'time' ? c.limit : 0;
}

function paintInfo() {
  if (!M.infoEl) return;
  const c = M.cfg;
  const right = c.limitType === 'moves' ? M.ctx.t('lvl_moves_left', { n: Math.max(0, c.limit - M.moves) })
    : c.limitType === 'time' ? Math.floor(M.timeLeft / 60) + ':' + String(M.timeLeft % 60).padStart(2, '0')
      : M.ctx.t('lvl_moves_used', { n: M.moves });
  const opp = M.ctx.solo ? '' : ` · ${M.ctx.t('lvl_opp')}: ${fmt(M.oppBest)}`;
  M.infoEl.innerHTML = `<span class="text-slate-200 font-semibold">${M.ctx.t('lvl_target')}: ${fmt(c.target)}</span> · ${M.ctx.t('lvl_best')} ${fmt(M.best)}${opp} <span class="float-right tabular-nums">${right}</span>`;
}
function renderTray() {
  if (!M.powersEl) return;
  M.powersEl.innerHTML = '';
  for (const def of TOOLS) {
    const cnt = toolCount(def.key), active = M.powerMode === def.key;
    const b = M.ctx.el('button', 'relative shrink-0 w-12 h-12 rounded-xl flex items-center justify-center transition ' + (active ? 'bg-indigo-600' : cnt > 0 ? 'bg-slate-800 hover:bg-slate-700' : 'bg-slate-900 text-slate-600'));
    b.innerHTML = `${ICONS[def.key]}<span class="absolute top-0.5 right-1 text-[10px] font-bold ${cnt > 0 ? 'text-amber-400' : 'text-slate-600'}">${cnt}</span>`;
    b.title = M.ctx.t('lvl_pw_' + def.key);
    if (!M.myDone) b.onclick = () => toggleTool(def.key);
    M.powersEl.appendChild(b);
  }
  const shop = M.ctx.el('button', 'shrink-0 w-12 h-12 rounded-xl bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-lg', '🛒');
  shop.title = M.ctx.t('lvl_shop'); shop.onclick = () => openShop(); M.powersEl.appendChild(shop);
  const next = TOOLS.find((t) => t.milestone && !M.milestones.has(t.milestone));
  const hintEl = M.powersEl.parentNode && M.powersEl.parentNode.querySelector('[data-pw-hint]');
  if (hintEl) hintEl.textContent = next ? M.ctx.t('lvl_pw_hint', { tile: fmt(next.milestone), name: M.ctx.t('lvl_pw_' + next.key) }) : '';
}
function destroyBoard() { if (M.tb) { M.tb.destroy(); M.tb = null; } }
function mountBoard(ctx, mount) {
  destroyBoard();
  M.pal = paletteFor(M.n);
  M.tb = makeTileBoard(ctx, { size: M.cfg.size, walls: M.cfg.walls, frozen: (M.cfg.frozen || []).map((p) => [p.x, p.y]), tileStyle: tileStyleFor(M.pal), boardBg: BOARD_BG, mount });
  M.tb.sync(M.board, frozenList());
  let sx = 0, sy = 0, lastTap = 0;
  M.tb.el.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
  M.tb.el.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) < 20 && Math.abs(dy) < 20) { lastTap = e.timeStamp; if (M.powerMode) { const c = M.tb.cellAt(e.changedTouches[0].clientX, e.changedTouches[0].clientY); if (c) targetTap(c[0], c[1]); } return; }
    move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
  }, { passive: true });
  M.tb.el.addEventListener('click', (e) => { if (e.timeStamp - lastTap < 700) return; if (M.powerMode) { const c = M.tb.cellAt(e.clientX, e.clientY); if (c) targetTap(c[0], c[1]); } });
}

function renderSelect(ctx) {
  clearTimer(); destroyBoard(); closeShop(); closeLevelCard();
  const p = progress(), root = ctx.root; root.innerHTML = '';
  if (M.chapterView == null) M.chapterView = Math.floor((p.unlocked - 1) / 25);
  const wrap = ctx.el('div', 'max-w-md mx-auto space-y-3');
  wrap.appendChild(ctx.el('div', 'text-center text-sm text-slate-400', ctx.t('lvl_progress', { lvl: p.unlocked, stars: p.totalStars, score: fmt(p.score || 0) })));
  wrap.appendChild(renderChampions(ctx));
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
    const st = tileStyleFor(paletteFor(n))(16);
    const b = ctx.el('button', 'aspect-square rounded-lg flex flex-col items-center justify-center text-sm font-bold transition ' + (locked ? 'text-slate-600' : '') + (boss ? ' ring-1 ring-amber-300/70' : ''));
    if (!locked) { b.style.background = st.bg; b.style.color = st.fg; } else b.style.background = 'rgba(148,163,184,0.08)';
    b.innerHTML = locked ? '🔒' : `<span>${n}</span>${rec ? `<span class="text-[9px] leading-none opacity-80">${starStr(rec.stars)}</span>` : ''}`;
    if (!locked) b.onclick = () => openLevelCard(ctx, n);
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
  const mmss = (s) => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  const obj = M.cfg.limitType === 'moves' ? `🎯 ${fmt(M.cfg.target)} · ⟳ ${M.cfg.limit}` : M.cfg.limitType === 'time' ? `🎯 ${fmt(M.cfg.target)} · ⏱ ${mmss(M.cfg.limit)}` : `🎯 ${fmt(M.cfg.target)}`;
  wrap.appendChild(ctx.el('p', 'text-center text-slate-400 text-xs', obj));
  M.infoEl = ctx.el('p', 'text-xs text-slate-400 px-1'); wrap.appendChild(M.infoEl);
  M.failEl = ctx.el('div', 'hidden rounded-xl bg-rose-900/40 border border-rose-500/40 p-2 text-center'); wrap.appendChild(M.failEl);
  const mount = ctx.el('div', ''); wrap.appendChild(mount);
  const pwWrap = ctx.el('div', 'max-w-sm mx-auto');
  M.powersEl = ctx.el('div', 'flex gap-2 overflow-x-auto pb-1'); pwWrap.appendChild(M.powersEl);
  pwWrap.appendChild(ctx.el('p', 'text-center text-slate-500 text-[11px] mt-1', '')).setAttribute('data-pw-hint', '1');
  wrap.appendChild(pwWrap);
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
  paintInfo(); renderTray();
}
function renderResult(ctx, cleared, stars, reward) {
  closeShop();
  const root = ctx.root; root.innerHTML = '';
  const wrap = ctx.el('div', 'max-w-md mx-auto space-y-4 text-center pt-6');
  if (cleared) {
    wrap.append(ctx.el('div', 'text-5xl', '🏆'), ctx.el('h2', 'text-2xl font-display font-black', ctx.t('lvl_cleared')),
      ctx.el('div', 'text-3xl text-amber-400', starStr(stars)), ctx.el('p', 'text-slate-300', `${ctx.t('lvl_best')} ${fmt(M.best)} · ${fmt(M.score)} ${ctx.t('pts')}`));
    if (reward && (reward.coinGain || reward.xpGain)) wrap.appendChild(ctx.el('p', 'text-sm', `<span class="text-amber-300">+${reward.coinGain} 🪙</span> · <span class="text-emerald-300">+${reward.xpGain} XP</span>`));
    const roww = ctx.el('div', 'grid grid-cols-2 gap-2 pt-2');
    const nextBtn = ctx.el('button', 'py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-semibold', ctx.t('lvl_next') + ' →');
    nextBtn.onclick = () => startLevel(ctx, M.n + 1);
    const back = ctx.el('button', 'py-3 rounded-xl bg-slate-800 hover:bg-slate-700 font-semibold', ctx.t('lvl_levels'));
    back.onclick = () => renderSelect(ctx);
    roww.append(nextBtn, back); wrap.appendChild(roww);
  } else {
    wrap.append(ctx.el('div', 'text-5xl', '💥'), ctx.el('h2', 'text-xl font-display font-black', ctx.t('lvl_failed')),
      ctx.el('p', 'text-slate-400 text-sm', `${ctx.t('lvl_best')} ${fmt(M.best)} / ${ctx.t('lvl_target')} ${fmt(M.cfg.target)}`));
    const roww = ctx.el('div', 'grid grid-cols-2 gap-2 pt-2');
    const retry = ctx.el('button', 'py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-semibold', '↻ ' + ctx.t('retry'));
    retry.onclick = () => startLevel(ctx, M.n);
    const back = ctx.el('button', 'py-3 rounded-xl bg-slate-800 hover:bg-slate-700 font-semibold', ctx.t('lvl_levels'));
    back.onclick = () => renderSelect(ctx);
    roww.append(retry, back); wrap.appendChild(roww);
  }
  root.appendChild(wrap);
  M.view = 'result';
}

// ---------- shop ----------
function openShop() {
  if (M._shop) return;
  const ctx = M.ctx;
  const ov = ctx.el('div', 'fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4'); M._shop = ov;
  const box = ctx.el('div', 'w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl p-4 space-y-3 max-h-[80vh] overflow-y-auto');
  const head = ctx.el('div', 'flex items-center justify-between');
  head.appendChild(ctx.el('h3', 'font-bold text-lg', ctx.t('lvl_shop')));
  const coinsEl = ctx.el('span', 'text-amber-400 font-semibold', `🪙 ${getCoins()}`); head.appendChild(coinsEl); box.appendChild(head);
  const list = ctx.el('div', 'space-y-2');
  const refresh = () => {
    coinsEl.textContent = `🪙 ${getCoins()}`; list.innerHTML = '';
    for (const def of TOOLS) {
      const row = ctx.el('div', 'flex items-center gap-2 bg-slate-800/60 rounded-xl p-2');
      row.innerHTML = `<span class="w-8 h-8 flex items-center justify-center text-slate-200">${ICONS[def.key]}</span><span class="flex-1"><span class="font-semibold text-sm">${ctx.t('lvl_pw_' + def.key)}</span> <span class="text-slate-500 text-xs">×${toolCount(def.key)}</span></span>`;
      const buy = ctx.el('button', 'px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-sm font-semibold', `🪙 ${def.price}`);
      buy.onclick = () => { if (spendCoins(def.price)) { M.tools[def.key] = (M.tools[def.key] || 0) + 1; saveTools(); ctx.sound('coin'); refresh(); renderTray(); } else ctx.toast(ctx.t('need_coins')); };
      row.appendChild(buy); list.appendChild(row);
    }
  };
  refresh(); box.appendChild(list);
  const close = ctx.el('button', 'w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 font-semibold', ctx.t('close')); close.onclick = () => closeShop(); box.appendChild(close);
  ov.appendChild(box); ov.addEventListener('click', (e) => { if (e.target === ov) closeShop(); }); document.body.appendChild(ov);
}
function closeShop() { if (M._shop) { M._shop.remove(); M._shop = null; } }

// ---------- Champions board (select screen) ----------
function champRow(ctx, e, i, small) {
  const c = e.prof.c2048;
  const row = ctx.el('button', 'w-full flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-sm transition ' + (e.isMe ? 'bg-indigo-600/20 ring-1 ring-indigo-500/50' : 'bg-slate-800 hover:bg-slate-700'));
  const pos = i === 0
    ? '<span class="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-400 text-slate-900 font-black text-[11px] shrink-0">1</span>'
    : `<span class="inline-block w-5 text-center text-slate-500 font-semibold text-xs shrink-0">${i + 1}</span>`;
  const dot = e.online ? '<span class="text-emerald-400 text-xs">●</span>' : '';
  row.innerHTML = `${pos}<span class="text-base">${e.avatar || '🎮'}</span>${dot}<span class="truncate flex-1 text-left font-semibold">${esc(e.name || ctx.t('lvl_you'))}</span><span class="text-[11px] text-slate-300 shrink-0 tabular-nums">${ctx.t('lvl')}${c.last} · ⭐${c.stars}</span>`;
  if (!e.isMe) { row.onclick = () => openPeerProfile(e, []); row.title = ctx.t('view_profile'); }
  return row;
}
function renderChampions(ctx) {
  const list = champList();
  const card = ctx.el('div', 'rounded-2xl bg-slate-900/60 border border-slate-800 p-3 space-y-1.5');
  card.appendChild(ctx.el('p', 'font-display font-bold text-sm', '🏆 ' + ctx.t('lvl_champions')));
  const shown = M.champShowAll ? list : list.slice(0, 5);
  shown.forEach((e, i) => card.appendChild(champRow(ctx, e, i, true)));
  if (list.length > 5) {
    const t = ctx.el('button', 'w-full text-center text-xs text-indigo-300 hover:text-indigo-200 font-semibold pt-1', M.champShowAll ? ctx.t('lvl_show_less') : ctx.t('lvl_show_all', { n: list.length }));
    t.onclick = () => { M.champShowAll = !M.champShowAll; renderSelect(ctx); };
    card.appendChild(t);
  }
  if (!isOnline()) card.appendChild(ctx.el('p', 'text-[11px] text-slate-600 text-center pt-0.5', ctx.t('lvl_go_online')));
  return card;
}

// ---------- level detail card (tap a level) ----------
function closeLevelCard() { if (M._card) { M._card.remove(); M._card = null; } }
function openLevelCard(ctx, n) {
  closeLevelCard();
  const p = progress(), rec = p.levels[n] || {}, cfg = level2048Config(n);
  const ov = ctx.el('div', 'fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4'); M._card = ov;
  const box = ctx.el('div', 'w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl p-4 space-y-3 max-h-[88vh] overflow-y-auto');
  const st = tileStyleFor(paletteFor(n))(16);
  const obj = cfg.limitType === 'moves' ? `🎯 ${fmt(cfg.target)} · ⟳ ${cfg.limit}` : cfg.limitType === 'time' ? `🎯 ${fmt(cfg.target)} · ⏱ ${mmss(cfg.limit)}` : `🎯 ${fmt(cfg.target)}`;
  const head = ctx.el('div', 'text-center space-y-1');
  const badge = ctx.el('div', 'w-14 h-14 mx-auto rounded-xl flex items-center justify-center font-black text-xl'); badge.style.background = st.bg; badge.style.color = st.fg; badge.textContent = n;
  head.append(badge, ctx.el('p', 'font-display font-bold', `${ctx.t('lvl_level')} ${n} · ${cfg.name}${cfg.boss ? ' 👑' : ''}`), ctx.el('p', 'text-xs text-slate-400', obj));
  if (rec.cleared) head.appendChild(ctx.el('div', 'text-2xl text-amber-400', starStr(rec.stars || 0)));
  box.appendChild(head);

  box.appendChild(ctx.el('p', 'text-[11px] uppercase tracking-wide text-slate-500 font-semibold', ctx.t('lvl_card_stats')));
  const stats = ctx.el('div', 'grid grid-cols-3 gap-2 text-center');
  const stat = (val, label) => { const c = ctx.el('div', 'bg-slate-800/60 rounded-xl py-2'); c.append(ctx.el('div', 'text-sm font-bold tabular-nums', String(val)), ctx.el('div', 'text-[10px] text-slate-400', label)); return c; };
  const num = (v) => (v != null && v < 1e9) ? v : '—';
  stats.append(
    stat(rec.tries || 0, ctx.t('lvl_attempts')),
    stat(rec.bestScore != null ? fmt(rec.bestScore) : '—', ctx.t('lvl_best_score')),
    stat(num(rec.bestMoves), ctx.t('lvl_best_moves')),
    stat(mmss(rec.bestTime), ctx.t('lvl_time')),
    stat(num(rec.bestTools), ctx.t('lvl_tools_used')),
    stat('★ ' + (rec.stars || 0), ctx.t('lvl_stars')),
  );
  box.appendChild(stats);

  const onLvl = champList().filter((e) => (e.prof.c2048.last || 1) >= n);
  box.appendChild(ctx.el('p', 'text-[11px] uppercase tracking-wide text-slate-500 font-semibold pt-1', `👥 ${ctx.t('lvl_on_level')} · ${onLvl.length}`));
  if (!onLvl.length) box.appendChild(ctx.el('p', 'text-xs text-slate-600', ctx.t('lvl_none_here')));
  else {
    const chips = ctx.el('div', 'flex flex-wrap gap-1.5');
    for (const e of onLvl.slice(0, 12)) {
      const chip = ctx.el('button', 'flex items-center gap-1 px-2 py-1 rounded-full text-xs ' + (e.isMe ? 'bg-indigo-600/30 ring-1 ring-indigo-500/50' : 'bg-slate-800 hover:bg-slate-700'));
      chip.innerHTML = `<span>${e.avatar || '🎮'}</span><span class="truncate max-w-[6rem]">${esc(e.name || ctx.t('lvl_you'))}</span>`;
      if (!e.isMe) chip.onclick = () => openPeerProfile(e, []);
      chips.appendChild(chip);
    }
    box.appendChild(chips);
  }

  const play = ctx.el('button', 'w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold active:scale-95 transition', rec.cleared ? '↻ ' + ctx.t('lvl_retry') : '▶ ' + ctx.t('lvl_play'));
  play.onclick = () => { closeLevelCard(); startLevel(ctx, n); };
  box.appendChild(play);
  const close = ctx.el('button', 'w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 font-semibold text-sm', ctx.t('close'));
  close.onclick = () => closeLevelCard();
  box.appendChild(close);
  ov.appendChild(box); ov.addEventListener('click', (e) => { if (e.target === ov) closeLevelCard(); }); document.body.appendChild(ov);
}

// ---------- flow ----------
function clearTimer() { if (M.timer) { clearInterval(M.timer); M.timer = null; } }
function startTimer(ctx) { clearTimer(); if (M.cfg.limitType !== 'time' || M.timeLeft <= 0) return; M.timer = setInterval(() => { M.timeLeft--; paintInfo(); if (M.timeLeft <= 0) { clearTimer(); failNow(ctx, 'time'); } }, 1000); }
function startLevel(ctx, n) {
  closeShop(); closeLevelCard(); M.n = Math.max(1, n); M.cfg = level2048Config(M.n); resetPlay();
  const p = progress(), rec = p.levels[M.n] || {}; rec.tries = (rec.tries || 0) + 1; p.levels[M.n] = rec; writeProg(p);
  renderPlay(ctx); startTimer(ctx);
}
function thawAround(x, y) { for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = (x + dx) + ',' + (y + dy); if (M.frozenSet.has(k)) { M.frozenSet.delete(k); if (M.tb) M.tb.thaw(x + dx, y + dy); } } }
function giftMilestones() {
  for (const t of TOOLS) if (t.milestone && !M.milestones.has(t.milestone) && M.best >= t.milestone) {
    M.milestones.add(t.milestone); M.tools[t.key] = (M.tools[t.key] || 0) + 1; saveTools();
    M.ctx.toast('+' + M.ctx.t('lvl_pw_' + t.key)); M.ctx.sound('badge'); renderTray();
  }
}
function playable() { return has2048MoveWalls(M.board, M.cfg.walls, M.frozenSet) && !(M.cfg.limitType === 'moves' && M.moves >= M.cfg.limit); }
function afterToolChecks() {
  if (M.myDone) return;
  if (M.best >= M.cfg.target) return onWin(M.ctx);
  if (M.failed && playable()) { clearFail(); return; }
  if (!M.failed && !playable()) softFail(M.cfg.limitType === 'moves' && M.moves >= M.cfg.limit ? 'moves' : 'stuck');
}
// Soft fail (solo): keep the board + tools so the player can rescue; only ends via Retry/Levels or a win.
function failNow(ctx, reason) { if (ctx.solo) softFail(reason); else onFail(ctx); }
function softFail(reason) {
  if (M.failed || M.myDone) return;
  M.failed = true; clearTimer(); M.ctx.sound('lose');
  if (M.failEl) {
    const t = M.ctx.t, msg = reason === 'moves' ? t('lvl_out_moves') : reason === 'time' ? t('lvl_out_time') : t('lvl_stuck');
    M.failEl.innerHTML = `<p class="text-sm font-semibold text-rose-200">💥 ${msg}</p><p class="text-[11px] text-slate-300">${t('lvl_use_tool')}</p>`;
    M.failEl.classList.remove('hidden');
  }
  renderTray();
}
function clearFail() { M.failed = false; if (M.failEl) M.failEl.classList.add('hidden'); if (M.cfg.limitType === 'time' && M.timeLeft > 0) startTimer(M.ctx); renderTray(); }
function endMode() { M.powerMode = null; M.selCell = null; if (M.tb) M.tb.clearHighlights(); renderTray(); }

// ---------- tools ----------
function toggleTool(key) {
  if (M.myDone) return;
  if (toolCount(key) <= 0) { openShop(); return; }
  const def = TOOLS.find((t) => t.key === key);
  if (def.kind === 'instant') { if (key === 'undo') useUndo(); else if (key === 'shuffle') useShuffle(); return; }
  M.powerMode = M.powerMode === key ? null : key; M.selCell = null; if (M.tb) M.tb.clearHighlights(); renderTray();
}
function useUndo() {
  if (toolCount('undo') <= 0 || !M.undoSnap) return;
  const s = M.undoSnap; M.board = s.board.map((r) => r.slice()); M.score = s.score; M.moves = s.moves; M.best = s.best; M.frozenSet = new Set(s.frozen);
  M.undoSnap = null; consume('undo'); syncBoard(); M.ctx.sound('toggle'); paintInfo(); renderTray(); afterToolChecks();
}
function useShuffle() {
  if (toolCount('shuffle') <= 0) return;
  const n = M.cfg.size, cells = [], vals = [];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const k = x + ',' + y; if (M.wallSet.has(k) || M.frozenSet.has(k)) continue; cells.push([x, y]); if (M.board[y][x]) vals.push(M.board[y][x]); }
  for (let i = vals.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = vals[i]; vals[i] = vals[j]; vals[j] = t; }
  for (const [x, y] of cells) M.board[y][x] = 0;
  for (let i = cells.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = cells[i]; cells[i] = cells[j]; cells[j] = t; }
  for (let i = 0; i < vals.length; i++) { const [x, y] = cells[i]; M.board[y][x] = vals[i]; }
  consume('shuffle'); M.best = Math.max(M.best, maxTile());
  if (M.tb) M.tb.vortex(() => syncBoard()); else syncBoard();
  M.ctx.sound('drop'); paintInfo(); renderTray(); afterToolChecks();
}
function targetTap(x, y) {
  if (!M.powerMode || M.myDone) return;
  const k = x + ',' + y, hasTile = !!M.board[y][x] && !M.wallSet.has(k), empty = !M.board[y][x] && !M.wallSet.has(k), mode = M.powerMode;
  if (mode === 'delete') { if (!hasTile) return; M.board[y][x] = 0; M.frozenSet.delete(k); consume('delete'); endMode(); if (M.tb) M.tb.bombFx([[x, y]]); syncBoard(); M.ctx.sound('drop'); afterToolChecks(); return; }
  if (mode === 'double') { if (!hasTile) return; M.board[y][x] *= 2; consume('double'); endMode(); syncBoard(); if (M.tb) M.tb.doubleFx(x, y); M.best = Math.max(M.best, maxTile()); M.ctx.sound('coin'); paintInfo(); afterToolChecks(); return; }
  if (mode === 'bomb') {
    if (!hasTile) return; const cells = [[x, y]];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx >= 0 && nx < M.cfg.size && ny >= 0 && ny < M.cfg.size && !M.wallSet.has(nx + ',' + ny) && M.board[ny][nx]) cells.push([nx, ny]); }
    for (const [cx, cy] of cells) { M.board[cy][cx] = 0; M.frozenSet.delete(cx + ',' + cy); }
    consume('bomb'); endMode(); if (M.tb) M.tb.bombFx(cells); syncBoard(); M.ctx.sound('lose'); afterToolChecks(); return;
  }
  if (mode === 'add') { if (!empty) return; M.board[y][x] = 2; consume('add'); endMode(); syncBoard(); if (M.tb) M.tb.addFx(x, y); M.ctx.sound('drop'); afterToolChecks(); return; }
  if (mode === 'swap') {
    if (!hasTile) return;
    if (!M.selCell) { M.selCell = [x, y]; if (M.tb) M.tb.highlight(x, y, true); return; }
    const [ax, ay] = M.selCell; if (ax === x && ay === y) { if (M.tb) M.tb.highlight(x, y, false); M.selCell = null; return; }
    const tmp = M.board[ay][ax]; M.board[ay][ax] = M.board[y][x]; M.board[y][x] = tmp;
    const fa = M.frozenSet.has(ax + ',' + ay), fb = M.frozenSet.has(k); M.frozenSet.delete(ax + ',' + ay); M.frozenSet.delete(k); if (fa) M.frozenSet.add(k); if (fb) M.frozenSet.add(ax + ',' + ay);
    consume('swap'); endMode(); syncBoard(); M.ctx.sound('toggle'); afterToolChecks(); return;
  }
  if (mode === 'move') {
    if (!M.selCell) { if (!hasTile) return; M.selCell = [x, y]; if (M.tb) M.tb.highlight(x, y, true); return; }
    const [ax, ay] = M.selCell;
    if (!empty) { if (hasTile) { if (M.tb) { M.tb.highlight(ax, ay, false); M.tb.highlight(x, y, true); } M.selCell = [x, y]; } return; }
    const val = M.board[ay][ax]; M.board[ay][ax] = 0; M.board[y][x] = val;
    const wasF = M.frozenSet.has(ax + ',' + ay); M.frozenSet.delete(ax + ',' + ay); if (wasF) M.frozenSet.add(k);
    consume('move'); M.powerMode = null; M.selCell = null;
    if (M.tb) { M.tb.highlight(ax, ay, false); M.tb.glide(ax, ay, x, y, () => syncBoard()); } else syncBoard();
    M.ctx.sound('drop'); renderTray(); afterToolChecks(); return;
  }
}
function move(dir) {
  const ctx = M.ctx;
  if (M.view !== 'play' || M.myDone || M.powerMode || M.failed) return;
  const res = move2048Tracked(M.board, dir, M.cfg.walls, M.frozenSet);
  if (!res.moved) return;
  M.undoSnap = { board: M.board.map((r) => r.slice()), score: M.score, moves: M.moves, best: M.best, frozen: [...M.frozenSet] };
  M.board = res.board; M.score += res.score; M.moves++;
  if (M.tb) M.tb.animate(res.moves);
  ctx.sound('click');
  const sp = spawnCell(); if (sp && M.tb) M.tb.spawnAt(sp[0], sp[1], sp[2]);
  for (const m of res.moves) if (m.merged) thawAround(m.toX, m.toY);
  M.best = Math.max(M.best, res.max, maxTile());
  giftMilestones(); paintInfo(); renderTray();
  if (!ctx.solo) ctx.send('stat', { best: M.best, score: M.score });
  if (M.best >= M.cfg.target) return onWin(ctx);
  if (M.cfg.limitType === 'moves' && M.moves >= M.cfg.limit) return failNow(ctx, 'moves');
  if (!has2048MoveWalls(M.board, M.cfg.walls, M.frozenSet)) return failNow(ctx, 'stuck');
}
function onWin(ctx) {
  M.myDone = true; clearTimer();
  if (!ctx.solo) { ctx.send('win', { best: M.best, score: M.score }); return ctx.endGame('win', `${ctx.t('lvl_target')} ${fmt(M.cfg.target)}!`, { perfBonus: perfBonus() }); }
  ctx.sound('win');
  const stars = stars2048(M.cfg.par, M.moves);
  const p = progress(), prev = p.levels[M.n] || {}, firstClear = !prev.cleared;
  const time = Math.round((Date.now() - M.startTs) / 1000);
  p.levels[M.n] = {
    cleared: true, tries: prev.tries || 1,
    stars: Math.max(prev.stars || 0, stars),
    bestScore: Math.max(prev.bestScore || 0, M.score),
    bestMoves: Math.min(prev.bestMoves != null ? prev.bestMoves : 1e9, M.moves),
    bestTime: Math.min(prev.bestTime != null ? prev.bestTime : 1e9, time),
    bestTools: Math.min(prev.bestTools != null ? prev.bestTools : 1e9, M.toolsUsed),
  };
  p.unlocked = Math.max(p.unlocked || 1, M.n + 1);
  p.totalStars = Object.values(p.levels).reduce((a, l) => a + (l.stars || 0), 0);
  if (firstClear) { p.score = (p.score || 0) + M.score; M.tools.undo = (M.tools.undo || 0) + 1; if (stars >= 3) { const bonus = ['swap', 'move', 'double', 'bomb'][M.n % 4]; M.tools[bonus] = (M.tools[bonus] || 0) + 1; } }
  p.tools = Object.assign({}, M.tools);
  writeProg(p);
  try { if (isOnline()) publishScore({ prof: myProfileSummary() }); } catch (e) {}   // update Champions board for peers
  let reward = null;
  if (firstClear) { const coins = 12 + M.cfg.exp * 3 + stars * 6, xp = 8 + M.cfg.exp * 2 + stars * 4; reward = earnForResult('win', 0, { coins, xp }); try { questEvent({ played: 1, win: true, gameId: 'level2048' }); } catch (e) {} }
  setTimeout(() => renderResult(ctx, true, stars, reward), 320);
}
function onFail(ctx) {   // online race only — a race must resolve
  M.myDone = true; clearTimer();
  ctx.send('done', { best: M.best, score: M.score }); resolveRace(ctx);
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
  stop() { clearTimer(); closeShop(); closeLevelCard(); destroyBoard(); if (M.keyHandler) { document.removeEventListener('keydown', M.keyHandler); M.keyHandler = null; } },
  getState() { return null; },
};
