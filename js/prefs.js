// Preferences: display name, theme/accent, haptics + the settings panel.
import { applyLang, getLang, t, onLangChange } from './i18n.js?v=6';
import { setSound, soundOn } from './sound.js?v=6';

const THEMES = ['indigo', 'emerald', 'rose', 'amber'];
const SWATCH = { indigo: '#6366f1', emerald: '#10b981', rose: '#f43f5e', amber: '#f59e0b' };

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
  $('btn-haptics-toggle').textContent = t(hapticsOn() ? 'on' : 'off');
  $('btn-haptics-toggle').className = toggleCls(hapticsOn());
  $('pref-name').value = getName();
  document.querySelectorAll('[data-theme-swatch]').forEach((b) => {
    b.classList.toggle('ring-2', b.dataset.themeSwatch === getTheme());
    b.classList.toggle('ring-white', b.dataset.themeSwatch === getTheme());
  });
}
const segCls = (on) => 'flex-1 py-2 rounded-lg font-semibold transition ' + (on ? 'bg-indigo-600' : 'bg-slate-800 text-slate-400');
const toggleCls = (on) => 'px-4 py-2 rounded-lg font-semibold transition ' + (on ? 'bg-emerald-600' : 'bg-slate-700 text-slate-400');

export function initPrefs() {
  applyTheme(getTheme());

  // theme swatches
  const box = $('theme-swatches');
  box.innerHTML = '';
  for (const th of THEMES) {
    const b = document.createElement('button');
    b.dataset.themeSwatch = th;
    b.className = 'w-9 h-9 rounded-full ring-offset-2 ring-offset-slate-900';
    b.style.background = SWATCH[th];
    b.onclick = () => { applyTheme(th); refresh(); };
    box.appendChild(b);
  }

  $('btn-prefs').onclick = openPrefs;
  $('btn-prefs-close').onclick = closePrefs;
  $('btn-prefs-close2').onclick = closePrefs;
  $('prefs-panel').addEventListener('click', (e) => { if (e.target === $('prefs-panel')) closePrefs(); });
  $('btn-lang-en').onclick = () => { applyLang('en'); refresh(); };
  $('btn-lang-ar').onclick = () => { applyLang('ar'); refresh(); };
  $('btn-sound-toggle').onclick = () => { setSound(!soundOn()); refresh(); };
  $('btn-haptics-toggle').onclick = () => { setHaptics(!hapticsOn()); refresh(); };
  $('pref-name').oninput = (e) => setName(e.target.value.slice(0, 16));

  onLangChange(refresh);
}
