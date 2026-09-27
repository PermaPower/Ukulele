// Chord checker, tuner, metronome and latency calibration.
import { STRINGS } from './data.js';
import { unlockAudio, now, openMic, click, playReference, Scheduler, getCtx } from './audio.js';
import { Listener, detectPitch, analyseChord, newSpectrumAccumulator, addSpectrum, starsFor, describePitch } from './analysis.js';
import { Timeline } from './timeline.js';
import { FrogStage } from './frog.js';
import { h, chordDiagram, feedbackList, stars } from './ui.js';
import { earn, markPractice, setSetting } from './progress.js';

// ---------- Chord check ----------
export function createChordCheck(chordName, { onResult } = {}) {
  const diagram = h('div', { class: 'check-diagram' }, chordDiagram(chordName));
  const btn = h('button', { class: 'btn accent', onClick: go }, '🎤 Check my chord');
  const status = h('p', { class: 'player-status' }, 'Hold the chord, tap the button, then strum once and let it ring.');
  const results = h('div', { class: 'results' });
  const el = h('div', { class: 'chord-check' }, diagram, h('div', { class: 'btn-row' }, btn), status, results);
  let listener = null;
  let timer = null;

  async function go() {
    await unlockAudio();
    let mic;
    try {
      mic = await openMic();
    } catch (e) {
      status.textContent = 'I need microphone access to listen. Allow it in your browser settings, then try again.';
      return;
    }
    stop();
    btn.disabled = true;
    results.replaceChildren();
    status.textContent = 'Listening… strum the chord now!';
    el.classList.add('listening');
    const acc = newSpectrumAccumulator(mic.analyser.frequencyBinCount);
    let onsetT = null;
    let floor = 0;
    listener = new Listener(mic, {
      latency: 0,
      onOnset: (o) => {
        if (onsetT == null) {
          onsetT = o.t;
          floor = listener.floor;
          status.textContent = 'Got it. Let it ring…';
          setTimeout(done, 1500);
        }
      },
      onSpectrum: (t, db) => {
        if (onsetT != null && t > onsetT + 0.1 && t < onsetT + 0.9) addSpectrum(acc, db);
      },
    });
    listener.start();
    timer = setTimeout(() => {
      if (onsetT == null) {
        stop();
        status.textContent = 'I didn\'t hear a strum. Hold the uke closer to the phone and strum a bit louder.';
      }
    }, 10000);

    function done() {
      if (!listener) return;
      const env = listener.envelope;
      stop();
      if (!acc.n) {
        status.textContent = 'That was too short to analyse. Try again and let the chord ring.';
        return;
      }
      const r = analyseChord(chordName, acc.sum, env, onsetT, floor);
      const st = starsFor(r.score);
      diagram.replaceChildren(chordDiagram(chordName, { status: r.strings.map((s) => s.status) }));
      results.replaceChildren(
        h('div', { class: 'score-card' },
          h('div', { class: 'score-big' }, String(r.score)),
          h('div', {}, stars(st), h('div', { class: 'score-parts' }, 'Chord clarity'))),
        feedbackList(r.items),
        h('p', { class: 'legend' }, 'Diagram colours: green rang clearly, orange was quiet, red sounded open.'));
      status.textContent = st >= 2 ? 'Nice! Try a few more times to lock it in.' : 'Adjust your fingers and check again.';
      earn('coached');
      markPractice();
      onResult?.(r.score, st);
    }
  }

  function stop() {
    listener?.stop();
    listener = null;
    clearTimeout(timer);
    btn.disabled = false;
    el.classList.remove('listening');
  }

  return { el, destroy: stop };
}

// ---------- Tuner ----------
export function createTuner({ onAllTuned } = {}) {
  const tuned = [false, false, false, false];
  const note = h('div', { class: 'tuner-note' }, '–');
  const needle = h('div', { class: 'tuner-needle' });
  const cents = h('div', { class: 'tuner-cents' }, 'Tap Start, then pluck one string');
  const hint = h('div', { class: 'tuner-hint' }, '');
  const strBtns = STRINGS.map((s, i) => h('button', {
    class: 'string-btn', 'aria-label': `Play reference ${s.name}`,
    onClick: async () => { await unlockAudio(); playReference(i); },
  }, h('span', { class: 'sb-name' }, s.name), h('span', { class: 'sb-tick' }, '')));
  const startBtn = h('button', { class: 'btn accent', onClick: toggle }, '🎤 Start tuner');
  const el = h('div', { class: 'tuner' },
    h('div', { class: 'tuner-dial' },
      h('div', { class: 'tuner-scale' }, h('span', {}, '♭'), h('span', { class: 'mid' }, '|'), h('span', {}, '♯')),
      needle, note),
    cents, hint,
    h('div', { class: 'string-row' }, ...strBtns),
    h('p', { class: 'small-print' }, 'Tap a string letter to hear its reference note. Standard tuning is G C E A, with the G string tuned higher than the C.'),
    h('div', { class: 'btn-row' }, startBtn));
  let raf = null;
  let mic = null;
  let hist = [];
  let inTuneSince = null;

  async function toggle() {
    if (raf) { stop(); return; }
    await unlockAudio();
    try {
      mic = await openMic();
    } catch (e) {
      cents.textContent = 'Microphone access is needed for the tuner.';
      return;
    }
    startBtn.textContent = '■ Stop tuner';
    loop();
  }

  function loop() {
    raf = requestAnimationFrame(loop);
    mic.analyser.getFloatTimeDomainData(mic.time);
    const p = detectPitch(mic.time, getCtx().sampleRate);
    if (!p || p.clarity < 0.8) { inTuneSince = null; return; }
    hist.push(p.freq);
    if (hist.length > 5) hist.shift();
    const f = [...hist].sort((a, b) => a - b)[Math.floor(hist.length / 2)];
    // Nearest string.
    let bi = 0;
    let bc = Infinity;
    STRINGS.forEach((s, i) => {
      const c = 1200 * Math.log2(f / s.freq);
      if (Math.abs(c) < Math.abs(bc)) { bc = c; bi = i; }
    });
    const c = Math.round(bc);
    note.textContent = STRINGS[bi].name;
    const shown = Math.max(-50, Math.min(50, c));
    needle.style.transform = `rotate(${shown * 0.9}deg)`;
    const ok = Math.abs(c) <= 6;
    needle.classList.toggle('ok', ok);
    note.classList.toggle('ok', ok);
    strBtns.forEach((b, i) => b.classList.toggle('active', i === bi));
    if (Math.abs(bc) > 300) {
      const d = describePitch(f);
      cents.textContent = `Hearing ${d.name}. That's a long way from ${STRINGS[bi].name}.`;
      hint.textContent = '';
    } else {
      cents.textContent = ok ? 'In tune! ✓' : `${c > 0 ? '+' : ''}${c} cents`;
      hint.textContent = ok ? '' : c > 0 ? 'Too high: loosen the peg slightly' : 'Too low: tighten the peg slightly';
    }
    if (ok) {
      inTuneSince ??= performance.now();
      if (performance.now() - inTuneSince > 700 && !tuned[bi]) {
        tuned[bi] = true;
        strBtns[bi].classList.add('tuned');
        strBtns[bi].querySelector('.sb-tick').textContent = '✓';
        if (tuned.every(Boolean)) {
          earn('tuned');
          markPractice();
          hint.textContent = 'All four strings are in tune. Great!';
          onAllTuned?.();
        }
      }
    } else {
      inTuneSince = null;
    }
  }

  function stop() {
    cancelAnimationFrame(raf);
    raf = null;
    startBtn.textContent = '🎤 Start tuner';
  }

  return { el, destroy: stop, allTuned: () => tuned.every(Boolean) };
}

// ---------- Metronome ----------
export function createMetronome() {
  let bpm = 80;
  let beats = 4;
  let tl = null;
  let sched = null;
  let started = 0;
  const taps = [];
  const canvas = h('canvas', { class: 'stage', 'aria-label': 'Frog bouncing on the beat' });
  const val = h('div', { class: 'metro-bpm' }, String(bpm));
  const slider = h('input', { type: 'range', min: 40, max: 200, value: bpm, 'aria-label': 'Tempo', onInput: (e) => set(+e.target.value) });
  const startBtn = h('button', { class: 'btn primary', onClick: toggle }, '▶ Start');
  const sigBtns = [2, 3, 4].map((n) => h('button', { class: 'chip' + (n === beats ? ' on' : ''), onClick: () => setBeats(n) }, `${n}/4`));
  const el = h('div', { class: 'metronome' },
    canvas,
    h('div', { class: 'tempo-row' },
      h('button', { class: 'btn-round', 'aria-label': 'Slower', onClick: () => set(bpm - 1) }, '−'),
      h('div', { class: 'tempo-mid' }, val, h('div', { class: 'strip-label' }, 'beats per minute'), slider),
      h('button', { class: 'btn-round', 'aria-label': 'Faster', onClick: () => set(bpm + 1) }, '+')),
    h('div', { class: 'chip-row' }, ...sigBtns, h('button', { class: 'chip', onClick: tap }, '👆 Tap tempo')),
    h('div', { class: 'btn-row' }, startBtn),
    h('p', { class: 'small-print' }, 'Tip: practise a tricky chord change slowly with the click, then raise the speed by 5 BPM once it feels easy.'));
  const stage = new FrogStage(canvas, { clock: now });
  requestAnimationFrame(() => { stage.resize(); stage.start(); });

  function set(v) {
    bpm = Math.max(40, Math.min(200, Math.round(v)));
    val.textContent = String(bpm);
    slider.value = bpm;
    if (sched) restart();
  }
  function setBeats(n) {
    beats = n;
    sigBtns.forEach((b, i) => b.classList.toggle('on', [2, 3, 4][i] === n));
    if (sched) restart();
  }
  function tap() {
    const t = performance.now();
    if (taps.length && t - taps[taps.length - 1] > 2000) taps.length = 0;
    taps.push(t);
    if (taps.length > 5) taps.shift();
    if (taps.length >= 3) {
      const iv = (taps[taps.length - 1] - taps[0]) / (taps.length - 1);
      set(60000 / iv);
    }
  }
  async function toggle() {
    if (sched) { halt(); return; }
    await unlockAudio();
    started = performance.now();
    restart();
    startBtn.textContent = '■ Stop';
  }
  function restart() {
    sched?.stop();
    const start = now() + 0.1;
    tl = new Timeline({ bars: [{ c: null }], pattern: 'D.'.repeat(beats), beats, bpm, start, countInBars: 0, loop: true });
    stage.setTimeline(tl);
    sched = new Scheduler(tl, (e) => { if (e.kind === 'beat') click(e.t, e.accent); });
    sched.start(start - 0.01);
    markPractice();
  }
  function halt() {
    sched?.stop();
    sched = null;
    stage.setTimeline(null);
    startBtn.textContent = '▶ Start';
    if (performance.now() - started > 30000) earn('metronome');
  }
  return { el, destroy() { if (sched) halt(); stage.destroy(); } };
}

// ---------- Latency calibration ----------
// Plays clicks through the speaker and measures when the mic hears them.
export async function calibrateLatency(statusEl) {
  await unlockAudio();
  const mic = await openMic();
  const clicks = [];
  const t0 = now() + 0.5;
  for (let i = 0; i < 8; i++) {
    const t = t0 + i * 0.5;
    clicks.push(t);
    click(t, true, 0.9);
  }
  statusEl.textContent = 'Listening to the clicks… keep quiet for 5 seconds.';
  const listener = new Listener(mic, { latency: 0 });
  listener.start();
  await new Promise((r) => setTimeout(r, (t0 - now() + 4.3) * 1000));
  listener.stop();
  const delays = [];
  for (const c of clicks) {
    const o = listener.onsets.find((x) => x.t - c > -0.01 && x.t - c < 0.35);
    if (o) delays.push(o.t - c);
  }
  if (delays.length < 4) {
    statusEl.textContent = 'I couldn\'t hear the clicks clearly. Turn the volume up, make sure headphones are unplugged, and try again.';
    return null;
  }
  delays.sort((a, b) => a - b);
  const lat = delays[Math.floor(delays.length / 2)];
  setSetting('latency', lat);
  statusEl.textContent = `Done! Your device's audio delay is about ${Math.round(lat * 1000)} ms. Timing feedback now allows for it.`;
  return lat;
}

