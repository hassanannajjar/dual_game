import { bgInitial, bgLegalMoves, bgApply, bgWon, bgBotMoves } from '../logic.js?v=32';

const PIPS = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
const M = { state: null, mine: 'w', opp: 'b', dice: [], sel: null, legalTo: [], ptEls: {}, els: {} };
const barCount = (c) => (c === 'w' ? M.state.bar.w : M.state.bar.b);

function checkerHTML(v) { // v signed: + white, - black
  if (!v) return '';
  const n = Math.abs(v), white = v > 0;
  const dots = Math.min(n, 5);
  let h = '';
  for (let i = 0; i < dots; i++) h += `<span class="w-3.5 h-3.5 rounded-full ${white ? 'bg-slate-100' : 'bg-slate-900 border border-slate-600'}"></span>`;
  return `<span class="flex flex-col items-center gap-0.5">${h}${n > 5 ? `<span class="text-[10px] text-slate-400">${n}</span>` : ''}</span>`;
}
function paint(ctx) {
  const legalSet = new Set(M.legalTo.map((o) => o.to));
  for (let p = 0; p < 24; p++) {
    const cell = M.ptEls[p];
    cell.innerHTML = checkerHTML(M.state.points[p]);
    const dark = p % 2 === 0;
    cell.className = 'flex flex-col items-center justify-start p-1 min-h-[4.5rem] rounded ' + (dark ? 'bg-amber-950/40' : 'bg-amber-900/30') +
      (M.sel === p ? ' ring-2 ring-emerald-400' : legalSet.has(p) ? ' ring-2 ring-emerald-400/50' : '');
  }
  M.els.bar.textContent = `Bar  ${barCount('w')}⚪ ${barCount('b')}⚫`;
  M.els.off.textContent = `Off  ${M.state.off.w}⚪ ${M.state.off.b}⚫`;
  M.els.off.className = 'px-3 py-1.5 rounded-lg text-sm ' + (legalSet.has('off') ? 'bg-emerald-600 cursor-pointer' : 'bg-slate-800');
  M.els.dice.textContent = M.dice.length ? M.dice.map((d) => PIPS[d]).join(' ') : '🎲';
  M.els.roll.disabled = !ctx.myTurn || M.dice.length > 0;
  M.els.msg.textContent = ctx.myTurn ? (M.dice.length ? (barCount(M.mine) ? 'Enter from the bar' : 'Move your checkers') : 'Roll the dice') : 'Opponent…';
}
function build(ctx) {
  M.ptEls = {}; M.els = {};
  const wrap = ctx.el('div', 'mx-auto space-y-2');
  wrap.style.maxWidth = 'min(96vw, 40rem)';
  wrap.appendChild(ctx.el('p', 'text-center text-slate-400 text-sm',
    ctx.t('you_are', { x: `<b>${M.mine === 'w' ? 'White' : 'Black'}</b>` })));
  const mkRow = (indices) => {
    const row = ctx.el('div', 'grid gap-1', '');
    row.style.gridTemplateColumns = 'repeat(12, 1fr)';
    for (const p of indices) { const c = ctx.el('button', ''); c.onclick = () => click(ctx, p); M.ptEls[p] = c; row.appendChild(c); }
    return row;
  };
  wrap.appendChild(mkRow([12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23]));
  wrap.appendChild(mkRow([11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0]));
  const bar = ctx.el('div', 'flex items-center justify-between gap-2 flex-wrap pt-1');
  M.els.bar = ctx.el('button', 'px-3 py-1.5 rounded-lg bg-slate-800 text-sm'); M.els.bar.onclick = () => selectBar(ctx);
  M.els.off = ctx.el('button', 'px-3 py-1.5 rounded-lg bg-slate-800 text-sm'); M.els.off.onclick = () => click(ctx, 'off');
  M.els.dice = ctx.el('div', 'text-3xl flex-1 text-center');
  M.els.roll = ctx.el('button', 'px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-semibold disabled:opacity-40', 'Roll');
  M.els.roll.onclick = () => roll(ctx);
  bar.append(M.els.bar, M.els.dice, M.els.off, M.els.roll);
  wrap.appendChild(bar);
  M.els.msg = ctx.el('p', 'text-center text-slate-400 text-sm');
  wrap.appendChild(M.els.msg);
  ctx.root.appendChild(wrap);
  paint(ctx);
}
function computeLegal(ctx, from) {
  M.sel = from; M.legalTo = [];
  const seen = new Set();
  for (const d of new Set(M.dice)) for (const m of bgLegalMoves(M.state, d, M.mine)) if (m.from === from && !seen.has(m.to)) { seen.add(m.to); M.legalTo.push({ to: m.to, die: d }); }
  paint(ctx);
}
function selectBar(ctx) { if (ctx.myTurn && M.dice.length && barCount(M.mine)) computeLegal(ctx, 'bar'); }
function anyMove() { return M.dice.some((d) => bgLegalMoves(M.state, d, M.mine).length > 0); }
function maybeEnd(ctx) {
  if (!M.dice.length || !anyMove()) { ctx.send('done', {}); M.dice = []; M.sel = null; M.legalTo = []; paint(ctx); ctx.setTurn(false); }
}
function roll(ctx) {
  if (!ctx.myTurn || M.dice.length) return;
  const a = 1 + Math.floor(Math.random() * 6), b = 1 + Math.floor(Math.random() * 6);
  M.dice = a === b ? [a, a, a, a] : [a, b];
  ctx.sound('drop'); ctx.send('roll', { dice: M.dice.slice() });
  if (barCount(M.mine)) selectBar(ctx); else paint(ctx);
  maybeEnd(ctx);
}
function doMove(ctx, from, to, die) {
  M.state = bgApply(M.state, from, to, M.mine); ctx.sound(to === 'off' ? 'capture' : 'place');
  M.dice.splice(M.dice.indexOf(die), 1);
  ctx.send('move', { from, to, die });
  M.sel = null; M.legalTo = []; paint(ctx);
  if (bgWon(M.state, M.mine)) { ctx.send('done', {}); return ctx.endGame('win'); }
  if (barCount(M.mine)) selectBar(ctx);
  maybeEnd(ctx);
}
function click(ctx, target) {
  if (!ctx.myTurn || !M.dice.length) return;
  if (barCount(M.mine) && M.sel !== 'bar') { selectBar(ctx); if (target === 'off') return; }
  if (M.sel != null) {
    const opt = M.legalTo.find((o) => o.to === target);
    if (opt) return doMove(ctx, M.sel, target, opt.die);
  }
  if (typeof target === 'number' && M.state.points[target] * (M.mine === 'w' ? 1 : -1) > 0) computeLegal(ctx, target);
}

export default {
  id: 'backgammon', name: 'Backgammon', emoji: '🎲', blurb: 'Bear off to win',
  start(ctx, { iAmFirst }) { M.state = bgInitial(); M.mine = iAmFirst ? 'w' : 'b'; M.opp = iAmFirst ? 'b' : 'w'; M.dice = []; M.sel = null; M.legalTo = []; build(ctx); },
  onTurn(mine, ctx) { M.sel = null; M.legalTo = []; if (!mine) M.dice = []; paint(ctx); },
  // Bot: roll, then play out all dice greedily (bgBotMoves), then done.
  botMove(level) {
    const a = 1 + Math.floor(Math.random() * 6), b = 1 + Math.floor(Math.random() * 6);
    const dice = a === b ? [a, a, a, a] : [a, b];
    const seq = [{ type: 'roll', dice }];
    for (const mv of bgBotMoves(M.state, M.opp, dice, level)) seq.push({ type: 'move', from: mv.from, to: mv.to, die: mv.die });
    seq.push({ type: 'done' });
    return seq;
  },
  onMessage(msg, ctx) {
    if (msg.type === 'roll') { M.els.dice.textContent = msg.dice.map((d) => PIPS[d]).join(' '); ctx.sound('drop'); }
    else if (msg.type === 'move') {
      M.state = bgApply(M.state, msg.from, msg.to, M.opp); ctx.sound(msg.to === 'off' ? 'capture' : 'place'); paint(ctx);
      if (bgWon(M.state, M.opp)) return ctx.endGame('lose');
    } else if (msg.type === 'done') { ctx.setTurn(true); }
  },
  getState() { return { state: M.state, mine: M.mine, opp: M.opp }; },
  restore(state, ctx) { M.state = state.state; M.mine = state.mine; M.opp = state.opp; M.dice = []; M.sel = null; M.legalTo = []; build(ctx); },
};
