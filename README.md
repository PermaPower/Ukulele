# Uke Frog

A ukulele learning app for your phone. Freddie the frog hops along the strings in time with the music, and a listening coach gives feedback on your playing.

## What's inside

- **Lesson plan**: 28 lessons in 11 units, from easy to harder. Each unit teaches a chord, sometimes a strum, then a song that uses only the chords you know. Finish a lesson to unlock the next.
- **11 chords**: C, G7, F, G, Am, Dm, Em, D, A7, A, E7. Each has a diagram, finger tips, sound samples, a chord check and a chord-change drill.
- **5 strums**: steady downs, down-up, waltz (3/4), the chuck, and the island strum.
- **10 songs** (traditional or public domain): Row Row Row Your Boat, Skip to My Lou, Oh! Susanna, Amazing Grace, Drunken Sailor, Jingle Bells, Auld Lang Syne, Kumbaya, Clementine, When the Saints Go Marching In. Lyrics highlight as you play and the tempo is adjustable.
- **Bonus song**: Hit the Road Jack (Am, G, F, E7 with the chuck strum). It's under copyright, so the chart shows chords and section cues without lyrics.
- **Listening coach** (uses the microphone):
  - Chord check: which strings ring clearly, which are muffled or ringing open, whether it sounded like a different chord, and how long the chord sustains.
  - Rhythm and songs: strums hit, rushing or dragging, steadiness, your actual tempo, speeding up or slowing down, extra strums, quiet up-strums, uneven volume, and chord clarity through the song.
- **Tuner**, **metronome** (with tap tempo), **stars, badges and a daily streak**.

Everything runs on the phone. No account needed and nothing leaves the device. Progress is saved in the browser.

## Install on your phone

The app needs to be served over **https** for the microphone to work. The included GitHub Actions workflow publishes it to GitHub Pages:

1. In the repository on GitHub, go to **Settings → Pages** and set **Source** to **GitHub Actions**.
2. Merge this branch into `main` (or run the "Deploy to GitHub Pages" workflow manually from the **Actions** tab).
3. Open the Pages URL on your phone:
   - **iPhone (Safari):** Share button → **Add to Home Screen**.
   - **Android (Chrome):** menu → **Install app** / **Add to Home screen**.
4. Allow microphone access when asked.

Once it's been opened once, it also works offline.

## Getting good feedback

- Prop the phone up about half a metre away with the microphone facing you, somewhere quiet.
- Run **Me → Settings → Calibrate** once so timing feedback accounts for your phone's audio delay.
- The coach uses signal-processing heuristics, not a teacher's ear. Treat it as a helpful guide.

## Run locally

It's plain HTML, CSS and JavaScript with no build step:

```sh
npx http-server -p 8080
```

Then open http://localhost:8080. Browsers allow microphone access on `localhost` without https.

## Project layout

| File | Purpose |
| --- | --- |
| `js/data.js` | Chords, strum patterns, songs, lesson plan, badges |
| `js/app.js` | Menus, routing and lesson screens |
| `js/player.js` | Play-along and listen-and-coach player |
| `js/frog.js` | Freddie the frog animation |
| `js/analysis.js` | Strum detection, chord recognition, pitch detection, feedback |
| `js/audio.js` | Ukulele synth, metronome clicks, scheduler, microphone |
| `js/tools.js` | Chord check, tuner, metronome, latency calibration |
| `js/timeline.js` | Turns bars, pattern and tempo into timed events |
| `js/progress.js` | Saved progress, streaks and badges |
