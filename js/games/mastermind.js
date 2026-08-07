import { evaluate, mastermindCodes, mastermindConsistent } from '../logic.js?v=47';

// Code-breaking duel: each player sets a secret colour code; you race to crack the OTHER
// player's code with exact/partial peg feedback. First to all-exact wins. (Turn-based; mirrors Wordle Duel.)
const COLORS = ['bg-rose-500', 'bg-amber-400', 'bg-emerald-500', 'bg-sky-500', 'bg-violet-500', 'bg-pink-400'];
const NCOL = COLORS.length;
const M = {};
const codeStr = (code) => code.join('');   // colour indices 0..5 → digit chars, feedable to evaluate()

function pegRow(ctx, exact, partial, len) {
  const box = ctx.el('div', 'flex flex-wrap gap-0.5 w-10 items-center');
  const dot = (c) => ctx.el('span', 'w-2.5 h-2.5 rounded-full ' + c);
  for (let i = 0; i < exact; i++) box.appendChild(dot('bg-emerald-400'));
  for (let i = 0; i < partial; i++) box.appendChild(dot('bg-slate-200'));
  for (let i = 0; i < len - exact - partial; i++) box.appendChild(dot('bg-slate-700'));
  return box;
}
function build(ctx) {
  M.len = (ctx.config && ctx.config.len) || 4;
  M.cur = Array(M.len).fill(0);
  const wrap = ctx.el('div', 'max-w-xs mx-auto space-y-3 text-center');
  M.rowsEl = ctx.el('div', 'space-y-1.5 min-h-[2rem]'); wrap.appendChild(M.rowsEl);
  M.statusEl = ctx.el('p', 'text-sm text-slate-400 h-5'); wrap.appendChild(M.statusEl);
  M.builderEl = ctx.el('div', 'flex justify-center gap-1.5'); wrap.appendChild(M.builderEl);
  M.btn = ctx.el('button', 'px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-semibold', ctx.t('guess'));
  M.btn.onclick = () => submit(ctx);
  wrap.appendChild(M.btn);
  M.oppEl = ctx.el('p', 'text-xs text-slate-500'); wrap.appendChild(M.oppEl);
  ctx.root.appendChild(wrap);
  paintBuilder(ctx); paint(ctx);
}
function paintBuilder(ctx) {
  M.builderEl.innerHTML = '';
  for (let i = 0; i < M.len; i++) {
    const idx = i;
    const b = ctx.el('button', 'w-9 h-9 rounded-full border-2 border-slate-600 ' + COLORS[M.cur[i]]);
    b.onclick = () => { M.cur[idx] = (M.cur[idx] + 1) % NCOL; paintBuilder(ctx); ctx.sound('click'); };
    M.builderEl.appendChild(b);
  }
}
function paint(ctx) {
  M.rowsEl.innerHTML = '';
  for (const r of M.rows) {
    const row = ctx.el('div', 'flex justify-center items-center gap-2');
    const codes = ctx.el('div', 'flex gap-1');
    for (const c of r.code) codes.appendChild(ctx.el('span', 'w-6 h-6 rounded-full ' + COLORS[c]));
    row.append(codes, pegRow(ctx, r.exact, r.partial, M.len));
    M.rowsEl.appendChild(row);
  }
  M.oppEl.textContent = ctx.t('mm_opp', { n: M.oppGuesses });
  M.btn.disabled = !ctx.myTurn;
  M.builderEl.style.opacity = ctx.myTurn ? '1' : '0.4';
  M.statusEl.textContent = ctx.myTurn ? ctx.t('mm_your_turn') : ctx.t('mm_wait');
}
function submit(ctx) {
  if (!ctx.myTurn) return;
  ctx.sound('place'); ctx.send('guess', { code: M.cur.slice() }); ctx.setTurn(false);
}

export default {
  id: 'mastermind', name: 'Mastermind', emoji: '🎯', blurb: 'Crack the secret code',
  options: [{ key: 'len', label: 'Code length', choices: [{ label: '4', value: 4 }, { label: '5', value: 5 }], default: 4 }],
  setup(ctx) {
    M.rows = []; M.oppGuesses = 0; M.secret = null;
    const len = (ctx.config && ctx.config.len) || 4;
    const cur = Array(len).fill(0);
    const root = ctx.setupRoot;
    root.appendChild(ctx.el('p', 'text-sm text-slate-400 mb-3 text-center', ctx.t('mm_setup')));
    const slots = ctx.el('div', 'flex justify-center gap-2 mb-3');
    const render = () => {
      slots.innerHTML = '';
      for (let i = 0; i < len; i++) {
        const idx = i;
        const b = ctx.el('button', 'w-11 h-11 rounded-full border-2 border-slate-500 ' + COLORS[cur[i]]);
        b.onclick = () => { cur[idx] = (cur[idx] + 1) % NCOL; render(); ctx.sound('click'); };
        slots.appendChild(b);
      }
    };
    render();
    const btn = ctx.el('button', 'w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-semibold', ctx.t('lock_in'));
    const status = ctx.el('p', 'text-sm text-emerald-400 h-5 mt-2 text-center');
    btn.onclick = () => { M.secret = cur.slice(); btn.disabled = true; slots.querySelectorAll('button').forEach((b) => b.disabled = true); status.textContent = ctx.t('locked_wait'); ctx.ready(); };
    root.append(slots, btn, status);
  },
  start(ctx) { build(ctx); },
  onTurn(mine, ctx) { paint(ctx); },
  onMessage(msg, ctx) {
    if (msg.type === 'guess') {                                  // opponent guessed MY code
      M.oppGuesses++;
      const r = evaluate(codeStr(M.secret), codeStr(msg.code));
      ctx.send('fb', { code: msg.code, exact: r.exact, partial: r.partial });
      ctx.sound(r.exact === M.secret.length ? 'lose' : 'flip'); paint(ctx);
      if (r.exact === M.secret.length) return ctx.endGame('lose', ctx.t('mm_lose'));
      ctx.setTurn(true);
    } else if (msg.type === 'fb') {                              // result of MY guess
      M.rows.push({ code: msg.code, exact: msg.exact, partial: msg.partial });
      ctx.sound(msg.exact === M.len ? 'win' : 'place'); paint(ctx);
      if (msg.exact === M.len) return ctx.endGame('win', ctx.t('mm_win'));
    }
  },
  botInit(level, ctx) {
    M.len = (ctx && ctx.config && ctx.config.len) || M.len || 4;
    M.botLevel = level;
    M.botSecret = Array.from({ length: M.len }, () => Math.floor(Math.random() * NCOL));
    M.botCands = mastermindCodes(NCOL, M.len);
    M.botHist = [];
  },
  botOpen(send, level) { if (!M.botSecret) this.botInit(level); botGuess(send); },
  botOnGame(msg, send, level) {
    if (!M.botSecret) this.botInit(level);
    if (msg.type === 'guess') {                                  // human guessed the bot's code
      const r = evaluate(codeStr(M.botSecret), codeStr(msg.code));
      send({ type: 'fb', code: msg.code, exact: r.exact, partial: r.partial });
      if (r.exact === M.len) return;                             // human cracked it → human wins
      botGuess(send);                                            // bot takes its own guess
    } else if (msg.type === 'fb') {                              // result of the bot's guess
      M.botHist.push({ guess: codeStr(M.botLastGuess), exact: msg.exact, partial: msg.partial });
      if (M.botLevel !== 'easy') M.botCands = mastermindConsistent(M.botCands, M.botHist);
    }
  },
  getState() { return { rows: M.rows, secret: M.secret, oppGuesses: M.oppGuesses, len: M.len }; },
  restore(s, ctx) { M.rows = s.rows || []; M.secret = s.secret; M.oppGuesses = s.oppGuesses || 0; M.len = s.len || 4; build(ctx); },
};

function botGuess(send) {
  const pool = (M.botCands && M.botCands.length) ? M.botCands : mastermindCodes(NCOL, M.len);
  const pick = pool[Math.floor(Math.random() * pool.length)];
  M.botLastGuess = pick.split('').map(Number);
  send({ type: 'guess', code: M.botLastGuess });
}
