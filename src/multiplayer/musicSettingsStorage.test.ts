import { beforeEach, describe, expect, it } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import { IndexedDbMusicSettingsStorage } from './musicSettingsStorage.js'

beforeEach(() => {
  // Fresh in-memory IndexedDB per test so records don't leak across tests.
  globalThis.indexedDB = new IDBFactory()
})

describe('IndexedDbMusicSettingsStorage', () => {
  it('returns null when nothing has been saved', async () => {
    const storage = new IndexedDbMusicSettingsStorage()
    expect(await storage.load()).toBeNull()
  })

  it('saves and loads a music settings record', async () => {
    const storage = new IndexedDbMusicSettingsStorage()
    await storage.save({ muted: true, volume: 0.25 })
    expect(await storage.load()).toEqual({ muted: true, volume: 0.25 })
  })

  it('overwrites the previous record on a second save', async () => {
    const storage = new IndexedDbMusicSettingsStorage()
    await storage.save({ muted: true, volume: 0.25 })
    await storage.save({ muted: false, volume: 0.6 })
    expect(await storage.load()).toEqual({ muted: false, volume: 0.6 })
  })
})
