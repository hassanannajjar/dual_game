// Presence directory over a public MQTT broker (no backend). Games stay P2P.
// Depends on the global `mqtt` (mqtt.js, loaded via CDN).

const BROKERS = ['wss://broker.emqx.io:8084/mqtt', 'wss://broker.hivemq.com:8884/mqtt'];
const PREFIX = 'dualarcade/v1';
const HEARTBEAT = 15000, STALE = 45000;

const P = { client: null, circle: 'public', name: '', peerId: '', players: new Map(), onList: null, hb: null, prune: null };

function topicSelf() { return `${PREFIX}/${P.circle}/p/${P.peerId}`; }
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

// goOnline(circle, name, peerId, onList) -> connects & starts announcing. onList(list) called on changes.
export function goOnline(circle, name, peerId, onList) {
  goOffline();
  P.circle = (circle || 'public').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 24) || 'public';
  P.name = (name || 'Player').slice(0, 16);
  P.peerId = peerId;
  P.onList = onList;
  P.players = new Map();
  const url = BROKERS[0];
  const willTopic = topicSelf();
  P.client = mqtt.connect(url, {
    clientId: 'da_' + peerId.slice(0, 12) + '_' + Math.floor(Math.random() * 1e4),
    keepalive: 30, reconnectPeriod: 4000, connectTimeout: 8000,
    will: { topic: willTopic, payload: '', retain: true, qos: 0 },   // auto-clear on disconnect
  });
  P.client.on('connect', () => {
    P.client.subscribe(`${PREFIX}/${P.circle}/p/+`, { qos: 0 });
    publishPresence();
    clearInterval(P.hb); P.hb = setInterval(publishPresence, HEARTBEAT);
    clearInterval(P.prune); P.prune = setInterval(emit, 10000);
    emit();
  });
  P.client.on('message', (topic, payload) => {
    const id = topic.split('/').pop();
    const s = payload.toString();
    if (!s) { P.players.delete(id); emit(); return; }        // will/leave cleared it
    try { const { name: nm, ts } = JSON.parse(s); P.players.set(id, { name: nm || 'Player', ts: ts || Date.now() }); emit(); } catch (e) {}
  });
  P.client.on('error', () => {});
}

export function goOffline() {
  clearInterval(P.hb); clearInterval(P.prune); P.hb = P.prune = null;
  if (P.client) {
    try { P.client.publish(topicSelf(), '', { retain: true, qos: 0 }); P.client.end(true); } catch (e) {}
    P.client = null;
  }
  P.players = new Map();
}
export function isOnline() { return !!(P.client && P.client.connected); }
