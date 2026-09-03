<script>
  import LessonScreen from './lessons/LessonScreen.svelte'
  import MultiplayerScreen from './multiplayer/MultiplayerScreen.svelte'
  import MusicMuteButton from './multiplayer/MusicMuteButton.svelte'
  import MusicVolumeSlider from './multiplayer/MusicVolumeSlider.svelte'
  import AdminTools from './AdminTools.svelte'
  import VoiceVolumeSlider from './VoiceVolumeSlider.svelte'
  import DebugOverlay from './DebugOverlay.svelte'
  import { adminSettings } from './adminSettings.svelte.js'

  let view = $state('lesson')
</script>

<main>
  <div class="top-left-controls">
    {#if view === 'multiplayer'}
      <div class="music-column">
        <MusicMuteButton />
        <MusicVolumeSlider />
      </div>
    {/if}
    <div class="admin-column">
      <AdminTools onShowSection={(section) => (view = section)} />
      {#if view !== 'multiplayer'}
        <VoiceVolumeSlider />
      {/if}
    </div>
  </div>
  {#if view !== 'multiplayer' && adminSettings.showDebugOverlay}
    <DebugOverlay />
  {/if}
  {#if view === 'multiplayer'}
    <MultiplayerScreen onExit={() => (view = 'lesson')} />
  {:else}
    <LessonScreen onPlayMultiplayer={() => (view = 'multiplayer')} />
  {/if}
</main>

<style>
  main {
    box-sizing: border-box;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .top-left-controls {
    position: fixed;
    top: 1rem;
    left: 1rem;
    z-index: 10;
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
  }

  .music-column,
  .admin-column {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }
</style>
