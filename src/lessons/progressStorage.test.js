import { beforeEach, describe, expect, it } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import { saveProgress, loadProgress, clearProgress } from './progressStorage.js'

beforeEach(() => {
  // Fresh in-memory IndexedDB per test so records don't leak across tests.
  globalThis.indexedDB = new IDBFactory()
})

describe('progressStorage', () => {
  it('returns null when nothing has been saved', async () => {
    const loaded = await loadProgress()
    expect(loaded).toBeNull()
  })

  it('saves and loads a progress record', async () => {
    const progress = { phase: 'instruction', lessonId: 'test-lesson' }
    await saveProgress(progress)
    const loaded = await loadProgress()
    expect(loaded).toEqual(progress)
  })

  it('overwrites the previous record on a second save', async () => {
    await saveProgress({ phase: 'instruction' })
    await saveProgress({ phase: 'problems' })
    const loaded = await loadProgress()
    expect(loaded).toEqual({ phase: 'problems' })
  })

  it('clears the stored record', async () => {
    await saveProgress({ phase: 'complete' })
    await clearProgress()
    const loaded = await loadProgress()
    expect(loaded).toBeNull()
  })
})
