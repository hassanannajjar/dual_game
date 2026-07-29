import { register, boot } from './platform.js?v=1';
import numberDuel from './games/number-duel.js?v=1';
import ticTacToe from './games/tic-tac-toe.js?v=1';
import connectFour from './games/connect-four.js?v=1';
import rps from './games/rock-paper-scissors.js?v=1';
import battleship from './games/battleship.js?v=1';
import gomoku from './games/gomoku.js?v=1';
import reversi from './games/reversi.js?v=1';
import checkers from './games/checkers.js?v=1';
import dots from './games/dots-boxes.js?v=1';
import uttt from './games/ultimate-ttt.js?v=1';
import mancala from './games/mancala.js?v=1';
import memory from './games/memory.js?v=1';
import morris from './games/nine-mens-morris.js?v=1';
import chess from './games/chess.js?v=1';
import hangman from './games/hangman.js?v=1';
import snakes from './games/snakes.js?v=1';
import pig from './games/pig.js?v=1';
import go from './games/go.js?v=1';
import order from './games/order-chaos.js?v=1';
import nim from './games/nim.js?v=1';
import yahtzee from './games/yahtzee.js?v=1';

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
