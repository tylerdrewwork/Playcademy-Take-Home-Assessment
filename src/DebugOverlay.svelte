<script>
  import { addition1LessonProgress } from './lessons/content/addition-1-LessonProgress.js'
  import { currentInstructionStep } from './lessons/currentInstructionStep.svelte.js'

  const progress = $derived(addition1LessonProgress.progress)
</script>

{#if progress}
  <aside class="debug-overlay" aria-label="Debug info">
    <p>phase: {progress.phase}</p>
    {#if progress.phase === 'instruction'}
      <p>screen: {progress.instruction.currentScreenIndex + 1}</p>
      {#if currentInstructionStep.step}
        <p>step: {currentInstructionStep.step.label}</p>
      {/if}
    {:else if progress.phase === 'problems'}
      <p>step: {progress.problems.currentIndex + 1} / {progress.problems.sequence.length}</p>
    {/if}
  </aside>
{/if}

<style>
  /* Dev-tool chrome (see the --color-dev-* tokens): slate + monospace so it
     reads as tooling, not part of the lesson. */
  .debug-overlay {
    position: fixed;
    top: var(--space-4);
    right: var(--space-4);
    z-index: 10;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--color-dev-border);
    border-radius: var(--radius-sm);
    background-color: rgba(31, 41, 55, 0.9);
    color: var(--color-dev-fg);
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    text-align: left;
    pointer-events: none;
    box-shadow: var(--shadow-sm);
  }

  .debug-overlay p {
    margin: 0;
  }
</style>
