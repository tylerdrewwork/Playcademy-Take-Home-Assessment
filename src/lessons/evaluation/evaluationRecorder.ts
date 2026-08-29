import type { Problem } from '../lessonContent.js'
import { normalizeAnswer } from '../progression.js'
import type {
  BehavioralDetector,
  EvaluationConfig,
  EvaluatorFinding,
  Finding,
  InteractionEvent,
  SubmitEvaluator,
  UnstampedEvent,
} from './evaluationTypes.js'
import {
  EVALUATION_SCHEMA_VERSION,
  EvaluationStorage,
  type EvaluationRecord,
  type ProblemEpisodeSummary,
} from './evaluationStorage.js'

export interface RecorderOptions<TProblem extends Problem = Problem> {
  lessonId: string
  contentVersion: number
  config: EvaluationConfig
  // Roster order matters: the first matching concern (or, on a correct
  // answer, the first matching positive) becomes the attempt's
  // studentEvaluationTag.
  submitEvaluators: SubmitEvaluator<TProblem>[]
  behavioralDetectors: BehavioralDetector[]
  storage: EvaluationStorage
  // Injectable for tests; defaults to Date.now.
  clock?: () => number
}

export interface SubmitResult {
  findings: Finding[]
  // Single tag for Progression's Attempt.studentEvaluationTag: the first
  // concern finding in roster order, else (when correct) the first positive
  // one, else null. Behavioral findings never become tags.
  primaryEvaluationTag: string | null
}

// Write-only observer of a problem episode. Deliberately rune-free plain
// TS: nothing student-facing reads it, and staying proxy-free guarantees
// records survive IndexedDB's structured clone. It must never throw into
// the lesson — storage failures land in `error` instead, mirroring
// LessonProgress.
export class EvaluationRecorder<TProblem extends Problem = Problem> {
  readonly ready: Promise<void>
  readonly config: EvaluationConfig

  #record: EvaluationRecord
  #recordedKeys = new Set<string>()
  #events: InteractionEvent[] = []
  #currentProblem: TProblem | null = null
  #currentEpisode: ProblemEpisodeSummary | null = null
  #problemShownAt = 0
  #attemptCount = 0
  #error: unknown = null
  #saveQueue: Promise<void> = Promise.resolve()

  #lessonId: string
  #contentVersion: number
  #submitEvaluators: SubmitEvaluator<TProblem>[]
  #behavioralDetectors: BehavioralDetector[]
  #storage: EvaluationStorage
  #clock: () => number

  constructor(opts: RecorderOptions<TProblem>) {
    this.#lessonId = opts.lessonId
    this.#contentVersion = opts.contentVersion
    this.config = opts.config
    this.#submitEvaluators = opts.submitEvaluators
    this.#behavioralDetectors = opts.behavioralDetectors
    this.#storage = opts.storage
    this.#clock = opts.clock ?? Date.now

    this.#record = this.#freshRecord()

    // Events may be recorded before the stored record finishes loading, so
    // start from a fresh in-memory record and merge the stored history in
    // front of anything recorded in the meantime.
    this.ready = this.#loadStored()
  }

  async #loadStored(): Promise<void> {
    let stored: EvaluationRecord | null = null
    try {
      stored = await this.#storage.load()
    } catch (err) {
      this.#error = err
      return
    }
    if (
      stored == null ||
      stored.schemaVersion !== EVALUATION_SCHEMA_VERSION ||
      stored.lessonId !== this.#lessonId ||
      stored.contentVersion !== this.#contentVersion
    ) {
      this.#persist()
      return
    }
    this.#record = {
      ...stored,
      findings: [...stored.findings, ...this.#record.findings],
      episodes: [...stored.episodes, ...this.#record.episodes],
      updatedAt: this.#clock(),
    }
    this.#recordedKeys = new Set(this.#record.findings.map((f) => findingKey(f)))
    this.#persist()
  }

  get error(): unknown {
    return this.#error
  }

  get findings(): readonly Finding[] {
    return this.#record.findings
  }

  get episodes(): readonly ProblemEpisodeSummary[] {
    return this.#record.episodes
  }

  beginProblem(problem: TProblem): void {
    if (this.#currentProblem?.id === problem.id) return
    this.endProblem()

    this.#currentProblem = problem
    this.#problemShownAt = this.#clock()
    this.#attemptCount = 0
    this.#events = []
    this.#currentEpisode = {
      problemId: problem.id,
      shownAt: this.#problemShownAt,
      endedAt: null,
      attemptCount: 0,
      eventCounts: {},
    }
    this.#record.episodes.push(this.#currentEpisode)
    this.recordEvent({ type: 'problem-shown', problemId: problem.id })
    this.#persist()
  }

  recordEvent(event: UnstampedEvent): void {
    if (!this.#currentProblem) return
    const stamped = { ...event, t: this.#clock() } as InteractionEvent
    this.#events.push(stamped)
    if (this.#currentEpisode) {
      this.#currentEpisode.eventCounts[event.type] =
        (this.#currentEpisode.eventCounts[event.type] ?? 0) + 1
    }
    // Cap the buffer; pointer-moves are the only high-volume type, so shed
    // the oldest of those before anything else.
    if (this.#events.length > this.config.maxBufferedEvents) {
      const moveIndex = this.#events.findIndex((e) => e.type === 'pointer-move')
      this.#events.splice(moveIndex === -1 ? 0 : moveIndex, 1)
    }
  }

  recordSubmit(rawValue: string): SubmitResult {
    const problem = this.#currentProblem
    if (!problem) return { findings: [], primaryEvaluationTag: null }

    const submittedAt = this.#clock()
    const normalizedValue = normalizeAnswer(rawValue)
    const correct = normalizedValue === normalizeAnswer(problem.answer)
    const attemptIndex = this.#attemptCount

    this.recordEvent({ type: 'submit', value: rawValue, correct, attemptIndex })
    this.#attemptCount++
    if (this.#currentEpisode) this.#currentEpisode.attemptCount = this.#attemptCount

    const raw: EvaluatorFinding[] = []
    for (const evaluator of this.#submitEvaluators) {
      try {
        raw.push(
          ...evaluator.evaluate({
            problem,
            rawValue,
            normalizedValue,
            correct,
            attemptIndex,
            problemShownAt: this.#problemShownAt,
            submittedAt,
            events: this.#events,
            config: this.config,
          })
        )
      } catch (err) {
        this.#error = err
      }
    }

    const submitFindings = this.#commit(raw)
    const behavioral = this.#runDetectors(submittedAt, false)
    this.#persist()

    const primary =
      submitFindings.find((f) => f.polarity === 'concern') ??
      (correct ? submitFindings.find((f) => f.polarity === 'positive') : undefined)

    return {
      findings: [...submitFindings, ...behavioral],
      primaryEvaluationTag: primary?.signal ?? null,
    }
  }

  // Heartbeat: re-scan the buffer so behavioral episodes are recorded even
  // if the student never submits.
  tick(): void {
    if (!this.#currentProblem) return
    const found = this.#runDetectors(this.#clock(), false)
    if (found.length > 0) this.#persist()
  }

  // Finalize the current episode (problem change or unmount): last detector
  // pass with truncation allowed, stamp endedAt.
  endProblem(): void {
    if (!this.#currentProblem) return
    this.#runDetectors(this.#clock(), true)
    if (this.#currentEpisode) this.#currentEpisode.endedAt = this.#clock()
    this.#currentProblem = null
    this.#currentEpisode = null
    this.#events = []
    this.#persist()
  }

  async reset(): Promise<void> {
    this.#currentProblem = null
    this.#currentEpisode = null
    this.#events = []
    this.#attemptCount = 0
    this.#record = this.#freshRecord()
    this.#recordedKeys.clear()
    try {
      await this.#saveQueue
      await this.#storage.clear()
      await this.#storage.save(this.#record)
    } catch (err) {
      this.#error = err
    }
  }

  #freshRecord(): EvaluationRecord {
    const now = this.#clock()
    return {
      schemaVersion: EVALUATION_SCHEMA_VERSION,
      lessonId: this.#lessonId,
      contentVersion: this.#contentVersion,
      startedAt: now,
      updatedAt: now,
      findings: [],
      episodes: [],
    }
  }

  #runDetectors(now: number, flush: boolean): Finding[] {
    const raw: EvaluatorFinding[] = []
    for (const detector of this.#behavioralDetectors) {
      try {
        raw.push(...detector(this.#events, now, this.config, flush))
      } catch (err) {
        this.#error = err
      }
    }
    return this.#commit(raw)
  }

  // Stamp problemId/contentVersion and drop findings already recorded — the
  // same episode re-detected on every heartbeat re-scan must land once.
  #commit(raw: EvaluatorFinding[]): Finding[] {
    const problemId = this.#currentProblem?.id
    if (!problemId) return []
    const added: Finding[] = []
    for (const entry of raw) {
      const finding: Finding = { ...entry, problemId, contentVersion: this.#contentVersion }
      const key = findingKey(finding)
      if (this.#recordedKeys.has(key)) continue
      this.#recordedKeys.add(key)
      this.#record.findings.push(finding)
      added.push(finding)
    }
    return added
  }

  #persist(): void {
    this.#record.updatedAt = this.#clock()
    const snapshot = this.#record
    this.#saveQueue = this.#saveQueue
      .then(() => this.#storage.save(snapshot))
      .catch((err) => {
        this.#error = err
      })
  }
}

function findingKey(finding: Finding): string {
  return `${finding.signal}|${finding.problemId}|${finding.attemptIndex}|${finding.t}`
}
