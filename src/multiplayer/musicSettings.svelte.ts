import type { MusicSettingsStorage } from './musicSettingsStorage.js'

/**
 * Background music mute toggle, flipped from the mute button on the
 * multiplayer screen. Persisted in IndexedDB so the player's preference
 * carries across visits.
 */
export class MusicSettings {
  muted = $state(false)
  volume = $state(0.25)
  #storage: MusicSettingsStorage
  readonly ready: Promise<void>

  constructor(storage: MusicSettingsStorage) {
    this.#storage = storage
    this.ready = (async () => {
      const stored = await storage.load()
      this.muted = stored?.muted ?? false
      this.volume = stored?.volume ?? 0.25
    })()
  }

  async setMuted(muted: boolean): Promise<void> {
    this.muted = muted
    await this.#storage.save({ muted, volume: this.volume })
  }

  async setVolume(volume: number): Promise<void> {
    this.volume = Math.min(1, Math.max(0, volume))
    await this.#storage.save({ muted: this.muted, volume: this.volume })
  }
}
