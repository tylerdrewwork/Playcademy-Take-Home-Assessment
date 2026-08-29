<script>
  import LessonScreen from './lessons/LessonScreen.svelte'
  import MultiplayerScreen from './multiplayer/MultiplayerScreen.svelte'
  import AdminTools from './AdminTools.svelte'

  let view = $state('lesson')
</script>

<main>
  <AdminTools onShowSection={(section) => (view = section)} />
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
    padding: 1rem;
  }
</style>
