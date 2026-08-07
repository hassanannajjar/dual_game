import { MORRIS_ADJ, morrisMillsAt } from '../logic.js?v=41';

// Node coordinates on a 0..6 grid [col, row].
const COORD = [
  [0, 0], [3, 0], [6, 0], [1, 1], [3, 1], [5, 1], [2, 2], [3, 2], [4, 2],
  [0, 3], [1, 3], [2, 3], [4, 3], [5, 3], [6, 3], [2, 4], [3, 4], [4, 4],
  [1, 5], [3, 5], [5, 5], [0, 6], [3, 6], [6, 6],
];
const M = { board: [], mine: 'A', opp: 'B', placedMine: 0, placedOpp: 0, sel: null, awaitRemove: false, nodes: [] };

const countOn = (w) => M.board.filter((v) => v === w).length;
const donePlacing = () => M.placedMine >= 9 && M.placedOpp >= 9;
const inMill = (pos) => morrisMillsAt(M.board, pos).length > 0;
function hasLegalMove(w) {
  if (countOn(w) === 3) return M.board.some((v) => v === null);
  for (let i = 0; i < 24; i++) if (M.board[i] === w && MORRIS_ADJ[i].some((j) => M.board[j] === null)) return true;
  return false;
}
const isLegalMove = (from, to) => M.board[to] === null && (countOn(M.mine) === 3 || MORRIS_ADJ[from].includes(to));
function removable(pos) {
  if (M.board[pos] !== M.opp) return false;
  if (!inMill(pos)) return true;
  for (let i = 0; i < 24; i++) if (M.board[i] === M.opp && !inMill(i)) return false; // some non-mill exists elsewhere
  return true;
}
const oppLost = () => donePlacing() && (countOn(M.opp) < 3 || !hasLegalMove(M.opp));
const iLost = () => donePlacing() && (countOn(M.mine) < 3 || !hasLegalMove(M.mine));

function paint(ctx) {
  for (let i = 0; i < 24; i++) {
    const v = M.board[i];
    const n = M.nodes[i];
    const sel = M.sel === i;
    const rm = M.awaitRemove && ctx.myTurn && removable(i);
    n.className = 'absolute -translate-x-1/2 -translate-y-1/2 rounded-full flex items-center justify-center ' +
      'w-[11%] h-[11%] ' +
      (v === M.mine ? 'bg-emerald-500' : v === M.opp ? 'bg-amber-500' : 'bg-slate-600') +
      (sel ? ' ring-2 ring-white' : '') + (rm ? ' ring-2 ring-rose-400' : '') + (v ? '' : ' opacity-60');
  }
}
function build(ctx) {
  M.nodes = [];
  const wrap = ctx.el('div', 'mx-auto');
  wrap.style.maxWidth = 'min(90vw, 24rem)';
  const board = ctx.el('div', 'relative bg-amber-950/40 rounded-xl');
  board.style.aspectRatio = '1';
  // lines
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 6 6');
  svg.setAttribute('class', 'absolute inset-0 w-full h-full');
  const seen = new Set();
  for (let i = 0; i < 24; i++) for (const j of MORRIS_ADJ[i]) {
    const key = Math.min(i, j) + '-' + Math.max(i, j);
    if (seen.has(key)) continue; seen.add(key);
    const ln = document.createElementNS(NS, 'line');
    ln.setAttribute('x1', COORD[i][0]); ln.setAttribute('y1', COORD[i][1]);
    ln.setAttribute('x2', COORD[j][0]); ln.setAttribute('y2', COORD[j][1]);
    ln.setAttribute('stroke', '#78716c'); ln.setAttribute('stroke-width', '0.08');
    svg.appendChild(ln);
  }
  board.appendChild(svg);
  for (let i = 0; i < 24; i++) {
    const n = ctx.el('button', '');
    n.style.left = (COORD[i][0] / 6 * 100) + '%';
    n.style.top = (COORD[i][1] / 6 * 100) + '%';
    n.onclick = () => click(ctx, i);
    M.nodes[i] = n;
    board.appendChild(n);
  }
  wrap.appendChild(board);
  const hint = ctx.el('p', 'text-center text-slate-400 text-sm mt-2');
  hint.id = 'nmm-hint';
  wrap.appendChild(hint);
  ctx.root.appendChild(wrap);
  updateHint(ctx);
  paint(ctx);
}
function updateHint(ctx) {
  const h = document.getElementById('nmm-hint'); if (!h) return;
  h.textContent = M.awaitRemove ? ctx.t('remove_piece') : (M.placedMine < 9 ? ctx.t('place_phase') : ctx.t('move_phase'));
}
function finishTurn(ctx) {
  if (oppLost()) return ctx.endGame('win');
  ctx.setTurn(false);
}
function afterMillCheck(ctx, pos) {
  if (morrisMillsAt(M.board, pos).length) { M.awaitRemove = true; updateHint(ctx); paint(ctx); }
  else finishTurn(ctx);
}
function click(ctx, pos) {
  if (!ctx.myTurn) return;
  if (M.awaitRemove) {
    if (!removable(pos)) { ctx.sound('error'); return; }
    M.board[pos] = null; ctx.sound('capture'); ctx.send('remove', { pos }); M.awaitRemove = false; updateHint(ctx); paint(ctx);
    if (oppLost()) return ctx.endGame('win');
    ctx.setTurn(false);
    return;
  }
  if (M.placedMine < 9) {
    if (M.board[pos] != null) return;
    M.board[pos] = M.mine; M.placedMine++; ctx.sound('place'); ctx.send('place', { pos }); updateHint(ctx); paint(ctx);
    afterMillCheck(ctx, pos);
    return;
  }
  // moving phase
  if (M.sel != null && M.board[pos] == null && isLegalMove(M.sel, pos)) {
    const from = M.sel;
    M.board[pos] = M.mine; M.board[from] = null; M.sel = null;
    ctx.sound('place'); ctx.send('move', { from, to: pos }); paint(ctx);
    afterMillCheck(ctx, pos);
    return;
  }
  if (M.board[pos] === M.mine) { M.sel = pos; paint(ctx); }
}

export default {
  id: 'morris', name: "Nine Men's Morris", emoji: '🎯', blurb: 'Form mills',
  start(ctx, { iAmFirst }) {
    M.board = Array(24).fill(null);
    M.mine = iAmFirst ? 'A' : 'B'; M.opp = iAmFirst ? 'B' : 'A';
    M.placedMine = 0; M.placedOpp = 0; M.sel = null; M.awaitRemove = false;
    build(ctx);
  },
  onTurn(mine, ctx) { M.sel = null; updateHint(ctx); paint(ctx); },
  // Bot (M.opp): one place/move per turn + a removal if it forms a mill. All decisions on a
  // local board copy so it never double-mutates the real state (onMessage applies the moves).
  botMove(level) {
    const B = M.board.slice(), opp = M.opp, mine = M.mine;
    const emp = () => { const a = []; for (let i = 0; i < 24; i++) if (B[i] === null) a.push(i); return a; };
    const count = (w) => B.filter((v) => v === w).length;
    const mob = (i) => MORRIS_ADJ[i].filter((j) => B[j] === null).length;
    const forms = (pos, w) => { const o = B[pos]; B[pos] = w; const m = morrisMillsAt(B, pos).length > 0; B[pos] = o; return m; };
    const chooseRemove = () => {
      const cand = []; for (let i = 0; i < 24; i++) if (B[i] === mine) cand.push({ i, inM: morrisMillsAt(B, i).length > 0 });
      const anyOut = cand.some((c) => !c.inM);
      const legal = cand.filter((c) => anyOut ? !c.inM : true);
      if (!legal.length) return null;
      if (level === 'easy') return legal[Math.floor(Math.random() * legal.length)].i;
      legal.sort((a, b) => mob(b.i) - mob(a.i));
      return legal[0].i;
    };
    const seq = [];
    if (M.placedOpp < 9) {
      const emps = emp(); let pos = -1;
      for (const e of emps) if (forms(e, opp)) { pos = e; break; }                 // complete own mill
      if (pos < 0 && level !== 'easy') for (const e of emps) if (forms(e, mine)) { pos = e; break; } // block
      if (pos < 0) { if (level === 'easy') pos = emps[Math.floor(Math.random() * emps.length)]; else { let bs = -1; for (const e of emps) { const sc = MORRIS_ADJ[e].filter((j) => B[j] === opp).length + Math.random(); if (sc > bs) { bs = sc; pos = e; } } } }
      seq.push({ type: 'place', pos });
      B[pos] = opp;
      if (morrisMillsAt(B, pos).length) { const rm = chooseRemove(); if (rm != null) seq.push({ type: 'remove', pos: rm }); }
    } else {
      const flying = count(opp) === 3;
      const moves = [];
      for (let i = 0; i < 24; i++) if (B[i] === opp) { const dests = flying ? emp() : MORRIS_ADJ[i].filter((j) => B[j] === null); for (const d of dests) moves.push([i, d]); }
      if (!moves.length) return null;
      let best;
      if (level === 'easy') best = moves[Math.floor(Math.random() * moves.length)];
      else { let bs = -1e9; for (const [f, d] of moves) { B[f] = null; B[d] = opp; let sc = (morrisMillsAt(B, d).length ? 100 : 0) + mob(d) + Math.random(); B[d] = null; B[f] = opp; if (sc > bs) { bs = sc; best = [f, d]; } } }
      const [f, d] = best;
      seq.push({ type: 'move', from: f, to: d });
      B[f] = null; B[d] = opp;
      if (morrisMillsAt(B, d).length) { const rm = chooseRemove(); if (rm != null) seq.push({ type: 'remove', pos: rm }); }
    }
    return seq;
  },
  onMessage(msg, ctx) {
    if (msg.type === 'place') {
      M.board[msg.pos] = M.opp; M.placedOpp++; ctx.sound('place'); updateHint(ctx); paint(ctx);
      if (!morrisMillsAt(M.board, msg.pos).length) { if (iLost()) return ctx.endGame('lose'); ctx.setTurn(true); }
    } else if (msg.type === 'move') {
      M.board[msg.to] = M.opp; M.board[msg.from] = null; ctx.sound('place'); paint(ctx);
      if (!morrisMillsAt(M.board, msg.to).length) { if (iLost()) return ctx.endGame('lose'); ctx.setTurn(true); }
    } else if (msg.type === 'remove') {
      M.board[msg.pos] = null; ctx.sound('capture'); paint(ctx);
      if (iLost()) return ctx.endGame('lose');
      ctx.setTurn(true);
    }
  },
  getState() { return { board: M.board, mine: M.mine, opp: M.opp, placedMine: M.placedMine, placedOpp: M.placedOpp }; },
  restore(state, ctx) {
    M.board = state.board; M.mine = state.mine; M.opp = state.opp;
    M.placedMine = state.placedMine; M.placedOpp = state.placedOpp; M.sel = null; M.awaitRemove = false;
    build(ctx);
  },
};
