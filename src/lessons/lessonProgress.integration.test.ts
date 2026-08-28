import { beforeEach, describe, expect, it } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import { LessonProgress } from './lessonProgress.svelte.js'
import { IndexedDbProgressionStorage } from './progressStorage.js'
import { LessonContent, type InstructionStep, type Problem } from './lessonContent.js'

class TestContent extends LessonContent<InstructionStep, Problem> {
  readonly lessonId = 'integration-test-lesson'
  readonly contentVersion = 1
  readonly instruction = { steps: [{ id: 'step-1', title: '', body: '' }] }
  readonly problems = [
    { id: 'p1', prompt: '', answer: 5 },
    { id: 'p2', prompt: '', answer: 6 },
  ]
}

const testContent = new TestContent()

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory()
})

describe('LessonProgress with the real IndexedDbProgressionStorage', () => {
  it('persists real progress through IndexedDB across the full instruction -> problems -> complete flow', async () => {
    const storage = new IndexedDbProgressionStorage()
    const lessonProgress = new LessonProgress(testContent, storage)
    await lessonProgress.ready

    // fake-indexeddb does not reproduce the browser's native structured-clone
    // rejection of Proxy objects, so the IndexedDB round-trip below can pass
    // even when `progress` is a live Svelte $state proxy. Node's native
    // structuredClone() faithfully replicates real browser behavior and is
    // what actually proves progress is a plain, cloneable object.
    expect(() => structuredClone(lessonProgress.progress)).not.toThrow()

    await lessonProgress.advanceStep()
    await lessonProgress.submitProblemAnswer('5')
    await lessonProgress.submitProblemAnswer('6')

    expect(lessonProgress.progress?.phase).toBe('complete')
    expect(lessonProgress.isMultiplayerUnlocked).toBe(true)

    const stored = await storage.loadProgress()
    expect(stored?.phase).toBe('complete')
    expect(stored?.problems.attempts.p1).toHaveLength(1)
    expect(stored?.problems.attempts.p2).toHaveLength(1)
  })
})
