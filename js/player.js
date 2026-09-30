// The play-along / listen-and-coach player used by chord drills, strum lessons and songs.
import { unlockAudio, now, Scheduler, strum, click, openMic, closeMic, defaultLatency } from './audio.js';
import { Timeline } from './timeline.js';
import { FrogStage } from './frog.js';
import { Listener, analyseTiming, analyseSongChords, newSpectrumAccumulator, addSpectrum, starsFor } from './analysis.js';
import { h, chordDiagram, feedbackList, stars } from './ui.js';
import { getSetting, earn, markPractice, recordScore } from './progress.js';

let wakeLock = null;
async function keepAwake(on) {
  try {
    if (on && 'wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen');
    else if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch (e) { /* not supported */ }
}

export function createPlayer({ id, bars, pattern, beats, bpm, minBpm = 40, maxBpm, lyrics = false, analyseChords = true, onResult }) {
  let tempo = bpm;
  maxBpm = maxBpm || Math.max(bpm + 30, 120);
  let tl = null;
  let sched = null;
  let listener = null;
  let segs = null;
  let mode = null;
  let uiTimer = null;
  let endTimer = null;
  let lastBar = -2;
  let lastChord = null;

  const canvas = h('canvas', { class: 'stage', 'aria-label': 'Frog animation: the frog lands on each strum' });
  const curBox = h('div', { class: 'now-chord' });
  const nextBox = h('div', { class: 'next-chord' });
  const chordStrip = h('div', { class: 'chord-strip' },
    h('div', { class: 'strip-col' }, h('div', { class: 'strip-label' }, 'Now'), curBox),
    h('div', { class: 'strip-col small' }, h('div', { class: 'strip-label' }, 'Next'), nextBox));

  const lyricBox = lyrics ? h('div', { class: 'lyrics' },
    ...bars.map((b, i) => h('div', { class: 'lyric-line', 'data-bar': i },
      h('span', { class: 'lyric-chord' }, [].concat(b.c).join(' · ')),
      h('span', { class: 'lyric-text' }, b.l || '—')))) : null;

  const tempoLabel = h('span', { class: 'tempo-val' }, `${tempo} BPM`);
  const setTempo = (v) => {
    tempo = Math.max(minBpm, Math.min(maxBpm, v));
    tempoLabel.textContent = `${tempo} BPM`;
    slider.value = tempo;
  };
  const slider = h('input', { type: 'range', min: minBpm, max: maxBpm, value: tempo, 'aria-label': 'Tempo', onInput: (e) => setTempo(+e.target.value) });
  const tempoRow = h('div', { class: 'tempo-row' },
    h('button', { class: 'btn-round', 'aria-label': 'Slower', onClick: () => setTempo(tempo - 5) }, '−'),
    h('div', { class: 'tempo-mid' }, tempoLabel, slider),
    h('button', { class: 'btn-round', 'aria-label': 'Faster', onClick: () => setTempo(tempo + 5) }, '+'));

  const playBtn = h('button', { class: 'btn primary', onClick: () => run('play') }, '▶ Play along');
  const listenBtn = h('button', { class: 'btn accent', onClick: () => run('listen') }, '🎤 Listen & coach');
  const stopBtn = h('button', { class: 'btn', onClick: () => finish(true), hidden: true }, '■ Stop');
  const status = h('p', { class: 'player-status' }, 'Play along to hear how it goes, then let the coach listen to you.');
  const results = h('div', { class: 'results' });

  const el = h('div', { class: 'player' },
    chordStrip, canvas, lyricBox, tempoRow,
    h('div', { class: 'btn-row' }, playBtn, listenBtn, stopBtn),
    status, results);

  const stage = new FrogStage(canvas, { clock: now });
  // Canvas needs layout before sizing.
  requestAnimationFrame(() => { stage.resize(); stage.start(); });
  showChords(0);

  function showChords(barIdx, chordNow) {
    const cur = chordNow || [].concat(bars[Math.max(0, barIdx)]?.c || [])[0];
    // Find the next different chord.
    let nxt = null;
    const flat = [];
    bars.forEach((b) => [].concat(b.c).forEach((c) => flat.push(c)));
    let pos = 0;
    for (let i = 0; i < Math.max(0, barIdx); i++) pos += [].concat(bars[i].c).length;
    // Skip to the current chord within this bar, then find the next different one.
    const at = flat.indexOf(cur, pos);
    for (let i = at < 0 ? pos : at; i < flat.length; i++) if (flat[i] !== cur) { nxt = flat[i]; break; }
    if (cur && cur !== lastChord) {
      curBox.replaceChildren(chordDiagram(cur, { size: 'sm' }));
      lastChord = cur;
    }
    nextBox.replaceChildren(nxt ? chordDiagram(nxt, { size: 'xs' }) : h('div', { class: 'strip-end' }, '🏁'));
  }

  function updateUi() {
    if (!tl) return;
    const pos = tl.positionAt(now());
    if (pos.counting) return;
    if (pos.bar !== lastBar || pos.chord !== lastChord) {
      lastBar = pos.bar;
      showChords(pos.bar, pos.chord);
      if (lyricBox) {
        lyricBox.querySelectorAll('.lyric-line').forEach((l) => l.classList.toggle('on', +l.dataset.bar === pos.bar));
        const on = lyricBox.querySelector(`[data-bar="${pos.bar}"]`);
        if (on) lyricBox.scrollTo({ top: on.offsetTop - 40, behavior: 'smooth' });
      }
    }
  }

  async function run(m) {
    if (mode) finish(true);
    results.replaceChildren();
    await unlockAudio();
    let mic = null;
    if (m === 'listen') {
      try {
        mic = await openMic();
      } catch (e) {
        status.textContent = 'I need microphone access to listen. Allow it in your browser settings, then try again. ' + (e.message || '');
        return;
      }
    }
    mode = m;
    const start = now() + 0.4;
    tl = new Timeline({ bars, pattern, beats, bpm: tempo, start });
    stage.setTimeline(tl);
    lastBar = -2;
    lastChord = null;
    showChords(0);

    const clicksOn = m === 'listen' && getSetting('clickWhileListening');
    sched = new Scheduler(tl, (e) => {
      if (e.kind === 'count') click(e.t, e.accent);
      else if (e.kind === 'beat' && clicksOn) click(e.t, e.accent, 0.25);
      else if (e.kind === 'strum' && m === 'play' && e.chord) strum(e.chord, e.t, e.type, e.type === 'U' ? 0.4 : 0.5);
      else if (e.kind === 'end') {
        clearTimeout(endTimer);
        endTimer = setTimeout(() => finish(false), Math.max(0, (e.t - now()) * 1000) + 600);
      }
    });
    sched.start(start - 0.05);

    if (m === 'listen') {
      segs = tl.segments().map((s) => ({ ...s, acc: newSpectrumAccumulator(mic.analyser.frequencyBinCount) }));
      const strums = tl.allStrums();
      listener = new Listener(mic, {
        latency: getSetting('latency') ?? defaultLatency(),
        onOnset: (o) => {
          let best = Infinity;
          for (const e of strums) best = Math.min(best, Math.abs(e.t - o.t));
          if (best < 0.35) stage.sparkle(best < 0.07 ? 'good' : 'meh');
        },
        onSpectrum: (t, db) => {
          for (const s of segs) {
            if (t >= s.t0 + 0.12 && t < s.t1) { addSpectrum(s.acc, db); break; }
          }
        },
      });
      listener.start();
      status.textContent = 'Listening… follow the frog. Strum when it lands on a lily pad.';
    } else {
      status.textContent = 'Follow the frog: strum each time it lands. ↓ = down, ↑ = up, ✕ = chuck.';
    }
    playBtn.hidden = true;
    listenBtn.hidden = true;
    stopBtn.hidden = false;
    chordStrip.scrollIntoView({ behavior: 'smooth', block: 'start' });
    uiTimer = setInterval(updateUi, 50);
    keepAwake(true);
    markPractice();
  }

  function finish(stopped) {
    if (!mode) return;
    const m = mode;
    mode = null;
    sched?.stop();
    listener?.stop();
    if (m === 'listen') closeMic();
    clearInterval(uiTimer);
    clearTimeout(endTimer);
    keepAwake(false);
    playBtn.hidden = false;
    listenBtn.hidden = false;
    stopBtn.hidden = true;
    const theTl = tl;
    tl = null;
    stage.setTimeline(null);
    lyricBox?.querySelectorAll('.lyric-line').forEach((l) => l.classList.remove('on'));

    if (m === 'play') {
      status.textContent = stopped ? 'Stopped.' : 'Nice! Now tap "Listen & coach" and play it yourself for feedback.';
      return;
    }
    if (stopped) {
      status.textContent = 'Stopped. Play all the way through to get feedback.';
      listener = null;
      return;
    }
    const timing = analyseTiming(theTl.allStrums(), listener.onsets, { slotDur: theTl.slotDur, bpm: theTl.bpm });
    const chordRes = analyseChords && timing.score > 0 ? analyseSongChords(segs) : null;
    listener = null;
    const score = chordRes ? Math.round(timing.score * 0.55 + chordRes.score * 0.45) : timing.score;
    const st = starsFor(score);
    const items = [...timing.items, ...(chordRes?.items || [])];
    if (score >= 85 && theTl.bpm < maxBpm) items.push({ kind: 'tip', text: `Ready for a challenge? Try it at ${Math.min(maxBpm, theTl.bpm + 10)} BPM.` });
    if (score < 50 && theTl.bpm > minBpm + 10) items.push({ kind: 'tip', text: `Try slowing down to ${theTl.bpm - 10} BPM. Accuracy first, then speed.` });

    results.replaceChildren(
      h('div', { class: 'score-card' },
        h('div', { class: 'score-big' }, String(score)),
        h('div', {},
          stars(st),
          h('div', { class: 'score-parts' },
            `Timing ${timing.score}`,
            chordRes ? ` · Chords ${chordRes.score}` : '',
            timing.tempo ? ` · Your speed ≈ ${timing.tempo} BPM` : ''))),
      feedbackList(items));
    status.textContent = st >= 2 ? 'Great playing! 🐸' : 'Keep practising. You\'re getting there! 🐸';
    if (st >= 1) stage.sparkle('good');
    earn('coached');
    if (id) recordScore(id, score);
    onResult?.(score, st);
  }

  return {
    el,
    destroy() {
      finish(true);
      stage.destroy();
    },
  };
}
