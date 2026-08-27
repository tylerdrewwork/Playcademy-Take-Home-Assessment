import { describe, expect, it } from 'vitest'
import { createLessonProgressStore } from './lessonProgress.svelte.js'

const testContent = {
  lessonId: 'test-lesson',
  contentVersion: 1,
  instruction: { steps: [{ id: 'step-1' }] },
  problems: [
    { id: 'p1', answer: 5 },
    { id: 'p2', answer: 6 },
  ],
}

function createFakeStorage() {
  let record = null
  return {
    async loadProgress() {
      return record
    },
    async saveProgress(progress) {
      record = progress
    },
    async clearProgress() {
      record = null
    },
  }
}

describe('createLessonProgressStore', () => {
  it('initializes to instruction phase and persists the initial record when storage is empty', async () => {
    const storage = createFakeStorage()
    const store = createLessonProgressStore({ content: testContent, storage })
    await store.ready

    expect(store.progress.phase).toBe('instruction')
    expect(await storage.loadProgress()).toEqual(store.progress)
  })

  it('loads an existing stored record instead of creating a new one', async () => {
    const storage = createFakeStorage()
    await storage.saveProgress({ phase: 'complete', marker: 'existing' })
    const store = createLessonProgressStore({ content: testContent, storage })
    await store.ready

    expect(store.progress).toEqual({ phase: 'complete', marker: 'existing' })
  })

  it('advanceInstructionStep updates state and persists it', async () => {
    const storage = createFakeStorage()
    const store = createLessonProgressStore({ content: testContent, storage })
    await store.ready

    await store.advanceInstructionStep()

    expect(store.progress.phase).toBe('problems')
    expect((await storage.loadProgress()).phase).toBe('problems')
  })

  it('submitProblemAnswer advances on a correct answer and exposes currentProblem', async () => {
    const storage = createFakeStorage()
    const store = createLessonProgressStore({ content: testContent, storage })
    await store.ready
    await store.advanceInstructionStep()

    expect(store.currentProblem).toEqual({ id: 'p1', answer: 5 })
    await store.submitProblemAnswer('5')
    expect(store.currentProblem).toEqual({ id: 'p2', answer: 6 })
  })

  it('isMultiplayerUnlocked flips to true once every problem is solved', async () => {
    const storage = createFakeStorage()
    const store = createLessonProgressStore({ content: testContent, storage })
    await store.ready
    await store.advanceInstructionStep()

    expect(store.isMultiplayerUnlocked).toBe(false)
    await store.submitProblemAnswer('5')
    await store.submitProblemAnswer('6')
    expect(store.isMultiplayerUnlocked).toBe(true)
  })

  it('resetProgress clears storage and reinitializes to instruction phase', async () => {
    const storage = createFakeStorage()
    const store = createLessonProgressStore({ content: testContent, storage })
    await store.ready
    await store.advanceInstructionStep()

    await store.resetProgress()

    expect(store.progress.phase).toBe('instruction')
    expect((await storage.loadProgress()).phase).toBe('instruction')
  })
})
