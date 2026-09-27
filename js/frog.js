// Freddie the frog hops along the ukulele strings, landing on a lily pad
// for every strum. Pads scroll in from the right; chord names float above.

const TAU = Math.PI * 2;

export class FrogStage {
  constructor(canvas, { clock } = {}) {
    this.canvas = canvas;
    this.g = canvas.getContext('2d');
    this.clock = clock;
    this.timeline = null;
    this.particles = [];
    this.message = '';
    this.running = false;
    this.lastLand = -10;
    this.blinkAt = 0;
    this.resize = this.resize.bind(this);
    this.frame = this.frame.bind(this);
    window.addEventListener('resize', this.resize);
    this.resize();
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = this.canvas.clientWidth || 320;
    const h = this.canvas.clientHeight || 200;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.W = w;
    this.H = h;
    this.dpr = dpr;
    const cs = getComputedStyle(this.canvas);
    const v = (n, d) => cs.getPropertyValue(n).trim() || d;
    this.colors = {
      sky1: v('--stage-sky1', '#bfe9ff'),
      sky2: v('--stage-sky2', '#e9f9ff'),
      water: v('--stage-water', '#8fd3e8'),
      string: v('--stage-string', '#6b4b2a'),
      text: v('--stage-text', '#123'),
      label: v('--stage-label', '#ffffff'),
      labelBg: v('--stage-label-bg', '#ff7a59'),
    };
  }

  setTimeline(tl) {
    this.timeline = tl;
  }

  setMessage(m) {
    this.message = m;
  }

  start() {
    if (this.running) return;
    this.running = true;
    requestAnimationFrame(this.frame);
  }

  stop() {
    this.running = false;
  }

  destroy() {
    this.stop();
    window.removeEventListener('resize', this.resize);
  }

  sparkle(kind = 'good') {
    const colors = kind === 'good' ? ['#4ade80', '#facc15', '#60a5fa'] : ['#fb923c', '#f87171'];
    const x = this.hitX;
    const y = this.stringsTop - 20;
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * TAU;
      const sp = 40 + Math.random() * 90;
      this.particles.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60,
        life: 0.7, age: 0, c: colors[i % colors.length], r: 2 + Math.random() * 3,
      });
    }
  }

  frame(ts) {
    if (!this.running) return;
    const dt = this.prevTs ? Math.min(0.05, (ts - this.prevTs) / 1000) : 0.016;
    this.prevTs = ts;
    this.draw(this.clock ? this.clock() : ts / 1000, dt);
    requestAnimationFrame(this.frame);
  }

  draw(now, dt) {
    const { g, W, H, dpr, colors } = this;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Background: sky fading to a pond.
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, colors.sky1);
    bg.addColorStop(0.7, colors.sky2);
    bg.addColorStop(1, colors.water);
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);

    this.hitX = Math.max(70, W * 0.26);
    this.stringsTop = H * 0.62;
    const gap = 11;
    const tl = this.timeline;
    const beatDur = tl ? tl.beatDur : 0.75;
    const pxPerBeat = Math.max(64, Math.min(120, W / 5));
    const pps = pxPerBeat / beatDur;
    const xAt = (t) => this.hitX + (t - now) * pps;
    const tMin = now - this.hitX / pps;
    const tMax = now + (W - this.hitX) / pps;

    // Hit line.
    g.strokeStyle = 'rgba(0,0,0,0.12)';
    g.lineWidth = 2;
    g.setLineDash([4, 5]);
    g.beginPath();
    g.moveTo(this.hitX, 44);
    g.lineTo(this.hitX, H - 6);
    g.stroke();
    g.setLineDash([]);

    // Chord labels and bar lines.
    if (tl) {
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      for (const lab of tl.labelsBetween(tMin - 1, tMax)) {
        const x = xAt(lab.t);
        if (lab.barStart) {
          g.strokeStyle = 'rgba(0,0,0,0.18)';
          g.lineWidth = 1;
          g.beginPath();
          g.moveTo(x, this.stringsTop - 6);
          g.lineTo(x, this.stringsTop + gap * 3 + 6);
          g.stroke();
        }
        if (lab.change || lab.barStart) {
          const past = lab.t < now;
          g.globalAlpha = past ? 0.35 : lab.change ? 1 : 0.55;
          g.font = '700 16px system-ui, sans-serif';
          const w = g.measureText(lab.chord).width + 18;
          g.fillStyle = colors.labelBg;
          roundRect(g, x - w / 2 + w / 2 - 9, 16, w, 26, 13);
          g.fill();
          g.fillStyle = colors.label;
          g.fillText(lab.chord, x + w / 2 - 9, 29);
          g.globalAlpha = 1;
        }
      }
    }

    // Strings, wobbling after each landing.
    const wob = 5 * Math.exp(-(now - this.lastLand) * 9);
    const names = ['G', 'C', 'E', 'A'];
    for (let i = 0; i < 4; i++) {
      const y = this.stringsTop + i * gap;
      g.strokeStyle = colors.string;
      g.lineWidth = 1.2 + (3 - i) * 0.35;
      g.beginPath();
      for (let x = 22; x <= W; x += 6) {
        const bell = Math.exp(-(((x - this.hitX) / 90) ** 2));
        const yy = y + wob * bell * Math.sin(x * 0.12 + now * 70 + i);
        if (x === 22) g.moveTo(x, yy);
        else g.lineTo(x, yy);
      }
      g.stroke();
      g.fillStyle = colors.text;
      g.font = '600 10px system-ui, sans-serif';
      g.textAlign = 'center';
      g.fillText(names[i], 11, y + 1);
    }

    // Lily pads.
    let prevHop = null;
    let nextHop = null;
    if (tl) {
      const hops = tl.hopsBetween(Math.min(tMin, now - 3), Math.max(tMax, now + 3));
      for (const e of hops) {
        if (e.t <= now) prevHop = e;
        else if (!nextHop) nextHop = e;
        const x = xAt(e.t);
        if (x < -30 || x > W + 30) continue;
        this.drawPad(x, this.stringsTop - 2, e, e.t < now - 0.05);
      }
    }

    // Frog position.
    let hopH = 0;
    let squash = 1;
    let airborne = false;
    if (prevHop && nextHop) {
      const span = nextHop.t - prevHop.t;
      const p = (now - prevHop.t) / span;
      const maxH = Math.max(16, Math.min(64, span * 110));
      hopH = 4 * p * (1 - p) * maxH;
      airborne = p > 0.08 && p < 0.92;
      if (p < 0.1) squash = 0.82 + p * 1.8;
      if (prevHop.t > this.lastLand) {
        this.lastLand = prevHop.t;
      }
    } else if (!tl || !prevHop) {
      // Idle breathing.
      hopH = 0;
      squash = 1 + Math.sin(now * 3) * 0.03;
    }
    this.drawFrog(this.hitX, this.stringsTop - 8 - hopH, squash, airborne, now);

    // Particles.
    this.particles = this.particles.filter((p) => (p.age += dt) < p.life);
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 220 * dt;
      g.globalAlpha = 1 - p.age / p.life;
      g.fillStyle = p.c;
      g.beginPath();
      g.arc(p.x, p.y, p.r, 0, TAU);
      g.fill();
    }
    g.globalAlpha = 1;

    // Count-in / messages.
    let msg = this.message;
    if (tl && now < tl.songStart && now >= tl.start - 0.05) {
      const left = Math.ceil((tl.songStart - now) / tl.beatDur);
      msg = left > 0 ? String(left) : '';
    }
    if (msg) {
      g.font = '800 34px system-ui, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.lineWidth = 5;
      g.strokeStyle = 'rgba(255,255,255,0.9)';
      g.strokeText(msg, W * 0.62, H * 0.33);
      g.fillStyle = colors.text;
      g.fillText(msg, W * 0.62, H * 0.33);
    }
  }

  drawPad(x, y, e, past) {
    const g = this.g;
    const big = e.type === 'D' || e.kind === 'count';
    const r = big ? 15 : 11;
    g.globalAlpha = past ? 0.35 : 1;
    if (e.type === 'X') {
      g.fillStyle = '#b45309';
      g.beginPath();
      g.arc(x, y - 4, 12, 0, TAU);
      g.fill();
      g.strokeStyle = '#fff';
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(x - 5, y - 9); g.lineTo(x + 5, y + 1);
      g.moveTo(x + 5, y - 9); g.lineTo(x - 5, y + 1);
      g.stroke();
    } else {
      // Lily pad with a notch.
      g.fillStyle = e.kind === 'count' ? '#94a3b8' : big ? '#22a55a' : '#6fd08e';
      g.beginPath();
      g.ellipse(x, y - 3, r, r * 0.55, 0, 0.25, TAU - 0.25);
      g.lineTo(x, y - 3);
      g.closePath();
      g.fill();
      if (e.kind === 'strum') {
        g.fillStyle = '#fff';
        g.font = `800 ${big ? 13 : 11}px system-ui, sans-serif`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(e.type === 'D' ? '↓' : '↑', x, y - 3);
      }
    }
    g.globalAlpha = 1;
  }

  drawFrog(x, y, squash, airborne, now) {
    const g = this.g;
    g.save();
    g.translate(x, y);
    g.scale(1 / Math.sqrt(squash), squash);
    const body = '#3fbf5f';
    const dark = '#2a8f45';
    const belly = '#c9f5b5';

    // Back legs.
    g.fillStyle = dark;
    if (airborne) {
      g.beginPath(); g.ellipse(-14, 4, 5, 12, 0.9, 0, TAU); g.fill();
      g.beginPath(); g.ellipse(14, 4, 5, 12, -0.9, 0, TAU); g.fill();
    } else {
      g.beginPath(); g.ellipse(-15, -2, 8, 6, 0, 0, TAU); g.fill();
      g.beginPath(); g.ellipse(15, -2, 8, 6, 0, 0, TAU); g.fill();
    }
    // Body.
    g.fillStyle = body;
    g.beginPath(); g.ellipse(0, -12, 18, 14, 0, 0, TAU); g.fill();
    g.fillStyle = belly;
    g.beginPath(); g.ellipse(0, -7, 11, 8, 0, 0, TAU); g.fill();
    // Eyes.
    const blink = (now % 4) < 0.12;
    for (const ex of [-9, 9]) {
      g.fillStyle = body;
      g.beginPath(); g.arc(ex, -25, 7, 0, TAU); g.fill();
      g.fillStyle = '#fff';
      if (blink) {
        g.fillRect(ex - 4, -25, 8, 1.5);
      } else {
        g.beginPath(); g.arc(ex, -25, 4.8, 0, TAU); g.fill();
        g.fillStyle = '#111';
        g.beginPath(); g.arc(ex + 1.2, -24.5, 2.3, 0, TAU); g.fill();
      }
    }
    // Smile and cheeks.
    g.strokeStyle = '#14532d';
    g.lineWidth = 1.6;
    g.beginPath(); g.arc(0, -14, 7, 0.2, Math.PI - 0.2); g.stroke();
    g.fillStyle = 'rgba(255,120,120,0.55)';
    g.beginPath(); g.arc(-11, -13, 2.6, 0, TAU); g.fill();
    g.beginPath(); g.arc(11, -13, 2.6, 0, TAU); g.fill();
    g.restore();

    // Shadow.
    const lift = this.stringsTop - 8 - y;
    g.fillStyle = 'rgba(0,0,0,0.12)';
    g.beginPath();
    g.ellipse(x, this.stringsTop - 2, Math.max(6, 16 - lift * 0.15), 3, 0, 0, TAU);
    g.fill();
  }
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}
