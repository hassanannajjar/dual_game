// Synth SFX via Web Audio — no audio files. sound(name). Mute persisted at arcade:sound.

let ctx = null;
let enabled = true;
try { enabled = localStorage.getItem('arcade:sound') !== 'off'; } catch (e) {}

// AudioContext must be created/resumed after a user gesture.
function ac() {
  if (!ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (AC) ctx = new AC(); }
  if (ctx && ctx.state === 'suspended') ctx.resume();
  return ctx;
}
if (typeof window !== 'undefined') {
  const unlock = () => ac();
  window.addEventListener('pointerdown', unlock, { once: false });
}

// A note: type, frequency, duration, gain, and optional linear pitch glide.
function note(type, freq, dur, gain, when, freq2) {
  const a = ac(); if (!a) return;
  const t0 = a.currentTime + (when || 0);
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (freq2) osc.frequency.linearRampToValueAtTime(freq2, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g); g.connect(a.destination);
  osc.start(t0); osc.stop(t0 + dur + 0.02);
}

const SFX = {
  click: () => note('square', 440, 0.05, 0.05),
  place: () => note('sine', 320, 0.09, 0.12, 0, 240),
  drop: () => note('sine', 500, 0.14, 0.12, 0, 160),
  flip: () => { note('triangle', 300, 0.07, 0.1); note('triangle', 460, 0.07, 0.08, 0.05); },
  capture: () => { note('sawtooth', 200, 0.12, 0.1, 0, 120); note('sawtooth', 300, 0.1, 0.08, 0.06); },
  turn: () => note('sine', 660, 0.1, 0.09, 0, 880),
  error: () => note('square', 160, 0.18, 0.09, 0, 120),
  join: () => { note('sine', 523, 0.1, 0.1); note('sine', 784, 0.12, 0.1, 0.1); },
  win: () => { [523, 659, 784, 1047].forEach((f, i) => note('triangle', f, 0.16, 0.12, i * 0.1)); },
  lose: () => { [392, 330, 262].forEach((f, i) => note('sawtooth', f, 0.2, 0.1, i * 0.12)); },
  draw: () => { note('triangle', 440, 0.15, 0.1); note('triangle', 440, 0.15, 0.1, 0.18); },
};

export function sound(name) { if (enabled && SFX[name]) SFX[name](); }
export function setSound(on) {
  enabled = !!on;
  try { localStorage.setItem('arcade:sound', enabled ? 'on' : 'off'); } catch (e) {}
  if (enabled) sound('click');
}
export function soundOn() { return enabled; }
