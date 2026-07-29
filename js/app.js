import { register, boot } from './platform.js';
import numberDuel from './games/number-duel.js';
import ticTacToe from './games/tic-tac-toe.js';
import connectFour from './games/connect-four.js';
import rps from './games/rock-paper-scissors.js';
import battleship from './games/battleship.js';
import gomoku from './games/gomoku.js';
import reversi from './games/reversi.js';
import checkers from './games/checkers.js';
import dots from './games/dots-boxes.js';
import uttt from './games/ultimate-ttt.js';
import mancala from './games/mancala.js';
import memory from './games/memory.js';
import morris from './games/nine-mens-morris.js';
import chess from './games/chess.js';
import hangman from './games/hangman.js';
import snakes from './games/snakes.js';
import pig from './games/pig.js';
import go from './games/go.js';
import order from './games/order-chaos.js';
import nim from './games/nim.js';
import yahtzee from './games/yahtzee.js';

// Single source of category / difficulty (drives the home grid). category ∈ classic|strategy|luck|word.
const META = {
  'number-duel': ['word', 'medium'], ttt: ['classic', 'easy'], connect4: ['classic', 'easy'],
  rps: ['classic', 'easy'], battleship: ['classic', 'medium'], gomoku: ['strategy', 'easy'],
  reversi: ['strategy', 'medium'], checkers: ['strategy', 'medium'], dots: ['strategy', 'medium'],
  uttt: ['strategy', 'hard'], mancala: ['strategy', 'medium'], memory: ['classic', 'easy'],
  morris: ['strategy', 'medium'], chess: ['strategy', 'hard'], hangman: ['word', 'easy'],
  snakes: ['luck', 'easy'], pig: ['luck', 'easy'], go: ['strategy', 'hard'],
  order: ['strategy', 'medium'], nim: ['strategy', 'easy'], yahtzee: ['luck', 'medium'],
};

// Add a game: import it above and add it here.
[numberDuel, ticTacToe, connectFour, rps, battleship, gomoku, reversi, checkers, dots, uttt,
  mancala, memory, morris, chess, hangman, snakes, pig, go, order, nim, yahtzee].forEach((g) => {
  const m = META[g.id]; if (m) { g.category = m[0]; g.difficulty = m[1]; }
  register(g);
});

document.addEventListener('DOMContentLoaded', boot);
