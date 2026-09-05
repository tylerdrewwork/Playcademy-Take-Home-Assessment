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
  let optionsOpen = $state(false)
  let optionsRoot = $state(null)

  // Closes the Options dropdown on any click outside its own subtree
  // (which includes the Admin Tools modal, since it renders as a child of
  // this wrapper) — only wired up while the dropdown is actually open.
  $effect(() => {
    if (!optionsOpen) return
    function handleClickOutside(event) {
      if (optionsRoot && !optionsRoot.contains(event.target)) {
        optionsOpen = false
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  })
</script>

<main>
  <div class="top-left-controls">
    <div class="admin-column" bind:this={optionsRoot}>
      <button class="options-trigger" onclick={() => (optionsOpen = !optionsOpen)}>
        Options
      </button>
      {#if optionsOpen}
        <div class="options-menu">
          <AdminTools
            onShowSection={(section) => {
              view = section
              optionsOpen = false
            }}
          />
          {#if view === 'multiplayer'}
            <MusicMuteButton />
            <MusicVolumeSlider />
          {:else}
            <VoiceVolumeSlider />
          {/if}
        </div>
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

  .admin-column {
    position: relative;
  }

  .options-trigger {
    display: block;
    padding: 0.15rem 0.9rem;
    border-radius: 999px;
    background-color: rgba(255, 255, 255, 0.12);
    border-color: transparent;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  }

  .options-menu {
    position: absolute;
    top: calc(100% + 0.5rem);
    left: 0;
    z-index: 11;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 0.5rem;
    min-width: 11rem;
    padding: 0.6rem;
    border-radius: 0.75rem;
    background-color: rgba(255, 255, 255, 0.12);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  }

  @media (prefers-color-scheme: light) {
    .options-trigger,
    .options-menu {
      background-color: rgba(255, 255, 255, 0.75);
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
    }
  }
</style>
