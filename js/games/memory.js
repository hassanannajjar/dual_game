// Memory / Concentration. Host shuffles the deck and shares it; both flip the same layout.
const POOL = ['🍎', '🚀', '🎸', '🐙', '🌵', '⚡', '🍕', '🎲', '🦊', '🌈', '🔑', '🍔'];
const PAIRS = 8;
const M = { deck: null, matched: [], shown: new Set(), picks: [], oppPicks: [], my: 0, opp: 0, cells: [], scoreEl: null, root: null };

function makeDeck() {
  const chosen = POOL.slice().sort(() => Math.random() - 0.5).slice(0, PAIRS);
  const cards = chosen.concat(chosen);
  for (let i = cards.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [cards[i], cards[j]] = [cards[j], cards[i]]; }
  return cards;
}
function paint(ctx) {
  if (M.botKnown) for (const i of M.shown) M.botKnown.add(i);   // bot remembers every card ever revealed
  for (let i = 0; i < M.deck.length; i++) {
    const face = M.matched[i] || M.shown.has(i);
    const c = M.cells[i];
    c.textContent = face ? M.deck[i] : '';
    c.className = 'aspect-square rounded-xl flex items-center justify-center text-3xl transition ' +
      (M.matched[i] ? 'bg-emerald-700/50' : face ? 'bg-slate-700' : 'bg-slate-800 hover:bg-slate-700');
  }
  M.scoreEl.innerHTML = `<span class="text-emerald-400">${M.my}</span> — <span class="text-amber-400">${M.opp}</span>`;
}
function build(ctx) {
  M.cells = [];
  M.root.innerHTML = '';
  const wrap = ctx.el('div', 'mx-auto');
  wrap.style.maxWidth = 'min(92vw, 26rem)';
  M.scoreEl = ctx.el('div', 'text-center text-2xl font-black mb-2');
  wrap.appendChild(M.scoreEl);
  const grid = ctx.el('div', 'grid grid-cols-4 gap-2');
  for (let i = 0; i < M.deck.length; i++) {
    const c = ctx.el('button', '');
    c.onclick = () => flip(ctx, i);
    M.cells.push(c);
    grid.appendChild(c);
  }
  wrap.appendChild(grid);
  M.root.appendChild(wrap);
  paint(ctx);
}
const allMatched = () => M.matched.length && M.matched.every(Boolean);
function finish(ctx) { ctx.endGame(M.my > M.opp ? 'win' : M.my < M.opp ? 'lose' : 'draw', `${M.my}–${M.opp}`); }

function flip(ctx, i) {
  if (!ctx.myTurn || M.matched[i] || M.shown.has(i) || M.picks.length >= 2) return;
  M.shown.add(i); M.picks.push(i); ctx.sound('flip'); ctx.send('flip', { i }); paint(ctx);
  if (M.picks.length === 2) {
    const [a, b] = M.picks;
    if (M.deck[a] === M.deck[b]) {
      M.matched[a] = M.matched[b] = true; M.my++; M.picks = [];
      ctx.sound('capture'); ctx.send('matched', { a, b }); paint(ctx);
      if (allMatched()) return finish(ctx);
      ctx.setTurn(true);
    } else {
      ctx.send('miss', { a, b });
      setTimeout(() => { M.shown.delete(a); M.shown.delete(b); M.picks = []; paint(ctx); ctx.setTurn(false); }, 900);
    }
  }
}

export default {
  id: 'memory', name: 'Memory Match', emoji: '🧠', blurb: 'Match the pairs',
  start(ctx) {
    M.matched = []; M.shown = new Set(); M.picks = []; M.oppPicks = []; M.my = 0; M.opp = 0; M.deck = null; M.botKnown = new Set();
    M.root = ctx.el('div', 'text-center text-slate-500 py-10', '…');
    ctx.root.appendChild(M.root);
    if (ctx.isHost) { M.deck = makeDeck(); M.matched = Array(M.deck.length).fill(false); ctx.send('deck', { deck: M.deck }); build(ctx); }
  },
  onTurn(mine, ctx) { if (M.deck) paint(ctx); },
  // Bot plays its whole turn at once (returns the flip/matched/miss sequence). easy = random,
  // medium/hard use remembered cards (M.botKnown, filled in paint from every revealed card).
  botMove(level) {
    if (!M.deck) return null;
    const seq = [];
    const matched = M.matched.slice();
    const known = new Set([...M.botKnown].filter((i) => !matched[i]));
    const rand = (a) => a[Math.floor(Math.random() * a.length)];
    const unmatched = () => { const a = []; for (let i = 0; i < M.deck.length; i++) if (!matched[i]) a.push(i); return a; };
    const useMem = level !== 'easy';
    let guard = 0;
    while (guard++ < 40) {
      const um = unmatched();
      if (!um.length) break;
      // known pair?
      let a = -1, b = -1;
      if (useMem) {
        const byVal = {};
        for (const i of known) { if (matched[i]) continue; const v = M.deck[i]; (byVal[v] = byVal[v] || []).push(i); if (byVal[v].length === 2) { a = byVal[v][0]; b = byVal[v][1]; break; } }
      }
      if (a >= 0) { seq.push({ type: 'flip', i: a }, { type: 'flip', i: b }, { type: 'matched', a, b }); matched[a] = matched[b] = true; known.delete(a); known.delete(b); continue; }
      // first pick — prefer an unknown card
      const unknowns = um.filter((i) => useMem ? !known.has(i) : true);
      const first = (unknowns.length ? rand(unknowns) : rand(um));
      seq.push({ type: 'flip', i: first });
      if (useMem) known.add(first);
      // known partner for first?
      let partner = -1;
      if (useMem) for (const i of known) { if (i !== first && !matched[i] && M.deck[i] === M.deck[first]) { partner = i; break; } }
      if (partner >= 0) { seq.push({ type: 'flip', i: partner }, { type: 'matched', a: first, b: partner }); matched[first] = matched[partner] = true; known.delete(first); known.delete(partner); continue; }
      // second pick
      const um2 = unmatched().filter((i) => i !== first);
      if (!um2.length) break;
      const seconds = um2.filter((i) => useMem ? !known.has(i) : true);
      const second = (seconds.length ? rand(seconds) : rand(um2));
      seq.push({ type: 'flip', i: second });
      if (useMem) known.add(second);
      if (M.deck[first] === M.deck[second]) { seq.push({ type: 'matched', a: first, b: second }); matched[first] = matched[second] = true; }
      else { seq.push({ type: 'miss', a: first, b: second }); break; }   // miss ends the turn
    }
    return seq;
  },
  onMessage(msg, ctx) {
    if (msg.type === 'deck') { M.deck = msg.deck; M.matched = Array(M.deck.length).fill(false); build(ctx); return; }
    if (!M.deck) return;
    if (msg.type === 'flip') { M.shown.add(msg.i); M.oppPicks.push(msg.i); ctx.sound('flip'); paint(ctx); }
    else if (msg.type === 'matched') { M.matched[msg.a] = M.matched[msg.b] = true; M.opp++; M.oppPicks = []; ctx.sound('capture'); paint(ctx); if (allMatched()) return finish(ctx); }
    else if (msg.type === 'miss') { const { a, b } = msg; setTimeout(() => { M.shown.delete(a); M.shown.delete(b); M.oppPicks = []; paint(ctx); ctx.setTurn(true); }, 900); }
  },
  getState() { return { deck: M.deck, matched: M.matched, my: M.my, opp: M.opp }; },
  restore(state, ctx) {
    M.deck = state.deck; M.matched = state.matched || []; M.my = state.my; M.opp = state.opp;
    M.shown = new Set(); M.picks = []; M.oppPicks = []; M.botKnown = new Set();
    M.root = ctx.el('div', ''); ctx.root.appendChild(M.root);
    if (M.deck) build(ctx);
  },
};
