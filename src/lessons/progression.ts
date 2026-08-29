import type { LessonContent } from './lessonContent.js'

export type Phase = 'instruction' | 'problems' | 'complete'

export interface Attempt {
  value: string | number
  correct: boolean
  studentErrorTag: string | null
  contentVersion: number
  timestamp: number
}

export interface Progress {
  lessonId: string
  contentVersion: number
  phase: Phase
  instruction: {
    currentScreenIndex: number
    completedAt: number | null
  }
  problems: {
    sequence: string[]
    currentIndex: number
    attempts: Record<string, Attempt[]>
    adaptations: unknown[]
    completedAt: number | null
  }
  lessonCompletedAt: number | null
  updatedAt: number
}

function normalizeAnswer(value: string | number): number {
  if (typeof value === 'number') return value
  const trimmed = String(value).trim()
  return trimmed === '' ? NaN : Number(trimmed)
}

export class Progression {
  static createInitialProgress(content: LessonContent): Progress {
    const now = Date.now()
    return {
      lessonId: content.lessonId,
      contentVersion: content.contentVersion,
      phase: 'instruction',
      instruction: {
        currentScreenIndex: 0,
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

  static advanceInstructionStep(progress: Progress, content: LessonContent): Progress {
    if (progress.phase !== 'instruction') return progress

    const now = Date.now()
    const nextIndex = progress.instruction.currentScreenIndex + 1
    const reachedEnd = nextIndex >= content.instruction.screens.length

    return {
      ...progress,
      phase: reachedEnd ? 'problems' : 'instruction',
      instruction: {
        currentScreenIndex: nextIndex,
        completedAt: reachedEnd ? now : progress.instruction.completedAt,
      },
      updatedAt: now,
    }
  }

  static submitProblemAnswer(progress: Progress, content: LessonContent, value: string | number): Progress {
    if (progress.phase !== 'problems') return progress

    const now = Date.now()
    const { sequence, currentIndex, attempts } = progress.problems
    const problemId = sequence[currentIndex]
    const problem = content.findProblem(problemId)
    if (!problem) return progress
    const correct = normalizeAnswer(value) === normalizeAnswer(problem.answer)

    const attempt: Attempt = {
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

  static jumpToPhase(progress: Progress, phase: 'instruction' | 'problems'): Progress {
    const now = Date.now()

    if (phase === 'instruction') {
      return {
        ...progress,
        phase: 'instruction',
        instruction: { ...progress.instruction, currentScreenIndex: 0 },
        updatedAt: now,
      }
    }

    // After the lesson completes, currentIndex sits one past the end of the
    // sequence, so clamp it back to the last problem when jumping in.
    const lastIndex = Math.max(progress.problems.sequence.length - 1, 0)
    return {
      ...progress,
      phase: 'problems',
      problems: {
        ...progress.problems,
        currentIndex: Math.min(progress.problems.currentIndex, lastIndex),
      },
      updatedAt: now,
    }
  }

  static isMultiplayerUnlocked(progress: Progress): boolean {
    return progress.phase === 'complete'
  }
}
