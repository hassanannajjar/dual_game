// Arcade engine — game-agnostic P2P shell. Games register() themselves; the engine
// drives phases: home -> connect -> lobby -> [setup] -> [toss] -> play -> over,
// and handles pause / disconnect-reconnect / refresh-resume.
// Depends on the global `Peer` (PeerJS, loaded via CDN).
import { t, initLang, onLangChange, getLang } from './i18n.js?v=48';
import { rpRank, romanDiv } from './logic.js?v=48';
import { sound, setMusicScene, musicSwell, setMusicNotify, prefetchAudio, preloadMusic } from './sound.js?v=48';
import { initPrefs, getName, setName, haptic } from './prefs.js?v=48';
import { demo } from './demos.js?v=48';
import { goOnline as presenceOnline, onBoard as onPresenceBoard, publishScore, setPresence, isOnline } from './presence.js?v=48';
import { recordResult, getRating, overallRating, openProfile, closeProfile, initProfile, getAvatar, shareStats, shareResult, currentSeason, myProfileSummary, openPeerProfile } from './profile.js?v=48';
import { claimDaily, getLevel, getCoins, setNotify } from './loyalty.js?v=48';
import { getUid, getGuestName } from './identity.js?v=48';
import { isFav, toggleFav, getFavs } from './favorites.js?v=48';
import { getFriends, addFriend } from './friends.js?v=48';
import { hasTutorial, getTutorial } from './tutorials.js?v=48';

// ---------- DOM helpers ----------
const $ = (id) => document.getElementById(id);
export function el(tag, cls, html) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
}
// Inline SVG icon by id from the sprite in index.html. cls sets size/colour (fill: currentColor).
export function icon(name, cls) { return `<svg class="${cls || 'w-5 h-5'} fill-current" aria-hidden="true"><use href="#i-${name}"></use></svg>`; }
const SCREENS = ['home', 'online', 'connect', 'lobby', 'setup', 'toss', 'play'];
function stopHowto() { if (S.demoStop) { S.demoStop(); S.demoStop = null; } }
function show(name) {
  if (name !== 'connect') stopHowto();
  for (const s of SCREENS) $('screen-' + s).classList.toggle('hidden', s !== name);
  const scr = $('screen-' + name);
  if (scr) { scr.classList.remove('screen-enter'); void scr.offsetWidth; scr.classList.add('screen-enter'); }   // fade/slide in
}
function setStatus(msg) { $('status').textContent = msg || ''; }
const toastQ = [];
export function toast(msg) {                       // queued so bursts don't clobber each other
  if (msg == null) return;
  toastQ.push(String(msg));
  if (!toast._draining) drainToasts();
}
function drainToasts() {
  const n = $('toast'); if (!n) return;
  if (!toastQ.length) { toast._draining = false; n.classList.add('hidden'); return; }
  toast._draining = true;
  n.textContent = toastQ.shift();
  n.classList.remove('hidden');
  clearTimeout(toast._t);
  toast._t = setTimeout(drainToasts, 1500);
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
  dnd: false, online: false, boardList: [],
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
    sys('hello', { name: getName(), uid: getUid(), avatar: getAvatar() });
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
  if (S.game && S.game.realtime) { endGame('nocontest', t('opp_left')); return; } // live games can't pause/rejoin; don't penalize the staying player
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
  setStatus(t('creating_room'));
  S.peer.on('open', (id) => { S.roomCode = id; enterHostLobby(); setStatus(t('waiting_opp')); });
  S.peer.on('connection', wireConn);
  S.peer.on('error', (err) => {
    if (err.type === 'unavailable-id') { S.peer.destroy(); createRoom(); return; }
    setStatus('Error: ' + err.type);
  });
}
function joinRoom(code) {
  if (!code) { toast(t('enter_code_first')); return; }
  S.isHost = false; S.vsBot = false; S.solo = false;
  S.roomCode = code.toUpperCase();
  S.peer = new Peer();
  setStatus(t('joining', { code: S.roomCode }));
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
      if (!S.game) return;                                  // unknown game id (version mismatch) — ignore
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
      S.oppUid = msg.uid || null; S.oppAvatar = msg.avatar || '🎮';
      if (!$('screen-play').classList.contains('hidden')) updateTurnLabel();
      break;
    case 'forfeit':
      if (S.inPlay && !S.over) endGame('win', t('opp_forfeit'));   // opponent quit → you win
      break;
    case 'changegame':
      teardownGame();
      S.game = gameById(msg.gameId) || S.game;
      if (S.isHost) enterHostLobby(); else enterGuestLobby();
      break;
    case 'invite':
      if (S.dnd || S.inPlay) { sys('invite-declined'); try { S.conn && S.conn.close(); } catch (e) {} S.conn = null; S.isHost = false; break; }
      S.pendingInvite = { fromId: msg.fromId, name: msg.name };
      showInvite(msg.name || 'Player');
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
const DIFF_BAR = { easy: 'bg-emerald-400', medium: 'bg-amber-400', hard: 'bg-rose-400' };
const DIFF_LVL = { easy: 1, medium: 2, hard: 3 };
function renderChips() {
  const box = $('cat-chips'); box.innerHTML = '';
  const chip = (key, label) => {
    const active = (S.homeFilter || 'all') === key;
    const b = el('button', 'shrink-0 px-3 py-1.5 rounded-full text-sm font-semibold transition ' +
      (active ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'bg-slate-800/70 text-slate-400 hover:text-slate-200'), label);
    b.onclick = () => { S.homeFilter = key; renderHome(); };
    return b;
  };
  if (getFavs().length) box.appendChild(chip('fav', '★ ' + t('favorites')));
  for (const key of ['all', ...CATS]) box.appendChild(chip(key, t(key === 'all' ? 'all_games' : 'cat_' + key)));
}
function diffMeter(diff) {
  const lvl = DIFF_LVL[diff] || 2;
  let bars = '';
  for (let i = 1; i <= 3; i++) bars += `<span class="w-3 h-1 rounded-full ${i <= lvl ? DIFF_BAR[diff] : 'bg-slate-700'}"></span>`;
  return `<span class="inline-flex items-center gap-0.5">${bars}<span class="ms-1 text-[10px] ${DIFF_COLOR[diff]}">${t('diff_' + diff)}</span></span>`;
}
function gameCard(g, onPick) {
  const diff = g.difficulty || 'medium';
  const card = el('div', 'group flex items-stretch rounded-2xl glass-card border border-slate-700/70 hover:border-indigo-500/80 hover:shadow-[0_10px_34px_-14px] hover:shadow-indigo-500/60 transition');
  const main = el('button', 'flex items-center gap-3 p-3 flex-1 min-w-0 text-start rounded-2xl active:scale-[0.98] transition');
  main.innerHTML =
    `<span class="text-2xl w-11 h-11 rounded-xl bg-slate-900/60 border border-slate-700/70 flex items-center justify-center shrink-0 group-hover:scale-105 transition">${g.emoji}</span>` +
    `<span class="flex-1 min-w-0">` +
      `<span class="block font-display font-bold truncate">${gameName(g)}</span>` +
      `<span class="block text-xs text-slate-400 truncate">${gameDesc(g)}</span>` +
      `<span class="mt-1 flex items-center gap-2 text-[10px]">` +
        `<span class="px-1.5 py-0.5 rounded bg-slate-700/70 text-slate-300">${t('players2')}</span>` +
        diffMeter(diff) +
      `</span>` +
    `</span>`;
  main.onclick = () => onPick(g.id);
  const controls = el('div', 'flex flex-col items-center justify-center gap-1 pe-2');
  const star = el('button', 'p-1.5 rounded-lg hover:bg-slate-700/60 transition ' + (isFav(g.id) ? 'text-amber-400' : 'text-slate-600 hover:text-slate-400'), icon('star'));
  star.title = t('favorite'); star.setAttribute('aria-label', t('favorite'));
  star.onclick = (e) => { e.stopPropagation(); const now = toggleFav(g.id); sound('toggle'); toast(t(now ? 'faved' : 'unfaved', { name: gameName(g) })); renderHome(); };
  const prev = el('button', 'p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-700/60 transition', icon('info'));
  prev.title = t('preview'); prev.setAttribute('aria-label', t('preview'));
  prev.onclick = (e) => { e.stopPropagation(); openPreview(g.id); };
  controls.append(star, prev);
  card.append(main, controls);
  return card;
}
function recentGameIds() {                       // distinct game ids from match history, newest-first
  try {
    const h = JSON.parse(localStorage.getItem('arcade:history') || '[]');
    const seen = new Set(), out = [];
    for (const m of h) { if (m && m.gameId && !seen.has(m.gameId)) { seen.add(m.gameId); out.push(m.gameId); } }
    return out;
  } catch (e) { return []; }
}
function sectionGrid(list, onPick) {
  const grid = el('div', 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3');
  list.forEach((g, i) => {
    const card = gameCard(g, onPick);
    card.classList.add('card-in');
    card.style.animationDelay = Math.min(i * 35, 400) + 'ms';   // gentle stagger, capped so long lists don't drag
    grid.appendChild(card);
  });
  return grid;
}
function buildSections(container, onPick, filterCat, q) {
  container.innerHTML = '';
  const match = (g) => !q || gameName(g).toLowerCase().includes(q) || gameDesc(g).toLowerCase().includes(q) || g.name.toLowerCase().includes(q);
  // dedicated favorites view
  if (filterCat === 'fav') {
    const favs = getFavs().map(gameById).filter(Boolean).filter(match);
    if (favs.length) container.appendChild(sectionGrid(favs, onPick));
    else container.appendChild(el('p', 'text-center text-slate-500 py-8', t('no_favs')));
    return;
  }
  let any = false;
  // recently-played strip on the default view (distinct, newest-first) — quick way back into a game
  if ((!filterCat || filterCat === 'all') && !q) {
    const recent = recentGameIds().map(gameById).filter(Boolean).slice(0, 6);
    if (recent.length) {
      any = true;
      const sec = el('div', 'mb-5');
      sec.appendChild(el('h2', 'text-xs font-bold uppercase tracking-wider text-slate-400 mb-2', '🕘 ' + t('recently_played')));
      sec.appendChild(sectionGrid(recent, onPick));
      container.appendChild(sec);
    }
  }
  // pinned favorites strip on the default "all" view (not while searching or filtering a category)
  if ((!filterCat || filterCat === 'all') && !q && getFavs().length) {
    const favs = getFavs().map(gameById).filter(Boolean);
    if (favs.length) {
      any = true;
      const sec = el('div', 'mb-5');
      sec.appendChild(el('h2', 'text-xs font-bold uppercase tracking-wider text-amber-400/80 mb-2', '★ ' + t('favorites')));
      sec.appendChild(sectionGrid(favs, onPick));
      container.appendChild(sec);
    }
  }
  for (const cat of CATS) {
    if (filterCat && filterCat !== 'all' && filterCat !== cat) continue;
    const list = games.filter((g) => (g.category || 'classic') === cat && match(g));
    if (!list.length) continue;
    any = true;
    const sec = el('div', 'mb-5');
    sec.appendChild(el('h2', 'text-xs font-bold uppercase tracking-wider text-slate-500 mb-2', t('cat_' + cat)));
    sec.appendChild(sectionGrid(list, onPick));
    container.appendChild(sec);
  }
  if (!any) container.appendChild(el('p', 'text-center text-slate-500 py-8', t('no_results')));
}
function renderHome() {
  renderChips();
  buildSections($('game-sections'), selectGame, S.homeFilter, (S.homeSearch || '').trim().toLowerCase());
}
// ---------- game preview (before committing to play) ----------
function openPreview(id) {
  const g = gameById(id); if (!g) return;
  $('preview-title').textContent = gameTitle(g);
  $('preview-rules').textContent = gameRules(g);
  $('preview-meta').innerHTML = `<span class="px-1.5 py-0.5 rounded bg-slate-700/70 text-slate-300 text-[10px]">${t('players2')}</span>` + diffMeter(g.difficulty || 'medium');
  const favBtn = $('btn-preview-fav');
  const paintFav = () => {
    favBtn.className = 'flex items-center justify-center gap-1 px-3 py-2.5 rounded-xl font-semibold text-sm transition ' + (isFav(id) ? 'bg-amber-500 text-slate-900 hover:bg-amber-400' : 'bg-slate-800 hover:bg-slate-700');
    favBtn.innerHTML = icon('star', 'w-4 h-4') + `<span>${t(isFav(id) ? 'faved_short' : 'add_fav')}</span>`;
  };
  favBtn.onclick = () => { toggleFav(id); sound('toggle'); paintFav(); renderHome(); };
  paintFav();
  $('btn-preview-play').onclick = () => { closePreview(); selectGame(id); };
  const learn = $('btn-preview-learn');
  if (learn) { const has = hasTutorial(id); learn.classList.toggle('hidden', !has); learn.onclick = has ? () => { closePreview(); openTutorial(id); } : null; }
  if (S.previewDemoStop) S.previewDemoStop();
  S.previewDemoStop = demo(id, $('preview-demo'), g.emoji);
  $('preview-panel').classList.remove('hidden');
}
function closePreview() { if (S.previewDemoStop) { S.previewDemoStop(); S.previewDemoStop = null; } $('preview-panel').classList.add('hidden'); }
// ---------- per-game tutorial (step-by-step) ----------
function openTutorial(id) {
  const g = gameById(id); if (!g) return;
  S.tut = { id, steps: getTutorial(id, getLang()) || [], i: 0 };
  if (!S.tut.steps.length) return;
  $('tutorial-title').textContent = gameTitle(g);
  if (S.tutDemoStop) S.tutDemoStop();
  S.tutDemoStop = demo(id, $('tutorial-demo'), g.emoji);
  paintTutorial();
  $('tutorial-panel').classList.remove('hidden');
}
function paintTutorial() {
  const s = S.tut; if (!s) return;
  $('tutorial-step').textContent = s.steps[s.i] || '';
  $('tutorial-progress').textContent = (s.i + 1) + ' / ' + s.steps.length;
  $('btn-tut-prev').disabled = s.i === 0;
  $('btn-tut-next').textContent = s.i >= s.steps.length - 1 ? t('tut_done') : t('tut_next');
}
function tutNext() { const s = S.tut; if (!s) return; if (s.i >= s.steps.length - 1) return closeTutorial(); s.i++; paintTutorial(); }
function tutPrev() { const s = S.tut; if (!s || s.i === 0) return; s.i--; paintTutorial(); }
function closeTutorial() { if (S.tutDemoStop) { S.tutDemoStop(); S.tutDemoStop = null; } $('tutorial-panel').classList.add('hidden'); S.tut = null; }
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
  S.working = defaultConfig();
  if ((S.game.options || []).length && !S.game.soloCampaign) enterHostLobby();   // let solo pick game options (target/board/undos…)
  else { S.config = Object.assign({}, S.working); proceedAfterConfig(); }         // campaign games self-manage in ctx.root
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
function effectiveName() { return (getName() || getGuestName()).slice(0, 16); }
function myProfile() { return { level: getLevel(), rating: overallRating(), coins: getCoins(), avatar: getAvatar(), prof: myProfileSummary() }; }
function ensureLobbyPeer(cb) {
  if (S.lobbyPeer && S.lobbyPeer.open) { cb(S.lobbyPeer.id); return; }
  S.lobbyPeer = new Peer();
  S.lobbyPeer.on('open', (id) => cb(id));
  S.lobbyPeer.on('connection', onLobbyConn);
  S.lobbyPeer.on('error', () => {});
}
// Always-on presence: connect once at boot; on later calls just refresh (new peerId, busy off).
function goOnlinePresence() {
  ensureLobbyPeer((peerId) => {
    if (isOnline()) setPresence(Object.assign({ peerId, name: effectiveName(), busy: false, dnd: S.dnd }, myProfile()));
    else presenceOnline(getUid(), effectiveName(), peerId, myProfile(), S.dnd);
    S.online = true;
  });
}
function updatePresenceHeader(onlineCount) {
  const c = $('hdr-count'); if (c) c.textContent = onlineCount;
  const av = $('hdr-avatar'); if (av) av.textContent = getAvatar();
  const d = $('btn-dnd'); if (d) { d.innerHTML = icon(S.dnd ? 'invite-off' : 'invite'); d.title = t(S.dnd ? 'dnd_on' : 'dnd_off'); }
  const fc = $('find-count'); if (fc) fc.textContent = onlineCount ? `· ${onlineCount} ${t('online_now_short')}` : '';
}
function renderBoard(list) {
  S.boardList = list;
  updatePresenceHeader(list.filter((p) => p.online).length);
  const box = $('leaderboard-list'); if (!box || $('screen-online').classList.contains('hidden')) return;
  box.innerHTML = '';
  if (!list.length) { box.appendChild(el('li', 'text-center text-slate-500 text-sm py-6', t('lb_empty'))); return; }
  list.slice(0, 40).forEach((p, i) => {
    const li = el('li', 'flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm transition ' + (p.isMe ? 'bg-indigo-600/20 ring-1 ring-indigo-500/50' : 'bg-slate-800 hover:bg-slate-700/70'));
    const pos = i === 0
      ? '<span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-400 text-slate-900 font-black text-xs shrink-0">1</span>'
      : `<span class="inline-block w-6 text-center text-slate-500 font-semibold shrink-0">${i + 1}</span>`;
    const dot = `<span class="${p.online ? 'text-emerald-400' : 'text-slate-600'}">●</span>`;
    const rk = rpRank(p.rating);
    const left = el('span', 'flex items-center gap-1.5 truncate cursor-pointer');
    left.innerHTML = `${pos}<span class="text-base">${p.avatar || '🎮'}</span>${dot}<span class="truncate font-semibold">${esc(p.name)}</span><span class="text-[10px] text-slate-500 shrink-0 px-1 rounded bg-slate-700/60">${t('lvl')}${p.level || 1}</span>`;
    left.title = t('view_profile');
    left.onclick = () => { if (p.isMe) openProfile(games); else openPeerProfile(p, games); };   // tap a player to see their profile
    li.appendChild(left);
    const right = el('span', 'flex items-center gap-2 shrink-0');
    right.innerHTML = `<span title="${t('rank_' + rk.key)}">${rk.emoji}</span><span class="font-mono text-indigo-400" title="${t('rp_full')}">${p.rating}</span><span class="text-[9px] text-slate-500 -ms-1">${t('rp')}</span>`;
    if (!p.isMe && p.online && p.peerId) {
      const canInvite = !p.dnd && !p.busy && !(S.conn && S.conn.open);
      const b = el('button', 'px-3 py-1 rounded-lg text-xs font-semibold transition active:scale-95 ' + (canInvite ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-slate-700 text-slate-500'), p.busy ? t('busy') : p.dnd ? t('dnd_short') : t('invite'));
      if (canInvite) b.onclick = () => invitePlayer(p.peerId, p.name); else b.disabled = true;
      right.appendChild(b);
    }
    li.appendChild(right);
    box.appendChild(li);
  });
  renderFriends();                              // keep the friends list's online status in sync
}
function renderFriends() {
  const box = $('friends-list'), sec = $('friends-section'); if (!box) return;
  const friends = getFriends();
  if (!friends.length) { if (sec) sec.classList.add('hidden'); return; }
  if (sec) sec.classList.remove('hidden');
  box.innerHTML = '';
  const byUid = {}; (S.boardList || []).forEach((p) => { if (p.uid) byUid[p.uid] = p; });
  for (const f of friends.slice(0, 12)) {
    const p = byUid[f.uid], online = !!(p && p.online);
    const li = el('li', 'flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm bg-slate-800');
    const left = el('span', 'flex items-center gap-1.5 truncate');
    left.innerHTML = `<span class="text-base">${f.avatar || '🎮'}</span><span class="${online ? 'text-emerald-400' : 'text-slate-600'}">●</span><span class="truncate font-semibold">${esc(f.name)}</span>`;
    li.appendChild(left);
    const canInvite = online && p.peerId && !p.dnd && !p.busy && !(S.conn && S.conn.open);
    const b = el('button', 'px-3 py-1 rounded-lg text-xs font-semibold transition ' + (canInvite ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-slate-700 text-slate-500'), online ? t('invite') : t('offline'));
    if (canInvite) b.onclick = () => invitePlayer(p.peerId, f.name); else b.disabled = true;
    li.appendChild(b);
    box.appendChild(li);
  }
}
function openBoard() {
  show('online');
  const sl = $('season-label'); if (sl) sl.textContent = t('season', { id: currentSeason().id });
  renderBoard(S.boardList || []);
  renderFriends();
}
function toggleDnd() {
  S.dnd = !S.dnd;
  try { localStorage.setItem('arcade:dnd', S.dnd ? '1' : '0'); } catch (e) {}
  setPresence({ dnd: S.dnd });
  updatePresenceHeader((S.boardList || []).filter((p) => p.online).length);
  toast(t(S.dnd ? 'dnd_on' : 'dnd_off')); sound('toggle');
}
function wireInvite(conn) {
  conn.on('data', onData);
  conn.on('close', onDisconnect);
  conn.on('error', onDisconnect);
}
function onLobbyConn(conn) {
  if ((S.conn && S.conn.open) || S.inPlay) { try { conn.close(); } catch (e) {} return; } // busy / in a match
  S.conn = conn;
  wireInvite(conn);
}
function invitePlayer(peerId, name) {
  if (S.conn && S.conn.open) return;
  S.pendingInviteeName = name;
  const conn = S.lobbyPeer.connect(peerId, { reliable: true });
  S.conn = conn; S.isHost = true;
  wireInvite(conn);
  conn.on('open', () => sys('invite', { name: effectiveName(), fromId: S.lobbyPeer.id }));
  toast(t('inviting', { name }));
}
function beginInvitedGame(iAmHost) {
  $('invite-panel').classList.add('hidden');
  setPresence({ busy: true });
  sys('hello', { name: getName(), uid: getUid(), avatar: getAvatar() });   // exchange identity for Friends

  S.isHost = iAmHost;
  S.peer = S.lobbyPeer;
  S.roomCode = iAmHost ? S.lobbyPeer.id : (S.pendingInvite ? S.pendingInvite.fromId : S.roomCode);
  S.oppName = (iAmHost ? S.pendingInviteeName : (S.pendingInvite && S.pendingInvite.name)) || '';
  if (iAmHost) openPicker();
  else { enterGuestLobby(); $('room-code').textContent = S.oppName || '—'; }
}
function showInvite(name) {
  const av = $('invite-avatar'); if (av) av.textContent = (S.pendingInvite && S.pendingInvite.avatar) || '🎮';
  $('invite-text').textContent = t('invited_by', { name });
  $('invite-panel').classList.remove('hidden');
  sound('join'); haptic([30, 40, 30]);
  let n = 10; const cd = $('invite-countdown');
  clearInterval(S.inviteTimer);
  const tick = () => { if (cd) cd.textContent = n + 's'; if (n <= 0) { declineInvite(); return; } n--; };
  tick(); S.inviteTimer = setInterval(tick, 1000);
}
function acceptInvite() { clearInterval(S.inviteTimer); $('invite-panel').classList.add('hidden'); sys('invite-accept'); beginInvitedGame(false); }
function declineInvite() { clearInterval(S.inviteTimer); $('invite-panel').classList.add('hidden'); sys('invite-declined'); try { S.conn && S.conn.close(); } catch (e) {} S.conn = null; S.isHost = false; }
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
  if (S.game.usesTurns !== false && !S.solo) {   // turn timer / first-move are meaningless in solo
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
    if (o.when && !o.when(S.working)) continue;   // conditional option — only show when its predicate holds
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
  clearFx();                                  // drop any leftover win confetti/banner before a (re)start
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
  setMusicScene('match');                        // music fills out / tightens during a live match
  if (S.online) setPresence({ busy: true });   // show "busy" on the board while playing
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
// Remove any active win FX (confetti + banner). Called on every (re)start so nothing lingers over the new board.
function clearFx() { const l = $('fx-layer'); if (l) l.remove(); }
// Win celebration: a contained confetti burst + a "You win!" banner. Auto-cleaned; CSS suppresses it under reduced-motion.
function celebrate() {
  clearFx();
  const layer = el('div', 'fx-layer'); layer.id = 'fx-layer';
  const EMO = ['🎉', '✨', '🎊', '⭐', '🏆', '💫', '🎈'];
  for (let i = 0; i < 28; i++) {
    const n = el('div', 'confetti-piece', EMO[i % EMO.length]);
    n.style.left = Math.random() * 100 + 'vw';
    n.style.animationDuration = (1.4 + Math.random() * 1.0) + 's';
    n.style.animationDelay = (Math.random() * 0.5) + 's';
    n.style.fontSize = (0.9 + Math.random() * 1.3) + 'rem';
    layer.appendChild(n);
  }
  layer.appendChild(el('div', 'win-banner', '🎉 ' + t('you_win')));
  document.body.appendChild(layer);
  setTimeout(() => { if ($('fx-layer') === layer) layer.remove(); }, 2600);
}
function openChat() { $('chat-panel').classList.remove('hidden'); S.unread = 0; updateChatBadge(); setTimeout(() => { const i = $('chat-input'); if (i) i.focus(); }, 50); }
function closeChat() { $('chat-panel').classList.add('hidden'); }

// (board rendering handled by renderBoard, which merges presence + leaderboard)

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
function endGame(outcome, msg, opts) {
  const firstEnd = !S.over;
  clearInterval(S.timerId);
  clearInterval(S.reconnectTimer);
  if (S.game && S.game.stop) S.game.stop();
  S.inPlay = false; S.paused = false; S.over = true; S.myTurn = false;
  const record = outcome !== 'nocontest';
  if (record && outcome === 'win') S.lastLoserIsHost = !S.isHost;
  else if (record && outcome === 'lose') S.lastLoserIsHost = S.isHost;
  clearSession();
  if (firstEnd && S.game && record) recordAndSeries(outcome, opts);
  else { const rs = $('result-summary'); if (rs) rs.classList.add('hidden'); }   // no-contest: no rewards
  // Stay on the play screen so the board/history remain visible; swap the
  // turn bar for a result header carrying the actions.
  $('pause-overlay').classList.add('hidden');
  $('turn-bar').classList.add('hidden');
  S.lastOutcome = outcome; if (firstEnd) S.lastRpGain = 0;   // for the "Share result" button
  const title = { win: t('you_win'), lose: t('you_lose'), draw: t('draw'), nocontest: t('no_contest') }[outcome] || t('you_lose');
  const online = !(S.vsBot || S.solo);
  const series = (record && online && (S.series.me || S.series.opp)) ? '  ·  ' + t('series', { me: S.series.me, opp: S.series.opp, name: S.oppName || t('opponent') }) : '';
  $('result-text').textContent = title + (msg ? ` — ${msg}` : '') + series;
  const rbar = $('result-bar');
  rbar.classList.remove('hidden', 'pop-in'); void rbar.offsetWidth; rbar.classList.add('pop-in');
  sound(outcome === 'win' ? 'win' : outcome === 'draw' ? 'draw' : outcome === 'nocontest' ? 'toggle' : 'lose');
  if (outcome === 'win') { musicSwell(); celebrate(); }          // warm music lift + confetti on a win
  haptic(outcome === 'win' ? [40, 40, 80] : 60);
  S.game && S.game.onTurn && S.game.onTurn(false, ctx);   // make board/keypad inert
}
function recordAndSeries(outcome, opts) {
  const online = !(S.vsBot || S.solo);
  if (online) {
    const key = S.oppUid || S.oppName || '?';
    if (S.series.key !== key) { S.series.me = 0; S.series.opp = 0; S.series.key = key; }
    if (outcome === 'win') S.series.me++;
    else if (outcome === 'lose') S.series.opp++;
  }
  if (online && S.oppUid) addFriend({ uid: S.oppUid, name: S.oppName, avatar: S.oppAvatar });   // remember this player
  const res = recordResult({
    gameId: S.game.id, outcome, category: S.game.category, oppName: S.oppName,
    vsBot: S.vsBot, solo: S.solo, botLevel: S.botLevel, oppRating: S.oppRating,
    close: !!(opts && opts.close), perfBonus: opts && opts.perfBonus,
  });
  if ((res.questsDone || []).length) sound('quest');                    // sounds only — visuals go in the summary
  if (res.chestFromQuests || res.chestsGranted) sound('chest');
  if (res.leveledUp) { sound('levelup'); haptic([40, 40, 80]); }
  else if (res.rpGain) sound('coin');
  S.lastRpGain = res.rpGain || 0;
  buildResultSummary(res);
  publishScore(myProfile());
}
// A single durable post-match summary (replaces the toast dump that clobbered itself).
function buildResultSummary(res) {
  const box = $('result-summary'); if (!box) return;
  const newRP = overallRating(), prevRP = newRP - (res.rpGain || 0);
  const after = rpRank(newRP), before = rpRank(prevRP);
  const rankedUp = (res.rpGain || 0) > 0 && (after.key !== before.key || after.division !== before.division);
  const chip = (cls, html) => `<span class="px-2 py-1 rounded-lg text-[11px] ${cls}">${html}</span>`;
  const parts = [];
  parts.push(chip('bg-slate-800 text-indigo-300 font-semibold', `${(res.rpGain || 0) >= 0 ? '+' : ''}${res.rpGain || 0} RP`));
  parts.push(chip('bg-slate-800', `${after.emoji} ${t('rank_' + after.key)}${after.division ? ' ' + romanDiv(after.division) : ''}`));
  if (res.xpGain) parts.push(chip('bg-slate-800 text-emerald-300', `+${res.xpGain} XP`));
  if (res.coinGain) parts.push(chip('bg-slate-800 text-amber-300', `+${res.coinGain} 🪙`));
  if ((res.streak || 0) >= 2) parts.push(chip('bg-slate-800 text-rose-300', `🔥 ${t('streak_n', { n: res.streak })}`));
  if (res.leveledUp) parts.push(chip('bg-violet-600/30 text-violet-200', `⭐ ${t('level')} ${res.level}`));
  for (const id of (res.unlocked || [])) parts.push(chip('bg-indigo-600/30 text-indigo-200', `🏅 ${t('ach_' + id)}`));
  for (const q of (res.questsDone || [])) parts.push(chip('bg-emerald-600/30 text-emerald-200', `✅ ${t('quest_' + q.id)}`));
  if (res.weeklyDone) parts.push(chip('bg-amber-500/30 text-amber-200', `🏆 ${t('weekly_challenge')}`));
  box.innerHTML = `<div class="flex flex-wrap gap-1.5 justify-center">${parts.join('')}</div>` +
    (rankedUp ? `<p class="text-center text-xs text-amber-300 font-semibold mt-1.5">${t('rank_up', { tier: t('rank_' + after.key) + (after.division ? ' ' + romanDiv(after.division) : '') })}</p>` : '');
  box.classList.remove('hidden');
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
  clearFx();
  if (S.inPlay && !S.over && S.game) {                     // quitting a live match counts as a loss
    if (!(S.vsBot || S.solo)) sys('forfeit');              // hand the win to a real opponent
    const res = recordResult({ gameId: S.game.id, outcome: 'lose', category: S.game.category, oppName: S.oppName, vsBot: S.vsBot, solo: S.solo, botLevel: S.botLevel, oppRating: S.oppRating });
    publishScore(myProfile());
    toast(t('forfeit_lost', { n: res.rpGain }));
  }
  if (S.game && S.game.stop) S.game.stop();
  S.inPlay = false; S.paused = false; S.vsBot = false; S.solo = false;
  S.series = { me: 0, opp: 0, key: null }; S.oppRating = null;
  resetChat();
  clearSession();
  clearInterval(S.reconnectTimer);
  stopHowto();
  if (S.helpDemoStop) { S.helpDemoStop(); S.helpDemoStop = null; }
  $('help-panel').classList.add('hidden');
  $('pause-overlay').classList.add('hidden');
  const lobbyConsumed = !!(S.peer && S.peer === S.lobbyPeer);   // invite games reuse the lobby peer
  resetConnection();
  if (lobbyConsumed) S.lobbyPeer = null;
  S.game = null;
  show('home');
  setStatus('');
  setMusicScene('menu');                                          // back to calm/sparse ambient
  goOnlinePresence();                                            // stay online: fresh lobby peer + busy off
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
  flashWin(els) { (els || []).forEach((e) => e && e.classList && e.classList.add('is-win')); },   // pulse the winning cells
};

// ---------- boot ----------
export function boot() {
  initLang();
  setNotify(toast);
  setMusicNotify(() => toast(t('music_no_files')));
  initPrefs();
  onLangChange(() => { renderHome(); if (!$('screen-play').classList.contains('hidden')) updateTurnLabel(); });
  renderHome();
  setMusicScene('menu');
  preloadMusic();                            // warm the playlist so the first tap starts Auto Mix in-gesture
  setTimeout(() => prefetchAudio(), 6000);   // auto-cache the music library for offline, after boot settles
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
  if ($('btn-result-share')) $('btn-result-share').onclick = () => { if (S.game && shareResult(gameName(S.game), S.lastOutcome || 'draw', S.lastRpGain || 0)) toast(t('copied')); };
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
  $('btn-preview-close').onclick = closePreview;
  $('btn-preview-close2').onclick = closePreview;
  $('preview-panel').addEventListener('click', (e) => { if (e.target === $('preview-panel')) closePreview(); });
  document.addEventListener('keydown', (e) => {                 // Escape closes the top-most open overlay
    if (e.key !== 'Escape') return;
    if (!$('preview-panel').classList.contains('hidden')) return closePreview();
    if (!$('tutorial-panel').classList.contains('hidden')) return closeTutorial();
    for (const id of ['picker-panel', 'help-panel', 'chat-panel', 'profile-panel', 'prefs-panel']) {
      const p = $(id); if (p && !p.classList.contains('hidden')) { p.classList.add('hidden'); return; }
    }
  });
  if ($('btn-tut-next')) $('btn-tut-next').onclick = tutNext;
  if ($('btn-tut-prev')) $('btn-tut-prev').onclick = tutPrev;
  if ($('btn-tut-close')) $('btn-tut-close').onclick = closeTutorial;
  if ($('tutorial-panel')) $('tutorial-panel').addEventListener('click', (e) => { if (e.target === $('tutorial-panel')) closeTutorial(); });
  $('btn-change').onclick = openPicker;
  $('btn-result-change').onclick = openPicker;
  $('btn-picker-cancel').onclick = closePicker;
  $('btn-picker-cancel2').onclick = closePicker;
  $('picker-panel').addEventListener('click', (e) => { if (e.target === $('picker-panel')) closePicker(); });
  $('btn-play-solo').onclick = startSolo;
  $('btn-play-bot').onclick = startBot;
  $('btn-find-players').onclick = openBoard;
  if ($('btn-online-back')) $('btn-online-back').onclick = () => show('home');
  if ($('btn-presence')) $('btn-presence').onclick = openBoard;
  if ($('btn-dnd')) $('btn-dnd').onclick = toggleDnd;
  $('btn-invite-accept').onclick = acceptInvite;
  $('btn-invite-decline').onclick = declineInvite;
  $('btn-pause').onclick = () => { pauseGame('manual'); sys('pause'); };
  $('btn-resume').onclick = () => { resumeGame(); sys('resume-play'); };
  $('btn-pause-leave').onclick = goHome;
  for (const id of ['btn-home', 'btn-home-play', 'btn-result-home', 'btn-back-connect', 'btn-back-lobby']) {
    const b = $(id); if (b) b.onclick = goHome;
  }

  // Profile
  initProfile();
  $('btn-profile').onclick = () => openProfile(games);
  if ($('btn-share')) $('btn-share').onclick = () => { if (shareStats(games)) toast(t('copied')); };
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

  // Always-on global presence + live board
  try { S.dnd = localStorage.getItem('arcade:dnd') === '1'; } catch (e) {}
  updatePresenceHeader(0);
  onPresenceBoard(renderBoard);
  goOnlinePresence();

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
