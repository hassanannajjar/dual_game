// Player profile + progression — stats, per-game rating, achievements. All localStorage.
import { t } from './i18n.js?v=28';
import { sound } from './sound.js?v=28';
import { getName, setName } from './prefs.js?v=28';
import { nextRating, evalAchievements, ACHIEVEMENTS, historyPush, seasonId, softResetRating, rankTier } from './logic.js?v=28';
import { earnForResult, grantAchievement, questEvent, getLevel, getStreak, renderLevelHeader, renderShop, renderQuests, renderWeekly, renderStreak, renderGifts, owns, equip, REWARDS } from './loyalty.js?v=28';
import { getToken } from './identity.js?v=28';
import { getFavs } from './favorites.js?v=28';

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

  // Match history (newest-first, capped).
  write('arcade:history', historyPush(read('arcade:history', []), {
    gameId: info.gameId, outcome: info.outcome, opp: info.oppName || '', vsBot: !!info.vsBot, solo: !!info.solo, ts: Date.now(),
  }));

  // Loyalty earn first (updates xp/level, applies booster + level-up gifts).
  const earn = earnForResult(info.outcome, g.streak);

  // Achievements — evaluated with the post-earn level + login streak; each new one pays out.
  const had = loadAch();
  const now = evalAchievements(s, { level: getLevel(), streakDays: getStreak(), favs: getFavs().length });
  const unlocked = now.filter((id) => !had.includes(id));
  if (unlocked.length) { write('arcade:ach', now); sound('badge'); const ar = grantAchievement(unlocked.length); earn.coinGain += ar.coins; }

  // Daily quests progress off the same event.
  const q = questEvent({
    played: 1, win: info.outcome === 'win', online: !info.vsBot && !info.solo,
    beatBot: info.vsBot && info.outcome === 'win', gameId: info.gameId, coins: earn.coinGain, winStreak: g.streak,
  });

  return Object.assign({ delta, unlocked, questsDone: q.completed, chestFromQuests: q.grantedChest, weeklyDone: q.weeklyDone }, earn);
}

// ---------- ranked seasons ---------- soft-reset ratings at each new calendar-month season.
export function applySeason() {
  const cur = seasonId(new Date());
  const prev = read('arcade:season', null);
  if (prev && prev.id === cur) return prev;
  const s = loadStats();
  let bestPrev = 0;
  for (const g of Object.values(s.games)) { bestPrev = Math.max(bestPrev, g.rating || 1000); if (prev) g.rating = softResetRating(g.rating || 1000); }
  if (prev) saveStats(s);                                   // only reset when carrying over from a prior season
  const rec = { id: cur, prevBest: prev ? bestPrev : 0 };
  write('arcade:season', rec);
  return rec;
}
export function currentSeason() { return read('arcade:season', { id: seasonId(new Date()), prevBest: 0 }); }
export function myRankTier() { return rankTier(overallRating()); }

// ---------- share card ---------- returns true if it fell back to clipboard (caller can toast).
export function shareStats(games) {
  const s = loadStats(); const played = Object.values(s.games);
  const totW = played.reduce((a, g) => a + (g.w || 0), 0);
  const rt = rankTier(overallRating());
  const url = location.origin + location.pathname;
  const text = t('share_text', { tier: rt.emoji, rating: overallRating(), wins: totW, games: played.length, url });
  if (navigator.share) { navigator.share({ text }).catch(() => {}); return false; }
  if (navigator.clipboard) { navigator.clipboard.writeText(text).catch(() => {}); return true; }
  return false;
}

// ---------- profile modal ----------
const esc = (s) => String(s == null ? '' : s).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
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

  // weekly challenge, daily quests, streak calendar, gifts
  if ($('weekly')) renderWeekly($('weekly'), () => renderProfile(games));
  if ($('quests')) renderQuests($('quests'), () => renderProfile(games));
  if ($('streak-cal')) renderStreak($('streak-cal'));
  if ($('gifts')) renderGifts($('gifts'), () => renderProfile(games));

  // shop
  renderShop($('shop'), () => renderProfile(games));

  const s = loadStats();
  const played = (games || []).filter((g) => s.games[g.id]);
  const totW = played.reduce((a, g) => a + s.games[g.id].w, 0);
  const totP = played.reduce((a, g) => a + s.games[g.id].w + s.games[g.id].l + s.games[g.id].d, 0);
  const rt = rankTier(overallRating());
  $('profile-totals').innerHTML = t('profile_totals', { w: totW, p: totP, r: overallRating() }) +
    ` · <span class="text-indigo-300">${rt.emoji} ${t('rank_' + rt.key)}</span>`;

  if ($('history')) renderHistory($('history'), games);

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

function renderHistory(box, games) {
  box.innerHTML = '';
  const h = read('arcade:history', []);
  if (!h.length) { box.appendChild(el('p', 'text-sm text-slate-500 text-center py-2', t('no_history'))); return; }
  const byId = {}; (games || []).forEach((g) => { byId[g.id] = g; });
  for (const m of h.slice(0, 12)) {
    const g = byId[m.gameId];
    const dot = m.outcome === 'win' ? '🟢' : m.outcome === 'lose' ? '🔴' : '🟡';
    const who = m.vsBot ? t('bot') : m.solo ? t('play_alone').replace(/^▶ ?/, '') : (m.opp ? esc(m.opp) : t('opponent'));
    const row = el('div', 'flex items-center justify-between gap-2 text-sm py-1 border-b border-slate-800');
    row.appendChild(el('span', 'flex-1 truncate', `${dot} ${g ? g.emoji : '🎮'} ${g ? gName(g) : m.gameId}`));
    row.appendChild(el('span', 'text-xs text-slate-500 truncate max-w-[45%]', who));
    box.appendChild(row);
  }
}

export function initProfile() {
  applySeason();                                            // roll the ranked season forward (soft reset) if needed
  $('profile-name').oninput = (e) => setName(e.target.value.slice(0, 16));
}
