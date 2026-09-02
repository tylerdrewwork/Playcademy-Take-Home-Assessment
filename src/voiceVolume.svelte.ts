import type { VoiceVolumeStorage } from './voiceVolumeStorage.js'

/**
 * Voice/narration playback volume, set from the slider next to Admin Tools
 * on the lesson screen. Persisted in IndexedDB so the player's preference
 * carries across visits.
 */
export class VoiceVolume {
  volume = $state(1)
  #storage: VoiceVolumeStorage
  readonly ready: Promise<void>

  constructor(storage: VoiceVolumeStorage) {
    this.#storage = storage
    this.ready = (async () => {
      try {
        const stored = await storage.load()
        this.volume = stored?.volume ?? 1
      } catch {
        // IndexedDB unavailable (e.g. a non-browser test environment) — keep the default volume.
      }
    })()
  }

  async setVolume(volume: number): Promise<void> {
    this.volume = Math.min(1, Math.max(0, volume))
    await this.#storage.save({ volume: this.volume })
  }
}
