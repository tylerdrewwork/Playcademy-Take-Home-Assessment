import { describe, expect, it } from 'vitest'
import { EvaluationRecorder } from './evaluationRecorder.js'
import { EVALUATION_SCHEMA_VERSION, EvaluationStorage } from './evaluationStorage.js'
import type { EvaluationRecord } from './evaluationStorage.js'
import { DEFAULT_EVALUATION_CONFIG } from './evaluationTypes.js'
import type {
  BehavioralDetector,
  EvaluationConfig,
  InteractionEvent,
  SubmitEvaluator,
} from './evaluationTypes.js'
import { detectRageClicks } from './behavioralDetectors.js'
import { fastCorrectEvaluator, offByOneEvaluator } from './submitEvaluators.js'

const p1 = { id: 'p1', prompt: '', answer: 5 }
const p2 = { id: 'p2', prompt: '', answer: 6 }

class FakeEvaluationStorage extends EvaluationStorage {
  record: EvaluationRecord | null = null
  saveCount = 0
  async load(): Promise<EvaluationRecord | null> {
    return this.record ? structuredClone(this.record) : null
  }
  async save(record: EvaluationRecord): Promise<void> {
    this.saveCount++
    this.record = structuredClone(record)
  }
  async clear(): Promise<void> {
    this.record = null
  }
}

// The recorder queues saves as fire-and-forget promises; one macrotask turn
// lets the whole chain settle.
const flushSaves = () => new Promise((resolve) => setTimeout(resolve, 0))

interface Harness {
  storage?: EvaluationStorage
  config?: Partial<EvaluationConfig>
  submitEvaluators?: SubmitEvaluator[]
  behavioralDetectors?: BehavioralDetector[]
}

function makeHarness(opts: Harness = {}) {
  const clock = { now: 0 }
  const storage = opts.storage ?? new FakeEvaluationStorage()
  const recorder = new EvaluationRecorder({
    lessonId: 'test-lesson',
    contentVersion: 1,
    config: { ...DEFAULT_EVALUATION_CONFIG, ...opts.config },
    submitEvaluators: opts.submitEvaluators ?? [offByOneEvaluator, fastCorrectEvaluator],
    behavioralDetectors: opts.behavioralDetectors ?? [],
    storage,
    clock: () => clock.now,
  })
  return { recorder, storage: storage as FakeEvaluationStorage, clock }
}

describe('EvaluationRecorder', () => {
  it('stamps problemId and contentVersion on submit findings and returns the tag', async () => {
    const { recorder, clock } = makeHarness()
    await recorder.ready
    recorder.beginProblem(p1)
    clock.now = 5000
    const result = recorder.recordSubmit(' 4 ') // normalizes to 4: off by one
    expect(result.findings).toHaveLength(1)
    expect(result.findings[0]).toMatchObject({
      signal: 'off-by-one',
      problemId: 'p1',
      contentVersion: 1,
      attemptIndex: 0,
      t: 5000,
    })
    expect(result.primaryEvaluationTag).toBe('off-by-one')
  })

  it('increments attemptIndex across submits and resets it on a new problem', async () => {
    const { recorder, clock } = makeHarness()
    await recorder.ready
    recorder.beginProblem(p1)
    clock.now = 1000
    recorder.recordSubmit('3')
    clock.now = 2000
    const second = recorder.recordSubmit('4')
    expect(second.findings[0]).toMatchObject({ signal: 'off-by-one', attemptIndex: 1 })
    recorder.beginProblem(p2)
    clock.now = 3000
    const fresh = recorder.recordSubmit('5')
    expect(fresh.findings[0]).toMatchObject({ signal: 'off-by-one', attemptIndex: 0, problemId: 'p2' })
  })

  it('ignores events and submits when no problem is active', async () => {
    const { recorder } = makeHarness()
    await recorder.ready
    recorder.recordEvent({ type: 'pointer-down', x: 0, y: 0, target: null })
    const result = recorder.recordSubmit('5')
    expect(result.findings).toHaveLength(0)
    expect(result.primaryEvaluationTag).toBeNull()
    expect(recorder.findings).toHaveLength(0)
  })

  describe('primaryEvaluationTag', () => {
    const concern = (signal: string): SubmitEvaluator => ({
      id: signal,
      evaluate: (ctx) => [
        { signal, polarity: 'concern', attemptIndex: ctx.attemptIndex, t: ctx.submittedAt },
      ],
    })
    const positive = (signal: string): SubmitEvaluator => ({
      id: signal,
      evaluate: (ctx) =>
        ctx.correct
          ? [{ signal, polarity: 'positive', attemptIndex: ctx.attemptIndex, t: ctx.submittedAt }]
          : [],
    })

    it('picks the first concern in roster order', async () => {
      const { recorder } = makeHarness({
        submitEvaluators: [concern('first-concern'), concern('second-concern'), positive('pos')],
      })
      await recorder.ready
      recorder.beginProblem(p1)
      expect(recorder.recordSubmit('4').primaryEvaluationTag).toBe('first-concern')
    })

    it('falls back to the first positive only on a correct answer', async () => {
      const { recorder } = makeHarness({ submitEvaluators: [positive('pos')] })
      await recorder.ready
      recorder.beginProblem(p1)
      expect(recorder.recordSubmit('5').primaryEvaluationTag).toBe('pos')
    })

    it('is null on a wrong answer with no concern findings', async () => {
      const { recorder } = makeHarness({ submitEvaluators: [] })
      await recorder.ready
      recorder.beginProblem(p1)
      expect(recorder.recordSubmit('4').primaryEvaluationTag).toBeNull()
    })

    it('never uses behavioral findings as the tag', async () => {
      const behavioralConcern: BehavioralDetector = () => [
        { signal: 'distracted', polarity: 'concern', attemptIndex: null, t: 0 },
      ]
      const { recorder } = makeHarness({
        submitEvaluators: [],
        behavioralDetectors: [behavioralConcern],
      })
      await recorder.ready
      recorder.beginProblem(p1)
      const result = recorder.recordSubmit('5')
      expect(result.primaryEvaluationTag).toBeNull()
      expect(result.findings.map((f) => f.signal)).toContain('distracted')
    })
  })

  it('dedupes the same behavioral episode across repeated ticks', async () => {
    const constant: BehavioralDetector = () => [
      { signal: 'distracted', polarity: 'concern', attemptIndex: null, t: 0 },
    ]
    const { recorder } = makeHarness({ behavioralDetectors: [constant] })
    await recorder.ready
    recorder.beginProblem(p1)
    recorder.tick()
    recorder.tick()
    recorder.tick()
    expect(recorder.findings.filter((f) => f.signal === 'distracted')).toHaveLength(1)
  })

  it('persists on tick only when a new finding appeared', async () => {
    const constant: BehavioralDetector = () => [
      { signal: 'distracted', polarity: 'concern', attemptIndex: null, t: 0 },
    ]
    const { recorder, storage } = makeHarness({ behavioralDetectors: [constant] })
    await recorder.ready
    recorder.beginProblem(p1)
    await flushSaves()
    const before = storage.saveCount
    recorder.tick() // new finding: persists
    await flushSaves()
    expect(storage.saveCount).toBe(before + 1)
    recorder.tick() // deduped: no persist
    await flushSaves()
    expect(storage.saveCount).toBe(before + 1)
  })

  it('emits a truncated rage-click burst when the problem ends mid-quiet-period', async () => {
    const { recorder, clock } = makeHarness({ behavioralDetectors: [detectRageClicks] })
    await recorder.ready
    recorder.beginProblem(p1)
    for (const t of [100, 300, 500, 700, 900]) {
      clock.now = t
      recorder.recordEvent({ type: 'pointer-down', x: 100, y: 100, target: 'submit' })
    }
    clock.now = 1500 // quiet not yet elapsed (needs 1000ms)
    recorder.endProblem()
    const rage = recorder.findings.find((f) => f.signal === 'rage-clicking')
    expect(rage).toBeDefined()
    expect(rage?.detail).toMatchObject({ truncated: true, count: 5, kind: 'area-clicks' })
    expect(rage?.problemId).toBe('p1')
  })

  it('tracks episodes: no-op on the same problem, finalizes on a new one', async () => {
    const { recorder, clock } = makeHarness()
    await recorder.ready
    recorder.beginProblem(p1)
    recorder.beginProblem(p1) // same id: no new episode
    expect(recorder.episodes).toHaveLength(1)
    recorder.recordSubmit('5')
    clock.now = 9000
    recorder.beginProblem(p2)
    expect(recorder.episodes).toHaveLength(2)
    expect(recorder.episodes[0]).toMatchObject({
      problemId: 'p1',
      endedAt: 9000,
      attemptCount: 1,
      eventCounts: { 'problem-shown': 1, submit: 1 },
    })
    expect(recorder.episodes[1]).toMatchObject({ problemId: 'p2', endedAt: null })
  })

  it('caps the event buffer by shedding oldest pointer-moves first', async () => {
    let seen: readonly InteractionEvent[] = []
    const spy: BehavioralDetector = (events) => {
      seen = [...events]
      return []
    }
    const { recorder } = makeHarness({
      config: { maxBufferedEvents: 5 },
      behavioralDetectors: [spy],
    })
    await recorder.ready
    recorder.beginProblem(p1) // buffer: [problem-shown]
    for (let i = 0; i < 5; i++) {
      recorder.recordEvent({ type: 'pointer-move', x: i, y: 0 })
    }
    recorder.recordEvent({ type: 'pointer-down', x: 0, y: 0, target: 'submit' })
    recorder.tick()
    expect(seen).toHaveLength(5)
    expect(seen[0].type).toBe('problem-shown') // never shed while moves remain
    expect(seen[seen.length - 1].type).toBe('pointer-down')
    expect(seen.filter((e) => e.type === 'pointer-move')).toHaveLength(3)
  })

  it('captures an evaluator exception in error and still runs the rest of the roster', async () => {
    const throwing: SubmitEvaluator = {
      id: 'boom',
      evaluate: () => {
        throw new Error('boom')
      },
    }
    const { recorder } = makeHarness({ submitEvaluators: [throwing, offByOneEvaluator] })
    await recorder.ready
    recorder.beginProblem(p1)
    const result = recorder.recordSubmit('4')
    expect(result.findings.map((f) => f.signal)).toEqual(['off-by-one'])
    expect(recorder.error).toBeInstanceOf(Error)
  })

  it('swallows storage save failures and exposes them via error', async () => {
    class FailingStorage extends EvaluationStorage {
      async load(): Promise<EvaluationRecord | null> {
        return null
      }
      async save(): Promise<void> {
        throw new Error('save failed')
      }
      async clear(): Promise<void> {}
    }
    const { recorder } = makeHarness({ storage: new FailingStorage() })
    await recorder.ready
    recorder.beginProblem(p1)
    expect(() => recorder.recordSubmit('4')).not.toThrow()
    await flushSaves()
    expect(recorder.error).toBeInstanceOf(Error)
    // In-memory findings are still intact despite the sink failing.
    expect(recorder.findings.map((f) => f.signal)).toEqual(['off-by-one'])
  })

  it('keeps working when the stored record fails to load', async () => {
    class FailingLoadStorage extends EvaluationStorage {
      async load(): Promise<EvaluationRecord | null> {
        throw new Error('load failed')
      }
      async save(): Promise<void> {}
      async clear(): Promise<void> {}
    }
    const { recorder } = makeHarness({ storage: new FailingLoadStorage() })
    await recorder.ready
    expect(recorder.error).toBeInstanceOf(Error)
    recorder.beginProblem(p1)
    expect(recorder.recordSubmit('4').primaryEvaluationTag).toBe('off-by-one')
  })

  it('merges a matching stored record in front of findings recorded before load finished', async () => {
    const storage = new FakeEvaluationStorage()
    storage.record = {
      schemaVersion: EVALUATION_SCHEMA_VERSION,
      lessonId: 'test-lesson',
      contentVersion: 1,
      startedAt: 0,
      updatedAt: 0,
      findings: [
        {
          signal: 'stored-finding',
          polarity: 'concern',
          problemId: 'p0',
          attemptIndex: 0,
          t: 42,
          contentVersion: 1,
        },
      ],
      episodes: [{ problemId: 'p0', shownAt: 0, endedAt: 10, attemptCount: 1, eventCounts: {} }],
    }
    const { recorder, clock } = makeHarness({ storage })
    // Record synchronously, before the async load settles.
    recorder.beginProblem(p1)
    clock.now = 5000
    recorder.recordSubmit('4')
    await recorder.ready
    expect(recorder.findings.map((f) => f.signal)).toEqual(['stored-finding', 'off-by-one'])
    expect(recorder.episodes.map((e) => e.problemId)).toEqual(['p0', 'p1'])
  })

  it('discards a stored record whose contentVersion does not match', async () => {
    const storage = new FakeEvaluationStorage()
    storage.record = {
      schemaVersion: EVALUATION_SCHEMA_VERSION,
      lessonId: 'test-lesson',
      contentVersion: 999,
      startedAt: 0,
      updatedAt: 0,
      findings: [
        {
          signal: 'stale-finding',
          polarity: 'concern',
          problemId: 'p0',
          attemptIndex: 0,
          t: 42,
          contentVersion: 999,
        },
      ],
      episodes: [],
    }
    const { recorder } = makeHarness({ storage })
    await recorder.ready
    await flushSaves()
    expect(recorder.findings).toHaveLength(0)
    expect(storage.record?.contentVersion).toBe(1) // overwritten with a fresh record
  })

  it('reset clears findings, episodes, and the stored record', async () => {
    const { recorder, storage } = makeHarness()
    await recorder.ready
    recorder.beginProblem(p1)
    recorder.recordSubmit('4')
    await flushSaves()
    expect(storage.record?.findings).toHaveLength(1)
    await recorder.reset()
    expect(recorder.findings).toHaveLength(0)
    expect(recorder.episodes).toHaveLength(0)
    expect(storage.record?.findings).toHaveLength(0)
    // A previously-recorded finding can be recorded again after reset.
    recorder.beginProblem(p1)
    expect(recorder.recordSubmit('4').findings).toHaveLength(1)
  })
})
