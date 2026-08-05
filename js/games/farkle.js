import { farkleScore } from '../logic.js?v=34';

// Press-your-luck dice. Roll, auto-keep all scoring dice, then Bank or roll on. A roll with
// no scoring dice = Farkle (lose the turn's points). First to TARGET wins.
// ponytail: auto-keeps every scoring die (no manual set-aside) — simpler; full selection later.
const TARGET = 4000;
const PIPS = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
const M = {};

function paint(ctx) {
  M.diceEl.innerHTML = '';
  for (const d of (M.dice || [])) M.diceEl.appendChild(ctx.el('span', 'text-4xl', PIPS[d]));
  M.scoreEl.innerHTML = `<span class="text-emerald-400">${M.my}</span> — <span class="text-amber-400">${M.opp}</span>`;
  M.turnEl.textContent = ctx.myTurn ? `Turn: ${M.turnScore}  ·  ${M.diceLeft} dice` : (M.oppTurn ? `Opponent turn: ${M.oppTurn}` : '');
  M.rollBtn.disabled = !ctx.myTurn;
  M.bankBtn.disabled = !ctx.myTurn || M.turnScore === 0;
}
function build(ctx) {
  const wrap = ctx.el('div', 'max-w-xs mx-auto text-center space-y-4 py-2');
  wrap.appendChild(ctx.el('p', 'text-xs text-slate-500', `First to ${TARGET}`));
  M.scoreEl = ctx.el('div', 'text-3xl font-black'); wrap.appendChild(M.scoreEl);
  M.diceEl = ctx.el('div', 'flex flex-wrap justify-center gap-1 min-h-[3rem] items-center'); wrap.appendChild(M.diceEl);
  M.turnEl = ctx.el('p', 'text-slate-300 h-6'); wrap.appendChild(M.turnEl);
  const row = ctx.el('div', 'grid grid-cols-2 gap-3');
  M.rollBtn = ctx.el('button', 'py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-semibold disabled:opacity-40', 'Roll');
  M.bankBtn = ctx.el('button', 'py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-semibold disabled:opacity-40', 'Bank');
  M.rollBtn.onclick = () => roll(ctx); M.bankBtn.onclick = () => bank(ctx);
  row.append(M.rollBtn, M.bankBtn); wrap.appendChild(row);
  ctx.root.appendChild(wrap); paint(ctx);
}
function roll(ctx) {
  if (!ctx.myTurn) return;
  const dice = Array.from({ length: M.diceLeft }, () => 1 + Math.floor(Math.random() * 6));
  M.dice = dice;
  const fs = farkleScore(dice);
  if (fs.score === 0) {                                  // Farkle
    M.turnScore = 0; ctx.sound('error'); ctx.haptic(60);
    ctx.send('turn', { my: M.my, turnScore: 0, dice, done: true }); paint(ctx); ctx.setTurn(false); return;
  }
  M.turnScore += fs.score; M.diceLeft -= fs.scoring.length; if (M.diceLeft === 0) M.diceLeft = 6;   // hot dice
  ctx.sound('drop');
  ctx.send('turn', { my: M.my, turnScore: M.turnScore, diceLeft: M.diceLeft, dice }); paint(ctx);
}
function bank(ctx) {
  if (!ctx.myTurn || M.turnScore === 0) return;
  M.my += M.turnScore; ctx.sound('capture');
  ctx.send('bank', { my: M.my }); M.turnScore = 0; M.diceLeft = 6; paint(ctx);
  if (M.my >= TARGET) return ctx.endGame('win', `${M.my}`);
  ctx.setTurn(false);
}

export default {
  id: 'farkle', name: 'Farkle', emoji: '🎲', blurb: 'Press your luck',
  start(ctx) { M.my = 0; M.opp = 0; M.turnScore = 0; M.oppTurn = 0; M.diceLeft = 6; M.dice = []; build(ctx); },
  onTurn(mine, ctx) { if (mine) { M.turnScore = 0; M.diceLeft = 6; } else M.oppTurn = 0; paint(ctx); },
  // Bot plays its whole turn (its own dice): roll, keep scoring, bank past a threshold or when farkling.
  botMove(level) {
    const bankAt = level === 'easy' ? 300 : 550;
    let turn = 0, left = 6; const seq = []; let guard = 0;
    while (guard++ < 20) {
      const dice = Array.from({ length: left }, () => 1 + Math.floor(Math.random() * 6));
      const fs = farkleScore(dice);
      if (fs.score === 0) { seq.push({ type: 'turn', my: M.opp, turnScore: 0, dice, done: true }); return seq; }
      turn += fs.score; left -= fs.scoring.length; if (left === 0) left = 6;
      seq.push({ type: 'turn', my: M.opp, turnScore: turn, diceLeft: left, dice });
      if (M.opp + turn >= TARGET) { seq.push({ type: 'bank', my: M.opp + turn }); return seq; }
      const behind = M.my - (M.opp + turn);
      if (turn >= bankAt && !(level === 'hard' && behind > 800 && turn < 900)) { seq.push({ type: 'bank', my: M.opp + turn }); return seq; }
    }
    seq.push({ type: 'bank', my: M.opp + turn }); return seq;
  },
  onMessage(msg, ctx) {
    if (msg.type === 'turn') {
      M.opp = msg.my; M.oppTurn = msg.turnScore; M.dice = msg.dice || []; ctx.sound(msg.done ? 'error' : 'drop'); paint(ctx);
      if (msg.done) ctx.setTurn(true);
    } else if (msg.type === 'bank') {
      M.opp = msg.my; M.oppTurn = 0; ctx.sound('capture'); paint(ctx);
      if (M.opp >= TARGET) return ctx.endGame('lose', `${M.opp}`);
      ctx.setTurn(true);
    }
  },
  getState() { return { my: M.my, opp: M.opp }; },
  restore(s, ctx) { M.my = s.my; M.opp = s.opp; M.turnScore = 0; M.oppTurn = 0; M.diceLeft = 6; M.dice = []; build(ctx); },
};
