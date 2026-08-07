import { TETROMINOES, rotateCells, tetrisFits, tetrisClear } from '../logic.js?v=41';

const W = 10, H = 20;
const TYPES = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
const CLR = { I: 'bg-cyan-400', O: 'bg-yellow-400', T: 'bg-purple-400', S: 'bg-green-400', Z: 'bg-red-400', J: 'bg-blue-400', L: 'bg-orange-400', G: 'bg-slate-500' };
const M = { grid: [], cur: null, cells: [], oppCells: [], oppGrid: [], grav: null, keyHandler: null, statusEl: null, dead: false };

const newGrid = () => Array.from({ length: H }, () => Array(W).fill(0));
function spawn(ctx) {
  const type = TYPES[Math.floor(Math.random() * 7)];
  M.cur = { type, cells: TETROMINOES[type].map((c) => c.slice()), x: 3, y: 0 };
  if (!tetrisFits(M.grid, M.cur.cells, M.cur.x, M.cur.y)) die(ctx);
}
function die(ctx) { if (M.dead) return; M.dead = true; ctx.sound('lose'); ctx.send('dead', {}); ctx.endGame('lose', 'Topped out'); }
function paintMain() {
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) M.cells[y][x].className = 'rounded-sm ' + (M.grid[y][x] ? CLR[M.grid[y][x]] : 'bg-slate-800');
  if (M.cur) for (const [dx, dy] of M.cur.cells) { const x = M.cur.x + dx, y = M.cur.y + dy; if (y >= 0 && y < H && x >= 0 && x < W) M.cells[y][x].className = 'rounded-sm ' + CLR[M.cur.type]; }
}
function paintOpp() { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) M.oppCells[y][x].className = 'rounded-[1px] ' + ((M.oppGrid[y] && M.oppGrid[y][x]) ? CLR[M.oppGrid[y][x]] : 'bg-slate-800'); }
function sendBoard(ctx) { ctx.send('board', { g: M.grid }); }

function lock(ctx) {
  for (const [dx, dy] of M.cur.cells) { const x = M.cur.x + dx, y = M.cur.y + dy; if (y >= 0) M.grid[y][x] = M.cur.type; }
  const { grid, lines } = tetrisClear(M.grid); M.grid = grid;
  if (lines) { ctx.sound('capture'); const atk = lines === 4 ? 4 : lines - 1; if (atk > 0) ctx.send('garbage', { n: atk }); }
  else ctx.sound('place');
  sendBoard(ctx);
  spawn(ctx); paintMain();
}
function step(ctx) {
  if (M.dead || !M.cur) return;
  if (tetrisFits(M.grid, M.cur.cells, M.cur.x, M.cur.y + 1)) { M.cur.y++; paintMain(); }
  else lock(ctx);
}
function moveX(ctx, d) { if (M.cur && tetrisFits(M.grid, M.cur.cells, M.cur.x + d, M.cur.y)) { M.cur.x += d; paintMain(); } }
function rotate(ctx) {
  if (!M.cur) return;
  const rc = rotateCells(M.cur.cells);
  for (const kx of [0, -1, 1, -2, 2]) if (tetrisFits(M.grid, rc, M.cur.x + kx, M.cur.y)) { M.cur.cells = rc; M.cur.x += kx; paintMain(); return; }
}
function hardDrop(ctx) { if (!M.cur) return; while (tetrisFits(M.grid, M.cur.cells, M.cur.x, M.cur.y + 1)) M.cur.y++; lock(ctx); }
function addGarbage(ctx, n) {
  for (let i = 0; i < n; i++) {
    if (M.grid[0].some((c) => c)) return die(ctx);            // overflow -> top out
    M.grid.shift();
    const row = Array(W).fill('G'); row[Math.floor(Math.random() * W)] = 0;
    M.grid.push(row);
  }
  paintMain();
}

function build(ctx) {
  M.cells = []; M.oppCells = [];
  const wrap = ctx.el('div', 'flex flex-col items-center gap-3');
  const top = ctx.el('div', 'flex items-start justify-center gap-3');
  const main = ctx.el('div', 'grid gap-px bg-slate-950 p-1 rounded');
  main.style.gridTemplateColumns = `repeat(${W}, 1fr)`; main.style.width = 'min(60vw, 15rem)';
  for (let y = 0; y < H; y++) { M.cells[y] = []; for (let x = 0; x < W; x++) { const c = ctx.el('div', 'aspect-square rounded-sm bg-slate-800'); M.cells[y][x] = c; main.appendChild(c); } }
  const side = ctx.el('div', 'flex flex-col items-center gap-1');
  side.appendChild(ctx.el('p', 'text-xs text-amber-400 font-semibold', 'Rival'));
  const opp = ctx.el('div', 'grid gap-px bg-slate-950 p-0.5 rounded');
  opp.style.gridTemplateColumns = `repeat(${W}, 1fr)`; opp.style.width = 'min(24vw, 6rem)';
  for (let y = 0; y < H; y++) { M.oppCells[y] = []; for (let x = 0; x < W; x++) { const c = ctx.el('div', 'aspect-square rounded-[1px] bg-slate-800'); M.oppCells[y][x] = c; opp.appendChild(c); } }
  side.appendChild(opp);
  top.append(main, side);
  wrap.appendChild(top);
  // on-screen controls
  const ctrl = ctx.el('div', 'grid grid-cols-5 gap-2 w-full max-w-xs');
  const mk = (label, fn) => { const b = ctx.el('button', 'py-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-xl font-bold', label); b.onclick = fn; return b; };
  ctrl.append(mk('◀', () => moveX(ctx, -1)), mk('⟳', () => rotate(ctx)), mk('▶', () => moveX(ctx, 1)), mk('▼', () => step(ctx)), mk('⤓', () => hardDrop(ctx)));
  wrap.appendChild(ctrl);
  M.statusEl = ctx.el('p', 'text-slate-500 text-xs', 'Clear lines to attack');
  wrap.appendChild(M.statusEl);
  ctx.root.appendChild(wrap);
  paintMain(); paintOpp();
}

export default {
  id: 'tetris', name: 'Tetris Duel', emoji: '🟦', blurb: 'Clear lines, send garbage', usesTurns: false, realtime: true,
  start(ctx) {
    M.grid = newGrid(); M.oppGrid = newGrid(); M.dead = false; M.cur = null;
    build(ctx); spawn(ctx); paintMain();
    M.grav = setInterval(() => step(ctx), 700);
    M.keyHandler = (e) => {
      const f = { ArrowLeft: () => moveX(ctx, -1), ArrowRight: () => moveX(ctx, 1), ArrowUp: () => rotate(ctx), ArrowDown: () => step(ctx), ' ': () => hardDrop(ctx) }[e.key];
      if (f) { e.preventDefault(); f(); }
    };
    document.addEventListener('keydown', M.keyHandler);
  },
  onMessage(msg, ctx) {
    if (msg.type === 'garbage') addGarbage(ctx, msg.n);
    else if (msg.type === 'board') { M.oppGrid = msg.g; paintOpp(); }
    else if (msg.type === 'dead') ctx.endGame('win', 'Opponent topped out');
  },
  stop() { clearInterval(M.grav); M.grav = null; if (M.keyHandler) { document.removeEventListener('keydown', M.keyHandler); M.keyHandler = null; } },
  getState() { return null; },     // real-time: not resumable
  restore(_, ctx) { this.start(ctx); },
};
