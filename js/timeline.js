// A timeline turns bars + a strum pattern + tempo into timed events.
// Slots are eighth notes. Negative slots are the count-in.

export class Timeline {
  constructor({ bars, pattern, beats, bpm, start, countInBars = 1, loop = false }) {
    this.bars = bars;
    this.pattern = pattern;
    this.beats = beats;
    this.bpm = bpm;
    this.loop = loop;
    this.slotDur = 30 / bpm;
    this.beatDur = 60 / bpm;
    this.slotsPerBar = beats * 2;
    this.barDur = beats * this.beatDur;
    this.countInSlots = countInBars * this.slotsPerBar;
    this.songStart = start + countInBars * this.barDur;
    this.start = start;
    this.totalSlots = loop ? Infinity : bars.length * this.slotsPerBar;
    this.end = loop ? Infinity : this.songStart + this.totalSlots * this.slotDur;
  }

  slotTime(s) {
    return this.songStart + s * this.slotDur;
  }

  barAt(s) {
    const b = Math.floor(s / this.slotsPerBar);
    return this.loop ? b % this.bars.length : b;
  }

  chordAtSlot(s) {
    const bar = this.bars[this.barAt(s)];
    if (!bar) return null;
    const cs = [].concat(bar.c);
    const within = ((s % this.slotsPerBar) + this.slotsPerBar) % this.slotsPerBar;
    return cs[Math.floor(within / (this.slotsPerBar / cs.length))];
  }

  // Events for one slot.
  eventsAt(s) {
    const t = this.slotTime(s);
    const out = [];
    if (s < 0) {
      if (s >= -this.countInSlots && s % 2 === 0) {
        const beatInBar = ((s + this.countInSlots) / 2) % this.beats;
        out.push({ kind: 'count', t, accent: beatInBar === 0, n: this.beats - beatInBar });
      }
      return out;
    }
    if (s >= this.totalSlots) {
      if (s === this.totalSlots) out.push({ kind: 'end', t });
      return out;
    }
    const within = s % this.slotsPerBar;
    const bar = this.barAt(s);
    if (within % 2 === 0) out.push({ kind: 'beat', t, accent: within === 0, bar, beat: within / 2 });
    const p = (this.bars[bar]?.p || this.pattern)[within];
    if (p && p !== '.') out.push({ kind: 'strum', t, type: p, chord: this.chordAtSlot(s), bar, slot: s });
    return out;
  }

  eventsBetween(t0, t1) {
    const s0 = Math.max(-this.countInSlots, Math.ceil((t0 - this.songStart) / this.slotDur - 1e-9));
    const s1 = Math.ceil((t1 - this.songStart) / this.slotDur - 1e-9);
    const out = [];
    for (let s = s0; s < s1; s++) {
      if (!this.loop && s > this.totalSlots) break;
      for (const e of this.eventsAt(s)) if (e.t >= t0 && e.t < t1) out.push(e);
    }
    return out;
  }

  // Points the frog lands on: strums and count-in beats.
  hopsBetween(t0, t1) {
    return this.eventsBetween(t0, t1).filter((e) => e.kind === 'strum' || e.kind === 'count');
  }

  // Chord-change markers.
  labelsBetween(t0, t1) {
    const out = [];
    const s0 = Math.max(0, Math.ceil((t0 - this.songStart) / this.slotDur));
    const s1 = Math.ceil((t1 - this.songStart) / this.slotDur);
    for (let s = s0; s < s1 && s < this.totalSlots; s++) {
      const c = this.chordAtSlot(s);
      if (!c) continue;
      const prev = s === 0 ? null : this.chordAtSlot(s - 1);
      const barStart = s % this.slotsPerBar === 0;
      if (c !== prev || barStart) out.push({ t: this.slotTime(s), chord: c, change: c !== prev, barStart });
    }
    return out;
  }

  // Strum events for analysis (finite timelines only).
  allStrums() {
    return this.eventsBetween(this.songStart, this.end).filter((e) => e.kind === 'strum');
  }

  // Chord spans for analysis.
  segments() {
    const segs = [];
    this.bars.forEach((bar, b) => {
      const cs = [].concat(bar.c);
      const d = this.barDur / cs.length;
      cs.forEach((chord, k) => {
        const t0 = this.songStart + b * this.barDur + k * d;
        segs.push({ chord, bar: b, t0, t1: t0 + d });
      });
    });
    return segs;
  }

  positionAt(t) {
    if (t < this.songStart) return { counting: true, bar: -1, slot: -1 };
    const s = Math.floor((t - this.songStart) / this.slotDur);
    return { counting: false, bar: this.barAt(s), slot: s, chord: this.chordAtSlot(s) };
  }
}
