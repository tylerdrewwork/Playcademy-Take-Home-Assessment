// Pre-build utility: generates lesson voice-over clips with a Replicate TTS
// model. Run via `npm run generate:voice-clips` — see README.md alongside
// this file. Never imported by the app; nothing here is served to visitors.
//
// NOTE: The transcript sources are currently HARDCODED to the addition-1
// lesson's screens (IntroScreen and CountingCombiningScreen steps), and
// the output folder to src/assets/lesson/addition-1/transcripts. A future
// minor feature will discover and pull transcripts from all lessons
// automatically.

import { createHash } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { fileURLToPath } from 'node:url'
import { countingCombiningSteps } from '../../src/lessons/content/addition-1-screens/countingCombiningSteps.ts'
import { introSteps } from '../../src/lessons/content/addition-1-screens/introSteps.ts'

// Clip filenames come from step labels, so labels must be unique across
// every screen that feeds this tool.
const ALL_STEPS = [...introSteps, ...countingCombiningSteps]
{
  const seen = new Set<string>()
  for (const step of ALL_STEPS) {
    if (seen.has(step.label)) throw new Error(`Duplicate step label across screens: ${step.label}`)
    seen.add(step.label)
  }
}

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUTPUT_DIR = path.join(REPO_ROOT, 'src', 'assets', 'lesson', 'addition-1', 'transcripts')
const MANIFEST_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), 'manifest.json')

const DEFAULT_MODEL = 'google/gemini-3.1-flash-tts'

// Model-specific input defaults beyond the text/voice fields (e.g. sample
// rate or output format where a model supports one) live here so switching
// models means touching one object.
const INPUT_DEFAULTS: Record<string, unknown> = {
  voice: "Despina",
  prompt: "Say the following, patiently and with a hint of excitement, like a teacher."
}

// Parameter names differ per model ('text' vs 'prompt', 'voice' vs
// 'voice_id'...). On a real run the model's input schema is fetched and the
// names resolved from it; these are the fallbacks if that fetch fails.
// Gemini TTS uses 'prompt' for style direction (see INPUT_DEFAULTS), so it
// must never be treated as the transcript-text field.
const TEXT_PARAM_CANDIDATES = ['text']
const VOICE_PARAM_CANDIDATES = ['voice', 'voice_id', 'voice_name', 'speaker']

// How long to keep polling a prediction that the synchronous wait returned
// unfinished, before counting the clip as failed.
const PREDICTION_DEADLINE_MS = 120_000
// Small extra sleep before each poll; in practice polls are paced by the
// REQUEST_PAUSE_SECONDS gate below, which is what enforces the rate limit.
const POLL_INTERVAL_MS = 2_000

// Minimum gap between any two Replicate API requests (schema fetch,
// prediction creation, polling). The account allows at most 6 requests per
// minute; 10.1s instead of a flat 10s leaves slack for race conditions.
const REQUEST_PAUSE_SECONDS = 10.1

// A 429 (too many requests) means the rate limit was exceeded despite the
// pause — the whole run aborts immediately rather than burning more of the
// request budget on clips that would also be rejected.
class RateLimitError extends Error {
  constructor(url: string) {
    super(`Replicate returned HTTP 429 (too many requests) for ${url}; aborting the run.`)
  }
}

interface Job {
  label: string
  transcript: string
  hash: string
}

interface ManifestEntry {
  file: string
  hash: string
  generatedAt: string
}

type Manifest = Record<string, ManifestEntry>

interface GeneratorOptions {
  apiToken?: string
  model: string
  voiceId?: string
  dryRun: boolean
  only?: string
}

function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex')
}

class VoiceClipGenerator {
  private readonly opts: GeneratorOptions
  private manifest: Manifest = {}
  private textParam = TEXT_PARAM_CANDIDATES[0]
  private voiceParam = VOICE_PARAM_CANDIDATES[0]

  constructor(opts: GeneratorOptions) {
    this.opts = opts
  }

  collectJobs(): Job[] {
    const jobs = ALL_STEPS.map((step) => ({
      label: step.label,
      transcript: step.transcript,
      hash: sha256(`${this.opts.model}|${this.opts.voiceId ?? ''}|${step.transcript}`),
    }))
    if (this.opts.only === undefined) return jobs
    const filtered = jobs.filter((job) => job.label === this.opts.only)
    if (filtered.length === 0) {
      const known = jobs.map((job) => job.label).join(', ')
      throw new Error(`--only=${this.opts.only} matches no step label. Known labels: ${known}`)
    }
    return filtered
  }

  async loadManifest(): Promise<void> {
    try {
      const raw = await readFile(MANIFEST_PATH, 'utf8')
      this.manifest = JSON.parse(raw)
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.warn(`Warning: could not read manifest (${(err as Error).message}); starting a fresh record.`)
      }
      this.manifest = {}
    }
  }

  async saveManifest(): Promise<void> {
    await writeFile(MANIFEST_PATH, JSON.stringify(this.manifest, null, 2) + '\n', 'utf8')
  }

  private authHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.opts.apiToken}`,
      'Content-Type': 'application/json',
    }
  }

  private lastApiRequestAt = 0

  // Every Replicate API request goes through here so consecutive requests
  // stay at least REQUEST_PAUSE_SECONDS apart (the 6-per-minute account
  // limit counts schema fetches and polls, not just prediction creation).
  private async replicateFetch(url: string, init?: RequestInit): Promise<Response> {
    const waitMs = this.lastApiRequestAt + REQUEST_PAUSE_SECONDS * 1000 - Date.now()
    if (waitMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitMs))
    }
    this.lastApiRequestAt = Date.now()
    const res = await fetch(url, init)
    if (res.status === 429) throw new RateLimitError(url)
    return res
  }

  async fetchInputSchema(): Promise<Record<string, unknown> | undefined> {
    const res = await this.replicateFetch(`https://api.replicate.com/v1/models/${this.opts.model}`, {
      headers: this.authHeaders(),
    })
    if (!res.ok) {
      console.warn(`Warning: could not fetch model schema (HTTP ${res.status}); using default parameter names.`)
      return undefined
    }
    const body = (await res.json()) as {
      latest_version?: { openapi_schema?: { components?: { schemas?: { Input?: { properties?: Record<string, unknown> } } } } }
    }
    return body.latest_version?.openapi_schema?.components?.schemas?.Input?.properties
  }

  // Pick the model's actual text/voice parameter names from its input
  // schema so a model swap doesn't silently send inputs the model ignores.
  async resolveInputParams(): Promise<void> {
    const properties = await this.fetchInputSchema()
    if (properties === undefined) {
      console.warn(`Warning: model schema has no input properties; using default parameter names.`)
      return
    }
    const keys = Object.keys(properties)
    const textParam = TEXT_PARAM_CANDIDATES.find((name) => keys.includes(name))
    const voiceParam = VOICE_PARAM_CANDIDATES.find((name) => keys.includes(name))
    if (textParam === undefined) {
      throw new Error(
        `None of [${TEXT_PARAM_CANDIDATES.join(', ')}] found in ${this.opts.model}'s input schema. ` +
          `Inspect it with --print-schema and update TEXT_PARAM_CANDIDATES.`,
      )
    }
    this.textParam = textParam
    if (voiceParam !== undefined) this.voiceParam = voiceParam
    if (this.opts.voiceId !== undefined && voiceParam === undefined) {
      console.warn(
        `Warning: REPLICATE_TTS_VOICE is set but ${this.opts.model} has no ` +
          `[${VOICE_PARAM_CANDIDATES.join(', ')}] input; the voice setting will be ignored.`,
      )
    }
  }

  private buildInput(job: Job): Record<string, unknown> {
    const input: Record<string, unknown> = { ...INPUT_DEFAULTS, [this.textParam]: job.transcript }
    if (this.opts.voiceId !== undefined) input[this.voiceParam] = this.opts.voiceId
    return input
  }

  // Resolves to the URL of the generated audio file.
  async generateClip(job: Job): Promise<string> {
    const res = await this.replicateFetch(`https://api.replicate.com/v1/models/${this.opts.model}/predictions`, {
      method: 'POST',
      headers: { ...this.authHeaders(), Prefer: 'wait=60' },
      body: JSON.stringify({ input: this.buildInput(job) }),
    })
    if (!res.ok) {
      throw new Error(`Replicate returned HTTP ${res.status}: ${await res.text()}`)
    }
    let prediction = (await res.json()) as {
      status: string
      output?: unknown
      error?: unknown
      urls?: { get?: string }
    }

    const deadline = Date.now() + PREDICTION_DEADLINE_MS
    while (prediction.status === 'starting' || prediction.status === 'processing') {
      if (Date.now() > deadline) {
        throw new Error(`prediction still ${prediction.status} after ${PREDICTION_DEADLINE_MS / 1000}s`)
      }
      const pollUrl = prediction.urls?.get
      if (pollUrl === undefined) {
        throw new Error(`prediction is ${prediction.status} but has no polling URL: ${JSON.stringify(prediction)}`)
      }
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
      const pollRes = await this.replicateFetch(pollUrl, { headers: this.authHeaders() })
      if (!pollRes.ok) {
        throw new Error(`polling prediction returned HTTP ${pollRes.status}: ${await pollRes.text()}`)
      }
      prediction = await pollRes.json()
    }

    if (prediction.status !== 'succeeded') {
      throw new Error(`prediction ${prediction.status}: ${JSON.stringify(prediction.error ?? prediction)}`)
    }
    const output = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output
    if (typeof output !== 'string') {
      throw new Error(`unexpected prediction output shape: ${JSON.stringify(prediction.output)}`)
    }
    return output
  }

  // Downloads to <dest>.tmp then renames, so an interrupted download never
  // leaves a truncated clip at the real path.
  async downloadTo(url: string, dest: string): Promise<void> {
    const res = await fetch(url)
    if (!res.ok) {
      throw new Error(`downloading clip returned HTTP ${res.status}`)
    }
    const tmpPath = `${dest}.tmp`
    try {
      await writeFile(tmpPath, Buffer.from(await res.arrayBuffer()))
      await rename(tmpPath, dest)
    } catch (err) {
      await rm(tmpPath, { force: true })
      throw err
    }
  }

  private extensionFor(outputUrl: string): string {
    const ext = path.extname(new URL(outputUrl).pathname).replace('.', '').toLowerCase()
    if (ext === '') {
      console.warn(`Warning: output URL has no file extension; saving as .wav (${outputUrl})`)
      return 'wav'
    }
    if (ext !== 'wav') {
      console.warn(`Warning: model produced .${ext}, not the .wav this repo's audio convention expects.`)
    }
    return ext
  }

  async run(): Promise<number> {
    const jobs = this.collectJobs()
    await this.loadManifest()

    if (this.opts.dryRun) {
      for (const job of jobs) {
        console.log(`would generate     ${job.label}: "${job.transcript}"`)
      }
      return 0
    }

    await this.resolveInputParams()
    await mkdir(OUTPUT_DIR, { recursive: true })

    let generated = 0
    const failed: string[] = []

    // Every requested clip is regenerated, overwriting whatever audio
    // already exists — use --only to limit a run to a single label.
    for (const job of jobs) {
      try {
        console.log(`generating            ${job.label}: "${job.transcript}"`)
        const outputUrl = await this.generateClip(job)
        const dest = path.join(OUTPUT_DIR, `${job.label}.${this.extensionFor(outputUrl)}`)
        await this.downloadTo(outputUrl, dest)
        this.manifest[job.label] = {
          file: path.relative(REPO_ROOT, dest).replaceAll('\\', '/'),
          hash: job.hash,
          generatedAt: new Date().toISOString(),
        }
        // Saved per clip, not per run, so an aborted batch still records
        // exactly which settings produced the clips that did land.
        await this.saveManifest()
        console.log(`saved                 ${path.relative(REPO_ROOT, dest)}`)
        generated += 1
      } catch (err) {
        console.error(`FAILED                ${job.label}: ${(err as Error).message}`)
        failed.push(job.label)
        if (err instanceof RateLimitError) {
          const remaining = jobs.slice(jobs.indexOf(job) + 1).map((j) => j.label)
          if (remaining.length > 0) {
            console.error(`Aborting: ${remaining.length} clip(s) not attempted: ${remaining.join(', ')}`)
          }
          failed.push(...remaining)
          break
        }
      }
    }

    console.log(`\nDone: ${generated} generated, ${failed.length} failed.`)
    if (failed.length > 0) {
      console.error(`Failed labels: ${failed.join(', ')} — re-run with --only=<label> to retry individually.`)
      return 1
    }
    return 0
  }
}

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: {
      'dry-run': { type: 'boolean', default: false },
      only: { type: 'string' },
      'print-schema': { type: 'boolean', default: false },
    },
  })

  const apiToken = process.env.REPLICATE_API_TOKEN
  const model = process.env.REPLICATE_TTS_MODEL ?? DEFAULT_MODEL
  const voiceId = process.env.REPLICATE_TTS_VOICE

  const generator = new VoiceClipGenerator({
    apiToken,
    model,
    voiceId,
    dryRun: values['dry-run'],
    only: values.only,
  })

  if (!values['dry-run'] && (apiToken === undefined || apiToken === '')) {
    console.error(
      'REPLICATE_API_TOKEN is not set.\n' +
        '  1. Create a .env file in the repo root (it is gitignored)\n' +
        '  2. Add: REPLICATE_API_TOKEN=<token from https://replicate.com/account/api-tokens>\n' +
        '(--dry-run works without a token.)',
    )
    return 1
  }

  if (values['print-schema']) {
    console.log(JSON.stringify((await generator.fetchInputSchema()) ?? 'schema unavailable', null, 2))
    return 0
  }

  console.log(`Model: ${model}${voiceId !== undefined ? `, voice: ${voiceId}` : ''}`)
  return generator.run()
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
