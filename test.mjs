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
// board-size generalization: move2048/has2048Move derive N from board.length (5x5, 6x6)
{ const r5 = move2048([[2, 2, 0, 0, 0], [0, 0, 0, 0, 0], [0, 0, 0, 0, 0], [0, 0, 0, 0, 0], [0, 0, 0, 0, 0]], 'left');
  assert.strictEqual(r5.board[0].length, 5, '5x5 rows stay length 5');
  assert.strictEqual(r5.board[0][0], 4, '5x5 merges left'); assert.strictEqual(r5.moved, true, '5x5 moved'); }
{ const full6 = Array.from({ length: 6 }, (_, y) => Array.from({ length: 6 }, (_, x) => ((x + y) % 2 ? 2 : 4)));
  assert.strictEqual(has2048Move(full6), false, '6x6 checker board has no move');
  assert.strictEqual(move2048(full6, 'up').moved, false, '6x6 checker board cannot move'); }

// ---- Tetris ----
const tg = Array.from({ length: 6 }, () => Array(6).fill(0));
assert.strictEqual(tetrisFits(tg, TETROMINOES.O, 2, 0), true, 'tetris O fits in empty');
assert.strictEqual(tetrisFits(tg, TETROMINOES.I, 4, 1), false, 'tetris I off right edge');
tg[5] = [1, 1, 1, 1, 1, 1]; tg[4] = [0, 1, 1, 1, 1, 1];
const tc = tetrisClear(tg);
assert.strictEqual(tc.lines, 1, 'tetris clears one full row');
assert.strictEqual(tc.grid[5][0], 0, 'tetris row above shifted down');

// ---- Bot helpers ----
import { tttBestMove, nimBestMove, msReveal, msCount, sudokuSolve, sudokuGen } from './js/logic.js';
assert.strictEqual(tttBestMove(['O', 'O', null, null, 'X', null, null, null, null], 'X'), 2, 'ttt blocks win');
assert.strictEqual(tttBestMove(['X', 'X', null, null, 'O', null, 'O', null, null], 'X'), 2, 'ttt takes win');
assert.ok(tttBestMove(Array(9).fill(null), 'X') >= 0, 'ttt returns a move');
const nmv = nimBestMove([1, 2, 4]);
{ const a = [1, 2, 4]; a[nmv.row] = nmv.keep; assert.strictEqual(a.reduce((x, y) => x ^ y, 0), 0, 'nim leaves XOR 0'); }

// ---- Minesweeper ----
const msMines = new Set(['4,4']);
assert.strictEqual(msCount(msMines, 3, 3, 6, 6), 1, 'ms counts adjacent mine');
assert.strictEqual(msCount(msMines, 0, 0, 6, 6), 0, 'ms no adjacent mine');
const msOpen = msReveal(msMines, 0, 0, 6, 6);
assert.ok(msOpen.length > 1 && !msOpen.includes('4,4'), 'ms flood opens region, not the mine');

// ---- Sudoku ----
let sudo = Array.from({ length: 9 }, () => Array(9).fill(0));
assert.strictEqual(sudokuSolve(sudo), true, 'sudoku solves empty grid');
assert.ok(sudo.every((r) => r.every((v) => v >= 1 && v <= 9)), 'sudoku fully filled');
let sseed = 12345; const srng = () => { sseed = (sseed * 1103515245 + 12345) & 0x7fffffff; return sseed / 0x7fffffff; };
const gen = sudokuGen(srng, 40);
const clues = gen.puzzle.flat().filter((v) => v).length;
assert.ok(clues >= 30 && clues <= 45, 'sudoku ~40 clues');
assert.strictEqual(sudokuSolve(gen.puzzle.map((r) => r.slice())), true, 'generated puzzle solvable');

// ---- Rating (Elo) ----
import { nextRating, evalAchievements } from './js/logic.js';
assert.ok(nextRating(1000, 1000, 'win') > 1000, 'elo win raises');
assert.ok(nextRating(1000, 1000, 'lose') < 1000, 'elo loss lowers');
assert.strictEqual(nextRating(1000, 1000, 'draw'), 1000, 'elo draw vs equal = no change');
{ const w = nextRating(1000, 1000, 'win') - 1000, l = 1000 - nextRating(1000, 1000, 'lose'); assert.strictEqual(w, l, 'elo symmetric vs equal'); }
assert.ok(nextRating(1000, 1600, 'win') - 1000 > nextRating(1000, 1000, 'win') - 1000, 'elo upset win rewards more');
assert.strictEqual(nextRating(100, 2000, 'lose'), 100, 'elo floor at 100');
assert.strictEqual(nextRating(1000, undefined, 'win') - 1000, nextRating(1000, 1000, 'win') - 1000, 'elo no-opp treated as equal');

// ---- Achievements ----
assert.deepStrictEqual(evalAchievements({ games: {}, botWins: {}, cats: [] }), [], 'ach none at zero');
assert.ok(evalAchievements({ games: { ttt: { w: 1, l: 0, d: 0, bestStreak: 1, rating: 1000 } }, botWins: {}, cats: ['classic'] }).includes('first_win'), 'ach first win at 1');
assert.ok(!evalAchievements({ games: { ttt: { w: 9, l: 0, d: 0, bestStreak: 1, rating: 1000 } }, botWins: {}, cats: [] }).includes('wins_10'), 'ach wins_10 not at 9');
assert.ok(evalAchievements({ games: { ttt: { w: 10, l: 0, d: 0, bestStreak: 1, rating: 1000 } }, botWins: {}, cats: [] }).includes('wins_10'), 'ach wins_10 at 10');
assert.ok(evalAchievements({ games: { ttt: { w: 5, l: 0, d: 0, bestStreak: 5, rating: 1000 } }, botWins: {}, cats: [] }).includes('streak_5'), 'ach streak at 5');
assert.ok(evalAchievements({ games: {}, botWins: { hard: 1 }, cats: [] }).includes('bot_hard'), 'ach beat hard bot');
assert.ok(evalAchievements({ games: {}, botWins: {}, cats: ['classic', 'strategy', 'puzzle', 'arcade', 'luck', 'word'] }).includes('explorer'), 'ach all categories');
assert.ok(evalAchievements({ games: {}, botWins: {}, cats: [] }, { rp: 1200 }).includes('rated_1200'), 'ach rated 1200 via account RP');
assert.ok(!evalAchievements({ games: {}, botWins: {}, cats: [] }, { rp: 1199 }).includes('rated_1200'), 'ach rated 1200 not below threshold');

// ---- Loyalty: levels / tiers / earning ----
import { levelForXp, tierForLevel, xpCoinsForResult, TIERS } from './js/logic.js';
assert.strictEqual(levelForXp(0).level, 1, 'level 1 at 0 xp');
assert.strictEqual(levelForXp(99).level, 1, 'still level 1 below 100');
assert.strictEqual(levelForXp(100).level, 2, 'level 2 at 100 xp');
{ const li = levelForXp(100); assert.strictEqual(li.into, 0, 'into resets at boundary'); assert.strictEqual(li.need, 140, 'need grows: 100+(2-1)*40'); }
{ let xp = 0; for (let L = 1; L <= 10; L++) xp += 100 + (L - 1) * 40; assert.strictEqual(levelForXp(xp).level, 11, 'cumulative curve reaches level 11'); }
assert.strictEqual(tierForLevel(1).key, 'rookie', 'tier rookie at 1');
assert.strictEqual(tierForLevel(4).key, 'rookie', 'tier rookie at 4');
assert.strictEqual(tierForLevel(5).key, 'apprentice', 'tier apprentice at 5');
assert.strictEqual(tierForLevel(10).key, 'pro', 'tier pro at 10');
assert.strictEqual(tierForLevel(40).key, 'legend', 'tier legend at 40');
assert.strictEqual(tierForLevel(999).key, 'legend', 'tier caps at legend');
{ const w = xpCoinsForResult('win', 0), l = xpCoinsForResult('lose', 0), d = xpCoinsForResult('draw', 0);
  assert.ok(w.xp > d.xp && d.xp > l.xp, 'win>draw>lose xp'); assert.strictEqual(l.xp, 10, 'lose = finish only'); }
{ const s0 = xpCoinsForResult('win', 0), s5 = xpCoinsForResult('win', 5);
  assert.strictEqual(s5.xp - s0.xp, 15, 'streak 5 adds 15 xp (5*3)'); }
{ const cap = xpCoinsForResult('win', 100), ten = xpCoinsForResult('win', 10);
  assert.strictEqual(cap.xp, ten.xp, 'streak bonus caps at 10'); }

// ---- Loyalty rewards: level/daily/quests/chest ----
import { levelRewardCoins, dailyReward, pickDailyQuests, chestRoll, QUEST_POOL } from './js/logic.js';
assert.ok(levelRewardCoins(10) > levelRewardCoins(1), 'level reward grows with level');
assert.strictEqual(dailyReward(1).coins, 25, 'daily day1 = 25');
assert.strictEqual(dailyReward(7).chest, true, 'daily day7 drops a chest');
assert.strictEqual(dailyReward(8).chest, false, 'daily cycles: day8 = day1, no chest');
assert.strictEqual(dailyReward(14).chest, true, 'daily day14 = day7, chest again');
{ const a = pickDailyQuests('2026-08-04'), b = pickDailyQuests('2026-08-04');
  assert.deepStrictEqual(a, b, 'quests deterministic for a date');
  assert.strictEqual(a.length, 3, 'three quests a day');
  assert.strictEqual(new Set(a.map((q) => q.type)).size, 3, 'quests have distinct types');
  const ids = new Set(QUEST_POOL.map((q) => q.id));
  assert.ok(a.every((q) => ids.has(q.id)), 'quests come from the pool'); }
{ let n = 0; const seq = [0.5, 0.1]; const rng = () => seq[n++]; const c = chestRoll(rng);
  assert.ok(c.coins >= 120 && c.coins <= 400 && c.coins % 10 === 0, 'chest coins in range & rounded');
  assert.strictEqual(c.booster, true, 'chest booster fires at rng 0.1 (<0.35)'); }
{ let n = 0; const seq = [0.9, 0.9]; const rng = () => seq[n++]; assert.strictEqual(chestRoll(rng).booster, false, 'no booster at rng 0.9'); }
assert.ok(evalAchievements({ games: { c: { w: 1, l: 0, d: 0, bestStreak: 1, rating: 1000 } }, botWins: {}, cats: [] }, { level: 10, streakDays: 0 }).includes('level_10'), 'ach level_10 via extra');
assert.ok(evalAchievements({ games: {}, botWins: {}, cats: [] }, { level: 3, streakDays: 7 }).includes('streak_7d'), 'ach 7-day streak via extra');
assert.ok(!evalAchievements({ games: {}, botWins: {}, cats: [] }).includes('level_10'), 'level ach needs extra (backward compatible)');

// ---- Hard-game bots return legal moves ----
import { chessBotMove, goBotMove, hexBotMove, bgBotMoves, chessAllMoves } from './js/logic.js';
{ const m = chessBotMove(chessInitial(), 'medium');
  const ok = m && chessAllMoves(chessInitial()).some((x) => x.from[0] === m.from[0] && x.from[1] === m.from[1] && x.to[0] === m.to[0] && x.to[1] === m.to[1]);
  assert.ok(ok, 'chess bot returns a legal opening move'); }
{ const b = Array.from({ length: 9 }, () => Array(9).fill(null)); const m = goBotMove(b, 'b', 'medium', null);
  assert.ok(m.type === 'move' && m.x >= 0 && m.x < 9 && m.y >= 0 && m.y < 9, 'go bot returns a legal point'); }
{ const b = Array.from({ length: 11 }, () => Array(11).fill(null)); const m = hexBotMove(b, 'r', 'medium');
  assert.ok(m.type === 'move' && b[m.y][m.x] === null, 'hex bot returns an empty cell'); }
{ const mv = bgBotMoves(bgInitial(), 'w', [3, 4], 'medium'); assert.ok(Array.isArray(mv) && mv.length >= 1 && mv.length <= 4, 'bg bot returns 1-4 moves'); }

// ---- New games: Sim, Quarto, Farkle, Wordle ----
import { simLoser, simKey, quartoWinner, farkleScore, wordleScore, wordleConsistent } from './js/logic.js';
{ const e = {}; e[simKey(0, 1)] = 'A'; e[simKey(0, 2)] = 'A'; e[simKey(1, 2)] = 'A'; assert.strictEqual(simLoser(e), 'A', 'sim mono triangle loses'); }
assert.strictEqual(simLoser({ [simKey(0, 1)]: 'A', [simKey(0, 2)]: 'B', [simKey(1, 2)]: 'A' }), null, 'sim mixed triangle safe');
{ const b = Array(16).fill(null); b[0] = 0b0000; b[1] = 0b0010; b[2] = 0b0100; b[3] = 0b0110; assert.strictEqual(quartoWinner(b), true, 'quarto line shares "small" bit'); }
assert.strictEqual(quartoWinner(Array(16).fill(null)), false, 'quarto empty no win');
assert.strictEqual(farkleScore([1, 1, 1, 2, 3, 4]).score, 1000, 'farkle three 1s = 1000');
assert.strictEqual(farkleScore([5, 5, 2, 3, 4, 6]).score, 100, 'farkle two 5s = 100');
assert.strictEqual(farkleScore([2, 2, 3, 3, 4, 6]).score, 0, 'farkle no scoring dice');
assert.strictEqual(farkleScore([1, 2, 3, 4, 5, 6]).score, 1500, 'farkle straight = 1500');
assert.strictEqual(wordleScore('CRANE', 'CRANE'), 'ggggg', 'wordle exact');
assert.strictEqual(wordleScore('SLATE', 'CRANE'), 'bbgbg', 'wordle mixed feedback');
{ const cands = wordleConsistent(['CRANE', 'SLATE', 'PLANT'], [{ guess: 'SLATE', fb: wordleScore('SLATE', 'CRANE') }]); assert.ok(cands.includes('CRANE') && !cands.includes('SLATE'), 'wordle constraint filter'); }

// ---- New games: Mastermind, Dominoes, Word Race, Match-3 ----
import { mastermindCodes, mastermindConsistent, dominoDeck, dominoPips, dominoPlayable, dominoCanPlay,
  isWord, canBuild, wordScore, RACK_SEEDS, match3Find, match3Gravity, isoWeekKey, pickWeekly, WEEKLY_POOL } from './js/logic.js';
assert.strictEqual(mastermindCodes(6, 4).length, 1296, 'mastermind 6^4 = 1296 codes');
{ const secret = '0123', g1 = '4501', fb = evaluate(secret, g1);
  const cons = mastermindConsistent(mastermindCodes(6, 4), [{ guess: g1, exact: fb.exact, partial: fb.partial }]);
  assert.ok(cons.includes(secret), 'mastermind keeps the true secret consistent');
  assert.ok(cons.every((c) => { const r = evaluate(c, g1); return r.exact === fb.exact && r.partial === fb.partial; }), 'mastermind survivors all match feedback'); }
assert.strictEqual(dominoDeck().length, 28, 'domino double-six set = 28 tiles');
assert.strictEqual(dominoPips([[6, 6], [0, 1]]), 13, 'domino pip sum');
assert.strictEqual(dominoPlayable([3, 5], [5, 2]), true, 'domino playable on matching end');
assert.strictEqual(dominoPlayable([3, 4], [5, 2]), false, 'domino not playable');
assert.strictEqual(dominoPlayable([0, 0], null), true, 'domino first tile always playable');
assert.strictEqual(dominoCanPlay([[1, 1], [3, 4]], [5, 2]), false, 'domino no legal move → pass');
assert.strictEqual(dominoCanPlay([[1, 1], [2, 4]], [5, 2]), true, 'domino has a legal move');
assert.ok(isWord('crane') && isWord('planet') && !isWord('qwxyz'), 'word-list membership');
assert.strictEqual(canBuild('cat', ['a', 'c', 't', 'x']), true, 'canBuild from rack');
assert.strictEqual(canBuild('cat', ['c', 'a']), false, 'canBuild missing letter');
assert.strictEqual(canBuild('aa', ['a', 'b']), false, 'canBuild respects letter multiplicity');
assert.ok(wordScore('cat') === 1 && wordScore('crane') === 4 && wordScore('ab') === 0, 'word score by length');
assert.ok(RACK_SEEDS.length >= 100 && RACK_SEEDS.every((w) => w.length >= 6 && w.length <= 8), 'rack seeds present and sized');
{ const b = [[0, 0, 0, 1], [2, 3, 4, 1], [2, 3, 4, 1]]; const hit = match3Find(b);
  assert.ok(hit.has('0,0') && hit.has('0,1') && hit.has('0,2'), 'match3 finds a row run');
  assert.ok(hit.has('0,3') && hit.has('1,3') && hit.has('2,3'), 'match3 finds a column run'); }
assert.strictEqual(match3Find([[0, 1, 0], [1, 0, 1], [0, 1, 0]]).size, 0, 'match3 no runs on a checker board');
{ const b = [[null, 1, 2], [0, 1, 2], [0, 1, 2]]; match3Gravity(b, () => 9);
  assert.strictEqual(b[2][0], 0, 'match3 gravity keeps bottom cell'); assert.strictEqual(b[0][0], 9, 'match3 gravity refills the top'); }

// ---- Weekly challenge + new achievements ----
assert.ok(/^\d{4}-W\d{2}$/.test(isoWeekKey(new Date(Date.UTC(2026, 0, 15)))), 'isoWeekKey format YYYY-Www');
{ const a = pickWeekly('2026-W05'), b = pickWeekly('2026-W05'); assert.deepStrictEqual(a, b, 'weekly deterministic per week'); assert.ok(WEEKLY_POOL.some((w) => w.id === a.id), 'weekly comes from the pool'); }
assert.ok(evalAchievements({ games: { a: { w: 250, l: 0, d: 0, bestStreak: 1, rating: 1000 } }, botWins: {}, cats: [] }).includes('wins_250'), 'ach wins_250');
assert.ok(evalAchievements({ games: { a: { w: 1, l: 0, d: 0, bestStreak: 10, rating: 1000 } }, botWins: {}, cats: [] }).includes('streak_10'), 'ach streak_10');
assert.ok(evalAchievements({ games: { a: { w: 1, l: 0, d: 0, bestStreak: 1 } }, botWins: {}, cats: [] }, { rp: 1600 }).includes('rated_1600'), 'ach rated_1600 via account RP');
assert.ok(evalAchievements({ games: {}, botWins: {}, cats: [] }, { level: 40 }).includes('level_40'), 'ach level_40 via extra');
assert.ok(evalAchievements({ games: {}, botWins: {}, cats: [] }, { favs: 5 }).includes('favs_5'), 'ach favs_5 via extra');
{ const games = {}; for (let i = 0; i < 10; i++) games['g' + i] = { w: 1, l: 0, d: 0, bestStreak: 1, rating: 1000 };
  assert.ok(evalAchievements({ games, botWins: {}, cats: [] }).includes('games_10'), 'ach games_10 counts distinct played'); }

// ---- Phase 3 helpers: history / seasons / rank / friends ----
import { historyPush, seasonId, softResetRating, upsertFriend } from './js/logic.js';
{ let h = []; for (let i = 0; i < 40; i++) h = historyPush(h, { i }); assert.strictEqual(h.length, 30, 'history capped at 30'); assert.strictEqual(h[0].i, 39, 'history newest-first'); }
assert.strictEqual(seasonId(new Date(Date.UTC(2026, 7, 4))), '2026-08', 'seasonId YYYY-MM');
assert.strictEqual(softResetRating(1400), 1200, 'soft reset pulls halfway to 1000');
assert.strictEqual(softResetRating(800), 900, 'soft reset raises low ratings halfway too');
assert.strictEqual(softResetRating(1000), 1000, 'soft reset keeps 1000');
{ let f = upsertFriend([], { uid: 'a', name: 'Al' }); f = upsertFriend(f, { uid: 'b', name: 'Bo' }); f = upsertFriend(f, { uid: 'a', name: 'Al2' });
  assert.strictEqual(f.length, 2, 'friends dedup by uid'); assert.strictEqual(f[0].uid, 'a', 'friends re-upsert moves to front'); assert.strictEqual(f[0].name, 'Al2', 'friends upsert updates fields'); }
assert.deepStrictEqual(upsertFriend([{ uid: 'a' }], { name: 'no-uid' }), [{ uid: 'a' }], 'friends ignore entries without uid');

// ---- Ranked Points (RP) ----
import { rpDelta, rpRank, RP_FLOOR } from './js/logic.js';
{ const win = (i) => rpDelta(Object.assign({ outcome: 'win' }, i), 1000).delta;
  assert.ok(win({}) > win({ vsBot: true, botLevel: 'medium' }), 'online win > bot win');
  assert.ok(win({ vsBot: true, botLevel: 'medium' }) > win({ solo: true }), 'bot win > solo win');
  assert.strictEqual(win({ vsBot: true, botLevel: 'hard' }), 18, 'hard bot win = 12*1.5');
  assert.strictEqual(win({ vsBot: true, botLevel: 'easy' }), 6, 'easy bot win = 12*0.5'); }
assert.ok(rpDelta({ outcome: 'lose' }, 1500).delta < 0, 'online loss is negative');
assert.strictEqual(rpDelta({ outcome: 'lose' }, 800).rp, RP_FLOOR, 'RP cannot drop below floor');
{ const strong = rpDelta({ outcome: 'lose' }, 1500).delta;                       // no opp info
  const vsStronger = rpDelta({ outcome: 'lose', oppRating: 1900 }, 1500).delta;   // beaten by stronger
  assert.ok(vsStronger > strong, 'losing to a stronger opponent costs less'); }
{ const flat = rpDelta({ outcome: 'win' }, 1500).delta;
  const upset = rpDelta({ outcome: 'win', oppRating: 1900 }, 1500).delta;
  assert.ok(upset > flat, 'beating a higher-RP opponent gives an underdog bonus'); }
{ const lowBot = rpDelta({ outcome: 'win', vsBot: true, botLevel: 'hard' }, 1000).delta;
  const highBot = rpDelta({ outcome: 'win', vsBot: true, botLevel: 'hard' }, 1600).delta;
  assert.ok(highBot <= 1 && lowBot > highBot, 'PvE win is capped near the top of the ladder (no farming)');
  assert.ok(rpDelta({ outcome: 'win' }, 1600).delta >= 20, 'online win is NOT capped at high RP'); }
{ const s0 = rpDelta({ outcome: 'win' }, 1500).delta, s5 = rpDelta({ outcome: 'win', streak: 5 }, 1500).delta;
  assert.strictEqual(s5 - s0, 10, 'win streak adds up to +10'); }
{ const lo = rpDelta({ outcome: 'lose' }, 1000).delta, hi = rpDelta({ outcome: 'lose' }, 1500).delta;
  assert.ok(lo > hi, 'losses halved under 1100 (beginner protection)'); }
assert.strictEqual(rpRank(799).key, 'bronze', 'rp floor → bronze');
assert.strictEqual(rpRank(800).division, 3, 'bottom of bronze is division III');
assert.strictEqual(rpRank(1000).division, 2, 'mid-bronze is division II');
{ const r = rpRank(1200); assert.strictEqual(r.key, 'silver', 'rp 1200 → silver'); assert.strictEqual(r.division, 3, 'silver entry = III'); assert.strictEqual(r.toNext, 300, 'silver→gold gap'); }
{ const m = rpRank(2500); assert.strictEqual(m.key, 'master', 'rp 2500 → master'); assert.strictEqual(m.division, 0, 'master has no division'); assert.strictEqual(m.nextKey, null, 'master is the top'); }

// ---- New games: Pentago / Breakthrough / Lines of Action / Onitama / Quoridor ----
import { pentagoRotate, pentagoWinner, breakthroughMoves, breakthroughWinner, loaMoves, loaConnected, loaWinner, onitamaStart, onitamaWinner, quoridorBlocked, quoridorPathExists } from './js/logic.js';
const grid6 = () => Array.from({ length: 6 }, () => Array(6).fill(0));
{ const b = grid6(); b[0][0] = 1; assert.strictEqual(pentagoRotate(b, 0, 'cw')[0][2], 1, 'pentago TL cw (0,0)->(2,0)'); }
{ const b = grid6(); for (let x = 0; x < 5; x++) b[2][x] = 1; assert.strictEqual(pentagoWinner(b), 1, 'pentago five-in-row'); }
assert.strictEqual(pentagoWinner(grid6()), null, 'pentago empty ongoing');
{ const b = grid6(); b[2][2] = 1; const m = breakthroughMoves(b, 2, 2);
  assert.ok(m.some(([x, y]) => x === 2 && y === 3), 'bt forward'); assert.ok(m.some(([x, y]) => x === 1 && y === 3), 'bt diagonal'); }
{ const b = grid6(); b[3][2] = 1; b[4][2] = 2; assert.ok(!breakthroughMoves(b, 2, 3).some(([x, y]) => x === 2 && y === 4), 'bt no straight capture'); }
{ const b = grid6(); b[3][2] = 1; b[4][3] = 2; assert.ok(breakthroughMoves(b, 2, 3).some(([x, y]) => x === 3 && y === 4), 'bt diagonal capture'); }
{ const b = grid6(); b[5][0] = 1; assert.strictEqual(breakthroughWinner(b), 1, 'bt reach far row'); }
{ const b = grid6(); b[2][2] = 1; b[2][4] = 1; assert.ok(loaMoves(b, 2, 2).some(([x, y]) => x === 0 && y === 2), 'loa moves k=2 along a 2-piece line'); }
assert.strictEqual(loaConnected([[1, 1, 0], [0, 0, 0], [0, 0, 0]], 1), true, 'loa one group');
assert.strictEqual(loaConnected([[1, 0, 1], [0, 0, 0], [0, 0, 0]], 1), false, 'loa two groups');
assert.strictEqual(loaWinner([[1, 1, 0], [0, 0, 0], [0, 0, 0]], 1), 1, 'loa winner connected');
assert.strictEqual(onitamaWinner(onitamaStart()), null, 'onitama ongoing');
{ const b = onitamaStart(); b[4][2] = 0; assert.strictEqual(onitamaWinner(b), 2, 'onitama master captured'); }
{ const b = onitamaStart(); b[0][2] = 2; assert.strictEqual(onitamaWinner(b), 1, 'onitama reach arch'); }
{ const walls = { hw: new Set(), vw: new Set() }; assert.strictEqual(quoridorBlocked(walls, 4, 4, 4, 5), false, 'quoridor open edge');
  walls.hw.add('4,4'); assert.strictEqual(quoridorBlocked(walls, 4, 4, 4, 5), true, 'quoridor h-wall blocks'); }
assert.strictEqual(quoridorPathExists({ hw: new Set(), vw: new Set() }, 9, [4, 8], 0), true, 'quoridor path exists on open board');

// ---- 2048 Levels campaign engine ----
import { level2048Config, move2048Walls, has2048MoveWalls, stars2048 } from './js/logic.js';
{ const a = JSON.stringify(level2048Config(7)), b = JSON.stringify(level2048Config(7)); assert.strictEqual(a, b, 'level config deterministic'); }
{ const c = level2048Config(1); assert.ok(c.size >= 4 && c.size <= 6 && c.target >= 128, 'level 1 sane'); assert.ok(level2048Config(200).target >= level2048Config(1).target, 'target rises with n'); }
{ const b = [[2, 0, 2, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
  assert.strictEqual(move2048Walls(b, 'left', []).board[0][0], 4, 'walls-move merges with no walls');
  const r = move2048Walls(b, 'left', [[1, 0]]);
  assert.strictEqual(r.board[0][0], 2, 'wall keeps first 2 in place'); assert.strictEqual(r.board[0][2], 2, 'wall blocks the merge across it'); assert.strictEqual(r.score, 0, 'no score across wall'); }
{ const full = [[2, 4], [4, 2]]; assert.strictEqual(has2048MoveWalls(full, []), false, 'walls: full 2x2 checker has no move');
  assert.strictEqual(has2048MoveWalls([[2, 2], [4, 8]], []), true, 'walls: adjacent pair has a move');
  assert.strictEqual(has2048MoveWalls([[2, 2], [4, 8]], [[1, 0]]), false, 'walls: barrier blocks the only merge'); }
assert.strictEqual(stars2048(100, 50), 3, 'stars 3'); assert.strictEqual(stars2048(100, 80), 2, 'stars 2'); assert.strictEqual(stars2048(100, 95), 1, 'stars 1');

console.log('PASS (all logic incl. bots/minesweeper/sudoku + rating/achievements + loyalty + quests/chests + hard-bots + new-games incl. mastermind/dominoes/word-race/match3 + pentago/breakthrough/loa/onitama/quoridor + 2048-levels + weekly + history/seasons/rank/friends + RP + earlier)');
