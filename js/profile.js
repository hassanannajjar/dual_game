// Player profile + progression — stats, per-game rating, achievements. All localStorage.
import { t } from './i18n.js?v=21';
import { sound } from './sound.js?v=21';
import { getName, setName } from './prefs.js?v=21';
import { nextRating, evalAchievements, ACHIEVEMENTS } from './logic.js?v=21';
import { earnForResult, grantAchievement, questEvent, getLevel, getStreak, renderLevelHeader, renderShop, renderQuests, renderStreak, renderGifts, owns, equip, REWARDS } from './loyalty.js?v=21';
import { getToken } from './identity.js?v=21';

const $ = (id) => document.getElementById(id);
const AVATARS = ['🦊', '🐼', '🐸', '🦁', '🐙', '🦄', '🐧', '🐳', '🤖', '👾', '🎲', '⚡'];

const read = (k, d) => { try { const s = localStorage.getItem(k); return s ? JSON.parse(s) : d; } catch (e) { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

function loadStats() { return read('arcade:stats', { games: {}, botWins: {}, cats: [] }); }
function saveStats(s) { write('arcade:stats', s); }
function loadAch() { return read('arcade:ach', []); }

export function getAvatar() { return read('arcade:avatar', AVATARS[0]); }

export function getRating(gid) {
  const g = loadStats().games[gid];
  return g && g.rating ? g.rating : 1000;
}
export function overallRating() {
  const g = Object.values(loadStats().games);
  return g.length ? Math.max(...g.map((x) => x.rating || 1000)) : 1000;
}

// Record a finished match. Returns { delta, unlocked:[ids] } for the caller to surface.
// info: { gameId, outcome, category, vsBot, solo, botLevel, oppRating }
export function recordResult(info) {
  const s = loadStats();
  const g = s.games[info.gameId] || (s.games[info.gameId] = { w: 0, l: 0, d: 0, streak: 0, bestStreak: 0, rating: 1000 });
  if (info.category && !s.cats.includes(info.category)) s.cats.push(info.category);

  if (info.outcome === 'win') { g.w++; g.streak++; g.bestStreak = Math.max(g.bestStreak, g.streak); }
  else if (info.outcome === 'draw') { g.d++; g.streak = 0; }
  else { g.l++; g.streak = 0; }

  let delta = 0;
  if (info.vsBot) {
    if (info.outcome === 'win') s.botWins[info.botLevel || 'medium'] = (s.botWins[info.botLevel || 'medium'] || 0) + 1;
  } else if (!info.solo) {                                   // rating only for real online matches
    const before = g.rating;
    g.rating = nextRating(before, info.oppRating, info.outcome);
    delta = g.rating - before;
  }
  saveStats(s);

  // Loyalty earn first (updates xp/level, applies booster + level-up gifts).
  const earn = earnForResult(info.outcome, g.streak);

  // Achievements — evaluated with the post-earn level + login streak; each new one pays out.
  const had = loadAch();
  const now = evalAchievements(s, { level: getLevel(), streakDays: getStreak() });
  const unlocked = now.filter((id) => !had.includes(id));
  if (unlocked.length) { write('arcade:ach', now); sound('badge'); const ar = grantAchievement(unlocked.length); earn.coinGain += ar.coins; }

  // Daily quests progress off the same event.
  const q = questEvent({
    played: 1, win: info.outcome === 'win', online: !info.vsBot && !info.solo,
    beatBot: info.vsBot && info.outcome === 'win', gameId: info.gameId, coins: earn.coinGain, winStreak: g.streak,
  });

  return Object.assign({ delta, unlocked, questsDone: q.completed, chestFromQuests: q.grantedChest }, earn);
}

// ---------- profile modal ----------
function achLabel(id) { return t('ach_' + id); }
function el(tag, cls, html) { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; }
function gName(g) { const k = 'g_' + g.id.replace(/-/g, '_'); const s = t(k); return s === k ? g.name : s; }

// openProfile(games) — games is the engine's registry array (for names/emojis).
export function openProfile(games) {
  const panel = $('profile-panel'); if (!panel) return;
  renderProfile(games);
  panel.classList.remove('hidden');
}
export function closeProfile() { const p = $('profile-panel'); if (p) p.classList.add('hidden'); }

function renderProfile(games) {
  // level + coins header
  renderLevelHeader($('loyalty-header'));
  const tokEl = $('profile-token'); if (tokEl) tokEl.textContent = t('player_id') + ': ' + getToken();

  // avatar quick-equip: only owned avatars (get more in the shop below)
  const av = $('profile-avatars'); av.innerHTML = '';
  for (const a of AVATARS) {
    if (!owns('avatar:' + a)) continue;
    const b = el('button', 'text-2xl w-10 h-10 rounded-lg ' + (getAvatar() === a ? 'bg-indigo-600' : 'bg-slate-800'), a);
    b.onclick = () => { equip('avatar:' + a); renderProfile(games); };
    av.appendChild(b);
  }
  $('profile-name').value = getName();

  // daily quests, streak calendar, gifts
  if ($('quests')) renderQuests($('quests'), () => renderProfile(games));
  if ($('streak-cal')) renderStreak($('streak-cal'));
  if ($('gifts')) renderGifts($('gifts'), () => renderProfile(games));

  // shop
  renderShop($('shop'), () => renderProfile(games));

  const s = loadStats();
  const played = (games || []).filter((g) => s.games[g.id]);
  const totW = played.reduce((a, g) => a + s.games[g.id].w, 0);
  const totP = played.reduce((a, g) => a + s.games[g.id].w + s.games[g.id].l + s.games[g.id].d, 0);
  $('profile-totals').textContent = t('profile_totals', { w: totW, p: totP, r: overallRating() });

  // per-game table
  const tbl = $('profile-stats'); tbl.innerHTML = '';
  if (!played.length) tbl.appendChild(el('p', 'text-sm text-slate-500 text-center py-2', t('no_stats')));
  played.sort((a, b) => s.games[b.id].rating - s.games[a.id].rating);
  for (const g of played) {
    const st = s.games[g.id];
    const row = el('div', 'flex items-center justify-between gap-2 text-sm py-1.5 border-b border-slate-800');
    row.appendChild(el('span', 'flex-1 truncate', `${g.emoji} ${gName(g)}`));
    row.appendChild(el('span', 'text-slate-400 tabular-nums', `${st.w}/${st.l}/${st.d}`));
    row.appendChild(el('span', 'w-12 text-end font-semibold text-indigo-400 tabular-nums', st.rating));
    tbl.appendChild(row);
  }

  // achievements grid
  const earned = new Set(loadAch());
  const grid = $('profile-ach'); grid.innerHTML = '';
  for (const a of ACHIEVEMENTS) {
    const got = earned.has(a.id);
    const cell = el('div', 'flex flex-col items-center text-center gap-1 p-2 rounded-xl ' + (got ? 'bg-slate-800' : 'bg-slate-900 opacity-40'));
    cell.appendChild(el('span', 'text-2xl', got ? a.emoji : '🔒'));
    cell.appendChild(el('span', 'text-[10px] leading-tight text-slate-400', achLabel(a.id)));
    grid.appendChild(cell);
  }
}

export function initProfile() {
  $('profile-name').oninput = (e) => setName(e.target.value.slice(0, 16));
}
