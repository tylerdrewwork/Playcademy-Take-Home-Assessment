import { describe, expect, it } from 'vitest'
import { MusicSettings } from './musicSettings.svelte.js'
import type { MusicSettingsRecord, MusicSettingsStorage } from './musicSettingsStorage.js'

class FakeStorage implements MusicSettingsStorage {
  #record: MusicSettingsRecord | null = null

  async load() {
    return this.#record
  }

  async save(record: MusicSettingsRecord) {
    this.#record = record
  }
}

describe('MusicSettings', () => {
  it('defaults to unmuted when storage is empty', async () => {
    const storage = new FakeStorage()
    const musicSettings = new MusicSettings(storage)
    await musicSettings.ready

    expect(musicSettings.muted).toBe(false)
  })

  it('loads a previously persisted muted preference', async () => {
    const storage = new FakeStorage()
    await storage.save({ muted: true })
    const musicSettings = new MusicSettings(storage)
    await musicSettings.ready

    expect(musicSettings.muted).toBe(true)
  })

  it('setMuted updates state and persists it', async () => {
    const storage = new FakeStorage()
    const musicSettings = new MusicSettings(storage)
    await musicSettings.ready

    await musicSettings.setMuted(true)

    expect(musicSettings.muted).toBe(true)
    expect(await storage.load()).toEqual({ muted: true })
  })
})
