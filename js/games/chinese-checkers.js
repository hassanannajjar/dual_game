import { ccReachable } from '../logic.js?v=31';

const ROWW = [1, 2, 3, 4, 13, 12, 11, 10, 9, 10, 11, 12, 13, 4, 3, 2, 1];
const DIRS = [[2, 0], [-2, 0], [1, -1], [-1, -1], [1, 1], [-1, 1]];
const M = { board: {}, mine: 'me', opp: 'opp', adj: null, holes: null, coord: null, sel: null, reach: new Set(), els: {}, msgEl: null };

function buildGeometry() {
  const holes = new Set(), coord = {};
  for (let r = 0; r < ROWW.length; r++) { const w = ROWW[r]; for (let k = 0; k < w; k++) { const ux = 2 * k - (w - 1); const key = r + ':' + ux; holes.add(key); coord[key] = [ux, r]; } }
  const adj = new Map();
  for (const key of holes) {
    const [ux, r] = coord[key]; const list = [];
    for (const [du, dr] of DIRS) {
      const n = (r + dr) + ':' + (ux + du);
      const b = (r + 2 * dr) + ':' + (ux + 2 * du);
      if (holes.has(n)) list.push([n, holes.has(b) ? b : null]);
    }
    adj.set(key, list);
  }
  return { holes, coord, adj };
}
const rowsKeys = (rows) => { const s = new Set(); for (const key of M.holes) { const r = +key.split(':')[0]; if (rows.includes(r)) s.add(key); } return s; };
function targetSet() { return M.mineTop ? rowsKeys([13, 14, 15, 16]) : rowsKeys([0, 1, 2, 3]); }

function paint(ctx) {
  for (const key of M.holes) {
    const el = M.els[key], c = M.board[key];
    const sel = M.sel === key, rc = M.reach.has(key);
    el.className = 'absolute -translate-x-1/2 -translate-y-1/2 rounded-full w-[5.5%] h-[5.5%] ' +
      (c === 'me' ? 'bg-emerald-500' : c === 'opp' ? 'bg-amber-500' : 'bg-slate-600') +
      (sel ? ' ring-2 ring-white' : rc ? ' ring-2 ring-emerald-300' : '');
  }
  M.msgEl.textContent = ctx.myTurn ? (M.sel ? 'Tap a highlighted hole' : 'Tap one of your pegs') : 'Opponent…';
}
function build(ctx) {
  const g = buildGeometry(); M.holes = g.holes; M.coord = g.coord; M.adj = g.adj; M.els = {};
  const wrap = ctx.el('div', 'mx-auto');
  wrap.style.maxWidth = 'min(94vw, 30rem)';
  const board = ctx.el('div', 'relative bg-slate-900 rounded-xl');
  board.style.aspectRatio = '1';
  for (const key of M.holes) {
    const [ux, r] = M.coord[key];
    const el = ctx.el('button', '');
    el.style.left = ((ux + 12) / 24 * 100) + '%';
    el.style.top = (r / 16 * 100) + '%';
    el.onclick = () => click(ctx, key);
    M.els[key] = el; board.appendChild(el);
  }
  wrap.appendChild(board);
  M.msgEl = ctx.el('p', 'text-center text-slate-400 text-sm mt-2');
  wrap.appendChild(M.msgEl);
  ctx.root.appendChild(wrap);
  paint(ctx);
}
function occupied() { return new Set(Object.keys(M.board)); }
function click(ctx, key) {
  if (!ctx.myTurn) return;
  if (M.sel && M.reach.has(key)) {
    delete M.board[M.sel]; M.board[key] = 'me'; const from = M.sel; M.sel = null; M.reach = new Set();
    ctx.sound('place'); ctx.send('move', { from, to: key }); paint(ctx);
    if (Object.entries(M.board).filter(([, c]) => c === 'me').every(([k]) => targetSet().has(k))) return ctx.endGame('win');
    ctx.setTurn(false);
    return;
  }
  if (M.board[key] === 'me') { M.sel = key; M.reach = ccReachable(M.adj, occupied(), key); paint(ctx); }
  else { M.sel = null; M.reach = new Set(); paint(ctx); }
}

export default {
  id: 'chinesecheckers', name: 'Chinese Checkers', emoji: '🌟', blurb: 'Hop pegs across',
  start(ctx, { iAmFirst }) {
    const g = buildGeometry(); M.holes = g.holes;
    M.mineTop = iAmFirst;
    M.board = {};
    for (const key of rowsKeys([0, 1, 2, 3])) M.board[key] = iAmFirst ? 'me' : 'opp';
    for (const key of rowsKeys([13, 14, 15, 16])) M.board[key] = iAmFirst ? 'opp' : 'me';
    M.sel = null; M.reach = new Set();
    build(ctx);
  },
  onTurn(mine, ctx) { M.sel = null; M.reach = new Set(); paint(ctx); },
  // Bot ('opp'): advance a peg toward its goal rows; prefers big forward hops and lagging pegs.
  botMove(level) {
    const occ = new Set(Object.keys(M.board));
    const oppKeys = Object.keys(M.board).filter((k) => M.board[k] === 'opp');
    const rowOf = (k) => +k.split(':')[0];
    const toTop = M.mineTop, goalDir = toTop ? -1 : 1;
    const moves = [];
    for (const from of oppKeys) { const reach = ccReachable(M.adj, occ, from); for (const to of reach) moves.push([from, to]); }
    if (!moves.length) return null;
    if (level === 'easy') { const [from, to] = moves[Math.floor(Math.random() * moves.length)]; return { type: 'move', from, to }; }
    let best = moves[0], bestSc = -1e9;
    for (const [from, to] of moves) {
      const prog = (rowOf(to) - rowOf(from)) * goalDir;
      const lag = toTop ? rowOf(from) : (16 - rowOf(from));
      const sc = prog * 3 + lag * 0.3 + Math.random() * 1.5;
      if (sc > bestSc) { bestSc = sc; best = [from, to]; }
    }
    return { type: 'move', from: best[0], to: best[1] };
  },
  onMessage(msg, ctx) {
    if (msg.type !== 'move') return;
    delete M.board[msg.from]; M.board[msg.to] = 'opp'; ctx.sound('place'); paint(ctx);
    const oppTarget = M.mineTop ? rowsKeys([0, 1, 2, 3]) : rowsKeys([13, 14, 15, 16]);
    if (Object.entries(M.board).filter(([, c]) => c === 'opp').every(([k]) => oppTarget.has(k))) return ctx.endGame('lose');
    ctx.setTurn(true);
  },
  getState() { return { board: M.board, mineTop: M.mineTop }; },
  restore(state, ctx) { M.mineTop = state.mineTop; M.board = state.board; M.sel = null; M.reach = new Set(); build(ctx); },
};
