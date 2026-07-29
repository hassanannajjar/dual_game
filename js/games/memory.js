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
    M.matched = []; M.shown = new Set(); M.picks = []; M.oppPicks = []; M.my = 0; M.opp = 0; M.deck = null;
    M.root = ctx.el('div', 'text-center text-slate-500 py-10', '…');
    ctx.root.appendChild(M.root);
    if (ctx.isHost) { M.deck = makeDeck(); M.matched = Array(M.deck.length).fill(false); ctx.send('deck', { deck: M.deck }); build(ctx); }
  },
  onTurn(mine, ctx) { if (M.deck) paint(ctx); },
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
    M.shown = new Set(); M.picks = []; M.oppPicks = [];
    M.root = ctx.el('div', ''); ctx.root.appendChild(M.root);
    if (M.deck) build(ctx);
  },
};
