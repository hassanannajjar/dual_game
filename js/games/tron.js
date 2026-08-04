const COLS = 28, ROWS = 22, TICK = 95;
const M = { grid: [], cells: [], headA: null, headB: null, dirA: [1, 0], dirB: [-1, 0], myDir: null, loop: null, keyHandler: null, msgEl: null };
const opp = ([a, b], [c, d]) => a === -c && b === -d;

function paint() {
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    const v = M.grid[y][x];
    let cls = 'bg-slate-800';
    if (v === 'a') cls = 'bg-emerald-500'; else if (v === 'b') cls = 'bg-amber-500';
    if (M.headA && M.headA[0] === x && M.headA[1] === y) cls = 'bg-emerald-200';
    if (M.headB && M.headB[0] === x && M.headB[1] === y) cls = 'bg-amber-200';
    M.cells[y][x].className = cls;
  }
}
function build(ctx) {
  M.cells = [];
  const wrap = ctx.el('div', 'mx-auto space-y-3');
  wrap.style.maxWidth = 'min(94vw, 28rem)';
  const grid = ctx.el('div', 'grid gap-px bg-slate-950 p-1 rounded-lg');
  grid.style.gridTemplateColumns = `repeat(${COLS}, 1fr)`;
  for (let y = 0; y < ROWS; y++) { M.cells[y] = []; for (let x = 0; x < COLS; x++) { const c = ctx.el('div', 'aspect-square bg-slate-800'); M.cells[y][x] = c; grid.appendChild(c); } }
  wrap.appendChild(grid);
  M.msgEl = ctx.el('p', 'text-center text-slate-400 text-sm', ctx.isHost ? 'You are Green' : 'You are Amber');
  wrap.appendChild(M.msgEl);
  // dpad
  const pad = ctx.el('div', 'grid grid-cols-3 gap-2 w-40 mx-auto');
  const mk = (label, d, col) => { const b = ctx.el('button', 'py-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-xl ' + col, label); b.onclick = () => setDir(ctx, d); return b; };
  const blank = () => ctx.el('div', '');
  pad.append(blank(), mk('▲', [0, -1], ''), blank(), mk('◀', [-1, 0], ''), blank(), mk('▶', [1, 0], ''), blank(), mk('▼', [0, 1], ''), blank());
  wrap.appendChild(pad);
  ctx.root.appendChild(wrap);
  paint();
}
function setDir(ctx, d) {
  if (ctx.isHost) { if (!opp(d, M.dirA)) M.dirA = d; }
  else { if (M.myDir && opp(d, M.myDir)) return; M.myDir = d; ctx.send('dir', { d }); }
}
function finish(ctx, result) {
  ctx.sound(result === 'draw' ? 'draw' : 'capture');
  const iAmA = ctx.isHost;
  ctx.endGame(result === 'draw' ? 'draw' : ((result === 'a') === iAmA ? 'win' : 'lose'));
}
function tick(ctx) {
  const na = [M.headA[0] + M.dirA[0], M.headA[1] + M.dirA[1]];
  const nb = [M.headB[0] + M.dirB[0], M.headB[1] + M.dirB[1]];
  const oob = (p) => p[0] < 0 || p[0] >= COLS || p[1] < 0 || p[1] >= ROWS || M.grid[p[1]][p[0]];
  const headOn = na[0] === nb[0] && na[1] === nb[1];
  const ca = oob(na) || headOn, cb = oob(nb) || headOn;
  if (ca || cb) { const result = (ca && cb) ? 'draw' : (ca ? 'b' : 'a'); ctx.send('over', { result }); return finish(ctx, result); }
  M.grid[na[1]][na[0]] = 'a'; M.grid[nb[1]][nb[0]] = 'b'; M.headA = na; M.headB = nb;
  ctx.send('tick', { a: na, b: nb }); paint();
}

export default {
  id: 'tron', name: 'Light Cycles', emoji: '🏍️', blurb: 'Trap your rival', usesTurns: false, realtime: true,
  start(ctx) {
    M.grid = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    const my = Math.floor(ROWS / 2);
    M.headA = [2, my]; M.headB = [COLS - 3, my]; M.dirA = [1, 0]; M.dirB = [-1, 0]; M.myDir = [-1, 0];
    M.grid[my][2] = 'a'; M.grid[my][COLS - 3] = 'b';
    build(ctx);
    M.keyHandler = (e) => { const d = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[e.key]; if (d) { e.preventDefault(); setDir(ctx, d); } };
    document.addEventListener('keydown', M.keyHandler);
    if (ctx.isHost) M.loop = setInterval(() => tick(ctx), TICK);
  },
  // Bot drives side B: on each broadcast tick, steer away from danger (look-ahead ray + flood).
  // Reaction is a few ticks stale (loopback delay), so it turns early with a wide margin.
  botOnGame(msg, send, level) {
    if (msg.type !== 'tick' || !M.headB) return;
    const head = M.headB, dir = M.dirB;
    const free = (x, y) => x >= 0 && x < COLS && y >= 0 && y < ROWS && !M.grid[y][x];
    const ray = (d) => { let n = 0, x = head[0], y = head[1]; for (let k = 0; k < 25; k++) { x += d[0]; y += d[1]; if (!free(x, y)) break; n++; } return n; };
    const flood = (d) => {
      const sx = head[0] + d[0], sy = head[1] + d[1]; if (!free(sx, sy)) return 0;
      const seen = new Set([sy * COLS + sx]), q = [[sx, sy]]; let c = 0;
      while (q.length && c < 80) { const [x, y] = q.shift(); c++; for (const [ex, ey] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + ex, ny = y + ey, k = ny * COLS + nx; if (free(nx, ny) && !seen.has(k)) { seen.add(k); q.push([nx, ny]); } } }
      return c;
    };
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter((d) => !opp(d, dir));
    const straight = ray(dir), MARGIN = 7;
    if (level === 'easy') { if (straight >= 2) return; const safe = dirs.filter((d) => ray(d) >= 1); if (safe.length) send({ type: 'dir', d: safe[Math.floor(Math.random() * safe.length)] }); return; }
    if (straight >= MARGIN) {
      let best = dir, bs = straight + (level === 'hard' ? flood(dir) * 0.1 : 0) + 0.5;
      for (const d of dirs) { const s = ray(d) + (level === 'hard' ? flood(d) * 0.1 : 0); if (s > bs) { bs = s; best = d; } }
      if (!(best[0] === dir[0] && best[1] === dir[1])) send({ type: 'dir', d: best });
      return;
    }
    let best = null, bs = -1;
    for (const d of dirs) { const s = ray(d) * 2 + (level === 'hard' ? flood(d) : ray(d)); if (s > bs) { bs = s; best = d; } }
    if (best) send({ type: 'dir', d: best });
  },
  onMessage(msg, ctx) {
    if (msg.type === 'dir') { if (!opp(msg.d, M.dirB)) M.dirB = msg.d; }      // host receives guest input
    else if (msg.type === 'tick') { M.grid[msg.a[1]][msg.a[0]] = 'a'; M.grid[msg.b[1]][msg.b[0]] = 'b'; M.headA = msg.a; M.headB = msg.b; paint(); } // guest renders
    else if (msg.type === 'over') finish(ctx, msg.result);
  },
  stop() { clearInterval(M.loop); M.loop = null; if (M.keyHandler) { document.removeEventListener('keydown', M.keyHandler); M.keyHandler = null; } },
  getState() { return null; },
  restore(_, ctx) { this.start(ctx); },
};
