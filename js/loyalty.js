// Loyalty economy — XP/levels, spendable coins, a cosmetics shop, daily bonus. All localStorage.
import { levelForXp, tierForLevel, xpCoinsForResult } from './logic.js?v=14';
import { t } from './i18n.js?v=14';
import { sound } from './sound.js?v=14';

const read = (k, d) => { try { const s = localStorage.getItem(k); return s ? JSON.parse(s) : d; } catch (e) { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
const getS = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch (e) { return d; } };
const setS = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };

const DEFAULT = { xp: 0, coins: 0, owned: [], lastDaily: '', dailyStreak: 0 };
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
// Called from recordResult. info = {outcome}, streak = current win streak, newAch = # of new achievements.
export function earnForResult(outcome, streak, newAch) {
  const s = load();
  const before = levelForXp(s.xp).level;
  const g = xpCoinsForResult(outcome, streak);
  let xp = g.xp, coins = g.coins;
  if (newAch) { xp += newAch * 40; coins += newAch * 50; }
  s.xp += xp; s.coins += coins;
  save(s);
  const after = levelForXp(s.xp).level;
  return { xpGain: xp, coinGain: coins, leveledUp: after > before, level: after, tier: tierForLevel(after) };
}

// Daily login bonus. Uses local date. Returns {claimed, coins, xp, streak}.
function ymd(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
export function claimDaily() {
  const s = load();
  const now = new Date();
  const today = ymd(now);
  if (s.lastDaily === today) return { claimed: false };
  const y = new Date(now); y.setDate(y.getDate() - 1);
  s.dailyStreak = (s.lastDaily === ymd(y)) ? (s.dailyStreak || 0) + 1 : 1;
  const coins = 25 + Math.min(s.dailyStreak, 7) * 10;
  s.coins += coins; s.xp += 10; s.lastDaily = today;
  save(s);
  return { claimed: true, coins, xp: 10, streak: s.dailyStreak };
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
  top.appendChild(el('span', 'font-bold', `${li.tier.emoji} ${t('level')} ${li.level} · ${t('tier_' + li.tier.key)}`));
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
