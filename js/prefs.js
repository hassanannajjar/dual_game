// Preferences: display name, theme/accent, haptics + the settings panel.
import { applyLang, getLang, t, onLangChange } from './i18n.js?v=48';
import { setSound, soundOn, setVolume, getVolume, setMusic, musicOn, getMusicMode, playMix, playTrackNow, nowPlaying, getMusicList, onMusicChange, prefetchAudio, audioCached } from './sound.js?v=48';
import { owns, buy } from './loyalty.js?v=48';

const THEMES = ['indigo', 'emerald', 'rose', 'amber', 'sky', 'violet', 'teal'];
const SWATCH = { indigo: '#6366f1', emerald: '#10b981', rose: '#f43f5e', amber: '#f59e0b', sky: '#0ea5e9', violet: '#8b5cf6', teal: '#14b8a6' };

const get = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch (e) { return d; } };
const set = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };

export function getName() { return get('arcade:name', '') || ''; }
export function setName(n) { set('arcade:name', n || ''); }

export function applyTheme(theme) {
  const th = THEMES.includes(theme) ? theme : 'indigo';
  document.documentElement.dataset.theme = th;
  set('arcade:theme', th);
}
export function getTheme() { return get('arcade:theme', 'indigo'); }

export function getMode() { return get('arcade:mode', 'dark') === 'light' ? 'light' : 'dark'; }
export function applyMode(mode) {
  const m = mode === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.mode = m;
  set('arcade:mode', m);
}

export function hapticsOn() { return get('arcade:haptics', 'on') !== 'off'; }
export function setHaptics(on) { set('arcade:haptics', on ? 'on' : 'off'); }
export function haptic(pattern) {
  if (hapticsOn() && navigator.vibrate) { try { navigator.vibrate(pattern || 20); } catch (e) {} }
}

const $ = (id) => document.getElementById(id);
export function openPrefs() { $('prefs-panel').classList.remove('hidden'); refresh(); }
export function closePrefs() { $('prefs-panel').classList.add('hidden'); }

function refresh() {
  const en = getLang() === 'en';
  $('btn-lang-en').className = segCls(en);
  $('btn-lang-ar').className = segCls(!en);
  $('btn-sound-toggle').textContent = t(soundOn() ? 'on' : 'off');
  $('btn-sound-toggle').className = toggleCls(soundOn());
  if ($('pref-volume')) $('pref-volume').value = String(Math.round(getVolume() * 100));
  if ($('btn-music-toggle')) { $('btn-music-toggle').textContent = t(musicOn() ? 'on' : 'off'); $('btn-music-toggle').className = toggleCls(musicOn()); }
  if ($('btn-music-pick')) $('btn-music-pick').disabled = !musicOn();
  const light = getMode() === 'light';
  $('btn-mode-toggle').textContent = t(light ? 'mode_light' : 'mode_dark');
  $('btn-mode-toggle').className = toggleCls(!light);
  $('btn-haptics-toggle').textContent = t(hapticsOn() ? 'on' : 'off');
  $('btn-haptics-toggle').className = toggleCls(hapticsOn());
  $('pref-name').value = getName();
  buildSwatches();
}
// Theme swatches, gated by ownership: locked themes show 🔒 and route to a coin purchase.
// The first chip resets to the built-in default accent; clicking the active colour toggles back to it.
function buildSwatches() {
  const box = $('theme-swatches'); if (!box) return;
  box.innerHTML = '';
  const cur = getTheme();
  const def = document.createElement('button');
  def.dataset.themeSwatch = 'default';
  def.title = t('theme_default');
  def.className = 'relative w-9 h-9 rounded-full grid place-items-center text-sm font-bold bg-slate-700 text-slate-200 ring-offset-2 ring-offset-slate-900 ' + (cur === 'indigo' ? 'ring-2 ring-white' : '');
  def.textContent = '⌀';
  def.onclick = () => { applyTheme('indigo'); refresh(); };
  box.appendChild(def);
  for (const th of THEMES) {
    if (th === 'indigo') continue;                       // indigo is the default — represented by the ⌀ chip above
    const has = owns('theme:' + th), active = th === cur;
    const b = document.createElement('button');
    b.dataset.themeSwatch = th;
    b.className = 'relative w-9 h-9 rounded-full ring-offset-2 ring-offset-slate-900 ' + (active ? 'ring-2 ring-white' : '');
    b.style.background = SWATCH[th];
    if (!has) b.innerHTML = '<span class="absolute inset-0 flex items-center justify-center text-xs">🔒</span>';
    b.onclick = () => {
      if (active) { applyTheme('indigo'); refresh(); return; }   // toggle off → back to default accent
      if (has) { applyTheme(th); refresh(); return; }
      const res = buy('theme:' + th);
      if (res.ok) applyTheme(th);
      refresh();
    };
    box.appendChild(b);
  }
}
const segCls = (on) => 'flex-1 py-2 rounded-lg font-semibold transition ' + (on ? 'bg-indigo-600' : 'bg-slate-800 text-slate-400');
const toggleCls = (on) => 'px-4 py-2 rounded-lg font-semibold transition ' + (on ? 'bg-emerald-600' : 'bg-slate-700 text-slate-400');

export function initPrefs() {
  applyTheme(getTheme());
  applyMode(getMode());

  buildSwatches();

  $('btn-prefs').onclick = openPrefs;
  $('btn-prefs-close').onclick = closePrefs;
  $('btn-prefs-close2').onclick = closePrefs;
  $('prefs-panel').addEventListener('click', (e) => { if (e.target === $('prefs-panel')) closePrefs(); });
  $('btn-lang-en').onclick = () => { applyLang('en'); refresh(); };
  $('btn-lang-ar').onclick = () => { applyLang('ar'); refresh(); };
  $('btn-sound-toggle').onclick = () => { setSound(!soundOn()); refresh(); };
  if ($('pref-volume')) $('pref-volume').oninput = (e) => setVolume((+e.target.value || 0) / 100);
  if ($('btn-music-toggle')) $('btn-music-toggle').onclick = () => { setMusic(!musicOn()); refresh(); };
  if ($('btn-music-pick')) $('btn-music-pick').onclick = openMusicPanel;
  onMusicChange(() => { if (musicPanel) paintMusicPanel(); });
  $('btn-mode-toggle').onclick = () => { applyMode(getMode() === 'light' ? 'dark' : 'light'); refresh(); };
  $('btn-haptics-toggle').onclick = () => { setHaptics(!hapticsOn()); refresh(); };
  $('pref-name').oninput = (e) => setName(e.target.value.slice(0, 16));

  // First-run onboarding (once) — short multi-step tour.
  if (get('arcade:onboarded', '') !== '1') {
    const ob = $('onboarding-panel');
    if (ob) {
      const steps = [
        { emoji: '🎮', title: 'ob_title', body: 'ob_body' },
        { emoji: '🌍', title: 'ob_t2', body: 'ob_b2' },
        { emoji: '🏆', title: 'ob_t3', body: 'ob_b3' },
      ];
      let i = 0;
      const done = () => { ob.classList.add('hidden'); set('arcade:onboarded', '1'); };
      const paint = () => {
        const s = steps[i];
        $('ob-emoji').textContent = s.emoji;
        $('ob-title').textContent = t(s.title);
        $('ob-body').textContent = t(s.body);
        $('btn-onboard-start').textContent = i < steps.length - 1 ? t('ob_next') : t('ob_start');
        const dots = $('ob-dots');
        if (dots) dots.innerHTML = steps.map((_, k) => `<span class="w-2 h-2 rounded-full ${k === i ? 'bg-indigo-400' : 'bg-slate-600'}"></span>`).join('');
      };
      $('btn-onboard-start').onclick = () => { if (i < steps.length - 1) { i++; paint(); } else done(); };
      if ($('btn-onboard-skip')) { $('btn-onboard-skip').textContent = t('ob_skip'); $('btn-onboard-skip').onclick = done; }
      paint();
      ob.classList.remove('hidden');
    }
  }

  onLangChange(refresh);
}

// ---------- music picker panel ----------
let musicPanel = null, musicListEl = null, musicOffEl = null;
const elx = (tag, cls, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };
const escx = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function closeMusicPanel() { if (musicPanel) { musicPanel.remove(); musicPanel = null; musicListEl = null; musicOffEl = null; } }
export function openMusicPanel() {
  if (musicPanel) return;
  const ov = elx('div', 'fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4'); musicPanel = ov;
  const box = elx('div', 'w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl p-4 flex flex-col max-h-[85vh]');
  const head = elx('div', 'flex items-center justify-between mb-3');
  head.append(elx('h3', 'font-bold text-lg', '🎵 ' + t('music_pick')));
  const x = elx('button', 'w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300', '✕'); x.onclick = closeMusicPanel; head.append(x);
  box.append(head);

  const mix = elx('button', 'w-full flex items-center gap-3 rounded-xl p-3 mb-3 transition text-left', ''); mix.dataset.role = 'mix';
  mix.innerHTML = `<span class="text-2xl">🎲</span><span class="flex-1"><span class="block font-bold">${t('music_mix')}</span><span class="block text-[11px] text-slate-400">${t('music_mix_hint')}</span></span>`;
  mix.onclick = () => { playMix(); paintMusicPanel(); };
  box.append(mix);

  box.append(elx('p', 'text-[11px] uppercase tracking-wide text-slate-500 font-semibold mb-1', t('music_tracks')));
  musicListEl = elx('div', 'flex-1 overflow-y-auto space-y-1 -mx-1 px-1');
  box.append(musicListEl);
  musicOffEl = elx('p', 'text-[11px] text-slate-500 text-center pt-2'); box.append(musicOffEl);

  ov.append(box); ov.addEventListener('click', (e) => { if (e.target === ov) closeMusicPanel(); });
  document.body.appendChild(ov);

  getMusicList().then((list) => {
    if (!musicListEl) return;
    musicListEl.innerHTML = '';
    if (!list.length) { musicListEl.appendChild(elx('p', 'text-sm text-slate-500 text-center py-4', t('music_no_files'))); }
    for (const trk of list) {
      const row = elx('button', 'w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-left transition');
      row.dataset.src = trk.src;
      row.innerHTML = `<span class="w-4 shrink-0 text-center" data-ico></span><span class="truncate flex-1">${escx(trk.title || trk.src)}</span>`;
      row.onclick = () => { playTrackNow(trk.src); paintMusicPanel(); };
      musicListEl.appendChild(row);
    }
    paintMusicPanel();
  });
  // ensure the offline download is running and reflect progress
  if (!audioCached()) prefetchAudio((done, total) => { if (musicOffEl) musicOffEl.textContent = t('music_offline_saving', { pct: Math.round((done / total) * 100) }); });
  paintMusicPanel();
}
function paintMusicPanel() {
  if (!musicPanel) return;
  const mode = getMusicMode(), np = nowPlaying();
  const mix = musicPanel.querySelector('[data-role="mix"]');
  if (mix) mix.className = 'w-full flex items-center gap-3 rounded-xl p-3 mb-3 transition text-left ' + (mode === 'mix' ? 'bg-indigo-600/25 ring-1 ring-indigo-500/60' : 'bg-slate-800 hover:bg-slate-700');
  if (musicListEl) for (const row of musicListEl.querySelectorAll('[data-src]')) {
    const playing = np === row.dataset.src;   // picks are one-offs → highlight only what's actually playing
    row.className = 'w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-left transition ' + (playing ? 'bg-indigo-600/25 ring-1 ring-indigo-500/60 text-indigo-100' : 'bg-slate-800/60 hover:bg-slate-700');
    const ico = row.querySelector('[data-ico]'); if (ico) ico.textContent = playing ? '▶' : '';
  }
  if (musicOffEl && audioCached()) musicOffEl.textContent = '✓ ' + t('music_offline_saved');
}
