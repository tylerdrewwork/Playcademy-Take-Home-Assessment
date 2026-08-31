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
