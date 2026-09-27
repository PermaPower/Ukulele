// Audio engine: shared AudioContext, a plucked-string ukulele synth,
// metronome clicks, a look-ahead event scheduler and microphone input.
import { CHORDS, STRINGS } from './data.js';

let ctx = null;
let master = null;

export function getCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC({ latencyHint: 'interactive' });
    master = ctx.createGain();
    master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.ratio.value = 4;
    master.connect(comp).connect(ctx.destination);
  }
  return ctx;
}

// Must be called from a user gesture on iOS.
export async function unlockAudio() {
  const c = getCtx();
  if (c.state !== 'running') await c.resume();
  return c;
}

export function now() {
  return getCtx().currentTime;
}

// ---------- Plucked string synth (Karplus-Strong) ----------

const bufferCache = new Map();

function pluckBuffer(freq) {
  const key = Math.round(freq * 10);
  if (bufferCache.has(key)) return bufferCache.get(key);
  const c = getCtx();
  const sr = c.sampleRate;
  const len = Math.floor(sr * 2.2);
  const buf = c.createBuffer(1, len, sr);
  const out = buf.getChannelData(0);
  // The averaging filter adds half a sample of delay, so compensate.
  const N = Math.max(2, Math.round(sr / freq - 0.5));
  const ring = new Float32Array(N);
  // Soft, nylon-like excitation: smoothed noise.
  let prev = 0;
  for (let i = 0; i < N; i++) {
    const r = Math.random() * 2 - 1;
    prev = prev * 0.5 + r * 0.5;
    ring[i] = prev;
  }
  let idx = 0;
  let peak = 0;
  const decay = 0.9965;
  for (let i = 0; i < len; i++) {
    const next = idx + 1 === N ? 0 : idx + 1;
    const v = ring[idx];
    out[i] = v;
    if (Math.abs(v) > peak) peak = Math.abs(v);
    ring[idx] = decay * 0.5 * (v + ring[next]);
    idx = next;
  }
  const norm = peak > 0 ? 0.5 / peak : 1;
  for (let i = 0; i < len; i++) out[i] *= norm;
  bufferCache.set(key, buf);
  return buf;
}

// One ringing voice per string so a new strum damps the previous one.
const stringVoices = [null, null, null, null];

function dampString(i, when) {
  const v = stringVoices[i];
  if (!v) return;
  try {
    v.gain.gain.cancelScheduledValues(when);
    v.gain.gain.setTargetAtTime(0, when, 0.015);
    v.src.stop(when + 0.2);
  } catch (e) { /* already stopped */ }
  stringVoices[i] = null;
}

export function playNote(freq, when, vol = 0.6, stringIndex = -1) {
  const c = getCtx();
  const t = Math.max(when, c.currentTime);
  if (stringIndex >= 0) dampString(stringIndex, t);
  const src = c.createBufferSource();
  src.buffer = pluckBuffer(freq);
  const gain = c.createGain();
  gain.gain.value = vol;
  const tone = c.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = 3200;
  src.connect(tone).connect(gain).connect(master);
  src.start(t);
  if (stringIndex >= 0) stringVoices[stringIndex] = { src, gain };
  return src;
}

// dir: 'D' (G->A), 'U' (A->G, lighter, mostly top strings), 'X' (chuck)
export function strum(chordName, when, dir = 'D', vol = 0.5) {
  const c = getCtx();
  const t = Math.max(when, c.currentTime);
  if (dir === 'X') {
    chuck(t, vol);
    return;
  }
  const chord = CHORDS[chordName];
  if (!chord) return;
  const order = dir === 'U' ? [3, 2, 1, 0] : [0, 1, 2, 3];
  const gap = dir === 'U' ? 0.012 : 0.016;
  order.forEach((s, k) => {
    // Up strums catch the lower strings less.
    const v = dir === 'U' ? vol * (k < 2 ? 0.75 : 0.35) : vol;
    playNote(chord.notes[s].freq, t + k * gap, v, s);
  });
}

let noiseBuf = null;
function getNoise() {
  if (noiseBuf) return noiseBuf;
  const c = getCtx();
  noiseBuf = c.createBuffer(1, Math.floor(c.sampleRate * 0.1), c.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return noiseBuf;
}

export function chuck(when, vol = 0.5) {
  const c = getCtx();
  for (let i = 0; i < 4; i++) dampString(i, when);
  const src = c.createBufferSource();
  src.buffer = getNoise();
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 1400;
  bp.Q.value = 0.8;
  const g = c.createGain();
  g.gain.setValueAtTime(0, when);
  g.gain.linearRampToValueAtTime(vol * 1.4, when + 0.003);
  g.gain.exponentialRampToValueAtTime(0.001, when + 0.06);
  src.connect(bp).connect(g).connect(master);
  src.start(when);
  src.stop(when + 0.1);
}

export function click(when, accent = false, vol = 0.35) {
  const c = getCtx();
  const osc = c.createOscillator();
  osc.frequency.value = accent ? 1760 : 1320;
  const g = c.createGain();
  g.gain.setValueAtTime(0, when);
  g.gain.linearRampToValueAtTime(vol, when + 0.002);
  g.gain.exponentialRampToValueAtTime(0.001, when + 0.05);
  osc.connect(g).connect(master);
  osc.start(when);
  osc.stop(when + 0.06);
}

export function playArpeggio(chordName, when) {
  const chord = CHORDS[chordName];
  chord.notes.forEach((n, i) => playNote(n.freq, when + i * 0.45, 0.6, i));
}

export function playReference(stringIndex) {
  const c = getCtx();
  playNote(STRINGS[stringIndex].freq, c.currentTime + 0.02, 0.7, stringIndex);
}

// ---------- Scheduler ----------
// source.eventsBetween(t0, t1) returns events with a time `t` in [t0, t1).
export class Scheduler {
  constructor(source, onEvent) {
    this.source = source;
    this.onEvent = onEvent;
    this.timer = null;
  }
  start(from) {
    this.cursor = from ?? getCtx().currentTime;
    this.tick();
    this.timer = setInterval(() => this.tick(), 25);
  }
  tick() {
    const until = getCtx().currentTime + 0.15;
    if (until <= this.cursor) return;
    for (const e of this.source.eventsBetween(this.cursor, until)) this.onEvent(e);
    this.cursor = until;
  }
  stop() {
    clearInterval(this.timer);
    this.timer = null;
  }
}

// ---------- Microphone ----------

let mic = null;

export async function openMic() {
  const c = await unlockAudio();
  if (mic) return mic;
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('This browser can\'t use the microphone. Open the app over https in Safari or Chrome.');
  }
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
  });
  const src = c.createMediaStreamSource(stream);
  const analyser = c.createAnalyser();
  analyser.fftSize = 8192;
  analyser.smoothingTimeConstant = 0;
  src.connect(analyser);
  // Keep the graph pulled on browsers that skip unconnected nodes.
  const sink = c.createGain();
  sink.gain.value = 0;
  analyser.connect(sink).connect(c.destination);
  mic = {
    stream, src, analyser,
    time: new Float32Array(analyser.fftSize),
    freqDb: new Float32Array(analyser.frequencyBinCount),
  };
  return mic;
}

export function closeMic() {
  if (!mic) return;
  mic.stream.getTracks().forEach((t) => t.stop());
  try { mic.src.disconnect(); } catch (e) { /* ignore */ }
  mic = null;
}

// Round-trip latency estimate (speaker -> mic). Refined by calibration.
export function defaultLatency() {
  const c = getCtx();
  const out = (c.outputLatency || 0) + (c.baseLatency || 0);
  return Math.min(0.15, out + 0.02);
}
