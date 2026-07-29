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

// Add a game: import its module above and add it to this list.
[numberDuel, ticTacToe, connectFour, rps, battleship,
  gomoku, reversi, checkers, dots, uttt, mancala, memory, morris].forEach(register);

document.addEventListener('DOMContentLoaded', boot);
