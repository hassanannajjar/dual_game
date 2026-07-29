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

