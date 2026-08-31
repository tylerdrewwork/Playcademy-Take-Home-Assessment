import { MusicSettings } from './musicSettings.svelte.js'
import { IndexedDbMusicSettingsStorage } from './musicSettingsStorage.js'

export const musicSettings = new MusicSettings(new IndexedDbMusicSettingsStorage())
