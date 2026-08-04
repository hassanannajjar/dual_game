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

// ---------- background music: multi-mood generative engine (no files) ----------
// Moods evolve via a chord progression + arpeggiator + pads + bass, through a feedback delay for
// space. In "auto" it crossfades moods every ~45–75s so it never loops obviously.
let mStep = 0, musicBus = null, curMood = 'cinematic', moodUntil = 0, musicMode = 'auto';
try { musicMode = localStorage.getItem('arcade:musicMood') || 'auto'; } catch (e) {}
const semi = (root, n) => root * Math.pow(2, n / 12);
const MOODS = {
  // Interstellar-ish: slow, wide, minor, swelling.
  cinematic: { root: 220, step: 900, chordSteps: 4, arp: 'triangle', pad: 'sine', bass: 'sine', arpG: 0.05, padG: 0.045, bassG: 0.05, rest: 0.15, prog: [[0, 3, 7, 12], [5, 8, 12, 15], [3, 7, 10, 14], [7, 10, 14, 17]] },
  // Minecraft-ish: gentle, sparse, major/lydian, lots of space.
  calm: { root: 261.63, step: 1050, chordSteps: 4, arp: 'sine', pad: 'triangle', bass: 'sine', arpG: 0.05, padG: 0.035, bassG: 0.04, rest: 0.4, prog: [[0, 4, 7, 11], [5, 9, 12, 16], [7, 11, 14, 17], [2, 5, 9, 12]] },
  // Light upbeat pulse.
  arcade: { root: 261.63, step: 320, chordSteps: 8, arp: 'square', pad: 'triangle', bass: 'square', arpG: 0.04, padG: 0.025, bassG: 0.045, rest: 0.1, prog: [[0, 4, 7, 12], [0, 4, 7, 12], [5, 9, 12, 17], [7, 11, 14, 19]] },
};
function ensureMusicBus() {
  const a = ac(); if (!a || !master || musicBus) return;
  musicBus = a.createGain(); musicBus.gain.value = 1; musicBus.connect(master);
  const d = a.createDelay(1.0); d.delayTime.value = 0.3;
  const fb = a.createGain(); fb.gain.value = 0.32;
  const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200;
  musicBus.connect(d); d.connect(lp); lp.connect(fb); fb.connect(d); lp.connect(master);   // feedback delay → space
}
function mvoice(wave, freq, dur, gain, attack) {
  const a = ac(); if (!a || !musicBus) return;
  const t0 = a.currentTime, o = a.createOscillator(), g = a.createGain();
  o.type = wave; o.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + (attack || 0.05));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(musicBus); o.start(t0); o.stop(t0 + dur + 0.05);
}
function musicTick() {
  if (!enabled || !music || !musicBus) { musicTimer = null; return; }
  const now = Date.now();
  if (musicMode === 'auto') { if (now > moodUntil) { const ks = Object.keys(MOODS); let n; do { n = ks[Math.floor(Math.random() * ks.length)]; } while (n === curMood && ks.length > 1); curMood = n; moodUntil = now + 45000 + Math.floor(Math.random() * 30000); } }
  else curMood = musicMode;
  const m = MOODS[curMood] || MOODS.cinematic;
  const chord = m.prog[Math.floor(mStep / m.chordSteps) % m.prog.length];
  if (mStep % m.chordSteps === 0) {                                   // chord change: pad + bass
    const dur = (m.step * m.chordSteps) / 1000;
    for (const n of chord) mvoice(m.pad, semi(m.root, n), dur * 0.95, m.padG, dur * 0.35);
    mvoice(m.bass, semi(m.root, chord[0] - 12), dur * 0.9, m.bassG, 0.05);
  }
  if (Math.random() > m.rest) {                                       // arpeggio note (with rests for space)
    const n = chord[mStep % chord.length] + (Math.random() < 0.3 ? 12 : 0);
    mvoice(m.arp, semi(m.root, n), Math.min(m.step / 1000 * 1.5, 0.7), m.arpG, 0.04);
  }
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
  musicMode = ['auto', 'cinematic', 'calm', 'arcade'].includes(mode) ? mode : 'auto';
  try { localStorage.setItem('arcade:musicMood', musicMode); } catch (e) {}
  if (musicMode !== 'auto') { curMood = musicMode; moodUntil = 0; }
}
