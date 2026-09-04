<script lang="ts">
  import { musicSettings } from './musicSettingsSingleton.js'
  import SpeakerIcon from '../ui/SpeakerIcon.svelte'
</script>

<button
  class="music-mute-toggle chrome-panel"
  onclick={() => musicSettings.setMuted(!musicSettings.muted)}
  aria-pressed={musicSettings.muted}
>
  <SpeakerIcon level={musicSettings.muted ? 'muted' : 'high'} />
  Music
</button>

<style>
  .music-mute-toggle {
    font-size: var(--text-sm);
  }

  .music-mute-toggle:hover {
    background: rgba(255, 255, 255, 0.95);
  }

  /* Muted reads as "switched off": dimmer text, same chrome. */
  .music-mute-toggle[aria-pressed='true'] {
    color: var(--color-ink-muted);
  }
</style>
