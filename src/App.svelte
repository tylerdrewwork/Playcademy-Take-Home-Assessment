<script>
  import LessonScreen from './lessons/LessonScreen.svelte'
  import MultiplayerScreen from './multiplayer/MultiplayerScreen.svelte'
  import MusicMuteButton from './multiplayer/MusicMuteButton.svelte'
  import AdminTools from './AdminTools.svelte'

  let view = $state('lesson')
</script>

<main>
  <div class="top-right-controls">
    {#if view === 'multiplayer'}
      <MusicMuteButton />
    {/if}
    <AdminTools onShowSection={(section) => (view = section)} />
  </div>
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

  .top-right-controls {
    position: fixed;
    top: 1rem;
    right: 1rem;
    z-index: 10;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
</style>
