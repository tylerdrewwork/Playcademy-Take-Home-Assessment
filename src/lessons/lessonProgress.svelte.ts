import type { LessonContent, Problem } from './lessonContent.js'
import { Progression, type Attempt, type Progress } from './progression.js'
import type { ProgressionStorage } from './progressStorage.js'

export class LessonProgress {
  #progress: Progress | null = $state.raw(null)
  #error: unknown = $state.raw(null)
  #content: LessonContent
  #storage: ProgressionStorage
  readonly ready: Promise<void>

  constructor(content: LessonContent, storage: ProgressionStorage) {
    this.#content = content
    this.#storage = storage
    this.ready = (async () => {
      const stored = await storage.loadProgress()
      // A record written under a different content version may not match the
      // current instruction structure, so treat it as absent and start fresh.
      const isCurrent = stored != null && stored.contentVersion === content.contentVersion
      this.#progress = isCurrent ? stored : Progression.createInitialProgress(content)
      if (!isCurrent) {
        await storage.saveProgress(this.#progress)
      }
    })()
  }

  get progress(): Progress | null {
    return this.#progress
  }

  get error(): unknown {
    return this.#error
  }

  get isMultiplayerUnlocked(): boolean {
    return this.#progress ? Progression.isMultiplayerUnlocked(this.#progress) : false
  }

  get currentProblem(): Problem | null {
    if (!this.#progress || this.#progress.phase !== 'problems') return null
    const problemId = this.#progress.problems.sequence[this.#progress.problems.currentIndex]
    return this.#content.findProblem(problemId) ?? null
  }

  get lastAttempt(): Attempt | null {
    if (!this.#progress || this.#progress.phase !== 'problems') return null
    const problemId = this.#progress.problems.sequence[this.#progress.problems.currentIndex]
    const attemptsForProblem = this.#progress.problems.attempts[problemId]
    return attemptsForProblem && attemptsForProblem.length > 0
      ? attemptsForProblem[attemptsForProblem.length - 1]
      : null
  }

  get isLastScreen(): boolean {
    return (
      this.#progress?.instruction.currentScreenIndex ===
      this.#content.instruction.screens.length - 1
    )
  }

  async advanceStep(): Promise<void> {
    this.#progress = Progression.advanceInstructionStep(this.#progress!, this.#content)
    try {
      await this.#storage.saveProgress(this.#progress)
    } catch (err) {
      this.#error = err
    }
  }

  async submitProblemAnswer(value: string | number): Promise<void> {
    this.#progress = Progression.submitProblemAnswer(this.#progress!, this.#content, value)
    try {
      await this.#storage.saveProgress(this.#progress)
    } catch (err) {
      this.#error = err
    }
  }

  async resetProgress(): Promise<void> {
    this.#progress = Progression.createInitialProgress(this.#content)
    try {
      await this.#storage.clearProgress()
      await this.#storage.saveProgress(this.#progress)
    } catch (err) {
      this.#error = err
    }
  }
}
