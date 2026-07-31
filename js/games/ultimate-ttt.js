import { ticTacToeWinner, ultimateWinner } from '../logic.js?v=4';

const M = { boards: [], small: [], active: -1, mine: 'X', opp: 'O', cellEls: [], boardEls: [] };
const boardFull = (i) => M.boards[i].every(Boolean);
const allDecided = () => M.small.every(Boolean);

function paint(ctx) {
  for (let b = 0; b < 9; b++) {
    const won = M.small[b];
    const activeHere = ctx.myTurn && !won && (M.active === -1 || M.active === b);
    M.boardEls[b].className = 'relative grid grid-cols-3 gap-0.5 p-0.5 rounded ' +
      (won ? 'opacity-60 ' : '') + (activeHere ? 'bg-indigo-500/30 ring-1 ring-indigo-400' : 'bg-slate-800');
    for (let c = 0; c < 9; c++) {
      const v = M.boards[b][c];
      const cell = M.cellEls[b][c];
      cell.textContent = v || '';
      cell.className = 'aspect-square rounded-sm bg-slate-900 flex items-center justify-center text-sm font-black ' +
        (v === 'X' ? 'text-indigo-400' : v === 'O' ? 'text-amber-400' : 'text-transparent');
    }
    let ov = M.boardEls[b].querySelector('.ov');
    if (won && won !== 'draw') {
      if (!ov) { ov = ctx.el('div', 'ov absolute inset-0 flex items-center justify-center text-4xl font-black pointer-events-none'); M.boardEls[b].appendChild(ov); }
      ov.textContent = won; ov.classList.toggle('text-indigo-400', won === 'X'); ov.classList.toggle('text-amber-400', won === 'O');
    } else if (ov) ov.remove();
  }
}
function build(ctx) {
  M.cellEls = []; M.boardEls = [];
  const wrap = ctx.el('div', 'mx-auto');
  wrap.style.maxWidth = 'min(94vw, 30rem)';
  wrap.appendChild(ctx.el('p', 'text-center text-slate-400 text-sm mb-2',
    ctx.t('you_are', { x: `<b class="${M.mine === 'X' ? 'text-indigo-400' : 'text-amber-400'}">${M.mine}</b>` })));
  const outer = ctx.el('div', 'grid grid-cols-3 gap-1.5 p-1.5 rounded-lg bg-slate-700');
  for (let b = 0; b < 9; b++) {
    const bd = ctx.el('div', '');
    M.cellEls[b] = [];
    for (let c = 0; c < 9; c++) {
      const cell = ctx.el('button', '');
      cell.onclick = () => play(ctx, b, c);
      M.cellEls[b][c] = cell;
      bd.appendChild(cell);
    }
    M.boardEls[b] = bd;
    outer.appendChild(bd);
  }
  wrap.appendChild(outer);
  ctx.root.appendChild(wrap);
  paint(ctx);
}
function applyMove(b, c, who) {
  M.boards[b][c] = who;
  const w = ticTacToeWinner(M.boards[b]);
  if (w) M.small[b] = w;
  M.active = (M.small[c] || boardFull(c)) ? -1 : c;
}
function play(ctx, b, c) {
  if (!ctx.myTurn || M.small[b] || M.boards[b][c]) return;
  if (M.active !== -1 && M.active !== b) return;
  applyMove(b, c, M.mine); ctx.sound('place'); paint(ctx);
  ctx.send('move', { b, c });
  if (ultimateWinner(M.small) === M.mine) return ctx.endGame('win');
  if (allDecided()) return ctx.endGame('draw');
  ctx.setTurn(false);
}

export default {
  id: 'uttt', name: 'Ultimate Tic-Tac-Toe', emoji: '#️⃣', blurb: '9 boards in one',
  start(ctx, { iAmFirst }) {
    M.boards = Array.from({ length: 9 }, () => Array(9).fill(null));
    M.small = Array(9).fill(null); M.active = -1;
    M.mine = iAmFirst ? 'X' : 'O'; M.opp = iAmFirst ? 'O' : 'X';
    build(ctx);
  },
  onTurn(mine, ctx) { paint(ctx); },
  onMessage(msg, ctx) {
    if (msg.type !== 'move') return;
    applyMove(msg.b, msg.c, M.opp); ctx.sound('place'); paint(ctx);
    if (ultimateWinner(M.small) === M.opp) return ctx.endGame('lose');
    if (allDecided()) return ctx.endGame('draw');
    ctx.setTurn(true);
  },
  getState() { return { boards: M.boards, small: M.small, active: M.active, mine: M.mine, opp: M.opp }; },
  restore(state, ctx) { M.boards = state.boards; M.small = state.small; M.active = state.active; M.mine = state.mine; M.opp = state.opp; build(ctx); },
};
