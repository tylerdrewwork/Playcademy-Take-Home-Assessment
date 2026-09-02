import { VoiceVolume } from './voiceVolume.svelte.js'
import { IndexedDbVoiceVolumeStorage } from './voiceVolumeStorage.js'

export const voiceVolume = new VoiceVolume(new IndexedDbVoiceVolumeStorage())
