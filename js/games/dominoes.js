import { dominoDeck, dominoPips, dominoCanPlay } from '../logic.js?v=42';

// Block Dominoes (2P): deal 7 each, no boneyard draw. Match an open end; must play if able, else pass.
// First to empty their hand wins; if both pass in a row the game is blocked and the lower pip count wins.
const M = {};

function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function fitSides(tile, ends) {                 // which open ends this tile can attach to
  if (ends == null) return ['R'];
  const s = [];
  if (tile[0] === ends[0] || tile[1] === ends[0]) s.push('L');
  if (tile[0] === ends[1] || tile[1] === ends[1]) s.push('R');
  return s;
}
function applySide(ends, tile, side) {          // -> { ends:[l,r], placed:[inner,outer] }
  if (ends == null) return { ends: [tile[0], tile[1]], placed: tile.slice() };
  if (side === 'R') { const outer = tile[0] === ends[1] ? tile[1] : tile[0]; return { ends: [ends[0], outer], placed: [ends[1], outer] }; }
  const outer = tile[1] === ends[0] ? tile[0] : tile[1]; return { ends: [outer, ends[1]], placed: [outer, ends[0]] };
}

function tilePill(ctx, tile, cls) {
  return ctx.el('span', 'inline-flex items-center gap-0.5 px-2 py-1 rounded-md bg-slate-100 text-slate-900 font-bold text-sm shadow ' + (cls || ''),
    `${tile[0]}<span class="text-slate-400">·</span>${tile[1]}`);
}
function build(ctx) {
  const wrap = ctx.el('div', 'max-w-md mx-auto space-y-3');
  M.statusEl = ctx.el('p', 'text-center text-sm text-slate-400 h-5'); wrap.appendChild(M.statusEl);
  M.lineEl = ctx.el('div', 'flex flex-wrap gap-1 justify-center min-h-[2.5rem] p-2 rounded-xl bg-slate-900 border border-slate-800'); wrap.appendChild(M.lineEl);
  M.oppEl = ctx.el('p', 'text-center text-xs text-slate-500'); wrap.appendChild(M.oppEl);
  M.handEl = ctx.el('div', 'flex flex-wrap gap-1.5 justify-center'); wrap.appendChild(M.handEl);
  M.pickEl = ctx.el('div', 'flex gap-2 justify-center'); wrap.appendChild(M.pickEl);
  M.passBtn = ctx.el('button', 'mx-auto block px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 font-semibold text-sm', ctx.t('dom_pass'));
  M.passBtn.onclick = () => myPass(ctx);
  wrap.appendChild(M.passBtn);
  ctx.root.appendChild(wrap);
  paint(ctx);
}
function paint(ctx) {
  if (!M.lineEl) return;
  M.lineEl.innerHTML = '';
  if (!M.line.length) M.lineEl.appendChild(ctx.el('span', 'text-slate-600 text-xs self-center', ctx.t('dom_empty')));
  for (const t of M.line) M.lineEl.appendChild(tilePill(ctx, t));
  M.oppEl.textContent = ctx.t('dom_opp_tiles', { n: M.oppCount });
  M.statusEl.textContent = ctx.myTurn ? ctx.t('dom_your_turn') : ctx.t('dom_wait');
  const canPlay = dominoCanPlay(M.myHand, M.ends);
  M.handEl.innerHTML = '';
  M.myHand.forEach((t, i) => {
    const playable = ctx.myTurn && fitSides(t, M.ends).length > 0;
    const pill = tilePill(ctx, t, (playable ? 'ring-2 ring-emerald-400 cursor-pointer' : 'opacity-50'));
    if (playable) pill.onclick = () => selectTile(ctx, i);
    if (M.sel === i) pill.classList.add('ring-4', 'ring-indigo-400');
    M.handEl.appendChild(pill);
  });
  M.pickEl.innerHTML = '';
  if (M.sel != null && ctx.myTurn) {
    const sides = fitSides(M.myHand[M.sel], M.ends);
    if (sides.length > 1) for (const s of sides) {
      const b = ctx.el('button', 'px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-semibold text-sm', s === 'L' ? '◀ ' + ctx.t('dom_left') : ctx.t('dom_right') + ' ▶');
      b.onclick = () => playTile(ctx, M.sel, s);
      M.pickEl.appendChild(b);
    }
  }
  // pass only allowed when no legal move
  M.passBtn.classList.toggle('hidden', !(ctx.myTurn && !canPlay));
}
function selectTile(ctx, i) {
  const sides = fitSides(M.myHand[i], M.ends);
  if (sides.length === 1) { playTile(ctx, i, sides[0]); return; }
  M.sel = i; ctx.sound('click'); paint(ctx);
}
function playTile(ctx, i, side) {
  if (!ctx.myTurn) return;
  const tile = M.myHand[i];
  const r = applySide(M.ends, tile, side);
  M.ends = r.ends;
  if (side === 'L') M.line.unshift(r.placed); else M.line.push(r.placed);
  M.myHand.splice(i, 1); M.sel = null; M.lastPassBy = null;
  ctx.sound('place'); ctx.send('play', { tile, side });
  paint(ctx);
  if (!M.myHand.length) { ctx.send('done', {}); return ctx.endGame('win', ctx.t('dom_emptied')); }
  ctx.setTurn(false);
}
function myPass(ctx) {
  if (!ctx.myTurn) return;
  ctx.sound('invalid');
  ctx.send('pass', { pips: dominoPips(M.myHand) });
  if (M.lastPassBy === 'opp') return resolveBlock(ctx);   // opp passed just before me → blocked
  M.lastPassBy = 'me'; ctx.setTurn(false);
}
function resolveBlock(ctx) {
  const my = dominoPips(M.myHand), op = M.oppPips || 0;
  const outcome = my < op ? 'win' : my > op ? 'lose' : 'draw';
  ctx.send('result', { outcome: outcome === 'win' ? 'lose' : outcome === 'lose' ? 'win' : 'draw' });
  ctx.endGame(outcome, ctx.t('dom_blocked'));
}

export default {
  id: 'dominoes', name: 'Dominoes', emoji: '🁫', blurb: 'Match tiles, empty your hand',
  start(ctx, { iAmFirst }) {
    M.line = []; M.ends = null; M.oppCount = 7; M.lastPassBy = null; M.oppPips = 0; M.sel = null; M.dealt = false;
    if (ctx.isHost) {
      const deck = shuffle(dominoDeck());
      M.myHand = deck.slice(0, 7);
      ctx.send('deal', { hand: deck.slice(7, 14) });   // guest's hand (processed after this start returns)
    } else { M.myHand = []; }
    build(ctx);
  },
  onTurn(mine, ctx) { if (!mine) M.sel = null; paint(ctx); },
  onMessage(msg, ctx) {
    if (msg.type === 'deal') { M.myHand = msg.hand; M.dealt = true; paint(ctx); return; }
    if (msg.type === 'play') {
      const r = applySide(M.ends, msg.tile, msg.side);
      M.ends = r.ends;
      if (msg.side === 'L' && M.line.length) M.line.unshift(r.placed); else M.line.push(r.placed);
      M.oppCount = Math.max(0, M.oppCount - 1); M.lastPassBy = null;
      ctx.sound('place'); paint(ctx);
      if (M.oppCount === 0) return;                          // wait for their 'done' to end
      ctx.setTurn(true);
    } else if (msg.type === 'done') {
      ctx.endGame('lose', ctx.t('dom_opp_emptied'));
    } else if (msg.type === 'pass') {
      M.oppPips = msg.pips || 0;
      if (M.lastPassBy === 'me') return resolveBlock(ctx);   // I passed, now opp passed → I resolve
      M.lastPassBy = 'opp'; ctx.sound('invalid'); ctx.setTurn(true);
    } else if (msg.type === 'result') {
      ctx.endGame(msg.outcome, ctx.t('dom_blocked'));
    }
  },
  // ---- bot ----
  botInit(level) { M.botLevel = level; M.botHand = []; M.botEnds = null; },
  botOnGame(msg, send, level) {
    if (msg.type === 'deal') { M.botHand = msg.hand.slice(); M.botEnds = null; }
    else if (msg.type === 'play') { M.botEnds = applySide(M.botEnds, msg.tile, msg.side).ends; }
  },
  botMove(level) {
    const playable = M.botHand.map((t, i) => ({ t, i, sides: fitSides(t, M.botEnds) })).filter((x) => x.sides.length);
    if (!playable.length) return { type: 'pass', pips: dominoPips(M.botHand) };
    let pick;
    if (level === 'easy') pick = playable[Math.floor(Math.random() * playable.length)];
    else pick = playable.sort((a, b) => (b.t[0] + b.t[1]) - (a.t[0] + a.t[1]))[0];   // dump heavy tiles
    const side = pick.sides[0];
    M.botEnds = applySide(M.botEnds, pick.t, side).ends;
    M.botHand.splice(pick.i, 1);
    const done = M.botHand.length === 0;
    const msgs = [{ type: 'play', tile: pick.t, side }];
    if (done) msgs.push({ type: 'done' });
    return msgs;
  },
  getState() { return { line: M.line, ends: M.ends, myHand: M.myHand, oppCount: M.oppCount, lastPassBy: M.lastPassBy, oppPips: M.oppPips }; },
  restore(s, ctx) { M.line = s.line || []; M.ends = s.ends || null; M.myHand = s.myHand || []; M.oppCount = s.oppCount ?? 7; M.lastPassBy = s.lastPassBy || null; M.oppPips = s.oppPips || 0; M.sel = null; build(ctx); },
};
