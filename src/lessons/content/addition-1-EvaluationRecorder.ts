import { createAddition1EvaluationRecorder } from './addition-1-Evaluation.js'
import { IndexedDbEvaluationStorage } from '../evaluation/evaluationStorage.js'

// Module-level singleton, mirroring addition1LessonProgress: findings
// survive component remounts and AdminTools navigation, and AdminTools can
// read and reset the same instance the problems screen writes to.
export const addition1EvaluationRecorder = createAddition1EvaluationRecorder(
  new IndexedDbEvaluationStorage()
)
