# Voice clips generator

Pre-build utility that turns lesson narration transcripts into voice-over
audio with a Replicate text-to-speech model, and drops the clips into
`src/assets/lesson/addition-1/transcripts/` (one `<step-label>.wav` per
transcript). It runs on plain Node (v25+, no extra dependencies) and is
never part of the built site — `tools/` is outside Vite's module graph, so
nothing here ships to visitors.

Currently the lesson transcript source is hardcoded to the addition-1
lesson's `CountingCombiningScreen` steps
(`src/lessons/content/addition-1-screens/countingCombiningSteps.ts`).
A future minor feature will discover transcripts across all lessons
automatically.

With `--numbers`, the job source switches instead to three takes of each
number 1-20's spoken word form ("one", "two", ...), written to
`src/assets/general/numbers/` as `1a.wav`/`1b.wav`/`1c.wav` ...
`20a.wav`/`20b.wav`/`20c.wav`. The same transcript is sent to the model
three times per number — the takes vary because the model's own inference
is non-deterministic, not because the script asks for different wording.

## Setup

Create a `.env` file in the repo root (it's gitignored) containing:

```sh
REPLICATE_API_TOKEN=   # from https://replicate.com/account/api-tokens

# Optional overrides:
# REPLICATE_TTS_MODEL=google/gemini-3.1-flash-tts
# REPLICATE_TTS_VOICE=
```

## Usage

```sh
npm run generate:voice-clips                              # generate every lesson clip (overwrites existing)
npm run generate:voice-clips:numbers                      # 3 takes of each number 1-20 (1a/1b/1c ... 20a/20b/20c)
npm run generate:voice-clips -- --dry-run                 # list what would happen; no token, no network
npm run generate:voice-clips -- --only=problems-pre-transition   # one clip, by step label
npm run generate:voice-clips -- --print-schema            # dump the model's input schema
npm run generate:voice-clips -- --numbers --only=7b        # one take, by its take label
```

`npm run <script> <flag>` can't forward a bare flag to the underlying
script — npm always tries to parse it as its own CLI option first, so
`--numbers` needs the `-- --numbers` separator (or npm silently drops it).
`generate:voice-clips:numbers` above sidesteps that for the common case;
for anything else, calling `node` directly needs no separator at all:

```sh
node --env-file-if-exists=.env tools/voice-clips-generator/generate-voice-clips.ts --numbers --only=7b
```

Every run regenerates the requested clips and **overwrites** any existing
audio — each Replicate prediction costs money, so use `--only=<label>` to
limit a run to the clip you actually want redone (with `--numbers`, a label
is a take like `7b`, not a bare number — all three takes share a number but
are regenerated independently). `manifest.json` (committed, written by the
script) records which model/voice/transcript produced each clip currently
on disk. Commit the generated `.wav` files and `manifest.json` together.

## Cleaning generated clips

`clean-voice-clips.ts` post-processes generated `.wav` files in place, in
one pass per clip:

1. **Removes noise blips** at the head/tail — short bursts (< 0.25s)
   separated from the speech by silence, like mic pops or TTS artifacts.
2. **Trims leading/trailing silence**, keeping a 60ms pad around the speech
   and adding an 8ms fade at each cut so word onsets and decays are never
   clipped and cuts never click.
3. **Loudness-normalizes** to −16 LUFS / −1.5 dBTP (EBU R128, two-pass
   linear gain, so the voice's own dynamics are untouched), keeping every
   clip at the same volume.

It needs `ffmpeg`/`ffprobe` (3.1+, for `loudnorm`) — not an npm dependency.
By default it runs whatever `ffmpeg`/`ffprobe` PATH resolves to; if that
build is too old (the script checks and says so), point the `FFMPEG` and
`FFPROBE` env vars at a newer binary — they can go in `.env`. Clips already
trimmed and within 0.5 LU of the target are skipped untouched, so re-runs
are idempotent. Cleaning doesn't touch `manifest.json`, and generating a
clip overwrites the cleaned file — so run cleaning again after generating.

```sh
npm run clean:voice-clips                                 # clean the transcripts folder (default)
npm run clean:voice-clips -- --dry-run                    # report what would change; writes nothing
npm run clean:voice-clips -- src/assets/general/numbers   # clean another folder or specific .wav files
```

## Rate limiting

The Replicate account allows at most 6 API requests per minute, so every
API request (schema fetch, prediction creation, polling) is spaced at least
`REQUEST_PAUSE_SECONDS` apart (10.1s — the 0.1 is slack for race
conditions; configurable in `generate-voice-clips.ts`). If Replicate ever
returns HTTP 429 anyway, the run aborts immediately instead of attempting
further clips; the failed labels are listed so they can be retried
individually with `--only=<label>`.

## Notes

- The script asks Replicate for the model's input schema at run time to
  resolve the text/voice parameter names, so swapping models via
  `REPLICATE_TTS_MODEL` usually needs no code change; model-specific extras
  belong in `INPUT_DEFAULTS` in `generate-voice-clips.ts`.
- Output extension follows what the model returns; the repo's audio
  convention is `.wav`, and the script warns when a model produces
  something else.
