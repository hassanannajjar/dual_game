import { SNL_MAP } from '../logic.js?v=2';

const PIPS = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
const M = { me: 0, opp: 0, cells: [], dieEl: null, rollBtn: null, msgEl: null };

// square number (1..100) -> [col,row] on a 10x10 boustrophedon grid, row 0 at top.
function coord(sq) {
  const n = sq - 1;
  const row = 9 - Math.floor(n / 10);
  let col = n % 10;
  if (Math.floor(n / 10) % 2 === 1) col = 9 - col;
  return [col, row];
}
function move(pos, v) {
  let np = pos + v;
  if (np > 100) return pos;             // must land exactly, else stay
  if (SNL_MAP[np] != null) np = SNL_MAP[np];
  return np;
}
function paint(ctx) {
  for (let sq = 1; sq <= 100; sq++) {
    const c = M.cells[sq];
    const tokens = (M.me === sq ? '<span class="text-emerald-400">●</span>' : '') + (M.opp === sq ? '<span class="text-amber-400">●</span>' : '');
    c.querySelector('.tok').innerHTML = tokens;
  }
  M.rollBtn.disabled = !ctx.myTurn;
  M.msgEl.textContent = ctx.myTurn ? 'Your roll' : "Opponent's roll";
}
function build(ctx) {
  M.cells = [];
  const wrap = ctx.el('div', 'mx-auto');
  wrap.style.maxWidth = 'min(94vw, 30rem)';
  const grid = ctx.el('div', 'grid gap-px bg-slate-700 rounded-lg overflow-hidden');
  grid.style.gridTemplateColumns = 'repeat(10, 1fr)';
  // build in display order (row 0 top .. row 9 bottom), find which square maps here
  const at = {};
  for (let sq = 1; sq <= 100; sq++) { const [x, y] = coord(sq); at[y * 10 + x] = sq; }
  for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) {
    const sq = at[y * 10 + x];
    const cell = ctx.el('div', 'aspect-square bg-slate-900 relative text-[8px] text-slate-600 flex items-start justify-start p-0.5');
    cell.innerHTML = `<span>${sq}</span><span class="tok absolute inset-0 flex items-center justify-center text-base"></span>`;
    if (SNL_MAP[sq] != null) cell.classList.add(SNL_MAP[sq] > sq ? 'bg-emerald-900/60' : 'bg-rose-900/60');
    M.cells[sq] = cell;
    grid.appendChild(cell);
  }
  wrap.appendChild(grid);
  const bar = ctx.el('div', 'flex items-center justify-center gap-4 mt-3');
  M.dieEl = ctx.el('div', 'text-5xl', '🎲');
  M.rollBtn = ctx.el('button', 'px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-semibold disabled:opacity-40', 'Roll');
  M.rollBtn.onclick = () => roll(ctx);
  bar.append(M.dieEl, M.rollBtn);
  wrap.appendChild(bar);
  M.msgEl = ctx.el('p', 'text-center text-slate-400 text-sm mt-1');
  wrap.appendChild(M.msgEl);
  ctx.root.appendChild(wrap);
  paint(ctx);
}
function roll(ctx) {
  if (!ctx.myTurn) return;
  const v = 1 + Math.floor(Math.random() * 6);
  M.dieEl.textContent = PIPS[v]; ctx.send('roll', { v });
  M.me = move(M.me, v); ctx.sound(SNL_MAP[M.me] != null ? 'flip' : 'drop'); paint(ctx);
  if (M.me === 100) return ctx.endGame('win');
  ctx.setTurn(false);
}

export default {
  id: 'snakes', name: 'Snakes & Ladders', emoji: '🐍', blurb: 'Climb and slide', category: 'luck', difficulty: 'easy',
  start(ctx) { M.me = 0; M.opp = 0; build(ctx); },
  onTurn(mine, ctx) { paint(ctx); },
  onMessage(msg, ctx) {
    if (msg.type !== 'roll') return;
    M.dieEl.textContent = PIPS[msg.v];
    M.opp = move(M.opp, msg.v); ctx.sound(SNL_MAP[M.opp] != null ? 'flip' : 'drop'); paint(ctx);
    if (M.opp === 100) return ctx.endGame('lose');
    ctx.setTurn(true);
  },
  getState() { return { me: M.me, opp: M.opp }; },
  restore(state, ctx) { M.me = state.me; M.opp = state.opp; build(ctx); },
};
