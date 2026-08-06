import { makeRack, isWord, canBuild, wordScore, WORD_LIST } from '../logic.js?v=38';

// Word Race (simultaneous): both players get the SAME letter rack + a shared countdown.
// Build as many valid words (3+ letters) as you can from the rack. Highest total score wins.
const M = {};

function rackTiles(ctx) {
  M.rackEl.innerHTML = '';
  for (const c of (M.rack || [])) M.rackEl.appendChild(ctx.el('span', 'w-8 h-8 rounded-md bg-slate-100 text-slate-900 font-bold text-lg flex items-center justify-center uppercase shadow', c));
}
function paint(ctx) {
  if (!M.scoreEl) return;
  if (ctx.solo) M.scoreEl.textContent = ctx.t('wr_you') + ': ' + M.myScore;
  else M.scoreEl.textContent = `${ctx.t('wr_you')}: ${M.myScore}  ·  ${ctx.t('opponent')}: ${M.oppScore}` + (M.myDone ? '  — ' + ctx.t('waiting_finish') : '');
}
function build(ctx) {
  const wrap = ctx.el('div', 'max-w-xs mx-auto space-y-3 text-center');
  M.scoreEl = ctx.el('p', 'text-sm text-slate-400'); wrap.appendChild(M.scoreEl);
  M.timerEl = ctx.el('p', 'font-mono text-2xl'); wrap.appendChild(M.timerEl);
  M.rackEl = ctx.el('div', 'flex justify-center gap-1.5 flex-wrap'); wrap.appendChild(M.rackEl);
  const bar = ctx.el('div', 'flex gap-2');
  M.inputEl = ctx.el('input', 'flex-1 py-2 px-3 rounded-lg bg-slate-800 text-center text-lg tracking-wide uppercase focus:outline-none focus:ring-2 focus:ring-indigo-500');
  M.inputEl.maxLength = 8;
  const btn = ctx.el('button', 'px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-semibold', ctx.t('wr_add'));
  btn.onclick = () => submit(ctx);
  M.inputEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(ctx); });
  bar.append(M.inputEl, btn); wrap.appendChild(bar);
  M.msgEl = ctx.el('p', 'text-xs h-4'); wrap.appendChild(M.msgEl);
  M.listEl = ctx.el('div', 'flex flex-wrap gap-1 justify-center'); wrap.appendChild(M.listEl);
  ctx.root.appendChild(wrap);
  rackTiles(ctx); renderTimer(); paint(ctx);
  M.inputEl.focus();
}
function renderTimer() { if (M.timerEl) M.timerEl.textContent = Math.floor(M.timeLeft / 60) + ':' + String(M.timeLeft % 60).padStart(2, '0'); }
function flash(msg, ok) { if (!M.msgEl) return; M.msgEl.textContent = msg; M.msgEl.className = 'text-xs h-4 ' + (ok ? 'text-emerald-400' : 'text-rose-400'); }
function submit(ctx) {
  if (M.myDone) return;
  const w = (M.inputEl.value || '').toLowerCase().replace(/[^a-z]/g, '');
  M.inputEl.value = '';
  if (w.length < 3) { flash(ctx.t('wr_short'), false); ctx.sound('invalid'); return; }
  if (M.used.has(w)) { flash(ctx.t('wr_used'), false); ctx.sound('invalid'); return; }
  if (!canBuild(w, M.rack)) { flash(ctx.t('wr_letters'), false); ctx.sound('invalid'); return; }
  if (!isWord(w)) { flash(ctx.t('wr_notword'), false); ctx.sound('invalid'); return; }
  const pts = wordScore(w); M.used.add(w); M.myScore += pts;
  M.listEl.appendChild(ctx.el('span', 'px-2 py-0.5 rounded bg-slate-800 text-xs uppercase', `${w} +${pts}`));
  flash('+' + pts, true); ctx.sound('place'); paint(ctx);
  if (!ctx.solo) ctx.send('word', { total: M.myScore });
  ctx.save();
}
function startTimer(ctx) {
  clearInterval(M.timer);
  const render = () => { renderTimer(); };
  M.timer = setInterval(() => { M.timeLeft--; render(); if (M.timeLeft <= 0) { clearInterval(M.timer); M.timer = null; finish(ctx); } }, 1000);
}
function finish(ctx) {
  if (M.myDone) return;
  M.myDone = true; clearInterval(M.timer); M.timer = null;
  if (M.inputEl) M.inputEl.disabled = true;
  if (ctx.solo) return ctx.endGame('win', ctx.t('wr_solo', { n: M.myScore }));
  ctx.send('done', { total: M.myScore });
  if (ctx.vsBot) { clearInterval(M.botTimer); M.botTimer = null; M.oppDone = true; }
  paint(ctx); resolveIfBoth(ctx);
}
function resolveIfBoth(ctx) {
  if (!(M.myDone && M.oppDone)) return;
  const outcome = M.myScore > M.oppScore ? 'win' : M.myScore < M.oppScore ? 'lose' : 'draw';
  ctx.endGame(outcome, ctx.t('wr_result', { me: M.myScore, opp: M.oppScore }));
}

export default {
  id: 'word-race', name: 'Word Race', emoji: '🔤', blurb: 'Build words, beat the clock', usesTurns: false,
  options: [{ key: 'time', label: 'Time limit', choices: [{ label: '1m', value: 60 }, { label: '90s', value: 90 }, { label: '2m', value: 120 }], default: 90 }],
  start(ctx) {
    M.used = new Set(); M.myScore = 0; M.oppScore = 0; M.myDone = false; M.oppDone = false; M.timer = null; M.botTimer = null;
    M.timeLeft = (ctx.config && ctx.config.time) || 90;
    if (ctx.isHost) { M.rack = makeRack(Math.random); if (!ctx.solo) ctx.send('rack', { rack: M.rack }); }
    else { M.rack = M.rack || []; }
    build(ctx); startTimer(ctx);
  },
  onMessage(msg, ctx) {
    if (msg.type === 'rack') { M.rack = msg.rack; rackTiles(ctx); return; }
    if (msg.type === 'word') { M.oppScore = msg.total; paint(ctx); }
    else if (msg.type === 'done') { M.oppDone = true; M.oppScore = msg.total; paint(ctx); resolveIfBoth(ctx); }
  },
  botOpen(send, level) {
    if (!M.rack || !M.rack.length) return;
    const uniq = [...new Set(WORD_LIST.filter((w) => w.length >= 3 && canBuild(w, M.rack)))].sort((a, b) => wordScore(b) - wordScore(a));
    const cap = level === 'easy' ? 4 : level === 'hard' ? 16 : 9;
    const words = uniq.slice(0, cap);
    const gap = level === 'easy' ? 6500 : level === 'hard' ? 2500 : 4200;
    let i = 0, sc = 0;
    M.botTimer = setInterval(() => {
      if (i >= words.length || M.myDone) { clearInterval(M.botTimer); M.botTimer = null; return; }
      sc += wordScore(words[i++]); M.oppScore = sc; send({ type: 'word', total: sc });
    }, gap);
  },
  botOnGame() {},
  stop() { clearInterval(M.timer); M.timer = null; clearInterval(M.botTimer); M.botTimer = null; },
  getState() { return { rack: M.rack, used: [...M.used], myScore: M.myScore, oppScore: M.oppScore, timeLeft: M.timeLeft, myDone: M.myDone, oppDone: M.oppDone }; },
  restore(s, ctx) {
    M.rack = s.rack || []; M.used = new Set(s.used || []); M.myScore = s.myScore || 0; M.oppScore = s.oppScore || 0;
    M.timeLeft = s.timeLeft || 90; M.myDone = !!s.myDone; M.oppDone = !!s.oppDone; M.timer = null; M.botTimer = null;
    build(ctx); if (!M.myDone) startTimer(ctx);
  },
};
