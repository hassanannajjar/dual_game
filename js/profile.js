// Player profile + progression — stats, per-game rating, achievements. All localStorage.
import { t } from './i18n.js?v=48';
import { sound } from './sound.js?v=48';
import { getName, setName } from './prefs.js?v=48';
import { evalAchievements, ACHIEVEMENTS, historyPush, seasonId, softResetRating, rpDelta, rpRank, romanDiv } from './logic.js?v=48';
import { earnForResult, grantAchievement, questEvent, getLevel, getStreak, renderLevelHeader, renderShop, renderQuests, renderWeekly, renderStreak, renderGifts, owns, equip, REWARDS } from './loyalty.js?v=48';
import { getToken } from './identity.js?v=48';
import { getFavs } from './favorites.js?v=48';

const $ = (id) => document.getElementById(id);
const AVATARS = ['🦊', '🐼', '🐸', '🦁', '🐙', '🦄', '🐧', '🐳', '🤖', '👾', '🎲', '⚡'];

const read = (k, d) => { try { const s = localStorage.getItem(k); return s ? JSON.parse(s) : d; } catch (e) { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

function loadStats() { return read('arcade:stats', { games: {}, botWins: {}, cats: [] }); }
function saveStats(s) { write('arcade:stats', s); }
function loadAch() { return read('arcade:ach', []); }

export function getAvatar() { return read('arcade:avatar', AVATARS[0]); }

// Ranked Points — the single account-level competitive number.
export function getRP() { return loadStats().rp || 1000; }
export function getRating() { return getRP(); }        // legacy name — now returns RP (used in the P2P handshake)
export function overallRating() { return getRP(); }    // legacy name — now returns RP

// Record a finished match. Returns { delta, unlocked:[ids] } for the caller to surface.
// info: { gameId, outcome, category, vsBot, solo, botLevel, oppRating }
export function recordResult(info) {
  const s = loadStats();
  const g = s.games[info.gameId] || (s.games[info.gameId] = { w: 0, l: 0, d: 0, streak: 0, bestStreak: 0, rating: 1000 });
  if (info.category && !s.cats.includes(info.category)) s.cats.push(info.category);

  if (info.outcome === 'win') { g.w++; g.streak++; g.bestStreak = Math.max(g.bestStreak, g.streak); }
  else if (info.outcome === 'draw') { g.d++; g.streak = 0; }
  else { g.l++; g.streak = 0; }

  if (info.vsBot && info.outcome === 'win') s.botWins[info.botLevel || 'medium'] = (s.botWins[info.botLevel || 'medium'] || 0) + 1;
  // Ranked Points — moves on every match (online / bot / solo).
  const rpRes = rpDelta({ outcome: info.outcome, vsBot: info.vsBot, solo: info.solo, botLevel: info.botLevel, oppRating: info.oppRating, streak: g.streak, close: info.close }, s.rp || 1000);
  s.rp = rpRes.rp;
  saveStats(s);

  // Match history (newest-first, capped).
  write('arcade:history', historyPush(read('arcade:history', []), {
    gameId: info.gameId, outcome: info.outcome, opp: info.oppName || '', vsBot: !!info.vsBot, solo: !!info.solo, ts: Date.now(),
  }));

  // Loyalty earn first (updates xp/level, applies booster + level-up gifts).
  const earn = earnForResult(info.outcome, g.streak, info.perfBonus);

  // Achievements — evaluated with the post-earn level + login streak; each new one pays out.
  const had = loadAch();
  const now = evalAchievements(s, { level: getLevel(), streakDays: getStreak(), favs: getFavs().length, rp: s.rp || 1000 });
  const unlocked = now.filter((id) => !had.includes(id));
  if (unlocked.length) { write('arcade:ach', now); sound('badge'); const ar = grantAchievement(unlocked.length); earn.coinGain += ar.coins; }

  // Daily quests progress off the same event.
  const q = questEvent({
    played: 1, win: info.outcome === 'win', online: !info.vsBot && !info.solo,
    beatBot: info.vsBot && info.outcome === 'win', gameId: info.gameId, coins: earn.coinGain, winStreak: g.streak,
  });

  return Object.assign({ delta: rpRes.delta, rpGain: rpRes.delta, streak: g.streak, unlocked, questsDone: q.completed, chestFromQuests: q.grantedChest, weeklyDone: q.weeklyDone }, earn);
}

// ---------- ranked seasons ---------- soft-reset ratings at each new calendar-month season.
export function applySeason() {
  const cur = seasonId(new Date());
  const prev = read('arcade:season', null);
  if (prev && prev.id === cur) return prev;
  const s = loadStats();
  const bestPrev = s.rp || 1000;
  if (prev) { s.rp = softResetRating(s.rp || 1000); saveStats(s); }   // soft-reset RP toward 1000 each new season
  const rec = { id: cur, prevBest: prev ? bestPrev : 0 };
  write('arcade:season', rec);
  return rec;
}
export function currentSeason() { return read('arcade:season', { id: seasonId(new Date()), prevBest: 0 }); }
export function myRankTier() { return rpRank(getRP()); }

// ---------- share card ---------- returns true if it fell back to clipboard (caller can toast).
export function shareStats(games) {
  const s = loadStats(); const played = Object.values(s.games);
  const totW = played.reduce((a, g) => a + (g.w || 0), 0);
  const rp = getRP(), r = rpRank(rp);
  const url = location.origin + location.pathname;
  const text = t('share_text', { tier: r.emoji, rating: rp, wins: totW, games: played.length, url });
  if (navigator.share) { navigator.share({ text }).catch(() => {}); return false; }
  if (navigator.clipboard) { navigator.clipboard.writeText(text).catch(() => {}); return true; }
  return false;
}

// Share a single match result (game + outcome + current RP). Returns true if it fell back to clipboard.
export function shareResult(gameLabel, outcome, rpGain) {
  const rp = getRP(), r = rpRank(rp);
  const emoji = outcome === 'win' ? '🏆' : outcome === 'draw' ? '🤝' : '💪';
  const delta = (rpGain >= 0 ? '+' : '') + (rpGain || 0);
  const url = location.origin + location.pathname;
  const text = t('share_result_text', { emoji, game: gameLabel, tier: r.emoji, rp, delta, url });
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

// Compact, shareable summary of my record — broadcast on the leaderboard so others can view my profile.
// Only played games (as "w-l-d") + earned achievement ids → stays small (sub-1KB).
export function myProfileSummary() {
  const s = loadStats(); const games = {};
  for (const id in s.games) { const g = s.games[id]; const p = (g.w || 0) + (g.l || 0) + (g.d || 0); if (p) games[id] = `${g.w || 0}-${g.l || 0}-${g.d || 0}`; }
  const out = { games, ach: loadAch() };
  try { const c = JSON.parse(localStorage.getItem('arcade:2048campaign') || 'null'); if (c && c.unlocked > 1) out.c2048 = { last: c.unlocked, stars: c.totalStars || 0 }; } catch (e) {}
  return out;
}

// ---------- read-only peer profile (opened from a leaderboard row) ----------
// entry: { name, avatar, level, rating, online, prof:{ games:{id:'w-l-d'}, ach:[ids] } } — prof may be absent (older client).
export function openPeerProfile(entry, games) {
  const panel = $('peer-panel'); if (!panel || !entry) return;
  renderPeerProfile(entry, games);
  panel.classList.remove('hidden');
}
export function closePeerProfile() { const p = $('peer-panel'); if (p) p.classList.add('hidden'); }

function renderPeerProfile(entry, games) {
  const prof = entry.prof || null;
  const dot = `<span class="${entry.online ? 'text-emerald-400' : 'text-slate-600'}">●</span>`;
  const hdr = $('peer-header');
  if (hdr) hdr.innerHTML = `<div class="flex items-center gap-3"><span class="text-4xl">${entry.avatar || '🎮'}</span><div class="min-w-0"><p class="font-bold text-lg truncate flex items-center gap-1.5">${esc(entry.name)} ${dot}</p><p class="text-xs text-slate-400">${t('lvl')}${entry.level || 1} · ${entry.online ? t('online_now_short') : t('offline')}</p></div></div>`;

  const rp = Math.round(entry.rating || 1000), r = rpRank(rp);
  const rb = $('peer-rank');
  if (rb) {
    rb.innerHTML = '';
    const top = el('div', 'flex items-center justify-between');
    top.appendChild(el('span', 'font-display font-bold text-lg', `${r.emoji} ${t('rank_' + r.key)}${r.division ? ' ' + romanDiv(r.division) : ''}`));
    top.appendChild(el('span', 'font-mono font-bold text-indigo-300', `${rp} <span class="text-[10px] text-slate-400">RP</span>`));
    rb.appendChild(top);
    const bar = el('div', 'mt-2 h-2 rounded-full bg-slate-800 overflow-hidden');
    const fill = el('div', 'h-full bg-indigo-500 rounded-full'); fill.style.width = Math.round(r.pct * 100) + '%'; bar.appendChild(fill);
    rb.appendChild(bar);
  }

  const note = $('peer-note'); if (note) note.textContent = prof ? '' : t('peer_basics_only');

  // per-game W/L/D (most wins first)
  const tbl = $('peer-stats');
  if (tbl) {
    tbl.innerHTML = '';
    const byId = {}; (games || []).forEach((g) => { byId[g.id] = g; });
    const rows = Object.keys((prof && prof.games) || {}).map((id) => {
      const parts = String(prof.games[id]).split('-'); return { id, w: +parts[0] || 0, l: +parts[1] || 0, d: +parts[2] || 0 };
    }).sort((a, b) => (b.w - a.w) || ((b.w + b.l + b.d) - (a.w + a.l + a.d)));
    if (!rows.length) tbl.appendChild(el('p', 'text-sm text-slate-500 text-center py-2', t('no_stats')));
    for (const row of rows) {
      const g = byId[row.id];
      const line = el('div', 'flex items-center justify-between gap-2 text-sm py-1.5 border-b border-slate-800');
      line.appendChild(el('span', 'flex-1 truncate', `${g ? g.emoji : '🎮'} ${g ? gName(g) : row.id}`));
      line.appendChild(el('span', 'text-slate-400 tabular-nums', `${row.w}/${row.l}/${row.d}`));
      tbl.appendChild(line);
    }
  }

  // achievements grid (earned highlighted)
  const grid = $('peer-ach');
  if (grid) {
    grid.innerHTML = '';
    const earned = new Set((prof && prof.ach) || []);
    for (const a of ACHIEVEMENTS) {
      const got = earned.has(a.id);
      const cell = el('div', 'flex flex-col items-center text-center gap-1 p-2 rounded-xl ' + (got ? 'bg-slate-800' : 'bg-slate-900 opacity-40'));
      cell.appendChild(el('span', 'text-2xl', got ? a.emoji : '🔒'));
      cell.appendChild(el('span', 'text-[10px] leading-tight text-slate-400', achLabel(a.id)));
      grid.appendChild(cell);
    }
  }
}

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
  if ($('rank-card')) renderRank($('rank-card'));
  $('profile-totals').textContent = t('profile_totals_np', { w: totW, p: totP });

  if ($('history')) renderHistory($('history'), games);

  // per-game table (W/L/D, most-played first)
  const tbl = $('profile-stats'); tbl.innerHTML = '';
  if (!played.length) tbl.appendChild(el('p', 'text-sm text-slate-500 text-center py-2', t('no_stats')));
  const plays = (id) => s.games[id].w + s.games[id].l + s.games[id].d;
  played.sort((a, b) => (s.games[b.id].w - s.games[a.id].w) || (plays(b.id) - plays(a.id)));
  for (const g of played) {
    const st = s.games[g.id];
    const row = el('div', 'flex items-center justify-between gap-2 text-sm py-1.5 border-b border-slate-800');
    row.appendChild(el('span', 'flex-1 truncate', `${g.emoji} ${gName(g)}`));
    row.appendChild(el('span', 'text-slate-400 tabular-nums', `${st.w}/${st.l}/${st.d}`));
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

function renderRank(box) {
  const rp = getRP(), r = rpRank(rp);
  box.innerHTML = '';
  const top = el('div', 'flex items-center justify-between');
  top.appendChild(el('span', 'font-display font-bold text-lg', `${r.emoji} ${t('rank_' + r.key)}${r.division ? ' ' + romanDiv(r.division) : ''}`));
  top.appendChild(el('span', 'font-mono font-bold text-indigo-300', `${rp} <span class="text-[10px] text-slate-400">RP</span>`));
  box.appendChild(top);
  const bar = el('div', 'mt-2 h-2 rounded-full bg-slate-800 overflow-hidden');
  const fill = el('div', 'h-full bg-indigo-500 rounded-full transition-all'); fill.style.width = Math.round(r.pct * 100) + '%'; bar.appendChild(fill);
  box.appendChild(bar);
  box.appendChild(el('p', 'mt-1 text-[11px] text-slate-400', r.nextKey ? t('rp_to_next', { n: r.toNext, tier: t('rank_' + r.nextKey) }) : t('rp_caption')));
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
  const pc = $('btn-peer-close'), pc2 = $('btn-peer-close2'), pp = $('peer-panel');
  if (pc) pc.onclick = closePeerProfile;
  if (pc2) pc2.onclick = closePeerProfile;
  if (pp) pp.addEventListener('click', (e) => { if (e.target === pp) closePeerProfile(); });
}
