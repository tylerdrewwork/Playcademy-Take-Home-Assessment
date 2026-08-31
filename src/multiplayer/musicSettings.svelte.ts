/**
 * Background music mute toggle, flipped from the mute button on the
 * multiplayer screen. Session-scoped on purpose (not persisted): each visit
 * starts unmuted.
 */
class MusicSettings {
  muted = $state(false)
}

export const musicSettings = new MusicSettings()
