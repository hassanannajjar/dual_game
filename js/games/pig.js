const TARGET = 100;
const PIPS = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
const M = { my: 0, opp: 0, turnTotal: 0, oppTurn: 0, dieEl: null, scoreEl: null, ttEl: null, rollBtn: null, holdBtn: null };

function paint(ctx) {
  M.scoreEl.innerHTML = `<span class="text-emerald-400">${M.my}</span> — <span class="text-amber-400">${M.opp}</span>`;
  M.ttEl.textContent = ctx.myTurn ? `Turn total: ${M.turnTotal}` : (M.oppTurn ? `Opponent: ${M.oppTurn}` : '');
  M.rollBtn.disabled = !ctx.myTurn;
  M.holdBtn.disabled = !ctx.myTurn || M.turnTotal === 0;
}
function build(ctx) {
  const wrap = ctx.el('div', 'max-w-xs mx-auto text-center space-y-4 py-4');
  M.scoreEl = ctx.el('div', 'text-4xl font-black');
  wrap.appendChild(ctx.el('p', 'text-xs text-slate-500', `First to ${TARGET}`));
  wrap.appendChild(M.scoreEl);
  M.dieEl = ctx.el('div', 'text-7xl h-24 flex items-center justify-center', '🎲');
  wrap.appendChild(M.dieEl);
  M.ttEl = ctx.el('p', 'text-slate-300 h-6');
  wrap.appendChild(M.ttEl);
  const row = ctx.el('div', 'grid grid-cols-2 gap-3');
  M.rollBtn = ctx.el('button', 'py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-semibold disabled:opacity-40', 'Roll');
  M.holdBtn = ctx.el('button', 'py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-semibold disabled:opacity-40', 'Hold');
  M.rollBtn.onclick = () => roll(ctx);
  M.holdBtn.onclick = () => hold(ctx);
  row.append(M.rollBtn, M.holdBtn);
  wrap.appendChild(row);
  ctx.root.appendChild(wrap);
  paint(ctx);
}
function roll(ctx) {
  if (!ctx.myTurn) return;
  const v = 1 + Math.floor(Math.random() * 6);
  M.dieEl.textContent = PIPS[v];
  ctx.send('roll', { v });
  if (v === 1) { M.turnTotal = 0; ctx.sound('error'); ctx.haptic(60); paint(ctx); ctx.setTurn(false); }
  else { M.turnTotal += v; ctx.sound('drop'); paint(ctx); }
}
function hold(ctx) {
  if (!ctx.myTurn || M.turnTotal === 0) return;
  M.my += M.turnTotal; M.turnTotal = 0; ctx.sound('capture');
  ctx.send('hold', { score: M.my }); paint(ctx);
  if (M.my >= TARGET) return ctx.endGame('win');
  ctx.setTurn(false);
}

export default {
  id: 'pig', name: 'Dice Pig', emoji: '🎲', blurb: 'Push your luck', category: 'luck', difficulty: 'easy',
  start(ctx) { M.my = M.opp = M.turnTotal = M.oppTurn = 0; build(ctx); },
  onTurn(mine, ctx) { if (mine) M.turnTotal = 0; else M.oppTurn = 0; paint(ctx); },
  // Bot plays a whole turn at once (it generates its own dice): roll until a hold threshold or bust.
  botMove(level) {
    const base = level === 'easy' ? 12 : 20;
    const seq = []; let tt = 0;
    while (true) {
      const v = 1 + Math.floor(Math.random() * 6);
      seq.push({ type: 'roll', v });
      if (v === 1) return seq;                         // bust — turn passes back
      tt += v;
      const total = M.opp + tt;
      if (total >= TARGET) { seq.push({ type: 'hold', score: total }); return seq; }
      const goal = (level === 'hard' && M.my >= 80) ? 30 : base;   // hard pushes to catch up
      if (tt >= goal) { seq.push({ type: 'hold', score: total }); return seq; }
    }
  },
  onMessage(msg, ctx) {
    if (msg.type === 'roll') {
      M.dieEl.textContent = PIPS[msg.v];
      if (msg.v === 1) { M.oppTurn = 0; ctx.sound('error'); paint(ctx); ctx.setTurn(true); }
      else { M.oppTurn += msg.v; ctx.sound('drop'); paint(ctx); }
    } else if (msg.type === 'hold') {
      M.opp = msg.score; M.oppTurn = 0; ctx.sound('capture'); paint(ctx);
      if (M.opp >= TARGET) return ctx.endGame('lose');
      ctx.setTurn(true);
    }
  },
  getState() { return { my: M.my, opp: M.opp }; },
  restore(state, ctx) { M.my = state.my; M.opp = state.opp; M.turnTotal = 0; M.oppTurn = 0; build(ctx); },
};
