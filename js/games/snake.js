const N = 17, TICK = 140;
const M = { body: [], dir: [1, 0], next: [1, 0], food: null, loop: null, score: 0, cells: [], keyHandler: null, scoreEl: null, dead: false };
const key = (x, y) => y * N + x;
const opp = ([a, b], [c, d]) => a === -c && b === -d;

function placeFood() { const occ = new Set(M.body.map(([x, y]) => key(x, y))); let f; do { f = [Math.floor(Math.random() * N), Math.floor(Math.random() * N)]; } while (occ.has(key(f[0], f[1]))); M.food = f; }
function paint() {
  const set = new Set(M.body.map(([x, y]) => key(x, y)));
  const head = key(M.body[0][0], M.body[0][1]);
  for (let i = 0; i < N * N; i++) {
    let cls = 'bg-slate-800';
    if (i === key(M.food[0], M.food[1])) cls = 'bg-rose-500';
    else if (i === head) cls = 'bg-emerald-300';
    else if (set.has(i)) cls = 'bg-emerald-500';
    M.cells[i].className = 'aspect-square rounded-[2px] ' + cls;
  }
  if (M.scoreEl) M.scoreEl.textContent = 'Score: ' + M.score;
}
function tick(ctx) {
  if (M.dead) return;
  M.dir = M.next;
  const [hx, hy] = M.body[0], nx = hx + M.dir[0], ny = hy + M.dir[1];
  if (nx < 0 || nx >= N || ny < 0 || ny >= N || M.body.some(([x, y]) => x === nx && y === ny)) { M.dead = true; ctx.sound('lose'); ctx.haptic(80); return ctx.endGame('lose', 'Score ' + M.score); }
  M.body.unshift([nx, ny]);
  if (nx === M.food[0] && ny === M.food[1]) { M.score++; ctx.sound('capture'); placeFood(); } else M.body.pop();
  paint();
}
function setDir(d) { if (!opp(d, M.dir)) M.next = d; }
function build(ctx) {
  M.cells = [];
  const wrap = ctx.el('div', 'mx-auto space-y-3'); wrap.style.maxWidth = 'min(92vw, 26rem)';
  M.scoreEl = ctx.el('p', 'text-center text-slate-300 font-semibold'); wrap.appendChild(M.scoreEl);
  const grid = ctx.el('div', 'grid gap-px bg-slate-950 p-1 rounded-lg'); grid.style.gridTemplateColumns = `repeat(${N}, 1fr)`;
  for (let i = 0; i < N * N; i++) { const c = ctx.el('div', 'aspect-square rounded-[2px] bg-slate-800'); M.cells[i] = c; grid.appendChild(c); }
  wrap.appendChild(grid);
  const pad = ctx.el('div', 'grid grid-cols-3 gap-2 w-40 mx-auto');
  const mk = (l, d) => { const b = ctx.el('button', 'py-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-xl', l); b.onclick = () => setDir(d); return b; };
  const blank = () => ctx.el('div', '');
  pad.append(blank(), mk('▲', [0, -1]), blank(), mk('◀', [-1, 0]), blank(), mk('▶', [1, 0]), blank(), mk('▼', [0, 1]), blank());
  wrap.appendChild(pad);
  ctx.root.appendChild(wrap);
  paint();
}

export default {
  id: 'snake', name: 'Snake', emoji: '🐍', blurb: 'Eat and grow', solo: true, usesTurns: false, realtime: true,
  start(ctx) {
    const c = N >> 1;
    M.body = [[c, c], [c - 1, c], [c - 2, c]]; M.dir = [1, 0]; M.next = [1, 0]; M.score = 0; M.dead = false;
    placeFood(); build(ctx);
    M.keyHandler = (e) => { const d = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[e.key]; if (d) { e.preventDefault(); setDir(d); } };
    document.addEventListener('keydown', M.keyHandler);
    M.loop = setInterval(() => tick(ctx), TICK);
  },
  stop() { clearInterval(M.loop); M.loop = null; if (M.keyHandler) { document.removeEventListener('keydown', M.keyHandler); M.keyHandler = null; } },
  getState() { return null; },
  restore(_, ctx) { this.start(ctx); },
};
