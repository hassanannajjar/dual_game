import { ONITAMA_CARDS, onitamaStart, onitamaWinner } from '../logic.js?v=48';

// 5x5. Side A (indigo, codes 1/2) sits at the bottom and moves up toward row 0; side B (rose, 3/4) mirrors.
// Fixed 5-card deal keeps both peers in sync without a handshake: A={tiger,crab} B={monkey,crane} middle=mantis.
const M = { b: [], side: 'a', cards: { a: ['tiger', 'crab'], b: ['monkey', 'crane'], mid: 'mantis' },
  selCard: null, sel: null, legal: [], last: null, cells: [], cardEls: {}, msgEl: null };
const isMine = (v) => M.side === 'a' ? (v === 1 || v === 2) : (v === 3 || v === 4);
const isMaster = (v) => v === 2 || v === 4;
function offsets(card, side) { return ONITAMA_CARDS[card].map(([dx, dy]) => side === 'a' ? [dx, dy] : [-dx, -dy]); }
function legalFor(from, card, side) {
  const [x, y] = from, out = [];
  for (const [dx, dy] of offsets(card, side)) { const tx = x + dx, ty = y + dy; if (tx < 0 || tx > 4 || ty < 0 || ty > 4) continue; const t = M.b[ty][tx]; if (t && (side === 'a' ? (t === 1 || t === 2) : (t === 3 || t === 4))) continue; out.push([tx, ty]); }
  return out;
}
function glyph(v) { return v === 0 ? '' : isMaster(v) ? '♛' : '●'; }
function colorFor(v) { return (v === 1 || v === 2) ? 'text-indigo-300' : 'text-rose-300'; }

function cardGrid(ctx, card, side, active, onClick) {
  const wrap = ctx.el('button', 'p-2 rounded-lg border text-center ' + (active ? 'border-emerald-400 bg-slate-800' : 'border-slate-700 bg-slate-900'));
  const g = ctx.el('div', 'grid gap-0.5 mx-auto'); g.style.gridTemplateColumns = 'repeat(5, 0.5rem)';
  const set = new Set(offsets(card, side).map(([dx, dy]) => (2 + dx) + ',' + (2 + dy)));
  for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) {
    const c = ctx.el('div', 'w-2 h-2 rounded-sm ' + (x === 2 && y === 2 ? 'bg-slate-400' : set.has(x + ',' + y) ? 'bg-emerald-400' : 'bg-slate-700'));
    g.appendChild(c);
  }
  wrap.appendChild(g);
  wrap.appendChild(ctx.el('div', 'text-[10px] mt-1 text-slate-400', ctx.t('onitama_' + card)));
  if (onClick) wrap.onclick = onClick; else wrap.disabled = true;
  return wrap;
}
function paint(ctx) {
  const legalSet = new Set(M.legal.map(([x, y]) => x + ',' + y));
  for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) {
    const cell = M.cells[y][x], v = M.b[y][x], light = (x + y) % 2 === 0, arch = (x === 2 && (y === 0 || y === 4));
    cell.className = 'relative aspect-square flex items-center justify-center text-2xl font-bold ' + (arch ? 'bg-amber-800/60' : light ? 'bg-amber-200/80' : 'bg-amber-700/70') + ' ' + colorFor(v);
    if (M.last && ((M.last.from[0] === x && M.last.from[1] === y) || (M.last.to[0] === x && M.last.to[1] === y))) cell.className += ' ring-2 ring-inset ring-emerald-300/70';
    if (M.sel && M.sel[0] === x && M.sel[1] === y) cell.className += ' ring-4 ring-inset ring-emerald-400';
    else if (legalSet.has(x + ',' + y)) cell.className += ' ring-4 ring-inset ring-emerald-300/50';
    cell.textContent = glyph(v);
  }
  if (M.msgEl) M.msgEl.textContent = ctx.myTurn ? (M.selCard ? ctx.t('onitama_pick_piece') : ctx.t('onitama_pick_card')) : ctx.t('opp_move');
  renderCards(ctx);
}
function renderCards(ctx) {
  const oppSide = M.side === 'a' ? 'b' : 'a';
  M.cardEls.mine.innerHTML = ''; M.cardEls.opp.innerHTML = ''; M.cardEls.mid.innerHTML = '';
  for (const c of M.cards[M.side]) M.cardEls.mine.appendChild(cardGrid(ctx, c, M.side, ctx.myTurn && M.selCard === c, () => { if (!ctx.myTurn) return; M.selCard = c; M.sel = null; M.legal = []; ctx.sound('click'); paint(ctx); }));
  for (const c of M.cards[oppSide]) M.cardEls.opp.appendChild(cardGrid(ctx, c, oppSide, false, null));
  M.cardEls.mid.appendChild(cardGrid(ctx, M.cards.mid, M.side, false, null));
}
function build(ctx) {
  M.cells = [];
  const wrap = ctx.el('div', 'mx-auto space-y-2'); wrap.style.maxWidth = 'min(94vw, 26rem)';
  M.msgEl = ctx.el('p', 'text-center text-slate-400 text-sm'); wrap.appendChild(M.msgEl);
  const oppRow = ctx.el('div', 'flex justify-center gap-2'); M.cardEls = { opp: oppRow };
  wrap.appendChild(oppRow);
  const grid = ctx.el('div', 'grid gap-px bg-amber-950/60 p-1 rounded-lg'); grid.style.gridTemplateColumns = 'repeat(5, 1fr)';
  for (let y = 0; y < 5; y++) { M.cells[y] = []; for (let x = 0; x < 5; x++) { const c = ctx.el('button', ''); c.onclick = () => click(ctx, x, y); M.cells[y][x] = c; grid.appendChild(c); } }
  wrap.appendChild(grid);
  const midRow = ctx.el('div', 'flex justify-center'); M.cardEls.mid = midRow; wrap.appendChild(midRow);
  const mineRow = ctx.el('div', 'flex justify-center gap-2'); M.cardEls.mine = mineRow; wrap.appendChild(mineRow);
  ctx.root.appendChild(wrap);
  paint(ctx);
}
function endIfWon(ctx) { const w = onitamaWinner(M.b); if (!w) return false; ctx.endGame((w === 1 ? 'a' : 'b') === M.side ? 'win' : 'lose'); return true; }
function swapCard(side, card) { M.cards[side] = M.cards[side].filter((c) => c !== card).concat([M.cards.mid]); M.cards.mid = card; }
function click(ctx, x, y) {
  if (!ctx.myTurn || !M.selCard) return;
  if (M.sel && M.legal.some(([lx, ly]) => lx === x && ly === y)) {
    const from = M.sel, cap = !!M.b[y][x];
    M.b[y][x] = M.b[from[1]][from[0]]; M.b[from[1]][from[0]] = 0; M.last = { from, to: [x, y] };
    const card = M.selCard; swapCard(M.side, card);
    M.sel = null; M.legal = []; M.selCard = null; ctx.sound(cap ? 'capture' : 'place'); paint(ctx);
    ctx.send('move', { card, from, to: [x, y] });
    if (endIfWon(ctx)) return; ctx.setTurn(false); return;
  }
  if (isMine(M.b[y][x])) { M.sel = [x, y]; M.legal = legalFor([x, y], M.selCard, M.side); paint(ctx); }
  else { M.sel = null; M.legal = []; paint(ctx); }
}

export default {
  id: 'onitama', name: 'Onitama', emoji: '🐉', blurb: 'Card-move martial duel',
  start(ctx, { iAmFirst }) {
    M.b = onitamaStart(); M.side = iAmFirst ? 'a' : 'b';
    M.cards = { a: ['tiger', 'crab'], b: ['monkey', 'crane'], mid: 'mantis' };
    M.selCard = null; M.sel = null; M.legal = []; M.last = null;
    build(ctx);
  },
  onTurn(mine, ctx) { M.sel = null; M.legal = []; M.selCard = null; paint(ctx); },
  onMessage(msg, ctx) {
    if (msg.type !== 'move') return;
    const oppSide = M.side === 'a' ? 'b' : 'a';
    const cap = !!M.b[msg.to[1]][msg.to[0]];
    M.b[msg.to[1]][msg.to[0]] = M.b[msg.from[1]][msg.from[0]]; M.b[msg.from[1]][msg.from[0]] = 0; M.last = { from: msg.from, to: msg.to };
    swapCard(oppSide, msg.card); ctx.sound(cap ? 'capture' : 'place'); paint(ctx);
    if (endIfWon(ctx)) return; ctx.setTurn(true);
  },
  botMove(level) {
    const side = M.side === 'a' ? 'b' : 'a', moves = [];
    for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) { const v = M.b[y][x]; const mineHere = side === 'a' ? (v === 1 || v === 2) : (v === 3 || v === 4); if (!mineHere) continue; for (const card of M.cards[side]) for (const to of legalFor([x, y], card, side)) moves.push({ card, from: [x, y], to }); }
    if (!moves.length) return null;
    const score = (m) => { const t = M.b[m.to[1]][m.to[0]]; let s = 0; if (isMaster(t)) s += 1000; else if (t) s += 40; const arch = side === 'a' ? [2, 0] : [2, 4]; if (isMaster(M.b[m.from[1]][m.from[0]]) && m.to[0] === arch[0] && m.to[1] === arch[1]) s += 1000; s += side === 'a' ? (4 - m.to[1]) : m.to[1]; return s; };
    if (level === 'easy') return Object.assign({ type: 'move' }, moves[Math.floor(Math.random() * moves.length)]);
    let best = moves[0], bs = -1e9;
    for (const m of moves) { const s = score(m) + (level === 'hard' ? 0 : Math.random() * 5); if (s > bs) { bs = s; best = m; } }
    return Object.assign({ type: 'move' }, best);
  },
  getState() { return { b: M.b, side: M.side, cards: M.cards, last: M.last }; },
  restore(state, ctx) { M.b = state.b; M.side = state.side; M.cards = state.cards; M.last = state.last || null; M.selCard = null; M.sel = null; M.legal = []; build(ctx); },
};
