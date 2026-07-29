// Arcade engine — game-agnostic P2P shell. Games register() themselves; the engine
// drives phases: home -> connect -> lobby -> [setup] -> [toss] -> play -> over,
// and handles pause / disconnect-reconnect / refresh-resume.
// Depends on the global `Peer` (PeerJS, loaded via CDN).

// ---------- DOM helpers ----------
const $ = (id) => document.getElementById(id);
export function el(tag, cls, html) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
}
const SCREENS = ['home', 'connect', 'lobby', 'setup', 'toss', 'play', 'over'];
function show(name) { for (const s of SCREENS) $('screen-' + s).classList.toggle('hidden', s !== name); }
function setStatus(msg) { $('status').textContent = msg || ''; }
export function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.add('hidden'), 1800);
}

// ---------- registry ----------
const games = [];
export function register(def) { games.push(def); }
function gameById(id) { return games.find((g) => g.id === id); }

// ---------- state ----------
const S = {
  game: null, peer: null, conn: null, isHost: false,
  config: {}, working: {},
  myTurn: false, timerId: null, timerAuth: false, turnStart: 0, remaining: 0,
  myReady: false, oppReady: false, rematchGuard: false,
  inPlay: false, paused: false, reconnectTimer: null, leaving: false,
};

// ---------- persistence (localStorage) ----------
const SESSION_KEY = 'arcade:session';
const SESSION_TTL = 30 * 60 * 1000;
function persist() {
  if (!S.inPlay || !S.game) return;
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({
      v: 1, ts: Date.now(), gameId: S.game.id, roomCode: S.roomCode,
      isHost: S.isHost, config: S.config, myTurn: S.myTurn, remaining: S.remaining,
      state: S.game.getState ? S.game.getState() : null,
    }));
  } catch (e) {}
}
function loadSession() {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY));
    if (!s || s.v !== 1 || Date.now() - s.ts > SESSION_TTL || !gameById(s.gameId)) return null;
    return s;
  } catch (e) { return null; }
}
function clearSession() { try { localStorage.removeItem(SESSION_KEY); } catch (e) {} }

// ---------- networking ----------
function randomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}
function raw(obj) { if (S.conn && S.conn.open) S.conn.send(obj); }
function sys(type, payload) { raw(Object.assign({ scope: 'sys', type }, payload)); }
function gameSend(type, payload) { raw(Object.assign({ scope: 'game', type }, payload)); }

function wireConn(conn) {
  S.conn = conn;
  conn.on('data', onData);
  conn.on('open', () => {
    setStatus('Connected ✓');
    if (S.inPlay) { clearInterval(S.reconnectTimer); sys('resume'); resumeGame(); }
    else if (S.isHost) enterHostLobby();
  });
  conn.on('close', onDisconnect);
  conn.on('error', onDisconnect);
}
function onDisconnect() {
  if (S.leaving) return;
  if (S.conn && S.conn.open) return;      // ignore stale close/error from a replaced connection
  if (!S.inPlay) { setStatus('Disconnected'); return; }
  pauseGame('disconnect');
  startReconnect();
}
function startReconnect() {
  clearInterval(S.reconnectTimer);
  if (S.isHost) return;             // host keeps its Peer (id === roomCode) and waits for 'connection'
  S.reconnectTimer = setInterval(() => {
    if (S.conn && S.conn.open) return;
    try { wireConn(S.peer.connect(S.roomCode, { reliable: true })); } catch (e) {}
  }, 3000);
}
function spawnHostPeer() {                 // host reload: re-register the room-code id (retry past broker ghosts)
  S.peer = new Peer(S.roomCode);
  S.peer.on('connection', wireConn);
  S.peer.on('error', (err) => {
    if (err.type === 'unavailable-id') { try { S.peer.destroy(); } catch (e) {} setTimeout(spawnHostPeer, 1500); }
  });
}

function createRoom() {
  S.isHost = true;
  S.working = defaultConfig();
  const code = randomCode();
  S.peer = new Peer(code);
  setStatus('Creating room…');
  S.peer.on('open', (id) => { S.roomCode = id; enterHostLobby(); setStatus('Waiting for opponent…'); });
  S.peer.on('connection', wireConn);
  S.peer.on('error', (err) => {
    if (err.type === 'unavailable-id') { S.peer.destroy(); createRoom(); return; }
    setStatus('Error: ' + err.type);
  });
}
function joinRoom(code) {
  if (!code) { toast('Enter a room code'); return; }
  S.isHost = false;
  S.roomCode = code.toUpperCase();
  S.peer = new Peer();
  setStatus('Joining ' + S.roomCode + '…');
  S.peer.on('open', () => wireConn(S.peer.connect(S.roomCode, { reliable: true })));
  S.peer.on('error', (err) =>
    setStatus(err.type === 'peer-unavailable' ? 'Room not found. Check the code.' : 'Error: ' + err.type));
  enterGuestLobby();
}
function resetConnection() {
  try { S.conn && S.conn.close(); S.peer && S.peer.destroy(); } catch (e) {}
  S.conn = S.peer = null;
  clearInterval(S.timerId);
  clearInterval(S.reconnectTimer);
}

// ---------- message routing ----------
function onData(msg) {
  if (msg.scope === 'game') { S.game && S.game.onMessage && S.game.onMessage(msg, ctx); return; }
  switch (msg.type) {
    case 'config':
      S.game = gameById(msg.gameId) || S.game;
      S.config = msg.config;
      proceedAfterConfig();
      break;
    case 'ready':
      S.oppReady = true;
      if (S.myReady) afterReady();
      break;
    case 'toss':
      runToss(!msg.firstIsHost);
      break;
    case 'pass':
      setTurn(true);
      break;
    case 'rematch':
      if (!S.rematchGuard) restartMatch(false);
      break;
    case 'pause':
      pauseGame('manual');
      break;
    case 'resume-play':
      resumeGame();
      break;
    case 'resume':
      clearInterval(S.reconnectTimer);
      resumeGame();
      break;
  }
}

// ---------- home ----------
function renderHome() {
  const grid = $('game-grid');
  grid.innerHTML = '';
  for (const g of games) {
    const card = el('button',
      'group flex flex-col items-start gap-1 p-4 rounded-2xl bg-slate-800/80 border border-slate-700 ' +
      'hover:border-indigo-500 hover:shadow-[0_0_25px_-5px] hover:shadow-indigo-500/60 transition text-left');
    card.innerHTML =
      `<span class="text-4xl">${g.emoji}</span>` +
      `<span class="font-bold text-lg">${g.name}</span>` +
      `<span class="text-xs text-slate-400">${g.blurb}</span>`;
    card.onclick = () => selectGame(g.id);
    grid.appendChild(card);
  }
}
function selectGame(id) {
  S.game = gameById(id);
  $('connect-title').textContent = `${S.game.emoji} ${S.game.name}`;
  $('join-code').value = '';
  show('connect');
}

// ---------- lobby / config ----------
function optionSchema() {
  const opts = (S.game.options || []).slice();
  if (S.game.usesTurns !== false) {
    opts.push({ key: 'timer', label: 'Turn timer',
      choices: [{ label: '30s', value: 30 }, { label: '60s', value: 60 }, { label: 'Off', value: 0 }], default: 30 });
  }
  return opts;
}
function defaultConfig() {
  const c = {};
  for (const o of optionSchema()) c[o.key] = o.default;
  return c;
}
function renderOptions() {
  const box = $('lobby-options');
  box.innerHTML = '';
  for (const o of optionSchema()) {
    box.appendChild(el('label', 'block text-sm text-slate-400 mb-1', o.label));
    const row = el('div', 'grid grid-cols-3 gap-2 mb-4');
    for (const ch of o.choices) {
      const b = el('button', 'py-2 rounded-lg font-semibold transition ' +
        (S.working[o.key] === ch.value ? 'bg-indigo-600' : 'bg-slate-700 hover:bg-slate-600'), ch.label);
      b.onclick = () => { S.working[o.key] = ch.value; renderOptions(); };
      row.appendChild(b);
    }
    box.appendChild(row);
  }
}
function enterHostLobby() {
  if (!S.roomCode) return;
  show('lobby');
  $('lobby-host').classList.remove('hidden');
  $('room-code').textContent = S.roomCode;
  renderOptions();
  const start = $('btn-start');
  const connected = S.conn && S.conn.open;
  start.disabled = !connected;
  start.textContent = connected ? 'Start Game' : 'Waiting for opponent…';
}
function enterGuestLobby() {
  show('lobby');
  $('lobby-host').classList.add('hidden');
  $('room-code').textContent = S.roomCode;
  $('btn-start').classList.add('hidden');
  $('lobby-wait').classList.remove('hidden');
}

// ---------- phase flow ----------
function proceedAfterConfig() {
  S.myReady = S.oppReady = false;
  if (S.game.setup) enterSetup();
  else { S.myReady = S.oppReady = true; afterReady(); }
}
function enterSetup() {
  show('setup');
  $('setup-title').textContent = `${S.game.emoji} ${S.game.name}`;
  ctx.setupRoot.innerHTML = '';
  S.game.setup(ctx);
}
function localReady() {
  S.myReady = true;
  sys('ready');
  if (S.oppReady) afterReady();
}
function afterReady() {
  if (S.game.usesTurns === false) { startGame(false); return; }
  if (S.isHost) {
    const firstIsHost = Math.random() < 0.5;
    sys('toss', { firstIsHost });
    runToss(firstIsHost);
  }
}
function runToss(iAmFirst) {
  show('toss');
  const coin = $('coin');
  coin.classList.add('coin-flip');
  $('toss-result').textContent = 'Tossing…';
  setTimeout(() => {
    coin.classList.remove('coin-flip');
    coin.textContent = iAmFirst ? '★' : '☆';
    $('toss-result').textContent = iAmFirst ? 'You go first!' : 'Opponent goes first.';
    setTimeout(() => startGame(iAmFirst), 1300);
  }, 2000);
}
function preparePlayScreen() {
  show('play');
  $('game-title').textContent = `${S.game.emoji} ${S.game.name}`;
  ctx.root.innerHTML = '';
  const turnsOn = S.game.usesTurns !== false;
  $('turn-bar').classList.toggle('hidden', !turnsOn);
  $('pause-overlay').classList.add('hidden');
  return turnsOn;
}
function startGame(iAmFirst) {
  S.inPlay = true; S.paused = false;
  const turnsOn = preparePlayScreen();
  S.game.start(ctx, { iAmFirst });
  if (turnsOn) setTurn(iAmFirst); else persist();
}

// ---------- turn + timer ----------
function updateTurnLabel() {
  $('turn-label').textContent = S.myTurn ? 'Your turn' : "Opponent's turn";
  $('turn-label').className = 'font-semibold ' + (S.myTurn ? 'text-emerald-400' : 'text-slate-400');
}
function setTurn(mine) {
  S.myTurn = mine;
  updateTurnLabel();
  S.remaining = S.config.timer;
  startTimer(mine);
  S.game.onTurn && S.game.onTurn(mine, ctx);
  persist();
}
function startTimer(authoritative) {
  clearInterval(S.timerId);
  S.timerAuth = authoritative;
  const dur = S.config.timer;
  const tEl = $('timer');
  if (!dur) { tEl.classList.add('hidden'); return; }
  tEl.classList.remove('hidden');
  S.turnStart = Date.now();
  const render = () => { tEl.textContent = S.remaining + 's'; tEl.classList.toggle('text-rose-400', S.remaining <= 5); };
  render();
  S.timerId = setInterval(() => {
    S.remaining--;
    if (S.remaining <= 0) { clearInterval(S.timerId); tEl.textContent = '0s'; if (authoritative) onTimeout(); }
    else render();
  }, 1000);
}
function onTimeout() {
  if (S.game.onTimeout) S.game.onTimeout(ctx);
  else { sys('pass'); setTurn(false); }
}
export function elapsed() { return S.turnStart ? Math.max(0, Math.round((Date.now() - S.turnStart) / 1000)) : 0; }

// ---------- pause / resume ----------
function pauseGame(reason) {
  if (!S.inPlay) return;
  S.paused = true;
  clearInterval(S.timerId);                 // freeze; S.remaining holds the clock
  const manual = reason === 'manual';
  $('pause-msg').textContent = manual ? 'Paused' : 'Opponent disconnected — reconnecting…';
  $('btn-resume').classList.toggle('hidden', !manual);
  $('pause-overlay').classList.remove('hidden');
  if (!manual) setStatus('Reconnecting…');
  persist();
}
function resumeGame() {
  if (!S.inPlay || !S.paused) return;
  S.paused = false;
  clearInterval(S.reconnectTimer);
  $('pause-overlay').classList.add('hidden');
  setStatus('Connected ✓');
  if (S.game.usesTurns !== false) startTimer(S.myTurn);   // continue from S.remaining
  persist();
}

// ---------- resume after refresh ----------
function resumePlay(state) {
  S.inPlay = true;
  const turnsOn = preparePlayScreen();
  if (S.game.restore) S.game.restore(state, ctx);
  else S.game.start(ctx, { iAmFirst: S.myTurn });
  if (turnsOn) { updateTurnLabel(); S.game.onTurn && S.game.onTurn(S.myTurn, ctx); }
  pauseGame('disconnect');                  // stay frozen until the channel is back
}
function reconnect() {
  if (S.isHost) spawnHostPeer();
  else {
    S.peer = new Peer();
    S.peer.on('open', () => startReconnect());
    S.peer.on('error', () => {});
  }
}

// ---------- game over / rematch / home ----------
function endGame(outcome, msg) {
  clearInterval(S.timerId);
  clearInterval(S.reconnectTimer);
  S.inPlay = false; S.paused = false;
  clearSession();
  $('pause-overlay').classList.add('hidden');
  show('over');
  const map = { win: ['🏆', 'You win!'], lose: ['💥', 'You lose'], draw: ['🤝', "It's a draw"] };
  const [emoji, title] = map[outcome] || map.lose;
  $('over-emoji').textContent = emoji;
  $('over-title').textContent = title;
  $('over-sub').textContent = msg || '';
}
function restartMatch(initiator) {
  S.rematchGuard = true;
  if (initiator) sys('rematch');
  clearSession();
  proceedAfterConfig();
  setTimeout(() => { S.rematchGuard = false; }, 500);
}
function goHome() {
  S.leaving = true;
  S.inPlay = false; S.paused = false;
  clearSession();
  clearInterval(S.reconnectTimer);
  $('pause-overlay').classList.add('hidden');
  resetConnection();
  S.game = null;
  show('home');
  setStatus('');
  setTimeout(() => { S.leaving = false; }, 300);
}

// ---------- ctx passed to games ----------
const ctx = {
  get root() { return $('game-root'); },
  get setupRoot() { return $('setup-root'); },
  get isHost() { return S.isHost; },
  get config() { return S.config; },
  get myTurn() { return S.myTurn; },
  el, toast, elapsed,
  send: gameSend,
  setTurn,
  ready: localReady,
  endGame,
  save: persist,
};

// ---------- boot ----------
export function boot() {
  renderHome();
  $('btn-create').onclick = createRoom;
  $('btn-join').onclick = () => joinRoom($('join-code').value.trim().toUpperCase());
  $('btn-copy').onclick = () => {
    const link = `${location.origin}${location.pathname}?g=${S.game.id}&room=${S.roomCode}`;
    navigator.clipboard.writeText(link).then(() => toast('Invite link copied'), () => toast(link));
  };
  $('btn-start').onclick = () => {
    if (!(S.conn && S.conn.open)) return;
    S.config = Object.assign({}, S.working);
    sys('config', { gameId: S.game.id, config: S.config });
    proceedAfterConfig();
  };
  $('btn-rematch').onclick = () => restartMatch(true);
  $('btn-pause').onclick = () => { pauseGame('manual'); sys('pause'); };
  $('btn-resume').onclick = () => { resumeGame(); sys('resume-play'); };
  $('btn-pause-leave').onclick = goHome;
  for (const id of ['btn-home', 'btn-home-play', 'btn-over-home', 'btn-back-connect', 'btn-back-lobby']) {
    const b = $(id); if (b) b.onclick = goHome;
  }

  // Refresh auto-resume: restore an in-progress match and reconnect.
  const sess = loadSession();
  if (sess) {
    S.game = gameById(sess.gameId);
    S.roomCode = sess.roomCode; S.isHost = sess.isHost;
    S.config = sess.config; S.myTurn = sess.myTurn; S.remaining = sess.remaining;
    resumePlay(sess.state);
    reconnect();
    return;
  }

  // Deep link: ?g=<id>&room=<code>
  const p = new URLSearchParams(location.search);
  const gid = p.get('g'), room = p.get('room');
  if (gid && gameById(gid)) {
    S.game = gameById(gid);
    if (room) { joinRoom(room); return; }
    selectGame(gid);
  }
}
