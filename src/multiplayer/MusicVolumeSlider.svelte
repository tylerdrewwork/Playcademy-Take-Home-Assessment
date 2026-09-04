<script lang="ts">
  import { musicSettings } from './musicSettingsSingleton.js'

  function handleInput(event: Event) {
    const percent = Number((event.currentTarget as HTMLInputElement).value)
    musicSettings.setVolume(percent / 100)
  }
</script>

<div class="music-volume chrome-panel">
  <svg
    class="icon"
    viewBox="0 0 24 24"
    width="1.1em"
    height="1.1em"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="M9 18V5l11-2v13" />
    <circle cx="6" cy="18" r="3" fill="currentColor" stroke="none" />
    <circle cx="17" cy="16" r="3" fill="currentColor" stroke="none" />
  </svg>
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
  .icon {
    display: block;
    flex-shrink: 0;
    color: var(--color-ink-muted);
  }

  input[type='range'] {
    width: 6rem;
  }
</style>
