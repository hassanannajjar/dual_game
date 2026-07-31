import { ludoStep, ludoAbs } from '../logic.js?v=6';

const PIPS = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
const M = { tokens: { me: [0, 0, 0, 0], opp: [0, 0, 0, 0] }, entryMe: 0, entryOpp: 26, pending: null,
  dieEl: null, rollBtn: null, trackEls: [], tokBtns: [], msgEl: null };

function tokenLabel(s) { return s === 0 ? 'Base' : s === 57 ? '✓ Home' : s >= 52 ? 'Home ' + (s - 51) : '#' + ludoAbs(M.entryMe, s); }
function movable(i, v) { return ludoStep(M.tokens.me[i], v) !== null; }

function paint(ctx) {
  for (let c = 0; c < 52; c++) M.trackEls[c].innerHTML = '';
  const dot = (cls) => `<span class="inline-block w-2 h-2 rounded-full ${cls}"></span>`;
  for (const side of ['me', 'opp']) for (const s of M.tokens[side]) {
    const abs = ludoAbs(side === 'me' ? M.entryMe : M.entryOpp, s);
    if (abs != null) M.trackEls[abs].innerHTML += dot(side === 'me' ? 'bg-emerald-400' : 'bg-amber-400');
  }
  for (let i = 0; i < 4; i++) {
    const b = M.tokBtns[i]; const s = M.tokens.me[i];
    b.textContent = `T${i + 1}: ${tokenLabel(s)}`;
    const can = ctx.myTurn && M.pending != null && movable(i, M.pending);
    b.disabled = !can;
    b.className = 'py-1.5 px-2 rounded-lg text-xs font-semibold ' + (can ? 'bg-emerald-600' : 'bg-slate-800 text-slate-500');
  }
  M.rollBtn.disabled = !ctx.myTurn || M.pending != null;
  const homeMe = M.tokens.me.filter((s) => s === 57).length, homeOpp = M.tokens.opp.filter((s) => s === 57).length;
  M.msgEl.textContent = `You home ${homeMe}/4 · Opp ${homeOpp}/4` + (ctx.myTurn ? (M.pending ? ' — move a token' : ' — roll') : ' — opponent');
}
function build(ctx) {
  M.trackEls = []; M.tokBtns = [];
  const wrap = ctx.el('div', 'max-w-lg mx-auto space-y-3');
  const bar = ctx.el('div', 'flex items-center justify-center gap-4');
  M.dieEl = ctx.el('div', 'text-4xl', '🎲');
  M.rollBtn = ctx.el('button', 'px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-semibold disabled:opacity-40', 'Roll');
  M.rollBtn.onclick = () => roll(ctx);
  bar.append(M.dieEl, M.rollBtn);
  wrap.appendChild(bar);
  const track = ctx.el('div', 'flex flex-wrap gap-0.5 justify-center');
  for (let c = 0; c < 52; c++) {
    const cell = ctx.el('div', 'w-4 h-4 rounded-sm bg-slate-800 flex flex-wrap items-center justify-center leading-none');
    if (c === M.entryMe) cell.classList.add('ring-1', 'ring-emerald-500');
    if (c === M.entryOpp) cell.classList.add('ring-1', 'ring-amber-500');
    M.trackEls[c] = cell; track.appendChild(cell);
  }
  wrap.appendChild(track);
  const toks = ctx.el('div', 'grid grid-cols-2 gap-2');
  for (let i = 0; i < 4; i++) { const b = ctx.el('button', ''); b.onclick = () => clickToken(ctx, i); M.tokBtns[i] = b; toks.appendChild(b); }
  wrap.appendChild(toks);
  M.msgEl = ctx.el('p', 'text-center text-slate-400 text-sm');
  wrap.appendChild(M.msgEl);
  ctx.root.appendChild(wrap);
  paint(ctx);
}
function applyMove(ctx, side, i, v) {
  const ns = ludoStep(M.tokens[side][i], v); M.tokens[side][i] = ns;
  const abs = ludoAbs(side === 'me' ? M.entryMe : M.entryOpp, ns);
  if (abs != null) {
    const other = side === 'me' ? 'opp' : 'me', oe = side === 'me' ? M.entryOpp : M.entryMe;
    for (let j = 0; j < 4; j++) if (ludoAbs(oe, M.tokens[other][j]) === abs) { M.tokens[other][j] = 0; ctx.sound('capture'); }
  }
}
function postMove(ctx, side, v) {
  paint(ctx);
  if (M.tokens[side].every((s) => s === 57)) return ctx.endGame(side === 'me' ? 'win' : 'lose');
  if (v === 6) { if (side === 'me') ctx.setTurn(true); }       // extra turn on a six
  else ctx.setTurn(side === 'me' ? false : true);
}
function roll(ctx) {
  if (!ctx.myTurn || M.pending != null) return;
  const v = 1 + Math.floor(Math.random() * 6);
  M.dieEl.textContent = PIPS[v]; ctx.send('roll', { v }); ctx.sound('drop');
  const mv = [0, 1, 2, 3].filter((i) => movable(i, v));
  if (!mv.length) { ctx.send('nomove', {}); M.pending = null; paint(ctx); ctx.setTurn(false); return; }
  M.pending = v; paint(ctx);
}
function clickToken(ctx, i) {
  if (M.pending == null || !ctx.myTurn || !movable(i, M.pending)) return;
  const v = M.pending; M.pending = null;
  applyMove(ctx, 'me', i, v); ctx.send('move', { i, v });
  postMove(ctx, 'me', v);
}

export default {
  id: 'ludo', name: 'Ludo', emoji: '🎯', blurb: 'Race your tokens home',
  start(ctx, { iAmFirst }) {
    M.tokens = { me: [0, 0, 0, 0], opp: [0, 0, 0, 0] };
    M.entryMe = iAmFirst ? 0 : 26; M.entryOpp = iAmFirst ? 26 : 0; M.pending = null;
    build(ctx);
  },
  onTurn(mine, ctx) { if (mine) M.pending = null; paint(ctx); },
  onMessage(msg, ctx) {
    if (msg.type === 'roll') { M.dieEl.textContent = PIPS[msg.v]; ctx.sound('drop'); }
    else if (msg.type === 'nomove') { ctx.setTurn(true); }
    else if (msg.type === 'move') { applyMove(ctx, 'opp', msg.i, msg.v); postMove(ctx, 'opp', msg.v); }
  },
  getState() { return { tokens: M.tokens, entryMe: M.entryMe, entryOpp: M.entryOpp }; },
  restore(state, ctx) { M.tokens = state.tokens; M.entryMe = state.entryMe; M.entryOpp = state.entryOpp; M.pending = null; build(ctx); },
};
