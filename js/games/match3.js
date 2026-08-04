import { match3Find, match3Gravity } from '../logic.js?v=29';

// Match-3 Duel (simultaneous): swap adjacent gems to line up 3+; cascades score more.
// Own board each, shared countdown, highest score wins. Solo = beat the clock.
const GEMS = ['bg-rose-500', 'bg-amber-400', 'bg-emerald-500', 'bg-sky-500', 'bg-violet-500', 'bg-pink-400'];
const NCOL = GEMS.length, SIZE = 7;
const M = {};

const refill = () => Math.floor(Math.random() * NCOL);
function freshBoard() {
  const b = Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, refill));
  let hits = match3Find(b), guard = 0;
  while (hits.size && guard++ < 200) { for (const k of hits) { const [y, x] = k.split(',').map(Number); b[y][x] = refill(); } hits = match3Find(b); }
  return b;
}
function resolveBoard(board) {                        // clear matches + cascade; returns points
  let total = 0, combo = 0;
  for (;;) {
    const hits = match3Find(board); if (!hits.size) break;
    combo++;
    for (const k of hits) { const [y, x] = k.split(',').map(Number); board[y][x] = null; }
    total += hits.size * combo;
    match3Gravity(board, refill);
  }
  return total;
}
function applySwap(board, x1, y1, x2, y2) {            // -1 if the swap makes no match (reverted), else points
  const t = board[y1][x1]; board[y1][x1] = board[y2][x2]; board[y2][x2] = t;
  if (!match3Find(board).size) { const u = board[y1][x1]; board[y1][x1] = board[y2][x2]; board[y2][x2] = u; return -1; }
  return resolveBoard(board);
}

function paint(ctx) {
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const c = M.cells[y][x];
    c.className = 'aspect-square rounded-md ' + GEMS[M.board[y][x]] + (M.sel && M.sel[0] === x && M.sel[1] === y ? ' ring-4 ring-white' : '');
  }
  if (M.scoreEl) M.scoreEl.textContent = ctx.solo ? ctx.t('wr_you') + ': ' + M.myScore
    : `${ctx.t('wr_you')}: ${M.myScore}  ·  ${ctx.t('opponent')}: ${M.oppScore}` + (M.myDone ? '  — ' + ctx.t('waiting_finish') : '');
}
function renderTimer() { if (M.timerEl) M.timerEl.textContent = Math.floor(M.timeLeft / 60) + ':' + String(M.timeLeft % 60).padStart(2, '0'); }
function build(ctx) {
  M.cells = [];
  const wrap = ctx.el('div', 'max-w-xs mx-auto space-y-3 select-none');
  M.scoreEl = ctx.el('p', 'text-center text-sm text-slate-400'); wrap.appendChild(M.scoreEl);
  M.timerEl = ctx.el('p', 'text-center font-mono text-2xl'); wrap.appendChild(M.timerEl);
  const grid = ctx.el('div', 'grid gap-1 p-2 rounded-xl bg-slate-900'); grid.style.gridTemplateColumns = `repeat(${SIZE}, minmax(0, 1fr))`;
  for (let y = 0; y < SIZE; y++) { M.cells[y] = []; for (let x = 0; x < SIZE; x++) { const c = ctx.el('button', ''); c.onclick = () => onCell(ctx, x, y); M.cells[y][x] = c; grid.appendChild(c); } }
  wrap.appendChild(grid);
  wrap.appendChild(ctx.el('p', 'text-center text-slate-600 text-xs', ctx.t('m3_hint')));
  ctx.root.appendChild(wrap);
  renderTimer(); paint(ctx);
}
function onCell(ctx, x, y) {
  if (M.myDone) return;
  if (!M.sel) { M.sel = [x, y]; ctx.sound('click'); paint(ctx); return; }
  const [sx, sy] = M.sel;
  if (Math.abs(sx - x) + Math.abs(sy - y) === 1) {
    const s = applySwap(M.board, sx, sy, x, y);
    M.sel = null;
    if (s < 0) { ctx.sound('invalid'); paint(ctx); return; }
    M.myScore += s; ctx.sound('capture'); paint(ctx);
    if (!ctx.solo) ctx.send('score', { total: M.myScore });
    ctx.save();
  } else { M.sel = [x, y]; ctx.sound('click'); paint(ctx); }
}
function startTimer(ctx) {
  clearInterval(M.timer);
  M.timer = setInterval(() => { M.timeLeft--; renderTimer(); if (M.timeLeft <= 0) { clearInterval(M.timer); M.timer = null; finish(ctx); } }, 1000);
}
function finish(ctx) {
  if (M.myDone) return;
  M.myDone = true; clearInterval(M.timer); M.timer = null;
  if (ctx.solo) return ctx.endGame('win', ctx.t('wr_solo', { n: M.myScore }));
  ctx.send('done', { total: M.myScore });
  if (ctx.vsBot) { clearInterval(M.botTimer); M.botTimer = null; M.oppDone = true; }
  paint(ctx); resolveIfBoth(ctx);
}
function resolveIfBoth(ctx) {
  if (!(M.myDone && M.oppDone)) return;
  const outcome = M.myScore > M.oppScore ? 'win' : M.myScore < M.oppScore ? 'lose' : 'draw';
  ctx.endGame(outcome, ctx.t('wr_result', { me: M.myScore, opp: M.oppScore }));
}

export default {
  id: 'match3', name: 'Match-3 Duel', emoji: '💎', blurb: 'Swap gems, race the score', usesTurns: false,
  options: [{ key: 'time', label: 'Time limit', choices: [{ label: '1m', value: 60 }, { label: '90s', value: 90 }, { label: '2m', value: 120 }], default: 90 }],
  start(ctx) {
    M.board = freshBoard(); M.sel = null; M.myScore = 0; M.oppScore = 0; M.myDone = false; M.oppDone = false; M.timer = null; M.botTimer = null;
    M.timeLeft = (ctx.config && ctx.config.time) || 90;
    build(ctx); startTimer(ctx);
  },
  onMessage(msg, ctx) {
    if (msg.type === 'score') { M.oppScore = msg.total; paint(ctx); }
    else if (msg.type === 'done') { M.oppDone = true; M.oppScore = msg.total; paint(ctx); resolveIfBoth(ctx); }
  },
  botOpen(send, level) {
    M.botBoard = freshBoard();
    const gap = level === 'easy' ? 3500 : level === 'hard' ? 1400 : 2200;
    M.botTimer = setInterval(() => {
      if (M.myDone) { clearInterval(M.botTimer); M.botTimer = null; return; }
      let gained = 0;
      for (let a = 0; a < 60 && !gained; a++) {
        const x = Math.floor(Math.random() * SIZE), y = Math.floor(Math.random() * SIZE);
        const d = [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.floor(Math.random() * 4)];
        const nx = x + d[0], ny = y + d[1];
        if (nx < 0 || ny < 0 || nx >= SIZE || ny >= SIZE) continue;
        const s = applySwap(M.botBoard, x, y, nx, ny); if (s > 0) gained = s;
      }
      if (gained) { M.oppScore += gained; send({ type: 'score', total: M.oppScore }); }
    }, gap);
  },
  botOnGame() {},
  stop() { clearInterval(M.timer); M.timer = null; clearInterval(M.botTimer); M.botTimer = null; },
  getState() { return { board: M.board, myScore: M.myScore, oppScore: M.oppScore, timeLeft: M.timeLeft, myDone: M.myDone, oppDone: M.oppDone }; },
  restore(s, ctx) {
    M.board = s.board || freshBoard(); M.sel = null; M.myScore = s.myScore || 0; M.oppScore = s.oppScore || 0;
    M.timeLeft = s.timeLeft || 90; M.myDone = !!s.myDone; M.oppDone = !!s.oppDone; M.timer = null; M.botTimer = null;
    build(ctx); if (!M.myDone) startTimer(ctx);
  },
};
