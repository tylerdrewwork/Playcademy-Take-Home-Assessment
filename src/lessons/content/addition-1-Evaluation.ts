import type { Addition1Problem } from './addition-1-Content.js'
import { addition1Content } from './addition-1-Content.js'
import type { EvaluationConfig, SubmitEvaluator } from '../evaluation/evaluationTypes.js'
import { DEFAULT_EVALUATION_CONFIG } from '../evaluation/evaluationTypes.js'
import {
  fastCorrectEvaluator,
  invalidInputEvaluator,
  offByOneEvaluator,
} from '../evaluation/submitEvaluators.js'
import { detectDistraction, detectRageClicks } from '../evaluation/behavioralDetectors.js'
import { EvaluationRecorder } from '../evaluation/evaluationRecorder.js'
import type { EvaluationStorage } from '../evaluation/evaluationStorage.js'

// The single home for this lesson's thresholds. fastAnswerMs: a correct
// first attempt within 10s of the problem appearing counts as fluent.
export const ADDITION_1_EVALUATION_CONFIG: EvaluationConfig = {
  ...DEFAULT_EVALUATION_CONFIG,
  fastAnswerMs: 10_000,
}

// The wrong answer equals the count of a single group — the student counted
// one group instead of combining both. Lesson-specific: needs `groups`.
export const partialCountingEvaluator: SubmitEvaluator<Addition1Problem> = {
  id: 'partial-counting',
  evaluate(ctx) {
    if (ctx.correct || Number.isNaN(ctx.normalizedValue)) return []
    const matchedGroupIndexes = ctx.problem.groups
      .map((group, index) => (group.count === ctx.normalizedValue ? index : -1))
      .filter((index) => index !== -1)
    if (matchedGroupIndexes.length === 0) return []
    return [
      {
        signal: 'partial-counting',
        polarity: 'concern',
        attemptIndex: ctx.attemptIndex,
        t: ctx.submittedAt,
        detail: {
          value: ctx.normalizedValue,
          matchedGroupIndexes,
          groupCounts: ctx.problem.groups.map((group) => group.count),
        },
      },
    ]
  },
}

// Correct without ever clicking "Push them together" — the student combined
// the groups mentally instead of leaning on the visual merge.
export const solvedWithoutMergeEvaluator: SubmitEvaluator<Addition1Problem> = {
  id: 'solved-without-merge',
  evaluate(ctx) {
    if (!ctx.correct) return []
    const merged = ctx.events.some(
      (event) => event.type === 'action' && event.name === 'push-together'
    )
    if (merged) return []
    return [
      {
        signal: 'solved-without-merge',
        polarity: 'positive',
        attemptIndex: ctx.attemptIndex,
        t: ctx.submittedAt,
        detail: { attemptIndex: ctx.attemptIndex },
      },
    ]
  },
}

export function createAddition1EvaluationRecorder(
  storage: EvaluationStorage,
  clock?: () => number
): EvaluationRecorder<Addition1Problem> {
  return new EvaluationRecorder<Addition1Problem>({
    lessonId: addition1Content.lessonId,
    contentVersion: addition1Content.contentVersion,
    config: ADDITION_1_EVALUATION_CONFIG,
    // Roster order is tag priority: on a wrong answer the misconception
    // tags win in this order; on a correct answer 'fast-correct' beats
    // 'solved-without-merge'.
    submitEvaluators: [
      partialCountingEvaluator,
      offByOneEvaluator,
      invalidInputEvaluator,
      fastCorrectEvaluator,
      solvedWithoutMergeEvaluator,
    ],
    behavioralDetectors: [detectDistraction, detectRageClicks],
    storage,
    clock,
  })
}
