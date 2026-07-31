import { yahtzeeScore, YAHTZEE_CATS } from '../logic.js?v=5';

const PIPS = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
const LABEL = { ones: '1s', twos: '2s', threes: '3s', fours: '4s', fives: '5s', sixes: '6s',
  threeKind: '3 of a kind', fourKind: '4 of a kind', fullHouse: 'Full house', smallStraight: 'Sm straight',
  largeStraight: 'Lg straight', yahtzee: 'Yahtzee', chance: 'Chance' };
const M = { my: {}, opp: {}, dice: [0, 0, 0, 0, 0], holds: [false, false, false, false, false], rolls: 3, oppDice: [0, 0, 0, 0, 0], diceEls: [], rows: {}, rollBtn: null };

const allFilled = (card) => YAHTZEE_CATS.every((c) => card[c] !== undefined);
function total(card) {
  let sum = 0, upper = 0;
  for (const c of YAHTZEE_CATS) { const v = card[c] || 0; sum += v; if (['ones', 'twos', 'threes', 'fours', 'fives', 'sixes'].includes(c)) upper += v; }
  return sum + (upper >= 63 ? 35 : 0);
}
function rolled() { return M.rolls < 3; }
function paint(ctx) {
  for (let i = 0; i < 5; i++) {
    const d = M.diceEls[i];
    d.textContent = M.dice[i] ? PIPS[M.dice[i]] : '·';
    d.className = 'text-4xl w-12 h-12 rounded-lg flex items-center justify-center ' + (M.holds[i] ? 'bg-indigo-700 ring-2 ring-indigo-400' : 'bg-slate-800');
  }
  M.rollBtn.disabled = !ctx.myTurn || M.rolls <= 0;
  M.rollBtn.textContent = `Roll (${M.rolls})`;
  for (const c of YAHTZEE_CATS) {
    const { mine, opp } = M.rows[c];
    const mv = M.my[c];
    if (mv !== undefined) { mine.textContent = mv; mine.className = 'text-right w-12 text-emerald-400 font-semibold'; }
    else if (ctx.myTurn && rolled()) { mine.textContent = yahtzeeScore(c, M.dice); mine.className = 'text-right w-12 text-indigo-300 cursor-pointer underline'; }
    else { mine.textContent = '·'; mine.className = 'text-right w-12 text-slate-600'; }
    opp.textContent = M.opp[c] !== undefined ? M.opp[c] : '·';
    opp.className = 'text-right w-12 ' + (M.opp[c] !== undefined ? 'text-amber-400' : 'text-slate-600');
  }
  M.totalMine.textContent = total(M.my);
  M.totalOpp.textContent = total(M.opp);
}
function build(ctx) {
  M.diceEls = []; M.rows = {};
  const wrap = ctx.el('div', 'max-w-sm mx-auto space-y-3');
  const dr = ctx.el('div', 'flex justify-center gap-2');
  for (let i = 0; i < 5; i++) { const d = ctx.el('button', ''); d.onclick = () => { if (rolled() && ctx.myTurn && M.dice[i]) { M.holds[i] = !M.holds[i]; paint(ctx); } }; M.diceEls.push(d); dr.appendChild(d); }
  wrap.appendChild(dr);
  M.rollBtn = ctx.el('button', 'w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-semibold disabled:opacity-40', 'Roll (3)');
  M.rollBtn.onclick = () => roll(ctx);
  wrap.appendChild(M.rollBtn);
  const table = ctx.el('div', 'rounded-xl bg-slate-900 divide-y divide-slate-800 text-sm');
  const head = ctx.el('div', 'flex items-center px-3 py-1.5 text-slate-400 font-semibold');
  head.innerHTML = '<span class="flex-1">Category</span><span class="w-12 text-right">You</span><span class="w-12 text-right">Opp</span>';
  table.appendChild(head);
  for (const c of YAHTZEE_CATS) {
    const row = ctx.el('div', 'flex items-center px-3 py-1.5 gap-2');
    const label = ctx.el('span', 'flex-1', LABEL[c]);
    const mine = ctx.el('span', 'text-right w-12'); const opp = ctx.el('span', 'text-right w-12');
    mine.onclick = () => assign(ctx, c);
    row.append(label, mine, opp); table.appendChild(row);
    M.rows[c] = { mine, opp };
  }
  const foot = ctx.el('div', 'flex items-center px-3 py-1.5 font-bold');
  M.totalMine = ctx.el('span', 'text-right w-12 text-emerald-400'); M.totalOpp = ctx.el('span', 'text-right w-12 text-amber-400');
  foot.append(ctx.el('span', 'flex-1', 'Total'), M.totalMine, M.totalOpp);
  table.appendChild(foot);
  wrap.appendChild(table);
  ctx.root.appendChild(wrap);
  paint(ctx);
}
function roll(ctx) {
  if (!ctx.myTurn || M.rolls <= 0) return;
  M.dice = M.dice.map((d, i) => (M.holds[i] && d) ? d : 1 + Math.floor(Math.random() * 6));
  M.rolls--; ctx.sound('drop'); ctx.send('dice', { dice: M.dice });
  paint(ctx);
}
function assign(ctx, cat) {
  if (!ctx.myTurn || !rolled() || M.my[cat] !== undefined) return;
  const val = yahtzeeScore(cat, M.dice);
  M.my[cat] = val; ctx.sound('capture'); ctx.send('score', { cat, val });
  M.dice = [0, 0, 0, 0, 0]; M.holds = [false, false, false, false, false]; M.rolls = 3;
  paint(ctx);
  if (allFilled(M.my) && allFilled(M.opp)) return finish(ctx);
  ctx.setTurn(false);
}
function finish(ctx) { const a = total(M.my), b = total(M.opp); ctx.endGame(a > b ? 'win' : a < b ? 'lose' : 'draw', `${a}–${b}`); }

export default {
  id: 'yahtzee', name: 'Yahtzee', emoji: '🎰', blurb: 'Roll for the best hand', category: 'luck', difficulty: 'medium',
  start(ctx) { M.my = {}; M.opp = {}; M.dice = [0, 0, 0, 0, 0]; M.holds = [false, false, false, false, false]; M.rolls = 3; build(ctx); },
  onTurn(mine, ctx) { if (mine) { M.dice = [0, 0, 0, 0, 0]; M.holds = [false, false, false, false, false]; M.rolls = 3; } paint(ctx); },
  onMessage(msg, ctx) {
    if (msg.type === 'dice') { M.oppDice = msg.dice; }
    else if (msg.type === 'score') {
      M.opp[msg.cat] = msg.val; ctx.sound('capture'); paint(ctx);
      if (allFilled(M.my) && allFilled(M.opp)) return finish(ctx);
      ctx.setTurn(true);
    }
  },
  getState() { return { my: M.my, opp: M.opp }; },
  restore(state, ctx) { M.my = state.my; M.opp = state.opp; M.dice = [0, 0, 0, 0, 0]; M.holds = [false, false, false, false, false]; M.rolls = 3; build(ctx); },
};
