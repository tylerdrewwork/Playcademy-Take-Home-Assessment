import type { InteractionEvent, SubmitEvaluator } from './evaluationTypes.js'

// Wrong by exactly one — usually a miscount of a single object.
export const offByOneEvaluator: SubmitEvaluator = {
  id: 'off-by-one',
  evaluate(ctx) {
    const value = ctx.normalizedValue
    if (ctx.correct || Number.isNaN(value) || Math.abs(value - ctx.problem.answer) !== 1) {
      return []
    }
    return [
      {
        signal: 'off-by-one',
        polarity: 'concern',
        attemptIndex: ctx.attemptIndex,
        t: ctx.submittedAt,
        detail: { value, answer: ctx.problem.answer },
      },
    ]
  },
}

// Wrong by a lot — more than config.farOffDistance away from the correct
// answer. Where off-by-one suggests a single-object miscount, this suggests
// guessing or a misunderstanding of what's being asked.
export const farOffEvaluator: SubmitEvaluator = {
  id: 'far-off',
  evaluate(ctx) {
    const value = ctx.normalizedValue
    if (ctx.correct || Number.isNaN(value)) return []
    const offBy = Math.abs(value - ctx.problem.answer)
    if (offBy <= ctx.config.farOffDistance) return []
    return [
      {
        signal: 'far-off',
        polarity: 'concern',
        attemptIndex: ctx.attemptIndex,
        t: ctx.submittedAt,
        detail: { value, answer: ctx.problem.answer, offBy },
      },
    ]
  },
}

// Events belonging to the current attempt: everything after the previous
// submit (the current submit event is the last entry in the buffer).
function eventsForCurrentAttempt(events: readonly InteractionEvent[]): readonly InteractionEvent[] {
  let previousSubmitIndex = -1
  for (let i = events.length - 2; i >= 0; i--) {
    if (events[i].type === 'submit') {
      previousSubmitIndex = i
      break
    }
  }
  return events.slice(previousSubmitIndex + 1, events.length - 1)
}

// Non-numeric input: either the submitted value itself isn't a number, or
// the student typed letters/characters during the attempt and corrected
// them before submitting — still diagnostic either way.
export const invalidInputEvaluator: SubmitEvaluator = {
  id: 'invalid-input',
  evaluate(ctx) {
    const submittedInvalid = Number.isNaN(ctx.normalizedValue)
    const typedInvalid = eventsForCurrentAttempt(ctx.events).some(
      (event) => event.type === 'nonnumeric-input'
    )
    if (!submittedInvalid && !typedInvalid) return []
    return [
      {
        signal: 'invalid-input',
        polarity: 'concern',
        attemptIndex: ctx.attemptIndex,
        t: ctx.submittedAt,
        detail: { rawValue: ctx.rawValue, submittedInvalid, typedInvalid },
      },
    ]
  },
}

// Correct on the first try, quickly. The clock starts at problem-shown and
// deliberately never resets on wrong attempts — only a clean first-attempt
// solve counts as fluency.
export const fastCorrectEvaluator: SubmitEvaluator = {
  id: 'fast-correct',
  evaluate(ctx) {
    const elapsedMs = ctx.submittedAt - ctx.problemShownAt
    if (!ctx.correct || ctx.attemptIndex !== 0 || elapsedMs > ctx.config.fastAnswerMs) {
      return []
    }
    return [
      {
        signal: 'fast-correct',
        polarity: 'positive',
        attemptIndex: ctx.attemptIndex,
        t: ctx.submittedAt,
        detail: { elapsedMs },
      },
    ]
  },
}
