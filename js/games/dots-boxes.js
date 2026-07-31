import { boxClosed } from '../logic.js?v=8';

const D = 5, B = D - 1; // dots per side, boxes per side
const M = { H: [], V: [], owner: [], me: 'A', opp: 'B', hEls: [], vEls: [], boxEls: [], scoreEl: null };

const newH = () => Array.from({ length: D }, () => Array(B).fill(false));
const newV = () => Array.from({ length: B }, () => Array(D).fill(false));
const newOwner = () => Array.from({ length: B }, () => Array(B).fill(null));
const filled = () => M.owner.every((row) => row.every(Boolean));

function applyEdge(t, r, c, owner) {
  if (t === 'h') M.H[r][c] = true; else M.V[r][c] = true;
  let done = 0;
  const boxes = t === 'h' ? [[r - 1, c], [r, c]] : [[r, c - 1], [r, c]];
  for (const [br, bc] of boxes) {
    if (br >= 0 && br < B && bc >= 0 && bc < B && !M.owner[br][bc] && boxClosed(M.H, M.V, br, bc)) {
      M.owner[br][bc] = owner; done++;
    }
  }
  return done;
}
function score() { let me = 0, opp = 0; for (const row of M.owner) for (const o of row) { if (o === M.me) me++; else if (o === M.opp) opp++; } return { me, opp }; }
function paint() {
  for (let r = 0; r < D; r++) for (let c = 0; c < B; c++) M.hEls[r][c].className = edgeCls(M.H[r][c], 'h');
  for (let r = 0; r < B; r++) for (let c = 0; c < D; c++) M.vEls[r][c].className = edgeCls(M.V[r][c], 'v');
  for (let br = 0; br < B; br++) for (let bc = 0; bc < B; bc++) {
    const o = M.owner[br][bc];
    M.boxEls[br][bc].className = 'flex items-center justify-center text-xs font-bold ' +
      (o === M.me ? 'bg-emerald-500/70' : o === M.opp ? 'bg-amber-500/70' : 'bg-transparent');
    M.boxEls[br][bc].textContent = o === M.me ? '●' : o === M.opp ? '○' : '';
  }
  const s = score();
  M.scoreEl.innerHTML = `<span class="text-emerald-400">${s.me}</span> — <span class="text-amber-400">${s.opp}</span>`;
}
function edgeCls(on, dir) {
  const base = dir === 'h' ? 'rounded-full h-1.5 ' : 'rounded-full w-1.5 ';
  return base + (on ? 'bg-indigo-400' : 'bg-slate-700 hover:bg-slate-500');
}

function build(ctx) {
  M.hEls = newH().map((r) => r.map(() => null));
  M.vEls = newV().map((r) => r.map(() => null));
  M.boxEls = newOwner().map((r) => r.map(() => null));
  const wrap = ctx.el('div', 'mx-auto');
  wrap.style.maxWidth = 'min(92vw, 26rem)';
  M.scoreEl = ctx.el('div', 'text-center text-2xl font-black mb-2');
  wrap.appendChild(M.scoreEl);
  const grid = ctx.el('div', 'grid gap-0.5 items-center justify-items-center');
  const cols = [];
  for (let i = 0; i < 2 * D - 1; i++) cols.push(i % 2 === 0 ? '10px' : '1fr');
  grid.style.gridTemplateColumns = cols.join(' ');
  for (let gr = 0; gr < 2 * D - 1; gr++) {
    for (let gc = 0; gc < 2 * D - 1; gc++) {
      const evR = gr % 2 === 0, evC = gc % 2 === 0;
      let cell;
      if (evR && evC) { cell = ctx.el('div', 'w-2.5 h-2.5 rounded-full bg-slate-300'); }
      else if (evR && !evC) { const r = gr / 2, c = (gc - 1) / 2; cell = ctx.el('button', edgeCls(false, 'h')); cell.style.width = '100%'; cell.onclick = () => play(ctx, 'h', r, c); M.hEls[r][c] = cell; }
      else if (!evR && evC) { const r = (gr - 1) / 2, c = gc / 2; cell = ctx.el('button', edgeCls(false, 'v')); cell.style.height = '100%'; cell.style.minHeight = '18px'; cell.onclick = () => play(ctx, 'v', r, c); M.vEls[r][c] = cell; }
      else { const br = (gr - 1) / 2, bc = (gc - 1) / 2; cell = ctx.el('div', ''); cell.style.width = '100%'; cell.style.height = '100%'; cell.style.minHeight = '18px'; M.boxEls[br][bc] = cell; }
      grid.appendChild(cell);
    }
  }
  wrap.appendChild(grid);
  ctx.root.appendChild(wrap);
  paint();
}
function finish(ctx) { const s = score(); ctx.endGame(s.me > s.opp ? 'win' : s.me < s.opp ? 'lose' : 'draw', `${s.me}–${s.opp}`); }
function play(ctx, t, r, c) {
  if (!ctx.myTurn) return;
  if (t === 'h' ? M.H[r][c] : M.V[r][c]) return;
  const done = applyEdge(t, r, c, M.me);
  ctx.sound(done ? 'capture' : 'drop'); paint();
  ctx.send('move', { t, r, c });
  if (filled()) return finish(ctx);
  if (done > 0) ctx.setTurn(true); else ctx.setTurn(false);
}

export default {
  id: 'dots', name: 'Dots & Boxes', emoji: '⬜', blurb: 'Close the boxes',
  start(ctx, { iAmFirst }) {
    M.H = newH(); M.V = newV(); M.owner = newOwner();
    M.me = iAmFirst ? 'A' : 'B'; M.opp = iAmFirst ? 'B' : 'A';
    build(ctx);
  },
  onTurn() { /* clicks gated by ctx.myTurn */ },
  onMessage(msg, ctx) {
    if (msg.type !== 'move') return;
    const done = applyEdge(msg.t, msg.r, msg.c, M.opp);
    ctx.sound(done ? 'capture' : 'drop'); paint();
    if (filled()) return finish(ctx);
    if (done === 0) ctx.setTurn(true);
  },
  botMove(level) {
    const H2 = M.H.map((r) => r.slice()), V2 = M.V.map((r) => r.slice());
    const undrawn = () => { const e = []; for (let r = 0; r < D; r++) for (let c = 0; c < B; c++) if (!H2[r][c]) e.push(['h', r, c]); for (let r = 0; r < B; r++) for (let c = 0; c < D; c++) if (!V2[r][c]) e.push(['v', r, c]); return e; };
    const sides = (br, bc) => (H2[br][bc] ? 1 : 0) + (H2[br + 1][bc] ? 1 : 0) + (V2[br][bc] ? 1 : 0) + (V2[br][bc + 1] ? 1 : 0);
    const adj = (t, r, c) => t === 'h' ? [[r - 1, c], [r, c]] : [[r, c - 1], [r, c]];
    const set = (t, r, c, v) => { if (t === 'h') H2[r][c] = v; else V2[r][c] = v; };
    const inb = (br, bc) => br >= 0 && br < B && bc >= 0 && bc < B;
    const closes = (t, r, c) => { set(t, r, c, true); let n = 0; for (const [br, bc] of adj(t, r, c)) if (inb(br, bc) && sides(br, bc) === 4) n++; set(t, r, c, false); return n; };
    const givesThree = (t, r, c) => { set(t, r, c, true); let bad = false; for (const [br, bc] of adj(t, r, c)) if (inb(br, bc) && sides(br, bc) === 3) bad = true; set(t, r, c, false); return bad; };
    const rand = (a) => a[Math.floor(Math.random() * a.length)];
    if (level === 'easy') { const e = undrawn(); if (!e.length) return null; const [t, r, c] = rand(e); return [{ type: 'move', t, r, c }]; }
    const moves = [];
    for (;;) {
      const e = undrawn(); if (!e.length) break;
      const comp = e.find(([t, r, c]) => closes(t, r, c) > 0);
      if (comp) { set(comp[0], comp[1], comp[2], true); moves.push({ type: 'move', t: comp[0], r: comp[1], c: comp[2] }); continue; }
      const safe = e.filter(([t, r, c]) => !givesThree(t, r, c));
      const p = rand(safe.length ? safe : e);
      set(p[0], p[1], p[2], true); moves.push({ type: 'move', t: p[0], r: p[1], c: p[2] });
      break;
    }
    return moves;
  },
  getState() { return { H: M.H, V: M.V, owner: M.owner, me: M.me, opp: M.opp }; },
  restore(state, ctx) { M.H = state.H; M.V = state.V; M.owner = state.owner; M.me = state.me; M.opp = state.opp; build(ctx); },
};
