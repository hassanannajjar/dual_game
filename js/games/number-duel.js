import { evaluate } from '../logic.js?v=2';

// Per-match state (singleton; reset on setup/start/restore).
const M = { secret: null, guessNo: 0, oppNo: 0, you: [], opp: [], tab: 'you', pad: null, histEl: null, tabEls: {} };

// ---------- shared digit pad (slots + keypad) ----------
function digitPad(ctx, n, submitLabel, onSubmit) {
  let cur = '';
  const wrap = ctx.el('div', 'space-y-3');
  const slots = ctx.el('div', 'flex justify-center gap-2');
  const slotEls = [];
  for (let i = 0; i < n; i++) {
    const s = ctx.el('div', 'w-12 h-14 rounded-xl bg-slate-800 border-2 border-slate-700 flex items-center justify-center text-3xl font-mono');
    slotEls.push(s); slots.appendChild(s);
  }
  const refresh = () => {
    for (let i = 0; i < n; i++) {
      slotEls[i].textContent = cur[i] || '';
      slotEls[i].classList.toggle('border-indigo-500', i === cur.length);
    }
  };
  const keys = ctx.el('div', 'grid grid-cols-3 gap-2');
  const mkKey = (label, cls, fn) => {
    const b = ctx.el('button', 'py-4 rounded-xl text-2xl font-semibold transition active:scale-95 ' + cls, label);
    b.onclick = fn; return b;
  };
  const digitBtns = [];
  const pressDigit = (d) => { if (cur.length < n) { cur += d; refresh(); } };
  for (let d = 1; d <= 9; d++) { const b = mkKey('' + d, 'bg-slate-800 hover:bg-slate-700', () => pressDigit('' + d)); digitBtns.push(b); keys.appendChild(b); }
  const back = mkKey('⌫', 'bg-slate-800 hover:bg-slate-700', () => { cur = cur.slice(0, -1); refresh(); });
  const zero = mkKey('0', 'bg-slate-800 hover:bg-slate-700', () => pressDigit('0'));
  const submit = mkKey(submitLabel, 'bg-indigo-600 hover:bg-indigo-500 text-lg', () => { if (cur.length === n) onSubmit(cur); });
  keys.append(back, zero, submit);
  wrap.append(slots, keys);
  refresh();
  return {
    node: wrap,
    value: () => cur,
    clear: () => { cur = ''; refresh(); },
    setDisabled: (off) => { [...digitBtns, back, zero, submit].forEach((b) => (b.disabled = off)); wrap.classList.toggle('opacity-40', off); },
  };
}

// ---------- history rendering ----------
function peg(cls) { return `<span class="inline-block w-2.5 h-2.5 rounded-full ${cls}"></span>`; }
function pegRow(exact, partial, n) {
  let h = '';
  for (let i = 0; i < exact; i++) h += peg('bg-emerald-400');
  for (let i = 0; i < partial; i++) h += peg('bg-amber-400');
  for (let i = exact + partial; i < n; i++) h += peg('bg-slate-700');
  return `<span class="inline-flex gap-1 items-center">${h}</span>`;
}
function renderHistory(ctx) {
  const n = ctx.config.length;
  const rows = M.tab === 'you' ? M.you : M.opp;
  M.tabEls.you.className = tabCls(M.tab === 'you');
  M.tabEls.opp.className = tabCls(M.tab === 'opp');
  M.tabEls.you.textContent = `You (${M.you.length})`;
  M.tabEls.opp.textContent = `Opponent (${M.opp.length})`;
  M.histEl.innerHTML = '';
  if (!rows.length) { M.histEl.appendChild(ctx.el('li', 'text-center text-slate-600 text-sm py-4', 'No guesses yet')); return; }
  for (const r of rows.slice().reverse()) {
    const li = ctx.el('li', 'flex items-center gap-3 bg-slate-900 rounded-xl px-3 py-2');
    const body = r.timeout
      ? '<span class="text-slate-500">⏱ time out</span>'
      : `<span class="font-mono text-lg tracking-widest">${r.digits}</span>` +
        `<span class="ml-auto">${pegRow(r.exact, r.partial, n)}</span>`;
    li.innerHTML = `<span class="text-slate-600 text-sm w-5">${r.no}</span>${body}` +
      (r.time ? `<span class="text-slate-600 text-xs w-8 text-right">${r.time}s</span>` : '');
    M.histEl.appendChild(li);
  }
}
function tabCls(active) {
  return 'flex-1 py-2 rounded-lg text-sm font-semibold transition ' + (active ? 'bg-slate-700' : 'bg-slate-900 text-slate-400');
}

function buildPlayUI(ctx) {
  const n = ctx.config.length;
  const root = ctx.root;
  M.pad = digitPad(ctx, n, 'Guess', (v) => {
    if (!ctx.myTurn) return;
    M.pad.clear();
    ctx.send('guess', { digits: v });
    ctx.setTurn(false);
  });
  root.appendChild(M.pad.node);

  const tabs = ctx.el('div', 'grid grid-cols-2 gap-2 mt-5 mb-2');
  M.tabEls.you = ctx.el('button', tabCls(true), 'You (0)');
  M.tabEls.opp = ctx.el('button', tabCls(false), 'Opponent (0)');
  M.tabEls.you.onclick = () => { M.tab = 'you'; renderHistory(ctx); };
  M.tabEls.opp.onclick = () => { M.tab = 'opp'; renderHistory(ctx); };
  tabs.append(M.tabEls.you, M.tabEls.opp);
  root.appendChild(tabs);

  M.histEl = ctx.el('ul', 'space-y-1.5 max-h-64 overflow-y-auto pr-1');
  root.appendChild(M.histEl);
  renderHistory(ctx);
}

export default {
  id: 'number-duel', name: 'Number Duel', emoji: '🔢', blurb: 'Crack the secret number',
  options: [{ key: 'length', label: 'Number length',
    choices: [{ label: '3', value: 3 }, { label: '4', value: 4 }, { label: '5', value: 5 }], default: 4 }],

  setup(ctx) {
    const n = ctx.config.length;
    ctx.setupRoot.appendChild(ctx.el('p', 'text-sm text-slate-400 mb-3 text-center',
      `Set a ${n}-digit secret. It never leaves your device.`));
    const status = ctx.el('p', 'text-sm text-emerald-400 h-5 mt-3 text-center');
    const pad = digitPad(ctx, n, 'Lock', (v) => {
      M.secret = v;
      pad.setDisabled(true);
      status.textContent = 'Locked. Waiting for opponent…';
      ctx.ready();
    });
    ctx.setupRoot.append(pad.node, status);
  },

  start(ctx) {
    // M.secret was set during setup; keep it.
    M.guessNo = M.oppNo = 0; M.you = []; M.opp = []; M.tab = 'you';
    buildPlayUI(ctx);
  },

  onTurn(mine) { if (M.pad) M.pad.setDisabled(!mine); },

  onMessage(msg, ctx) {
    if (msg.type === 'guess') {
      const { exact, partial } = evaluate(M.secret, msg.digits);
      const win = exact === ctx.config.length;
      ctx.send('feedback', { digits: msg.digits, exact, partial, win });
      M.opp.push({ no: ++M.oppNo, digits: msg.digits, exact, partial, time: ctx.elapsed() });
      renderHistory(ctx);
      if (win) ctx.endGame('lose', 'Opponent cracked your number.');
      else ctx.setTurn(true);
    } else if (msg.type === 'feedback') {
      M.you.push({ no: ++M.guessNo, digits: msg.digits, exact: msg.exact, partial: msg.partial, time: ctx.elapsed() });
      renderHistory(ctx);
      ctx.save();
      if (msg.win) ctx.endGame('win', `Cracked it in ${M.guessNo} guesses!`);
    } else if (msg.type === 'skip') {
      M.opp.push({ no: ++M.oppNo, timeout: true });
      renderHistory(ctx);
      ctx.setTurn(true);
    }
  },

  onTimeout(ctx) {
    M.you.push({ no: ++M.guessNo, timeout: true });
    if (M.tab === 'you') renderHistory(ctx);
    ctx.send('skip', {});
    ctx.setTurn(false);
  },

  getState() {
    return { secret: M.secret, guessNo: M.guessNo, oppNo: M.oppNo, you: M.you, opp: M.opp, tab: M.tab };
  },
  restore(state, ctx) {
    M.secret = state.secret; M.guessNo = state.guessNo; M.oppNo = state.oppNo;
    M.you = state.you || []; M.opp = state.opp || []; M.tab = state.tab || 'you';
    buildPlayUI(ctx);
  },
};
