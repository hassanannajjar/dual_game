// Arcade engine — game-agnostic P2P shell. Games register() themselves; the engine
// drives phases: home -> connect -> lobby -> [setup] -> [toss] -> play -> over,
// and handles pause / disconnect-reconnect / refresh-resume.
// Depends on the global `Peer` (PeerJS, loaded via CDN).
import { t, initLang, onLangChange } from './i18n.js?v=17';
import { sound } from './sound.js?v=17';
import { initPrefs, getName, setName, haptic } from './prefs.js?v=17';
import { demo } from './demos.js?v=17';
import { goOnline as presenceOnline, goOffline as presenceOffline, onLeaderboard, publishScore } from './presence.js?v=17';
import { recordResult, getRating, overallRating, openProfile, closeProfile, initProfile } from './profile.js?v=17';
import { claimDaily, getLevel, getCoins, setNotify } from './loyalty.js?v=17';
import { getUid } from './identity.js?v=17';

// ---------- DOM helpers ----------
const $ = (id) => document.getElementById(id);
export function el(tag, cls, html) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
}
const SCREENS = ['home', 'online', 'connect', 'lobby', 'setup', 'toss', 'play'];
function stopHowto() { if (S.demoStop) { S.demoStop(); S.demoStop = null; } }
function show(name) {
  if (name !== 'connect') stopHowto();
  for (const s of SCREENS) $('screen-' + s).classList.toggle('hidden', s !== name);
}
function setStatus(msg) { $('status').textContent = msg || ''; }
export function toast(msg) {
  const n = $('toast');
  n.textContent = msg;
  n.classList.remove('hidden');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => n.classList.add('hidden'), 1800);
}

// ---------- registry ----------
const games = [];
export function register(def) { games.push(def); }
function gameById(id) { return games.find((g) => g.id === id); }
function gameName(g) { const k = 'g_' + g.id.replace(/-/g, '_'); const s = t(k); return s === k ? g.name : s; }
function gameDesc(g) { const k = 'd_' + g.id.replace(/-/g, '_'); const s = t(k); return s === k ? (g.blurb || '') : s; }
function gameRules(g) { const k = 'r_' + g.id.replace(/-/g, '_'); const s = t(k); return s === k ? (g.blurb || '') : s; }
function gameTitle(g) { return `${g.emoji} ${gameName(g)}`; }

// ---------- state ----------
const S = {
  game: null, peer: null, conn: null, isHost: false,
  config: {}, working: {},
  myTurn: false, timerId: null, timerAuth: false, turnStart: 0, remaining: 0,
  myReady: false, oppReady: false, rematchGuard: false,
  inPlay: false, paused: false, over: false, reconnectTimer: null, leaving: false,
  oppName: '', lastLoserIsHost: null, homeFilter: 'all', homeSearch: '',
  oppRating: null, series: { me: 0, opp: 0, key: null }, unread: 0,
};

// ---------- persistence (localStorage) ----------
const SESSION_KEY = 'arcade:session';
const SESSION_TTL = 30 * 60 * 1000;
function persist() {
  if (!S.inPlay || !S.game || S.game.realtime || S.vsBot || S.solo) return;
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
    setStatus(t('connected'));
    sound('join');
    sys('hello', { name: getName() });
    if (S.inPlay) { clearInterval(S.reconnectTimer); sys('resume'); resumeGame(); }
    else if (S.isHost) enterHostLobby();
  });
  conn.on('close', onDisconnect);
  conn.on('error', onDisconnect);
}
function onDisconnect() {
  if (S.leaving) return;
  if (S.conn && S.conn.open) return;      // ignore stale close/error from a replaced connection
  if (!S.inPlay) { setStatus(t('disconnected')); return; }
  if (S.game && S.game.realtime) { endGame('lose', t('opp_left')); return; } // live games can't pause/rejoin
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
  S.isHost = true; S.vsBot = false; S.solo = false;
  S.working = defaultConfig();
  const code = randomCode();
  S.peer = new Peer(code);
  setStatus('Creating room…');
  S.peer.on('open', (id) => { S.roomCode = id; enterHostLobby(); setStatus(t('waiting_opp')); });
  S.peer.on('connection', wireConn);
  S.peer.on('error', (err) => {
    if (err.type === 'unavailable-id') { S.peer.destroy(); createRoom(); return; }
    setStatus('Error: ' + err.type);
  });
}
function joinRoom(code) {
  if (!code) { toast('Enter a room code'); return; }
  S.isHost = false; S.vsBot = false; S.solo = false;
  S.roomCode = code.toUpperCase();
  S.peer = new Peer();
  setStatus('Joining ' + S.roomCode + '…');
  S.peer.on('open', () => wireConn(S.peer.connect(S.roomCode, { reliable: true })));
  S.peer.on('error', (err) =>
    setStatus(err.type === 'peer-unavailable' ? t('room_not_found') : 'Error: ' + err.type));
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
      if (msg.rating != null) S.oppRating = msg.rating;
      proceedAfterConfig();
      break;
    case 'ready':
      S.oppReady = true;
      if (msg.rating != null) S.oppRating = msg.rating;
      if (S.myReady) afterReady();
      break;
    case 'chat':
      addChatMessage((msg.text || '').slice(0, 140), false);
      break;
    case 'emote':
      floatEmote(msg.emoji);
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
    case 'hello':
      S.oppName = (msg.name || '').slice(0, 16);
      if (!$('screen-play').classList.contains('hidden')) updateTurnLabel();
      break;
    case 'changegame':
      teardownGame();
      S.game = gameById(msg.gameId) || S.game;
      if (S.isHost) enterHostLobby(); else enterGuestLobby();
      break;
    case 'invite':
      S.pendingInvite = { fromId: msg.fromId, name: msg.name };
      $('invite-text').textContent = t('invited_by', { name: msg.name || 'Player' });
      $('invite-panel').classList.remove('hidden');
      break;
    case 'invite-accept':
      beginInvitedGame(true);
      break;
    case 'invite-declined':
      toast(t('invite_declined', { name: S.pendingInviteeName || '' }));
      try { S.conn && S.conn.close(); } catch (e) {}
      S.conn = null; S.isHost = false;
      break;
  }
}

// ---------- home ----------
const CATS = ['classic', 'strategy', 'puzzle', 'arcade', 'luck', 'word'];
const DIFF_COLOR = { easy: 'text-emerald-400', medium: 'text-amber-400', hard: 'text-rose-400' };
function renderChips() {
  const box = $('cat-chips'); box.innerHTML = '';
  for (const key of ['all', ...CATS]) {
    const active = (S.homeFilter || 'all') === key;
    const b = el('button', 'shrink-0 px-3 py-1.5 rounded-full text-sm font-semibold transition ' +
      (active ? 'bg-indigo-600' : 'bg-slate-800 text-slate-400 hover:text-slate-200'), t(key === 'all' ? 'all_games' : 'cat_' + key));
    b.onclick = () => { S.homeFilter = key; renderHome(); };
    box.appendChild(b);
  }
}
function gameCard(g, onPick) {
  const card = el('button', 'group flex items-center gap-3 p-3 rounded-2xl bg-slate-800/70 border border-slate-700 ' +
    'hover:border-indigo-500 hover:shadow-[0_0_25px_-6px] hover:shadow-indigo-500/60 active:scale-[0.98] transition text-start w-full');
  const diff = g.difficulty || 'medium';
  card.innerHTML =
    `<span class="text-3xl w-10 text-center shrink-0">${g.emoji}</span>` +
    `<span class="flex-1 min-w-0">` +
      `<span class="block font-bold truncate">${gameName(g)}</span>` +
      `<span class="block text-xs text-slate-400 truncate">${gameDesc(g)}</span>` +
      `<span class="mt-1 inline-flex gap-1.5 text-[10px]">` +
        `<span class="px-1.5 py-0.5 rounded bg-slate-700 text-slate-300">${t('players2')}</span>` +
        `<span class="px-1.5 py-0.5 rounded bg-slate-700 ${DIFF_COLOR[diff]}">${t('diff_' + diff)}</span>` +
      `</span>` +
    `</span>`;
  card.onclick = () => onPick(g.id);
  return card;
}
function buildSections(container, onPick, filterCat, q) {
  container.innerHTML = '';
  const match = (g) => !q || gameName(g).toLowerCase().includes(q) || gameDesc(g).toLowerCase().includes(q) || g.name.toLowerCase().includes(q);
  let any = false;
  for (const cat of CATS) {
    if (filterCat && filterCat !== 'all' && filterCat !== cat) continue;
    const list = games.filter((g) => (g.category || 'classic') === cat && match(g));
    if (!list.length) continue;
    any = true;
    const sec = el('div', 'mb-5');
    sec.appendChild(el('h2', 'text-xs font-bold uppercase tracking-wider text-slate-500 mb-2', t('cat_' + cat)));
    const grid = el('div', 'grid grid-cols-1 sm:grid-cols-2 gap-3');
    for (const g of list) grid.appendChild(gameCard(g, onPick));
    sec.appendChild(grid);
    container.appendChild(sec);
  }
  if (!any) container.appendChild(el('p', 'text-center text-slate-500 py-8', t('no_results')));
}
function renderHome() {
  renderChips();
  buildSections($('game-sections'), selectGame, S.homeFilter, (S.homeSearch || '').trim().toLowerCase());
}
// ---------- in-room game picker ----------
function openPicker() {
  if (!(S.conn && S.conn.open)) return;              // only meaningful while in a room
  buildSections($('picker-list'), changeGame, 'all', '');
  $('picker-panel').classList.remove('hidden');
}
function closePicker() { $('picker-panel').classList.add('hidden'); }
function teardownGame() {
  if (S.game && S.game.stop) S.game.stop();
  clearInterval(S.timerId); clearInterval(S.reconnectTimer);
  S.inPlay = false; S.over = false; S.paused = false;
  clearSession();
  $('pause-overlay').classList.add('hidden');
  $('result-bar').classList.add('hidden');
  $('help-panel').classList.add('hidden');
}
function changeGame(id) {
  closePicker();
  teardownGame();
  S.game = gameById(id);
  if (S.conn && S.conn.open) {
    sys('changegame', { gameId: id });
    if (S.isHost) enterHostLobby(); else enterGuestLobby();
  } else selectGame(id);
}

// ---------- solo / bot (loopback opponent) ----------
function botSend(msg) { if (msg) onData(Object.assign({ scope: 'game' }, msg)); }
function loopbackSend(obj) {
  if (S.vsBot && obj && obj.scope === 'game' && S.game && S.game.botOnGame) {
    setTimeout(() => S.game.botOnGame(obj, botSend, S.botLevel), 350);
  }
}
function loopbackConn(withBot) { return { open: true, send: withBot ? loopbackSend : function () {}, close: function () {} }; }
function startSolo() {
  S.solo = true; S.vsBot = false; S.isHost = true; S.roomCode = 'SOLO';
  S.conn = loopbackConn(false);
  S.config = Object.assign({}, defaultConfig());
  proceedAfterConfig();
}
function startBot() {
  S.vsBot = true; S.solo = false; S.isHost = true; S.botLevel = S.botLevelSel || 'medium'; S.roomCode = 'BOT';
  S.oppName = t('bot');
  S.conn = loopbackConn(true);
  S.working = defaultConfig();
  enterHostLobby();
}
function scheduleBotMove() {
  if (!(S.vsBot && S.inPlay && !S.over && !S.paused && S.game && S.game.botMove)) return;
  setTimeout(() => {
    if (!(S.vsBot && S.inPlay && !S.over && !S.myTurn)) return;
    const m = S.game.botMove(S.botLevel);
    if (Array.isArray(m)) { for (const x of m) { if (S.over) break; botSend(x); } } else botSend(m);
  }, 450);
}

// ---------- online lobby (presence over MQTT) + invites ----------
const esc = (s) => String(s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
function openOnlineLobby() {
  show('online');
  $('online-name').value = getName() || '';
  try { $('online-circle').value = localStorage.getItem('arcade:circle') || ''; } catch (e) {}
  $('online-status').textContent = '';
  $('online-list').innerHTML = '';
  $('btn-go-online').textContent = t(S.inLobby ? 'go_offline' : 'go_online');
}
function ensureLobbyPeer(cb) {
  if (S.lobbyPeer && S.lobbyPeer.open) { cb(S.lobbyPeer.id); return; }
  S.lobbyPeer = new Peer();
  S.lobbyPeer.on('open', (id) => cb(id));
  S.lobbyPeer.on('connection', onLobbyConn);
  S.lobbyPeer.on('error', () => { $('online-status').textContent = 'Error'; });
}
function toggleOnline() {
  if (S.inLobby) { presenceOffline(); S.inLobby = false; $('btn-go-online').textContent = t('go_online'); $('online-status').textContent = ''; $('online-list').innerHTML = ''; renderLeaderboard([]); return; }
  const name = ($('online-name').value.trim() || getName());
  if (!name) { toast(t('need_name')); return; }
  setName(name);
  const circle = $('online-circle').value.trim() || 'public';
  try { localStorage.setItem('arcade:circle', circle); } catch (e) {}
  $('online-status').textContent = t('connecting_lobby');
  ensureLobbyPeer((peerId) => {
    presenceOnline(circle, name, peerId, renderOnlineList, getUid(), { level: getLevel(), rating: overallRating(), coins: getCoins() });
    S.inLobby = true;
    $('online-status').textContent = t('online_now');
    $('btn-go-online').textContent = t('go_offline');
  });
}
function renderOnlineList(list) {
  const ul = $('online-list'); if (!ul) return; ul.innerHTML = '';
  if (!list.length) { ul.appendChild(el('li', 'text-center text-slate-500 text-sm py-4', t('no_players'))); return; }
  for (const p of list) {
    const li = el('li', 'flex items-center justify-between gap-2 bg-slate-800 rounded-xl px-3 py-2');
    li.appendChild(el('span', 'font-semibold truncate', `🟢 ${esc(p.name)}`));
    const b = el('button', 'px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold', t('invite'));
    b.onclick = () => invitePlayer(p.peerId, p.name);
    li.appendChild(b);
    ul.appendChild(li);
  }
}
function wireInvite(conn) {
  conn.on('data', onData);
  conn.on('close', onDisconnect);
  conn.on('error', onDisconnect);
}
function onLobbyConn(conn) {
  if (S.conn && S.conn.open) { try { conn.close(); } catch (e) {} return; } // busy
  S.conn = conn;
  wireInvite(conn);
}
function invitePlayer(peerId, name) {
  if (S.conn && S.conn.open) return;
  S.pendingInviteeName = name;
  const conn = S.lobbyPeer.connect(peerId, { reliable: true });
  S.conn = conn; S.isHost = true;
  wireInvite(conn);
  conn.on('open', () => sys('invite', { name: getName() || 'Player', fromId: S.lobbyPeer.id }));
  toast(t('inviting', { name }));
}
function beginInvitedGame(iAmHost) {
  $('invite-panel').classList.add('hidden');
  presenceOffline(); S.inLobby = false;
  S.isHost = iAmHost;
  S.peer = S.lobbyPeer;
  S.roomCode = iAmHost ? S.lobbyPeer.id : (S.pendingInvite ? S.pendingInvite.fromId : S.roomCode);
  S.oppName = (iAmHost ? S.pendingInviteeName : (S.pendingInvite && S.pendingInvite.name)) || '';
  if (iAmHost) openPicker();
  else { enterGuestLobby(); $('room-code').textContent = S.oppName || '—'; }
}
function leaveLobby() {
  presenceOffline();
  try { S.lobbyPeer && S.lobbyPeer.destroy(); } catch (e) {}
  S.lobbyPeer = null; S.inLobby = false;
  $('btn-go-online').textContent = t('go_online');
  show('home');
}
function selectGame(id) {
  S.game = gameById(id);
  $('connect-title').textContent = gameTitle(S.game);
  $('howto-text').textContent = gameRules(S.game);
  $('join-code').value = '';
  renderModes();
  show('connect');
  stopHowto();
  S.demoStop = demo(S.game.id, $('howto-demo'), S.game.emoji);
}
const BOT_LEVELS = ['easy', 'medium', 'hard'];
function renderModes() {
  $('btn-play-solo').classList.toggle('hidden', !S.game.solo);
  $('bot-mode').classList.toggle('hidden', !S.game.bot);
  $('online-modes-sep').classList.toggle('hidden', !(S.game.solo || S.game.bot));
  if (S.game.bot) {
    if (!S.botLevelSel) S.botLevelSel = 'medium';
    const box = $('bot-diff'); box.innerHTML = '';
    for (const lv of BOT_LEVELS) {
      const b = el('button', 'py-2 rounded-lg text-sm font-semibold transition ' + (S.botLevelSel === lv ? 'bg-indigo-600' : 'bg-slate-800 text-slate-400'), t('diff_' + lv));
      b.onclick = () => { S.botLevelSel = lv; renderModes(); };
      box.appendChild(b);
    }
  }
}

// ---------- lobby / config ----------
function optionSchema() {
  const opts = (S.game.options || []).slice();
  if (S.game.usesTurns !== false) {
    opts.push({ key: 'timer', label: t('turn_timer'),
      choices: [{ label: '30s', value: 30 }, { label: '60s', value: 60 }, { label: t('off'), value: 0 }], default: 30 });
    opts.push({ key: 'firstMove', label: t('first_move'),
      choices: [{ label: t('fm_toss'), value: 'toss' }, { label: t('fm_host'), value: 'host' }, { label: t('fm_loser'), value: 'loser' }], default: 'toss' });
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
  $('lobby-wait').classList.add('hidden');     // reset shared elements from any prior guest lobby
  $('btn-start').classList.remove('hidden');
  $('room-card').classList.toggle('hidden', !!(S.vsBot || S.solo)); // no room code for local games
  $('room-code').textContent = S.roomCode;
  renderOptions();
  const start = $('btn-start');
  const connected = S.conn && S.conn.open;
  start.disabled = !connected;
  start.textContent = connected ? t('start_game') : t('waiting_opp');
}
function enterGuestLobby() {
  show('lobby');
  $('lobby-host').classList.add('hidden');
  $('room-card').classList.remove('hidden');
  $('room-code').textContent = S.roomCode;
  $('btn-start').classList.add('hidden');
  $('lobby-wait').classList.remove('hidden');
}

// ---------- phase flow ----------
function proceedAfterConfig() {
  S.myReady = false; S.oppReady = (S.vsBot || S.solo) ? true : false;
  if (S.game.setup && !S.solo) enterSetup();
  else { S.myReady = true; afterReady(); }
}
function enterSetup() {
  show('setup');
  $('setup-title').textContent = gameTitle(S.game);
  ctx.setupRoot.innerHTML = '';
  S.game.setup(ctx);
}
function localReady() {
  S.myReady = true;
  sys('ready', { rating: S.game ? getRating(S.game.id) : 1000 });
  if (S.oppReady) afterReady();
}
function afterReady() {
  if (S.game.usesTurns === false) { startGame(false); return; }
  if (S.isHost) {
    const rule = S.config.firstMove || 'toss';
    let firstIsHost;
    if (rule === 'host') firstIsHost = true;
    else if (rule === 'loser' && S.lastLoserIsHost != null) firstIsHost = S.lastLoserIsHost;
    else firstIsHost = Math.random() < 0.5;
    sys('toss', { firstIsHost });
    runToss(firstIsHost);
  }
}
function runToss(iAmFirst) {
  show('toss');
  const coin = $('coin');
  coin.classList.add('coin-flip');
  $('toss-result').textContent = t('tossing');
  setTimeout(() => {
    coin.classList.remove('coin-flip');
    coin.textContent = iAmFirst ? '★' : '☆';
    $('toss-result').textContent = iAmFirst ? t('you_first') : t('opp_first');
    setTimeout(() => startGame(iAmFirst), 1300);
  }, 2000);
}
function preparePlayScreen() {
  if (S.game && S.game.stop) S.game.stop();   // halt any prior real-time loop before rebuilding
  S.over = false;
  show('play');
  $('game-title').textContent = gameTitle(S.game);
  ctx.root.innerHTML = '';
  const turnsOn = S.game.usesTurns !== false;
  $('turn-bar').classList.toggle('hidden', !turnsOn);
  $('result-bar').classList.add('hidden');
  $('pause-overlay').classList.add('hidden');
  $('btn-chat').classList.toggle('hidden', !chatEnabled());
  resetChat();
  return turnsOn;
}
function startGame(iAmFirst) {
  S.inPlay = true; S.paused = false;
  const turnsOn = preparePlayScreen();
  if (S.vsBot && S.game.botInit) S.game.botInit(S.botLevel, ctx);
  S.game.start(ctx, { iAmFirst });
  if (turnsOn) setTurn(iAmFirst); else persist();
  if (S.vsBot && !iAmFirst && S.game.botOpen) setTimeout(() => { if (S.vsBot && S.inPlay && !S.over) S.game.botOpen(botSend, S.botLevel); }, 550);
}

// ---------- turn + timer ----------
function updateTurnLabel() {
  const label = S.myTurn ? t('your_turn') : (S.oppName ? t('name_turn', { name: S.oppName }) : t('opp_turn'));
  $('turn-label').textContent = label;
  $('turn-label').className = 'font-semibold flex-1 ' + (S.myTurn ? 'text-emerald-400' : 'text-slate-400');
}
function setTurn(mine) {
  const became = mine && !S.myTurn;
  S.myTurn = mine;
  updateTurnLabel();
  S.remaining = S.config.timer;
  startTimer(mine);
  if (became) { sound('turn'); haptic(30); }
  S.game.onTurn && S.game.onTurn(mine, ctx);
  persist();
  if (!mine) scheduleBotMove();
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
  $('pause-msg').textContent = manual ? t('paused') : t('reconnecting');
  $('btn-resume').classList.toggle('hidden', !manual);
  $('pause-overlay').classList.remove('hidden');
  if (!manual) setStatus(t('reconnecting'));
  persist();
}
function resumeGame() {
  if (!S.inPlay || !S.paused) return;
  S.paused = false;
  clearInterval(S.reconnectTimer);
  $('pause-overlay').classList.add('hidden');
  setStatus(t('connected'));
  if (S.game.usesTurns !== false) startTimer(S.myTurn);   // continue from S.remaining
  persist();
}

// ---------- chat + reactions (real P2P only) ----------
const EMOTES = ['👍', '😂', '🔥', '😮', '😢', '🎉', '😎', '🤝'];
function chatEnabled() { return !(S.vsBot || S.solo); }
function updateChatBadge() {
  const b = $('chat-badge'); if (!b) return;
  b.textContent = S.unread > 9 ? '9+' : String(S.unread);
  b.classList.toggle('hidden', S.unread === 0);
}
function resetChat() {
  S.unread = 0;
  const log = $('chat-log'); if (log) log.innerHTML = '';
  $('chat-panel').classList.add('hidden');
  updateChatBadge();
}
function addChatMessage(text, mine) {
  if (!text) return;
  const log = $('chat-log'); if (!log) return;
  const wrap = el('div', 'flex ' + (mine ? 'justify-end' : 'justify-start'));
  wrap.appendChild(el('div', 'max-w-[80%] px-3 py-1.5 rounded-2xl text-sm break-words ' + (mine ? 'bg-indigo-600' : 'bg-slate-700'), esc(text)));
  log.appendChild(wrap);
  log.scrollTop = log.scrollHeight;
  if (!mine) { sound('chat'); if ($('chat-panel').classList.contains('hidden')) { S.unread++; updateChatBadge(); } }
}
function sendChat() {
  const inp = $('chat-input'), text = (inp.value || '').trim().slice(0, 140);
  if (!text) return;
  inp.value = '';
  addChatMessage(text, true);
  sys('chat', { text });
}
function floatEmote(emoji) {
  if (!emoji) return;
  sound('react');
  const n = el('div', 'emote-float', esc(emoji));
  n.style.left = (20 + Math.random() * 60) + '%';
  $('screen-play').appendChild(n);
  setTimeout(() => n.remove(), 1600);
}
function sendEmote(emoji) { floatEmote(emoji); sys('emote', { emoji }); }
function openChat() { $('chat-panel').classList.remove('hidden'); S.unread = 0; updateChatBadge(); setTimeout(() => { const i = $('chat-input'); if (i) i.focus(); }, 50); }
function closeChat() { $('chat-panel').classList.add('hidden'); }

// ---------- leaderboard (experimental, over MQTT) ----------
function renderLeaderboard(list) {
  const box = $('leaderboard-list'); if (!box) return;
  box.innerHTML = '';
  if (!list || !list.length) { box.appendChild(el('li', 'text-center text-slate-500 text-sm py-3', t('lb_empty'))); return; }
  list.slice(0, 30).forEach((p, i) => {
    const li = el('li', 'flex items-center justify-between gap-2 bg-slate-800 rounded-xl px-3 py-2 text-sm');
    const dot = p.online ? '<span class="text-emerald-400" title="online">🟢</span>' : '<span class="text-slate-600" title="offline">⚫</span>';
    li.appendChild(el('span', 'flex items-center gap-1.5 truncate', `${dot}<span class="text-slate-500">${i + 1}.</span> <span class="text-slate-400">${t('lvl')}${p.level || 1}</span> ${esc(p.name)}`));
    li.appendChild(el('span', 'flex items-center gap-2 shrink-0 font-mono', `<span class="text-indigo-400">${p.rating}</span><span class="text-amber-400">🪙${p.coins || 0}</span>`));
    box.appendChild(li);
  });
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
  const firstEnd = !S.over;
  clearInterval(S.timerId);
  clearInterval(S.reconnectTimer);
  if (S.game && S.game.stop) S.game.stop();
  S.inPlay = false; S.paused = false; S.over = true; S.myTurn = false;
  if (outcome === 'win') S.lastLoserIsHost = !S.isHost;
  else if (outcome === 'lose') S.lastLoserIsHost = S.isHost;
  clearSession();
  if (firstEnd && S.game) recordAndSeries(outcome);
  // Stay on the play screen so the board/history remain visible; swap the
  // turn bar for a result header carrying the actions.
  $('pause-overlay').classList.add('hidden');
  $('turn-bar').classList.add('hidden');
  const title = { win: t('you_win'), lose: t('you_lose'), draw: t('draw') }[outcome] || t('you_lose');
  const online = !(S.vsBot || S.solo);
  const series = (online && (S.series.me || S.series.opp)) ? '  ·  ' + t('series', { me: S.series.me, opp: S.series.opp, name: S.oppName || t('opponent') }) : '';
  $('result-text').textContent = title + (msg ? ` — ${msg}` : '') + series;
  $('result-bar').classList.remove('hidden');
  sound(outcome === 'win' ? 'win' : outcome === 'draw' ? 'draw' : 'lose');
  haptic(outcome === 'win' ? [40, 40, 80] : 60);
  S.game && S.game.onTurn && S.game.onTurn(false, ctx);   // make board/keypad inert
}
function recordAndSeries(outcome) {
  const online = !(S.vsBot || S.solo);
  if (online) {
    if (S.series.key !== (S.oppName || '?')) { S.series.me = 0; S.series.opp = 0; S.series.key = S.oppName || '?'; }
    if (outcome === 'win') S.series.me++;
    else if (outcome === 'lose') S.series.opp++;
  }
  const res = recordResult({
    gameId: S.game.id, outcome, category: S.game.category,
    vsBot: S.vsBot, solo: S.solo, botLevel: S.botLevel, oppRating: S.oppRating,
  });
  for (const id of res.unlocked) toast(t('new_badge', { name: t('ach_' + id) }));
  for (const q of (res.questsDone || [])) toast(t('quest_done', { name: t('quest_' + q.id) }));
  if ((res.questsDone || []).length) sound('quest');
  if (res.chestFromQuests || res.chestsGranted) { toast(t('chest_earned')); sound('chest'); }
  if (res.leveledUp) { toast(t('level_up', { n: res.level, tier: t('tier_' + res.tier.key) })); sound('levelup'); haptic([40, 40, 80]); }
  else if (res.xpGain) { toast(t('earned', { xp: res.xpGain, coins: res.coinGain })); sound('coin'); }
  publishScore({ level: getLevel(), rating: overallRating(), coins: getCoins() });
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
  if (S.game && S.game.stop) S.game.stop();
  presenceOffline(); S.inLobby = false;
  S.inPlay = false; S.paused = false; S.vsBot = false; S.solo = false;
  S.series = { me: 0, opp: 0, key: null }; S.oppRating = null;
  resetChat();
  clearSession();
  clearInterval(S.reconnectTimer);
  stopHowto();
  if (S.helpDemoStop) { S.helpDemoStop(); S.helpDemoStop = null; }
  $('help-panel').classList.add('hidden');
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
  get myTurn() { return S.myTurn && !S.over; },
  get solo() { return !!S.solo; },
  get vsBot() { return !!S.vsBot; },
  get name() { return getName(); },
  el, toast, elapsed, t, sound, haptic,
  send: gameSend,
  setTurn,
  ready: localReady,
  endGame,
  save: persist,
};

// ---------- boot ----------
export function boot() {
  initLang();
  setNotify(toast);
  initPrefs();
  onLangChange(() => { renderHome(); if (!$('screen-play').classList.contains('hidden')) updateTurnLabel(); });
  renderHome();
  // Daily login bonus (once per day).
  const daily = claimDaily();
  if (daily.claimed) setTimeout(() => {
    toast(t('daily_bonus', { coins: daily.coins, streak: daily.streak })); sound('coin');
    if (daily.chest) setTimeout(() => { toast(t('chest_earned')); sound('chest'); }, 1400);
  }, 600);
  $('btn-create').onclick = createRoom;
  $('game-search').oninput = (e) => { S.homeSearch = e.target.value; renderHome(); };
  $('btn-join').onclick = () => joinRoom($('join-code').value.trim().toUpperCase());
  $('btn-copy').onclick = () => {
    const link = `${location.origin}${location.pathname}?g=${S.game.id}&room=${S.roomCode}`;
    navigator.clipboard.writeText(link).then(() => toast(t('invite_copied')), () => toast(link));
  };
  $('btn-start').onclick = () => {
    if (!(S.conn && S.conn.open)) return;
    S.config = Object.assign({}, S.working);
    sys('config', { gameId: S.game.id, config: S.config, rating: getRating(S.game.id) });
    proceedAfterConfig();
  };
  $('btn-rematch').onclick = () => restartMatch(true);
  const stopHelp = () => { if (S.helpDemoStop) { S.helpDemoStop(); S.helpDemoStop = null; } };
  const closeHelp = () => { stopHelp(); $('help-panel').classList.add('hidden'); };
  $('btn-help').onclick = () => {
    if (!S.game) return;
    $('help-title').textContent = gameTitle(S.game);
    $('help-rules').textContent = gameRules(S.game);
    stopHelp();
    S.helpDemoStop = demo(S.game.id, $('help-demo'), S.game.emoji);
    $('help-panel').classList.remove('hidden');
  };
  $('btn-help-close').onclick = closeHelp;
  $('btn-help-close2').onclick = closeHelp;
  $('help-panel').addEventListener('click', (e) => { if (e.target === $('help-panel')) closeHelp(); });
  $('btn-change').onclick = openPicker;
  $('btn-result-change').onclick = openPicker;
  $('btn-picker-cancel').onclick = closePicker;
  $('btn-picker-cancel2').onclick = closePicker;
  $('picker-panel').addEventListener('click', (e) => { if (e.target === $('picker-panel')) closePicker(); });
  $('btn-play-solo').onclick = startSolo;
  $('btn-play-bot').onclick = startBot;
  $('btn-find-players').onclick = openOnlineLobby;
  $('btn-go-online').onclick = toggleOnline;
  $('btn-online-back').onclick = leaveLobby;
  $('btn-invite-accept').onclick = () => { $('invite-panel').classList.add('hidden'); sys('invite-accept'); beginInvitedGame(false); };
  $('btn-invite-decline').onclick = () => { $('invite-panel').classList.add('hidden'); sys('invite-declined'); try { S.conn && S.conn.close(); } catch (e) {} S.conn = null; };
  $('btn-pause').onclick = () => { pauseGame('manual'); sys('pause'); };
  $('btn-resume').onclick = () => { resumeGame(); sys('resume-play'); };
  $('btn-pause-leave').onclick = goHome;
  for (const id of ['btn-home', 'btn-home-play', 'btn-result-home', 'btn-back-connect', 'btn-back-lobby']) {
    const b = $(id); if (b) b.onclick = goHome;
  }

  // Profile
  initProfile();
  $('btn-profile').onclick = () => openProfile(games);
  $('btn-profile-close').onclick = closeProfile;
  $('btn-profile-close2').onclick = closeProfile;
  $('profile-panel').addEventListener('click', (e) => { if (e.target === $('profile-panel')) closeProfile(); });

  // Chat + reactions
  $('btn-chat').onclick = openChat;
  $('btn-chat-close').onclick = closeChat;
  $('chat-send').onclick = sendChat;
  $('chat-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') sendChat(); });
  const eb = $('emote-bar');
  for (const em of EMOTES) { const b = el('button', 'text-2xl p-1 active:scale-125 transition', em); b.onclick = () => sendEmote(em); eb.appendChild(b); }

  // Leaderboard
  onLeaderboard(renderLeaderboard);

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
