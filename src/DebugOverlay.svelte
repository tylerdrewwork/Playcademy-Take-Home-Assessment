<script>
  import { addition1LessonProgress } from './lessons/content/addition-1-LessonProgress.js'

  const progress = $derived(addition1LessonProgress.progress)
</script>

{#if progress}
  <aside class="debug-overlay" aria-label="Debug info">
    <p>phase: {progress.phase}</p>
    {#if progress.phase === 'instruction'}
      <p>screen: {progress.instruction.currentScreenIndex + 1}</p>
    {:else if progress.phase === 'problems'}
      <p>step: {progress.problems.currentIndex + 1} / {progress.problems.sequence.length}</p>
    {/if}
  </aside>
{/if}

<style>
  .debug-overlay {
    position: fixed;
    top: 1rem;
    right: 1rem;
    z-index: 10;
    padding: 0.5rem 0.75rem;
    border-radius: 8px;
    background-color: rgba(26, 26, 26, 0.85);
    color: #fff;
    font-family: monospace;
    font-size: 0.8rem;
    text-align: left;
    pointer-events: none;
  }

  .debug-overlay p {
    margin: 0;
  }

  @media (prefers-color-scheme: light) {
    .debug-overlay {
      background-color: rgba(249, 249, 249, 0.9);
      color: #1a1a1a;
    }
  }
</style>
