// App shell: routing, menus and lesson screens.
import { CHORDS, STRUMS, SONGS, UNITS, LESSONS, LESSON_BY_ID, BADGES, songChords } from './data.js';
import { unlockAudio, now, strum, playArpeggio, setMicSensitivity } from './audio.js';
import { starsFor } from './analysis.js';
import { h, stars, toast, chordDiagram, patternView } from './ui.js';
import { createPlayer } from './player.js';
import { createChordCheck, createTuner, createMetronome, calibrateLatency, createMicTest } from './tools.js';
import * as P from './progress.js';

const main = document.getElementById('main');
const titleEl = document.getElementById('title');
const backBtn = document.getElementById('back');
const streakEl = document.getElementById('streak');
let cleanup = [];

setMicSensitivity(P.getSetting('micSensitivity') ?? 6);

P.onBadge((b) => toast(`<span class="toast-icon">${b.icon}</span> Badge earned: <b>${b.name}</b>`));

backBtn.addEventListener('click', () => {
  if (history.length > 1) history.back();
  else location.hash = '#/';
});

function setHeader(title, back = false) {
  titleEl.textContent = title;
  backBtn.hidden = !back;
  const s = P.streak();
  streakEl.textContent = `🔥 ${s}`;
  streakEl.title = `${s} day practice streak`;
}

function setTab(name) {
  document.querySelectorAll('.tabbar a').forEach((a) => a.classList.toggle('on', a.dataset.tab === name));
}

function render() {
  cleanup.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } });
  cleanup = [];
  const [route, arg] = location.hash.replace(/^#\/?/, '').split('/');
  main.replaceChildren();
  main.scrollTop = 0;
  window.scrollTo(0, 0);
  const screens = { '': home, plan, lesson, chords, songs, tuner, metronome, progress, settings };
  (screens[route] || home)(arg);
}

window.addEventListener('hashchange', render);

// ---------- Home ----------
function home() {
  setHeader('Uke Frog');
  setTab('home');
  const st = P.stats();
  const next = P.nextLesson();
  const pct = Math.round((st.done / st.total) * 100);
  main.append(
    h('section', { class: 'hero' },
      h('div', { class: 'hero-frog', 'aria-hidden': 'true' }, '🐸'),
      h('div', {},
        h('h1', {}, st.done ? 'Welcome back!' : 'G\'day! I\'m Freddie.'),
        h('p', {}, st.done ? 'Ready for today\'s practice?' : 'I\'ll hop along the strings while you learn. Let\'s play!'))),
    h('div', { class: 'progress-bar', role: 'progressbar', 'aria-valuenow': pct, 'aria-valuemin': 0, 'aria-valuemax': 100 },
      h('div', { style: `width:${pct}%` })),
    h('p', { class: 'progress-text' }, `${st.done} of ${st.total} lessons · ${st.stars} ★ · ${st.streak} day streak`),
    next
      ? h('a', { class: 'continue-card', href: `#/lesson/${next.id}` },
        h('div', { class: 'cc-icon' }, next.icon),
        h('div', {},
          h('div', { class: 'cc-label' }, st.done ? 'Continue' : 'Start here'),
          h('div', { class: 'cc-title' }, next.title),
          h('div', { class: 'cc-sub' }, next.unitTitle)),
        h('div', { class: 'cc-go' }, '›'))
      : h('div', { class: 'continue-card done' }, h('div', { class: 'cc-icon' }, '🏆'),
        h('div', {}, h('div', { class: 'cc-title' }, 'You finished every lesson!'), h('div', { class: 'cc-sub' }, 'Replay songs to earn more stars.'))),
    h('nav', { class: 'menu-grid', 'aria-label': 'Main menu' },
      tile('#/plan', '🗺️', 'Lesson Plan', 'Step by step'),
      tile('#/chords', '✋', 'Chord Book', `${Object.keys(CHORDS).length} chords`),
      tile('#/songs', '🎵', 'Song Book', `${Object.keys(SONGS).length} songs`),
      tile('#/tuner', '🎯', 'Tuner', 'Tune up'),
      tile('#/metronome', '⏱️', 'Metronome', 'Keep time'),
      tile('#/progress', '🏅', 'My Progress', 'Badges & stars')),
  );
}

function tile(href, icon, name, sub) {
  return h('a', { class: 'tile', href }, h('div', { class: 'tile-icon' }, icon), h('div', { class: 'tile-name' }, name), h('div', { class: 'tile-sub' }, sub));
}

// ---------- Lesson plan ----------
function plan() {
  setHeader('Lesson Plan');
  setTab('plan');
  main.append(h('p', { class: 'intro' }, 'Each unit teaches a chord (and sometimes a strum), then a song that uses what you\'ve learnt. Finish a lesson to unlock the next.'));
  UNITS.forEach((u, ui) => {
    const ls = LESSONS.filter((l) => l.unit === ui);
    main.append(h('section', { class: 'unit' },
      h('h2', {}, u.title),
      h('ol', { class: 'lesson-list' }, ...ls.map(lessonRow))));
  });
}

function lessonRow(l) {
  const unlocked = P.isUnlocked(l.id);
  const done = P.isDone(l.id);
  const inner = [
    h('span', { class: 'lr-icon' }, unlocked ? l.icon : '🔒'),
    h('span', { class: 'lr-title' }, l.title),
    done ? stars(P.starsOf(l.id)) : unlocked ? h('span', { class: 'lr-new' }, 'Start') : null,
  ];
  return h('li', {}, unlocked
    ? h('a', { class: 'lesson-row' + (done ? ' done' : ''), href: `#/lesson/${l.id}` }, ...inner)
    : h('div', { class: 'lesson-row locked', 'aria-disabled': 'true' }, ...inner));
}

// ---------- Lesson ----------
function lesson(id) {
  const l = LESSON_BY_ID[id];
  if (!l) { location.hash = '#/plan'; return; }
  setHeader(l.unitTitle, true);
  setTab('plan');
  if (!P.isUnlocked(id)) {
    main.append(h('div', { class: 'card center' },
      h('p', { class: 'big-emoji' }, '🔒'),
      h('p', {}, 'Finish the earlier lessons to unlock this one.'),
      h('a', { class: 'btn primary', href: '#/plan' }, 'Back to the lesson plan')));
    return;
  }
  let best = 0;
  const bump = (score) => { best = Math.max(best, score); P.recordScore(id, score); };
  if (l.type === 'tune') tuneLesson(l, bump);
  else if (l.type === 'chord') chordLesson(l, bump);
  else if (l.type === 'strum') strumLesson(l, bump);
  else songLesson(l, bump);
  main.append(finishBox(l, () => best));
}

function step(n, title, ...body) {
  return h('section', { class: 'card step' },
    h('h2', {}, h('span', { class: 'step-n' }, String(n)), title),
    ...body);
}

function finishBox(l, getBest) {
  const next = LESSONS[l.index + 1];
  const box = h('section', { class: 'finish' });
  const draw = () => {
    box.replaceChildren();
    if (P.isDone(l.id)) {
      box.append(h('p', {}, 'Lesson complete ', stars(P.starsOf(l.id))));
      if (next) box.append(h('a', { class: 'btn primary wide', href: `#/lesson/${next.id}` }, `Next: ${next.title} ›`));
      box.append(h('button', { class: 'btn wide', onClick: complete }, 'Update my stars'));
    } else {
      box.append(h('button', { class: 'btn primary wide', onClick: complete }, '✓ Complete lesson'));
      box.append(h('p', { class: 'small-print' }, 'Stars come from your best coach score in this lesson.'));
    }
  };
  function complete() {
    const score = Math.max(getBest(), P.bestScore(l.id));
    const st = l.type === 'tune' ? (score ? 3 : 1) : Math.max(1, starsFor(score));
    const firstTime = !P.isDone(l.id);
    P.completeLesson(l.id, st);
    if (firstTime) toast(`🐸 Lesson complete! ${'★'.repeat(st)}`);
    draw();
    setHeader(l.unitTitle, true);
  }
  draw();
  return box;
}

function tuneLesson(l, bump) {
  main.append(h('h1', { class: 'lesson-title' }, '🎯 Tune your ukulele'));
  const tuner = createTuner({ onAllTuned: () => bump(100) });
  cleanup.push(tuner.destroy);
  main.append(
    step(1, 'Know your strings',
      h('p', {}, 'Hold the uke with the neck to your left. From the top string (closest to your face) to the bottom: G, C, E, A. Remember it as "Good Cats Eat Anchovies".'),
      h('p', {}, 'The G string is thinner and higher than the C. That\'s normal and gives the uke its bright sound.')),
    step(2, 'Tune each string', h('p', {}, 'Tap Start, pluck one string at a time, and turn its peg until the needle sits in the middle and goes green.'), tuner.el));
}

function chordLesson(l, bump) {
  const c = CHORDS[l.chord];
  main.append(h('h1', { class: 'lesson-title' }, `✋ ${c.name}`, h('span', { class: 'lesson-sub' }, c.full)));
  const hear = h('div', { class: 'btn-row' },
    h('button', { class: 'btn', onClick: async () => { await unlockAudio(); strum(c.name, now() + 0.05, 'D', 0.6); } }, '🔊 Hear the chord'),
    h('button', { class: 'btn', onClick: async () => { await unlockAudio(); playArpeggio(c.name, now() + 0.05); } }, '🎶 One string at a time'));
  main.append(step(1, 'Learn the shape',
    h('div', { class: 'learn-row' },
      chordDiagram(c.name, { size: 'lg' }),
      h('ul', { class: 'tips' }, ...c.tips.map((t) => h('li', {}, t)))),
    h('p', { class: 'small-print' }, 'Numbers are fingers: 1 index, 2 middle, 3 ring, 4 pinky. ○ means play the string open.'),
    hear));

  const check = createChordCheck(c.name, { onResult: bump });
  cleanup.push(check.destroy);
  main.append(step(2, 'Check it with the coach',
    h('p', {}, 'Strum the chord once and I\'ll tell you which strings are ringing clearly.'),
    check.el));

  const prev = l.prevChord;
  const bars = prev
    ? [c.name, prev, c.name, prev, c.name, prev, c.name, c.name].map((x) => ({ c: x }))
    : [{ c: c.name }, { c: c.name }, { c: c.name }, { c: c.name }];
  const player = createPlayer({ id: l.id + '-drill', bars, pattern: STRUMS.down4.pattern, beats: 4, bpm: 60, minBpm: 40, maxBpm: 110, analyseChords: true });
  cleanup.push(player.destroy);
  main.append(step(3, prev ? `Practise changing ${prev} ↔ ${c.name}` : 'Strum along with Freddie',
    h('p', {}, prev
      ? `Swap between ${prev} and ${c.name} every bar. Look for fingers that can stay put or slide.`
      : 'Four steady down strums per bar. Strum each time the frog lands.'),
    player.el));
}

function strumLesson(l, bump) {
  const s = STRUMS[l.strum];
  const chord = l.practiceChord || 'C';
  main.append(h('h1', { class: 'lesson-title' }, `🌊 ${s.name}`));
  main.append(step(1, 'The pattern',
    h('p', {}, s.desc),
    patternView(s.pattern, s.beats),
    h('ul', { class: 'tips' }, ...s.tips.map((t) => h('li', {}, t)))));
  const player = createPlayer({
    id: l.id, bars: Array.from({ length: 4 }, () => ({ c: chord })), pattern: s.pattern, beats: s.beats,
    bpm: s.bpm, minBpm: 40, maxBpm: 140, analyseChords: false, onResult: bump,
  });
  cleanup.push(player.destroy);
  main.append(step(2, `Strum along on ${chord}`,
    h('p', {}, 'Hold the chord and follow Freddie. Big pads are down strums, small pads are up strums.'),
    player.el));
}

function songLesson(l, bump) {
  const song = SONGS[l.song];
  const strumDef = STRUMS[song.strum];
  const used = songChords(song);
  main.append(h('h1', { class: 'lesson-title' }, `🎵 ${song.title}`), h('p', { class: 'intro' }, song.blurb));
  main.append(step(1, 'Get ready',
    h('p', {}, 'Chords in this song:'),
    h('div', { class: 'chord-row' }, ...used.map((c) => chordDiagram(c, { size: 'sm' }))),
    h('p', {}, `Strum: ${strumDef.name} · ${song.beats}/4 time · ${song.bpm} BPM`),
    patternView(strumDef.pattern, strumDef.beats)));
  const player = createPlayer({
    id: l.id, bars: song.bars, pattern: strumDef.pattern, beats: song.beats, bpm: song.bpm,
    minBpm: 40, maxBpm: song.bpm + 40, lyrics: true, onResult: bump,
  });
  cleanup.push(player.destroy);
  main.append(step(2, 'Play the song',
    h('p', {}, 'Start with "Play along" to hear it. Slow it down if the changes are tricky, then use "Listen & coach" for feedback.'),
    player.el));
}

// ---------- Chord book ----------
function chords() {
  setHeader('Chord Book');
  setTab('plan');
  main.append(h('p', { class: 'intro' }, 'Tap a chord you\'ve unlocked to practise it.'));
  const grid = h('div', { class: 'chord-grid' });
  LESSONS.filter((l) => l.type === 'chord').forEach((l) => {
    const unlocked = P.isUnlocked(l.id);
    const card = h(unlocked ? 'a' : 'div', { class: 'chord-card' + (unlocked ? '' : ' locked'), href: unlocked ? `#/lesson/${l.id}` : null },
      chordDiagram(l.chord, { size: 'sm' }),
      h('div', { class: 'cc-meta' }, unlocked ? (P.isDone(l.id) ? stars(P.starsOf(l.id)) : 'New') : `🔒 ${l.unitTitle}`));
    grid.append(card);
  });
  main.append(grid);
}

// ---------- Song book ----------
function songs() {
  setHeader('Song Book');
  setTab('plan');
  main.append(h('p', { class: 'intro' }, 'Songs unlock as you learn their chords. They get harder as you go.'));
  main.append(h('ol', { class: 'lesson-list' }, ...LESSONS.filter((l) => l.type === 'song').map((l) => {
    const song = SONGS[l.song];
    const unlocked = P.isUnlocked(l.id);
    const inner = [
      h('span', { class: 'lr-icon' }, unlocked ? '🎵' : '🔒'),
      h('span', { class: 'lr-title' }, song.title, h('small', {}, `${songChords(song).join(' ')} · ${STRUMS[song.strum].name}`)),
      P.isDone(l.id) ? stars(P.starsOf(l.id)) : null,
    ];
    return h('li', {}, unlocked ? h('a', { class: 'lesson-row', href: `#/lesson/${l.id}` }, ...inner) : h('div', { class: 'lesson-row locked' }, ...inner));
  })));
}

// ---------- Tools ----------
function tuner() {
  setHeader('Tuner');
  setTab('tuner');
  const t = createTuner();
  cleanup.push(t.destroy);
  main.append(h('section', { class: 'card' }, t.el));
}

function metronome() {
  setHeader('Metronome');
  setTab('metronome');
  const m = createMetronome();
  cleanup.push(m.destroy);
  main.append(h('section', { class: 'card' }, m.el));
}

// ---------- Progress ----------
function progress() {
  setHeader('My Progress');
  setTab('progress');
  const st = P.stats();
  main.append(
    h('div', { class: 'stat-row' },
      stat('📚', st.done, `of ${st.total} lessons`),
      stat('⭐', st.stars, 'stars'),
      stat('🔥', st.streak, 'day streak'),
      stat('📅', st.days, 'practice days')),
    h('h2', { class: 'section-title' }, 'Badges'),
    h('div', { class: 'badge-grid' }, ...BADGES.map((b) => h('div', { class: 'badge' + (P.hasBadge(b.id) ? ' on' : '') },
      h('div', { class: 'badge-icon' }, b.icon),
      h('div', { class: 'badge-name' }, b.name),
      h('div', { class: 'badge-desc' }, b.desc)))),
    h('a', { class: 'btn wide', href: '#/settings' }, '⚙️ Settings & help'));
}

function micSensitivityCard() {
  let level = P.getSetting('micSensitivity') ?? 6;
  const val = h('span', { class: 'tempo-val' }, String(level));
  const slider = h('input', {
    type: 'range', id: 'mic-sens', min: 1, max: 10, step: 1, value: level, 'aria-label': 'Mic sensitivity',
    onInput: (e) => {
      level = +e.target.value;
      val.textContent = String(level);
      P.setSetting('micSensitivity', level);
      setMicSensitivity(level);
    },
  });
  const test = createMicTest();
  cleanup.push(test.destroy);
  return h('section', { class: 'card' },
    h('h2', {}, 'Mic sensitivity'),
    h('p', {}, 'If the coach misses strums, turn this up. If it hears strums when you aren\'t playing, turn it down.'),
    h('div', { class: 'tempo-row' },
      h('span', { class: 'small-print' }, 'Low'),
      h('div', { class: 'tempo-mid' }, val, slider),
      h('span', { class: 'small-print' }, 'High')),
    test.el);
}

function stat(icon, n, label) {
  return h('div', { class: 'stat' }, h('div', { class: 'stat-icon' }, icon), h('div', { class: 'stat-n' }, String(n)), h('div', { class: 'stat-label' }, label));
}

// ---------- Settings ----------
function settings() {
  setHeader('Settings', true);
  setTab('progress');
  const calStatus = h('p', { class: 'player-status' }, P.getSetting('latency') != null
    ? `Current audio delay: ${Math.round(P.getSetting('latency') * 1000)} ms`
    : 'Not calibrated yet. Using an estimate.');
  const clickToggle = h('input', { type: 'checkbox', id: 'clk', checked: P.getSetting('clickWhileListening') || null,
    onChange: (e) => P.setSetting('clickWhileListening', e.target.checked) });
  main.append(
    h('section', { class: 'card' },
      h('h2', {}, 'Getting good feedback'),
      h('ul', { class: 'tips' },
        h('li', {}, 'Prop the phone up about half a metre from the uke, microphone facing you.'),
        h('li', {}, 'Play somewhere quiet. TV and chatter confuse the coach.'),
        h('li', {}, 'The coach checks timing, speed, steadiness, volume and whether each note rings. It\'s a helper, not a judge, so trust your ears too.'))),
    micSensitivityCard(),
    h('section', { class: 'card' },
      h('h2', {}, 'Timing calibration'),
      h('p', {}, 'Phones add a small delay between sound and microphone. Calibrate once so timing feedback is fair. Unplug headphones and turn the volume up.'),
      h('button', { class: 'btn accent', onClick: async (e) => {
        e.target.disabled = true;
        try { await calibrateLatency(calStatus); } catch (err) { calStatus.textContent = 'Microphone access is needed to calibrate.'; }
        e.target.disabled = false;
      } }, '🎚️ Calibrate'),
      calStatus),
    h('section', { class: 'card' },
      h('h2', {}, 'Click while coaching'),
      h('label', { class: 'toggle', for: 'clk' }, clickToggle, ' Play the metronome click while the coach listens'),
      h('p', { class: 'small-print' }, 'Only turn this on with headphones, or the coach will hear the click instead of you.')),
    h('section', { class: 'card' },
      h('h2', {}, 'Start over'),
      h('button', { class: 'btn danger', onClick: (e) => {
        const b = e.currentTarget;
        if (b.dataset.armed) { P.resetAll(); location.hash = '#/'; return; }
        b.dataset.armed = '1';
        b.textContent = 'Tap again to erase all lessons, stars and badges';
      } }, 'Reset my progress')),
    h('p', { class: 'small-print center' }, 'Uke Frog · lyrics are shown only for traditional and public-domain songs.'));
}

render();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
