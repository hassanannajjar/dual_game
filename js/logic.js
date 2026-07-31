// Pure game rules — no DOM, no network. Importable in the browser and in Node (test.mjs).

// Bulls & Cows: exact = right digit+position, partial = right digit wrong position (freq-counted).
export function evaluate(secret, guess) {
  if (secret.length !== guess.length) throw new Error('length mismatch');
  let exact = 0;
  const secretRest = {};
  const guessRest = [];
  for (let i = 0; i < secret.length; i++) {
    if (guess[i] === secret[i]) exact++;
    else {
      secretRest[secret[i]] = (secretRest[secret[i]] || 0) + 1;
      guessRest.push(guess[i]);
    }
  }
  let partial = 0;
  for (const d of guessRest) {
    if (secretRest[d] > 0) { partial++; secretRest[d]--; }
  }
  return { exact, partial };
}

// Tic-Tac-Toe: cells = array(9) of 'X' | 'O' | null. Returns 'X'|'O' winner, 'draw', or null.
const TTT_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];
export function ticTacToeWinner(cells) {
  for (const [a, b, c] of TTT_LINES) {
    if (cells[a] && cells[a] === cells[b] && cells[a] === cells[c]) return cells[a];
  }
  return cells.every(Boolean) ? 'draw' : null;
}

// Connect Four: grid = cols array (7) of column arrays filled bottom-up with 'R'|'Y'.
export function connectFourWinner(grid, col, row) {
  const cols = grid.length, rows = 6;
  const player = grid[col][row];
  if (!player) return null;
  const dirs = [[1, 0], [0, 1], [1, 1], [1, -1]];
  for (const [dc, dr] of dirs) {
    let count = 1;
    for (const sign of [1, -1]) {
      let c = col + dc * sign, r = row + dr * sign;
      while (c >= 0 && c < cols && r >= 0 && r < rows && grid[c][r] === player) {
        count++; c += dc * sign; r += dr * sign;
      }
    }
    if (count >= 4) return player;
  }
  return null;
}

// ---------- Gomoku ---------- grid = 2D [y][x] of 'B'|'W'|null. Win = `need` in a row through (x,y).
export function lineWinner(grid, x, y, need) {
  const player = grid[y][x];
  if (!player) return null;
  const H = grid.length, W = grid[0].length;
  for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
    let count = 1;
    for (const s of [1, -1]) {
      let cx = x + dx * s, cy = y + dy * s;
      while (cy >= 0 && cy < H && cx >= 0 && cx < W && grid[cy][cx] === player) { count++; cx += dx * s; cy += dy * s; }
    }
    if (count >= need) return player;
  }
  return null;
}

// ---------- Reversi / Othello ---------- board = 8x8 [y][x] of 'B'|'W'|null.
const DIRS8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
export function reversiFlips(board, x, y, player) {
  if (board[y][x]) return [];
  const opp = player === 'B' ? 'W' : 'B';
  const flips = [];
  for (const [dx, dy] of DIRS8) {
    const line = [];
    let cx = x + dx, cy = y + dy;
    while (cy >= 0 && cy < 8 && cx >= 0 && cx < 8 && board[cy][cx] === opp) { line.push([cx, cy]); cx += dx; cy += dy; }
    if (line.length && cy >= 0 && cy < 8 && cx >= 0 && cx < 8 && board[cy][cx] === player) flips.push(...line);
  }
  return flips;
}
export function reversiLegalMoves(board, player) {
  const m = [];
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if (!board[y][x] && reversiFlips(board, x, y, player).length) m.push([x, y]);
  return m;
}
export function reversiCounts(board) {
  let B = 0, W = 0;
  for (const row of board) for (const c of row) { if (c === 'B') B++; else if (c === 'W') W++; }
  return { B, W };
}

// ---------- Checkers ---------- board = 8x8 [y][x] of 'r'|'b'|'R'|'B'|null (caps = kings). 'r' moves +y, 'b' moves -y.
const inb8 = (x, y) => x >= 0 && x < 8 && y >= 0 && y < 8;
export function checkerMoves(board, x, y) {
  const p = board[y][x];
  if (!p) return { steps: [], jumps: [] };
  const me = p.toLowerCase(), king = p === p.toUpperCase();
  const dirs = king ? [[1, 1], [1, -1], [-1, 1], [-1, -1]] : (me === 'r' ? [[1, 1], [-1, 1]] : [[1, -1], [-1, -1]]);
  const steps = [], jumps = [];
  for (const [dx, dy] of dirs) {
    const nx = x + dx, ny = y + dy;
    if (inb8(nx, ny) && !board[ny][nx]) steps.push([nx, ny]);
    const jx = x + 2 * dx, jy = y + 2 * dy;
    if (inb8(jx, jy) && !board[jy][jx] && board[ny] && board[ny][nx] && board[ny][nx].toLowerCase() !== me)
      jumps.push({ to: [jx, jy], cap: [nx, ny] });
  }
  return { steps, jumps };
}
export function checkerHasMove(board, me) {
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    if (board[y][x] && board[y][x].toLowerCase() === me) {
      const m = checkerMoves(board, x, y);
      if (m.steps.length || m.jumps.length) return true;
    }
  }
  return false;
}

// ---------- Dots & Boxes ---------- H[r][c] (r:0..D-1, c:0..D-2), V[r][c] (r:0..D-2, c:0..D-1). D = dots per side.
export function boxClosed(H, V, br, bc) {
  return !!(H[br][bc] && H[br + 1][bc] && V[br][bc] && V[br][bc + 1]);
}

// ---------- Ultimate Tic-Tac-Toe ---------- smallWinners = array(9) of 'X'|'O'|'draw'|null. Returns 'X'|'O'|null (line only).
export function ultimateWinner(smallWinners) {
  const macro = smallWinners.map((w) => (w === 'X' || w === 'O') ? w : null);
  for (const [a, b, c] of TTT_LINES) if (macro[a] && macro[a] === macro[b] && macro[a] === macro[c]) return macro[a];
  return null;
}

// ---------- Mancala ---------- board = array(14): 0-5 p1 pits, 6 p1 store, 7-12 p2 pits, 13 p2 store.
export function mancalaSow(board, pit) {
  board = board.slice();
  const side = pit <= 5 ? 0 : 1;
  const myStore = side === 0 ? 6 : 13, oppStore = side === 0 ? 13 : 6;
  let seeds = board[pit];
  if (!seeds) return { board, extraTurn: false, captured: 0, side, illegal: true };
  board[pit] = 0;
  let i = pit;
  while (seeds > 0) { i = (i + 1) % 14; if (i === oppStore) continue; board[i]++; seeds--; }
  const extraTurn = i === myStore;
  let captured = 0;
  const inMyPits = side === 0 ? (i >= 0 && i <= 5) : (i >= 7 && i <= 12);
  if (!extraTurn && inMyPits && board[i] === 1) {
    const opposite = 12 - i;
    if (board[opposite] > 0) { captured = board[opposite] + 1; board[myStore] += captured; board[i] = 0; board[opposite] = 0; }
  }
  return { board, extraTurn, captured, side };
}
export function mancalaEnded(board) {
  const p1 = board.slice(0, 6).every((n) => n === 0);
  const p2 = board.slice(7, 13).every((n) => n === 0);
  return p1 || p2;
}
export function mancalaFinalize(board) {
  board = board.slice();
  for (let i = 0; i <= 5; i++) { board[6] += board[i]; board[i] = 0; }
  for (let i = 7; i <= 12; i++) { board[13] += board[i]; board[i] = 0; }
  return board;
}

// ---------- Nine Men's Morris ---------- board = array(24) of 'A'|'B'|null.
export const MORRIS_MILLS = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], [9, 10, 11], [12, 13, 14], [15, 16, 17], [18, 19, 20], [21, 22, 23],
  [0, 9, 21], [3, 10, 18], [6, 11, 15], [1, 4, 7], [16, 19, 22], [8, 12, 17], [5, 13, 20], [2, 14, 23],
];
export const MORRIS_ADJ = [
  [1, 9], [0, 2, 4], [1, 14], [4, 10], [1, 3, 5, 7], [4, 13], [7, 11], [4, 6, 8], [7, 12],
  [0, 10, 21], [3, 9, 11, 18], [6, 10, 15], [8, 13, 17], [5, 12, 14, 20], [2, 13, 23],
  [11, 16], [15, 17, 19], [12, 16], [10, 19], [16, 18, 20, 22], [13, 19], [9, 22], [19, 21, 23], [14, 22],
];
export function morrisMillsAt(board, pos) {
  const p = board[pos];
  if (!p) return [];
  return MORRIS_MILLS.filter((m) => m.includes(pos) && m.every((i) => board[i] === p));
}

// ---------- Chess ---------- board 8x8 [y][x]; UPPER=white, lower=black. y=0 rank 8, y=7 rank 1. White moves -y.
const cIn = (x, y) => x >= 0 && x < 8 && y >= 0 && y < 8;
const cColor = (p) => p ? (p === p.toUpperCase() ? 'w' : 'b') : null;
export function chessInitial() {
  const back = 'RNBQKBNR';
  const b = Array.from({ length: 8 }, () => Array(8).fill(null));
  for (let x = 0; x < 8; x++) { b[0][x] = back[x].toLowerCase(); b[1][x] = 'p'; b[6][x] = 'P'; b[7][x] = back[x]; }
  return { board: b, turn: 'w', castling: { wk: true, wq: true, bk: true, bq: true }, ep: null };
}
function attacked(board, x, y, by) {
  const pr = y + (by === 'w' ? 1 : -1), pp = by === 'w' ? 'P' : 'p';
  if (cIn(x - 1, pr) && board[pr][x - 1] === pp) return true;
  if (cIn(x + 1, pr) && board[pr][x + 1] === pp) return true;
  const kn = by === 'w' ? 'N' : 'n';
  for (const [dx, dy] of [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]])
    if (cIn(x + dx, y + dy) && board[y + dy][x + dx] === kn) return true;
  const kg = by === 'w' ? 'K' : 'k';
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) if ((dx || dy) && cIn(x + dx, y + dy) && board[y + dy][x + dx] === kg) return true;
  const rq = by === 'w' ? 'RQ' : 'rq', bq = by === 'w' ? 'BQ' : 'bq';
  const ray = (dirs, set) => { for (const [dx, dy] of dirs) { let cx = x + dx, cy = y + dy; while (cIn(cx, cy)) { const q = board[cy][cx]; if (q) { if (set.includes(q)) return true; break; } cx += dx; cy += dy; } } return false; };
  return ray([[1, 0], [-1, 0], [0, 1], [0, -1]], rq) || ray([[1, 1], [1, -1], [-1, 1], [-1, -1]], bq);
}
function kingPos(board, color) { const k = color === 'w' ? 'K' : 'k'; for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if (board[y][x] === k) return [x, y]; return null; }
export function chessInCheck(state, color) { const k = kingPos(state.board, color); return k ? attacked(state.board, k[0], k[1], color === 'w' ? 'b' : 'w') : false; }
function pseudo(state, x, y) {
  const board = state.board, p = board[y][x]; if (!p) return [];
  const c = cColor(p), opp = c === 'w' ? 'b' : 'w', out = [], t = p.toUpperCase();
  const add = (tx, ty) => { if (cIn(tx, ty)) { const q = board[ty][tx]; if (!q || cColor(q) === opp) out.push([tx, ty]); } };
  const slide = (dirs) => { for (const [dx, dy] of dirs) { let cx = x + dx, cy = y + dy; while (cIn(cx, cy)) { const q = board[cy][cx]; if (!q) out.push([cx, cy]); else { if (cColor(q) === opp) out.push([cx, cy]); break; } cx += dx; cy += dy; } } };
  if (t === 'P') {
    const dir = c === 'w' ? -1 : 1, sy = c === 'w' ? 6 : 1;
    if (cIn(x, y + dir) && !board[y + dir][x]) { out.push([x, y + dir]); if (y === sy && !board[y + 2 * dir][x]) out.push([x, y + 2 * dir]); }
    for (const dx of [-1, 1]) { const tx = x + dx, ty = y + dir; if (cIn(tx, ty)) { const q = board[ty][tx]; if (q && cColor(q) === opp) out.push([tx, ty]); else if (state.ep && state.ep[0] === tx && state.ep[1] === ty) out.push([tx, ty]); } }
  } else if (t === 'N') { for (const [dx, dy] of [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]]) add(x + dx, y + dy); }
  else if (t === 'B') slide([[1, 1], [1, -1], [-1, 1], [-1, -1]]);
  else if (t === 'R') slide([[1, 0], [-1, 0], [0, 1], [0, -1]]);
  else if (t === 'Q') slide([[1, 1], [1, -1], [-1, 1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]]);
  else if (t === 'K') {
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) if (dx || dy) add(x + dx, y + dy);
    const rank = c === 'w' ? 7 : 0, oc = opp, rk = c === 'w' ? 'R' : 'r';
    if (y === rank && x === 4) {
      const ks = c === 'w' ? state.castling.wk : state.castling.bk, qs = c === 'w' ? state.castling.wq : state.castling.bq;
      if (ks && !board[rank][5] && !board[rank][6] && board[rank][7] === rk && !attacked(board, 4, rank, oc) && !attacked(board, 5, rank, oc) && !attacked(board, 6, rank, oc)) out.push([6, rank]);
      if (qs && !board[rank][3] && !board[rank][2] && !board[rank][1] && board[rank][0] === rk && !attacked(board, 4, rank, oc) && !attacked(board, 3, rank, oc) && !attacked(board, 2, rank, oc)) out.push([2, rank]);
    }
  }
  return out;
}
export function chessApply(state, from, to, promo) {
  const [fx, fy] = from, [tx, ty] = to;
  const board = state.board.map((r) => r.slice()), castling = { ...state.castling };
  let p = board[fy][fx]; const c = cColor(p), t = p.toUpperCase(); let ep = null;
  if (t === 'P' && fx !== tx && !board[ty][tx]) board[fy][tx] = null; // en passant
  board[fy][fx] = null;
  if (t === 'P' && (ty === 0 || ty === 7)) { const pr = (promo || 'Q').toUpperCase(); p = c === 'w' ? pr : pr.toLowerCase(); }
  board[ty][tx] = p;
  if (t === 'K' && Math.abs(tx - fx) === 2) { const rk = fy; if (tx === 6) { board[rk][5] = board[rk][7]; board[rk][7] = null; } else { board[rk][3] = board[rk][0]; board[rk][0] = null; } }
  if (t === 'K') { if (c === 'w') { castling.wk = castling.wq = false; } else { castling.bk = castling.bq = false; } }
  if (fx === 0 && fy === 7) castling.wq = false; if (fx === 7 && fy === 7) castling.wk = false;
  if (fx === 0 && fy === 0) castling.bq = false; if (fx === 7 && fy === 0) castling.bk = false;
  if (tx === 0 && ty === 7) castling.wq = false; if (tx === 7 && ty === 7) castling.wk = false;
  if (tx === 0 && ty === 0) castling.bq = false; if (tx === 7 && ty === 0) castling.bk = false;
  if (t === 'P' && Math.abs(ty - fy) === 2) ep = [fx, (fy + ty) / 2];
  return { board, turn: c === 'w' ? 'b' : 'w', castling, ep };
}
export function chessLegalMoves(state, from) {
  const [x, y] = from, p = state.board[y][x]; if (!p || cColor(p) !== state.turn) return [];
  return pseudo(state, x, y).filter((to) => !chessInCheck(chessApply(state, from, to, 'Q'), state.turn));
}
export function chessAllMoves(state) {
  const res = [];
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { const p = state.board[y][x]; if (p && cColor(p) === state.turn) for (const to of chessLegalMoves(state, [x, y])) res.push({ from: [x, y], to }); }
  return res;
}
export function chessStatus(state) {
  const moves = chessAllMoves(state), chk = chessInCheck(state, state.turn);
  if (!moves.length) return chk ? 'checkmate' : 'stalemate';
  return chk ? 'check' : 'normal';
}

// ---------- Go (9x9) ---------- board 9x9 [y][x] of 'b'|'w'|null.
const goNbr = (x, y) => { const r = []; if (x > 0) r.push([x - 1, y]); if (x < 8) r.push([x + 1, y]); if (y > 0) r.push([x, y - 1]); if (y < 8) r.push([x, y + 1]); return r; };
function goGroup(board, x, y) {
  const color = board[y][x], seen = new Set(), stack = [[x, y]], cells = [], libs = new Set();
  while (stack.length) {
    const [cx, cy] = stack.pop(), k = cy * 9 + cx; if (seen.has(k)) continue; seen.add(k); cells.push([cx, cy]);
    for (const [nx, ny] of goNbr(cx, cy)) { const v = board[ny][nx]; if (v === null) libs.add(ny * 9 + nx); else if (v === color && !seen.has(ny * 9 + nx)) stack.push([nx, ny]); }
  }
  return { cells, libs: libs.size };
}
export function goPlace(board, x, y, color) {
  if (board[y][x]) return null;
  const b = board.map((r) => r.slice()); b[y][x] = color; const opp = color === 'b' ? 'w' : 'b';
  let captured = 0;
  for (const [nx, ny] of goNbr(x, y)) if (b[ny][nx] === opp) { const g = goGroup(b, nx, ny); if (g.libs === 0) for (const [gx, gy] of g.cells) { b[gy][gx] = null; captured++; } }
  if (goGroup(b, x, y).libs === 0) return null; // suicide
  return { board: b, captured };
}
export function goScore(board) {
  let b = 0, w = 0;
  for (const row of board) for (const c of row) { if (c === 'b') b++; else if (c === 'w') w++; }
  const seen = new Set();
  for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) {
    if (board[y][x] || seen.has(y * 9 + x)) continue;
    const stack = [[x, y]], region = [], border = new Set();
    while (stack.length) { const [cx, cy] = stack.pop(), k = cy * 9 + cx; if (seen.has(k)) continue; seen.add(k); region.push(k); for (const [nx, ny] of goNbr(cx, cy)) { const v = board[ny][nx]; if (v === null) { if (!seen.has(ny * 9 + nx)) stack.push([nx, ny]); } else border.add(v); } }
    if (border.size === 1) { if (border.has('b')) b += region.length; else w += region.length; }
  }
  return { b, w };
}

// ---------- Yahtzee ---------- dice = array(5) of 1..6.
export function yahtzeeScore(cat, dice) {
  const counts = {}; for (const d of dice) counts[d] = (counts[d] || 0) + 1;
  const vc = Object.values(counts), sum = dice.reduce((a, b) => a + b, 0);
  const has = (n) => vc.some((c) => c >= n);
  const straight = (len) => { let run = 0, mx = 0; for (let n = 1; n <= 6; n++) { if (counts[n]) { run++; mx = Math.max(mx, run); } else run = 0; } return mx >= len; };
  const num = { ones: 1, twos: 2, threes: 3, fours: 4, fives: 5, sixes: 6 };
  if (cat in num) return (counts[num[cat]] || 0) * num[cat];
  switch (cat) {
    case 'threeKind': return has(3) ? sum : 0;
    case 'fourKind': return has(4) ? sum : 0;
    case 'fullHouse': return (vc.includes(3) && vc.includes(2)) ? 25 : 0;
    case 'smallStraight': return straight(4) ? 30 : 0;
    case 'largeStraight': return straight(5) ? 40 : 0;
    case 'yahtzee': return has(5) ? 50 : 0;
    case 'chance': return sum;
  }
  return 0;
}
export const YAHTZEE_CATS = ['ones', 'twos', 'threes', 'fours', 'fives', 'sixes', 'threeKind', 'fourKind', 'fullHouse', 'smallStraight', 'largeStraight', 'yahtzee', 'chance'];

// ---------- Nim ---------- rows = array of stick counts.
export function nimEmpty(rows) { return rows.every((n) => n === 0); }

// ---------- Snakes & Ladders ---------- square -> destination (ladders up, snakes down).
export const SNL_MAP = { 1: 38, 4: 14, 9: 31, 21: 42, 28: 84, 36: 44, 51: 67, 71: 91, 80: 100, 16: 6, 47: 26, 49: 11, 56: 53, 62: 19, 64: 60, 87: 24, 93: 73, 95: 75, 98: 78 };

// ---------- Hex ---------- board NxN [y][x] of 'r'|'b'|null. 'r' connects top<->bottom, 'b' connects left<->right.
export function hexConnected(board, color) {
  const N = board.length;
  const nbrs = (x, y) => [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1], [x + 1, y - 1], [x - 1, y + 1]].filter(([a, b]) => a >= 0 && a < N && b >= 0 && b < N);
  const seen = new Set(), stack = [];
  if (color === 'r') { for (let x = 0; x < N; x++) if (board[0][x] === 'r') stack.push([x, 0]); }
  else { for (let y = 0; y < N; y++) if (board[y][0] === 'b') stack.push([0, y]); }
  while (stack.length) {
    const [x, y] = stack.pop(), k = y * N + x;
    if (seen.has(k) || board[y][x] !== color) continue;
    seen.add(k);
    if (color === 'r' && y === N - 1) return true;
    if (color === 'b' && x === N - 1) return true;
    for (const [nx, ny] of nbrs(x, y)) if (!seen.has(ny * N + nx) && board[ny][nx] === color) stack.push([nx, ny]);
  }
  return false;
}

// ---------- Ludo (2-player) ---------- token progress 0=base, 1..51 main track, 52..56 home column, 57=home.
export function ludoStep(steps, roll) {
  if (steps === 0) return roll === 6 ? 1 : null;   // leave base only on a 6
  const ns = steps + roll;
  if (ns > 57) return null;                          // must be exact to finish
  return ns;
}
export function ludoAbs(entry, steps) {              // absolute main-track cell (0..51), or null off-track
  return (steps >= 1 && steps <= 51) ? (entry + steps - 1) % 52 : null;
}

// ---------- Backgammon ---------- points[24] signed ints (+white, -black); white moves 23->0 (home 0..5), black 0->23 (home 18..23).
export function bgInitial() {
  const p = Array(24).fill(0);
  p[23] = 2; p[12] = 5; p[7] = 3; p[5] = 5;          // white +
  p[0] = -2; p[11] = -5; p[16] = -3; p[18] = -5;     // black -
  return { points: p, bar: { w: 0, b: 0 }, off: { w: 0, b: 0 } };
}
const bgSign = (c) => (c === 'w' ? 1 : -1);
export function bgAllHome(state, color) {
  const s = bgSign(color);
  if ((color === 'w' ? state.bar.w : state.bar.b) > 0) return false;
  for (let i = 0; i < 24; i++) if (state.points[i] * s > 0) { const home = color === 'w' ? i <= 5 : i >= 18; if (!home) return false; }
  return true;
}
export function bgLegalMoves(state, die, color) {
  const s = bgSign(color), dir = color === 'w' ? -1 : 1, moves = [];
  const own = (i) => state.points[i] * s > 0;
  const blocked = (i) => state.points[i] * s <= -2;
  const bar = color === 'w' ? state.bar.w : state.bar.b;
  if (bar > 0) {
    const entry = color === 'w' ? 24 - die : die - 1;
    if (entry >= 0 && entry < 24 && !blocked(entry)) moves.push({ from: 'bar', to: entry });
    return moves;
  }
  for (let i = 0; i < 24; i++) {
    if (!own(i)) continue;
    const to = i + dir * die;
    if (to >= 0 && to < 24) { if (!blocked(to)) moves.push({ from: i, to }); }
    else if (bgAllHome(state, color)) {
      const need = color === 'w' ? i + 1 : 24 - i;
      if (die === need) moves.push({ from: i, to: 'off' });
      else if (die > need) {
        let higher = false;
        if (color === 'w') { for (let j = i + 1; j <= 5; j++) if (own(j)) higher = true; }
        else { for (let j = 18; j < i; j++) if (own(j)) higher = true; }
        if (!higher) moves.push({ from: i, to: 'off' });
      }
    }
  }
  return moves;
}
export function bgApply(state, from, to, color) {
  const s = bgSign(color);
  const st = { points: state.points.slice(), bar: { ...state.bar }, off: { ...state.off } };
  if (from === 'bar') { if (color === 'w') st.bar.w--; else st.bar.b--; }
  else st.points[from] -= s;
  if (to === 'off') { if (color === 'w') st.off.w++; else st.off.b++; }
  else {
    if (st.points[to] * s === -1) { st.points[to] = 0; if (color === 'w') st.bar.b++; else st.bar.w++; } // hit blot
    st.points[to] += s;
  }
  return st;
}
export function bgWon(state, color) { return (color === 'w' ? state.off.w : state.off.b) === 15; }

// ---------- Chinese Checkers hop search ---------- adj: Map pos -> [[neighbor, beyond]]; occupied: Set of pegged positions.
export function ccReachable(adj, occupied, start) {
  const dest = new Set();
  for (const [n] of (adj.get(start) || [])) if (!occupied.has(n)) dest.add(n);   // single steps
  const seen = new Set([start]), stack = [start];
  while (stack.length) {
    const p = stack.pop();
    for (const [n, b] of (adj.get(p) || [])) if (b != null && occupied.has(n) && !occupied.has(b) && !seen.has(b)) { seen.add(b); dest.add(b); stack.push(b); }
  }
  return dest;
}

// ---------- Bot helpers ----------
// Tic-Tac-Toe perfect move: cells array(9) 'X'|'O'|null; returns best index for `me`.
export function tttBestMove(cells, me) {
  const opp = me === 'X' ? 'O' : 'X';
  function score(b, turn, depth) {
    const w = ticTacToeWinner(b);
    if (w === me) return 10 - depth;
    if (w === opp) return depth - 10;
    if (w === 'draw') return 0;
    let best = turn === me ? -99 : 99;
    for (let i = 0; i < 9; i++) if (!b[i]) { b[i] = turn; const s = score(b, turn === me ? opp : me, depth + 1); b[i] = null; best = turn === me ? Math.max(best, s) : Math.min(best, s); }
    return best;
  }
  let move = -1, best = -99;
  const b = cells.slice();
  for (let i = 0; i < 9; i++) if (!b[i]) { b[i] = me; const s = score(b, opp, 1); b[i] = null; if (s > best) { best = s; move = i; } }
  return move;
}
// Nim (misère) perfect: rows of counts. Returns {row, keep} = new count to leave, or null (already lost position -> any move).
export function nimBestMove(rows) {
  const nonEmpty = rows.filter((n) => n > 0);
  const xor = rows.reduce((a, b) => a ^ b, 0);
  const bigger = rows.filter((n) => n > 1).length;
  // Endgame: if all remaining rows have <=1, play to leave an odd number of 1-rows for opponent.
  if (bigger === 0) {
    const ones = nonEmpty.length;
    // we want to leave opponent an odd count of ones (so they take the last). Take one whole row.
    const r = rows.findIndex((n) => n > 0);
    // if ones is even, leaving ones-1 (odd) is good; taking a full 1-row does that.
    return { row: r, keep: 0 };
  }
  // Normal Nim strategy until endgame nears.
  if (xor !== 0) {
    for (let r = 0; r < rows.length; r++) {
      const target = rows[r] ^ xor;
      if (target < rows[r]) {
        // misère adjustment: if this move leaves all rows <=1, adjust to leave odd count of ones
        const after = rows.slice(); after[r] = target;
        if (after.every((n) => n <= 1)) {
          const ones = after.filter((n) => n === 1).length;
          if (ones % 2 === 0) return { row: r, keep: target === 1 ? 0 : 1 };
        }
        return { row: r, keep: target };
      }
    }
  }
  // losing position: take 1 from the largest row
  let r = 0; for (let i = 0; i < rows.length; i++) if (rows[i] > rows[r]) r = i;
  return { row: r, keep: rows[r] - 1 };
}

// ---------- Minesweeper ---------- board: mines = Set of "x,y"; returns array of cells to reveal from (x,y) via flood.
export function msNeighbors(x, y, W, H) {
  const r = [];
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) { if (!dx && !dy) continue; const nx = x + dx, ny = y + dy; if (nx >= 0 && nx < W && ny >= 0 && ny < H) r.push([nx, ny]); }
  return r;
}
export function msCount(mines, x, y, W, H) { let c = 0; for (const [nx, ny] of msNeighbors(x, y, W, H)) if (mines.has(nx + ',' + ny)) c++; return c; }
export function msReveal(mines, x, y, W, H) {
  const open = new Set(), stack = [[x, y]];
  while (stack.length) {
    const [cx, cy] = stack.pop(), k = cx + ',' + cy;
    if (open.has(k) || mines.has(k)) continue;
    open.add(k);
    if (msCount(mines, cx, cy, W, H) === 0) for (const [nx, ny] of msNeighbors(cx, cy, W, H)) if (!open.has(nx + ',' + ny)) stack.push([nx, ny]);
  }
  return [...open];
}

// ---------- Sudoku ---------- grid = 9x9 of 0..9 (0 empty).
export function sudokuValid(grid, x, y, v) {
  for (let i = 0; i < 9; i++) { if (grid[y][i] === v || grid[i][x] === v) return false; }
  const bx = Math.floor(x / 3) * 3, by = Math.floor(y / 3) * 3;
  for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 3; dx++) if (grid[by + dy][bx + dx] === v) return false;
  return true;
}
export function sudokuSolve(grid) {                 // fills in place with backtracking; returns true if solved
  for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) if (grid[y][x] === 0) {
    for (let v = 1; v <= 9; v++) if (sudokuValid(grid, x, y, v)) { grid[y][x] = v; if (sudokuSolve(grid)) return true; grid[y][x] = 0; }
    return false;
  }
  return true;
}
function shuffled(rng) { const a = [1, 2, 3, 4, 5, 6, 7, 8, 9]; for (let i = 8; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function fillFull(rng) {
  const g = Array.from({ length: 9 }, () => Array(9).fill(0));
  (function go(pos) {
    if (pos === 81) return true;
    const x = pos % 9, y = Math.floor(pos / 9);
    for (const v of shuffled(rng)) if (sudokuValid(g, x, y, v)) { g[y][x] = v; if (go(pos + 1)) return true; g[y][x] = 0; }
    return false;
  })(0);
  return g;
}
export function sudokuGen(rng, clues) {              // rng() -> [0,1); returns {puzzle, solution}
  const solution = fillFull(rng);
  const puzzle = solution.map((r) => r.slice());
  const cells = []; for (let i = 0; i < 81; i++) cells.push(i);
  for (let i = cells.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [cells[i], cells[j]] = [cells[j], cells[i]]; }
  let removed = 0; const target = 81 - clues;
  for (const c of cells) { if (removed >= target) break; const x = c % 9, y = Math.floor(c / 9); puzzle[y][x] = 0; removed++; }
  return { puzzle, solution };
}

// ---------- 2048 ---------- board = 4x4 [y][x] of number (0 = empty). dir: 'left'|'right'|'up'|'down'.
function slideRow(row) {                              // collapse one row to the left, return {row, gained}
  const nums = row.filter((n) => n);
  let gained = 0;
  for (let i = 0; i < nums.length - 1; i++) if (nums[i] === nums[i + 1]) { nums[i] *= 2; gained += nums[i]; nums.splice(i + 1, 1); }
  while (nums.length < 4) nums.push(0);
  return { row: nums, gained };
}
export function move2048(board, dir) {
  const n = 4;
  let g = board.map((r) => r.slice());
  const rev = (m) => m.map((r) => r.slice().reverse());
  const transpose = (m) => m[0].map((_, x) => m.map((r) => r[x]));
  if (dir === 'up') g = transpose(g);
  else if (dir === 'down') g = rev(transpose(g));
  else if (dir === 'right') g = rev(g);
  let score = 0;
  g = g.map((r) => { const s = slideRow(r); score += s.gained; return s.row; });
  if (dir === 'up') g = transpose(g);
  else if (dir === 'down') g = transpose(rev(g));
  else if (dir === 'right') g = rev(g);
  const moved = JSON.stringify(g) !== JSON.stringify(board);
  let max = 0; for (const r of g) for (const v of r) if (v > max) max = v;
  return { board: g, moved, score, max };
}
export function has2048Move(board) {                  // any merge or empty cell available
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
    if (!board[y][x]) return true;
    if (x < 3 && board[y][x] === board[y][x + 1]) return true;
    if (y < 3 && board[y][x] === board[y + 1][x]) return true;
  }
  return false;
}

// ---------- Tetris ---------- grid = rows(H) x cols(W) of 0|colorIndex. cells = [[dx,dy],...] relative offsets.
export function tetrisFits(grid, cells, x, y) {
  const H = grid.length, W = grid[0].length;
  for (const [dx, dy] of cells) {
    const cx = x + dx, cy = y + dy;
    if (cx < 0 || cx >= W || cy >= H) return false;
    if (cy >= 0 && grid[cy][cx]) return false;
  }
  return true;
}
export function tetrisClear(grid) {                   // remove full rows, return {grid, lines}
  const W = grid[0].length;
  const kept = grid.filter((row) => row.some((c) => !c));
  const lines = grid.length - kept.length;
  while (kept.length < grid.length) kept.unshift(Array(W).fill(0));
  return { grid: kept, lines };
}
export const TETROMINOES = {
  I: [[0, 1], [1, 1], [2, 1], [3, 1]], O: [[1, 0], [2, 0], [1, 1], [2, 1]],
  T: [[1, 0], [0, 1], [1, 1], [2, 1]], S: [[1, 0], [2, 0], [0, 1], [1, 1]],
  Z: [[0, 0], [1, 0], [1, 1], [2, 1]], J: [[0, 0], [0, 1], [1, 1], [2, 1]],
  L: [[2, 0], [0, 1], [1, 1], [2, 1]],
};
export function rotateCells(cells) {                  // rotate 90° CW around (1.5,1.5) box, snap to ints
  return cells.map(([x, y]) => [3 - y, x]);
}

