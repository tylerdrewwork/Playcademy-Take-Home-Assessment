import { describe, expect, it } from 'vitest'
import { VoiceVolume } from './voiceVolume.svelte.js'
import { VoiceVolumeStorage, type VoiceVolumeRecord } from './voiceVolumeStorage.js'

class FakeStorage extends VoiceVolumeStorage {
  #record: VoiceVolumeRecord | null = null

  async load() {
    return this.#record
  }

  async save(record: VoiceVolumeRecord) {
    this.#record = record
  }
}

// A minimal stand-in for HTMLAudioElement: just enough (an event target plus
// a `volume` property) to exercise registerAudio without needing a DOM.
class FakeAudio extends EventTarget {
  volume = 1
}

describe('VoiceVolume', () => {
  it('registerAudio sets the clip to the current volume', async () => {
    const voiceVolume = new VoiceVolume(new FakeStorage())
    await voiceVolume.ready
    await voiceVolume.setVolume(0.4)

    const audio = new FakeAudio() as unknown as HTMLAudioElement
    voiceVolume.registerAudio(audio)

    expect(audio.volume).toBe(0.4)
  })

  it('setVolume live-updates a currently registered clip instead of only affecting the next one', async () => {
    const voiceVolume = new VoiceVolume(new FakeStorage())
    await voiceVolume.ready

    const audio = new FakeAudio() as unknown as HTMLAudioElement
    voiceVolume.registerAudio(audio)

    await voiceVolume.setVolume(0.2)

    expect(audio.volume).toBe(0.2)
  })

  it('stops adjusting a clip once it has paused or errored', async () => {
    const voiceVolume = new VoiceVolume(new FakeStorage())
    await voiceVolume.ready

    const audio = new FakeAudio() as unknown as HTMLAudioElement
    voiceVolume.registerAudio(audio)
    ;(audio as unknown as EventTarget).dispatchEvent(new Event('pause'))

    await voiceVolume.setVolume(0.7)

    expect(audio.volume).toBe(1)
  })
})
