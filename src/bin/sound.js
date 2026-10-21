import { store } from "./store.js";

// Tiny synthesized flicks, no audio files.
const audio = { ctx: null, last: 0, noise: null };

export function ensureAudio() {
  if (audio.ctx) { if (audio.ctx.state === "suspended") audio.ctx.resume(); return; }
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const b = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    audio.ctx = ctx; audio.noise = b;
  } catch (e) { /* no audio available */ }
}

export function sfx(kind) {
  const ctx = audio.ctx; if (!ctx || ctx.state !== "running" || !store.get().sound) return;
  const now = ctx.currentTime;
  if (kind === "flick" && now - audio.last < 0.014) return;
  audio.last = now;
  const src = ctx.createBufferSource(); src.buffer = audio.noise; src.playbackRate.value = 0.8 + Math.random() * 0.5;
  const f = ctx.createBiquadFilter(), gn = ctx.createGain();
  const dur = kind === "flick" ? 0.03 : kind === "slide" ? 0.32 : 0.12;
  f.type = kind === "flick" ? "bandpass" : "lowpass";
  f.frequency.setValueAtTime(kind === "flick" ? 2600 + Math.random() * 1600 : kind === "slide" ? 2400 : 700, now);
  if (kind === "slide") f.frequency.exponentialRampToValueAtTime(900, now + dur);
  f.Q.value = kind === "flick" ? 1.4 : 0.7;
  const peak = kind === "flick" ? 0.07 : kind === "slide" ? 0.05 : 0.12;
  gn.gain.setValueAtTime(0.0001, now); gn.gain.exponentialRampToValueAtTime(peak, now + 0.004);
  gn.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  src.connect(f); f.connect(gn); gn.connect(ctx.destination); src.start(now, Math.random() * 0.3); src.stop(now + dur + 0.02);
}
