/**
 * Admin-facing toggles, flipped from the Admin Tools dialog. Session-scoped
 * on purpose (not persisted): each visit starts with the defaults.
 */
class AdminSettings {
  /**
   * When on, the multiplayer coin problems generated for this player cap
   * out at 10 cents. Sent with every joinGame/submitAnswer call, so a
   * mid-session flip applies from the next generated problem onward.
   */
  simpleMultiplayer = $state(false)
}

export const adminSettings = new AdminSettings()
