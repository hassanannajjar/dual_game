// Presence directory over a public MQTT broker (no backend). Games stay P2P.
// Depends on the global `mqtt` (mqtt.js, loaded via CDN).

const BROKERS = ['wss://broker.emqx.io:8084/mqtt', 'wss://broker.hivemq.com:8884/mqtt'];
const PREFIX = 'dualarcade/v1';
const HEARTBEAT = 15000, STALE = 45000, LB_STALE = 30 * 24 * 3600 * 1000;   // hide leaderboard entries older than 30d

const P = { client: null, circle: 'public', name: '', peerId: '', uid: '', players: new Map(), onList: null, hb: null, prune: null, scores: new Map(), onLb: null, score: { level: 1, rating: 1000, coins: 0 } };

function topicSelf() { return `${PREFIX}/${P.circle}/p/${P.peerId}`; }
// Leaderboard is GLOBAL and keyed by the stable player uid (one durable entry per person),
// so rankings accumulate across sessions instead of resetting with the ephemeral peerId.
function topicScore() { return `${PREFIX}/global/lb/${P.uid}`; }
export function onLeaderboard(cb) { P.onLb = cb; }
function emitLb() {
  const now = Date.now();
  const list = [...P.scores.values()]
    .filter((v) => !v.ts || now - v.ts < LB_STALE)
    .sort((a, b) => (b.level - a.level) || (b.rating - a.rating) || (b.coins - a.coins));
  if (P.onLb) P.onLb(list);
}
// Publish our profile to the shared GLOBAL (unverified) leaderboard. score = {level, rating, coins}.
export function publishScore(score) {
  if (score) P.score = Object.assign({}, P.score, score);
  if (!P.client || !P.client.connected) return;
  P.client.publish(topicScore(), JSON.stringify(Object.assign({ name: P.name, ts: Date.now() }, P.score)), { retain: true, qos: 0 });
}
function emit() {
  const now = Date.now();
  const list = [];
  for (const [id, v] of P.players) { if (id !== P.peerId && now - v.ts < STALE) list.push({ peerId: id, name: v.name }); }
  list.sort((a, b) => a.name.localeCompare(b.name));
  if (P.onList) P.onList(list);
}
function publishPresence() {
  if (!P.client || !P.client.connected) return;
  P.client.publish(topicSelf(), JSON.stringify({ name: P.name, ts: Date.now() }), { retain: true, qos: 0 });
}

// goOnline(circle, name, peerId, onList, uid, score) -> connects & starts announcing. onList(list) called on changes.
export function goOnline(circle, name, peerId, onList, uid, score) {
  goOffline();
  P.circle = (circle || 'public').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 24) || 'public';
  P.name = (name || 'Player').slice(0, 16);
  P.peerId = peerId;
  P.uid = uid || peerId;
  P.onList = onList;
  P.score = Object.assign({ level: 1, rating: 1000, coins: 0 }, score || {});
  P.players = new Map();
  P.scores = new Map();
  const url = BROKERS[0];
  const willTopic = topicSelf();
  P.client = mqtt.connect(url, {
    clientId: 'da_' + peerId.slice(0, 12) + '_' + Math.floor(Math.random() * 1e4),
    keepalive: 30, reconnectPeriod: 4000, connectTimeout: 8000,
    will: { topic: willTopic, payload: '', retain: true, qos: 0 },   // auto-clear on disconnect
  });
  P.client.on('connect', () => {
    P.client.subscribe(`${PREFIX}/${P.circle}/p/+`, { qos: 0 });
    P.client.subscribe(`${PREFIX}/global/lb/+`, { qos: 0 });
    publishPresence();
    publishScore();
    clearInterval(P.hb); P.hb = setInterval(publishPresence, HEARTBEAT);
    clearInterval(P.prune); P.prune = setInterval(() => { emit(); emitLb(); }, 10000);
    emit();
  });
  P.client.on('message', (topic, payload) => {
    const parts = topic.split('/');
    const id = parts.pop(), kind = parts[parts.length - 1];   // .../{p|lb}/{id}
    const s = payload.toString();
    if (kind === 'lb') {
      if (!s) { P.scores.delete(id); emitLb(); return; }
      try { const v = JSON.parse(s); P.scores.set(id, { name: v.name || 'Player', level: v.level || 1, rating: v.rating || 1000, coins: v.coins || 0, ts: v.ts || 0 }); emitLb(); } catch (e) {}
      return;
    }
    if (!s) { P.players.delete(id); emit(); return; }        // will/leave cleared it
    try { const { name: nm, ts } = JSON.parse(s); P.players.set(id, { name: nm || 'Player', ts: ts || Date.now() }); emit(); } catch (e) {}
  });
  P.client.on('error', () => {});
}

export function goOffline() {
  clearInterval(P.hb); clearInterval(P.prune); P.hb = P.prune = null;
  if (P.client) {
    // Clear only presence (topicSelf); leave the retained global leaderboard entry so the ranking persists.
    try { P.client.publish(topicSelf(), '', { retain: true, qos: 0 }); P.client.end(true); } catch (e) {}
    P.client = null;
  }
  P.players = new Map();
  P.scores = new Map();
}
export function isOnline() { return !!(P.client && P.client.connected); }
