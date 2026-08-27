import {
  createInitialProgress,
  advanceInstructionStep as advanceInstructionStepPure,
  submitProblemAnswer as submitProblemAnswerPure,
  isMultiplayerUnlocked as isMultiplayerUnlockedPure,
} from './progression.js'

export function createLessonProgressStore({ content, storage }) {
  let progress = $state(null)

  const ready = (async () => {
    const stored = await storage.loadProgress()
    progress = stored ?? createInitialProgress(content)
    if (!stored) {
      await storage.saveProgress(progress)
    }
  })()

  async function advanceInstructionStep() {
    progress = advanceInstructionStepPure(progress, content)
    await storage.saveProgress(progress)
  }

  async function submitProblemAnswer(value) {
    progress = submitProblemAnswerPure(progress, content, value)
    await storage.saveProgress(progress)
  }

  async function resetProgress() {
    progress = createInitialProgress(content)
    await storage.clearProgress()
    await storage.saveProgress(progress)
  }

  return {
    ready,
    get progress() {
      return progress
    },
    get isMultiplayerUnlocked() {
      return progress ? isMultiplayerUnlockedPure(progress) : false
    },
    get currentProblem() {
      if (!progress || progress.phase !== 'problems') return null
      const problemId = progress.problems.sequence[progress.problems.currentIndex]
      return content.problems.find((problem) => problem.id === problemId) ?? null
    },
    advanceInstructionStep,
    submitProblemAnswer,
    resetProgress,
  }
}
