import { quartoWinner } from '../logic.js?v=43';

// Pieces 0..15 = 4 attribute bits: 1 big, 2 round, 4 indigo, 8 hollow. You place the piece your
// opponent hands you, then hand them one. A line of 4 sharing ANY attribute wins.
const M = {};
const full = () => M.board.every((v) => v != null);
const availablePieces = () => { const used = new Set(M.board.filter((v) => v != null)); const a = []; for (let p = 0; p < 16; p++) if (!used.has(p)) a.push(p); return a; };

function pieceEl(ctx, p) {
  const big = p & 1, round = p & 2, indigo = p & 4, hollow = p & 8;
  const size = big ? 'w-8 h-8' : 'w-5 h-5';
  const shape = round ? 'rounded-full' : 'rounded';
  const col = indigo
    ? (hollow ? 'border-4 border-indigo-400' : 'bg-indigo-500')
    : (hollow ? 'border-4 border-amber-400' : 'bg-amber-500');
  return ctx.el('span', `inline-block ${size} ${shape} ${col}`);
}
function paint(ctx) {
  for (let i = 0; i < 16; i++) {
    const cell = M.cells[i]; cell.innerHTML = '';
    if (M.board[i] != null) cell.appendChild(pieceEl(ctx, M.board[i]));
    const canPlace = ctx.myTurn && M.phase === 'place' && M.handed != null && M.board[i] == null;
    cell.className = 'aspect-square rounded-lg flex items-center justify-center bg-slate-800 ' + (canPlace ? 'ring-1 ring-indigo-500 cursor-pointer hover:bg-slate-700' : '');
  }
  const h = M.handEl; h.innerHTML = '';
  if (ctx.myTurn && M.phase === 'place' && M.handed != null) { h.appendChild(ctx.el('span', 'text-sm text-slate-400 mr-2', 'Place this:')); h.appendChild(pieceEl(ctx, M.handed)); }
  else if (ctx.myTurn && M.phase === 'give') {
    h.appendChild(ctx.el('span', 'text-sm text-slate-400 w-full text-center block mb-1', 'Hand a piece to your opponent:'));
    const grid = ctx.el('div', 'flex flex-wrap justify-center gap-2');
    for (const p of availablePieces()) { const b = ctx.el('button', 'w-10 h-10 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center'); b.appendChild(pieceEl(ctx, p)); b.onclick = () => give(ctx, p); grid.appendChild(b); }
    h.appendChild(grid);
  } else h.appendChild(ctx.el('span', 'text-sm text-slate-500', 'Opponent’s move…'));
}
function build(ctx) {
  M.cells = [];
  const wrap = ctx.el('div', 'max-w-xs mx-auto space-y-3');
  const grid = ctx.el('div', 'grid grid-cols-4 gap-1.5 p-2 rounded-xl bg-slate-900');
  for (let i = 0; i < 16; i++) { const c = ctx.el('button', ''); c.onclick = () => place(ctx, i); M.cells.push(c); grid.appendChild(c); }
  wrap.appendChild(grid);
  M.handEl = ctx.el('div', 'flex flex-wrap items-center justify-center min-h-[3rem]'); wrap.appendChild(M.handEl);
  ctx.root.appendChild(wrap); paint(ctx);
}
function place(ctx, cell) {
  if (!ctx.myTurn || M.phase !== 'place' || M.handed == null || M.board[cell] != null) return;
  M.board[cell] = M.handed; M.handed = null; M.placedCell = cell; ctx.sound('place');
  if (quartoWinner(M.board)) { ctx.send('win', { cell }); return ctx.endGame('win', 'Quarto!'); }
  if (full()) { ctx.send('full', { cell }); return ctx.endGame('draw'); }
  M.phase = 'give'; paint(ctx);
}
function give(ctx, piece) {
  if (M.phase !== 'give') return;
  M.iHanded = piece; ctx.sound('select');
  ctx.send('move', { cell: M.placedCell, give: piece });
  M.phase = 'wait'; ctx.setTurn(false); paint(ctx);
}

export default {
  id: 'quarto', name: 'Quarto', emoji: '🔷', blurb: 'Share the pieces',
  start(ctx, { iAmFirst }) {
    M.board = Array(16).fill(null); M.handed = null; M.iHanded = null; M.placedCell = null;
    M.phase = iAmFirst ? 'give' : 'wait';       // first player opens by handing a piece
    build(ctx);
  },
  onTurn(mine, ctx) { paint(ctx); },
  botOpen(send) {                               // bot is first: hand a piece from the empty board
    send({ type: 'give', give: Math.floor(Math.random() * 16) });
  },
  botOnGame(msg, send, level) {
    if (msg.type !== 'give' && msg.type !== 'move') return;
    const g = msg.give;                          // the piece the bot must place
    const B = M.board.slice();
    const empties = []; for (let i = 0; i < 16; i++) if (B[i] == null) empties.push(i);
    if (!empties.length) return;
    let cell = -1;
    for (const c of empties) { const t = B.slice(); t[c] = g; if (quartoWinner(t)) { cell = c; break; } }
    if (cell >= 0) { send({ type: 'win', cell }); return; }     // bot completes a line
    cell = empties[Math.floor(Math.random() * empties.length)];
    B[cell] = g;
    if (B.every((v) => v != null)) { send({ type: 'full', cell }); return; }   // draw
    const used = new Set(B.filter((v) => v != null));
    const avail = []; for (let p = 0; p < 16; p++) if (!used.has(p)) avail.push(p);
    const emptiesAfter = []; for (let i = 0; i < 16; i++) if (B[i] == null) emptiesAfter.push(i);
    const safe = avail.filter((p) => !emptiesAfter.some((c) => { const t = B.slice(); t[c] = p; return quartoWinner(t); }));
    const pool = (level !== 'easy' && safe.length) ? safe : avail;
    send({ type: 'move', cell, give: pool[Math.floor(Math.random() * pool.length)] });
  },
  onMessage(msg, ctx) {
    if (msg.type === 'give') { M.handed = msg.give; M.phase = 'place'; ctx.setTurn(true); paint(ctx); return; }
    if (msg.type === 'win') { M.board[msg.cell] = M.iHanded; paint(ctx); return ctx.endGame('lose', 'Quarto!'); }
    if (msg.type === 'full') { M.board[msg.cell] = M.iHanded; paint(ctx); return ctx.endGame('draw'); }
    if (msg.type === 'move') {
      M.board[msg.cell] = M.iHanded; ctx.sound('place');       // opponent placed the piece I handed them
      if (quartoWinner(M.board)) { paint(ctx); return ctx.endGame('lose', 'Quarto!'); }
      if (full()) { paint(ctx); return ctx.endGame('draw'); }
      M.handed = msg.give; M.phase = 'place'; ctx.setTurn(true); paint(ctx);
    }
  },
  getState() { return { board: M.board, handed: M.handed, iHanded: M.iHanded, phase: M.phase, placedCell: M.placedCell }; },
  restore(s, ctx) { M.board = s.board; M.handed = s.handed; M.iHanded = s.iHanded; M.phase = s.phase; M.placedCell = s.placedCell; build(ctx); },
};
