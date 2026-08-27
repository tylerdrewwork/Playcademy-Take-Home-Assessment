import { beforeEach, describe, expect, it } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import { createLessonProgressStore } from './lessonProgress.svelte.js'
import * as progressStorage from './progressStorage.js'

const testContent = {
  lessonId: 'integration-test-lesson',
  contentVersion: 1,
  instruction: { steps: [{ id: 'step-1' }] },
  problems: [
    { id: 'p1', answer: 5 },
    { id: 'p2', answer: 6 },
  ],
}

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory()
})

describe('createLessonProgressStore with the real progressStorage module', () => {
  it('persists real progress through IndexedDB across the full instruction -> problems -> complete flow', async () => {
    const store = createLessonProgressStore({ content: testContent, storage: progressStorage })
    await store.ready

    // fake-indexeddb does not reproduce the browser's native structured-clone
    // rejection of Proxy objects, so the IndexedDB round-trip below can pass
    // even when `progress` is a live Svelte $state proxy. Node's native
    // structuredClone() faithfully replicates real browser behavior and is
    // what actually proves progress is a plain, cloneable object.
    expect(() => structuredClone(store.progress)).not.toThrow()

    await store.advanceInstructionStep()
    await store.submitProblemAnswer('5')
    await store.submitProblemAnswer('6')

    expect(store.progress.phase).toBe('complete')
    expect(store.isMultiplayerUnlocked).toBe(true)

    const stored = await progressStorage.loadProgress()
    expect(stored.phase).toBe('complete')
    expect(stored.problems.attempts.p1).toHaveLength(1)
    expect(stored.problems.attempts.p2).toHaveLength(1)
  })
})
