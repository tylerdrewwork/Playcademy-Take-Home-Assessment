<script lang="ts">
  import { musicSettings } from './musicSettings.svelte.js'
</script>

<button
  class="music-mute-toggle"
  onclick={() => (musicSettings.muted = !musicSettings.muted)}
  aria-pressed={musicSettings.muted}
>
  {musicSettings.muted ? '🔇 Music' : '🔊 Music'}
</button>
