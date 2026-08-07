import { wordleScore, wordleConsistent, WORDLE_WORDS } from '../logic.js?v=45';

// Duel: each player sets a secret 5-letter word; you race to crack the OTHER player's word
// with Wordle feedback. First to all-green wins. (Turn-based; mirrors hangman/number-duel.)
const M = {};
const norm = (s) => (s || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5);
const tileCls = (f) => 'w-9 h-9 rounded flex items-center justify-center text-lg font-bold ' +
  (f === 'g' ? 'bg-emerald-600' : f === 'y' ? 'bg-amber-500' : 'bg-slate-700');

function rowEl(ctx, word, fb) {
  const row = ctx.el('div', 'flex justify-center gap-1.5');
  for (let i = 0; i < 5; i++) row.appendChild(ctx.el('div', tileCls(fb[i]), word[i] || ''));
  return row;
}
function paint(ctx) {
  M.rowsEl.innerHTML = '';
  for (const r of M.rows) M.rowsEl.appendChild(rowEl(ctx, r.word, r.fb));
  M.oppEl.textContent = `Opponent: ${M.oppGuesses} guess${M.oppGuesses === 1 ? '' : 'es'}`;
  M.inp.disabled = M.btn.disabled = !ctx.myTurn;
  M.statusEl.textContent = ctx.myTurn ? 'Guess the opponent’s word' : 'Opponent guessing…';
}
function build(ctx) {
  const wrap = ctx.el('div', 'max-w-xs mx-auto space-y-3 text-center');
  M.rowsEl = ctx.el('div', 'space-y-1.5 min-h-[2.5rem]'); wrap.appendChild(M.rowsEl);
  M.statusEl = ctx.el('p', 'text-sm text-slate-400 h-5'); wrap.appendChild(M.statusEl);
  const bar = ctx.el('div', 'flex gap-2');
  M.inp = ctx.el('input', 'flex-1 py-2 px-3 rounded-lg bg-slate-800 text-center text-lg tracking-widest uppercase focus:outline-none focus:ring-2 focus:ring-indigo-500');
  M.inp.maxLength = 5;
  M.btn = ctx.el('button', 'px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-semibold', 'Guess');
  M.btn.onclick = () => submit(ctx);
  M.inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(ctx); });
  bar.append(M.inp, M.btn); wrap.appendChild(bar);
  M.oppEl = ctx.el('p', 'text-xs text-slate-500'); wrap.appendChild(M.oppEl);
  ctx.root.appendChild(wrap); paint(ctx);
}
function submit(ctx) {
  if (!ctx.myTurn) return;
  const w = norm(M.inp.value);
  if (w.length !== 5) { ctx.toast('5 letters'); ctx.sound('invalid'); return; }
  M.inp.value = ''; ctx.sound('click'); ctx.send('guess', { word: w }); ctx.setTurn(false);
}

export default {
  id: 'wordle', name: 'Wordle Duel', emoji: '🟩', blurb: 'Crack their word first',
  setup(ctx) {
    M.rows = []; M.oppGuesses = 0; M.secret = null;
    const root = ctx.setupRoot;
    root.appendChild(ctx.el('p', 'text-sm text-slate-400 mb-2 text-center', 'Set a secret 5-letter word. It never leaves your device.'));
    const inp = ctx.el('input', 'w-full py-3 px-4 rounded-xl bg-slate-700 text-center text-xl tracking-widest uppercase focus:outline-none focus:ring-2 focus:ring-indigo-500'); inp.maxLength = 5;
    const btn = ctx.el('button', 'w-full mt-3 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-semibold', ctx.t('lock_in'));
    const status = ctx.el('p', 'text-sm text-emerald-400 h-5 mt-2 text-center');
    btn.onclick = () => { const w = norm(inp.value); if (w.length !== 5) { ctx.toast('5 letters'); return; } M.secret = w; inp.disabled = btn.disabled = true; status.textContent = ctx.t('locked_wait'); ctx.ready(); };
    root.append(inp, btn, status); inp.focus();
  },
  start(ctx) { build(ctx); },
  onTurn(mine, ctx) { paint(ctx); },
  botInit() { M.botSecret = WORDLE_WORDS[Math.floor(Math.random() * WORDLE_WORDS.length)]; M.botCands = WORDLE_WORDS.slice(); M.botHist = []; },
  botOpen(send) { if (!M.botSecret) this.botInit(); botGuess(send); },
  botOnGame(msg, send) {
    if (!M.botSecret) this.botInit();
    if (msg.type === 'guess') {                                  // human guessed the bot's word
      const fb = wordleScore(msg.word, M.botSecret);
      send({ type: 'fb', word: msg.word, fb });
      if (fb === 'ggggg') return;                                // human solved it → human wins
      botGuess(send);                                            // bot takes its own guess
    } else if (msg.type === 'fb') {                              // result of the bot's guess
      M.botHist.push({ guess: msg.lastGuess, fb: msg.fb });
      M.botCands = wordleConsistent(M.botCands, M.botHist);
    }
  },
  onMessage(msg, ctx) {
    if (msg.type === 'guess') {                                  // opponent guessed MY word
      M.oppGuesses++;
      const fb = wordleScore(msg.word, M.secret);
      ctx.send('fb', { word: msg.word, fb, lastGuess: msg.word });
      ctx.sound(fb === 'ggggg' ? 'lose' : 'flip'); paint(ctx);
      if (fb === 'ggggg') return ctx.endGame('lose', 'They cracked your word');
      ctx.setTurn(true);
    } else if (msg.type === 'fb') {                              // result of MY guess
      M.rows.push({ word: msg.word, fb: msg.fb }); ctx.sound(msg.fb === 'ggggg' ? 'win' : 'place'); paint(ctx);
      if (msg.fb === 'ggggg') return ctx.endGame('win', 'You cracked it!');
    }
  },
  getState() { return { rows: M.rows, secret: M.secret, oppGuesses: M.oppGuesses }; },
  restore(s, ctx) { M.rows = s.rows || []; M.secret = s.secret; M.oppGuesses = s.oppGuesses || 0; build(ctx); },
};

function botGuess(send) {
  const pool = (M.botCands && M.botCands.length) ? M.botCands : WORDLE_WORDS;
  const g = pool[Math.floor(Math.random() * pool.length)];
  send({ type: 'guess', word: g });
}
