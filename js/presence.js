// Presence directory over a public MQTT broker (no backend). Games stay P2P.
// Depends on the global `mqtt` (mqtt.js, loaded via CDN).

const BROKERS = ['wss://broker.emqx.io:8084/mqtt', 'wss://broker.hivemq.com:8884/mqtt'];
const PREFIX = 'dualarcade/v1';
const HEARTBEAT = 15000, STALE = 45000;

const P = { client: null, circle: 'public', name: '', peerId: '', players: new Map(), onList: null, hb: null, prune: null, scores: new Map(), onLb: null, rating: 1000 };

function topicSelf() { return `${PREFIX}/${P.circle}/p/${P.peerId}`; }
function topicScore() { return `${PREFIX}/${P.circle}/lb/${P.peerId}`; }
export function onLeaderboard(cb) { P.onLb = cb; }
function emitLb() {
  const list = [...P.scores.values()].sort((a, b) => b.rating - a.rating);
  if (P.onLb) P.onLb(list);
}
// Publish our best rating to the shared (unverified) leaderboard for this circle.
export function publishScore(rating) {
  P.rating = rating || P.rating;
  if (!P.client || !P.client.connected) return;
  P.client.publish(topicScore(), JSON.stringify({ name: P.name, rating: P.rating }), { retain: true, qos: 0 });
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

// goOnline(circle, name, peerId, onList, rating) -> connects & starts announcing. onList(list) called on changes.
export function goOnline(circle, name, peerId, onList, rating) {
  goOffline();
  P.circle = (circle || 'public').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 24) || 'public';
  P.name = (name || 'Player').slice(0, 16);
  P.peerId = peerId;
  P.onList = onList;
  P.rating = rating || 1000;
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
    P.client.subscribe(`${PREFIX}/${P.circle}/lb/+`, { qos: 0 });
    publishPresence();
    publishScore(P.rating);
    clearInterval(P.hb); P.hb = setInterval(publishPresence, HEARTBEAT);
    clearInterval(P.prune); P.prune = setInterval(emit, 10000);
    emit();
  });
  P.client.on('message', (topic, payload) => {
    const parts = topic.split('/');
    const id = parts.pop(), kind = parts.pop();          // .../{p|lb}/{peerId}
    const s = payload.toString();
    if (kind === 'lb') {
      if (!s) { P.scores.delete(id); emitLb(); return; }
      try { const { name: nm, rating } = JSON.parse(s); P.scores.set(id, { name: nm || 'Player', rating: rating || 1000 }); emitLb(); } catch (e) {}
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
    try { P.client.publish(topicSelf(), '', { retain: true, qos: 0 }); P.client.publish(topicScore(), '', { retain: true, qos: 0 }); P.client.end(true); } catch (e) {}
    P.client = null;
  }
  P.players = new Map();
  P.scores = new Map();
}
export function isOnline() { return !!(P.client && P.client.connected); }
