import { nimEmpty, nimBestMove } from '../logic.js?v=31';

const M = { rows: [], rowEls: [] };
function paint(ctx) {
  for (let r = 0; r < M.rows.length; r++) {
    const el = M.rowEls[r];
    el.innerHTML = '';
    for (let i = 0; i < M.rows[r]; i++) {
      const s = ctx.el('button', 'w-3 h-10 rounded bg-indigo-400 hover:bg-rose-400 transition');
      const take = M.rows[r] - i; // tapping stick i leaves i sticks (takes the rest)
      s.onclick = () => play(ctx, r, i);
      el.appendChild(s);
      s.title = String(take);
    }
    if (M.rows[r] === 0) el.appendChild(ctx.el('span', 'text-slate-600 text-sm', '—'));
  }
}
function build(ctx) {
  M.rowEls = [];
  const wrap = ctx.el('div', 'max-w-sm mx-auto space-y-4 py-4');
  wrap.appendChild(ctx.el('p', 'text-center text-slate-400 text-sm', 'Tap a stick — you take it and all to its right. Take the last stick and you lose.'));
  for (let r = 0; r < M.rows.length; r++) {
    const row = ctx.el('div', 'flex items-center justify-center gap-1.5 h-10');
    M.rowEls[r] = row;
    wrap.appendChild(row);
  }
  ctx.root.appendChild(wrap);
  paint(ctx);
}
function play(ctx, r, keep) {
  if (!ctx.myTurn || keep >= M.rows[r]) return;
  M.rows[r] = keep; ctx.sound('place'); paint(ctx);
  ctx.send('move', { r, keep });
  if (nimEmpty(M.rows)) return ctx.endGame('lose');
  ctx.setTurn(false);
}

export default {
  id: 'nim', name: 'Nim', emoji: '🪵', blurb: "Don't take the last", category: 'strategy', difficulty: 'easy',
  start(ctx) { M.rows = [1, 3, 5, 7]; build(ctx); },
  onTurn(mine, ctx) { paint(ctx); },
  onMessage(msg, ctx) {
    if (msg.type !== 'move') return;
    M.rows[msg.r] = msg.keep; ctx.sound('place'); paint(ctx);
    if (nimEmpty(M.rows)) return ctx.endGame('win');
    ctx.setTurn(true);
  },
  botMove(level) {
    if (nimEmpty(M.rows)) return null;
    if (level === 'easy') {
      const rs = M.rows.map((n, i) => (n ? i : -1)).filter((i) => i >= 0);
      const r = rs[Math.floor(Math.random() * rs.length)];
      return { type: 'move', r, keep: Math.floor(Math.random() * M.rows[r]) };
    }
    const m = nimBestMove(M.rows);
    return { type: 'move', r: m.row, keep: m.keep };
  },
  getState() { return { rows: M.rows }; },
  restore(state, ctx) { M.rows = state.rows; build(ctx); },
};
