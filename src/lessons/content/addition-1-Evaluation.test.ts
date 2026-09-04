import { describe, expect, it } from 'vitest'
import {
  ADDITION_1_EVALUATION_CONFIG,
  createAddition1EvaluationRecorder,
  partialCountingEvaluator,
  solvedWithoutMergeEvaluator,
} from './addition-1-Evaluation.js'
import { addition1Content } from './addition-1-Content.js'
import type { Addition1Problem } from './addition-1-Content.js'
import { EvaluationStorage } from '../evaluation/evaluationStorage.js'
import type { EvaluationRecord } from '../evaluation/evaluationStorage.js'
import type { InteractionEvent, SubmitContext } from '../evaluation/evaluationTypes.js'
import { normalizeAnswer } from '../progression.js'

function findProblem(id: string): Addition1Problem {
  const problem = addition1Content.problems.find((p) => p.id === id)
  if (!problem) throw new Error(`missing test problem ${id}`)
  return problem
}

function makeCtx(
  problemId: string,
  rawValue: string,
  overrides: Partial<SubmitContext<Addition1Problem>> = {}
): SubmitContext<Addition1Problem> {
  const problem = findProblem(problemId)
  const normalizedValue = normalizeAnswer(rawValue)
  return {
    problem,
    rawValue,
    normalizedValue,
    correct: normalizedValue === problem.answer,
    attemptIndex: 0,
    problemShownAt: 0,
    submittedAt: 5000,
    events: [],
    config: ADDITION_1_EVALUATION_CONFIG,
    ...overrides,
  }
}

describe('partialCountingEvaluator', () => {
  // p4: 5 balls + 1 ball = 6
  it('fires when the answer equals the first group count', () => {
    const findings = partialCountingEvaluator.evaluate(makeCtx('p4', '5'))
    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({
      signal: 'partial-counting',
      polarity: 'concern',
      detail: { value: 5, matchedGroupIndexes: [0], groupCounts: [5, 1] },
    })
  })

  it('fires when the answer equals the second group count', () => {
    const findings = partialCountingEvaluator.evaluate(makeCtx('p4', '1'))
    expect(findings[0].detail).toMatchObject({ matchedGroupIndexes: [1] })
  })

  it('matches both groups when they have the same count', () => {
    // p2: 2 balls + 2 balls = 4
    const findings = partialCountingEvaluator.evaluate(makeCtx('p2', '2'))
    expect(findings[0].detail).toMatchObject({ matchedGroupIndexes: [0, 1], groupCounts: [2, 2] })
  })

  it('does not fire on a wrong answer that matches no group', () => {
    expect(partialCountingEvaluator.evaluate(makeCtx('p4', '9'))).toHaveLength(0)
  })

  it('does not fire on a correct answer, even if a group happened to match', () => {
    // p8: 0 balls + 0 balls = 0 — the correct answer equals both groups' counts.
    expect(partialCountingEvaluator.evaluate(makeCtx('p8', '0'))).toHaveLength(0)
  })

  it('does not fire on non-numeric input', () => {
    expect(partialCountingEvaluator.evaluate(makeCtx('p4', 'two'))).toHaveLength(0)
  })
})

describe('solvedWithoutMergeEvaluator', () => {
  const pushEvent: InteractionEvent = { type: 'action', t: 2000, name: 'push-together' }

  it('fires on a correct answer with no push-together action in the episode', () => {
    const findings = solvedWithoutMergeEvaluator.evaluate(makeCtx('p4', '6'))
    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({ signal: 'solved-without-merge', polarity: 'positive' })
  })

  it('does not fire when the student pushed the groups together first', () => {
    const findings = solvedWithoutMergeEvaluator.evaluate(makeCtx('p4', '6', { events: [pushEvent] }))
    expect(findings).toHaveLength(0)
  })

  it('does not fire on a wrong answer', () => {
    expect(solvedWithoutMergeEvaluator.evaluate(makeCtx('p4', '5'))).toHaveLength(0)
  })

  it('is not fooled by other action names', () => {
    const otherAction: InteractionEvent = { type: 'action', t: 2000, name: 'something-else' }
    const findings = solvedWithoutMergeEvaluator.evaluate(makeCtx('p4', '6', { events: [otherAction] }))
    expect(findings).toHaveLength(1)
  })
})

// Tag priority through the real lesson recorder: roster order decides which
// signal becomes the attempt's studentEvaluationTag.
describe('createAddition1EvaluationRecorder tag priority', () => {
  class MemoryStorage extends EvaluationStorage {
    record: EvaluationRecord | null = null
    async load(): Promise<EvaluationRecord | null> {
      return this.record
    }
    async save(record: EvaluationRecord): Promise<void> {
      this.record = record
    }
    async clear(): Promise<void> {
      this.record = null
    }
  }

  async function makeRecorder() {
    const clock = { now: 0 }
    const recorder = createAddition1EvaluationRecorder(new MemoryStorage(), () => clock.now)
    await recorder.ready
    return { recorder, clock }
  }

  it('prefers partial-counting over off-by-one when both fire', async () => {
    // p1: 1 + 1 = 2; answering '1' is both group's count and one off from
    // the correct answer.
    const { recorder } = await makeRecorder()
    recorder.beginProblem(findProblem('p1'))
    const result = recorder.recordSubmit('1')
    expect(result.findings.map((f) => f.signal)).toEqual(
      expect.arrayContaining(['partial-counting', 'off-by-one'])
    )
    expect(result.primaryEvaluationTag).toBe('partial-counting')
  })

  it('prefers partial-counting over far-off when both fire', async () => {
    // p7: 2 + 7 = 9; answering '2' matches the first group AND is 7 away
    // from correct — the misconception diagnosis wins over the distance.
    const { recorder } = await makeRecorder()
    recorder.beginProblem(findProblem('p7'))
    const result = recorder.recordSubmit('2')
    expect(result.findings.map((f) => f.signal)).toEqual(
      expect.arrayContaining(['partial-counting', 'far-off'])
    )
    expect(result.primaryEvaluationTag).toBe('partial-counting')
  })

  it('tags far-off when a wrong answer matches no more specific concern', async () => {
    // p1: 1 + 1 = 2; '9' matches neither group count and is not adjacent.
    const { recorder } = await makeRecorder()
    recorder.beginProblem(findProblem('p1'))
    const result = recorder.recordSubmit('9')
    expect(result.primaryEvaluationTag).toBe('far-off')
    const farOff = result.findings.find((f) => f.signal === 'far-off')
    expect(farOff?.detail).toMatchObject({ value: 9, answer: 2, offBy: 7 })
  })

  it('tags a fast unassisted solve as fast-correct (beats solved-without-merge)', async () => {
    const { recorder, clock } = await makeRecorder()
    recorder.beginProblem(findProblem('p1'))
    clock.now = 5000
    const result = recorder.recordSubmit('2')
    expect(result.findings.map((f) => f.signal)).toEqual(
      expect.arrayContaining(['fast-correct', 'solved-without-merge'])
    )
    expect(result.primaryEvaluationTag).toBe('fast-correct')
  })

  it('tags a slow unassisted solve as solved-without-merge', async () => {
    const { recorder, clock } = await makeRecorder()
    recorder.beginProblem(findProblem('p1'))
    clock.now = 15_000 // past the 10s fast-answer window
    const result = recorder.recordSubmit('2')
    expect(result.findings.map((f) => f.signal)).toEqual(['solved-without-merge'])
    expect(result.primaryEvaluationTag).toBe('solved-without-merge')
  })

  it('yields no tag for a slow solve after pushing the groups together', async () => {
    const { recorder, clock } = await makeRecorder()
    recorder.beginProblem(findProblem('p1'))
    clock.now = 2000
    recorder.recordEvent({ type: 'action', name: 'push-together' })
    clock.now = 15_000
    const result = recorder.recordSubmit('2')
    expect(result.primaryEvaluationTag).toBeNull()
  })

  it('tags invalid input on a non-numeric submit', async () => {
    const { recorder } = await makeRecorder()
    recorder.beginProblem(findProblem('p1'))
    const result = recorder.recordSubmit('abc')
    expect(result.primaryEvaluationTag).toBe('invalid-input')
  })
})
