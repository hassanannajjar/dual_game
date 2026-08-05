import { getLang } from '../i18n.js?v=34';

const EN = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const AR = 'ابتثجحخدذرزسشصضطظعغفقكلمنهوي'.split('');
const M = {};

// ---- bot: keeps its own secret word + guesses the human's word by letter frequency ----
const BOT_WORDS = ['PLANET', 'GARDEN', 'ROCKET', 'SILVER', 'PUZZLE', 'WIZARD', 'JUNGLE', 'MARBLE', 'FALCON', 'ORANGE', 'CASTLE', 'MONKEY', 'PENCIL', 'ISLAND', 'VELVET', 'COPPER', 'THRONE', 'BREEZE', 'CANYON', 'ROBOT'];
const FREQ = 'ETAOINSHRDLUCMFWYPVBGKJQXZ'.split('');
function botLazy() {
  if (M.botSecret) return;
  M.botSecret = BOT_WORDS[Math.floor(Math.random() * BOT_WORDS.length)];
  M.botRevealed = new Set(); M.botGuessed = new Set();
}
function botNextGuess() { for (const L of FREQ) if (!M.botGuessed.has(L)) { M.botGuessed.add(L); return L; } return null; }

function alphabet() { return getLang() === 'ar' ? AR : EN; }
function normalize(s) {
  s = (s || '').trim();
  if (getLang() === 'ar') return s.replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي').replace(/\s+/g, '');
  return s.toUpperCase().replace(/[^A-Z]/g, '');
}

function build(ctx) {
  M.kb = {};
  const wrap = ctx.el('div', 'max-w-md mx-auto space-y-4 text-center');
  M.wordEl = ctx.el('div', 'flex flex-wrap justify-center gap-1.5 text-2xl font-mono min-h-[3rem] items-center');
  wrap.appendChild(M.wordEl);
  M.statusEl = ctx.el('p', 'text-sm text-slate-400 h-5');
  wrap.appendChild(M.statusEl);
  const kb = ctx.el('div', 'flex flex-wrap justify-center gap-1.5');
  for (const L of alphabet()) {
    const b = ctx.el('button', '', L);
    b.onclick = () => guess(ctx, L);
    M.kb[L] = b;
    kb.appendChild(b);
  }
  wrap.appendChild(kb);
  ctx.root.appendChild(wrap);
  paint(ctx);
}
function paint(ctx) {
  M.wordEl.innerHTML = '';
  if (!M.oppRevealed) { M.wordEl.appendChild(ctx.el('span', 'text-slate-600', '…')); }
  else for (const ch of M.oppRevealed) {
    const s = ctx.el('span', 'w-7 h-9 border-b-2 border-slate-500 flex items-center justify-center', ch || '');
    M.wordEl.appendChild(s);
  }
  for (const L of alphabet()) {
    const b = M.kb[L]; if (!b) continue;
    const used = M.guessed.has(L);
    b.disabled = used || !ctx.myTurn;
    b.className = 'w-8 h-10 rounded font-bold text-sm ' +
      (M.hits.has(L) ? 'bg-emerald-600' : M.misses.has(L) ? 'bg-slate-700 text-slate-500' : 'bg-slate-800 hover:bg-slate-600 disabled:opacity-50');
  }
  M.statusEl.textContent = ctx.myTurn ? 'Guess a letter' : 'Opponent guessing…';
}
function guess(ctx, L) {
  if (!ctx.myTurn || M.guessed.has(L)) return;
  M.guessed.add(L); ctx.sound('click'); ctx.send('guess', { l: L }); paint(ctx);
  ctx.setTurn(false);
}

export default {
  id: 'hangman', name: 'Hangman', emoji: '🔤', blurb: 'Guess the secret word', category: 'word', difficulty: 'easy',
  setup(ctx) {
    M.secret = null; M.botSecret = null; M.oppLen = 0; M.oppRevealed = null; M.revealedToOpp = new Set();
    M.guessed = new Set(); M.hits = new Set(); M.misses = new Set();
    const root = ctx.setupRoot;
    root.appendChild(ctx.el('p', 'text-sm text-slate-400 mb-2 text-center', 'Set a secret word (3–10 letters). It never leaves your device.'));
    const inp = ctx.el('input', 'w-full py-3 px-4 rounded-xl bg-slate-700 text-center text-xl focus:outline-none focus:ring-2 focus:ring-indigo-500');
    if (getLang() === 'ar') inp.dir = 'rtl';
    const btn = ctx.el('button', 'w-full mt-3 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-semibold', ctx.t('lock_in'));
    const status = ctx.el('p', 'text-sm text-emerald-400 h-5 mt-2 text-center');
    const lock = () => {
      const w = normalize(inp.value);
      if (w.length < 3 || w.length > 10) { ctx.toast('3–10 letters'); return; }
      M.secret = w; inp.disabled = btn.disabled = true; status.textContent = ctx.t('locked_wait');
      ctx.send('len', { n: w.length }); ctx.ready();
    };
    btn.onclick = lock;
    root.append(inp, btn, status);
    inp.focus();
  },
  start(ctx) { build(ctx); },
  onTurn(mine, ctx) { paint(ctx); },
  botInit(level, ctx) { botLazy(); },
  botOpen(send) { botLazy(); const L = botNextGuess(); if (L) send({ type: 'guess', l: L }); },   // bot guesses first
  botOnGame(msg, send) {
    botLazy();
    if (msg.type === 'len') { send({ type: 'len', n: M.botSecret.length }); return; }
    if (msg.type === 'guess') {                              // human guessed a letter of the bot's word
      const L = msg.l, pos = [];
      for (let i = 0; i < M.botSecret.length; i++) if (M.botSecret[i] === L && !M.botRevealed.has(i)) { M.botRevealed.add(i); pos.push(i); }
      send({ type: 'reveal', l: L, pos });
      if (M.botRevealed.size === M.botSecret.length) return; // human cracked it → they win (handled human-side)
      const g = botNextGuess(); if (g) send({ type: 'guess', l: g });   // bot counter-guesses the human's word
    }
    // msg.type === 'reveal' (answer to the bot's guess): human detects its own loss; nothing to do
  },
  onMessage(msg, ctx) {
    if (msg.type === 'len') { M.oppLen = msg.n; M.oppRevealed = Array(msg.n).fill(null); if (M.wordEl) paint(ctx); return; }
    if (msg.type === 'guess') {
      const L = msg.l, pos = [];
      for (let i = 0; i < M.secret.length; i++) if (M.secret[i] === L && !M.revealedToOpp.has(i)) { M.revealedToOpp.add(i); pos.push(i); }
      ctx.send('reveal', { l: L, pos }); ctx.sound(pos.length ? 'flip' : 'error');
      if (M.revealedToOpp.size === M.secret.length) return ctx.endGame('lose', 'Word cracked!');
      ctx.setTurn(true);
    } else if (msg.type === 'reveal') {
      for (const i of msg.pos) M.oppRevealed[i] = msg.l;
      if (msg.pos.length) M.hits.add(msg.l); else M.misses.add(msg.l);
      ctx.sound(msg.pos.length ? 'flip' : 'error'); paint(ctx);
      if (M.oppRevealed.every(Boolean)) return ctx.endGame('win');
    }
  },
  getState() {
    return { secret: M.secret, oppLen: M.oppLen, oppRevealed: M.oppRevealed,
      revealedToOpp: [...M.revealedToOpp], guessed: [...M.guessed], hits: [...M.hits], misses: [...M.misses] };
  },
  restore(state, ctx) {
    M.secret = state.secret; M.oppLen = state.oppLen; M.oppRevealed = state.oppRevealed;
    M.revealedToOpp = new Set(state.revealedToOpp); M.guessed = new Set(state.guessed);
    M.hits = new Set(state.hits); M.misses = new Set(state.misses);
    build(ctx);
  },
};
