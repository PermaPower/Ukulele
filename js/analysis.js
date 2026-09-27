// Listening and coaching: onset detection, pitch detection, chord recognition
// and the heuristics that turn measurements into friendly feedback.
import { CHORDS, noteName } from './data.js';
import { getCtx, getMicSensitivity } from './audio.js';

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));

// ---------- Live listener ----------
// Polls the mic analyser, reports strum onsets and spectrum frames.
export class Listener {
  constructor(mic, { latency = 0, onOnset, onSpectrum, spectrumEvery = 0.04 } = {}) {
    this.mic = mic;
    this.latency = latency;
    this.onOnset = onOnset;
    this.onSpectrum = onSpectrum;
    this.spectrumEvery = spectrumEvery;
    this.onsets = [];
    this.envelope = []; // [t, rms] every block
    this.floor = 0.004;
    this.recent = [];
    this.hist = [];
    this.sinceFloor = 0;
    this.lastOnset = -1;
    this.pending = null;
    this.block = 256;
  }

  start() {
    const c = getCtx();
    this.sr = c.sampleRate;
    this.lastSample = Math.round(c.currentTime * this.sr);
    this.lastSpec = 0;
    this.timer = setInterval(() => this.poll(), 10);
  }

  stop() {
    clearInterval(this.timer);
    this.timer = null;
  }

  poll() {
    const c = getCtx();
    const { analyser, time } = this.mic;
    analyser.getFloatTimeDomainData(time);
    const N = time.length;
    const nowSample = Math.round(c.currentTime * this.sr);
    let from = this.lastSample;
    if (nowSample - from > N - this.block) from = nowSample - (N - this.block);
    const B = this.block;
    // Process whole blocks of new samples.
    while (from + B <= nowSample) {
      const start = N - (nowSample - from);
      let sum = 0;
      let hsum = 0;
      for (let i = start; i < start + B; i++) {
        sum += time[i] * time[i];
        // First difference emphasises the bright attack of a strum over ringing notes.
        const d = time[i] - time[i - 1];
        hsum += d * d;
      }
      this.processBlock(Math.sqrt(sum / B), Math.sqrt(hsum / B), from / this.sr, start);
      from += B;
    }
    this.lastSample = from;

    if (this.onSpectrum && c.currentTime - this.lastSpec >= this.spectrumEvery) {
      this.lastSpec = c.currentTime;
      analyser.getFloatFrequencyData(this.mic.freqDb);
      this.onSpectrum(c.currentTime - this.latency, this.mic.freqDb);
    }
  }

  // Detection thresholds from the Mic sensitivity setting (1 = strict, 10 = very sensitive).
  thresholds() {
    const L = Math.max(1, Math.min(10, getMicSensitivity()));
    const f = (L - 1) / 9;
    return {
      rise: 2.4 - f * 1.1, // attack must jump this much above the last ~30 ms
      gate: 6 - f * 4, // and sit this far above the background noise
    };
  }

  processBlock(rms, hf, t, start) {
    this.envelope.push([t - this.latency, rms]);
    if (this.envelope.length > 4000) this.envelope.splice(0, 1000);

    // Rise test on the attack signal: latest ~10 ms against the ~30 ms before it.
    const prev = this.recent.slice(0, -1);
    const prevAvg = prev.length ? prev.reduce((a, b) => a + b, 0) / prev.length : hf;
    const cur = this.recent.length ? (hf + this.recent[this.recent.length - 1]) / 2 : hf;
    this.recent.push(hf);
    if (this.recent.length > 7) this.recent.shift();

    // Track the peak level shortly after an onset.
    if (this.pending) {
      this.pending.level = Math.max(this.pending.level, rms);
      if (t - this.pending.raw > 0.06) {
        const o = this.pending;
        this.pending = null;
        this.onsets.push(o);
        this.onOnset?.(o);
      }
    }

    const th = this.thresholds();
    const isOnset = this.hist.length >= 40 // ~0.2 s warm-up to learn the room noise
      && cur > 0.0005
      && cur > this.floor * th.gate
      && cur > prevAvg * th.rise
      && t - this.lastOnset > 0.085;
    if (isOnset) {
      // Refine to the first sharp change in the latest two blocks.
      const { time } = this.mic;
      const s0 = Math.max(1, start - this.block);
      const thr = Math.max(prevAvg * 2, cur * 0.5);
      let k = start - s0;
      for (let i = s0; i < start + this.block; i++) {
        if (Math.abs(time[i] - time[i - 1]) > thr) { k = i - s0; break; }
      }
      const raw = t - (start - s0) / this.sr + k / this.sr;
      this.lastOnset = t;
      this.pending = { raw, t: raw - this.latency, level: rms };
    }
    // Background noise: a low percentile of the attack signal over the last ~2 s.
    this.hist.push(hf);
    if (this.hist.length > 375) this.hist.shift();
    if (++this.sinceFloor >= 20 && this.hist.length >= 40) {
      this.sinceFloor = 0;
      const sorted = [...this.hist].sort((a, b) => a - b);
      this.floor = Math.max(1e-6, sorted[Math.floor(sorted.length * 0.1)]);
    }
  }
}

// ---------- Pitch detection (YIN) for the tuner ----------
export function detectPitch(buf, sr, minF = 150, maxF = 1100) {
  const W = 1024;
  if (buf.length < W * 2) return null;
  const start = buf.length - W * 2;
  let rms = 0;
  for (let i = start; i < buf.length; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / (W * 2));
  if (rms < 0.008) return null;
  const tauMin = Math.floor(sr / maxF);
  const tauMax = Math.min(W - 1, Math.ceil(sr / minF));
  const d = new Float32Array(tauMax + 1);
  for (let tau = 1; tau <= tauMax; tau++) {
    let s = 0;
    for (let i = 0; i < W; i++) {
      const x = buf[start + i] - buf[start + i + tau];
      s += x * x;
    }
    d[tau] = s;
  }
  // Cumulative mean normalised difference.
  let running = 0;
  const cm = new Float32Array(tauMax + 1);
  cm[0] = 1;
  for (let tau = 1; tau <= tauMax; tau++) {
    running += d[tau];
    cm[tau] = running ? (d[tau] * tau) / running : 1;
  }
  let tau = -1;
  for (let t = tauMin; t <= tauMax; t++) {
    if (cm[t] < 0.15) {
      while (t + 1 <= tauMax && cm[t + 1] < cm[t]) t++;
      tau = t;
      break;
    }
  }
  if (tau < 0) return null;
  // Parabolic interpolation.
  const a = cm[tau - 1] ?? cm[tau];
  const b = cm[tau];
  const c = cm[tau + 1] ?? cm[tau];
  const denom = a - 2 * b + c;
  const shift = denom ? (0.5 * (a - c)) / denom : 0;
  return { freq: sr / (tau + shift), clarity: 1 - b, rms };
}

// ---------- Spectrum helpers ----------

export function newSpectrumAccumulator(bins) {
  return { sum: new Float32Array(bins), n: 0 };
}

export function addSpectrum(acc, db) {
  const s = acc.sum;
  for (let i = 0; i < s.length; i++) {
    const a = Math.pow(10, db[i] / 20);
    s[i] += a * a;
  }
  acc.n++;
}

function binHz() {
  const c = getCtx();
  return c.sampleRate / 8192;
}

export function chroma(power) {
  const hz = binHz();
  const out = new Float32Array(12);
  const lo = Math.floor(245 / hz);
  const hi = Math.ceil(900 / hz);
  for (let i = lo; i <= hi && i < power.length; i++) {
    const f = i * hz;
    const midi = 69 + 12 * Math.log2(f / 440);
    const near = Math.round(midi);
    const dev = Math.abs(midi - near);
    if (dev > 0.35) continue;
    out[((near % 12) + 12) % 12] += power[i] * (1 - dev);
  }
  return out;
}

// Energy (dB) within ±30 cents of a frequency.
function levelAt(power, freq) {
  const hz = binHz();
  const lo = Math.floor((freq * Math.pow(2, -0.3 / 12)) / hz);
  const hi = Math.ceil((freq * Math.pow(2, 0.3 / 12)) / hz);
  let m = 1e-20;
  for (let i = lo; i <= hi; i++) m = Math.max(m, power[i] || 0);
  return 10 * Math.log10(m);
}

export function chordMatch(ch, chordName) {
  const chord = CHORDS[chordName];
  let total = 0;
  let max = 0;
  for (let i = 0; i < 12; i++) { total += ch[i]; max = Math.max(max, ch[i]); }
  if (total <= 0) return { score: 0, ratio: 0, coverage: 0, missingPcs: chord.pcs };
  let inside = 0;
  for (const pc of chord.pcs) inside += ch[pc];
  const ratio = inside / total;
  const missingPcs = chord.pcs.filter((pc) => ch[pc] < 0.06 * max);
  const coverage = 1 - missingPcs.length / chord.pcs.length;
  const score = clamp((ratio - 0.45) / 0.4) * 0.65 + coverage * 0.35;
  return { score, ratio, coverage, missingPcs };
}

export function bestChord(ch, candidates = Object.keys(CHORDS)) {
  let best = null;
  for (const name of candidates) {
    const m = chordMatch(ch, name);
    if (!best || m.score > best.score) best = { name, ...m };
  }
  return best;
}

// ---------- Single chord check ----------
// power: accumulated spectrum after the strum; env: [t, rms] from onset on.
export function analyseChord(chordName, power, env, onsetT, noiseFloor) {
  const chord = CHORDS[chordName];
  const ch = chroma(power);
  const match = chordMatch(ch, chordName);
  const guess = bestChord(ch);
  const items = [];

  // Per-string levels.
  const levels = chord.notes.map((n) => levelAt(power, n.freq));
  const top = Math.max(...levels);
  const strings = chord.notes.map((n, i) => {
    let status = 'ok';
    const rel = levels[i] - top;
    if (rel < -22) status = 'quiet';
    if (n.fret > 0) {
      const openF = n.freq / Math.pow(2, n.fret / 12);
      const shared = chord.notes.some((m) => Math.abs(1200 * Math.log2(m.freq / openF)) < 30);
      if (!shared && levelAt(power, openF) > levels[i] + 3) status = 'open';
    }
    return { ...n, status, rel };
  });

  strings.forEach((s) => {
    if (s.status === 'open') {
      items.push({ kind: 'warn', text: `Your ${s.string} string sounds open. Press firmly on fret ${s.fret}, just behind the metal fret wire.` });
    } else if (s.status === 'quiet') {
      items.push({ kind: 'warn', text: s.fret === 0
        ? `The open ${s.string} string is hardly ringing. Check a finger isn't leaning on it.`
        : `The ${s.string} string (fret ${s.fret}) is muffled. Use your fingertip and arch the finger.` });
    }
  });

  if (guess.name !== chordName && guess.score > match.score + 0.15) {
    items.push({ kind: 'warn', text: `That sounded more like ${guess.name} than ${chordName}. Check the diagram again.` });
  }

  // Sustain: how long until the sound drops by ~14 dB.
  let sustain = null;
  // Smooth over ~50 ms so a single dip doesn't count as the sound dying.
  const raw = env.filter(([t]) => t >= onsetT);
  const after = raw.map(([t], i) => {
    const w = raw.slice(Math.max(0, i - 5), i + 5);
    return [t, w.reduce((a, [, r]) => a + r, 0) / w.length];
  });
  if (after.length > 20) {
    let peak = 0;
    let peakT = onsetT;
    for (const [t, r] of after) {
      if (t - onsetT > 0.15) break;
      if (r > peak) { peak = r; peakT = t; }
    }
    const end = after.find(([t, r]) => t > peakT && r < peak * 0.2);
    sustain = end ? end[0] - peakT : after[after.length - 1][0] - peakT;
    if (sustain < 0.3) {
      items.push({ kind: 'warn', text: 'The chord dies away quickly. Press a little harder and keep your palm off the strings.' });
    } else if (sustain > 0.8) {
      items.push({ kind: 'good', text: 'Lovely long ring. The strings are sustaining well.' });
    }
  }

  if (noiseFloor > 0.02) {
    items.push({ kind: 'tip', text: 'It\'s a bit noisy around you. A quieter spot gives more accurate feedback.' });
  }

  const score = Math.round(100 * clamp(match.score - strings.filter((s) => s.status !== 'ok').length * 0.08));
  if (score >= 80 && !items.some((i) => i.kind === 'warn')) {
    items.unshift({ kind: 'good', text: `Clean ${chordName}! All the notes came through.` });
  }
  if (!items.length) {
    items.push({ kind: 'tip', text: 'Close. Strum again and let it ring for a second.' });
  }
  return { score, strings, items, guess: guess.name, sustain };
}

// ---------- Rhythm and song analysis ----------
// expected: [{t, type}] strums; onsets: [{t, level}]
export function analyseTiming(expected, onsets, { slotDur, bpm }) {
  const items = [];
  const win = Math.min(slotDur * 0.45, 0.18);
  const used = new Set();
  const matches = [];
  for (const e of expected) {
    let best = -1;
    let bestD = Infinity;
    onsets.forEach((o, j) => {
      if (used.has(j)) return;
      const d = Math.abs(o.t - e.t);
      if (d < bestD) { bestD = d; best = j; }
    });
    if (best >= 0 && bestD <= win) {
      used.add(best);
      matches.push({ e, o: onsets[best], off: onsets[best].t - e.t });
    }
  }
  const startT = expected[0]?.t ?? 0;
  const endT = (expected[expected.length - 1]?.t ?? 0) + slotDur * 2;
  const inRange = onsets.filter((o) => o.t > startT - win && o.t < endT);
  const extras = inRange.length - used.size;
  const hitRate = expected.length ? matches.length / expected.length : 0;

  if (inRange.length < 3) {
    return {
      score: 0, hitRate: 0, meanMs: 0, sdMs: 0, tempo: null,
      items: [{ kind: 'warn', text: 'I couldn\'t hear much strumming. Check the microphone is allowed, hold the uke closer, or raise Mic sensitivity in Me → Settings.' }],
    };
  }

  const offs = matches.map((m) => m.off);
  const mean = offs.reduce((a, b) => a + b, 0) / (offs.length || 1);
  const sd = Math.sqrt(offs.reduce((a, b) => a + (b - mean) ** 2, 0) / (offs.length || 1));
  const meanMs = Math.round(mean * 1000);
  const sdMs = Math.round(sd * 1000);

  // Tempo from the gaps between consecutive strums, snapped to whole slots.
  const tempoOf = (list) => {
    const ests = [];
    for (let i = 1; i < list.length; i++) {
      const ioi = list[i].t - list[i - 1].t;
      const n = Math.round(ioi / slotDur);
      if (n >= 1 && n <= 4 && ioi > 0.05) ests.push((bpm * n * slotDur) / ioi);
    }
    if (ests.length < 4) return null;
    ests.sort((a, b) => a - b);
    const med = ests[Math.floor(ests.length / 2)];
    // Only trust it when the gaps are consistent.
    const iqr = ests[Math.floor(ests.length * 0.75)] - ests[Math.floor(ests.length * 0.25)];
    return iqr / med < 0.15 ? med : null;
  };
  const t = tempoOf(inRange);
  const tempo = t ? Math.round(t) : null;
  const half = Math.floor(inRange.length / 2);
  const t1 = tempoOf(inRange.slice(0, half));
  const t2 = tempoOf(inRange.slice(half));
  const drift = t1 && t2 ? t2 - t1 : 0;

  const hitOf = (type) => {
    const n = expected.filter((e) => e.type === type).length;
    return n ? matches.filter((m) => m.e.type === type).length / n : null;
  };
  const downHit = hitOf('D');
  const upHit = hitOf('U');

  // Feedback
  if (upHit != null && downHit >= 0.85 && upHit < 0.5) items.push({ kind: 'tip', text: 'Your down strums were spot on, but I barely heard the up strums. Keep your hand swinging and brush the strings on the way up too.' });
  else if (hitRate >= 0.9) items.push({ kind: 'good', text: `You hit ${Math.round(hitRate * 100)}% of the strums. Great work!` });
  else if (hitRate >= 0.6) items.push({ kind: 'tip', text: `You caught ${Math.round(hitRate * 100)}% of the strums. Keep your hand moving even when you miss one.` });
  else items.push({ kind: 'warn', text: `Only ${Math.round(hitRate * 100)}% of strums landed on time. Try a slower tempo and follow the frog.` });

  if (meanMs > 40) items.push({ kind: 'tip', text: `You're a little behind the beat (about ${meanMs} ms late). Start each strum slightly earlier, as the frog is about to land.` });
  else if (meanMs < -40) items.push({ kind: 'tip', text: `You're rushing ahead of the beat (about ${-meanMs} ms early). Relax and wait for the frog to land.` });
  else if (matches.length > 3 && sdMs <= 40) items.push({ kind: 'good', text: 'Your strums are centred right on the beat.' });

  if (sdMs > 55) items.push({ kind: 'warn', text: 'Your timing wobbles quite a bit. Practise with the metronome at a slower speed until it feels automatic.' });
  else if (sdMs > 30) items.push({ kind: 'tip', text: 'Timing is fairly steady. Tapping your foot on the beat will tighten it up.' });
  else if (matches.length > 3) items.push({ kind: 'good', text: 'Very steady rhythm.' });

  if (tempo && Math.abs(tempo - bpm) >= 4) {
    items.push({ kind: 'tip', text: `Your overall speed was about ${tempo} BPM against a target of ${bpm}. ${tempo > bpm ? 'Ease off a little.' : 'Push on a little.'}` });
  }
  if (drift >= 4) items.push({ kind: 'tip', text: 'You sped up as the song went on. Keep the same pace from start to finish.' });
  if (drift <= -4) items.push({ kind: 'tip', text: 'You slowed down towards the end. Chord changes often cause this, so practise the changes on their own.' });

  if (extras > Math.max(2, expected.length * 0.2)) {
    items.push({ kind: 'tip', text: 'I heard extra strums between the beats. Let your hand swing past the strings on the rests.' });
  }

  // Dynamics
  const downs = matches.filter((m) => m.e.type === 'D').map((m) => m.o.level);
  const ups = matches.filter((m) => m.e.type === 'U').map((m) => m.o.level);
  if (downs.length >= 4) {
    const dm = downs.reduce((a, b) => a + b, 0) / downs.length;
    const cv = Math.sqrt(downs.reduce((a, b) => a + (b - dm) ** 2, 0) / downs.length) / dm;
    if (cv > 0.55) items.push({ kind: 'tip', text: 'Your volume jumps around. Aim for even strums with the same strength each time.' });
    const um = ups.length ? ups.reduce((a, b) => a + b, 0) / ups.length : 0;
    if (ups.length >= 4 && um < dm * 0.3) {
      items.push({ kind: 'tip', text: 'Your up strums are much quieter than the downs. A little quieter is natural, but give them a bit more flick.' });
    }
  }

  const steadiness = clamp(1 - (sd - 0.02) / 0.1);
  const onBeat = clamp(1 - (Math.abs(mean) - 0.025) / 0.15);
  const score = Math.round(100 * (hitRate * 0.55 + steadiness * 0.3 + onBeat * 0.15));
  return { score, hitRate, meanMs, sdMs, tempo, items };
}

// segments: [{chord, bar, acc}] with accumulated spectra per chord span.
export function analyseSongChords(segments) {
  const results = segments.filter((s) => s.acc.n > 0).map((s) => {
    const ch = chroma(s.acc.sum);
    const m = chordMatch(ch, s.chord);
    return { ...s, score: m.score, guess: bestChord(ch).name };
  });
  if (!results.length) return { score: 0, items: [] };
  const score = Math.round(100 * results.reduce((a, r) => a + r.score, 0) / results.length);
  const items = [];
  // Per chord averages.
  const byChord = {};
  results.forEach((r) => { (byChord[r.chord] ||= []).push(r.score); });
  const avgs = Object.entries(byChord).map(([c, arr]) => [c, arr.reduce((a, b) => a + b, 0) / arr.length]);
  avgs.sort((a, b) => a[1] - b[1]);
  const weak = avgs.filter(([, v]) => v < 0.55);
  if (weak.length) {
    const names = weak.map(([c]) => c).join(' and ');
    items.push({ kind: 'warn', text: `${names} ${weak.length > 1 ? 'were' : 'was'} the least clear. Revisit ${weak.length > 1 ? 'those chord lessons' : 'that chord lesson'} and check each string rings.` });
  } else {
    items.push({ kind: 'good', text: 'Your chords rang out clearly all the way through.' });
  }
  // Late changes: first beat of new chords weaker than the rest.
  const changes = results.filter((r, i) => i > 0 && results[i - 1].chord !== r.chord);
  const confused = changes.filter((r) => r.guess !== r.chord && r.score < 0.5);
  if (confused.length >= 2) {
    const r = confused[0];
    items.push({ kind: 'tip', text: `Some changes came in late, e.g. into ${r.chord} (bar ${r.bar + 1}). Look ahead: the frog shows the next chord, so start moving your fingers on the last strum of the bar.` });
  }
  return { score, items };
}

export function starsFor(score) {
  if (score >= 85) return 3;
  if (score >= 65) return 2;
  if (score >= 40) return 1;
  return 0;
}

export function describePitch(freq) {
  const midi = 69 + 12 * Math.log2(freq / 440);
  const near = Math.round(midi);
  return { name: noteName(near) + (Math.floor(near / 12) - 1), cents: Math.round((midi - near) * 100) };
}
