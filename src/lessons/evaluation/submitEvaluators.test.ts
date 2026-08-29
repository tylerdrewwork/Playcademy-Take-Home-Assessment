import { describe, expect, it } from 'vitest'
import { fastCorrectEvaluator, invalidInputEvaluator, offByOneEvaluator } from './submitEvaluators.js'
import { DEFAULT_EVALUATION_CONFIG } from './evaluationTypes.js'
import type { InteractionEvent, SubmitContext } from './evaluationTypes.js'
import { normalizeAnswer } from '../progression.js'

const problem = { id: 'p1', prompt: '', answer: 5 }

function makeCtx(rawValue: string, overrides: Partial<SubmitContext> = {}): SubmitContext {
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
    config: DEFAULT_EVALUATION_CONFIG,
    ...overrides,
  }
}

describe('offByOneEvaluator', () => {
  it('fires when the answer is one too low', () => {
    const findings = offByOneEvaluator.evaluate(makeCtx('4'))
    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({
      signal: 'off-by-one',
      polarity: 'concern',
      attemptIndex: 0,
      t: 5000,
      detail: { value: 4, answer: 5 },
    })
  })

  it('fires when the answer is one too high', () => {
    expect(offByOneEvaluator.evaluate(makeCtx('6'))).toHaveLength(1)
  })

  it('does not fire on a non-adjacent wrong answer', () => {
    expect(offByOneEvaluator.evaluate(makeCtx('3'))).toHaveLength(0)
    expect(offByOneEvaluator.evaluate(makeCtx('7'))).toHaveLength(0)
  })

  it('does not fire on a correct answer', () => {
    expect(offByOneEvaluator.evaluate(makeCtx('5'))).toHaveLength(0)
  })

  it('does not fire on a non-numeric answer', () => {
    expect(offByOneEvaluator.evaluate(makeCtx('abc'))).toHaveLength(0)
  })
})

describe('invalidInputEvaluator', () => {
  it('fires when the submitted value itself is not a number', () => {
    const findings = invalidInputEvaluator.evaluate(makeCtx('abc'))
    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({
      signal: 'invalid-input',
      polarity: 'concern',
      detail: { rawValue: 'abc', submittedInvalid: true, typedInvalid: false },
    })
  })

  it('fires when letters were typed during the attempt but corrected before submitting', () => {
    const events: InteractionEvent[] = [
      { type: 'nonnumeric-input', t: 1000, value: '5a' },
      { type: 'input-change', t: 2000, value: '5' },
      { type: 'submit', t: 5000, value: '5', correct: true, attemptIndex: 0 },
    ]
    const findings = invalidInputEvaluator.evaluate(makeCtx('5', { events }))
    expect(findings).toHaveLength(1)
    expect(findings[0].detail).toMatchObject({ submittedInvalid: false, typedInvalid: true })
  })

  it('ignores non-numeric typing that belonged to a previous attempt', () => {
    const events: InteractionEvent[] = [
      { type: 'nonnumeric-input', t: 1000, value: 'x' },
      { type: 'submit', t: 2000, value: 'x', correct: false, attemptIndex: 0 },
      { type: 'input-change', t: 3000, value: '4' },
      { type: 'submit', t: 5000, value: '4', correct: false, attemptIndex: 1 },
    ]
    const findings = invalidInputEvaluator.evaluate(makeCtx('4', { events, attemptIndex: 1 }))
    expect(findings).toHaveLength(0)
  })

  it('does not fire on a clean numeric attempt', () => {
    const events: InteractionEvent[] = [
      { type: 'input-change', t: 1000, value: '5' },
      { type: 'submit', t: 5000, value: '5', correct: true, attemptIndex: 0 },
    ]
    expect(invalidInputEvaluator.evaluate(makeCtx('5', { events }))).toHaveLength(0)
  })
})

describe('fastCorrectEvaluator', () => {
  it('fires on a correct first attempt within the window', () => {
    const findings = fastCorrectEvaluator.evaluate(makeCtx('5', { submittedAt: 4000 }))
    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({
      signal: 'fast-correct',
      polarity: 'positive',
      detail: { elapsedMs: 4000 },
    })
  })

  it('fires at exactly the configured boundary', () => {
    const findings = fastCorrectEvaluator.evaluate(makeCtx('5', { submittedAt: 10_000 }))
    expect(findings).toHaveLength(1)
  })

  it('does not fire just past the boundary', () => {
    expect(fastCorrectEvaluator.evaluate(makeCtx('5', { submittedAt: 10_001 }))).toHaveLength(0)
  })

  it('does not fire on a second attempt, even a fast correct one', () => {
    const findings = fastCorrectEvaluator.evaluate(makeCtx('5', { submittedAt: 3000, attemptIndex: 1 }))
    expect(findings).toHaveLength(0)
  })

  it('measures from problem-shown, not from the previous wrong attempt', () => {
    // problemShownAt 0, submitted at 12s: outside the window even if the
    // student "answered quickly" after an earlier wrong try.
    expect(fastCorrectEvaluator.evaluate(makeCtx('5', { submittedAt: 12_000 }))).toHaveLength(0)
  })

  it('does not fire on a wrong answer', () => {
    expect(fastCorrectEvaluator.evaluate(makeCtx('4', { submittedAt: 3000 }))).toHaveLength(0)
  })
})
