<script lang="ts">
  import { musicSettings } from './musicSettingsSingleton.js'

  function handleInput(event: Event) {
    const percent = Number((event.currentTarget as HTMLInputElement).value)
    musicSettings.setVolume(percent / 100)
  }
</script>

<div class="music-volume">
  <input
    type="range"
    min="0"
    max="100"
    value={Math.round(musicSettings.volume * 100)}
    oninput={handleInput}
    aria-label="Music volume"
  />
</div>

<style>
  .music-volume {
    display: flex;
    align-items: center;
  }

  input[type='range'] {
    width: 6rem;
  }
</style>
