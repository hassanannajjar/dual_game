// Looping "how to play" animations. demo(id, el, emoji) -> stop(). Pure visuals, no ctx/network.

const div = (cls, html) => { const n = document.createElement('div'); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };
function play(el, ms, frames) {
  let i = 0; frames[0] && frames[0]();
  const t = setInterval(() => { i = (i + 1) % frames.length; frames[i] && frames[i](); }, ms);
  return () => clearInterval(t);
}
const CELL = 'w-6 h-6 rounded flex items-center justify-center text-sm font-bold';

function place3(el) {
  el.innerHTML = ''; const g = div('grid grid-cols-3 gap-1 w-max mx-auto'); const c = [];
  for (let i = 0; i < 9; i++) { const x = div(CELL + ' bg-slate-800'); c.push(x); g.appendChild(x); } el.appendChild(g);
  const seq = [[0, 'X'], [4, 'O'], [1, 'X'], [5, 'O'], [2, 'X']];
  const frames = [() => c.forEach((x) => { x.textContent = ''; x.className = CELL + ' bg-slate-800'; })];
  for (const [i, m] of seq) frames.push(() => { c[i].textContent = m; c[i].className = CELL + ' bg-slate-800 ' + (m === 'X' ? 'text-indigo-400' : 'text-amber-400'); });
  frames.push(() => [0, 1, 2].forEach((i) => c[i].classList.add('ring-2', 'ring-emerald-400')));
  return play(el, 480, frames);
}
function drop4(el) {
  el.innerHTML = ''; const row = div('flex gap-1 justify-center'); const d = [];
  for (let i = 0; i < 4; i++) { const x = div('w-6 h-6 rounded-full bg-slate-700'); d.push(x); row.appendChild(x); } el.appendChild(row);
  const base = 'w-6 h-6 rounded-full ';
  const frames = [() => d.forEach((x) => x.className = base + 'bg-slate-700')];
  for (let i = 0; i < 4; i++) frames.push(() => d[i].className = base + 'bg-rose-500');
  frames.push(() => d.forEach((x) => x.className = base + 'bg-rose-500 ring-2 ring-emerald-400'));
  return play(el, 420, frames);
}
function flip(el) {
  el.innerHTML = ''; const row = div('flex gap-1 justify-center'); const d = [];
  const base = 'w-6 h-6 rounded-full ';
  const cols = ['bg-slate-950', 'bg-slate-950', 'bg-slate-100', 'bg-slate-950'];
  for (let i = 0; i < 4; i++) { const x = div(base + cols[i]); d.push(x); row.appendChild(x); } el.appendChild(row);
  const frames = [
    () => d.forEach((x, i) => x.className = base + cols[i]),
    () => { d[3].className = base + 'bg-slate-950'; d[1].className = base + 'bg-slate-950'; d[2].className = base + 'bg-slate-950'; },
  ];
  return play(el, 650, frames);
}
function dice(el) {
  el.innerHTML = ''; const w = div('text-center'); const de = div('text-5xl'); const s = div('text-xs text-slate-400 mt-1');
  w.append(de, s); el.appendChild(w);
  const P = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅']; const vals = [3, 5, 2, 6, 4, 1]; let tot = 0;
  const frames = vals.map((v) => () => { de.textContent = P[v]; tot = (tot + v) % 30; s.textContent = 'score ' + tot; });
  return play(el, 450, frames);
}
function guessing(el) {
  el.innerHTML = ''; const w = div('space-y-2'); const slots = div('flex gap-1 justify-center'); const s = [];
  for (let i = 0; i < 4; i++) { const c = div('w-6 h-8 rounded bg-slate-800 flex items-center justify-center font-mono text-sm'); s.push(c); slots.appendChild(c); }
  const pegs = div('flex gap-1 justify-center h-3'); w.append(slots, pegs); el.appendChild(w);
  const G = ['4', '2', '7', '9'];
  const peg = (c) => `<span class="inline-block w-2.5 h-2.5 rounded-full ${c}"></span>`;
  const frames = [
    () => { s.forEach((c) => c.textContent = ''); pegs.innerHTML = ''; },
    () => G.forEach((g, i) => s[i].textContent = g),
    () => pegs.innerHTML = peg('bg-emerald-400') + peg('bg-emerald-400') + peg('bg-amber-400') + peg('bg-slate-600'),
  ];
  return play(el, 640, frames);
}
function cards(el) {
  el.innerHTML = ''; const row = div('flex gap-2 justify-center'); const a = div('w-9 h-11 rounded-lg bg-slate-700 flex items-center justify-center text-xl'); const b = div('w-9 h-11 rounded-lg bg-slate-700 flex items-center justify-center text-xl');
  row.append(a, b); el.appendChild(row);
  const frames = [
    () => { a.textContent = '?'; b.textContent = '?'; a.className = b.className = 'w-9 h-11 rounded-lg bg-slate-700 flex items-center justify-center text-xl'; },
    () => { a.textContent = '🦊'; },
    () => { b.textContent = '🦊'; a.className = b.className = 'w-9 h-11 rounded-lg bg-emerald-700/60 flex items-center justify-center text-xl'; },
  ];
  return play(el, 620, frames);
}
function sticks(el) {
  el.innerHTML = ''; const row = div('flex gap-1.5 justify-center items-end h-12'); const s = [];
  for (let i = 0; i < 6; i++) { const x = div('w-2 h-10 rounded bg-indigo-400'); s.push(x); row.appendChild(x); } el.appendChild(row);
  const frames = [
    () => s.forEach((x) => x.style.visibility = 'visible'),
    () => { s[5].style.visibility = 'hidden'; s[4].style.visibility = 'hidden'; },
    () => { s[3].style.visibility = 'hidden'; },
    () => { s[2].style.visibility = 'hidden'; s[1].style.visibility = 'hidden'; },
  ];
  return play(el, 560, frames);
}
function moveDemo(el) {
  el.innerHTML = ''; const track = div('flex gap-1 justify-center'); const c = [];
  for (let i = 0; i < 5; i++) { const x = div('w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center'); c.push(x); track.appendChild(x); } el.appendChild(track);
  const dot = '<span class="w-4 h-4 rounded-full bg-emerald-500 block"></span>';
  const frames = [0, 2, 4].map((pos) => () => { c.forEach((x) => x.innerHTML = ''); c[pos].innerHTML = dot; });
  return play(el, 520, frames);
}
function rpsDemo(el) {
  el.innerHTML = ''; const w = div('text-4xl text-center');
  el.appendChild(w);
  const seq = ['🪨 vs ✂️', '📄 vs 🪨', '✂️ vs 📄'];
  return play(el, 700, seq.map((t) => () => w.textContent = t));
}
function tilesDemo(el) { // 2048
  el.innerHTML = ''; const g = div('grid grid-cols-4 gap-1 w-max mx-auto');
  const c = []; for (let i = 0; i < 16; i++) { const x = div('w-7 h-7 rounded bg-slate-800 flex items-center justify-center text-xs font-bold'); c.push(x); g.appendChild(x); } el.appendChild(g);
  const set = (i, v, cls) => { c[i].textContent = v || ''; c[i].className = 'w-7 h-7 rounded flex items-center justify-center text-xs font-bold ' + cls; };
  const frames = [
    () => { c.forEach((x) => set([...c].indexOf(x), 0, 'bg-slate-800')); set(0, 2, 'bg-slate-600'); set(1, 2, 'bg-slate-600'); },
    () => { set(0, 4, 'bg-amber-600'); set(1, 0, 'bg-slate-800'); },
    () => { set(0, 4, 'bg-amber-600'); set(3, 4, 'bg-amber-600'); },
    () => { set(0, 8, 'bg-orange-500'); set(3, 0, 'bg-slate-800'); },
  ];
  return play(el, 620, frames);
}
function fallDemo(el) { // tetris
  el.innerHTML = ''; const g = div('grid grid-cols-4 gap-0.5 w-max mx-auto'); const c = [];
  for (let i = 0; i < 20; i++) { const x = div('w-4 h-4 rounded-sm bg-slate-800'); c.push(x); g.appendChild(x); } el.appendChild(g);
  const on = (idx, cls) => idx.forEach((i) => c[i].className = 'w-4 h-4 rounded-sm ' + cls);
  const frames = [
    () => { c.forEach((x) => x.className = 'w-4 h-4 rounded-sm bg-slate-800'); on([0, 1], 'bg-cyan-400'); },
    () => { c.forEach((x) => x.className = 'w-4 h-4 rounded-sm bg-slate-800'); on([8, 9], 'bg-cyan-400'); },
    () => { c.forEach((x) => x.className = 'w-4 h-4 rounded-sm bg-slate-800'); on([16, 17, 18, 19], 'bg-emerald-400'); },
  ];
  return play(el, 460, frames);
}
function puckDemo(el) { // air hockey
  el.innerHTML = ''; const box = div('relative w-16 h-24 rounded-lg bg-slate-800 mx-auto border border-slate-600');
  const p = div('absolute w-3 h-3 rounded-full bg-slate-100'); box.appendChild(p); el.appendChild(box);
  const pos = [['10%', '20%'], ['60%', '50%'], ['30%', '80%'], ['60%', '50%']];
  return play(el, 400, pos.map(([t, l]) => () => { p.style.top = t; p.style.left = l; }));
}
function trailDemo(el) { // tron
  el.innerHTML = ''; const g = div('grid grid-cols-6 gap-px w-max mx-auto'); const c = [];
  for (let i = 0; i < 24; i++) { const x = div('w-4 h-4 bg-slate-800'); c.push(x); g.appendChild(x); } el.appendChild(g);
  const frames = [0, 1, 2, 3].map((n) => () => { c.forEach((x) => x.className = 'w-4 h-4 bg-slate-800'); for (let i = 6; i <= 6 + n; i++) c[i].className = 'w-4 h-4 bg-emerald-500'; for (let i = 17; i >= 17 - n; i--) c[i].className = 'w-4 h-4 bg-amber-500'; });
  return play(el, 420, frames);
}
function generic(el, emoji) {
  el.innerHTML = ''; const s = div('text-5xl text-center transition-transform', emoji || '🎮'); el.appendChild(s);
  let big = false;
  return play(el, 700, [() => { big = !big; s.style.transform = big ? 'scale(1.25)' : 'scale(1)'; }, () => { big = !big; s.style.transform = big ? 'scale(1.25)' : 'scale(1)'; }]);
}

const MAP = {
  ttt: place3, uttt: place3, gomoku: place3, order: place3, morris: place3, go: place3, hex: place3, chess: place3, battleship: place3,
  connect4: drop4, reversi: flip,
  pig: dice, snakes: dice, yahtzee: dice, ludo: dice, backgammon: dice,
  'number-duel': guessing, hangman: guessing,
  memory: cards, nim: sticks,
  checkers: moveDemo, chinesecheckers: moveDemo, mancala: moveDemo, dots: moveDemo,
  rps: rpsDemo,
  '2048': tilesDemo, tetris: fallDemo, airhockey: puckDemo, tron: trailDemo,
};

export function demo(id, el, emoji) {
  const fn = MAP[id];
  return fn ? fn(el) : generic(el, emoji);
}
