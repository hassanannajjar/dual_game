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

// ---- Gomoku (lineWinner) ----
import { lineWinner, reversiFlips, reversiLegalMoves, checkerMoves, boxClosed,
  ultimateWinner, mancalaSow, mancalaEnded, mancalaFinalize, morrisMillsAt } from './js/logic.js';
function grid2d(h, w) { return Array.from({ length: h }, () => Array(w).fill(null)); }
let gg = grid2d(13, 13);
for (let i = 0; i < 5; i++) gg[6][3 + i] = 'B';
assert.strictEqual(lineWinner(gg, 5, 6, 5), 'B', 'gomoku horizontal 5');
assert.strictEqual(lineWinner(grid2d(13, 13), 0, 0, 5), null, 'gomoku empty');
gg = grid2d(13, 13);
for (let i = 0; i < 4; i++) gg[2 + i][2 + i] = 'W';
assert.strictEqual(lineWinner(gg, 4, 4, 5), null, 'gomoku only 4');

// ---- Reversi ----
function rboard() {
  const b = grid2d(8, 8);
  b[3][3] = 'W'; b[3][4] = 'B'; b[4][3] = 'B'; b[4][4] = 'W';
  return b;
}
let rb = rboard();
assert.deepStrictEqual(reversiFlips(rb, 3, 2, 'B').sort(), [[3, 3]].sort(), 'reversi flips one');
assert.strictEqual(reversiFlips(rb, 0, 0, 'B').length, 0, 'reversi illegal = no flips');
assert.strictEqual(reversiLegalMoves(rb, 'B').length, 4, 'reversi 4 opening moves');

// ---- Checkers ----
let cb = grid2d(8, 8);
cb[2][2] = 'r'; cb[3][3] = 'b';
assert.deepStrictEqual(checkerMoves(cb, 2, 2).jumps.map((j) => j.to), [[4, 4]], 'checkers jump available');
cb = grid2d(8, 8); cb[5][5] = 'R'; // king moves all 4 diagonals
assert.strictEqual(checkerMoves(cb, 5, 5).steps.length, 4, 'checkers king 4 steps');

// ---- Dots & Boxes ----
const D = 3; // 3x3 dots -> 2x2 boxes
const H = Array.from({ length: D }, () => Array(D - 1).fill(false));
const V = Array.from({ length: D - 1 }, () => Array(D).fill(false));
H[0][0] = H[1][0] = V[0][0] = true;
assert.strictEqual(boxClosed(H, V, 0, 0), false, 'box not yet closed');
V[0][1] = true;
assert.strictEqual(boxClosed(H, V, 0, 0), true, 'box closed by 4th edge');

// ---- Ultimate TTT ----
assert.strictEqual(ultimateWinner(['X', 'X', 'X', null, 'O', null, 'O', null, null]), 'X', 'uttt macro row');
assert.strictEqual(ultimateWinner(['X', 'draw', null, null, null, null, null, null, null]), null, 'uttt no macro win');

// ---- Mancala ----
let mb = Array(14).fill(4); mb[6] = 0; mb[13] = 0;
let res = mancalaSow(mb, 2);              // 4 seeds from pit 2 -> pits 3,4,5,store6
assert.strictEqual(res.extraTurn, true, 'mancala last seed in store = extra turn');
assert.strictEqual(res.board[6], 1, 'mancala store got a seed');
mb = Array(14).fill(0); mb[0] = 1; mb[6] = 0; mb[13] = 0; mb[12] = 5; // capture: land in empty own pit 1, opposite 11? use mapping
mb = Array(14).fill(0); mb[2] = 1; mb[3] = 0; mb[9] = 3;              // pit2 -> lands pit3 (empty, mine), opposite 12-3=9 has 3
res = mancalaSow(mb, 2);
assert.strictEqual(res.captured, 4, 'mancala capture = opposite(3) + own(1)');
assert.strictEqual(mancalaEnded(Array(14).fill(0)), true, 'mancala ended when side empty');
assert.strictEqual(mancalaFinalize([1, 1, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0])[6], 2, 'mancala sweep to store');

// ---- Nine Men's Morris ----
let nb = Array(24).fill(null); nb[0] = nb[1] = nb[2] = 'A';
assert.strictEqual(morrisMillsAt(nb, 1).length, 1, 'morris mill formed');
nb[2] = 'B';
assert.strictEqual(morrisMillsAt(nb, 1).length, 0, 'morris broken mill');

// ---- Chess ----
import { chessInitial, chessLegalMoves, chessApply, chessStatus, chessInCheck, yahtzeeScore, goPlace, goScore, nimEmpty } from './js/logic.js';
let cs = chessInitial();
assert.strictEqual(chessLegalMoves(cs, [4, 6]).length, 2, 'chess e-pawn has 2 moves');   // white e2 pawn
assert.strictEqual(chessStatus(cs), 'normal', 'chess start normal');
// back-rank style mate: black Kh8, white Qg7 protected by Kf6, black to move
const mateB = Array.from({ length: 8 }, () => Array(8).fill(null));
mateB[0][7] = 'k'; mateB[1][6] = 'Q'; mateB[2][5] = 'K';
const mate = { board: mateB, turn: 'b', castling: { wk: false, wq: false, bk: false, bq: false }, ep: null };
assert.strictEqual(chessInCheck(mate, 'b'), true, 'chess black in check');
assert.strictEqual(chessStatus(mate), 'checkmate', 'chess checkmate');
// castling: clear f1,g1 -> white king may castle kingside
let cc = chessInitial(); cc.board[7][5] = null; cc.board[7][6] = null;
assert.ok(chessLegalMoves(cc, [4, 7]).some(([x, y]) => x === 6 && y === 7), 'chess kingside castle offered');

// ---- Go ----
let gb = Array.from({ length: 9 }, () => Array(9).fill(null));
gb[0][0] = 'w'; gb[1][0] = 'b';                  // white at (0,0)[x0y0], black below at (0,1)[x0y1]
let gr = goPlace(gb, 1, 0, 'b');                 // black plays (1,0) -> captures white corner
assert.strictEqual(gr.captured, 1, 'go capture 1');
assert.strictEqual(gr.board[0][0], null, 'go captured stone removed');
let sb = Array.from({ length: 9 }, () => Array(9).fill(null));
sb[0][1] = 'w'; sb[1][0] = 'w';                  // white surrounds corner (0,0)
assert.strictEqual(goPlace(sb, 0, 0, 'b'), null, 'go suicide rejected');
assert.strictEqual(goScore([[ 'b', null, 'w' ].concat(Array(6).fill(null))].concat(Array(8).fill(Array(9).fill(null)))).b >= 1, true, 'go score counts stones');

// ---- Yahtzee ----
assert.strictEqual(yahtzeeScore('fullHouse', [2, 2, 3, 3, 3]), 25, 'yahtzee full house');
assert.strictEqual(yahtzeeScore('smallStraight', [1, 2, 3, 4, 6]), 30, 'yahtzee small straight');
assert.strictEqual(yahtzeeScore('largeStraight', [2, 3, 4, 5, 6]), 40, 'yahtzee large straight');
assert.strictEqual(yahtzeeScore('yahtzee', [5, 5, 5, 5, 5]), 50, 'yahtzee 5-kind');
assert.strictEqual(yahtzeeScore('threeKind', [3, 3, 3, 1, 2]), 12, 'yahtzee three kind sum');
assert.strictEqual(yahtzeeScore('fours', [4, 4, 1, 4, 2]), 12, 'yahtzee fours');

// ---- Nim ----
assert.strictEqual(nimEmpty([0, 0, 0]), true, 'nim empty');
assert.strictEqual(nimEmpty([0, 1, 0]), false, 'nim not empty');

// ---- Hex ----
import { hexConnected, ludoStep, ludoAbs, bgInitial, bgLegalMoves, bgApply, bgAllHome, ccReachable } from './js/logic.js';
function hexBoard() { return Array.from({ length: 11 }, () => Array(11).fill(null)); }
let hx = hexBoard();
for (let x = 0; x < 11; x++) hx[5][x] = 'b';          // full row -> blue connects left..right
assert.strictEqual(hexConnected(hx, 'b'), true, 'hex blue connected');
assert.strictEqual(hexConnected(hx, 'r'), false, 'hex red not connected');
hx = hexBoard(); for (let x = 0; x < 10; x++) hx[5][x] = 'b'; // gap at x=10
assert.strictEqual(hexConnected(hx, 'b'), false, 'hex blue broken chain');

// ---- Ludo ----
assert.strictEqual(ludoStep(0, 6), 1, 'ludo leave base on 6');
assert.strictEqual(ludoStep(0, 3), null, 'ludo cannot leave base without 6');
assert.strictEqual(ludoStep(55, 3), null, 'ludo overshoot blocked');
assert.strictEqual(ludoStep(54, 3), 57, 'ludo exact finish');
assert.strictEqual(ludoAbs(0, 1), ludoAbs(26, 27), 'ludo opposite entries collide at abs 0');

// ---- Backgammon ----
let bg = bgInitial();
bg.points[10] = 1;                                    // white blot at 10
bg.points[5] = -1;                                    // a black checker at 5 (moves +5 -> 10)
let bm = bgLegalMoves(bg, 5, 'b').find((m) => m.to === 10);   // black from 5 with die 5 -> 10
assert.ok(bm, 'bg black can move onto white blot');
let after = bgApply(bg, bm.from, 10, 'b');
assert.strictEqual(after.bar.w, 1, 'bg hit sends white to bar');
assert.strictEqual(after.points[10], -1, 'bg blot replaced by black');
// bear off: all white home, one on point 0, die 1
let hb = { points: Array(24).fill(0), bar: { w: 0, b: 0 }, off: { w: 0, b: 0 } };
hb.points[0] = 1; hb.points[3] = 14;
assert.strictEqual(bgAllHome(hb, 'w'), true, 'bg white all home');
assert.ok(bgLegalMoves(hb, 1, 'w').some((m) => m.to === 'off'), 'bg bear off from point 0 with die 1');

// ---- Chinese Checkers hop ----
const adj = new Map([[0, [[1, 2]]], [1, [[0, null], [2, null]]], [2, [[1, 0]]]]);
const reach = ccReachable(adj, new Set([1]), 0);
assert.ok(reach.has(2), 'cc hop over peg to empty');
assert.ok(!reach.has(1), 'cc cannot land on occupied');

// ---- 2048 ----
import { move2048, has2048Move, tetrisFits, tetrisClear, TETROMINOES } from './js/logic.js';
let r2 = move2048([[2, 2, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], 'left');
assert.strictEqual(r2.board[0][0], 4, '2048 merge 2+2=4');
assert.strictEqual(r2.score, 4, '2048 score from merge');
assert.strictEqual(r2.moved, true, '2048 moved');
assert.strictEqual(move2048([[2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 4, 2]], 'left').moved, false, '2048 no move on checker board');
assert.strictEqual(has2048Move([[2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 4, 2]]), false, '2048 board full no merges');
assert.strictEqual(has2048Move([[2, 2, 0, 4], [4, 8, 16, 2], [2, 4, 8, 16], [4, 2, 4, 8]]), true, '2048 has a merge');

// ---- Tetris ----
const tg = Array.from({ length: 6 }, () => Array(6).fill(0));
assert.strictEqual(tetrisFits(tg, TETROMINOES.O, 2, 0), true, 'tetris O fits in empty');
assert.strictEqual(tetrisFits(tg, TETROMINOES.I, 4, 1), false, 'tetris I off right edge');
tg[5] = [1, 1, 1, 1, 1, 1]; tg[4] = [0, 1, 1, 1, 1, 1];
const tc = tetrisClear(tg);
assert.strictEqual(tc.lines, 1, 'tetris clears one full row');
assert.strictEqual(tc.grid[5][0], 0, 'tetris row above shifted down');

console.log('PASS (all logic incl. 2048/tetris + earlier)');
