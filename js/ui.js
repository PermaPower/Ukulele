// Small DOM helpers and the chord diagram renderer.
import { CHORDS } from './data.js';

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function stars(n, max = 3) {
  return h('span', { class: 'stars', 'aria-label': `${n} of ${max} stars` },
    ...Array.from({ length: max }, (_, i) => h('span', { class: i < n ? 'star on' : 'star' }, '★')));
}

let toastTimer = null;
export function toast(html, ms = 3200) {
  let t = document.getElementById('toast');
  if (!t) {
    t = h('div', { id: 'toast', role: 'status' });
    document.body.append(t);
  }
  t.innerHTML = html;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}

// status per string: 'ok' | 'quiet' | 'open' | undefined
export function chordDiagram(name, { size = 'md', status = null } = {}) {
  const c = CHORDS[name];
  const sx = (i) => 22 + i * 24;
  const fy = (f) => 34 + f * 22;
  const parts = [];
  parts.push(`<text x="58" y="14" class="cd-title">${name}</text>`);
  // Frets and nut.
  for (let f = 0; f <= 5; f++) {
    parts.push(`<line x1="${sx(0)}" y1="${fy(f)}" x2="${sx(3)}" y2="${fy(f)}" class="${f === 0 ? 'cd-nut' : 'cd-fret'}"/>`);
  }
  for (let i = 0; i < 4; i++) {
    parts.push(`<line x1="${sx(i)}" y1="${fy(0)}" x2="${sx(i)}" y2="${fy(5)}" class="cd-string"/>`);
    parts.push(`<text x="${sx(i)}" y="${fy(5) + 15}" class="cd-label">${'GCEA'[i]}</text>`);
  }
  c.frets.forEach((f, i) => {
    const st = status?.[i];
    const cls = st ? ` st-${st}` : '';
    if (f === 0) {
      parts.push(`<circle cx="${sx(i)}" cy="${fy(0) - 9}" r="5" class="cd-open${cls}"/>`);
    } else {
      parts.push(`<circle cx="${sx(i)}" cy="${fy(f) - 11}" r="9" class="cd-dot${cls}"/>`);
      parts.push(`<text x="${sx(i)}" y="${fy(f) - 7}" class="cd-finger">${c.fingers[i]}</text>`);
    }
  });
  const svg = `<svg viewBox="0 0 116 164" class="chord-diagram cd-${size}" role="img" aria-label="${c.full} chord diagram">${parts.join('')}</svg>`;
  return h('div', { class: 'chord-box', html: svg });
}

export function feedbackList(items) {
  const icon = { good: '✅', tip: '💡', warn: '⚠️' };
  return h('ul', { class: 'feedback' },
    ...items.map((i) => h('li', { class: 'fb-' + i.kind }, h('span', { class: 'fb-icon' }, icon[i.kind]), h('span', {}, i.text))));
}

export function patternView(pattern, beats) {
  const count = [];
  for (let b = 0; b < beats; b++) count.push(String(b + 1), '&');
  return h('div', { class: 'pattern' },
    ...pattern.split('').map((p, i) => h('div', { class: 'pat-cell' + (p === '.' ? ' rest' : '') },
      h('div', { class: 'pat-arrow' }, p === 'D' ? '↓' : p === 'U' ? '↑' : p === 'X' ? '✕' : '·'),
      h('div', { class: 'pat-count' }, count[i]))));
}
