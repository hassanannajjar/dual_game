// Recent players ("friends") — remembered by stable uid so you can rematch them. No backend.
import { upsertFriend } from './logic.js?v=40';

const KEY = 'arcade:friends';
const read = () => { try { const s = localStorage.getItem(KEY); return s ? JSON.parse(s) : []; } catch (e) { return []; } };
const write = (a) => { try { localStorage.setItem(KEY, JSON.stringify(a)); } catch (e) {} };

export function getFriends() { return read(); }
export function addFriend(f) {
  if (!f || !f.uid) return;
  write(upsertFriend(read(), { uid: f.uid, name: (f.name || 'Player').slice(0, 16), avatar: f.avatar || '🎮', ts: Date.now() }));
}
