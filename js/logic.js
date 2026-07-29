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
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
  [0, 4, 8], [2, 4, 6],            // diagonals
];
export function ticTacToeWinner(cells) {
  for (const [a, b, c] of TTT_LINES) {
    if (cells[a] && cells[a] === cells[b] && cells[a] === cells[c]) return cells[a];
  }
  return cells.every(Boolean) ? 'draw' : null;
}

// Connect Four: grid = cols array (7) of column arrays filled bottom-up with 'R'|'Y'.
// Checks 4-in-a-row through the last disc dropped at (col, row). Returns 'R'|'Y'|null.
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
