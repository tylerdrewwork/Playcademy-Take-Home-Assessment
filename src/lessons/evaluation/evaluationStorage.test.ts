import { beforeEach, describe, expect, it } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import { EVALUATION_SCHEMA_VERSION, IndexedDbEvaluationStorage } from './evaluationStorage.js'
import type { EvaluationRecord } from './evaluationStorage.js'

beforeEach(() => {
  // Fresh in-memory IndexedDB per test so records don't leak across tests.
  globalThis.indexedDB = new IDBFactory()
})

function makeRecord(overrides: Partial<EvaluationRecord> = {}): EvaluationRecord {
  return {
    schemaVersion: EVALUATION_SCHEMA_VERSION,
    lessonId: 'test-lesson',
    contentVersion: 1,
    startedAt: 1000,
    updatedAt: 2000,
    findings: [],
    episodes: [],
    ...overrides,
  }
}

describe('IndexedDbEvaluationStorage', () => {
  it('returns null when nothing has been saved', async () => {
    const storage = new IndexedDbEvaluationStorage()
    expect(await storage.load()).toBeNull()
  })

  it('saves and loads an evaluation record', async () => {
    const storage = new IndexedDbEvaluationStorage()
    const record = makeRecord({
      findings: [
        {
          signal: 'off-by-one',
          polarity: 'concern',
          problemId: 'p1',
          attemptIndex: 0,
          t: 1500,
          contentVersion: 1,
          detail: { value: 4, answer: 5 },
        },
      ],
      episodes: [{ problemId: 'p1', shownAt: 1000, endedAt: null, attemptCount: 1, eventCounts: { submit: 1 } }],
    })
    await storage.save(record)
    expect(await storage.load()).toEqual(record)
  })

  it('overwrites the previous record on a second save', async () => {
    const storage = new IndexedDbEvaluationStorage()
    await storage.save(makeRecord({ updatedAt: 2000 }))
    await storage.save(makeRecord({ updatedAt: 3000 }))
    const loaded = await storage.load()
    expect(loaded?.updatedAt).toBe(3000)
  })

  it('clears the stored record', async () => {
    const storage = new IndexedDbEvaluationStorage()
    await storage.save(makeRecord())
    await storage.clear()
    expect(await storage.load()).toBeNull()
  })
})
