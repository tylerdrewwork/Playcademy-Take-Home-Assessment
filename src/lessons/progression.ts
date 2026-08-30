import type { LessonContent } from './lessonContent.js'

export type Phase = 'instruction' | 'problems' | 'complete'

export interface Attempt {
  value: string | number
  correct: boolean
  // Single evaluation signal for this attempt — a misconception tag on a
  // wrong answer (e.g. 'partial-counting') or a mastery tag on a correct
  // one (e.g. 'fast-correct'). The full multi-finding record lives in the
  // evaluation module; this is just the headline.
  studentEvaluationTag: string | null
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

// Exported so the evaluation recorder judges correctness with the exact
// same rule — the two must never disagree.
export function normalizeAnswer(value: string | number): number {
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

  // Once every problem has been answered correctly, the problems phase is
  // never re-entered — currentIndex sits one past the end of the sequence, so
  // re-entering would present a problem that doesn't exist.
  static areProblemsComplete(progress: Progress): boolean {
    return progress.problems.completedAt !== null
  }

  static advanceInstructionStep(progress: Progress, content: LessonContent): Progress {
    if (progress.phase !== 'instruction') return progress

    const now = Date.now()
    const nextIndex = progress.instruction.currentScreenIndex + 1
    const reachedEnd = nextIndex >= content.instruction.screens.length
    // Replaying the instruction after finishing the lesson skips straight
    // back to 'complete' — the problems are already answered.
    const nextPhase = !reachedEnd
      ? 'instruction'
      : Progression.areProblemsComplete(progress)
        ? 'complete'
        : 'problems'

    return {
      ...progress,
      phase: nextPhase,
      instruction: {
        currentScreenIndex: nextIndex,
        completedAt: reachedEnd ? now : progress.instruction.completedAt,
      },
      updatedAt: now,
    }
  }

  static submitProblemAnswer(
    progress: Progress,
    content: LessonContent,
    value: string | number,
    studentEvaluationTag: string | null = null
  ): Progress {
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
      studentEvaluationTag,
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

    // The problems phase is not re-enterable once every problem is answered
    // (currentIndex is past the end of the sequence) — land on 'complete'
    // instead so a nonexistent problem can never be presented.
    if (Progression.areProblemsComplete(progress)) {
      return { ...progress, phase: 'complete', updatedAt: now }
    }

    return {
      ...progress,
      phase: 'problems',
      updatedAt: now,
    }
  }

  static isMultiplayerUnlocked(progress: Progress): boolean {
    return progress.phase === 'complete'
  }
}
