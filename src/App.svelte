<script>
  import LessonScreen from './lessons/LessonScreen.svelte'
  import MultiplayerScreen from './multiplayer/MultiplayerScreen.svelte'
  import AdminTools from './AdminTools.svelte'

  let view = $state('lesson')
</script>

<main>
  <AdminTools onSkipToMultiplayer={() => (view = 'multiplayer')} />
  {#if view === 'multiplayer'}
    <MultiplayerScreen onExit={() => (view = 'lesson')} />
  {:else}
    <LessonScreen />
  {/if}
</main>
