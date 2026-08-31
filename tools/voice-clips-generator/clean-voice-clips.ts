// Pre-build utility: cleans generated voice clips in place. For each .wav it
//   1. drops stray noise blips at the head/tail (short bursts separated from
//      the speech by silence, e.g. mic pops or TTS artifacts),
//   2. trims leading/trailing silence, keeping a small pad so word onsets
//      aren't clipped, and
//   3. loudness-normalizes to a shared target so every clip plays at the
//      same volume.
// Run via `npm run clean:voice-clips` — see README.md alongside this file.
// Requires ffmpeg/ffprobe on PATH. Never imported by the app; nothing here
// is served to visitors.

import { execFile } from 'node:child_process'
import { readdir, rename, rm, stat } from 'node:fs/promises'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'

const execFileAsync = promisify(execFile)

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const DEFAULT_TARGET = path.join(REPO_ROOT, 'src', 'assets', 'lesson', 'addition-1', 'transcripts')

// Which ffmpeg/ffprobe to run. Overridable because a machine can have
// several on PATH and the first one may be too old for loudnorm (needs
// ffmpeg 3.1+) — set FFMPEG/FFPROBE in .env to a specific binary.
const FFMPEG = process.env.FFMPEG ?? 'ffmpeg'
const FFPROBE = process.env.FFPROBE ?? 'ffprobe'

// Anything quieter than this counts as silence, and a quiet stretch must
// last this long to register — shorter dips (breaths between words) don't
// split the speech into separate segments.
const SILENCE_THRESHOLD_DB = -40
const MIN_SILENCE_S = 0.05

// A sounded segment at the head or tail shorter than this is a noise blip,
// not speech, and gets trimmed away with the surrounding silence.
const MIN_SPEECH_S = 0.25

// Pad kept around the speech so trimming never clips a soft consonant onset
// or a word's decay, plus a tiny fade at each cut to avoid clicks.
const EDGE_PAD_S = 0.06
const FADE_S = 0.008

// EBU R128 loudness target for spoken voice-over. All clips land here so
// nothing in the lesson is suddenly louder or quieter.
const TARGET_I = -16
const TARGET_TP = -1.5
const TARGET_LRA = 11

// A clip is already clean (skip, keep it byte-identical) when there is
// nothing meaningful to trim and its loudness is within tolerance.
const SKIP_TRIM_S = 0.01
const SKIP_LOUDNESS_LU = 0.5

interface Segment {
  start: number
  end: number
}

interface Probe {
  duration: number
  sampleRate: number
}

interface LoudnessStats {
  input_i: string
  input_tp: string
  input_lra: string
  input_thresh: string
  target_offset: string
}

interface CleanPlan {
  trimStart: number
  trimEnd: number
  headCut: number
  tailCut: number
  blipsRemoved: number
  loudness: LoudnessStats
  // The loudness the clip will actually land at: TARGET_I unless boosting
  // that far would push the true peak over TARGET_TP, in which case the
  // linear gain stops at the ceiling instead of distorting.
  reachableI: number
  peakLimited: boolean
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath)
    return true
  } catch {
    return false
  }
}

async function runFfmpeg(args: string[]): Promise<string> {
  // ffmpeg writes all diagnostics (silencedetect, loudnorm stats) to stderr.
  const { stderr } = await execFileAsync(FFMPEG, args, { maxBuffer: 16 * 1024 * 1024 })
  return stderr
}

async function probe(file: string): Promise<Probe> {
  const { stdout } = await execFileAsync(FFPROBE, [
    '-v', 'error',
    '-show_entries', 'stream=sample_rate:format=duration',
    '-of', 'json',
    file,
  ])
  const body = JSON.parse(stdout) as {
    streams?: { sample_rate?: string }[]
    format?: { duration?: string }
  }
  const duration = Number(body.format?.duration)
  const sampleRate = Number(body.streams?.[0]?.sample_rate)
  if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(sampleRate) || sampleRate <= 0) {
    throw new Error(`ffprobe returned no usable duration/sample rate: ${stdout.trim()}`)
  }
  return { duration, sampleRate }
}

// Sounded segments = the complement of the silences silencedetect reports.
async function detectSoundedSegments(file: string, duration: number): Promise<Segment[]> {
  const stderr = await runFfmpeg([
    '-hide_banner', '-nostats',
    '-i', file,
    '-af', `silencedetect=noise=${SILENCE_THRESHOLD_DB}dB:d=${MIN_SILENCE_S}`,
    '-f', 'null', '-',
  ])
  const silences: Segment[] = []
  let openStart: number | undefined
  for (const line of stderr.split('\n')) {
    const startMatch = line.match(/silence_start:\s*(-?[\d.]+)/)
    if (startMatch !== null) {
      openStart = Number(startMatch[1])
      continue
    }
    const endMatch = line.match(/silence_end:\s*(-?[\d.]+)/)
    if (endMatch !== null && openStart !== undefined) {
      silences.push({ start: Math.max(0, openStart), end: Number(endMatch[1]) })
      openStart = undefined
    }
  }
  // A silence still open at EOF runs to the end of the clip.
  if (openStart !== undefined) silences.push({ start: Math.max(0, openStart), end: duration })

  const sounded: Segment[] = []
  let cursor = 0
  for (const s of silences) {
    if (s.start > cursor) sounded.push({ start: cursor, end: s.start })
    cursor = Math.max(cursor, s.end)
  }
  if (cursor < duration) sounded.push({ start: cursor, end: duration })
  return sounded
}

// Head/tail segments too short to be speech are blips; the trim window wraps
// what remains. Middle segments are never dropped — a short word between two
// pauses is still speech.
function chooseTrimWindow(segments: Segment[], duration: number): { window: Segment; blipsRemoved: number } | undefined {
  if (segments.length === 0) return undefined
  let first = 0
  let last = segments.length - 1
  while (first <= last && segments[first].end - segments[first].start < MIN_SPEECH_S) first += 1
  while (last >= first && segments[last].end - segments[last].start < MIN_SPEECH_S) last -= 1

  let kept: Segment[]
  let blipsRemoved: number
  if (first > last) {
    // Nothing is speech-length (e.g. a very short clip like "two"). Keep the
    // longest segment rather than refusing to trim at all.
    const longest = segments.reduce((a, b) => (b.end - b.start > a.end - a.start ? b : a))
    kept = [longest]
    blipsRemoved = segments.length - 1
  } else {
    kept = segments.slice(first, last + 1)
    blipsRemoved = first + (segments.length - 1 - last)
  }
  return {
    window: {
      start: Math.max(0, kept[0].start - EDGE_PAD_S),
      end: Math.min(duration, kept[kept.length - 1].end + EDGE_PAD_S),
    },
    blipsRemoved,
  }
}

// The shared trim+fade prefix, so the loudness measured in pass 1 is
// measured on exactly the audio pass 2 renders.
function trimFilter(window: Segment): string {
  const length = window.end - window.start
  const fade = Math.min(FADE_S, length / 4)
  return (
    `atrim=start=${window.start.toFixed(4)}:end=${window.end.toFixed(4)},asetpts=PTS-STARTPTS,` +
    `afade=t=in:st=0:d=${fade.toFixed(4)},afade=t=out:st=${(length - fade).toFixed(4)}:d=${fade.toFixed(4)}`
  )
}

async function measureLoudness(file: string, window: Segment): Promise<LoudnessStats> {
  const stderr = await runFfmpeg([
    '-hide_banner', '-nostats',
    '-i', file,
    '-af', `${trimFilter(window)},loudnorm=I=${TARGET_I}:TP=${TARGET_TP}:LRA=${TARGET_LRA}:print_format=json`,
    '-f', 'null', '-',
  ])
  const jsonMatch = stderr.match(/\{[^{}]*"input_i"[^{}]*\}/)
  if (jsonMatch === null) {
    throw new Error(`loudnorm printed no measurement JSON:\n${stderr.slice(-500)}`)
  }
  return JSON.parse(jsonMatch[0]) as LoudnessStats
}

async function render(file: string, plan: CleanPlan, sampleRate: number): Promise<void> {
  const window = { start: plan.trimStart, end: plan.trimEnd }
  const loudnorm =
    `loudnorm=I=${TARGET_I}:TP=${TARGET_TP}:LRA=${TARGET_LRA}:` +
    `measured_I=${plan.loudness.input_i}:measured_TP=${plan.loudness.input_tp}:` +
    `measured_LRA=${plan.loudness.input_lra}:measured_thresh=${plan.loudness.input_thresh}:` +
    `offset=${plan.loudness.target_offset}:linear=true`
  // Written to <file>.tmp.wav then renamed, so an interrupted run never
  // leaves a truncated clip at the real path. loudnorm resamples internally,
  // so -ar pins the output back to the source rate.
  const tmpPath = `${file}.tmp.wav`
  try {
    await runFfmpeg([
      '-hide_banner', '-nostats', '-y',
      '-i', file,
      '-af', `${trimFilter(window)},${loudnorm}`,
      '-ar', String(sampleRate),
      '-c:a', 'pcm_s16le',
      '-f', 'wav',
      tmpPath,
    ])
    await rename(tmpPath, file)
  } catch (err) {
    await rm(tmpPath, { force: true })
    throw err
  }
}

async function planClean(file: string): Promise<{ plan?: CleanPlan; sampleRate: number; skipReason?: string }> {
  const { duration, sampleRate } = await probe(file)
  const segments = await detectSoundedSegments(file, duration)
  const choice = chooseTrimWindow(segments, duration)
  if (choice === undefined) {
    return { sampleRate, skipReason: 'clip is entirely silence' }
  }
  const loudness = await measureLoudness(file, choice.window)
  const headCut = choice.window.start
  const tailCut = duration - choice.window.end
  // Skip on effective audible change, not raw counts: a "blip" whose removal
  // moves the trim window under 10ms is inaudible, and a boost the true-peak
  // ceiling caps at ~0 dB can never move the clip closer to the target —
  // re-rendering either would churn bytes forever without changing sound.
  const neededGain = TARGET_I - Number(loudness.input_i)
  const gainHeadroom = TARGET_TP - Number(loudness.input_tp)
  const appliedGain = neededGain > 0 ? Math.min(neededGain, Math.max(0, gainHeadroom)) : neededGain
  if (headCut < SKIP_TRIM_S && tailCut < SKIP_TRIM_S && Math.abs(appliedGain) <= SKIP_LOUDNESS_LU) {
    return { sampleRate, skipReason: 'already clean' }
  }
  return {
    sampleRate,
    plan: {
      trimStart: choice.window.start,
      trimEnd: choice.window.end,
      headCut,
      tailCut,
      blipsRemoved: choice.blipsRemoved,
      loudness,
      reachableI: Number(loudness.input_i) + appliedGain,
      peakLimited: neededGain > 0 && gainHeadroom < neededGain,
    },
  }
}

function describe(plan: CleanPlan): string {
  const parts = [`trim ${plan.headCut.toFixed(2)}s head / ${plan.tailCut.toFixed(2)}s tail`]
  if (plan.blipsRemoved > 0) parts.push(`${plan.blipsRemoved} noise blip${plan.blipsRemoved === 1 ? '' : 's'} removed`)
  const limitNote = plan.peakLimited ? ' (peak-limited)' : ''
  parts.push(`${Number(plan.loudness.input_i).toFixed(1)} → ${plan.reachableI.toFixed(1)} LUFS${limitNote}`)
  return parts.join(', ')
}

async function collectFiles(targets: string[]): Promise<string[]> {
  const files: string[] = []
  for (const target of targets) {
    const resolved = path.resolve(target)
    if (!(await fileExists(resolved))) {
      throw new Error(`no such file or directory: ${target}`)
    }
    if ((await stat(resolved)).isDirectory()) {
      const entries = await readdir(resolved)
      files.push(
        ...entries
          .filter((name) => name.toLowerCase().endsWith('.wav') && !name.endsWith('.tmp.wav'))
          .map((name) => path.join(resolved, name)),
      )
    } else {
      if (!resolved.toLowerCase().endsWith('.wav')) {
        throw new Error(`${target} is not a .wav file — this repo's audio convention is .wav, and cleaning re-encodes, so other formats are not handled.`)
      }
      files.push(resolved)
    }
  }
  return files.sort()
}

async function assertFfmpegAvailable(): Promise<void> {
  let version: string
  try {
    version = (await execFileAsync(FFMPEG, ['-version'])).stdout.split('\n')[0]
    await execFileAsync(FFPROBE, ['-version'])
  } catch {
    throw new Error(
      `${FFMPEG}/${FFPROBE} not found — install ffmpeg (https://ffmpeg.org/download.html), ` +
        'or point the FFMPEG/FFPROBE env vars (settable in .env) at existing binaries.',
    )
  }
  // Old ffmpeg builds predate the loudnorm filter (ffmpeg 3.1, 2016); check
  // up front so the failure names the fix instead of erroring per clip.
  const { stdout } = await execFileAsync(FFMPEG, ['-filters'], { maxBuffer: 16 * 1024 * 1024 })
  for (const filter of ['loudnorm', 'silencedetect', 'atrim', 'afade']) {
    if (!stdout.includes(` ${filter} `)) {
      throw new Error(
        `this ffmpeg (${version}) has no '${filter}' filter — it is too old. ` +
          'Set the FFMPEG/FFPROBE env vars (settable in .env) to a newer build (3.1+).',
      )
    }
  }
}

async function main(): Promise<number> {
  const { values, positionals } = parseArgs({
    options: {
      'dry-run': { type: 'boolean', default: false },
    },
    allowPositionals: true,
  })

  await assertFfmpegAvailable()
  // The default folder not existing just means nothing was generated yet.
  const targets =
    positionals.length > 0 ? positionals : (await fileExists(DEFAULT_TARGET)) ? [DEFAULT_TARGET] : []
  const files = await collectFiles(targets)
  if (files.length === 0) {
    console.log('No .wav files found to clean.')
    return 0
  }

  let cleaned = 0
  let skipped = 0
  const failed: string[] = []

  for (const file of files) {
    const inRepo = path.relative(REPO_ROOT, file)
    const rel = inRepo.startsWith('..') ? file : inRepo
    try {
      const { plan, sampleRate, skipReason } = await planClean(file)
      if (plan === undefined) {
        console.log(`skipped (${skipReason})  ${rel}`)
        skipped += 1
        continue
      }
      if (values['dry-run']) {
        console.log(`would clean           ${rel} (${describe(plan)})`)
        cleaned += 1
        continue
      }
      await render(file, plan, sampleRate)
      console.log(`cleaned               ${rel} (${describe(plan)})`)
      cleaned += 1
    } catch (err) {
      console.error(`FAILED                ${rel}: ${(err as Error).message}`)
      failed.push(rel)
    }
  }

  const verb = values['dry-run'] ? 'would clean' : 'cleaned'
  console.log(`\nDone: ${cleaned} ${verb}, ${skipped} skipped, ${failed.length} failed.`)
  return failed.length > 0 ? 1 : 0
}

main().then(
  (code) => {
    process.exitCode = code
  },
  (err) => {
    console.error((err as Error).message)
    process.exitCode = 1
  },
)
