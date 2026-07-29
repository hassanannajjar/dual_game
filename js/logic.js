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
