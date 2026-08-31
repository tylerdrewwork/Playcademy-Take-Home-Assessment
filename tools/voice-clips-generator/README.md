# Voice clips generator

Pre-build utility that turns lesson narration transcripts into voice-over
audio with a Replicate text-to-speech model, and drops the clips into
`src/assets/lesson/addition-1/transcripts/` (one `<step-label>.wav` per
transcript). It runs on plain Node (v25+, no extra dependencies) and is
never part of the built site — `tools/` is outside Vite's module graph, so
nothing here ships to visitors.

Currently the transcript source is hardcoded to the addition-1 lesson's
`CountingCombiningScreen` steps (`src/lessons/content/addition-1-screens/countingCombiningSteps.ts`).
A future minor feature will discover transcripts across all lessons
automatically.

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
npm run generate:voice-clips                              # generate every clip (overwrites existing)
npm run generate:voice-clips -- --dry-run                 # list what would happen; no token, no network
npm run generate:voice-clips -- --only=problems-pre-transition   # one clip, by step label
npm run generate:voice-clips -- --print-schema            # dump the model's input schema
```

Every run regenerates the requested clips and **overwrites** any existing
audio — each Replicate prediction costs money, so use `--only=<label>` to
limit a run to the clip you actually want redone. `manifest.json`
(committed, written by the script) records which model/voice/transcript
produced each clip currently on disk. Commit the generated `.wav` files
and `manifest.json` together.

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
