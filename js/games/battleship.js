// Battleship on a 7x7 grid, fleet sizes [3,2,2]. Your board stays on your device;
// each fire is evaluated by the owner, who returns hit/miss/sunk/win.
// ponytail: random placement only (Shuffle re-rolls); manual drag placement is a later add.
const SIZE = 7;
const FLEET = [3, 2, 2];
const M = {};

function placeRandom() {
  // board[y][x] = shipIndex | null ; ships[i] = { cells:[[x,y]], hits:Set }
  const board = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
  const ships = [];
  FLEET.forEach((len, idx) => {
    for (;;) {
      const horiz = Math.random() < 0.5;
      const x = Math.floor(Math.random() * (horiz ? SIZE - len + 1 : SIZE));
      const y = Math.floor(Math.random() * (horiz ? SIZE : SIZE - len + 1));
      const cells = [];
      let ok = true;
      for (let k = 0; k < len; k++) {
        const cx = x + (horiz ? k : 0), cy = y + (horiz ? 0 : k);
        if (board[cy][cx] !== null) { ok = false; break; }
        cells.push([cx, cy]);
      }
      if (!ok) continue;
      cells.forEach(([cx, cy]) => (board[cy][cx] = idx));
      ships.push({ cells, hits: new Set() });
      break;
    }
  });
  return { board, ships };
}

function makeGrid(ctx, onCell) {
  const g = ctx.el('div', 'grid gap-1 mx-auto');
  g.style.gridTemplateColumns = `repeat(${SIZE}, 1fr)`;
  g.style.maxWidth = 'min(88vw, 22rem)';
  const cells = [];
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const c = ctx.el('button', 'aspect-square rounded bg-slate-800 border border-slate-700 text-sm');
      if (onCell) c.onclick = () => onCell(x, y, c);
      c.dataset.x = x; c.dataset.y = y;
      cells.push(c);
      g.appendChild(c);
    }
  }
  return { g, cells, at: (x, y) => cells[y * SIZE + x] };
}

function paintMine(ctx) {
  M.mine.cells.forEach((c) => {
    const x = +c.dataset.x, y = +c.dataset.y;
    const ship = M.board[y][x] !== null;
    const hit = M.incoming.has(y * SIZE + x);
    c.className = 'aspect-square rounded border text-sm ' +
      (hit && ship ? 'bg-rose-500 border-rose-400'
        : hit ? 'bg-slate-600 border-slate-500'
        : ship ? 'bg-indigo-600 border-indigo-400'
        : 'bg-slate-800 border-slate-700');
  });
}

export default {
  id: 'battleship', name: 'Battleship', emoji: '🚢', blurb: 'Sink the fleet',

  setup(ctx) {
    const roll = () => { const p = placeRandom(); M.board = p.board; M.ships = p.ships; paintSetup(); };
    const root = ctx.setupRoot;
    root.appendChild(ctx.el('p', 'text-sm text-slate-400 mb-2 text-center',
      'Your fleet is placed at random. Shuffle until you like it, then lock in.'));
    const grid = makeGrid(ctx, null);
    root.appendChild(grid.g);
    M.setupCells = grid;
    const btns = ctx.el('div', 'grid grid-cols-2 gap-2 mt-3');
    const shuffle = ctx.el('button', 'py-3 rounded-xl bg-slate-700 hover:bg-slate-600 font-semibold', '🔀 Shuffle');
    const lock = ctx.el('button', 'py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-semibold', 'Lock in');
    const status = ctx.el('p', 'text-sm text-slate-400 h-5 mt-2 text-center col-span-2');
    function paintSetup() {
      for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
        grid.at(x, y).className = 'aspect-square rounded border ' +
          (M.board[y][x] !== null ? 'bg-indigo-600 border-indigo-400' : 'bg-slate-800 border-slate-700');
      }
    }
    shuffle.onclick = roll;
    lock.onclick = () => { shuffle.disabled = lock.disabled = true; status.textContent = 'Locked. Waiting for opponent…'; ctx.ready(); };
    btns.append(shuffle, lock, status);
    root.appendChild(btns);
    roll();
  },

  start(ctx) {
    M.incoming = new Set();       // cell indices the opponent has fired at on my board
    M.shots = new Set();          // cell indices I've fired at on the target board
    M.targetMarks = [];           // [{x,y,hit,sunk}] learned about the opponent's board
    buildPlay(ctx);
  },

  onMessage(msg, ctx) {
    if (msg.type === 'fire') {
      const { x, y } = msg;
      M.incoming.add(y * SIZE + x);
      const shipIdx = M.board[y][x];
      let sunk = false, win = false;
      if (shipIdx !== null) {
        const ship = M.ships[shipIdx];
        ship.hits.add(x + ',' + y);
        sunk = ship.hits.size === ship.cells.length;
        win = M.ships.every((s) => s.hits.size === s.cells.length);
      }
      ctx.send('result', { x, y, hit: shipIdx !== null, sunk, win });
      paintMine(ctx);
      if (win) ctx.endGame('lose', 'Your fleet was sunk.');
      else ctx.setTurn(true);
    } else if (msg.type === 'result') {
      M.targetMarks.push({ x: msg.x, y: msg.y, hit: msg.hit, sunk: msg.sunk });
      paintTarget();
      ctx.save();
      if (msg.win) ctx.endGame('win', 'You sank the enemy fleet!');
    }
  },

  getState() {
    return {
      board: M.board,
      ships: M.ships.map((s) => ({ cells: s.cells, hits: [...s.hits] })),
      incoming: [...M.incoming], shots: [...M.shots], targetMarks: M.targetMarks,
    };
  },
  restore(state, ctx) {
    M.board = state.board;
    M.ships = state.ships.map((s) => ({ cells: s.cells, hits: new Set(s.hits) }));
    M.incoming = new Set(state.incoming);
    M.shots = new Set(state.shots);
    M.targetMarks = state.targetMarks || [];
    buildPlay(ctx);
  },
};

function buildPlay(ctx) {
  const wrap = ctx.el('div', 'space-y-4');
  wrap.appendChild(ctx.el('h3', 'text-center text-sm font-semibold text-rose-400', 'Enemy waters — tap to fire'));
  M.target = makeGrid(ctx, (x, y, cell) => {
    if (!ctx.myTurn) return;
    const key = y * SIZE + x;
    if (M.shots.has(key)) return;
    M.shots.add(key);
    cell.disabled = true;
    ctx.send('fire', { x, y });
    ctx.setTurn(false);
  });
  wrap.appendChild(M.target.g);
  wrap.appendChild(ctx.el('h3', 'text-center text-sm font-semibold text-indigo-400 mt-4', 'Your fleet'));
  M.mine = makeGrid(ctx, null);
  wrap.appendChild(M.mine.g);
  ctx.root.appendChild(wrap);
  paintMine(ctx);
  paintTarget();
}

function paintTarget() {
  M.shots.forEach((key) => { const c = M.target.cells[key]; if (c) c.disabled = true; });
  for (const m of M.targetMarks) {
    const cell = M.target.at(m.x, m.y);
    cell.className = 'aspect-square rounded border text-sm ' +
      (m.hit ? 'bg-rose-500 border-rose-400' : 'bg-slate-600 border-slate-500');
    if (m.hit) cell.textContent = m.sunk ? '💀' : '✱';
  }
}
