// Simultaneous game: both pick secretly, then reveal. First to 3 wins (best of 5).
const BEATS = { rock: 'scissors', paper: 'rock', scissors: 'paper' };
const ICON = { rock: '🪨', paper: '📄', scissors: '✂️' };
const TARGET = 3;
const M = { my: 0, opp: 0, myPick: null, oppPick: null, btns: {}, scoreEl: null, resultEl: null };

function refreshScore() { M.scoreEl.innerHTML = `<span class="text-emerald-400">${M.my}</span> — <span class="text-amber-400">${M.opp}</span>`; }
function setEnabled(on) { for (const k in M.btns) M.btns[k].disabled = !on; }

function resolve(ctx) {
  const mine = M.myPick, opp = M.oppPick;
  let line;
  if (mine === opp) line = "Tie";
  else if (BEATS[mine] === opp) { M.my++; line = 'You win the round!'; }
  else { M.opp++; line = 'Opponent wins the round.'; }
  refreshScore();
  ctx.save();
  M.resultEl.innerHTML = `You ${ICON[mine]} vs ${ICON[opp]} Opponent — <b>${line}</b>`;
  if (M.my >= TARGET || M.opp >= TARGET) {
    setTimeout(() => ctx.endGame(M.my > M.opp ? 'win' : 'lose', `Final ${M.my}–${M.opp}`), 900);
    return;
  }
  setTimeout(() => {
    M.myPick = M.oppPick = null;
    for (const k in M.btns) M.btns[k].classList.remove('ring-2', 'ring-indigo-500');
    setEnabled(true);
    M.resultEl.textContent = 'Pick your move…';
  }, 1200);
}

export default {
  id: 'rps', name: 'Rock Paper Scissors', emoji: '✂️', blurb: 'Best of 5', usesTurns: false,

  start(ctx) {
    M.my = M.opp = 0;
    build(ctx);
  },

  onMessage(msg, ctx) {
    if (msg.type !== 'pick') return;
    M.oppPick = msg.choice;
    if (M.myPick) resolve(ctx);
  },

  getState() { return { my: M.my, opp: M.opp }; },
  restore(state, ctx) { M.my = state.my; M.opp = state.opp; build(ctx); },
};

function build(ctx) {
    M.myPick = M.oppPick = null; M.btns = {};
    const wrap = ctx.el('div', 'max-w-sm mx-auto text-center');
    M.scoreEl = ctx.el('div', 'text-4xl font-black mb-1');
    wrap.appendChild(M.scoreEl);
    wrap.appendChild(ctx.el('p', 'text-xs text-slate-500 mb-4', `First to ${TARGET}`));
    M.resultEl = ctx.el('p', 'text-slate-300 h-6 mb-4', 'Pick your move…');
    wrap.appendChild(M.resultEl);
    const row = ctx.el('div', 'grid grid-cols-3 gap-3');
    for (const k of ['rock', 'paper', 'scissors']) {
      const b = ctx.el('button',
        'py-6 rounded-2xl bg-slate-800 border border-slate-700 hover:border-indigo-500 text-4xl disabled:opacity-40 transition',
        ICON[k]);
      b.onclick = () => {
        if (M.myPick) return;
        M.myPick = k;
        setEnabled(false);
        b.classList.add('ring-2', 'ring-indigo-500');
        ctx.send('pick', { choice: k });
        if (M.oppPick) resolve(ctx);
      };
      M.btns[k] = b;
      row.appendChild(b);
    }
    wrap.appendChild(row);
    ctx.root.appendChild(wrap);
    refreshScore();
}
