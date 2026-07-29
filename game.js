'use strict';
// Number Duel — P2P game logic. Depends on evaluate.js (global `evaluate`) and PeerJS (global `Peer`).

// ---------- tiny DOM helpers ----------
const $ = (id) => document.getElementById(id);
const screens = ['landing', 'lobby', 'secret', 'toss', 'play', 'over'];
function show(name) {
  for (const s of screens) $('screen-' + s).classList.toggle('hidden', s !== name);
}
function setStatus(msg) { $('status').textContent = msg; }
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.add('hidden'), 1800);
}

// ---------- game state ----------
const G = {
  isHost: false,
  peer: null,
  conn: null,
  config: { length: 4, timer: 30 },
  secret: null,        // my secret, never sent
  myReady: false,
  oppReady: false,
  myTurn: false,
  guessNo: 0,          // my guess counter
  oppNo: 0,            // opponent guess counter
  timerId: null,
  turnStart: 0,
  rematchPending: false,
};

function send(type, payload) {
  if (G.conn && G.conn.open) G.conn.send(Object.assign({ type }, payload));
}

// ---------- connection ----------
function randomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no confusing O/0/I/1
  let s = '';
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function wireConn(conn) {
  G.conn = conn;
  conn.on('data', handle);
  conn.on('open', () => {
    setStatus('Opponent connected ✓');
    if (G.isHost) $('btn-start').removeAttribute('disabled'), ($('btn-start').textContent = 'Start Game');
  });
  conn.on('close', onDisconnect);
  conn.on('error', onDisconnect);
}

function onDisconnect() {
  setStatus('Opponent disconnected.');
  // If a match was underway, end it; otherwise just surface the status.
  if (!$('screen-play').classList.contains('hidden') || !$('screen-secret').classList.contains('hidden')) {
    endGame(false, 'Opponent left the game.');
  }
}

function createRoom() {
  G.isHost = true;
  const code = randomCode();
  G.peer = new Peer(code);
  setStatus('Creating room…');
  G.peer.on('open', (id) => {
    $('room-code').textContent = id;
    show('lobby');
    $('lobby-host').classList.remove('hidden');
    setStatus('Share the code — waiting for opponent…');
  });
  G.peer.on('connection', (conn) => wireConn(conn));
  G.peer.on('error', (err) => {
    if (err.type === 'unavailable-id') { G.peer.destroy(); createRoom(); return; } // code collision, retry
    setStatus('Connection error: ' + err.type);
  });
}

function joinRoom(code) {
  if (!code) { toast('Enter a room code'); return; }
  G.isHost = false;
  G.peer = new Peer();
  setStatus('Joining ' + code + '…');
  G.peer.on('open', () => wireConn(G.peer.connect(code, { reliable: true })));
  G.peer.on('error', (err) => {
    setStatus(err.type === 'peer-unavailable' ? 'Room not found. Check the code.' : 'Error: ' + err.type);
  });
  // Guest sees a lobby that waits for host config.
  show('lobby');
  $('lobby-host').classList.add('hidden');
  $('room-code').textContent = code.toUpperCase();
  $('btn-start').textContent = 'Waiting for host to start…';
}

// ---------- message handling ----------
function handle(msg) {
  switch (msg.type) {
    case 'config':
      G.config = msg.config;
      enterSecretPhase();
      break;
    case 'ready':
      G.oppReady = true;
      maybeToss();
      break;
    case 'coinToss':
      startToss(G.isHost ? msg.firstIsHost : !msg.firstIsHost);
      break;
    case 'guess':
      receiveGuess(msg.digits);
      break;
    case 'feedback':
      receiveFeedback(msg);
      break;
    case 'timeout':
      logRow('opp', ++G.oppNo, msg.digits || '—', '⏱ time out', '');
      takeTurn();
      break;
    case 'rematch':
      if (!G.rematchPending) doRematch(false);
      break;
  }
}

// ---------- lobby / config ----------
function buildOptions() {
  const lengths = [3, 4, 5], timers = [30, 60];
  const mk = (parent, values, cur, pick, fmt) => {
    parent.innerHTML = '';
    values.forEach((v) => {
      const b = document.createElement('button');
      b.textContent = fmt(v);
      b.className = 'py-2 rounded-lg font-semibold transition ' +
        (v === cur() ? 'bg-indigo-600' : 'bg-slate-700 hover:bg-slate-600');
      b.onclick = () => { pick(v); buildOptions(); };
      parent.appendChild(b);
    });
  };
  mk($('opt-length'), lengths, () => G.config.length, (v) => G.config.length = v, (v) => v + ' digits');
  mk($('opt-timer'), timers, () => G.config.timer, (v) => G.config.timer = v, (v) => v + 's');
}

// ---------- secret phase ----------
function enterSecretPhase() {
  G.myReady = G.oppReady = false;
  G.secret = null;
  show('secret');
  const n = G.config.length;
  $('secret-hint').textContent = `Enter a ${n}-digit number (digits 0–9, repeats allowed).`;
  const inp = $('secret-input');
  inp.value = '';
  inp.maxLength = n;
  inp.disabled = false;
  $('btn-lock').disabled = false;
  $('secret-status').textContent = '';
  inp.focus();
}

function lockSecret() {
  const n = G.config.length;
  const v = $('secret-input').value.trim();
  if (!new RegExp(`^\\d{${n}}$`).test(v)) { toast(`Need exactly ${n} digits`); return; }
  G.secret = v;
  G.myReady = true;
  $('secret-input').disabled = true;
  $('btn-lock').disabled = true;
  $('secret-status').textContent = 'Locked. Waiting for opponent…';
  send('ready', {});
  maybeToss();
}

// ---------- coin toss (host authority) ----------
function maybeToss() {
  if (G.isHost && G.myReady && G.oppReady) {
    const firstIsHost = Math.random() < 0.5;
    send('coinToss', { firstIsHost });
    startToss(firstIsHost);
  }
}

function startToss(iAmFirst) {
  show('toss');
  const coin = $('coin');
  coin.classList.add('coin-flip');
  $('toss-result').textContent = 'Tossing…';
  setTimeout(() => {
    coin.classList.remove('coin-flip');
    coin.textContent = iAmFirst ? '★' : '☆';
    $('toss-result').textContent = iAmFirst ? 'You go first!' : 'Opponent goes first.';
    setTimeout(() => startPlay(iAmFirst), 1400);
  }, 2400);
}

// ---------- play ----------
function startPlay(iAmFirst) {
  G.guessNo = G.oppNo = 0;
  $('log-you').innerHTML = '';
  $('log-opp').innerHTML = '';
  const g = $('guess-input');
  g.value = '';
  g.maxLength = G.config.length;
  show('play');
  if (iAmFirst) takeTurn(); else giveUpTurn();
}

function renderTurn() {
  $('turn-label').textContent = G.myTurn ? 'Your turn' : "Opponent's turn";
  $('guess-input').disabled = !G.myTurn;
  $('btn-guess').disabled = !G.myTurn;
  if (G.myTurn) $('guess-input').focus();
}

function takeTurn() {
  G.myTurn = true;
  renderTurn();
  runTimer(true);
}
function giveUpTurn() {
  G.myTurn = false;
  renderTurn();
  runTimer(false); // display-only mirror
}

function runTimer(authoritative) {
  clearInterval(G.timerId);
  let remaining = G.config.timer;
  G.turnStart = Date.now();
  const render = () => { $('timer').textContent = remaining + 's'; };
  render();
  G.timerId = setInterval(() => {
    remaining--;
    if (remaining <= 0) {
      clearInterval(G.timerId);
      $('timer').textContent = '0s';
      if (authoritative) onTimeout();
    } else render();
  }, 1000);
}

function submitGuess() {
  if (!G.myTurn) return;
  const n = G.config.length;
  const v = $('guess-input').value.trim();
  if (!new RegExp(`^\\d{${n}}$`).test(v)) { toast(`Enter ${n} digits`); return; }
  $('guess-input').value = '';
  send('guess', { digits: v });
  giveUpTurn(); // hand turn to opponent; await feedback for our own log
  G._pending = v;
}

function onTimeout() {
  send('timeout', {});
  logRow('you', ++G.guessNo, '—', '⏱ time out', '');
  giveUpTurn();
}

// opponent guessed our number -> we evaluate against our secret
function receiveGuess(digits) {
  const { exact, partial } = evaluate(G.secret, digits);
  const win = exact === G.config.length;
  send('feedback', { digits, exact, partial, win });
  logRow('opp', ++G.oppNo, digits, fmtFeedback(exact, partial), elapsed());
  if (win) endGame(false, 'Opponent cracked your number.');
  else takeTurn();
}

// result of our own guess comes back
function receiveFeedback(msg) {
  logRow('you', ++G.guessNo, msg.digits, fmtFeedback(msg.exact, msg.partial), elapsed());
  if (msg.win) endGame(true, `You cracked it in ${G.guessNo} guesses!`);
}

function elapsed() {
  return G.turnStart ? Math.max(0, Math.round((Date.now() - G.turnStart) / 1000)) + 's' : '';
}

function fmtFeedback(exact, partial) {
  return `<span class="text-emerald-400">${exact} exact</span> · <span class="text-amber-400">${partial} partial</span>`;
}

function logRow(which, no, digits, result, time) {
  const ul = $(which === 'you' ? 'log-you' : 'log-opp');
  const li = document.createElement('li');
  li.className = 'flex items-center justify-between gap-2 bg-slate-900 rounded-lg px-2 py-1';
  li.innerHTML =
    `<span class="text-slate-500 w-4">${no}</span>` +
    `<span class="font-mono tracking-widest flex-1">${digits}</span>` +
    `<span class="text-right">${result}</span>` +
    (time ? `<span class="text-slate-600 text-xs ml-1">${time}</span>` : '');
  ul.appendChild(li);
  ul.scrollTop = ul.scrollHeight;
}

// ---------- game over ----------
function endGame(iWon, sub) {
  clearInterval(G.timerId);
  show('over');
  $('over-emoji').textContent = iWon ? '🏆' : '💥';
  $('over-title').textContent = iWon ? 'You win!' : 'You lose';
  $('over-sub').textContent = sub || '';
}

function doRematch(initiator) {
  G.rematchPending = true;
  if (initiator) send('rematch', {});
  enterSecretPhase();
  G.rematchPending = false;
}

// ---------- wiring ----------
function init() {
  buildOptions();
  $('btn-create').onclick = createRoom;
  $('btn-join').onclick = () => joinRoom($('join-code').value.trim().toUpperCase());
  $('btn-copy').onclick = () => {
    const link = location.origin + location.pathname + '?room=' + $('room-code').textContent;
    navigator.clipboard.writeText(link).then(() => toast('Invite link copied'),
      () => toast(link));
  };
  $('btn-start').onclick = () => {
    if (!G.conn || !G.conn.open) return;
    send('config', { config: G.config });
    enterSecretPhase();
  };
  $('btn-lock').onclick = lockSecret;
  $('btn-guess').onclick = submitGuess;
  $('guess-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') submitGuess(); });
  $('secret-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') lockSecret(); });
  $('btn-rematch').onclick = () => doRematch(true);
  $('btn-quit').onclick = () => location.href = location.origin + location.pathname;

  // Auto-join via ?room= invite link.
  const room = new URLSearchParams(location.search).get('room');
  if (room) { $('join-code').value = room.toUpperCase(); joinRoom(room.toUpperCase()); }
}

document.addEventListener('DOMContentLoaded', init);
