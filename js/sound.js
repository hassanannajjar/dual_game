// Synth SFX + background music from the user's MP3 library (audio/tracks.json), played
// Minecraft-style (shuffle with silence gaps) and cached offline.
// sound(name). Mute at arcade:sound, volume at arcade:vol, music at arcade:music, pick at arcade:musicMood.

let ctx = null, master = null;
let enabled = true, music = true, vol = 0.8;   // music defaults ON; a stored pref overrides
try { enabled = localStorage.getItem('arcade:sound') !== 'off'; } catch (e) {}
try { const v = parseFloat(localStorage.getItem('arcade:vol')); if (!isNaN(v)) vol = Math.min(1, Math.max(0, v)); } catch (e) {}
try { const m = localStorage.getItem('arcade:music'); if (m) music = m === 'on'; } catch (e) {}

// AudioContext + master bus must be created/resumed after a user gesture.
function ac() {
  if (!ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (AC) ctx = new AC(); }
  if (ctx && !master) { master = ctx.createGain(); master.gain.value = vol; master.connect(ctx.destination); }
  if (ctx && ctx.state === 'suspended') ctx.resume();
  return ctx;
}
if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', () => { ac(); if (music && enabled) startMusic(); }, { once: false });
}

// A pitched voice with an exponential attack/decay envelope, routed through the master bus.
function voice(type, f0, f1, dur, gain, when, attack) {
  const a = ac(); if (!a || !master) return;
  const t0 = a.currentTime + (when || 0);
  const o = a.createOscillator(), g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t0);
  if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + (attack || 0.008));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(master);
  o.start(t0); o.stop(t0 + dur + 0.02);
}
// A short filtered noise burst — for punchy impacts (place/drop/capture/hit).
function noise(dur, gain, when, filterFreq) {
  const a = ac(); if (!a || !master) return;
  const t0 = a.currentTime + (when || 0);
  const n = Math.max(1, Math.floor(a.sampleRate * dur));
  const buf = a.createBuffer(1, n, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  const src = a.createBufferSource(); src.buffer = buf;
  const g = a.createGain(); g.gain.setValueAtTime(gain, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  if (filterFreq) { const f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filterFreq; src.connect(f); f.connect(g); }
  else src.connect(g);
  g.connect(master); src.start(t0); src.stop(t0 + dur + 0.02);
}
const seq = (freqs, type, dur, gain, step) => freqs.forEach((f, i) => voice(type, f, f, dur, gain, i * step));

const SFX = {
  click: () => voice('triangle', 520, 660, 0.05, 0.06),
  select: () => voice('square', 720, 900, 0.04, 0.05),
  navigate: () => voice('sine', 420, 620, 0.08, 0.06),
  place: () => { voice('sine', 340, 220, 0.09, 0.13); noise(0.05, 0.05, 0, 2400); },
  drop: () => { voice('sine', 520, 150, 0.16, 0.12); noise(0.06, 0.06, 0.02, 1500); },
  flip: () => { voice('triangle', 300, 300, 0.06, 0.09); voice('triangle', 470, 470, 0.07, 0.08, 0.05); },
  capture: () => { noise(0.14, 0.11, 0, 900); voice('sawtooth', 180, 90, 0.14, 0.09); },
  hit: () => { noise(0.05, 0.14, 0, 3200); voice('square', 200, 120, 0.05, 0.06); },
  turn: () => voice('sine', 620, 880, 0.1, 0.09),
  error: () => voice('square', 180, 110, 0.18, 0.09),
  invalid: () => { voice('square', 150, 150, 0.11, 0.08); voice('square', 120, 120, 0.11, 0.07, 0.06); },
  tick: () => voice('sine', 900, 900, 0.03, 0.05),
  join: () => seq([523, 784], 'sine', 0.12, 0.1, 0.1),
  win: () => { seq([523, 659, 784, 1047], 'triangle', 0.18, 0.12, 0.09); voice('sine', 1047, 1568, 0.4, 0.07, 0.4); },
  lose: () => seq([440, 349, 262], 'sawtooth', 0.24, 0.09, 0.13),
  draw: () => { voice('triangle', 440, 440, 0.16, 0.09); voice('triangle', 440, 440, 0.16, 0.09, 0.18); },
  chat: () => voice('sine', 700, 920, 0.06, 0.06),
  react: () => voice('triangle', 620, 980, 0.09, 0.08),
  badge: () => seq([659, 880, 1319], 'triangle', 0.14, 0.1, 0.08),
  coin: () => { voice('square', 988, 988, 0.05, 0.08); voice('square', 1319, 1319, 0.09, 0.08, 0.05); },
  chest: () => { seq([523, 659, 784, 1047, 1319], 'triangle', 0.16, 0.1, 0.07); noise(0.2, 0.04, 0, 3000); },
  quest: () => seq([784, 1047, 1319], 'sine', 0.14, 0.09, 0.08),
  levelup: () => seq([523, 659, 784, 1047, 1319, 1568], 'triangle', 0.16, 0.11, 0.07),
  toggle: () => voice('square', 600, 600, 0.05, 0.06),
};

export function sound(name) { if (enabled && SFX[name]) SFX[name](); }

// ---------- volume ----------
export function getVolume() { return vol; }
export function setVolume(v) {
  vol = Math.min(1, Math.max(0, v));
  try { localStorage.setItem('arcade:vol', String(vol)); } catch (e) {}
  if (master) master.gain.value = vol;
}

// ---------- mute ----------
export function setSound(on) {
  enabled = !!on;
  try { localStorage.setItem('arcade:sound', enabled ? 'on' : 'off'); } catch (e) {}
  if (enabled) { sound('toggle'); if (music) startMusic(); } else stopMusic();
}
export function soundOn() { return enabled; }

// ---------- background music: the user's MP3 library, Minecraft-style ----------
// One <audio> element → master bus. Shuffle the library, play a track, then a randomized silence
// GAP, then the next random track (reshuffle each cycle) — like Minecraft. Or play one chosen track
// on repeat. Playlist comes from audio/tracks.json. Files auto-cache offline (see prefetchAudio).
let scene = 'menu', musicNotify = null, changeNotify = null;
let mode = 'mix';   // 'mix' = shuffle+gaps, or a track src for a single pick
try {
  const saved = localStorage.getItem('arcade:musicMood');
  mode = (saved && !['auto', 'tracks', 'interstellar', 'odyssey', 'cinematic', 'calm', 'arcade'].includes(saved)) ? saved : 'mix';
} catch (e) {}

let trackList = [], tracksLoaded = false;
let player = null;                 // { el, g }
let order = [], pos = 0, curSrc = null;
let gapTimer = null, running = false;

export function setMusicNotify(fn) { musicNotify = fn; }   // called when music on but no playable files
export function onMusicChange(fn) { changeNotify = fn; }   // panel highlight refresh on track/mode change
function announce() { if (changeNotify) try { changeNotify(); } catch (e) {} }
function trackVol() { return scene === 'match' ? 1.0 : 0.72; }   // duck a touch on the menu
function shuf(arr) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function gapMs() {   // silence between tracks — arcade-short; tighter during a match
  return scene === 'match' ? 10000 + Math.random() * 30000 : 20000 + Math.random() * 70000;
}

async function loadTracks() {
  if (tracksLoaded) return trackList;
  try {
    const res = await fetch('audio/tracks.json', { cache: 'no-store' });
    if (res.ok) { const j = await res.json(); if (Array.isArray(j)) { trackList = j.filter((x) => x && x.src); tracksLoaded = true; } }
  } catch (e) { /* offline before first load — try again next time */ }
  return trackList;
}
function ensurePlayer() {
  const a = ac(); if (!a || !master || player) return;
  const el = new Audio(); el.crossOrigin = 'anonymous'; el.preload = 'auto';
  const g = a.createGain(); g.gain.value = 0.0001;
  a.createMediaElementSource(el).connect(g); g.connect(master);
  player = { el, g };
}
function fadeTo(v, secs) { const a = ac(); if (!a || !player) return; player.g.gain.cancelScheduledValues(a.currentTime); player.g.gain.setValueAtTime(Math.max(0.0001, player.g.gain.value), a.currentTime); player.g.gain.linearRampToValueAtTime(Math.max(0.0001, v), a.currentTime + secs); }

// pick the src for the current position (mix) or the chosen single track
function currentSrc() {
  if (mode !== 'mix') return mode;
  if (!order.length) return null;
  return trackList[order[pos]] && trackList[order[pos]].src;
}
function advance() {   // move to next in the shuffled order; reshuffle at cycle end (mix only)
  if (mode !== 'mix') return;
  pos++;
  if (pos >= order.length) { order = shuf(trackList.map((_, i) => i)); pos = 0; }
}
function playCurrent() {
  ensurePlayer(); if (!player) return;
  const src = currentSrc(); if (!src) { if (musicNotify) musicNotify(); return; }
  curSrc = src;
  try { player.el.src = src; player.el.currentTime = 0; const p = player.el.play(); if (p) p.catch(() => {}); } catch (e) { scheduleNext(); return; }
  fadeTo(trackVol(), 2.5);
  announce();
}
function onTrackDone() {   // fade out already done by natural end; wait a gap, then next
  if (!running || !music || !enabled) return;
  advance();
  scheduleNext();
}
function scheduleNext() {
  clearTimeout(gapTimer);
  gapTimer = setTimeout(() => { if (running && music && enabled) playCurrent(); }, gapMs());
}
function bindEl() {
  if (!player) return;
  player.el.onended = () => { player._done = false; onTrackDone(); };
  player.el.ontimeupdate = () => {   // start fading out ~4s before the end for a smooth tail into the gap
    const el = player.el;
    if (el.duration && el.currentTime > el.duration - 4 && !player._done) { player._done = true; fadeTo(0.0001, 3.5); }
  };
  player.el.onerror = () => { onTrackDone(); };   // bad/unreachable file → skip to next after a gap
}

export function startMusic() {
  if (!enabled || !music || running) return;
  ac(); ensurePlayer(); bindEl();
  running = true;
  loadTracks().then((list) => {
    if (!running) return;
    if (!list.length) { running = false; if (musicNotify) musicNotify(); return; }
    if (mode === 'mix') { order = shuf(list.map((_, i) => i)); pos = 0; }
    playCurrent();
    prefetchAudio();   // fill the offline cache in the background
  });
}
export function stopMusic() {
  running = false; clearTimeout(gapTimer); gapTimer = null;
  if (player) { player.el.onended = player.el.ontimeupdate = player.el.onerror = null; player._done = false; try { player.el.pause(); } catch (e) {} const a = ac(); if (a) { player.g.gain.cancelScheduledValues(a.currentTime); player.g.gain.value = 0.0001; } }
  curSrc = null; announce();
}
export function setMusic(on) {
  music = !!on;
  try { localStorage.setItem('arcade:music', music ? 'on' : 'off'); } catch (e) {}
  if (music && enabled) startMusic(); else stopMusic();
}
export function musicOn() { return music; }
export function getMusicMode() { return mode; }
export function nowPlaying() { return running ? curSrc : null; }
export async function getMusicList() { return loadTracks(); }
export function setMusicMode(m) {
  mode = m || 'mix';
  try { localStorage.setItem('arcade:musicMood', mode); } catch (e) {}
  if (music && enabled) { const wasRun = running; stopMusic(); if (wasRun || true) startMusic(); } else announce();
}
export function playMix() { setMusicMode('mix'); }
export function playTrackNow(src) { if (src) setMusicMode(src); }
// Adaptive scene: 'menu' ducks a touch, 'match' full. Only re-levels the currently playing track.
export function setMusicScene(s) {
  scene = s === 'match' ? 'match' : 'menu';
  if (running && player && !player._done) fadeTo(trackVol(), 2.0);
}
// One-shot warm swell (e.g. on a win): a brief volume lift on the current track.
export function musicSwell() {
  if (!enabled || !music || !running || !player || player._done) return;
  const a = ac(); if (!a) return;
  player.g.gain.cancelScheduledValues(a.currentTime);
  player.g.gain.setValueAtTime(player.g.gain.value, a.currentTime);
  player.g.gain.linearRampToValueAtTime(Math.min(1, trackVol() * 1.3), a.currentTime + 0.4);
  player.g.gain.linearRampToValueAtTime(trackVol(), a.currentTime + 2.4);
}

// ---------- offline: auto-download the whole library into a persistent Cache bucket ----------
// Separate from the versioned app-shell cache so version bumps don't wipe it. Sequential full GETs
// (200s) so the service worker can serve them offline. Safe to call repeatedly; skips cached files.
const AUDIO_CACHE = 'arcade-audio';
let prefetching = false;
export async function prefetchAudio(onProgress) {
  if (prefetching) return;
  if (typeof caches === 'undefined' || (typeof navigator !== 'undefined' && navigator.onLine === false)) return;
  prefetching = true;
  try {
    const list = await loadTracks();
    if (!list.length) { prefetching = false; return; }
    const cache = await caches.open(AUDIO_CACHE);
    let done = 0;
    for (const trk of list) {
      try {
        const hit = await cache.match(trk.src);
        if (!hit) { const res = await fetch(trk.src, { cache: 'no-store' }); if (res && res.ok) await cache.put(trk.src, res.clone()); }
      } catch (e) { /* skip this file, keep going */ }
      done++;
      if (onProgress) try { onProgress(done, list.length); } catch (e) {}
    }
    if (done >= list.length) { try { localStorage.setItem('arcade:audioCached', '1'); } catch (e) {} }
  } catch (e) {}
  prefetching = false;
}
export function audioCached() { try { return localStorage.getItem('arcade:audioCached') === '1'; } catch (e) { return false; } }
if (typeof window !== 'undefined') window.addEventListener('online', () => { if (!audioCached()) prefetchAudio(); });
