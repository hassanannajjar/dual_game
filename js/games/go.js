import { goPlace, goScore } from '../logic.js?v=5';

const N = 9;
const M = { board: [], mine: 'b', opp: 'w', forbidden: null, passes: 0, cells: [], msgEl: null };
const empty = () => Array.from({ length: N }, () => Array(N).fill(null));
const ser = (b) => b.map((r) => r.map((c) => c || '.').join('')).join('');

function paint(ctx) {
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const v = M.board[y][x];
    M.cells[y][x].firstChild.className = 'w-[80%] h-[80%] rounded-full ' +
      (v === 'b' ? 'bg-slate-950 border border-slate-500' : v === 'w' ? 'bg-slate-100 border border-slate-400' : 'bg-transparent');
  }
  if (M.msgEl) M.msgEl.textContent = ctx.myTurn ? (M.mine === 'b' ? 'You are Black' : 'You are White') : 'Opponent thinking…';
}
function build(ctx) {
  M.cells = [];
  const wrap = ctx.el('div', 'mx-auto');
  wrap.style.maxWidth = 'min(94vw, 28rem)';
  const grid = ctx.el('div', 'grid gap-0 bg-amber-700 p-2 rounded-lg');
  grid.style.gridTemplateColumns = `repeat(${N}, 1fr)`;
  for (let y = 0; y < N; y++) {
    M.cells[y] = [];
    for (let x = 0; x < N; x++) {
      const cell = ctx.el('button', 'aspect-square flex items-center justify-center relative');
      cell.style.boxShadow = 'inset 0 0 0 0.5px rgba(0,0,0,0.4)';
      cell.appendChild(ctx.el('i', 'bg-transparent'));
      cell.onclick = () => play(ctx, x, y);
      M.cells[y][x] = cell;
      grid.appendChild(cell);
    }
  }
  wrap.appendChild(grid);
  const bar = ctx.el('div', 'flex items-center justify-between mt-3');
  M.msgEl = ctx.el('p', 'text-slate-400 text-sm');
  const pass = ctx.el('button', 'px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 font-semibold', 'Pass');
  pass.onclick = () => doPass(ctx);
  bar.append(M.msgEl, pass);
  wrap.appendChild(bar);
  ctx.root.appendChild(wrap);
  paint(ctx);
}
function finish(ctx) {
  const s = goScore(M.board); s.w += 0.5; // komi breaks ties
  const my = M.mine === 'b' ? s.b : s.w, op = M.mine === 'b' ? s.w : s.b;
  ctx.endGame(my > op ? 'win' : 'lose', `${my}–${op}`);
}
function play(ctx, x, y) {
  if (!ctx.myTurn) return;
  const prev = ser(M.board);
  const res = goPlace(M.board, x, y, M.mine);
  if (!res) { ctx.sound('error'); return; }
  if (ser(res.board) === M.forbidden) { ctx.sound('error'); ctx.toast('Ko'); return; }
  M.board = res.board; M.passes = 0;
  M.forbidden = res.captured === 1 ? prev : null;   // opponent may not recreate the pre-move position
  ctx.sound(res.captured ? 'capture' : 'place'); paint(ctx);
  ctx.send('move', { x, y });
  ctx.setTurn(false);
}
function doPass(ctx) {
  if (!ctx.myTurn) return;
  ctx.sound('click'); ctx.send('pass', {}); M.passes++;
  if (M.passes >= 2) return finish(ctx);
  M.forbidden = null; ctx.setTurn(false);
}

export default {
  id: 'go', name: 'Go', emoji: '⚫', blurb: 'Surround territory', category: 'strategy', difficulty: 'hard',
  start(ctx, { iAmFirst }) {
    M.board = empty(); M.mine = iAmFirst ? 'b' : 'w'; M.opp = iAmFirst ? 'w' : 'b';
    M.forbidden = null; M.passes = 0;
    build(ctx);
  },
  onTurn(mine, ctx) { paint(ctx); },
  onMessage(msg, ctx) {
    if (msg.type === 'pass') { M.passes++; if (M.passes >= 2) return finish(ctx); M.forbidden = null; ctx.setTurn(true); return; }
    if (msg.type !== 'move') return;
    const prev = ser(M.board);
    const res = goPlace(M.board, msg.x, msg.y, M.opp);
    if (!res) return;
    M.board = res.board; M.passes = 0;
    M.forbidden = res.captured === 1 ? prev : null;
    ctx.sound(res.captured ? 'capture' : 'place'); paint(ctx);
    ctx.setTurn(true);
  },
  getState() { return { board: M.board, mine: M.mine, opp: M.opp, forbidden: M.forbidden, passes: M.passes }; },
  restore(state, ctx) { M.board = state.board; M.mine = state.mine; M.opp = state.opp; M.forbidden = state.forbidden; M.passes = state.passes; build(ctx); },
};
