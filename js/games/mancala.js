import { mancalaSow, mancalaEnded, mancalaFinalize } from '../logic.js?v=12';

const M = { board: [], side: 0, pitEls: {}, storeEls: {} };
const myPits = () => (M.side === 0 ? [0, 1, 2, 3, 4, 5] : [7, 8, 9, 10, 11, 12]);
const oppPits = () => (M.side === 0 ? [12, 11, 10, 9, 8, 7] : [5, 4, 3, 2, 1, 0]);
const myStore = () => (M.side === 0 ? 6 : 13);
const oppStore = () => (M.side === 0 ? 13 : 6);

function paint(ctx) {
  for (let i = 0; i < 14; i++) if (M.pitEls[i]) M.pitEls[i].querySelector('b').textContent = M.board[i];
  M.storeEls.me.querySelector('b').textContent = M.board[myStore()];
  M.storeEls.opp.querySelector('b').textContent = M.board[oppStore()];
  for (const i of myPits()) {
    const active = ctx.myTurn && M.board[i] > 0;
    M.pitEls[i].className = pitCls(active, true);
  }
}
const pitCls = (active, mine) => 'rounded-full aspect-square flex items-center justify-center text-lg font-bold ' +
  (mine ? (active ? 'bg-emerald-600 hover:bg-emerald-500 cursor-pointer' : 'bg-emerald-900') : 'bg-amber-900');

function build(ctx) {
  M.pitEls = {}; M.storeEls = {};
  const wrap = ctx.el('div', 'mx-auto');
  wrap.style.maxWidth = 'min(96vw, 32rem)';
  const board = ctx.el('div', 'grid gap-2 items-center p-3 rounded-2xl bg-amber-950/60');
  board.style.gridTemplateColumns = 'repeat(8, 1fr)';
  const mkStore = (who) => { const s = ctx.el('div', 'row-span-2 rounded-2xl aspect-[1/2] flex items-center justify-center text-xl font-black ' + (who === 'me' ? 'bg-emerald-800' : 'bg-amber-800')); s.innerHTML = '<b></b>'; return s; };
  const mkPit = (i, mine) => { const p = ctx.el(mine ? 'button' : 'div', pitCls(false, mine)); p.innerHTML = '<b></b>'; if (mine) p.onclick = () => play(ctx, i); return p; };

  const storeOpp = mkStore('opp'); storeOpp.style.gridRow = '1 / span 2'; storeOpp.style.gridColumn = '1';
  board.appendChild(storeOpp); M.storeEls.opp = storeOpp;
  // top row: opp pits (cols 2..7)
  oppPits().forEach((i) => { const p = mkPit(i, false); M.pitEls[i] = p; board.appendChild(p); });
  const storeMe = mkStore('me'); storeMe.style.gridRow = '1 / span 2'; storeMe.style.gridColumn = '8';
  board.appendChild(storeMe); M.storeEls.me = storeMe;
  // bottom row: my pits (cols 2..7)
  myPits().forEach((i) => { const p = mkPit(i, true); M.pitEls[i] = p; board.appendChild(p); });

  wrap.appendChild(board);
  ctx.root.appendChild(wrap);
  paint(ctx);
}
function finish(ctx) {
  M.board = mancalaFinalize(M.board); paint(ctx);
  const me = M.board[myStore()], opp = M.board[oppStore()];
  ctx.endGame(me > opp ? 'win' : me < opp ? 'lose' : 'draw', `${me}–${opp}`);
}
function play(ctx, pit) {
  if (!ctx.myTurn || M.board[pit] === 0) return;
  const res = mancalaSow(M.board, pit);
  M.board = res.board;
  ctx.sound(res.captured ? 'capture' : 'drop'); paint(ctx);
  ctx.send('move', { pit });
  if (mancalaEnded(M.board)) return finish(ctx);
  if (res.extraTurn) ctx.setTurn(true); else ctx.setTurn(false);
}

export default {
  id: 'mancala', name: 'Mancala', emoji: '🕳️', blurb: 'Sow and capture',
  start(ctx, { iAmFirst }) {
    const b = Array(14).fill(4); b[6] = 0; b[13] = 0;
    M.board = b; M.side = iAmFirst ? 0 : 1;
    build(ctx);
  },
  onTurn(mine, ctx) { paint(ctx); },
  onMessage(msg, ctx) {
    if (msg.type !== 'move') return;
    const res = mancalaSow(M.board, msg.pit);
    M.board = res.board;
    ctx.sound(res.captured ? 'capture' : 'drop'); paint(ctx);
    if (mancalaEnded(M.board)) return finish(ctx);
    if (!res.extraTurn) ctx.setTurn(true);
  },
  getState() { return { board: M.board, side: M.side }; },
  restore(state, ctx) { M.board = state.board; M.side = state.side; build(ctx); },
};
