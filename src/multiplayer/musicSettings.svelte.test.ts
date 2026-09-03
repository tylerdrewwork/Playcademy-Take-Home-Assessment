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
    await storage.save({ muted: true, volume: 0.25 })
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
    expect(await storage.load()).toEqual({ muted: true, volume: 0.25 })
  })

  it('defaults volume to 0.25 when storage is empty', async () => {
    const storage = new FakeStorage()
    const musicSettings = new MusicSettings(storage)
    await musicSettings.ready

    expect(musicSettings.volume).toBe(0.25)
  })

  it('loads a previously persisted volume', async () => {
    const storage = new FakeStorage()
    await storage.save({ muted: false, volume: 0.6 })
    const musicSettings = new MusicSettings(storage)
    await musicSettings.ready

    expect(musicSettings.volume).toBe(0.6)
  })

  it('setVolume updates state, clamps to [0, 1], and persists it', async () => {
    const storage = new FakeStorage()
    const musicSettings = new MusicSettings(storage)
    await musicSettings.ready

    await musicSettings.setVolume(0.6)
    expect(musicSettings.volume).toBe(0.6)
    expect(await storage.load()).toEqual({ muted: false, volume: 0.6 })

    await musicSettings.setVolume(1.5)
    expect(musicSettings.volume).toBe(1)

    await musicSettings.setVolume(-1)
    expect(musicSettings.volume).toBe(0)
  })

  it('setMuted preserves the current volume', async () => {
    const storage = new FakeStorage()
    const musicSettings = new MusicSettings(storage)
    await musicSettings.ready

    await musicSettings.setVolume(0.6)
    await musicSettings.setMuted(true)

    expect(await storage.load()).toEqual({ muted: true, volume: 0.6 })
  })
})
