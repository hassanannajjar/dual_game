import { evaluate } from '../logic.js';

// Per-match state (module is a singleton; reset on setup/start).
const M = { secret: null, guessNo: 0, oppNo: 0, input: null, guessBtn: null, youLog: null, oppLog: null };

function feedbackHTML(exact, partial) {
  return `<span class="text-emerald-400">${exact} exact</span> · <span class="text-amber-400">${partial} partial</span>`;
}
function logRow(ul, no, digits, result, time, el) {
  const li = el('li', 'flex items-center justify-between gap-2 bg-slate-900 rounded-lg px-2 py-1');
  li.innerHTML =
    `<span class="text-slate-500 w-4">${no}</span>` +
    `<span class="font-mono tracking-widest flex-1">${digits}</span>` +
    `<span class="text-right">${result}</span>` +
    (time ? `<span class="text-slate-600 text-xs ml-1">${time}s</span>` : '');
  ul.appendChild(li);
  ul.scrollTop = ul.scrollHeight;
}

export default {
  id: 'number-duel',
  name: 'Number Duel',
  emoji: '🔢',
  blurb: 'Crack the secret number',
  options: [{ key: 'length', label: 'Number length',
    choices: [{ label: '3', value: 3 }, { label: '4', value: 4 }, { label: '5', value: 5 }], default: 4 }],

  setup(ctx) {
    const n = ctx.config.length;
    const root = ctx.setupRoot;
    root.appendChild(ctx.el('p', 'text-sm text-slate-400 mb-2',
      `Enter a ${n}-digit number (digits 0–9, repeats allowed). It never leaves your device.`));
    const inp = ctx.el('input',
      'digit-input w-full py-4 rounded-xl bg-slate-700 text-center text-3xl font-mono tracking-[0.4em] mb-3 ' +
      'focus:outline-none focus:ring-2 focus:ring-indigo-500');
    inp.inputMode = 'numeric';
    inp.maxLength = n;
    const btn = ctx.el('button', 'w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-semibold', 'Lock it in');
    const status = ctx.el('p', 'text-sm text-slate-400 h-5 mt-2 text-center');
    const lock = () => {
      const v = inp.value.trim();
      if (!new RegExp(`^\\d{${n}}$`).test(v)) { ctx.toast(`Need exactly ${n} digits`); return; }
      M.secret = v;
      inp.disabled = btn.disabled = true;
      status.textContent = 'Locked. Waiting for opponent…';
      ctx.ready();
    };
    btn.onclick = lock;
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') lock(); });
    root.append(inp, btn, status);
    inp.focus();
  },

  start(ctx) {
    const n = ctx.config.length;
    M.guessNo = M.oppNo = 0;
    const root = ctx.root;
    const bar = ctx.el('div', 'bg-slate-800 rounded-2xl p-4 shadow-xl mb-3 flex gap-2');
    M.input = ctx.el('input',
      'digit-input flex-1 py-3 rounded-xl bg-slate-700 text-center text-2xl font-mono tracking-[0.3em] ' +
      'focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-40');
    M.input.inputMode = 'numeric';
    M.input.maxLength = n;
    M.guessBtn = ctx.el('button', 'px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-semibold disabled:opacity-40', 'Guess');
    const submit = () => {
      if (!ctx.myTurn) return;
      const v = M.input.value.trim();
      if (!new RegExp(`^\\d{${n}}$`).test(v)) { ctx.toast(`Enter ${n} digits`); return; }
      M.input.value = '';
      ctx.send('guess', { digits: v });
      ctx.setTurn(false);
    };
    M.guessBtn.onclick = submit;
    M.input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
    bar.append(M.input, M.guessBtn);

    const cols = ctx.el('div', 'grid grid-cols-2 gap-3');
    const mkPanel = (title, color) => {
      const box = ctx.el('div', 'bg-slate-800 rounded-2xl p-3 shadow-xl');
      box.appendChild(ctx.el('h3', `text-sm font-semibold ${color} mb-2 text-center`, title));
      const ul = ctx.el('ul', 'space-y-1 text-sm max-h-72 overflow-y-auto');
      box.appendChild(ul);
      return { box, ul };
    };
    const you = mkPanel('Your guesses', 'text-indigo-400');
    const opp = mkPanel('Opponent', 'text-amber-400');
    M.youLog = you.ul; M.oppLog = opp.ul;
    cols.append(you.box, opp.box);
    root.append(bar, cols);
  },

  onTurn(mine, ctx) {
    M.input.disabled = !mine;
    M.guessBtn.disabled = !mine;
    if (mine) M.input.focus();
  },

  onMessage(msg, ctx) {
    if (msg.type === 'guess') {
      const { exact, partial } = evaluate(M.secret, msg.digits);
      const win = exact === ctx.config.length;
      ctx.send('feedback', { digits: msg.digits, exact, partial, win });
      logRow(M.oppLog, ++M.oppNo, msg.digits, feedbackHTML(exact, partial), ctx.elapsed(), ctx.el);
      if (win) ctx.endGame('lose', 'Opponent cracked your number.');
      else ctx.setTurn(true);
    } else if (msg.type === 'feedback') {
      logRow(M.youLog, ++M.guessNo, msg.digits, feedbackHTML(msg.exact, msg.partial), ctx.elapsed(), ctx.el);
      if (msg.win) ctx.endGame('win', `Cracked it in ${M.guessNo} guesses!`);
    } else if (msg.type === 'skip') {
      logRow(M.oppLog, ++M.oppNo, '—', '⏱ time out', '', ctx.el);
      ctx.setTurn(true);
    }
  },

  onTimeout(ctx) {
    logRow(M.youLog, ++M.guessNo, '—', '⏱ time out', '', ctx.el);
    ctx.send('skip', {});
    ctx.setTurn(false);
  },
};
