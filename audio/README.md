# Background music tracks

Drop your own audio files in this folder and list them in `tracks.json`. The app then
plays them as background music (mode **"My music"** in Settings), crossfading between
tracks. If `tracks.json` is empty, the app falls back to its built-in synthesized moods.

**No audio files are bundled with the app** — you add your own.

## How to add tracks

1. Put audio files (`.mp3`, `.m4a`, `.ogg`, `.wav`) in this `audio/` folder.
2. List them in `tracks.json`:

   ```json
   [
     { "title": "Deep Space", "src": "audio/deep-space.mp3" },
     { "title": "Event Horizon", "src": "audio/event-horizon.mp3" }
   ]
   ```

3. Turn Music on in Settings and pick **My music**. Tracks play in shuffled order and loop.

`src` can also be a full URL to a file hosted elsewhere (that server must allow CORS).

## Use music you have the rights to

Only add tracks you're allowed to use — your own music, tracks you've licensed, or
royalty-free / Creative-Commons music. Do **not** add commercial soundtrack rips
(e.g. the actual Interstellar or 2001 recordings); those are copyrighted.

Good sources of free-to-use cinematic / ambient "space" music include royalty-free
libraries and Creative-Commons catalogs (search for "royalty free cinematic space
ambient", and check each track's license/attribution terms before using it).

## Notes

- Files are cached by the service worker after the first play, so they work offline
  afterward. Large files mean a larger cache — keep total size reasonable.
- Playback respects the in-app Volume slider and Music on/off toggle.
