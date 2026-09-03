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
    background-color: #1a1a1a;
    padding: 0.4rem 0.75rem;
    border-radius: 8px;
  }

  input[type='range'] {
    width: 6rem;
  }

  @media (prefers-color-scheme: light) {
    .music-volume {
      background-color: #f9f9f9;
    }
  }
</style>
