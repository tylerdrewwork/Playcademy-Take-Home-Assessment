<script lang="ts">
  import { voiceVolume } from './voiceVolumeSingleton.js'
  import SpeakerIcon from './ui/SpeakerIcon.svelte'

  let level = $derived<'muted' | 'low' | 'high'>(
    voiceVolume.volume === 0 ? 'muted' : voiceVolume.volume < 0.5 ? 'low' : 'high'
  )

  function handleInput(event: Event) {
    const percent = Number((event.currentTarget as HTMLInputElement).value)
    voiceVolume.setVolume(percent / 100)
  }
</script>

<div class="voice-volume chrome-panel">
  <span class="icon"><SpeakerIcon {level} /></span>
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
  .icon {
    display: flex;
    color: var(--color-ink-muted);
  }

  input[type='range'] {
    width: 6rem;
  }
</style>
