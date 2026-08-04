// Stable per-device player identity — a generated UUID persisted once. No login/backend;
// it's a durable handle (dedupes the leaderboard, survives session changes), not authentication.

function rand() {
  try { if (crypto && crypto.randomUUID) return crypto.randomUUID(); } catch (e) {}
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0, v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function getUid() {
  try {
    let id = localStorage.getItem('arcade:uid');
    if (!id) { id = rand(); localStorage.setItem('arcade:uid', id); }
    return id;
  } catch (e) { return rand(); }
}
// Short, human-friendly form of the token (e.g. for a "Player ID" display).
export function getToken() { return getUid().replace(/-/g, '').slice(0, 8).toUpperCase(); }

// A stable, friendly default handle derived from the uid (used until the player sets a name),
// so they can go online instantly. e.g. "Fox-4821".
const GUEST_ANIMALS = ['Fox', 'Panda', 'Otter', 'Falcon', 'Wolf', 'Koala', 'Tiger', 'Raven', 'Lynx', 'Orca', 'Hawk', 'Bison', 'Puma', 'Heron', 'Gecko', 'Moose'];
export function getGuestName() {
  const t = getToken();
  let h = 0; for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) >>> 0;
  const num = (parseInt(t.slice(0, 4), 16) % 9000) + 1000;
  return `${GUEST_ANIMALS[h % GUEST_ANIMALS.length]}-${num}`;
}
