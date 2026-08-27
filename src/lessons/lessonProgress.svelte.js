import {
  createInitialProgress,
  advanceInstructionStep as advanceInstructionStepPure,
  submitProblemAnswer as submitProblemAnswerPure,
  isMultiplayerUnlocked as isMultiplayerUnlockedPure,
} from './progression.js'

export function createLessonProgressStore({ content, storage }) {
  let progress = $state.raw(null)
  let error = $state.raw(null)

  const ready = (async () => {
    const stored = await storage.loadProgress()
    progress = stored ?? createInitialProgress(content)
    if (!stored) {
      await storage.saveProgress(progress)
    }
  })()

  async function advanceInstructionStep() {
    progress = advanceInstructionStepPure(progress, content)
    try {
      await storage.saveProgress(progress)
    } catch (err) {
      error = err
    }
  }

  async function submitProblemAnswer(value) {
    progress = submitProblemAnswerPure(progress, content, value)
    try {
      await storage.saveProgress(progress)
    } catch (err) {
      error = err
    }
  }

  async function resetProgress() {
    progress = createInitialProgress(content)
    try {
      await storage.clearProgress()
      await storage.saveProgress(progress)
    } catch (err) {
      error = err
    }
  }

  return {
    ready,
    get progress() {
      return progress
    },
    get error() {
      return error
    },
    get isMultiplayerUnlocked() {
      return progress ? isMultiplayerUnlockedPure(progress) : false
    },
    get currentProblem() {
      if (!progress || progress.phase !== 'problems') return null
      const problemId = progress.problems.sequence[progress.problems.currentIndex]
      return content.problems.find((problem) => problem.id === problemId) ?? null
    },
    get lastAttempt() {
      if (!progress || progress.phase !== 'problems') return null
      const problemId = progress.problems.sequence[progress.problems.currentIndex]
      const attemptsForProblem = progress.problems.attempts[problemId]
      return attemptsForProblem && attemptsForProblem.length > 0
        ? attemptsForProblem[attemptsForProblem.length - 1]
        : null
    },
    advanceInstructionStep,
    submitProblemAnswer,
    resetProgress,
  }
}
