// Progress, streaks, badges and settings, saved on the device.
import { LESSONS, BADGES } from './data.js';

const KEY = 'ukefrog.v1';

function blank() {
  return { done: {}, days: [], badges: {}, best: {}, settings: { latency: null, clickWhileListening: false } };
}

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...blank(), ...JSON.parse(raw) };
  } catch (e) { /* storage unavailable */ }
  return blank();
}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
}

const listeners = new Set();
export function onBadge(fn) { listeners.add(fn); }

function today(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function markPractice() {
  const t = today();
  if (!state.days.includes(t)) {
    state.days.push(t);
    if (state.days.length > 400) state.days.shift();
  }
  checkBadges();
  save();
}

export function streak() {
  const set = new Set(state.days);
  let n = 0;
  let off = set.has(today()) ? 0 : -1;
  while (set.has(today(off))) { n++; off--; }
  return n;
}

export function isDone(id) { return !!state.done[id]; }
export function starsOf(id) { return state.done[id]?.stars || 0; }
export function bestScore(id) { return state.best[id] || 0; }

export function recordScore(id, score) {
  state.best[id] = Math.max(state.best[id] || 0, score);
  save();
}

export function completeLesson(id, stars) {
  const prev = state.done[id];
  state.done[id] = { stars: Math.max(prev?.stars || 0, stars), at: Date.now() };
  markPractice();
}

export function isUnlocked(id) {
  const l = LESSONS.find((x) => x.id === id);
  if (!l) return false;
  if (l.index === 0 || l.alwaysOpen) return true;
  return isDone(LESSONS[l.index - 1].id);
}

export function nextLesson() {
  return LESSONS.find((l) => !isDone(l.id)) || null;
}

export function earn(id) {
  if (state.badges[id]) return;
  state.badges[id] = Date.now();
  save();
  const b = BADGES.find((x) => x.id === id);
  if (b) listeners.forEach((fn) => fn(b));
}

export function hasBadge(id) { return !!state.badges[id]; }

function checkBadges() {
  const doneOf = (type) => LESSONS.filter((l) => l.type === type && isDone(l.id)).length;
  const total = (type) => LESSONS.filter((l) => l.type === type).length;
  const chords = doneOf('chord');
  const songs = doneOf('song');
  const strums = doneOf('strum');
  if (chords >= 1) earn('first-chord');
  if (chords >= 5) earn('five-chords');
  if (chords >= total('chord')) earn('all-chords');
  if (strums >= 1) earn('first-strum');
  if (strums >= total('strum')) earn('all-strums');
  if (songs >= 1) earn('first-song');
  if (songs >= 5) earn('five-songs');
  if (songs >= total('song')) earn('all-songs');
  if (Object.values(state.done).some((d) => d.stars >= 3)) earn('three-stars');
  const s = streak();
  if (s >= 3) earn('streak-3');
  if (s >= 7) earn('streak-7');
}

export function stats() {
  return {
    done: Object.keys(state.done).length,
    total: LESSONS.length,
    stars: Object.values(state.done).reduce((a, d) => a + d.stars, 0),
    streak: streak(),
    days: state.days.length,
  };
}

export function getSetting(k) { return state.settings[k]; }
export function setSetting(k, v) { state.settings[k] = v; save(); }

export function resetAll() {
  state = blank();
  save();
}
