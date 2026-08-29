import type { Problem } from '../lessonContent.js'

// One timestamped observation of student behavior during a problem episode.
// Events are buffered in memory only — never persisted — so pointer-move
// volume can stay high-resolution without bloating storage.
export type InteractionEvent =
  | { type: 'problem-shown'; t: number; problemId: string }
  | { type: 'pointer-move'; t: number; x: number; y: number }
  | { type: 'pointer-down'; t: number; target: string | null }
  | { type: 'key-down'; t: number; key: string; target: string | null }
  | { type: 'input-change'; t: number; value: string }
  // The answer field's value now contains non-digit characters — recorded
  // even if the student corrects it before submitting.
  | { type: 'nonnumeric-input'; t: number; value: string }
  // A lesson-defined interaction, e.g. clicking "Push them together".
  | { type: 'action'; t: number; name: string }
  | { type: 'submit'; t: number; value: string; correct: boolean; attemptIndex: number }
  | { type: 'visibility'; t: number; hidden: boolean }

type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never

// What callers pass to EvaluationRecorder.recordEvent — the recorder stamps t.
export type UnstampedEvent = DistributiveOmit<InteractionEvent, 't'>

export type FindingPolarity = 'concern' | 'positive'

export interface Finding {
  signal: string
  polarity: FindingPolarity
  problemId: string
  // null for behavioral findings not tied to a specific submit.
  attemptIndex: number | null
  // Detection timestamp; for behavioral findings, the episode's start time.
  // Doubles as the dedupe key component so re-scans of the same event
  // buffer don't record the same episode twice.
  t: number
  contentVersion: number
  // Plain-cloneable values only — this goes through IndexedDB structured clone.
  detail?: Record<string, unknown>
}

// Evaluators return findings without problemId/contentVersion; the recorder
// stamps those so an evaluator can never mislabel which problem it saw.
export type EvaluatorFinding = Omit<Finding, 'problemId' | 'contentVersion'>

export interface SubmitContext<TProblem extends Problem = Problem> {
  problem: TProblem
  rawValue: string
  // NaN when the submitted value isn't numeric.
  normalizedValue: number
  correct: boolean
  // 0-based within the current problem episode.
  attemptIndex: number
  problemShownAt: number
  submittedAt: number
  events: readonly InteractionEvent[]
  config: EvaluationConfig
}

export interface SubmitEvaluator<TProblem extends Problem = Problem> {
  id: string
  evaluate(ctx: SubmitContext<TProblem>): EvaluatorFinding[]
}

// Behavioral detectors are pure functions over the event buffer — they hold
// no timers or state, so every threshold decision is unit-testable with
// hand-written timestamp arrays. `now` lets a heartbeat confirm episodes
// that end in silence (e.g. rage clicking followed by nothing). `flush`
// marks the final pass of an episode (problem change / unmount), allowing
// detectors to emit not-yet-confirmed episodes flagged as truncated.
export type BehavioralDetector = (
  events: readonly InteractionEvent[],
  now: number,
  config: EvaluationConfig,
  flush?: boolean,
) => EvaluatorFinding[]

export interface EvaluationConfig {
  // A correct first attempt within this window earns the 'fast-correct' tag.
  fastAnswerMs: number
  // Pointer moves are sampled no faster than this at capture time.
  pointerMoveSampleMs: number
  // How often the UI heartbeat asks detectors to re-scan the buffer.
  heartbeatMs: number
  // Event buffer cap; oldest pointer-move samples are dropped first.
  maxBufferedEvents: number
  distraction: {
    // Continuous wandering must last at least this long...
    minDurationMs: number
    // ...and cover at least this much pointer travel...
    minTravelPx: number
    // ...with no gap between move samples longer than this.
    moveGapMaxMs: number
  }
  rageClick: {
    // At least this many clicks/keys...
    minBurstCount: number
    // ...packed within a rolling window this long...
    burstWindowMs: number
    // ...followed by at least this much input silence.
    quietMs: number
  }
}

export const DEFAULT_EVALUATION_CONFIG: EvaluationConfig = {
  fastAnswerMs: 10_000,
  pointerMoveSampleMs: 100,
  heartbeatMs: 1_000,
  maxBufferedEvents: 3_000,
  distraction: { minDurationMs: 8_000, minTravelPx: 1_200, moveGapMaxMs: 1_500 },
  rageClick: { minBurstCount: 5, burstWindowMs: 2_000, quietMs: 4_000 },
}
