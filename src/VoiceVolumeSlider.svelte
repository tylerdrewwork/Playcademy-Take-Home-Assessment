<script lang="ts">
  import { voiceVolume } from './voiceVolumeSingleton.js'

  let icon = $derived(voiceVolume.volume === 0 ? '🔇' : voiceVolume.volume < 0.5 ? '🔉' : '🔊')

  function handleInput(event: Event) {
    const percent = Number((event.currentTarget as HTMLInputElement).value)
    voiceVolume.setVolume(percent / 100)
  }
</script>

<div class="voice-volume">
  <span aria-hidden="true">{icon}</span>
  <input
    type="range"
    min="0"
    max="100"
    value={Math.round(voiceVolume.volume * 100)}
    oninput={handleInput}
    aria-label="Voice volume"
  />
</div>

<style>
  .voice-volume {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background-color: #1a1a1a;
    padding: 0.4rem 0.75rem;
    border-radius: 8px;
  }

  input[type='range'] {
    width: 6rem;
  }

  @media (prefers-color-scheme: light) {
    .voice-volume {
      background-color: #f9f9f9;
    }
  }
</style>
