// Synth SFX + optional music via Web Audio — no audio files (keeps the PWA tiny & offline).
// sound(name). Mute at arcade:sound, volume at arcade:vol, music at arcade:music.

let ctx = null, master = null, musicTimer = null, mi = 0;
let enabled = true, music = false, vol = 0.8;
try { enabled = localStorage.getItem('arcade:sound') !== 'off'; } catch (e) {}
try { const v = parseFloat(localStorage.getItem('arcade:vol')); if (!isNaN(v)) vol = Math.min(1, Math.max(0, v)); } catch (e) {}
try { music = localStorage.getItem('arcade:music') === 'on'; } catch (e) {}

// AudioContext + master bus must be created/resumed after a user gesture.
function ac() {
  if (!ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (AC) ctx = new AC(); }
  if (ctx && !master) { master = ctx.createGain(); master.gain.value = vol; master.connect(ctx.destination); }
  if (ctx && ctx.state === 'suspended') ctx.resume();
  return ctx;
}
if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', () => { ac(); if (music && enabled && !musicTimer) startMusic(); }, { once: false });
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

// ---------- background music: adaptive layered generative engine (no files) ----------
// Original ambient music evoking cinematic-space scores. Each mood = chord progression + a set of
// layers (organ/choir pad, bass, arpeggio, ticking ostinato, high shimmer), each on its own gain
// node so layers slowly fade in/out. The mix "breathes" (occasional near-silence) and, in "auto",
// crossfades moods. A scene (menu vs match) biases which moods/layers are active.
let mStep = 0, musicBus = null, mixGain = null, layerGains = null, curMood = 'interstellar';
let moodUntil = 0, musicMode = 'auto', scene = 'menu', breatheUntil = 0;
try { musicMode = localStorage.getItem('arcade:musicMood') || 'auto'; } catch (e) {}
const semi = (root, n) => root * Math.pow(2, n / 12);
const LAYERS = ['pad', 'bass', 'arp', 'tick', 'shimmer'];
const MOODS = {
  // Epic minor, wide and slow: organ pad + steady ticking ostinato + swelling arpeggio.
  interstellar: { root: 196, step: 950, chordSteps: 4, padG: 0.05, bassWave: 'sine', bassG: 0.06, arpWave: 'triangle', arpG: 0.045, rest: 0.35, organ: true, tick: true, tickG: 0.028, tickDiv: 1, shimmer: true, shimmerG: 0.03, prog: [[0, 3, 7, 10], [-2, 3, 7, 10], [-4, 0, 3, 7], [-5, 2, 7, 10]] },
  // Ethereal space-awe: sustained detuned choral drones, very sparse, grand open harmony.
  odyssey: { root: 174.61, step: 1400, chordSteps: 2, padG: 0.055, bassWave: 'sine', bassG: 0.045, arpWave: 'sine', arpG: 0.03, rest: 0.7, choir: true, shimmer: true, shimmerG: 0.035, prog: [[0, 4, 7, 11], [2, 7, 11, 14], [0, 5, 9, 12], [-3, 4, 9, 12]] },
  // Original three (kept): swelling / gentle / upbeat.
  cinematic: { root: 220, step: 900, chordSteps: 4, padWave: 'sine', padG: 0.045, bassWave: 'sine', bassG: 0.05, arpWave: 'triangle', arpG: 0.05, rest: 0.15, prog: [[0, 3, 7, 12], [5, 8, 12, 15], [3, 7, 10, 14], [7, 10, 14, 17]] },
  calm: { root: 261.63, step: 1050, chordSteps: 4, padWave: 'triangle', padG: 0.035, bassWave: 'sine', bassG: 0.04, arpWave: 'sine', arpG: 0.05, rest: 0.4, prog: [[0, 4, 7, 11], [5, 9, 12, 16], [7, 11, 14, 17], [2, 5, 9, 12]] },
  arcade: { root: 261.63, step: 320, chordSteps: 8, padWave: 'triangle', padG: 0.025, bassWave: 'square', bassG: 0.045, arpWave: 'square', arpG: 0.04, rest: 0.1, prog: [[0, 4, 7, 12], [0, 4, 7, 12], [5, 9, 12, 17], [7, 11, 14, 19]] },
};
// Per-scene layer intensity targets (0..1 multipliers on each layer's gain).
const SCENE_LAYERS = {
  menu: { pad: 1.0, bass: 0.65, arp: 0.35, tick: 0.0, shimmer: 0.6 },
  match: { pad: 1.0, bass: 1.0, arp: 0.9, tick: 0.9, shimmer: 0.85 },
};
const AUTO_POOL = { menu: ['odyssey', 'calm', 'interstellar'], match: ['interstellar', 'arcade', 'cinematic'] };

function ensureMusicBus() {
  const a = ac(); if (!a || !master || musicBus) return;
  musicBus = a.createGain(); musicBus.gain.value = 1; musicBus.connect(master);
  const d = a.createDelay(1.0); d.delayTime.value = 0.34;
  const fb = a.createGain(); fb.gain.value = 0.34;
  const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200;
  musicBus.connect(d); d.connect(lp); lp.connect(fb); fb.connect(d); lp.connect(master);   // feedback delay → space
  mixGain = a.createGain(); mixGain.gain.value = 1; mixGain.connect(musicBus);              // breathing / crossfade
  layerGains = {};
  for (const k of LAYERS) { const g = a.createGain(); g.gain.value = (k === 'pad' || k === 'bass') ? 1 : 0.3; g.connect(mixGain); layerGains[k] = g; }
}
function layerNode(layer) { return (layerGains && layerGains[layer]) || mixGain || musicBus; }
function osc(wave, freq, dur, gain, attack, dest, detune) {
  const a = ac(); if (!a || !dest) return;
  const t0 = a.currentTime, o = a.createOscillator(), g = a.createGain();
  o.type = wave; o.frequency.setValueAtTime(freq, t0); if (detune) o.detune.setValueAtTime(detune, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + (attack || 0.05));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(dest); o.start(t0); o.stop(t0 + dur + 0.05);
}
function mvoice(layer, wave, freq, dur, gain, attack) { osc(wave, freq, dur, gain, attack, layerNode(layer), 0); }
function organVoice(layer, freq, dur, gain, attack) {   // additive: fundamental + octave + fifth-octave
  const dest = layerNode(layer);
  osc('sine', freq, dur, gain, attack, dest, -4);
  osc('sine', freq * 2, dur * 0.9, gain * 0.5, attack, dest, 0);
  osc('triangle', freq * 3, dur * 0.7, gain * 0.28, attack, dest, 6);
}
function choirVoice(layer, freq, dur, gain, attack) {   // detuned cluster, slow swell
  const dest = layerNode(layer);
  osc('sine', freq, dur, gain, attack, dest, -6);
  osc('sine', freq, dur, gain * 0.8, attack, dest, 7);
  osc('triangle', freq * 2, dur * 0.8, gain * 0.22, attack * 1.2, dest, 0);
}
function updateLayers() {                                // slowly drift layer gains toward scene targets
  if (!layerGains) return;
  const a = ac(); const base = SCENE_LAYERS[scene] || SCENE_LAYERS.menu;
  const evo = 0.55 + 0.45 * Math.sin(mStep * 0.025);     // slow LFOs so parts breathe in/out
  const evo2 = 0.55 + 0.45 * Math.sin(mStep * 0.017 + 1.5);
  const target = { pad: base.pad, bass: base.bass, arp: base.arp * evo, tick: base.tick, shimmer: base.shimmer * evo2 };
  for (const k of LAYERS) layerGains[k].gain.setTargetAtTime(target[k], a.currentTime, 4.0);
}
function maybeBreathe(now) {                              // occasional near-silence between "pieces"
  if (!mixGain || now < breatheUntil) return;
  if (Math.random() < 0.012) {
    const a = ac(); const dip = 3 + Math.random() * 3;
    mixGain.gain.cancelScheduledValues(a.currentTime);
    mixGain.gain.setTargetAtTime(0.06, a.currentTime, 1.2);
    mixGain.gain.setTargetAtTime(1.0, a.currentTime + dip, 2.0);
    breatheUntil = now + (dip + 9) * 1000;
  }
}
function pickNextMood() {                                 // masked mood swap via a mixGain dip
  const pool = AUTO_POOL[scene] || AUTO_POOL.menu;
  let n; do { n = pool[Math.floor(Math.random() * pool.length)]; } while (n === curMood && pool.length > 1);
  if (mixGain) { const a = ac(); mixGain.gain.cancelScheduledValues(a.currentTime); mixGain.gain.setTargetAtTime(0.05, a.currentTime, 1.0); mixGain.gain.setTargetAtTime(1.0, a.currentTime + 2.2, 1.5); }
  setTimeout(() => { curMood = n; mStep = 0; }, 1500);
}
function musicTick() {
  if (!enabled || !music || !musicBus) { musicTimer = null; return; }
  const now = Date.now();
  if (musicMode === 'auto') { if (now > moodUntil) { pickNextMood(); moodUntil = now + 40000 + Math.floor(Math.random() * 30000); } }
  else curMood = musicMode;
  const m = MOODS[curMood] || MOODS.interstellar;
  const chord = m.prog[Math.floor(mStep / m.chordSteps) % m.prog.length];
  if (mStep % m.chordSteps === 0) {                                   // chord change: pad + bass
    const dur = (m.step * m.chordSteps) / 1000;
    for (const n of chord) {
      if (m.organ) organVoice('pad', semi(m.root, n), dur * 0.98, m.padG, dur * 0.3);
      else if (m.choir) choirVoice('pad', semi(m.root, n), dur * 1.1, m.padG, dur * 0.5);
      else mvoice('pad', m.padWave, semi(m.root, n), dur * 0.95, m.padG, dur * 0.35);
    }
    mvoice('bass', m.bassWave, semi(m.root, chord[0] - 12), dur * 0.9, m.bassG, 0.05);
  }
  const rest = scene === 'menu' ? Math.min(0.95, m.rest + 0.25) : m.rest;
  if (m.arpG && Math.random() > rest) {                               // arpeggio note (with rests for space)
    const n = chord[mStep % chord.length] + (Math.random() < 0.3 ? 12 : 0);
    mvoice('arp', m.arpWave, semi(m.root, n), Math.min(m.step / 1000 * 1.5, 0.8), m.arpG, 0.04);
  }
  if (m.tick && mStep % (m.tickDiv || 1) === 0) mvoice('tick', 'sine', 1760, 0.03, m.tickG, 0.002);   // ticking clock
  if (m.shimmer && Math.random() < 0.12) mvoice('shimmer', 'triangle', semi(m.root, chord[Math.floor(Math.random() * chord.length)] + 24), 0.6, m.shimmerG, 0.12);
  maybeBreathe(now);
  updateLayers();
  mStep++;
  musicTimer = setTimeout(musicTick, m.step);
}
export function startMusic() { if (!enabled) return; ac(); ensureMusicBus(); if (musicTimer) return; musicTick(); }
export function stopMusic() { clearTimeout(musicTimer); musicTimer = null; }
export function setMusic(on) {
  music = !!on;
  try { localStorage.setItem('arcade:music', music ? 'on' : 'off'); } catch (e) {}
  if (music && enabled) startMusic(); else stopMusic();
}
export function musicOn() { return music; }
export function getMusicMode() { return musicMode; }
export function setMusicMode(mode) {
  musicMode = ['auto', 'interstellar', 'odyssey', 'cinematic', 'calm', 'arcade'].includes(mode) ? mode : 'auto';
  try { localStorage.setItem('arcade:musicMood', musicMode); } catch (e) {}
  if (musicMode !== 'auto') { curMood = musicMode; moodUntil = 0; mStep = 0; }
}
// Adaptive scene: 'menu' = sparse/calm, 'match' = fuller/tenser. Biases mood pool + layer intensity.
export function setMusicScene(s) {
  scene = s === 'match' ? 'match' : 'menu';
  if (musicMode === 'auto') moodUntil = 0;   // re-pick a mood suited to the new scene on the next tick
}
// One-shot warm swell (e.g. on a win): brief lift + a rising shimmer chord.
export function musicSwell() {
  if (!enabled || !music || !musicBus) return;
  const a = ac(); const m = MOODS[curMood] || MOODS.interstellar;
  for (const n of [0, 4, 7, 12]) choirVoice('shimmer', semi(m.root, n + 12), 2.4, 0.045, 0.35);
  if (mixGain) { mixGain.gain.cancelScheduledValues(a.currentTime); mixGain.gain.setTargetAtTime(1.25, a.currentTime, 0.3); mixGain.gain.setTargetAtTime(1.0, a.currentTime + 2.0, 1.2); }
}
