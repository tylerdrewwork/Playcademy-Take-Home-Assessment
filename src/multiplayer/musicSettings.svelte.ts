import type { MusicSettingsStorage } from './musicSettingsStorage.js'

/**
 * Background music mute toggle, flipped from the mute button on the
 * multiplayer screen. Persisted in IndexedDB so the player's preference
 * carries across visits.
 */
export class MusicSettings {
  muted = $state(false)
  #storage: MusicSettingsStorage
  readonly ready: Promise<void>

  constructor(storage: MusicSettingsStorage) {
    this.#storage = storage
    this.ready = (async () => {
      const stored = await storage.load()
      this.muted = stored?.muted ?? false
    })()
  }

  async setMuted(muted: boolean): Promise<void> {
    this.muted = muted
    await this.#storage.save({ muted })
  }
}
