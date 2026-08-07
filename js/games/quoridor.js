import { quoridorBlocked, quoridorPathExists } from '../logic.js?v=41';

// 9x9. Side A (indigo) starts bottom-center, reaches row 0 to win. Side B (rose) starts top-center, reaches row 8.
// On your turn: move your pawn one step, or place a 2-length wall to lengthen your opponent's route (walls can't fully trap either pawn).
const N = 9;
const M = { side: 'a', pawns: { a: [4, 8], b: [4, 0] }, walls: { hw: new Set(), vw: new Set() }, left: { a: 6, b: 6 },
  mode: 'move', legalCells: [], g: [], msgEl: null, ctrl: {} };
const goalY = (s) => (s === 'a' ? 0 : N - 1);
const other = (s) => (s === 'a' ? 'b' : 'a');

function pawnMoves(walls, me, opp) {
  const out = [], [x, y] = me;
  for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
    const nx = x + dx, ny = y + dy;
    if (nx < 0 || nx >= N || ny < 0 || ny >= N || quoridorBlocked(walls, x, y, nx, ny)) continue;
    if (opp[0] === nx && opp[1] === ny) {
      const jx = nx + dx, jy = ny + dy;
      if (jx >= 0 && jx < N && jy >= 0 && jy < N && !quoridorBlocked(walls, nx, ny, jx, jy)) out.push([jx, jy]);
      else for (const [ex, ey] of (dx ? [[nx, ny + 1], [nx, ny - 1]] : [[nx + 1, ny], [nx - 1, ny]])) if (ex >= 0 && ex < N && ey >= 0 && ey < N && !quoridorBlocked(walls, nx, ny, ex, ey)) out.push([ex, ey]);
    } else out.push([nx, ny]);
  }
  return out;
}
function wouldTrap(walls) { return !quoridorPathExists(walls, N, M.pawns.a, goalY('a')) || !quoridorPathExists(walls, N, M.pawns.b, goalY('b')); }
function canPlaceWall(wt, ix, iy) {
  if (ix < 0 || ix > N - 2 || iy < 0 || iy > N - 2) return false;
  const k = ix + ',' + iy;
  if (M.walls.hw.has(k) || M.walls.vw.has(k)) return false;                         // cross / same slot
  if (wt === 'h') { if (M.walls.hw.has((ix - 1) + ',' + iy) || M.walls.hw.has((ix + 1) + ',' + iy)) return false; }
  else { if (M.walls.vw.has(ix + ',' + (iy - 1)) || M.walls.vw.has(ix + ',' + (iy + 1))) return false; }
  const hw = new Set(M.walls.hw), vw = new Set(M.walls.vw); (wt === 'h' ? hw : vw).add(k);
  return !wouldTrap({ hw, vw });
}
function bfsStep(walls, start, gy, opp) {                                            // first step of a shortest path to row gy
  const seen = new Set([start[0] + ',' + start[1]]), q = [[start, null]];
  while (q.length) {
    const [[x, y], first] = q.shift();
    if (y === gy) return first;
    for (const to of pawnMoves(walls, [x, y], opp)) { const k = to[0] + ',' + to[1]; if (seen.has(k)) continue; seen.add(k); q.push([to, first || to]); }
  }
  return null;
}

function paint(ctx) {
  const legal = new Set(M.legalCells.map(([x, y]) => x + ',' + y));
  for (let gy = 0; gy < 17; gy++) for (let gx = 0; gx < 17; gx++) {
    const d = M.g[gy][gx], cell = gy % 2 === 0 && gx % 2 === 0, inter = gy % 2 === 1 && gx % 2 === 1;
    if (cell) {
      const cx = gx / 2, cy = gy / 2;
      let cls = 'rounded-md flex items-center justify-center text-lg ';
      cls += (goalY('a') === cy ? 'bg-indigo-900/40 ' : goalY('b') === cy ? 'bg-rose-900/40 ' : 'bg-slate-800/70 ');
      if (M.mode === 'move' && ctx.myTurn && legal.has(cx + ',' + cy)) cls += 'ring-2 ring-inset ring-emerald-300 cursor-pointer ';
      d.className = cls;
      d.textContent = (M.pawns.a[0] === cx && M.pawns.a[1] === cy) ? '🔵' : (M.pawns.b[0] === cx && M.pawns.b[1] === cy) ? '🔴' : '';
    } else if (inter) {
      const ix = (gx - 1) / 2, iy = (gy - 1) / 2;
      const wallMode = (M.mode === 'wallH' || M.mode === 'wallV') && ctx.myTurn;
      d.className = 'rounded-sm ' + (wallMode && canPlaceWall(M.mode === 'wallH' ? 'h' : 'v', ix, iy) ? 'bg-emerald-500/40 cursor-pointer' : 'bg-transparent');
    } else {
      d.className = 'bg-transparent';       // groove; walls drawn below
    }
  }
  // draw walls
  for (const key of M.walls.hw) { const [ix, iy] = key.split(',').map(Number); const gy = 2 * iy + 1; for (const gx of [2 * ix, 2 * ix + 1, 2 * ix + 2]) M.g[gy][gx].className = 'rounded-sm bg-amber-400'; }
  for (const key of M.walls.vw) { const [ix, iy] = key.split(',').map(Number); const gx = 2 * ix + 1; for (const gy of [2 * iy, 2 * iy + 1, 2 * iy + 2]) M.g[gy][gx].className = 'rounded-sm bg-amber-400'; }
  if (M.msgEl) M.msgEl.textContent = ctx.myTurn ? (M.mode === 'move' ? ctx.t('your_move') : ctx.t('quoridor_wall')) : ctx.t('opp_move');
  if (M.ctrl.h) { M.ctrl.h.disabled = M.left[M.side] <= 0; M.ctrl.v.disabled = M.left[M.side] <= 0; M.ctrl.wallsLeft.textContent = ctx.t('quoridor_walls', { n: M.left[M.side] }); }
  for (const [k, b] of [['move', M.ctrl.move], ['wallH', M.ctrl.h], ['wallV', M.ctrl.v]]) if (b) b.className = 'flex-1 py-2 rounded-lg text-sm font-semibold transition ' + (M.mode === k ? 'bg-indigo-600' : 'bg-slate-700 hover:bg-slate-600');
}
function build(ctx) {
  M.g = [];
  const wrap = ctx.el('div', 'mx-auto space-y-2'); wrap.style.maxWidth = 'min(96vw, 30rem)';
  M.msgEl = ctx.el('p', 'text-center text-slate-400 text-sm'); wrap.appendChild(M.msgEl);
  const grid = ctx.el('div', 'p-1.5 rounded-xl bg-slate-950'); grid.style.display = 'grid'; grid.style.gap = '1px';
  const track = []; for (let i = 0; i < 17; i++) track.push(i % 2 === 0 ? '2.6fr' : '0.55fr');
  grid.style.gridTemplateColumns = track.join(' '); grid.style.gridTemplateRows = track.join(' ');
  for (let gy = 0; gy < 17; gy++) { M.g[gy] = []; for (let gx = 0; gx < 17; gx++) {
    const cell = gy % 2 === 0 && gx % 2 === 0, inter = gy % 2 === 1 && gx % 2 === 1;
    const d = ctx.el('div', ''); if (cell) d.style.aspectRatio = '1';
    if (cell) { const cx = gx / 2, cy = gy / 2; d.onclick = () => onCell(ctx, cx, cy); }
    else if (inter) { const ix = (gx - 1) / 2, iy = (gy - 1) / 2; d.onclick = () => onInter(ctx, ix, iy); }
    M.g[gy][gx] = d; grid.appendChild(d);
  } }
  wrap.appendChild(grid);
  const bar = ctx.el('div', 'flex gap-2');
  M.ctrl.move = ctx.el('button', '', ctx.t('quoridor_move')); M.ctrl.move.onclick = () => setMode(ctx, 'move');
  M.ctrl.h = ctx.el('button', '', '▬'); M.ctrl.h.onclick = () => setMode(ctx, 'wallH');
  M.ctrl.v = ctx.el('button', '', '▮'); M.ctrl.v.onclick = () => setMode(ctx, 'wallV');
  bar.append(M.ctrl.move, M.ctrl.h, M.ctrl.v); wrap.appendChild(bar);
  M.ctrl.wallsLeft = ctx.el('p', 'text-center text-slate-500 text-xs'); wrap.appendChild(M.ctrl.wallsLeft);
  ctx.root.appendChild(wrap);
  refreshLegal(); paint(ctx);
}
function refreshLegal() { M.legalCells = pawnMoves(M.walls, M.pawns[M.side], M.pawns[other(M.side)]); }
function setMode(ctx, m) { if (!ctx.myTurn) return; if ((m === 'wallH' || m === 'wallV') && M.left[M.side] <= 0) return; M.mode = m; ctx.sound('click'); paint(ctx); }
function endIfWon(ctx) {
  if (M.pawns.a[1] === goalY('a')) { ctx.endGame(M.side === 'a' ? 'win' : 'lose'); return true; }
  if (M.pawns.b[1] === goalY('b')) { ctx.endGame(M.side === 'b' ? 'win' : 'lose'); return true; }
  return false;
}
function onCell(ctx, cx, cy) {
  if (!ctx.myTurn || M.mode !== 'move') return;
  if (!M.legalCells.some(([x, y]) => x === cx && y === cy)) return;
  M.pawns[M.side] = [cx, cy]; ctx.sound('place');
  ctx.send('move', { to: [cx, cy] });
  if (endIfWon(ctx)) { paint(ctx); return; }
  refreshLegal(); paint(ctx); ctx.setTurn(false);
}
function onInter(ctx, ix, iy) {
  if (!ctx.myTurn || (M.mode !== 'wallH' && M.mode !== 'wallV') || M.left[M.side] <= 0) return;
  const wt = M.mode === 'wallH' ? 'h' : 'v';
  if (!canPlaceWall(wt, ix, iy)) return;
  (wt === 'h' ? M.walls.hw : M.walls.vw).add(ix + ',' + iy); M.left[M.side]--;
  ctx.sound('drop'); ctx.send('wall', { wt, ix, iy });
  M.mode = 'move'; refreshLegal(); paint(ctx); ctx.setTurn(false);
}

export default {
  id: 'quoridor', name: 'Quoridor', emoji: '🧱', blurb: 'Race across; wall them off',
  options: [{ key: 'walls', label: 'Walls each', choices: [{ label: '5', value: 5 }, { label: '8', value: 8 }, { label: '10', value: 10 }], default: 6 }],
  start(ctx, { iAmFirst }) {
    M.side = iAmFirst ? 'a' : 'b';
    M.pawns = { a: [4, N - 1], b: [4, 0] }; M.walls = { hw: new Set(), vw: new Set() };
    const w = ctx.config.walls || 6; M.left = { a: w, b: w }; M.mode = 'move';
    build(ctx);
  },
  onTurn(mine, ctx) { if (mine) M.mode = 'move'; refreshLegal(); paint(ctx); },
  onMessage(msg, ctx) {
    const os = other(M.side);
    if (msg.type === 'move') { M.pawns[os] = msg.to; ctx.sound('place'); if (endIfWon(ctx)) { paint(ctx); return; } }
    else if (msg.type === 'wall') { (msg.wt === 'h' ? M.walls.hw : M.walls.vw).add(msg.ix + ',' + msg.iy); M.left[os]--; ctx.sound('drop'); }
    else return;
    refreshLegal(); paint(ctx); ctx.setTurn(true);
  },
  botMove(level) {
    const s = other(M.side), me = M.pawns[s], opp = M.pawns[other(s)];
    // Occasionally place a wall that lengthens the human's path (only if it doesn't trap anyone).
    if (M.left[s] > 0 && level !== 'easy' && Math.random() < (level === 'hard' ? 0.5 : 0.3)) {
      const humanGoal = goalY(other(s)); const before = shortest(M.walls, opp, humanGoal, me);
      let best = null, bestGain = 0;
      for (let iy = 0; iy < N - 1; iy++) for (let ix = 0; ix < N - 1; ix++) for (const wt of ['h', 'v']) {
        if (!canPlaceWall(wt, ix, iy)) continue;
        const hw = new Set(M.walls.hw), vw = new Set(M.walls.vw); (wt === 'h' ? hw : vw).add(ix + ',' + iy);
        const after = shortest({ hw, vw }, opp, humanGoal, me);
        const myAfter = shortest({ hw, vw }, me, goalY(s), opp);
        if (after === Infinity || myAfter === Infinity) continue;
        const gain = (after - before) - 0.3 * Math.max(0, myAfter - shortest(M.walls, me, goalY(s), opp));
        if (gain > bestGain) { bestGain = gain; best = { wt, ix, iy }; }
      }
      if (best && bestGain >= 1) return { type: 'wall', wt: best.wt, ix: best.ix, iy: best.iy };
    }
    const step = bfsStep(M.walls, me, goalY(s), opp);
    if (step) return { type: 'move', to: step };
    const mv = pawnMoves(M.walls, me, opp); return mv.length ? { type: 'move', to: mv[0] } : null;
  },
  getState() { return { side: M.side, pawns: M.pawns, hw: [...M.walls.hw], vw: [...M.walls.vw], left: M.left }; },
  restore(state, ctx) { M.side = state.side; M.pawns = state.pawns; M.walls = { hw: new Set(state.hw), vw: new Set(state.vw) }; M.left = state.left; M.mode = 'move'; build(ctx); },
};
function shortest(walls, start, gy, opp) {                                          // BFS distance (walls only), Infinity if none
  const seen = new Set([start[0] + ',' + start[1]]), q = [[start, 0]];
  while (q.length) { const [[x, y], d] = q.shift(); if (y === gy) return d;
    for (const to of pawnMoves(walls, [x, y], opp)) { const k = to[0] + ',' + to[1]; if (!seen.has(k)) { seen.add(k); q.push([to, d + 1]); } } }
  return Infinity;
}
