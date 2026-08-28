import { describe, expect, it } from 'vitest'
import { LessonProgress } from './lessonProgress.svelte.js'
import { LessonContent, type InstructionStep, type Problem } from './lessonContent.js'
import type { ProgressionStorage } from './progressStorage.js'
import type { Progress } from './progression.js'

class TestContent extends LessonContent<InstructionStep, Problem> {
  readonly lessonId = 'test-lesson'
  readonly contentVersion = 1
  readonly instruction = { steps: [{ id: 'step-1', title: '', body: '' }] }
  readonly problems = [
    { id: 'p1', prompt: '', groups: [], answer: 5 },
    { id: 'p2', prompt: '', groups: [], answer: 6 },
  ]
}

const testContent = new TestContent()

class FakeStorage implements ProgressionStorage {
  #record: Progress | null = null

  async loadProgress() {
    return this.#record
  }

  async saveProgress(progress: Progress) {
    this.#record = progress
  }

  async clearProgress() {
    this.#record = null
  }
}

describe('LessonProgress', () => {
  it('initializes to instruction phase and persists the initial record when storage is empty', async () => {
    const storage = new FakeStorage()
    const lessonProgress = new LessonProgress(testContent, storage)
    await lessonProgress.ready

    expect(lessonProgress.progress?.phase).toBe('instruction')
    expect(await storage.loadProgress()).toEqual(lessonProgress.progress)
  })

  it('loads an existing stored record instead of creating a new one', async () => {
    const storage = new FakeStorage()
    await storage.saveProgress({ phase: 'complete', marker: 'existing' } as unknown as Progress)
    const lessonProgress = new LessonProgress(testContent, storage)
    await lessonProgress.ready

    expect(lessonProgress.progress).toEqual({ phase: 'complete', marker: 'existing' })
  })

  it('advanceStep updates state and persists it', async () => {
    const storage = new FakeStorage()
    const lessonProgress = new LessonProgress(testContent, storage)
    await lessonProgress.ready

    await lessonProgress.advanceStep()

    expect(lessonProgress.progress?.phase).toBe('problems')
    expect((await storage.loadProgress())?.phase).toBe('problems')
  })

  it('submitProblemAnswer advances on a correct answer and exposes currentProblem', async () => {
    const storage = new FakeStorage()
    const lessonProgress = new LessonProgress(testContent, storage)
    await lessonProgress.ready
    await lessonProgress.advanceStep()

    expect(lessonProgress.currentProblem).toEqual({ id: 'p1', prompt: '', groups: [], answer: 5 })
    await lessonProgress.submitProblemAnswer('5')
    expect(lessonProgress.currentProblem).toEqual({ id: 'p2', prompt: '', groups: [], answer: 6 })
  })

  it('isMultiplayerUnlocked flips to true once every problem is solved', async () => {
    const storage = new FakeStorage()
    const lessonProgress = new LessonProgress(testContent, storage)
    await lessonProgress.ready
    await lessonProgress.advanceStep()

    expect(lessonProgress.isMultiplayerUnlocked).toBe(false)
    await lessonProgress.submitProblemAnswer('5')
    await lessonProgress.submitProblemAnswer('6')
    expect(lessonProgress.isMultiplayerUnlocked).toBe(true)
  })

  it('isLastStep is true once the current step is the final instruction step', async () => {
    const storage = new FakeStorage()
    const lessonProgress = new LessonProgress(testContent, storage)
    await lessonProgress.ready

    expect(lessonProgress.isLastStep).toBe(true)
  })

  it('resetProgress clears storage and reinitializes to instruction phase', async () => {
    const storage = new FakeStorage()
    const lessonProgress = new LessonProgress(testContent, storage)
    await lessonProgress.ready
    await lessonProgress.advanceStep()

    await lessonProgress.resetProgress()

    expect(lessonProgress.progress?.phase).toBe('instruction')
    expect((await storage.loadProgress())?.phase).toBe('instruction')
  })
})
