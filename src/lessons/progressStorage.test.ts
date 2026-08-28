import { beforeEach, describe, expect, it } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import { IndexedDbProgressionStorage } from './progressStorage.js'
import type { Progress } from './progression.js'

beforeEach(() => {
  // Fresh in-memory IndexedDB per test so records don't leak across tests.
  globalThis.indexedDB = new IDBFactory()
})

describe('IndexedDbProgressionStorage', () => {
  it('returns null when nothing has been saved', async () => {
    const storage = new IndexedDbProgressionStorage()
    const loaded = await storage.loadProgress()
    expect(loaded).toBeNull()
  })

  it('saves and loads a progress record', async () => {
    const storage = new IndexedDbProgressionStorage()
    const progress = { phase: 'instruction', lessonId: 'test-lesson' } as unknown as Progress
    await storage.saveProgress(progress)
    const loaded = await storage.loadProgress()
    expect(loaded).toEqual(progress)
  })

  it('overwrites the previous record on a second save', async () => {
    const storage = new IndexedDbProgressionStorage()
    await storage.saveProgress({ phase: 'instruction' } as unknown as Progress)
    await storage.saveProgress({ phase: 'problems' } as unknown as Progress)
    const loaded = await storage.loadProgress()
    expect(loaded).toEqual({ phase: 'problems' })
  })

  it('clears the stored record', async () => {
    const storage = new IndexedDbProgressionStorage()
    await storage.saveProgress({ phase: 'complete' } as unknown as Progress)
    await storage.clearProgress()
    const loaded = await storage.loadProgress()
    expect(loaded).toBeNull()
  })
})
