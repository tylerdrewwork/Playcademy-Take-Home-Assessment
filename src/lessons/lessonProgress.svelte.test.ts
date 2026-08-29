import { describe, expect, it } from 'vitest'
import type { Component } from 'svelte'
import { LessonProgress } from './lessonProgress.svelte.js'
import { LessonContent, type InstructionScreen, type Problem } from './lessonContent.js'
import type { ProgressionStorage } from './progressStorage.js'
import type { Progress } from './progression.js'

const DummyComponent = (() => {}) as unknown as Component

class TestContent extends LessonContent<InstructionScreen, Problem> {
  readonly lessonId = 'test-lesson'
  readonly contentVersion = 1
  readonly problemSetVersion = 1
  readonly instruction = { screens: [{ id: 'screen-1', component: DummyComponent }] }
  readonly problems = [
    { id: 'p1', prompt: '', answer: 5 },
    { id: 'p2', prompt: '', answer: 6 },
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

  it('loads an existing stored record as-is when its contentVersion matches', async () => {
    const storage = new FakeStorage()
    await storage.saveProgress({
      phase: 'complete',
      marker: 'existing',
      contentVersion: 1,
    } as unknown as Progress)
    const lessonProgress = new LessonProgress(testContent, storage)
    await lessonProgress.ready

    expect(lessonProgress.progress).toEqual({
      phase: 'complete',
      marker: 'existing',
      contentVersion: 1,
    })
  })

  it('discards a stored record with a stale contentVersion and persists fresh progress', async () => {
    const storage = new FakeStorage()
    await storage.saveProgress({
      phase: 'complete',
      marker: 'stale',
      contentVersion: 999,
    } as unknown as Progress)
    const lessonProgress = new LessonProgress(testContent, storage)
    await lessonProgress.ready

    expect(lessonProgress.progress?.phase).toBe('instruction')
    expect(lessonProgress.progress?.contentVersion).toBe(1)
    expect(await storage.loadProgress()).toEqual(lessonProgress.progress)
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

    expect(lessonProgress.currentProblem).toEqual({ id: 'p1', prompt: '', answer: 5 })
    await lessonProgress.submitProblemAnswer('5')
    expect(lessonProgress.currentProblem).toEqual({ id: 'p2', prompt: '', answer: 6 })
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

  it('isLastScreen is true once the current screen is the final instruction screen', async () => {
    const storage = new FakeStorage()
    const lessonProgress = new LessonProgress(testContent, storage)
    await lessonProgress.ready

    expect(lessonProgress.isLastScreen).toBe(true)
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
