import { untrack } from 'svelte'
import type { VoiceVolumeStorage } from './voiceVolumeStorage.js'

/**
 * Voice/narration playback volume, set from the slider next to Admin Tools
 * on the lesson screen. Persisted in IndexedDB so the player's preference
 * carries across visits.
 */
export class VoiceVolume {
  volume = $state(1)
  #storage: VoiceVolumeStorage
  // Clips currently in flight, so a slider change while one is playing
  // adjusts it live instead of only affecting the next clip created.
  #activeAudio = new Set<HTMLAudioElement>()
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
    for (const audio of this.#activeAudio) audio.volume = this.volume
    await this.#storage.save({ volume: this.volume })
  }

  /**
   * Applies the current volume to `audio` and keeps it in sync with future
   * slider changes until playback stops. Callers should use this instead of
   * a one-off `audio.volume = voiceVolume.volume` assignment — that reads
   * `volume` only once, so a later slider change is silently ignored, and if
   * called from inside a `$effect` (e.g. one that starts a narration clip on
   * step change) it also makes that effect re-run on every slider move,
   * restarting the clip.
   *
   * `untrack` keeps the initial read from being picked up as a dependency by
   * whatever reactive context calls this; live updates instead come from the
   * registry below, driven by `setVolume`.
   */
  registerAudio(audio: HTMLAudioElement): void {
    audio.volume = untrack(() => this.volume)
    this.#activeAudio.add(audio)
    const unregister = () => this.#activeAudio.delete(audio)
    // 'pause' fires both on an explicit .pause() call and when playback
    // reaches its natural end (just before 'ended'), so this alone covers
    // early stops (component teardown, step change) as well as completion.
    audio.addEventListener('pause', unregister)
    audio.addEventListener('error', unregister)
  }
}
