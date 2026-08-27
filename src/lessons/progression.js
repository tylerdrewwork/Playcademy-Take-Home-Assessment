export function createInitialProgress(content) {
  const now = Date.now()
  return {
    lessonId: content.lessonId,
    contentVersion: content.contentVersion,
    phase: 'instruction',
    instruction: {
      currentStepIndex: 0,
      completedAt: null,
    },
    problems: {
      sequence: content.problems.map((problem) => problem.id),
      currentIndex: 0,
      attempts: {},
      adaptations: [],
      completedAt: null,
    },
    lessonCompletedAt: null,
    updatedAt: now,
  }
}

export function advanceInstructionStep(progress, content) {
  if (progress.phase !== 'instruction') return progress

  const now = Date.now()
  const nextIndex = progress.instruction.currentStepIndex + 1
  const reachedEnd = nextIndex >= content.instruction.steps.length

  return {
    ...progress,
    phase: reachedEnd ? 'problems' : 'instruction',
    instruction: {
      currentStepIndex: nextIndex,
      completedAt: reachedEnd ? now : progress.instruction.completedAt,
    },
    updatedAt: now,
  }
}

function normalizeAnswer(value) {
  return typeof value === 'number' ? value : Number(String(value).trim())
}

export function submitProblemAnswer(progress, content, value) {
  if (progress.phase !== 'problems') return progress

  const now = Date.now()
  const { sequence, currentIndex, attempts } = progress.problems
  const problemId = sequence[currentIndex]
  const problem = content.problems.find((candidate) => candidate.id === problemId)
  const correct = normalizeAnswer(value) === normalizeAnswer(problem.answer)

  const attempt = {
    value,
    correct,
    studentErrorTag: null,
    contentVersion: progress.contentVersion,
    timestamp: now,
  }
  const attemptsForProblem = attempts[problemId] ?? []
  const nextAttempts = { ...attempts, [problemId]: [...attemptsForProblem, attempt] }

  if (!correct) {
    return {
      ...progress,
      problems: { ...progress.problems, attempts: nextAttempts },
      updatedAt: now,
    }
  }

  const nextIndex = currentIndex + 1
  const reachedEnd = nextIndex >= sequence.length

  return {
    ...progress,
    phase: reachedEnd ? 'complete' : 'problems',
    problems: {
      ...progress.problems,
      attempts: nextAttempts,
      currentIndex: nextIndex,
      completedAt: reachedEnd ? now : progress.problems.completedAt,
    },
    lessonCompletedAt: reachedEnd ? now : progress.lessonCompletedAt,
    updatedAt: now,
  }
}

export function isMultiplayerUnlocked(progress) {
  return progress.phase === 'complete'
}
