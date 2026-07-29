import { register, boot } from './platform.js';
import numberDuel from './games/number-duel.js';
import ticTacToe from './games/tic-tac-toe.js';
import connectFour from './games/connect-four.js';
import rps from './games/rock-paper-scissors.js';
import battleship from './games/battleship.js';

// Add a game: import its module above and register it here.
[numberDuel, ticTacToe, connectFour, rps, battleship].forEach(register);

document.addEventListener('DOMContentLoaded', boot);
