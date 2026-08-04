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

// ---------- Rating (Elo) ---------- pure; opponent rating exchanged at match start.
// outcome: 'win' | 'lose' | 'draw'. K=24, floor 100. No opp -> caller passes opp=cur.
export function nextRating(cur, opp, outcome) {
  const score = outcome === 'win' ? 1 : outcome === 'draw' ? 0.5 : 0;
  const expected = 1 / (1 + Math.pow(10, ((opp ?? cur) - cur) / 400));
  return Math.max(100, Math.round(cur + 24 * (score - expected)));
}

// ---------- Achievements ---------- pure: given a stats object, return earned ids.
// stats = { games: { [id]: {w,l,d,streak,bestStreak,rating} }, botWins:{easy,medium,hard}, cats:[...] }
export const ACHIEVEMENTS = [
  { id: 'first_win', emoji: '🥇', test: (d) => d.wins >= 1 },
  { id: 'wins_10', emoji: '🎯', test: (d) => d.wins >= 10 },
  { id: 'wins_25', emoji: '🏹', test: (d) => d.wins >= 25 },
  { id: 'wins_50', emoji: '👑', test: (d) => d.wins >= 50 },
  { id: 'wins_100', emoji: '🏆', test: (d) => d.wins >= 100 },
  { id: 'streak_5', emoji: '🔥', test: (d) => d.bestStreak >= 5 },
  { id: 'bot_hard', emoji: '🤖', test: (d) => d.hardBot >= 1 },
  { id: 'bot_master', emoji: '🦾', test: (d) => d.hardBot >= 10 },
  { id: 'explorer', emoji: '🧭', test: (d) => d.cats >= 6 },
  { id: 'plays_50', emoji: '🎮', test: (d) => d.plays >= 50 },
  { id: 'veteran', emoji: '🎖️', test: (d) => d.plays >= 100 },
  { id: 'plays_250', emoji: '🏅', test: (d) => d.plays >= 250 },
  { id: 'wins_250', emoji: '💠', test: (d) => d.wins >= 250 },
  { id: 'streak_10', emoji: '⚡', test: (d) => d.bestStreak >= 10 },
  { id: 'rated_1200', emoji: '⭐', test: (d) => d.maxRating >= 1200 },
  { id: 'rated_1400', emoji: '🌠', test: (d) => d.maxRating >= 1400 },
  { id: 'rated_1600', emoji: '🔱', test: (d) => d.maxRating >= 1600 },
  { id: 'level_10', emoji: '🌟', test: (d) => d.level >= 10 },
  { id: 'level_25', emoji: '💫', test: (d) => d.level >= 25 },
  { id: 'level_40', emoji: '🦅', test: (d) => d.level >= 40 },
  { id: 'streak_7d', emoji: '📅', test: (d) => d.streakDays >= 7 },
  { id: 'streak_14d', emoji: '🗓️', test: (d) => d.streakDays >= 14 },
  { id: 'games_10', emoji: '🕹️', test: (d) => d.distinctGames >= 10 },
  { id: 'games_20', emoji: '👾', test: (d) => d.distinctGames >= 20 },
  { id: 'favs_5', emoji: '⭐', test: (d) => d.favs >= 5 },
];
// extra (optional) = { level, streakDays, favs } from the loyalty/favorites layers; absent → those tests are false.
export function evalAchievements(stats, extra) {
  const g = Object.values((stats && stats.games) || {});
  const e = extra || {};
  const d = {
    wins: g.reduce((a, x) => a + (x.w || 0), 0),
    plays: g.reduce((a, x) => a + (x.w || 0) + (x.l || 0) + (x.d || 0), 0),
    distinctGames: g.filter((x) => (x.w || 0) + (x.l || 0) + (x.d || 0) > 0).length,
    bestStreak: g.reduce((a, x) => Math.max(a, x.bestStreak || 0), 0),
    maxRating: g.reduce((a, x) => Math.max(a, x.rating || 0), 0),
    hardBot: ((stats && stats.botWins) || {}).hard || 0,
    cats: ((stats && stats.cats) || []).length,
    level: e.level || 0, streakDays: e.streakDays || 0, favs: e.favs || 0,
  };
  return ACHIEVEMENTS.filter((a) => a.test(d)).map((a) => a.id);
}

// ---------- Loyalty rewards (pure) ----------
export function levelRewardCoins(level) { return 40 + level * 10; }        // coins granted on reaching a level
const DAILY = [25, 40, 60, 80, 100, 120, 200];                             // 7-day login cycle; day 7 also drops a chest
export function dailyReward(day) { const i = (Math.max(1, day) - 1) % 7; return { coins: DAILY[i], chest: i === 6 }; }

// deterministic per-day quest pick (stable for a given date, testable)
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function mulberry(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export const QUEST_POOL = [
  { id: 'play3', type: 'play', target: 3, coins: 40, xp: 20 },
  { id: 'play5', type: 'play', target: 5, coins: 70, xp: 35 },
  { id: 'win2', type: 'win', target: 2, coins: 60, xp: 30 },
  { id: 'win3', type: 'win', target: 3, coins: 90, xp: 45 },
  { id: 'streak2', type: 'winstreak', target: 2, coins: 70, xp: 35 },
  { id: 'bot1', type: 'beatbot', target: 1, coins: 50, xp: 25 },
  { id: 'online1', type: 'online', target: 1, coins: 60, xp: 30 },
  { id: 'winonline2', type: 'winonline', target: 2, coins: 90, xp: 45 },
  { id: 'newgame', type: 'trynew', target: 1, coins: 50, xp: 25 },
  { id: 'newgame2', type: 'variety', target: 2, coins: 80, xp: 40 },
  { id: 'coins150', type: 'earncoins', target: 150, coins: 50, xp: 25 },
];
export function pickDailyQuests(dateStr) {
  const rng = mulberry(hashStr('q' + dateStr));
  const pool = QUEST_POOL.slice();
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  const out = [], types = new Set();
  for (const q of pool) { if (types.has(q.type)) continue; types.add(q.type); out.push(Object.assign({}, q)); if (out.length === 3) break; }
  return out;
}
// ---------- Weekly challenge (pure) ---------- one bigger rotating goal, deterministic per ISO week.
export const WEEKLY_POOL = [
  { id: 'w_win10', type: 'win', target: 10, coins: 300, xp: 150 },
  { id: 'w_play20', type: 'play', target: 20, coins: 260, xp: 130 },
  { id: 'w_bot5', type: 'beatbot', target: 5, coins: 280, xp: 140 },
  { id: 'w_online5', type: 'online', target: 5, coins: 320, xp: 160 },
  { id: 'w_variety5', type: 'variety', target: 5, coins: 300, xp: 150 },
  { id: 'w_streak4', type: 'winstreak', target: 4, coins: 340, xp: 170 },
];
// isoWeekKey(date) -> "YYYY-Www" — Thursday-of-week ISO rule, stable within a calendar week.
export function isoWeekKey(d) {
  const dt = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = dt.getUTCDay() || 7;
  dt.setUTCDate(dt.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((dt - yearStart) / 86400000 + 1) / 7);
  return dt.getUTCFullYear() + '-W' + String(week).padStart(2, '0');
}
export function pickWeekly(weekKey) {
  const rng = mulberry(hashStr('w' + weekKey));
  return Object.assign({}, WEEKLY_POOL[Math.floor(rng() * WEEKLY_POOL.length)]);
}
// gift chest contents; rng() -> [0,1). Coins 120..390 (rounded to 10), 35% chance of a 2x booster.
export function chestRoll(rng) {
  const coins = Math.round((120 + Math.floor(rng() * 280)) / 10) * 10;
  return { coins, booster: rng() < 0.35 };
}

// ---------- Bot deciders for hard games (decent & fast: heuristic + shallow search) ----------
// Chess: negamax + alpha-beta over chessAllMoves/chessApply. easy=random, medium=depth2, hard=depth3.
const PIECE_VAL = { P: 1, N: 3, B: 3, R: 5, Q: 9, K: 0 };
function chessMaterial(state) { // + favours White
  let w = 0;
  for (const row of state.board) for (const p of row) { if (!p) continue; const v = PIECE_VAL[p.toUpperCase()] || 0; w += (p === p.toUpperCase() ? v : -v); }
  return w;
}
function chessNegamax(state, depth, alpha, beta) {
  const moves = chessAllMoves(state);
  if (!moves.length) return chessInCheck(state, state.turn) ? -100000 + (10 - depth) : 0;   // mate / stalemate
  if (depth === 0) { const w = chessMaterial(state); return state.turn === 'w' ? w : -w; }
  moves.sort((a, b) => (state.board[b.to[1]][b.to[0]] ? 1 : 0) - (state.board[a.to[1]][a.to[0]] ? 1 : 0)); // captures first
  let best = -Infinity;
  for (const m of moves) {
    const v = -chessNegamax(chessApply(state, m.from, m.to, 'Q'), depth - 1, -beta, -alpha);
    if (v > best) best = v;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}
export function chessBotMove(state, level) {
  const moves = chessAllMoves(state);
  if (!moves.length) return null;
  const promoOf = (m) => { const p = state.board[m.from[1]][m.from[0]]; return (p && p.toUpperCase() === 'P' && (m.to[1] === 0 || m.to[1] === 7)) ? 'Q' : null; };
  if (level === 'easy') { const m = moves[Math.floor(Math.random() * moves.length)]; return { type: 'move', from: m.from, to: m.to, promo: promoOf(m) }; }
  const depth = level === 'hard' ? 3 : 2;
  moves.sort((a, b) => (state.board[b.to[1]][b.to[0]] ? 1 : 0) - (state.board[a.to[1]][a.to[0]] ? 1 : 0));
  let best = moves[0], bestV = -Infinity;
  for (const m of moves) {
    const v = -chessNegamax(chessApply(state, m.from, m.to, 'Q'), depth - 1, -Infinity, Infinity);
    if (v > bestV) { bestV = v; best = m; }
  }
  return { type: 'move', from: best.from, to: best.to, promo: promoOf(best) };
}

// Go: heuristic — capture > contact > avoid filling own eyes; passes only if no legal point.
export function goBotMove(board, color, level, forbiddenSer) {
  const N = board.length, ser = (b) => b.map((r) => r.map((c) => c || '.').join('')).join('');
  const nbrs = (x, y) => { const r = []; if (x > 0) r.push([x - 1, y]); if (x < N - 1) r.push([x + 1, y]); if (y > 0) r.push([x, y - 1]); if (y < N - 1) r.push([x, y + 1]); return r; };
  const legal = [];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (board[y][x]) continue;
    const res = goPlace(board, x, y, color); if (!res) continue;
    if (forbiddenSer && ser(res.board) === forbiddenSer) continue;
    legal.push({ x, y, captured: res.captured });
  }
  if (!legal.length) return { type: 'pass' };
  if (level === 'easy') { const m = legal[Math.floor(Math.random() * legal.length)]; return { type: 'move', x: m.x, y: m.y }; }
  let best = legal[0], bestSc = -1e9;
  for (const m of legal) {
    const nb = nbrs(m.x, m.y);
    let sc = m.captured * 20;
    if (nb.every(([nx, ny]) => board[ny][nx] === color) && !m.captured) sc -= 50;   // don't fill own eye
    sc += nb.filter(([nx, ny]) => board[ny][nx]).length * 2;                          // contact
    sc -= (Math.abs(m.x - (N - 1) / 2) + Math.abs(m.y - (N - 1) / 2)) * 0.2;          // slight center pull
    sc += Math.random() * 2;
    if (sc > bestSc) { bestSc = sc; best = m; }
  }
  return { type: 'move', x: best.x, y: best.y };
}

// Hex: play the empty cell minimizing our 0-1 connection distance (and blocking theirs).
export function hexBotMove(board, color, level) {
  const N = board.length, opp = color === 'r' ? 'b' : 'r';
  const empties = [];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (!board[y][x]) empties.push([x, y]);
  if (!empties.length) return null;
  if (level === 'easy') { const [x, y] = empties[Math.floor(Math.random() * empties.length)]; return { type: 'move', x, y }; }
  const dist = (b, who) => {
    const other = who === 'r' ? 'b' : 'r', INF = 1e9;
    const d = Array.from({ length: N }, () => Array(N).fill(INF)), dq = [];
    const nb = (x, y) => [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1], [x + 1, y - 1], [x - 1, y + 1]].filter(([a, c]) => a >= 0 && a < N && c >= 0 && c < N);
    const push = (x, y, v, front) => { if (v < d[y][x]) { d[y][x] = v; front ? dq.unshift([x, y]) : dq.push([x, y]); } };
    for (let i = 0; i < N; i++) { const x = who === 'r' ? i : 0, y = who === 'r' ? 0 : i; if (b[y][x] === other) continue; push(x, y, b[y][x] === who ? 0 : 1, b[y][x] === who); }
    while (dq.length) { const [x, y] = dq.shift(), base = d[y][x]; for (const [nx, ny] of nb(x, y)) { if (b[ny][nx] === other) continue; const w = b[ny][nx] === who ? 0 : 1; push(nx, ny, base + w, w === 0); } }
    let best = INF; for (let i = 0; i < N; i++) { const x = who === 'r' ? i : N - 1, y = who === 'r' ? N - 1 : i; if (b[y][x] !== other) best = Math.min(best, d[y][x]); }
    return best;
  };
  let best = empties[0], bestSc = -1e9;
  for (const [x, y] of empties) {
    board[y][x] = color; const myD = dist(board, color); board[y][x] = opp; const opD = dist(board, opp); board[y][x] = null;
    const sc = -myD * 10 + opD * 3 + Math.random();
    if (sc > bestSc) { bestSc = sc; best = [x, y]; }
  }
  return { type: 'move', x: best[0], y: best[1] };
}

// ---------- Sim (avoid the mono-colour triangle) ---------- edges keyed "a-b" (a<b) -> 'A'|'B'.
export const SIM_EDGES = (() => { const e = []; for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) e.push([i, j]); return e; })();
export const SIM_TRIS = (() => { const t = []; for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) for (let k = j + 1; k < 6; k++) t.push([i, j, k]); return t; })();
export const simKey = (a, b) => (a < b ? a + '-' + b : b + '-' + a);
export function simLoser(edges) {   // whoever completes a same-colour triangle loses
  for (const [i, j, k] of SIM_TRIS) { const c = edges[simKey(i, j)]; if (c && edges[simKey(i, k)] === c && edges[simKey(j, k)] === c) return c; }
  return null;
}

// ---------- Quarto ---------- 16 pieces = 4 attribute bits (0..15). board = array(16) of piece|null.
const QLINES = [[0, 1, 2, 3], [4, 5, 6, 7], [8, 9, 10, 11], [12, 13, 14, 15], [0, 4, 8, 12], [1, 5, 9, 13], [2, 6, 10, 14], [3, 7, 11, 15], [0, 5, 10, 15], [3, 6, 9, 12]];
export const QUARTO_LINES = QLINES;
export function quartoWinner(board) {   // true if any line of 4 shares an attribute bit
  for (const line of QLINES) {
    if (line.some((i) => board[i] == null)) continue;
    let and = 15, or = 0;
    for (const i of line) { and &= board[i]; or |= board[i]; }
    if (and !== 0 || or !== 15) return true;   // all share a 1-bit (and) or all share a 0-bit (or has a 0)
  }
  return false;
}

// ---------- Farkle ---------- score a set of dice (best selection); returns {score, scoring:[dice], counts}.
export function farkleScore(dice) {
  const c = [0, 0, 0, 0, 0, 0, 0]; for (const d of dice) c[d]++;
  let score = 0; const used = [0, 0, 0, 0, 0, 0, 0];
  if ([1, 2, 3, 4, 5, 6].every((n) => c[n] === 1)) return { score: 1500, scoring: [1, 2, 3, 4, 5, 6], all: true };  // straight
  let pairs = 0; for (let n = 1; n <= 6; n++) if (c[n] === 2) pairs++;
  if (pairs === 3) return { score: 1500, scoring: dice.slice(), all: true };                                       // three pairs
  for (let n = 1; n <= 6; n++) {
    if (c[n] >= 3) { let base = n === 1 ? 1000 : n * 100; base *= (1 << (c[n] - 3)); score += base; used[n] = c[n]; }
  }
  for (let n = 1; n <= 6; n++) if (c[n] < 3) { if (n === 1) { score += c[n] * 100; used[1] = c[n]; } else if (n === 5) { score += c[n] * 50; used[5] = c[n]; } }
  const scoring = []; for (let n = 1; n <= 6; n++) for (let k = 0; k < used[n]; k++) scoring.push(n);
  return { score, scoring, all: scoring.length === dice.length && dice.length > 0 };
}

// ---------- Wordle ---------- feedback for a guess vs answer: 'g' hit, 'y' present, 'b' absent.
export function wordleScore(guess, answer) {
  const n = guess.length, res = Array(n).fill('b'), rest = {};
  for (let i = 0; i < n; i++) { if (guess[i] === answer[i]) res[i] = 'g'; else rest[answer[i]] = (rest[answer[i]] || 0) + 1; }
  for (let i = 0; i < n; i++) { if (res[i] === 'g') continue; const ch = guess[i]; if (rest[ch] > 0) { res[i] = 'y'; rest[ch]--; } }
  return res.join('');
}
export const WORDLE_WORDS = ['APPLE', 'BRAVE', 'CRANE', 'DELTA', 'EAGLE', 'FLAME', 'GRAPE', 'HOUSE', 'IVORY', 'JOLLY', 'KNEEL', 'LEMON', 'MANGO', 'NIGHT', 'OCEAN', 'PIANO', 'QUERY', 'RIVER', 'STONE', 'TIGER', 'UNITY', 'VIVID', 'WHALE', 'YACHT', 'ZEBRA', 'PLANT', 'CHAIR', 'BREAD', 'CLOUD', 'DREAM', 'FROST', 'GLOVE', 'HONEY', 'LIGHT', 'MUSIC', 'PEARL', 'ROBOT', 'SUGAR', 'TRAIN', 'WATER'];
// Filter candidates consistent with all (guess,feedback) history — for a constraint bot.
export function wordleConsistent(words, history) {
  return words.filter((w) => history.every((h) => wordleScore(h.guess, w) === h.fb));
}

// Backgammon: greedily consume the rolled dice on a cloned state (off > hit > stack > progress).
export function bgBotMoves(state, color, dice, level) {
  const st = { points: state.points.slice(), bar: { ...state.bar }, off: { ...state.off } };
  const s = color === 'w' ? 1 : -1, pool = dice.slice(), seq = [];
  const pick = () => {
    const cands = [];
    for (const d of new Set(pool)) for (const m of bgLegalMoves(st, d, color)) cands.push(Object.assign({ die: d }, m));
    if (!cands.length) return null;
    if (level === 'easy') return cands[Math.floor(Math.random() * cands.length)];
    let best = cands[0], bs = -1e9;
    for (const c of cands) {
      let sc = Math.random();
      if (c.to === 'off') sc += 50;
      else { const cur = st.points[c.to]; if (cur * s === -1) sc += 30; if (cur * s >= 1) sc += 6; }
      if (c.from === 'bar') sc += 8; else if (c.to !== 'off') sc += (color === 'w' ? (c.from - c.to) : (c.to - c.from));
      if (sc > bs) { bs = sc; best = c; }
    }
    return best;
  };
  let guard = 0;
  while (pool.length && guard++ < 12) {
    const m = pick(); if (!m) break;
    const ns = bgApply(st, m.from, m.to, color); st.points = ns.points; st.bar = ns.bar; st.off = ns.off;
    pool.splice(pool.indexOf(m.die), 1);
    seq.push({ from: m.from, to: m.to, die: m.die });
    if (bgWon(st, color)) break;
  }
  return seq;
}

// ---------- Loyalty: XP → Levels → Tiers (pure, unit-tested) ----------
// XP to advance level L -> L+1 = 100 + (L-1)*40. Cumulative via loop (levels stay small).
export function levelForXp(xp) {
  xp = Math.max(0, xp || 0);
  let level = 1, floorXp = 0, need = 100;
  while (xp >= floorXp + need) { floorXp += need; level++; need = 100 + (level - 1) * 40; }
  return { level, into: xp - floorXp, need, floorXp };
}
export const TIERS = [
  { key: 'bronze', name: 'Bronze', emoji: '🥉', min: 1 },
  { key: 'silver', name: 'Silver', emoji: '🥈', min: 5 },
  { key: 'gold', name: 'Gold', emoji: '🥇', min: 10 },
  { key: 'platinum', name: 'Platinum', emoji: '💠', min: 15 },
  { key: 'diamond', name: 'Diamond', emoji: '💎', min: 25 },
  { key: 'legend', name: 'Legend', emoji: '👑', min: 40 },
];
export function tierForLevel(level) {
  let t = TIERS[0];
  for (const x of TIERS) if (level >= x.min) t = x;
  return t;
}
// XP + coins awarded for one finished match. outcome: 'win'|'lose'|'draw'; streak = current win streak.
export function xpCoinsForResult(outcome, streak) {
  let xp = 10, coins = 5;                                   // finishing a match
  if (outcome === 'win') { xp += 20; coins += 15; const b = Math.min(streak || 0, 10); xp += b * 3; coins += b * 2; }
  else if (outcome === 'draw') { xp += 8; coins += 5; }
  return { xp, coins };
}

// ---------- Mastermind (colour-code duel) ---------- codes are strings of colour-digits '0'..'k-1'.
// Feedback reuses evaluate(): exact = right colour+slot, partial = right colour wrong slot. Repeats allowed.
export function mastermindCodes(colors, len) {
  let out = [''];
  for (let i = 0; i < len; i++) { const nx = []; for (const c of out) for (let k = 0; k < colors; k++) nx.push(c + k); out = nx; }
  return out;                                              // colors^len code strings
}
export function mastermindConsistent(codes, history) {    // history: [{guess, exact, partial}]
  return codes.filter((code) => history.every((h) => {
    const r = evaluate(code, h.guess); return r.exact === h.exact && r.partial === h.partial;
  }));
}

// ---------- Dominoes ---------- double-six set, hidden hands, match an open end of the line.
export function dominoDeck() { const d = []; for (let i = 0; i <= 6; i++) for (let j = i; j <= 6; j++) d.push([i, j]); return d; } // 28 tiles
export function dominoPips(hand) { return hand.reduce((a, t) => a + t[0] + t[1], 0); }
export function dominoPlayable(tile, ends) {              // ends = [left, right] pip values, or null for the empty line
  if (ends == null) return true;
  return tile[0] === ends[0] || tile[1] === ends[0] || tile[0] === ends[1] || tile[1] === ends[1];
}
export function dominoCanPlay(hand, ends) { return hand.some((t) => dominoPlayable(t, ends)); }

// ---------- Word Race ---------- shared letter rack; build valid words from the available letters.
export const WORD_LIST = ('able ache acid acorn acre actor adept adobe adore agent aged agile aisle alarm album alert alien alike alive alley aloe aloft aloud amber amble amend ample angel anger angle ankle apple april apron arena argue arise armor aroma array arrow ashen aside asset atlas atom audio audit avert await awake award aware badge baker bacon basil basin batch bathe beach beacon beam bean bear beast began begin being belt bench berry blade blame blank blast blaze bleak blend bless blimp blink bliss block bloom blown blues bluff blunt board boast bonus booth boots bored brace brain brake brand brave bread break breed brick bride brief bring broad broke brook broom broth brown brush bugle build built bunch bunk cabin cable cadet camel candy canoe cargo carol carve catch cause cedar chair chalk champ chant charm chart chase cheap cheek cheer chess chest chief child chill china choir chord chore chose chunk cider cigar civic civil claim clamp clang clash clasp class clean clear clerk click cliff climb cling cloak clock clone close cloth cloud clove clown club coach coast cobra cocoa comet comic coral cord corn couch cough could count court cover crack craft cramp crane crash crate crave crawl crazy cream creek creep crept crest crime crisp crop cross crowd crown crumb crush crust cube cubic curl curve cyber cycle daily dairy daisy dance dandy dark dart dawn dealt debit debris decay decal decoy delay delta dense depot depth desk devil diary diner dingo dinner dirt disco ditch diver dizzy dodge donor donut doubt dough dozen draft drain drama drank drape drawn dread dream dress dried drift drill drink drive droll drone drove drown dryer eagle early earth easel eaten ebony edge eerie eight elbow elder elect elite elope email ember empty ended enemy enjoy enter entry equal erase error essay ethic evade even event every evict evoke exact exalt exile exist extra fable faced facet faint fairy faith false fancy farm fatal favor feast fetch fever fiber field fiend fiery fight final finch fjord flag flair flake flame flank flare flash flask fleet flesh flick fling flint flirt float flock flood floor flora flour flown fluid flung flush flute foam foamy focal focus foggy foray force forge forgo forth forum found frail frame frank fraud freed fresh fried frill frisk frock frog frost frown fruit fudge funny gable gains gamer gap garage garden gauge gavel gaze gear geese genre ghost giant gift ginger girl given giver glade gland glare glass gleam glide glint gloat globe gloom glory gloss glove glow glue gnome goal goat golden goose gorge gouge grace grade grain grand grant grape graph grasp grass grate grave gravy graze great greed green greet grid grief grill grim grime grind groan groom grope gross group grove growl grown gruff guard guess guest guide guild guilt gulf gully guru gust habit hairy halt handy happy hardy harm haste hatch haven hazel heart heavy hedge helm herb hero hinge hippo hobby honey honor horse hotel hound house hover human humid humor hurry husky hyena ideal idiom idler igloo image imply inbox incur index inept infer inlet inner input irate irony issue item ivory ivy jam jazz jelly jetty jewel joint joker jolly judge juice juicy jumbo jump juror keel keen kernel kick kind king kiosk kite kitten knack kneel knelt knife knock knoll known koala label labor laden lodge lagoon lake lance lapse large laser latch later laud laugh layer leaf leap learn lease leash least ledge legal lemon lemur level lever light lilac limbo lime linen lingo liter lively llama loaf loan lobby local lodge lofty logic loop loose loser lotus lousy loved lover lower loyal lucid lucky lunar lunch lung lush lute lymph lyric macro madam magic magma major maker mango maple march marsh mason match maze meadow medal media melon mercy merge merit metal meter micro midst might mild mimic mince miner minor mint mirth mixer mocha model moist molar mold money month moody moral morph mossy motel motor mound mount mourn mouse mouth mover movie muddy mulch mummy mural music musky mute myth nacho nadir naive naked nasal navy neat needy neigh nerve never newer newly niche niece night noble noise noisy nomad noose north notch novel nudge nurse nylon oasis ocean octet odds offer often olive omega onion onset opal open opera orbit organ ounce ovary owner ozone paint panda panic pansy pants paper parade party pasta patch path patio pause peace peach pearl pedal peer penny perch peril petal phase phone photo piano picky piece piety pilot pinch pine pique pitch pivot pixel pizza place plaid plain plane plank plant plate plaza plead plot pluck plumb plume plump plush poach poem point poise poker polar polish pond pony porch pose pouch pound power prank preen press price pride prime print prior prism prize probe prone proof prose proud prowl pulse punch pupil puppy purse quack quail quake qualm quart queen query quest queue quick quiet quill quilt quirk quota quote rabbit radar radio raft rage rail rally ranch range rapid raven razor reach react ready realm rebel recap relax relay relic remit repay reply resin rhino rider ridge rifle rigid rinse ripe risk rival river roach roast robe robin robot rocky rodeo rogue roman roost rose rough round route rover royal ruby rugby ruler rumor rural rusty saber sadly saint salad salon salsa salty sandy sauce sauna savor scale scalp scan scare scarf scene scent scoff scold scone scoop scope score scorn scout scrap scrub seal seam sedan seed sepia serum seven sever shack shade shady shaft shake shale shame shape share shark sharp shave shawl shear sheep sheet shelf shell shine shiny shirt shoal shock shone shore short shout shown shrub shrug shush siege sight silky silly silo since sinew siren sixth sixty sized skate skiff skill skirt skull skunk slack slain slant slate sleek sleep sleet slice slick slide slime sling slope sloth slump smack small smart smash smear smell smile smirk smith smoke smoky snack snail snake snare sneak sniff snore snout snowy snug soap sober solar solid solo solve sonar sonic sorry sound south space spade spare spark spawn speak spear speck spell spend spent spice spicy spike spill spine spiral spire spite splat split spoil spoke spoon sport spout spray spree sprig spur squad squat squid stack staff stage stain stair stake stale stalk stall stamp stand star stare start stash state stave steak steal steam steed steel steep steer stem step stern stick stiff still sting stint stir stock stoic stole stomp stone stool stoop store stork storm story stout stove strap straw stray strip stub study stuff stump stung stunt style sugar suit sulky sunny super surge sushi swamp swan swarm swear sweat sweep sweet swell swept swift swim swine swing swirl sword table taco taffy tale talon tango taper tapir tardy tarot taste taunt tawny teach teal tease teeth tempo tenor tense tepid thank theft their theme there thick thief thigh thing think third thorn those three threw throb throw thumb thyme tidal tiger tight tile timer tipsy toad toast today token tonic tooth topaz topic torch total totem touch tough tower toxic trace track trade trail train tram trap trawl tread treat trend trial tribe trick tried trim tromp troop trout truce truck truly trump trunk trust truth tsunami tuba tulip tumor tunic turbo tutor twang tweak tweed tweet twine twirl twist ultra uncle under undo union unit unite unity untie upper upset urban urge usage used user usher usual utter vague valet valid valor value valve vapor vault vegan venue verge verse vex vial vibe video vigor villa vinyl viola viper viral virus visit vista vivid vocal vodka vogue voice void volt vote vouch vowel wafer wager wagon waist waltz warm wary waste watch water wave weary weave wedge weird whale wharf wheat wheel whelp where which while whim whine whirl whisk white whole whoop widow width wield wince winch windy wine wing wink wiry wise wisp witty woke wolf woman wonky wood woozy word world worm worn worry worse worst worth wound woven wrap wrath wreck wrist write wrong yacht yard yarn yeast yield yodel yoga yogurt yoke young youth zebra zero zesty zippy zone zonal ' +
'absorb accept accord acquire action actual advice advise almond ancient animal answer artist assist attach attend author autumn avenue backup badger ballot bamboo banana banner barrel basket battle beacon beaten beauty become belong beside better beware beyond bishop bitter blanket bottle bounce bracket branch breath breeze bridge bright broken bronze bubble bucket budget buffet builder bullet burden bureau butter cactus camera cancel candle canvas canyon carbon careful carpet carrot casino castle casual cattle cavern census cereal chance change chapel charge cheese cherry circle citrus clever climate clothes cluster coffee collar combat comedy corner cosmic cottage cotton county couple crayon create credit crimson crispy crowd crystal cuckoo curious current cursor custom damage danger dazzle debate decade decide defeat defend degree deluxe demand depend desert design desire detail detect device digital dinner direct divide doctor dollar domain double dragon effort emerald empire enable energy engine escape estate exceed except excite expand expect expert export fabric falcon fasten father feather fellow female figure filter finger flavor flower folder follow forest forget formal fortune fossil foster fought fringe frozen future gadget galaxy gallon garden garlic garnet gather gentle glacier golden gossip govern granite gravity ground guitar hammer hamster handle harbor hazard helmet hidden hollow honest hunter hurdle icicle impact import income indoor infant inform injure insect inside intent invest invite island jacket jaguar jungle junior kettle kidney kindle kingdom kitchen kitten ladder lagoon laptop lantern lattice laundry lawyer leader league leather legend lesson letter lettuce liquid listen litter lizard locket lonely lounge lumber luxury magnet mallow mammal manage mango marble margin marker market matter meadow meaning medium melody memory mentor method middle minute mirror mixture mobile modest moment monkey mosaic mother motion muffin museum musket mustard mutual napkin narrow native nature nectar needle nephew nickel noodle notice nugget number object oblige occupy office online orange orchard orchid outer output oxygen packet paddle palace pallet parcel pardon parent parlor parrot pastel pastry patrol pattern peanut pebble pelican pencil pepper period permit person phrase pickle pigeon pillow pistol planet plaster plastic player plenty plumber pocket poetry poison police pollen ponder poplar portal potato pottery powder praise prefer pretty prince prison profit prompt proper public pucker pumpkin punish puppet purple pursue puzzle quaint quarry quiver rabbit racket radish rally ranger rather ration reason recall recent record reduce reflect refuse regard region regret relate relief remain remind remote render repair repeat report rescue resist resort result reveal review reward ribbon riddle rocket rookie roster rubber ruffle rumble runner rustic saddle safari salmon sample sandal satin savage scarce scheme scholar scrape script sculpt season second secret sector secure select senate senior sensor serene series settle shadow shatter shelter shield shiver shrine shrink signal silver simple sister sketch skewer slalom sliver slogan smooth soccer socket sodium solemn sonnet source sparkle sphere spider spiral splash sponge spread sprint sprout squash squeeze stable stadium stapler statue steady stellar stereo stigma stitch strain streak stream street stride strike string stripe stroke strong studio submit subtle suburb subway summer summit sundae sunset supply survey suspect swivel symbol system tablet tackle talent tandem tangle target tassel temple tenant tender tennis theory thread thrive throne throng ticket timber timing tinker tissue toffee tongue topple torch tornado toward toxin trader traffic tragic transit travel treaty tremble trend tribute trigger trophy trouble trumpet tunnel turkey turnip turtle twelve typical unfold unique unlock unpack update uphold upload urgent utmost vacuum valley vanish vector velvet vendor verbal versus vessel victor virtue vision visual volume voyage wallet walnut wander warden warmth warren weapon weasel weather weekly welcome wharf whisper willow window winner winter wisdom wizard wonder wooden worker writer yellow yonder zephyr zigzag zinger zodiac zombie').split(' ');
const WORD_SET = new Set(WORD_LIST);
export function isWord(w) { return WORD_SET.has((w || '').toLowerCase()); }
export function canBuild(word, rack) {                    // rack = array of lowercase letters
  const have = {}; for (const c of rack) have[c] = (have[c] || 0) + 1;
  for (const c of (word || '').toLowerCase()) { if (!have[c]) return false; have[c]--; }
  return true;
}
export function wordScore(word) {                         // by length: 3→1, 4→2, 5→4, 6→6, 7+→len*2
  const n = (word || '').length;
  return n < 3 ? 0 : n === 3 ? 1 : n === 4 ? 2 : n === 5 ? 4 : n === 6 ? 6 : n * 2;
}
// Rack seeds: 6–8 letter words whose scrambled letters make a playable rack. rng()->[0,1).
export const RACK_SEEDS = WORD_LIST.filter((w) => w.length >= 6 && w.length <= 8);
export function makeRack(rng) {
  const seed = RACK_SEEDS[Math.floor(rng() * RACK_SEEDS.length)];
  const letters = seed.split('');
  for (let i = letters.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [letters[i], letters[j]] = [letters[j], letters[i]]; }
  return letters;                                         // array of lowercase letters
}

// ---------- Match-3 ---------- board[y][x] = colour int (0..k-1) or null. Find runs of ≥3.
export function match3Find(board) {
  const h = board.length, w = board[0].length, hit = new Set();
  for (let y = 0; y < h; y++) for (let x = 0; x < w - 2; x++) {
    const v = board[y][x]; if (v == null) continue;
    if (board[y][x + 1] === v && board[y][x + 2] === v) { let k = x; while (k < w && board[y][k] === v) hit.add(y + ',' + k++); }
  }
  for (let x = 0; x < w; x++) for (let y = 0; y < h - 2; y++) {
    const v = board[y][x]; if (v == null) continue;
    if (board[y + 1][x] === v && board[y + 2][x] === v) { let k = y; while (k < h && board[k][x] === v) hit.add((k++) + ',' + x); }
  }
  return hit;
}
// Drop non-null cells down each column, refill the emptied tops with refill() (a colour int).
export function match3Gravity(board, refill) {
  const h = board.length, w = board[0].length;
  for (let x = 0; x < w; x++) {
    const col = []; for (let y = h - 1; y >= 0; y--) if (board[y][x] != null) col.push(board[y][x]);
    for (let y = h - 1; y >= 0; y--) board[y][x] = col[h - 1 - y] != null ? col[h - 1 - y] : refill();
  }
  return board;
}

