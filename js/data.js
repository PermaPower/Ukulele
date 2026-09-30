// Curriculum data: chords, strum patterns, songs and the lesson plan.
// Standard re-entrant tuning, strings listed G C E A (4th to 1st).

export const STRINGS = [
  { name: 'G', freq: 392.0 },
  { name: 'C', freq: 261.63 },
  { name: 'E', freq: 329.63 },
  { name: 'A', freq: 440.0 },
];

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const OPEN_PC = [7, 0, 4, 9]; // pitch classes of open G C E A

export function noteName(pc) {
  return NOTE_NAMES[((pc % 12) + 12) % 12];
}

// frets: per string G C E A. fingers: 1 index, 2 middle, 3 ring, 4 pinky, 0 open.
export const CHORDS = {
  C: {
    name: 'C', full: 'C major', frets: [0, 0, 0, 3], fingers: [0, 0, 0, 3],
    tips: [
      'Only one finger: your ring finger on the 3rd fret of the A string (the one nearest the floor).',
      'Arch the finger so the tip comes straight down. Keep it off the E string.',
      'The other three strings ring open.',
    ],
  },
  G7: {
    name: 'G7', full: 'G dominant 7th', frets: [0, 2, 1, 2], fingers: [0, 2, 1, 3],
    tips: [
      'Index on the 1st fret of the E string, middle on the 2nd fret of the C string, ring on the 2nd fret of the A string.',
      'It makes a small triangle shape. The G string rings open.',
      'Going from C to G7? Your ring finger slides from fret 3 down to fret 2 on the same string.',
    ],
  },
  F: {
    name: 'F', full: 'F major', frets: [2, 0, 1, 0], fingers: [2, 0, 1, 0],
    tips: [
      'Index on the 1st fret of the E string, middle on the 2nd fret of the G string.',
      'Keep your index finger arched so the open C and A strings can ring.',
      'Common problem: the index finger leans on the A string and mutes it.',
    ],
  },
  G: {
    name: 'G', full: 'G major', frets: [0, 2, 3, 2], fingers: [0, 1, 3, 2],
    tips: [
      'Index on the 2nd fret of the C string, middle on the 2nd fret of the A string, ring on the 3rd fret of the E string.',
      'It looks like a little triangle pointing towards the body of the uke.',
      'Keep your thumb behind the neck, roughly behind your middle finger.',
    ],
  },
  Am: {
    name: 'Am', full: 'A minor', frets: [2, 0, 0, 0], fingers: [2, 0, 0, 0],
    tips: [
      'Middle finger on the 2nd fret of the G string. That\'s it.',
      'Pairs well with C: switching is quick and it sounds great.',
      'Minor chords sound a little sad or moody compared with major ones.',
    ],
  },
  Dm: {
    name: 'Dm', full: 'D minor', frets: [2, 2, 1, 0], fingers: [2, 3, 1, 0],
    tips: [
      'Index on the 1st fret of the E string, middle on the 2nd fret of the G string, ring on the 2nd fret of the C string.',
      'This is an F chord plus your ring finger.',
      'Make sure the A string still rings open.',
    ],
  },
  Em: {
    name: 'Em', full: 'E minor', frets: [0, 4, 3, 2], fingers: [0, 3, 2, 1],
    tips: [
      'Index on the 2nd fret of the A string, middle on the 3rd fret of the E string, ring on the 4th fret of the C string.',
      'A diagonal staircase shape. The G string rings open.',
      'The stretch takes practice. Keep your wrist relaxed and thumb low behind the neck.',
    ],
  },
  D: {
    name: 'D', full: 'D major', frets: [2, 2, 2, 0], fingers: [1, 2, 3, 0],
    tips: [
      'Index, middle and ring fingers all on the 2nd fret of the G, C and E strings.',
      'Squeeze them in side by side; the fingers angle a little.',
      'The A string must ring open, so keep your ring finger off it.',
    ],
  },
  A7: {
    name: 'A7', full: 'A dominant 7th', frets: [0, 1, 0, 0], fingers: [0, 1, 0, 0],
    tips: [
      'Index finger on the 1st fret of the C string. Everything else rings open.',
      'A7 pulls strongly back to D. You\'ll hear it in Clementine.',
    ],
  },
  A: {
    name: 'A', full: 'A major', frets: [2, 1, 0, 0], fingers: [2, 1, 0, 0],
    tips: [
      'Middle on the 2nd fret of the G string, index on the 1st fret of the C string.',
      'It\'s A7 with one extra finger.',
      'Let the E and A strings ring open.',
    ],
  },
  E7: {
    name: 'E7', full: 'E dominant 7th', frets: [1, 2, 0, 2], fingers: [1, 2, 0, 3],
    tips: [
      'Index on the 1st fret of the G string, middle on the 2nd fret of the C string, ring on the 2nd fret of the A string.',
      'The E string rings open, right in the middle of the shape.',
      'E7 is tense and bluesy. It wants to pull back to Am.',
    ],
  },
};

// Pitch classes and exact string frequencies for each chord.
for (const c of Object.values(CHORDS)) {
  c.notes = c.frets.map((f, i) => ({
    string: STRINGS[i].name,
    fret: f,
    freq: STRINGS[i].freq * Math.pow(2, f / 12),
    pc: (OPEN_PC[i] + f) % 12,
  }));
  c.pcs = [...new Set(c.notes.map((n) => n.pc))];
}

// Patterns use an eighth-note grid: two slots per beat.
// D = down strum, U = up strum, X = chuck (muted percussive hit), . = rest.
export const STRUMS = {
  down4: {
    id: 'down4', name: 'Steady Down Strums', beats: 4, pattern: 'D.D.D.D.', bpm: 60,
    count: '1 & 2 & 3 & 4 &',
    desc: 'One down strum on every beat. Everything else is built on this.',
    tips: [
      'Strum with the pad of your index finger or thumb, over where the neck meets the body.',
      'Move from the wrist, not the whole arm. Think of shaking water off your hand.',
      'Keep the rhythm even. Tap your foot on every beat.',
    ],
  },
  du: {
    id: 'du', name: 'Down-Up Strumming', beats: 4, pattern: 'DUDUDUDU', bpm: 70,
    count: '1 & 2 & 3 & 4 &',
    desc: 'Down on the numbers, up on the "&". Your hand never stops moving.',
    tips: [
      'Your hand swings like a pendulum: down on each beat, back up in between.',
      'On the up strum, brush mainly the bottom two or three strings with your fingernail.',
      'Up strums are naturally a bit quieter. That\'s fine.',
    ],
  },
  waltz: {
    id: 'waltz', name: 'Waltz Strum (3/4)', beats: 3, pattern: 'D.DUDU', bpm: 80,
    count: '1 & 2 & 3 &',
    desc: 'Three beats per bar: a strong down on 1, then down-up, down-up.',
    tips: [
      'Count "ONE two three, ONE two three" and lean on the ONE.',
      'Used for gentle songs like Amazing Grace and Clementine.',
    ],
  },
  chuck: {
    id: 'chuck', name: 'The Chuck', beats: 4, pattern: 'D.X.D.X.', bpm: 90,
    count: '1 & 2 & 3 & 4 &',
    desc: 'Down strum, then a percussive "chuck" on beats 2 and 4. Punchy, like a snare drum.',
    tips: [
      'For a chuck, strum down and immediately land the side of your palm on the strings to mute them.',
      'You want a "chk" sound with no ringing notes.',
      'Pattern: DOWN, chuck, DOWN, chuck.',
    ],
  },
  island: {
    id: 'island', name: 'Island Strum', beats: 4, pattern: 'D.DU.UDU', bpm: 80,
    count: '1 & 2 & 3 & 4 &',
    desc: 'The classic ukulele strum: D - D U - U D U. Your hand keeps swinging and just misses the strings on beat 3.',
    tips: [
      'Keep the pendulum going: down-up on every beat, but skip hitting the strings on beat 3 (the down) and the "&" of 1.',
      'Say it out loud: "down, down-up, up-down-up".',
      'Start slowly. Speed comes once the motion is automatic.',
    ],
  },
};

// A bar is { c: chord or [chord, chord], l: lyric, p: optional strum pattern for this bar }.
// Two chords split the bar evenly.
// Songs with lyrics are traditional or public domain; arrangements are simplified for beginners.
// Hit the Road Jack: F gets down + chuck, E7 gets up, up, down.
const FE7 = 'D.X.UUD.';

export const SONGS = {
  row: {
    id: 'row', title: 'Row, Row, Row Your Boat', strum: 'down4', bpm: 60, beats: 4,
    blurb: 'A one-chord warm-up. Just keep the down strums steady.',
    bars: [
      { c: 'C', l: 'Row, row, row your boat,' },
      { c: 'C', l: 'gently down the stream.' },
      { c: 'C', l: 'Merrily, merrily, merrily, merrily,' },
      { c: 'C', l: 'life is but a dream.' },
      { c: 'C', l: 'Row, row, row your boat,' },
      { c: 'C', l: 'gently down the stream.' },
      { c: 'C', l: 'Merrily, merrily, merrily, merrily,' },
      { c: 'C', l: 'life is but a dream.' },
    ],
  },
  skip: {
    id: 'skip', title: 'Skip to My Lou', strum: 'down4', bpm: 70, beats: 4,
    blurb: 'Your first chord change: C and G7.',
    bars: [
      { c: 'C', l: 'Lou, Lou, skip to my Lou,' },
      { c: 'G7', l: 'Lou, Lou, skip to my Lou,' },
      { c: 'C', l: 'Lou, Lou, skip to my Lou,' },
      { c: ['G7', 'C'], l: 'skip to my Lou, my darling.' },
      { c: 'C', l: 'Fly\'s in the buttermilk, shoo fly shoo,' },
      { c: 'G7', l: 'Fly\'s in the buttermilk, shoo fly shoo,' },
      { c: 'C', l: 'Fly\'s in the buttermilk, shoo fly shoo,' },
      { c: ['G7', 'C'], l: 'skip to my Lou, my darling.' },
    ],
  },
  susanna: {
    id: 'susanna', title: 'Oh! Susanna', strum: 'du', bpm: 80, beats: 4,
    blurb: 'Three chords and your new down-up strum.',
    bars: [
      { c: 'C', l: 'I come from Alabama with a' },
      { c: 'G7', l: 'banjo on my knee,' },
      { c: 'C', l: 'I\'m going to Louisiana, my' },
      { c: ['G7', 'C'], l: 'true love for to see.' },
      { c: 'F', l: 'Oh, Susanna,' },
      { c: 'C', l: 'oh don\'t you cry for' },
      { c: 'G7', l: 'me, for I' },
      { c: 'C', l: 'come from Alabama with a' },
      { c: 'G7', l: 'banjo on my' },
      { c: 'C', l: 'knee.' },
    ],
  },
  grace: {
    id: 'grace', title: 'Amazing Grace', strum: 'waltz', bpm: 80, beats: 3,
    blurb: 'A slow waltz in 3/4 with C, F and G.',
    bars: [
      { c: 'C', l: 'A-ma-' },
      { c: 'C', l: 'zing grace, how' },
      { c: 'F', l: 'sweet the' },
      { c: 'C', l: 'sound, that' },
      { c: 'C', l: 'saved a' },
      { c: 'C', l: 'wretch like' },
      { c: 'G', l: 'me.' },
      { c: 'G', l: 'I' },
      { c: 'C', l: 'once was' },
      { c: 'C', l: 'lost, but' },
      { c: 'F', l: 'now am' },
      { c: 'C', l: 'found, was' },
      { c: 'C', l: 'blind, but' },
      { c: 'G', l: 'now I' },
      { c: 'C', l: 'see.' },
      { c: 'C', l: '' },
    ],
  },
  sailor: {
    id: 'sailor', title: 'Drunken Sailor', strum: 'chuck', bpm: 100, beats: 4,
    blurb: 'A rowdy sea shanty in A minor. Put some punch in those chucks.',
    bars: [
      { c: 'Am', l: 'What shall we do with a drunken sailor,' },
      { c: 'G', l: 'What shall we do with a drunken sailor,' },
      { c: 'Am', l: 'What shall we do with a drunken sailor,' },
      { c: ['G', 'Am'], l: 'early in the morning!' },
      { c: 'Am', l: 'Way hay and up she rises,' },
      { c: 'G', l: 'Way hay and up she rises,' },
      { c: 'Am', l: 'Way hay and up she rises,' },
      { c: ['G', 'Am'], l: 'early in the morning!' },
    ],
  },
  jingle: {
    id: 'jingle', title: 'Jingle Bells', strum: 'du', bpm: 100, beats: 4,
    blurb: 'Faster down-ups and your new Dm chord.',
    bars: [
      { c: 'C', l: 'Jingle bells, jingle bells,' },
      { c: 'C', l: 'jingle all the way.' },
      { c: 'F', l: 'Oh what fun it' },
      { c: 'C', l: 'is to ride in a' },
      { c: 'Dm', l: 'one-horse open' },
      { c: 'G7', l: 'sleigh, hey!' },
      { c: 'C', l: 'Jingle bells, jingle bells,' },
      { c: 'C', l: 'jingle all the way.' },
      { c: 'F', l: 'Oh what fun it' },
      { c: 'C', l: 'is to ride in a' },
      { c: ['Dm', 'G7'], l: 'one-horse open' },
      { c: 'C', l: 'sleigh!' },
    ],
  },
  auld: {
    id: 'auld', title: 'Auld Lang Syne', strum: 'island', bpm: 70, beats: 4,
    blurb: 'The island strum at a gentle pace, with quick two-chord bars.',
    bars: [
      { c: 'C', l: 'Should auld acquaintance' },
      { c: 'G7', l: 'be forgot, and' },
      { c: 'C', l: 'never brought to' },
      { c: 'F', l: 'mind? Should' },
      { c: 'C', l: 'auld acquaintance' },
      { c: 'G7', l: 'be forgot, and' },
      { c: ['Em', 'Am'], l: 'days of auld' },
      { c: ['Dm', 'G7'], l: 'lang syne?' },
      { c: 'C', l: 'For auld lang syne, my dear,' },
      { c: 'G7', l: 'for auld lang syne, we\'ll' },
      { c: 'C', l: 'take a cup of' },
      { c: 'F', l: 'kindness yet, for' },
      { c: ['Em', 'Am'], l: 'auld lang' },
      { c: ['Dm', 'G7'], l: 'syne.' },
      { c: 'C', l: '' },
    ],
  },
  kumbaya: {
    id: 'kumbaya', title: 'Kumbaya', strum: 'island', bpm: 80, beats: 4,
    blurb: 'A new key (G) with your new D chord.',
    bars: [
      { c: 'G', l: 'Kumbaya, my Lord,' },
      { c: 'C', l: 'kumbaya,' },
      { c: 'G', l: 'Kumbaya, my Lord,' },
      { c: 'D', l: 'kumbaya,' },
      { c: 'G', l: 'Kumbaya, my Lord,' },
      { c: 'C', l: 'kumbaya,' },
      { c: ['G', 'D'], l: 'Oh, Lord,' },
      { c: 'G', l: 'kumbaya.' },
      { c: 'G', l: 'Someone\'s singing, Lord,' },
      { c: 'C', l: 'kumbaya,' },
      { c: 'G', l: 'Someone\'s singing, Lord,' },
      { c: 'D', l: 'kumbaya,' },
      { c: 'G', l: 'Someone\'s singing, Lord,' },
      { c: 'C', l: 'kumbaya,' },
      { c: ['G', 'D'], l: 'Oh, Lord,' },
      { c: 'G', l: 'kumbaya.' },
    ],
  },
  clementine: {
    id: 'clementine', title: 'Clementine', strum: 'waltz', bpm: 100, beats: 3,
    blurb: 'A brisk waltz using D and A7.',
    bars: [
      { c: 'D', l: 'In a cavern,' },
      { c: 'D', l: 'in a canyon,' },
      { c: 'D', l: 'excavating' },
      { c: 'A7', l: 'for a mine,' },
      { c: 'A7', l: 'Dwelt a miner,' },
      { c: 'D', l: 'forty-niner,' },
      { c: 'A7', l: 'and his daughter' },
      { c: 'D', l: 'Clementine.' },
      { c: 'D', l: 'Oh my darling,' },
      { c: 'D', l: 'oh my darling,' },
      { c: 'D', l: 'oh my darling' },
      { c: 'A7', l: 'Clementine,' },
      { c: 'A7', l: 'You are lost and' },
      { c: 'D', l: 'gone forever,' },
      { c: 'A7', l: 'dreadful sorry,' },
      { c: 'D', l: 'Clementine.' },
    ],
  },
  // Under copyright, so no lyrics: bars carry section cues and you sing from memory.
  jack: {
    extraPatterns: [{ label: 'F → E7 bars', pattern: FE7 }],
    id: 'jack', title: 'Hit the Road Jack', strum: 'chuck', bpm: 90, beats: 4,
    noLyrics: true,
    blurb: 'The famous walk-down: Am, G, F, E7, two beats each. Am, G and F get a down strum then a chuck. On E7 strum up, up, down. Lyrics aren\'t included because the song is under copyright, so sing it from memory.',
    bars: [
      { c: ['Am', 'G'], l: 'Chorus · line 1' },
      { c: ['F', 'E7'], l: '', p: FE7 },
      { c: ['Am', 'G'], l: 'Chorus · line 2' },
      { c: ['F', 'E7'], l: '', p: FE7 },
      { c: ['Am', 'G'], l: 'Chorus · line 3' },
      { c: ['F', 'E7'], l: '', p: FE7 },
      { c: ['Am', 'G'], l: 'Chorus · line 4' },
      { c: ['F', 'E7'], l: '', p: FE7 },
      { c: ['Am', 'G'], l: 'Verse · line 1' },
      { c: ['F', 'E7'], l: '', p: FE7 },
      { c: ['Am', 'G'], l: 'Verse · line 2' },
      { c: ['F', 'E7'], l: '', p: FE7 },
      { c: ['Am', 'G'], l: 'Verse · line 3' },
      { c: ['F', 'E7'], l: '', p: FE7 },
      { c: ['Am', 'G'], l: 'Verse · line 4' },
      { c: ['F', 'E7'], l: '', p: FE7 },
      { c: 'Am', l: 'Finish on Am' },
    ],
  },
  saints: {
    id: 'saints', title: 'When the Saints Go Marching In', strum: 'island', bpm: 110, beats: 4,
    blurb: 'The grand finale: island strum at full speed.',
    bars: [
      { c: 'D', l: 'Oh when the saints' },
      { c: 'D', l: 'go marching in,' },
      { c: 'D', l: 'oh when the saints go' },
      { c: 'A', l: 'marching in,' },
      { c: 'D', l: 'Oh Lord, I want to' },
      { c: 'G', l: 'be in that number,' },
      { c: ['D', 'A'], l: 'when the saints go marching' },
      { c: 'D', l: 'in!' },
      { c: 'D', l: 'Oh when the sun' },
      { c: 'D', l: 'refuse to shine,' },
      { c: 'D', l: 'oh when the sun' },
      { c: 'A', l: 'refuse to shine,' },
      { c: 'D', l: 'Oh Lord, I want to' },
      { c: 'G', l: 'be in that number,' },
      { c: ['D', 'A'], l: 'when the sun refuse to' },
      { c: 'D', l: 'shine!' },
    ],
  },
};

// The lesson plan. Each unit teaches a chord, sometimes a strum, then a song
// that uses only chords learnt so far.
export const UNITS = [
  { title: 'Warm-up', lessons: [{ type: 'tune' }] },
  { title: 'Unit 1', lessons: [{ type: 'chord', chord: 'C' }, { type: 'strum', strum: 'down4' }, { type: 'song', song: 'row' }] },
  { title: 'Unit 2', lessons: [{ type: 'chord', chord: 'G7' }, { type: 'song', song: 'skip' }] },
  { title: 'Unit 3', lessons: [{ type: 'chord', chord: 'F' }, { type: 'strum', strum: 'du' }, { type: 'song', song: 'susanna' }] },
  { title: 'Unit 4', lessons: [{ type: 'chord', chord: 'G' }, { type: 'strum', strum: 'waltz' }, { type: 'song', song: 'grace' }] },
  { title: 'Unit 5', lessons: [{ type: 'chord', chord: 'Am' }, { type: 'strum', strum: 'chuck' }, { type: 'song', song: 'sailor' }] },
  { title: 'Unit 6', lessons: [{ type: 'chord', chord: 'Dm' }, { type: 'song', song: 'jingle' }] },
  { title: 'Unit 7', lessons: [{ type: 'chord', chord: 'Em' }, { type: 'strum', strum: 'island' }, { type: 'song', song: 'auld' }] },
  { title: 'Unit 8', lessons: [{ type: 'chord', chord: 'D' }, { type: 'song', song: 'kumbaya' }] },
  { title: 'Unit 9', lessons: [{ type: 'chord', chord: 'A7' }, { type: 'song', song: 'clementine' }] },
  { title: 'Unit 10', lessons: [{ type: 'chord', chord: 'A' }, { type: 'song', song: 'saints' }] },
  // Bonus lessons are always open, whatever you've finished.
  { title: 'Bonus', open: true, lessons: [{ type: 'chord', chord: 'E7' }, { type: 'song', song: 'jack' }] },
];

// Flatten into an ordered list with ids, titles and "chords known so far".
export const LESSONS = [];
{
  const known = [];
  UNITS.forEach((u, ui) => {
    u.lessons.forEach((l) => {
      const lesson = { ...l, unit: ui, unitTitle: u.title, alwaysOpen: !!u.open };
      if (l.type === 'tune') {
        lesson.id = 'tune';
        lesson.title = 'Tune your ukulele';
        lesson.icon = '🎯';
      } else if (l.type === 'chord') {
        lesson.id = 'chord-' + l.chord;
        lesson.title = 'Chord: ' + l.chord;
        lesson.icon = '✋';
        lesson.prevChord = known[known.length - 1] || null;
        known.push(l.chord);
      } else if (l.type === 'strum') {
        lesson.id = 'strum-' + l.strum;
        lesson.title = 'Strum: ' + STRUMS[l.strum].name;
        lesson.icon = '🌊';
        lesson.practiceChord = known[known.length - 1];
      } else {
        lesson.id = 'song-' + l.song;
        lesson.title = SONGS[l.song].title;
        lesson.icon = '🎵';
      }
      lesson.known = [...known];
      lesson.index = LESSONS.length;
      LESSONS.push(lesson);
    });
  });
}

export const LESSON_BY_ID = Object.fromEntries(LESSONS.map((l) => [l.id, l]));

export function songChords(song) {
  const set = [];
  song.bars.forEach((b) => [].concat(b.c).forEach((c) => { if (!set.includes(c)) set.push(c); }));
  return set;
}

export const BADGES = [
  { id: 'tuned', icon: '🎯', name: 'Tuned Up', desc: 'Tuned all four strings.' },
  { id: 'first-chord', icon: '✋', name: 'First Chord', desc: 'Finished your first chord lesson.' },
  { id: 'five-chords', icon: '🖐️', name: 'Handful', desc: 'Learnt 5 chords.' },
  { id: 'all-chords', icon: '🏅', name: 'Chord Master', desc: 'Learnt every chord.' },
  { id: 'first-strum', icon: '🌊', name: 'Strummer', desc: 'Finished a strumming lesson.' },
  { id: 'all-strums', icon: '🏝️', name: 'Island Groove', desc: 'Finished every strumming lesson.' },
  { id: 'first-song', icon: '🎵', name: 'First Song', desc: 'Played your first song.' },
  { id: 'five-songs', icon: '📜', name: 'Set List', desc: 'Played 5 songs.' },
  { id: 'all-songs', icon: '🎤', name: 'Headliner', desc: 'Played every song.' },
  { id: 'three-stars', icon: '⭐', name: 'Three Stars', desc: 'Scored 3 stars on a lesson.' },
  { id: 'coached', icon: '👂', name: 'Good Listener', desc: 'Got feedback from the coach.' },
  { id: 'metronome', icon: '⏱️', name: 'Keeping Time', desc: 'Practised with the metronome.' },
  { id: 'streak-3', icon: '🔥', name: 'On a Roll', desc: 'Practised 3 days in a row.' },
  { id: 'streak-7', icon: '🌟', name: 'Week Warrior', desc: 'Practised 7 days in a row.' },
];
