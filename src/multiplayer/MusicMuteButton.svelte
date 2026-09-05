<script lang="ts">
  import { musicSettings } from './musicSettingsSingleton.js'
</script>

<button
  class="music-mute-toggle"
  onclick={() => musicSettings.setMuted(!musicSettings.muted)}
  aria-pressed={musicSettings.muted}
>
  {musicSettings.muted ? '🔇 Music' : '🔊 Music'}
</button>

<style>
  .music-mute-toggle {
    display: block;
    width: 100%;
    background-color: transparent;
    border-color: transparent;
    border-radius: 0.5rem;
    white-space: nowrap;
    text-align: left;
    padding: 0.3em 0.6em;
    box-shadow: none;
  }

  .music-mute-toggle:hover {
    background-color: rgba(128, 128, 128, 0.15);
  }
</style>
