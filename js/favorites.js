// Favorite games — a per-device set of game ids, persisted to arcade:favs. No network.
const KEY = 'arcade:favs';
function read() { try { const s = localStorage.getItem(KEY); return s ? JSON.parse(s) : []; } catch (e) { return []; } }
function write(a) { try { localStorage.setItem(KEY, JSON.stringify(a)); } catch (e) {} }

export function getFavs() { return read(); }
export function isFav(id) { return read().includes(id); }
export function toggleFav(id) {
  const a = read();
  const i = a.indexOf(id);
  if (i >= 0) a.splice(i, 1); else a.push(id);
  write(a);
  return i < 0;                 // true if now favorited
}
