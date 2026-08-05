// Loyalty economy — XP/levels, spendable coins, a cosmetics shop, daily bonus. All localStorage.
import { levelForXp, tierForLevel, xpCoinsForResult, levelRewardCoins, dailyReward, pickDailyQuests, chestRoll, isoWeekKey, pickWeekly } from './logic.js?v=32';
import { t } from './i18n.js?v=32';
import { sound } from './sound.js?v=32';

const read = (k, d) => { try { const s = localStorage.getItem(k); return s ? JSON.parse(s) : d; } catch (e) { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
const getS = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch (e) { return d; } };
const setS = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };

const DEFAULT = { xp: 0, coins: 0, owned: [], lastDaily: '', dailyStreak: 0, chests: 0, boosterMatches: 0 };
function load() { return Object.assign({}, DEFAULT, read('arcade:loyalty', {})); }
function save(s) { write('arcade:loyalty', s); }

let NOTIFY = () => {};
export function setNotify(fn) { NOTIFY = fn || NOTIFY; }

// ---------- reward catalog ----------
// Free defaults are always owned. Others need coins (cost) or a level (levelReq).
const FREE = new Set(['avatar:🦊', 'avatar:🐼', 'avatar:🐸', 'avatar:🦁', 'theme:indigo', 'theme:emerald', 'skin:classic']);
export const REWARDS = [
  // avatars
  { id: 'avatar:🐧', type: 'avatar', emoji: '🐧', cost: 150 },
  { id: 'avatar:🐙', type: 'avatar', emoji: '🐙', cost: 200 },
  { id: 'avatar:🎲', type: 'avatar', emoji: '🎲', cost: 250 },
  { id: 'avatar:🐳', type: 'avatar', emoji: '🐳', cost: 300 },
  { id: 'avatar:🦄', type: 'avatar', emoji: '🦄', cost: 400 },
  { id: 'avatar:🤖', type: 'avatar', emoji: '🤖', levelReq: 5 },
  { id: 'avatar:👾', type: 'avatar', emoji: '👾', levelReq: 8 },
  { id: 'avatar:⚡', type: 'avatar', emoji: '⚡', levelReq: 12 },
  // accent themes (color dot)
  { id: 'theme:rose', type: 'theme', color: '#f43f5e', cost: 300 },
  { id: 'theme:amber', type: 'theme', color: '#f59e0b', cost: 300 },
  { id: 'theme:sky', type: 'theme', color: '#0ea5e9', levelReq: 5 },
  { id: 'theme:teal', type: 'theme', color: '#14b8a6', levelReq: 10 },
  { id: 'theme:violet', type: 'theme', color: '#8b5cf6', cost: 600 },
  // 2048 tile skins
  { id: 'skin:mono', type: 'skin', label: 'Mono', cost: 300 },
  { id: 'skin:neon', type: 'skin', label: 'Neon', cost: 500 },
  { id: 'skin:pastel', type: 'skin', label: 'Pastel', levelReq: 7 },
];
const byId = (id) => REWARDS.find((r) => r.id === id);

// ---------- queries ----------
export function getXp() { return load().xp; }
export function getCoins() { return load().coins; }
export function getLevel() { return levelForXp(load().xp).level; }
export function getLevelInfo() { const s = load(); const li = levelForXp(s.xp); return Object.assign(li, { tier: tierForLevel(li.level), coins: s.coins }); }
export function owns(id) { return FREE.has(id) || load().owned.includes(id); }
export function getSkin() { const id = 'skin:' + getS('arcade:skin', 'classic'); return owns(id) ? getS('arcade:skin', 'classic') : 'classic'; }
export function getEquipped(type) {
  if (type === 'avatar') return 'avatar:' + getS('arcade:avatar', '🦊');
  if (type === 'theme') return 'theme:' + getS('arcade:theme', 'indigo');
  if (type === 'skin') return 'skin:' + getS('arcade:skin', 'classic');
  return null;
}

// ---------- earn ----------
export function getStreak() { return load().dailyStreak || 0; }
export function getChests() { return load().chests || 0; }
export function getBooster() { return load().boosterMatches || 0; }

// Match reward: base xp/coins + 2x booster (coins only) + level-up coin gifts (chest every 5 levels).
export function earnForResult(outcome, streak) {
  const s = load();
  const before = levelForXp(s.xp).level;
  const g = xpCoinsForResult(outcome, streak);
  let xp = g.xp, coins = g.coins, boosterUsed = false;
  if (s.boosterMatches > 0) { coins *= 2; s.boosterMatches--; boosterUsed = true; }
  s.xp += xp;
  const after = levelForXp(s.xp).level;
  let chestsGranted = 0;
  for (let L = before + 1; L <= after; L++) { coins += levelRewardCoins(L); if (L % 5 === 0) { s.chests++; chestsGranted++; } }
  s.coins += coins;
  save(s);
  return { xpGain: xp, coinGain: coins, leveledUp: after > before, level: after, tier: tierForLevel(after), chestsGranted, boosterUsed };
}
// Lump reward when achievements unlock (called from recordResult with the count of new ones).
export function grantAchievement(n) {
  if (!n) return { coins: 0, xp: 0 };
  const s = load(); const coins = n * 50, xp = n * 40; s.coins += coins; s.xp += xp; save(s);
  return { coins, xp };
}

// Daily login bonus (7-day escalating calendar; day 7 also drops a chest).
function ymd(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
export function claimDaily() {
  const s = load();
  const now = new Date();
  const today = ymd(now);
  if (s.lastDaily === today) return { claimed: false, streak: s.dailyStreak };
  const y = new Date(now); y.setDate(y.getDate() - 1);
  s.dailyStreak = (s.lastDaily === ymd(y)) ? (s.dailyStreak || 0) + 1 : 1;
  const r = dailyReward(s.dailyStreak);
  s.coins += r.coins; s.xp += 10; s.lastDaily = today;
  let chest = false; if (r.chest) { s.chests++; chest = true; }
  save(s);
  return { claimed: true, coins: r.coins, xp: 10, streak: s.dailyStreak, chest };
}

// ---------- gift chests + boosters ----------
export function openChest() {
  const s = load(); if ((s.chests || 0) <= 0) return null;
  s.chests--;
  const roll = chestRoll(Math.random);
  s.coins += roll.coins;
  let booster = 0;
  if (roll.booster) { s.boosterMatches = (s.boosterMatches || 0) + 3; booster = 3; }
  let cosmetic = null;
  if (Math.random() < 0.25) { const locked = REWARDS.filter((r) => !owns(r.id)); if (locked.length) { cosmetic = locked[Math.floor(Math.random() * locked.length)]; s.owned.push(cosmetic.id); } }
  save(s); sound('chest');
  return { coins: roll.coins, booster, cosmetic };
}

// ---------- daily quests ----------
const QKEY = 'arcade:quests';
function loadQuests() {
  const today = ymd(new Date());
  let q = read(QKEY, null);
  if (!q || q.date !== today) {
    q = { date: today, list: pickDailyQuests(today).map((x) => Object.assign({}, x, { prog: 0, done: false, claimed: false })), games: [], chestGiven: false };
    write(QKEY, q);
  }
  return q;
}
export function getQuests() { const q = loadQuests(); return { list: q.list, allDone: q.list.every((x) => x.done) }; }
// ev = { played, win, online, beatBot, gameId, coins, winStreak }
export function questEvent(ev) {
  const q = loadQuests(); const completed = [];
  const isNew = ev.gameId && !q.games.includes(ev.gameId);
  if (isNew) q.games.push(ev.gameId);
  for (const quest of q.list) {
    if (quest.done) continue;
    let inc = 0;
    switch (quest.type) {
      case 'play': inc = ev.played ? 1 : 0; break;
      case 'win': inc = ev.win ? 1 : 0; break;
      case 'winstreak': if (ev.win && (ev.winStreak || 0) >= quest.target) quest.prog = quest.target; break;
      case 'beatbot': inc = ev.beatBot ? 1 : 0; break;
      case 'online': inc = ev.online ? 1 : 0; break;
      case 'winonline': inc = (ev.win && ev.online) ? 1 : 0; break;
      case 'trynew': inc = isNew ? 1 : 0; break;
      case 'variety': quest.prog = Math.min(quest.target, q.games.length); break;
      case 'earncoins': inc = ev.coins || 0; break;
    }
    if (inc) quest.prog = Math.min(quest.target, quest.prog + inc);
    if (!quest.done && quest.prog >= quest.target) { quest.done = true; completed.push(quest); }
  }
  let grantedChest = false;
  if (q.list.every((x) => x.done) && !q.chestGiven) { q.chestGiven = true; const s = load(); s.chests = (s.chests || 0) + 1; save(s); grantedChest = true; }
  write(QKEY, q);
  const weeklyDone = advanceWeekly(ev);
  return { completed, grantedChest, weeklyDone };
}

// ---------- weekly challenge ---------- one bigger rotating goal per ISO week; completing it drops a chest.
const WKEY = 'arcade:weekly';
function loadWeekly() {
  const week = isoWeekKey(new Date());
  let w = read(WKEY, null);
  if (!w || w.week !== week) {
    w = { week, q: Object.assign({}, pickWeekly(week), { prog: 0, done: false, claimed: false }), games: [] };
    write(WKEY, w);
  }
  return w;
}
export function getWeekly() { return loadWeekly().q; }
function advanceWeekly(ev) {
  const w = loadWeekly(); const q = w.q; if (q.done) return false;
  if (ev.gameId && !w.games.includes(ev.gameId)) w.games.push(ev.gameId);
  let inc = 0;
  switch (q.type) {
    case 'play': inc = ev.played ? 1 : 0; break;
    case 'win': inc = ev.win ? 1 : 0; break;
    case 'winstreak': if (ev.win && (ev.winStreak || 0) >= q.target) q.prog = q.target; break;
    case 'beatbot': inc = ev.beatBot ? 1 : 0; break;
    case 'online': inc = ev.online ? 1 : 0; break;
    case 'variety': q.prog = Math.min(q.target, w.games.length); break;
  }
  if (inc) q.prog = Math.min(q.target, q.prog + inc);
  const justDone = !q.done && q.prog >= q.target;
  if (justDone) q.done = true;
  write(WKEY, w);
  return justDone;
}
export function claimWeekly() {
  const w = loadWeekly(); const q = w.q;
  if (!q.done || q.claimed) return null;
  q.claimed = true; write(WKEY, w);
  const s = load(); s.coins += q.coins; s.xp += q.xp; s.chests = (s.chests || 0) + 1; save(s); sound('chest');
  return { coins: q.coins, xp: q.xp };
}
export function claimQuest(i) {
  const q = loadQuests(); const quest = q.list[i];
  if (!quest || !quest.done || quest.claimed) return null;
  quest.claimed = true; write(QKEY, q);
  const s = load(); s.coins += quest.coins; s.xp += quest.xp; save(s); sound('coin');
  return { coins: quest.coins, xp: quest.xp };
}

// ---------- buy / equip ----------
export function buy(id) {
  const r = byId(id); if (!r) return { ok: false };
  if (owns(id)) return { ok: true, already: true };
  const s = load();
  const level = levelForXp(s.xp).level;
  if (r.levelReq && level < r.levelReq) { NOTIFY(t('need_level', { n: r.levelReq })); return { ok: false, reason: 'level' }; }
  if (r.cost && s.coins < r.cost) { NOTIFY(t('need_coins')); return { ok: false, reason: 'coins' }; }
  if (r.cost) s.coins -= r.cost;
  s.owned.push(id); save(s); sound('badge');
  return { ok: true };
}
export function equip(id) {
  const r = byId(id); if (!r || !owns(id)) return false;
  const val = id.slice(id.indexOf(':') + 1);
  if (r.type === 'avatar') setS('arcade:avatar', val);
  else if (r.type === 'theme') { setS('arcade:theme', val); document.documentElement.dataset.theme = val; }  // ponytail: mirror prefs.applyTheme's 2 lines to avoid a prefs<->loyalty import cycle
  else if (r.type === 'skin') setS('arcade:skin', val);
  return true;
}

// ---------- UI ----------
function el(tag, cls, html) { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; }

export function renderLevelHeader(box) {
  box.innerHTML = '';
  const li = getLevelInfo();
  const pct = Math.round((li.into / li.need) * 100);
  const top = el('div', 'flex items-center justify-between text-sm');
  top.appendChild(el('span', 'font-bold', `⭐ ${t('level')} ${li.level}`));
  top.appendChild(el('span', 'font-semibold text-amber-400', `🪙 ${li.coins.toLocaleString()}`));
  box.appendChild(top);
  const bar = el('div', 'mt-1 h-2 rounded-full bg-slate-800 overflow-hidden');
  const fill = el('div', 'h-full bg-indigo-500 rounded-full transition-all');
  fill.style.width = pct + '%';
  bar.appendChild(fill);
  box.appendChild(bar);
  box.appendChild(el('p', 'mt-0.5 text-[11px] text-slate-500 text-end', `${li.into} / ${li.need} XP`));
}

export function renderShop(box, onChange) {
  box.innerHTML = '';
  const level = getLevel();
  for (const group of ['avatar', 'theme', 'skin']) {
    box.appendChild(el('h4', 'text-[11px] font-bold uppercase tracking-wider text-slate-500 mt-2 mb-1', t('shop_' + group)));
    const grid = el('div', 'grid grid-cols-4 gap-2');
    for (const r of REWARDS.filter((x) => x.type === group)) {
      const has = owns(r.id), equipped = has && getEquipped(group) === r.id;
      const card = el('button', 'flex flex-col items-center gap-1 p-2 rounded-xl border text-center ' +
        (equipped ? 'border-indigo-500 bg-slate-800' : has ? 'border-slate-700 bg-slate-800' : 'border-slate-800 bg-slate-900'));
      const face = r.type === 'theme'
        ? `<span class="inline-block w-6 h-6 rounded-full" style="background:${r.color}"></span>`
        : `<span class="text-2xl">${r.emoji || '🎨'}</span>`;
      card.appendChild(el('span', '', face));
      let tag;
      if (equipped) tag = el('span', 'text-[10px] text-indigo-400 font-semibold', '✓ ' + t('equipped'));
      else if (has) tag = el('span', 'text-[10px] text-slate-400', t('equip'));
      else if (r.levelReq && level < r.levelReq) tag = el('span', 'text-[10px] text-slate-500', '🔒 ' + t('lvl') + ' ' + r.levelReq);
      else tag = el('span', 'text-[10px] text-amber-400', '🪙 ' + r.cost);
      if (r.label) card.appendChild(el('span', 'text-[10px] text-slate-400', r.label));
      card.appendChild(tag);
      card.onclick = () => {
        if (has) { equip(r.id); } else { const res = buy(r.id); if (!res.ok) { onChange && onChange(); return; } equip(r.id); }
        onChange && onChange();
      };
      grid.appendChild(card);
    }
    box.appendChild(grid);
  }
}

export function renderQuests(box, onChange) {
  box.innerHTML = '';
  const { list } = getQuests();
  for (let i = 0; i < list.length; i++) {
    const q = list[i];
    const row = el('div', 'rounded-xl bg-slate-800/60 border border-slate-700 p-2.5 mb-2');
    const top = el('div', 'flex items-center justify-between gap-2 text-sm');
    top.appendChild(el('span', 'flex-1', t('quest_' + q.id)));
    if (q.claimed) top.appendChild(el('span', 'text-[11px] text-emerald-400 font-semibold', '✓ ' + t('claimed')));
    else if (q.done) { const b = el('button', 'text-[11px] px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-semibold', t('claim') + ' +' + q.coins + ' 🪙'); b.onclick = () => { claimQuest(i); onChange && onChange(); }; top.appendChild(b); }
    else top.appendChild(el('span', 'text-[11px] text-amber-400', '+' + q.coins + ' 🪙'));
    row.appendChild(top);
    const bar = el('div', 'mt-1.5 h-1.5 rounded-full bg-slate-900 overflow-hidden');
    const fill = el('div', 'h-full bg-indigo-500 rounded-full'); fill.style.width = Math.round(Math.min(1, q.prog / q.target) * 100) + '%'; bar.appendChild(fill);
    row.appendChild(bar);
    row.appendChild(el('p', 'mt-0.5 text-[10px] text-slate-500 text-end', q.prog + ' / ' + q.target));
    box.appendChild(row);
  }
}

export function renderWeekly(box, onChange) {
  box.innerHTML = '';
  const q = getWeekly();
  const row = el('div', 'rounded-xl bg-indigo-600/15 border border-indigo-500/40 p-2.5');
  const top = el('div', 'flex items-center justify-between gap-2 text-sm');
  top.appendChild(el('span', 'flex-1 font-semibold', '🏆 ' + t('weekly_' + q.id)));
  if (q.claimed) top.appendChild(el('span', 'text-[11px] text-emerald-400 font-semibold', '✓ ' + t('claimed')));
  else if (q.done) { const b = el('button', 'text-[11px] px-2 py-1 rounded-lg bg-amber-500 text-slate-900 hover:bg-amber-400 font-semibold', t('claim') + ' +' + q.coins + ' 🪙 🎁'); b.onclick = () => { claimWeekly(); onChange && onChange(); }; top.appendChild(b); }
  else top.appendChild(el('span', 'text-[11px] text-amber-400', '+' + q.coins + ' 🪙 · 🎁'));
  row.appendChild(top);
  const bar = el('div', 'mt-1.5 h-1.5 rounded-full bg-slate-900 overflow-hidden');
  const fill = el('div', 'h-full bg-indigo-400 rounded-full'); fill.style.width = Math.round(Math.min(1, q.prog / q.target) * 100) + '%'; bar.appendChild(fill);
  row.appendChild(bar);
  row.appendChild(el('p', 'mt-0.5 text-[10px] text-slate-400 text-end', q.prog + ' / ' + q.target));
  box.appendChild(row);
}

export function renderStreak(box) {
  box.innerHTML = '';
  const streak = getStreak();
  const dayIdx = (Math.max(1, streak) - 1) % 7;
  const row = el('div', 'flex items-stretch gap-1');
  for (let i = 0; i < 7; i++) {
    const r = dailyReward(i + 1);
    const cell = el('div', 'flex-1 text-center rounded-lg py-1.5 ' + (i <= dayIdx ? 'bg-indigo-600' : 'bg-slate-800') + (i === dayIdx ? ' ring-2 ring-white' : ''));
    cell.innerHTML = `<div class="text-[9px] text-slate-300">${t('day')} ${i + 1}</div><div class="text-[11px] font-bold">${r.chest ? '🎁' : r.coins}</div>`;
    row.appendChild(cell);
  }
  box.appendChild(row);
  box.appendChild(el('p', 'mt-1 text-[11px] text-slate-400 text-center', t('streak_days', { n: streak })));
}

export function renderGifts(box, onChange) {
  box.innerHTML = '';
  const chests = getChests(), booster = getBooster();
  const row = el('div', 'flex items-center justify-between gap-2');
  row.appendChild(el('span', 'text-sm', `🎁 ${t('chests')}: <b>${chests}</b>` + (booster ? `  ·  <span class="text-amber-400">⚡ 2x ×${booster}</span>` : '')));
  const b = el('button', 'px-3 py-1.5 rounded-lg font-semibold text-sm ' + (chests > 0 ? 'bg-amber-500 text-slate-900 hover:bg-amber-400' : 'bg-slate-700 text-slate-500'), t('open_chest'));
  b.disabled = chests <= 0;
  b.onclick = () => {
    const res = openChest();
    if (res) { let msg = '+' + res.coins + ' 🪙'; if (res.booster) msg += ' · ⚡2x'; if (res.cosmetic) msg += ' · ' + (res.cosmetic.emoji || '🎨'); NOTIFY(t('chest_opened', { msg })); }
    onChange && onChange();
  };
  row.appendChild(b);
  box.appendChild(row);
}
