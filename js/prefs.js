// Preferences: display name, theme/accent, haptics + the settings panel.
import { applyLang, getLang, t, onLangChange } from './i18n.js?v=41';
import { setSound, soundOn, setVolume, getVolume, setMusic, musicOn, setMusicMode, getMusicMode } from './sound.js?v=41';
import { owns, buy } from './loyalty.js?v=41';

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
  if ($('pref-music-mood')) { $('pref-music-mood').value = getMusicMode(); $('pref-music-mood').disabled = !musicOn(); }
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
  if ($('pref-music-mood')) $('pref-music-mood').onchange = (e) => setMusicMode(e.target.value);
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
