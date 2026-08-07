import { register, boot } from './platform.js?v=48';
import numberDuel from './games/number-duel.js?v=48';
import ticTacToe from './games/tic-tac-toe.js?v=48';
import connectFour from './games/connect-four.js?v=48';
import rps from './games/rock-paper-scissors.js?v=48';
import battleship from './games/battleship.js?v=48';
import gomoku from './games/gomoku.js?v=48';
import reversi from './games/reversi.js?v=48';
import checkers from './games/checkers.js?v=48';
import dots from './games/dots-boxes.js?v=48';
import uttt from './games/ultimate-ttt.js?v=48';
import mancala from './games/mancala.js?v=48';
import memory from './games/memory.js?v=48';
import morris from './games/nine-mens-morris.js?v=48';
import chess from './games/chess.js?v=48';
import hangman from './games/hangman.js?v=48';
import snakes from './games/snakes.js?v=48';
import pig from './games/pig.js?v=48';
import go from './games/go.js?v=48';
import order from './games/order-chaos.js?v=48';
import nim from './games/nim.js?v=48';
import yahtzee from './games/yahtzee.js?v=48';
import hex from './games/hex.js?v=48';
import ludo from './games/ludo.js?v=48';
import backgammon from './games/backgammon.js?v=48';
import chinesecheckers from './games/chinese-checkers.js?v=48';
import g2048 from './games/2048.js?v=48';
import tetris from './games/tetris.js?v=48';
import airhockey from './games/airhockey.js?v=48';
import tron from './games/tron.js?v=48';
import minesweeper from './games/minesweeper.js?v=48';
import snake from './games/snake.js?v=48';
import sudoku from './games/sudoku.js?v=48';
import sim from './games/sim.js?v=48';
import wordleDuel from './games/wordle-duel.js?v=48';
import farkle from './games/farkle.js?v=48';
import quarto from './games/quarto.js?v=48';
import mastermind from './games/mastermind.js?v=48';
import dominoes from './games/dominoes.js?v=48';
import wordRace from './games/word-race.js?v=48';
import match3 from './games/match3.js?v=48';
import pentago from './games/pentago.js?v=48';
import breakthrough from './games/breakthrough.js?v=48';
import loa from './games/loa.js?v=48';
import onitama from './games/onitama.js?v=48';
import quoridor from './games/quoridor.js?v=48';
import level2048 from './games/level2048.js?v=48';

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
  mastermind: ['strategy', 'medium'], dominoes: ['luck', 'medium'], 'word-race': ['word', 'medium'], match3: ['arcade', 'easy'],
  pentago: ['strategy', 'medium'], breakthrough: ['strategy', 'medium'], loa: ['strategy', 'hard'], onitama: ['strategy', 'hard'], quoridor: ['strategy', 'hard'],
  level2048: ['arcade', 'medium'],
};
const BOT = new Set(['ttt', 'connect4', 'gomoku', 'reversi', 'checkers', 'order', 'nim', 'dots', 'rps', 'number-duel', 'snakes', 'pig', 'memory', 'ludo', 'mancala', 'uttt', 'yahtzee', 'morris', 'chess', 'go', 'hex', 'chinesecheckers', 'backgammon', 'battleship', 'hangman', 'tron', 'airhockey', 'sim', 'wordle', 'farkle', 'quarto', 'mastermind', 'dominoes', 'word-race', 'match3', 'pentago', 'breakthrough', 'loa', 'onitama', 'quoridor']);
const SOLO = new Set(['2048', 'tetris', 'snake', 'minesweeper', 'sudoku', 'word-race', 'match3', 'level2048']);

// Add a game: import it above and add it here.
[numberDuel, ticTacToe, connectFour, rps, battleship, gomoku, reversi, checkers, dots, uttt,
  mancala, memory, morris, chess, hangman, snakes, pig, go, order, nim, yahtzee,
  hex, ludo, backgammon, chinesecheckers, g2048, tetris, airhockey, tron,
  minesweeper, snake, sudoku, sim, wordleDuel, farkle, quarto,
  mastermind, dominoes, wordRace, match3,
  pentago, breakthrough, loa, onitama, quoridor, level2048].forEach((g) => {
  const m = META[g.id]; if (m) { g.category = m[0]; g.difficulty = m[1]; }
  if (BOT.has(g.id)) g.bot = true;
  if (SOLO.has(g.id)) g.solo = true;
  register(g);
});

document.addEventListener('DOMContentLoaded', boot);
