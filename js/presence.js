// Presence + leaderboard over a public MQTT broker (no backend). Games stay P2P (PeerJS).
// GLOBAL + always-on: an ephemeral presence beacon (who's online now, how to invite them, DND/busy)
// keyed by the stable player uid, plus a retained leaderboard entry (persistent ranking). The two
// are merged into one board list. Depends on the global `mqtt` (mqtt.js via CDN).

const BROKERS = ['wss://broker.emqx.io:8084/mqtt', 'wss://broker.hivemq.com:8884/mqtt'];
const PREFIX = 'dualarcade/v1';
const BEAT = 15000, LB_BEAT = 20000, STALE = 45000, LB_STALE = 30 * 24 * 3600 * 1000;

const P = {
  client: null, onBoard: null,
  self: { uid: '', name: 'Player', peerId: '', dnd: false, busy: false, level: 1, rating: 1000, coins: 0, avatar: '🦊' },
  online: new Map(),   // uid -> { name, peerId, dnd, busy, level, avatar, ts }
  scores: new Map(),   // uid -> { name, level, rating, coins, ts }  (retained)
  hb: null, lbHb: null, prune: null,
};
const topicPresence = () => `${PREFIX}/global/presence/${P.self.uid}`;
const topicScore = () => `${PREFIX}/global/lb/${P.self.uid}`;

export function onBoard(cb) { P.onBoard = cb; }
function emitBoard() {
  if (!P.onBoard) return;
  const now = Date.now(), byUid = new Map();
  for (const [uid, v] of P.scores) { if (v.ts && now - v.ts > LB_STALE) continue; byUid.set(uid, { uid, name: v.name, level: v.level, rating: v.rating, coins: v.coins, online: false }); }
  for (const [uid, v] of P.online) {
    if (now - v.ts > STALE) continue;
    const e = byUid.get(uid) || { uid, name: v.name, level: v.level || 1, rating: 1000, coins: 0 };
    Object.assign(e, { online: true, peerId: v.peerId, dnd: !!v.dnd, busy: !!v.busy, avatar: v.avatar, name: v.name || e.name, level: v.level || e.level });
    byUid.set(uid, e);
  }
  const list = [...byUid.values()].map((e) => Object.assign(e, { isMe: e.uid === P.self.uid }));
  list.sort((a, b) => (b.rating - a.rating) || (b.level - a.level) || (b.coins - a.coins));   // rank by RP → level → coins
  P.onBoard(list);
}

function publishBeacon() {
  if (!P.client || !P.client.connected) return;
  const s = P.self;
  P.client.publish(topicPresence(), JSON.stringify({ name: s.name, peerId: s.peerId, dnd: s.dnd, busy: s.busy, level: s.level, avatar: s.avatar, ts: Date.now() }), { retain: false, qos: 0 });
}
export function publishScore(score) {
  if (score) Object.assign(P.self, score);
  if (!P.client || !P.client.connected) return;
  const s = P.self;
  P.client.publish(topicScore(), JSON.stringify({ name: s.name, level: s.level, rating: s.rating, coins: s.coins, ts: Date.now() }), { retain: true, qos: 0 });
}
// Merge a patch into our identity/status and re-announce immediately (dnd, busy, peerId, name, ...).
export function setPresence(patch) {
  Object.assign(P.self, patch || {});
  publishBeacon();
  if (patch && ('level' in patch || 'name' in patch)) publishScore();
}

// goOnline(uid, name, peerId, profile, dnd) — connect once and stay online for the session.
export function goOnline(uid, name, peerId, profile, dnd) {
  goOffline();
  Object.assign(P.self, { uid: uid || peerId, name: (name || 'Player').slice(0, 16), peerId, dnd: !!dnd, busy: false }, profile || {});
  P.online = new Map(); P.scores = new Map();
  P.client = mqtt.connect(BROKERS[0], {
    clientId: 'da_' + P.self.uid.slice(0, 12) + '_' + Math.floor(Math.random() * 1e4),
    keepalive: 30, reconnectPeriod: 4000, connectTimeout: 8000,
    will: { topic: topicPresence(), payload: '', retain: false, qos: 0 },
  });
  P.client.on('connect', () => {
    P.client.subscribe(`${PREFIX}/global/presence/+`, { qos: 0 });
    P.client.subscribe(`${PREFIX}/global/lb/+`, { qos: 0 });
    publishBeacon(); publishScore();
    clearInterval(P.hb); P.hb = setInterval(publishBeacon, BEAT);
    clearInterval(P.lbHb); P.lbHb = setInterval(() => publishScore(), LB_BEAT);
    clearInterval(P.prune); P.prune = setInterval(emitBoard, 10000);
    emitBoard();
  });
  P.client.on('message', (topic, payload) => {
    const parts = topic.split('/'), id = parts.pop(), kind = parts[parts.length - 1];
    const s = payload.toString();
    if (kind === 'presence') {
      if (!s) { P.online.delete(id); emitBoard(); return; }
      try { const v = JSON.parse(s); P.online.set(id, { name: v.name || 'Player', peerId: v.peerId, dnd: !!v.dnd, busy: !!v.busy, level: v.level || 1, avatar: v.avatar || '🦊', ts: v.ts || Date.now() }); emitBoard(); } catch (e) {}
    } else if (kind === 'lb') {
      if (!s) { P.scores.delete(id); emitBoard(); return; }
      try { const v = JSON.parse(s); P.scores.set(id, { name: v.name || 'Player', level: v.level || 1, rating: v.rating || 1000, coins: v.coins || 0, ts: v.ts || 0 }); emitBoard(); } catch (e) {}
    }
  });
  P.client.on('error', () => {});
}

export function goOffline() {
  clearInterval(P.hb); clearInterval(P.lbHb); clearInterval(P.prune); P.hb = P.lbHb = P.prune = null;
  if (P.client) {
    try { P.client.publish(topicPresence(), '', { retain: false, qos: 0 }); P.client.end(true); } catch (e) {}
    P.client = null;
  }
  P.online = new Map(); P.scores = new Map();
}
export function isOnline() { return !!(P.client && P.client.connected); }
