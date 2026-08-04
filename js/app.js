import { register, boot } from './platform.js?v=24';
import numberDuel from './games/number-duel.js?v=24';
import ticTacToe from './games/tic-tac-toe.js?v=24';
import connectFour from './games/connect-four.js?v=24';
import rps from './games/rock-paper-scissors.js?v=24';
import battleship from './games/battleship.js?v=24';
import gomoku from './games/gomoku.js?v=24';
import reversi from './games/reversi.js?v=24';
import checkers from './games/checkers.js?v=24';
import dots from './games/dots-boxes.js?v=24';
import uttt from './games/ultimate-ttt.js?v=24';
import mancala from './games/mancala.js?v=24';
import memory from './games/memory.js?v=24';
import morris from './games/nine-mens-morris.js?v=24';
import chess from './games/chess.js?v=24';
import hangman from './games/hangman.js?v=24';
import snakes from './games/snakes.js?v=24';
import pig from './games/pig.js?v=24';
import go from './games/go.js?v=24';
import order from './games/order-chaos.js?v=24';
import nim from './games/nim.js?v=24';
import yahtzee from './games/yahtzee.js?v=24';
import hex from './games/hex.js?v=24';
import ludo from './games/ludo.js?v=24';
import backgammon from './games/backgammon.js?v=24';
import chinesecheckers from './games/chinese-checkers.js?v=24';
import g2048 from './games/2048.js?v=24';
import tetris from './games/tetris.js?v=24';
import airhockey from './games/airhockey.js?v=24';
import tron from './games/tron.js?v=24';
import minesweeper from './games/minesweeper.js?v=24';
import snake from './games/snake.js?v=24';
import sudoku from './games/sudoku.js?v=24';
import sim from './games/sim.js?v=24';
import wordleDuel from './games/wordle-duel.js?v=24';
import farkle from './games/farkle.js?v=24';
import quarto from './games/quarto.js?v=24';

// Single source of category / difficulty. category ∈ classic|strategy|puzzle|arcade|luck|word.
const META = {
  'number-duel': ['word', 'medium'], ttt: ['classic', 'easy'], connect4: ['classic', 'easy'],
  rps: ['classic', 'easy'], battleship: ['classic', 'medium'], gomoku: ['strategy', 'easy'],
  reversi: ['strategy', 'medium'], checkers: ['strategy', 'medium'], dots: ['strategy', 'medium'],
  uttt: ['strategy', 'hard'], mancala: ['strategy', 'medium'], memory: ['classic', 'easy'],
  morris: ['strategy', 'medium'], chess: ['strategy', 'hard'], hangman: ['word', 'easy'],
  snakes: ['luck', 'easy'], pig: ['luck', 'easy'], go: ['strategy', 'hard'],
  order: ['strategy', 'medium'], nim: ['strategy', 'easy'], yahtzee: ['luck', 'medium'],
  hex: ['strategy', 'medium'], ludo: ['luck', 'easy'], backgammon: ['strategy', 'hard'], chinesecheckers: ['strategy', 'hard'],
  '2048': ['arcade', 'easy'], tetris: ['arcade', 'medium'], airhockey: ['arcade', 'easy'], tron: ['arcade', 'easy'],
  minesweeper: ['puzzle', 'medium'], snake: ['arcade', 'easy'], sudoku: ['puzzle', 'medium'],
  sim: ['strategy', 'medium'], wordle: ['word', 'medium'], farkle: ['luck', 'easy'], quarto: ['strategy', 'hard'],
};
const BOT = new Set(['ttt', 'connect4', 'gomoku', 'reversi', 'checkers', 'order', 'nim', 'dots', 'rps', 'number-duel', 'snakes', 'pig', 'memory', 'ludo', 'mancala', 'uttt', 'yahtzee', 'morris', 'chess', 'go', 'hex', 'chinesecheckers', 'backgammon', 'battleship', 'hangman', 'tron', 'airhockey', 'sim', 'wordle', 'farkle', 'quarto']);
const SOLO = new Set(['2048', 'tetris', 'snake', 'minesweeper', 'sudoku']);

// Add a game: import it above and add it here.
[numberDuel, ticTacToe, connectFour, rps, battleship, gomoku, reversi, checkers, dots, uttt,
  mancala, memory, morris, chess, hangman, snakes, pig, go, order, nim, yahtzee,
  hex, ludo, backgammon, chinesecheckers, g2048, tetris, airhockey, tron,
  minesweeper, snake, sudoku, sim, wordleDuel, farkle, quarto].forEach((g) => {
  const m = META[g.id]; if (m) { g.category = m[0]; g.difficulty = m[1]; }
  if (BOT.has(g.id)) g.bot = true;
  if (SOLO.has(g.id)) g.solo = true;
  register(g);
});

document.addEventListener('DOMContentLoaded', boot);
