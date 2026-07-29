// Self-check for pure rules. Run: node test.mjs
import assert from 'assert';
import { evaluate, ticTacToeWinner, connectFourWinner } from './js/logic.js';

// ---- evaluate (Bulls & Cows) ----
const evalCases = [
  ['1234', '1234', { exact: 4, partial: 0 }],
  ['1234', '4321', { exact: 0, partial: 4 }],
  ['1234', '5678', { exact: 0, partial: 0 }],
  ['1234', '1243', { exact: 2, partial: 2 }],
  ['1122', '2211', { exact: 0, partial: 4 }],
  ['1122', '1111', { exact: 2, partial: 0 }],
  ['1112', '1211', { exact: 2, partial: 2 }],
  ['051', '510', { exact: 0, partial: 3 }],
];
for (const [s, g, want] of evalCases) {
  assert.deepStrictEqual(evaluate(s, g), want, `evaluate(${s},${g})`);
}
assert.throws(() => evaluate('12', '123'), /length mismatch/);

// ---- ticTacToeWinner ----
const _ = null;
assert.strictEqual(ticTacToeWinner(['X','X','X',_,_,_,_,_,_]), 'X', 'ttt row');
assert.strictEqual(ticTacToeWinner(['O',_,_,'O',_,_,'O',_,_]), 'O', 'ttt col');
assert.strictEqual(ticTacToeWinner(['X',_,_,_,'X',_,_,_,'X']), 'X', 'ttt diag');
assert.strictEqual(ticTacToeWinner([_,_,'O',_,'O',_,'O',_,_]), 'O', 'ttt anti-diag');
assert.strictEqual(ticTacToeWinner(['X','O','X','X','O','O','O','X','X']), 'draw', 'ttt draw');
assert.strictEqual(ticTacToeWinner(['X','O',_,_,_,_,_,_,_]), null, 'ttt ongoing');

// ---- connectFourWinner ---- (grid = 7 columns, each an array filled bottom-up)
function emptyC4() { return Array.from({ length: 7 }, () => []); }
function drop(grid, col, player) { grid[col].push(player); return grid[col].length - 1; }

let g = emptyC4();
let r;
for (let c = 0; c < 4; c++) r = drop(g, c, 'R');          // R,R,R,R across row 0
assert.strictEqual(connectFourWinner(g, 3, r), 'R', 'c4 horizontal');

g = emptyC4();
for (let i = 0; i < 4; i++) r = drop(g, 2, 'Y');          // 4 stacked in col 2
assert.strictEqual(connectFourWinner(g, 2, r), 'Y', 'c4 vertical');

g = emptyC4();                                             // ascending diagonal
drop(g, 0, 'R');
drop(g, 1, 'Y'); r = drop(g, 1, 'R');
drop(g, 2, 'Y'); drop(g, 2, 'Y'); r = drop(g, 2, 'R');
drop(g, 3, 'Y'); drop(g, 3, 'Y'); drop(g, 3, 'Y'); r = drop(g, 3, 'R');
assert.strictEqual(connectFourWinner(g, 3, r), 'R', 'c4 diagonal /');

g = emptyC4();                                             // descending diagonal \
drop(g, 3, 'R');
drop(g, 2, 'Y'); r = drop(g, 2, 'R');
drop(g, 1, 'Y'); drop(g, 1, 'Y'); r = drop(g, 1, 'R');
drop(g, 0, 'Y'); drop(g, 0, 'Y'); drop(g, 0, 'Y'); r = drop(g, 0, 'R');
assert.strictEqual(connectFourWinner(g, 0, r), 'R', 'c4 diagonal \\');

g = emptyC4();
r = drop(g, 0, 'R'); drop(g, 1, 'Y');
assert.strictEqual(connectFourWinner(g, 0, r), null, 'c4 no win');

console.log(`PASS (evaluate: ${evalCases.length}, ttt: 6, c4: 5)`);
