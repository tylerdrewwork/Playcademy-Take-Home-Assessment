<script>
  import { addition1LessonProgress } from './content/addition-1-LessonProgress.js'
  import { celebration } from './celebration.svelte.js'
  import LessonInstruction from './content/addition-1-LessonInstruction.svelte'
  import LessonProblems from './LessonProblems.svelte'
  import LessonComplete from './LessonComplete.svelte'

  let { onPlayMultiplayer } = $props()

  let phase = $derived(addition1LessonProgress.progress?.phase)
  // The last problem flips the phase to 'complete' immediately; the problems
  // screen stays up until its correct-answer celebration finishes, so this
  // mirrors the same condition below that decides whether LessonProblems is
  // still on screen.
  let showProblems = $derived(
    (phase === 'problems' && addition1LessonProgress.currentProblem) ||
      (phase === 'complete' && celebration.active)
  )
  // Only the instruction and problems phases get the gradient backdrop —
  // completion is a distinct celebratory screen, not "the lesson" itself.
  let showGradient = $derived(phase === 'instruction' || showProblems)
</script>

<div class="lesson-screen" class:gradient-bg={showGradient}>
  {#await addition1LessonProgress.ready}
    <p>Loading lesson...</p>
  {:then}
    {#if phase === 'instruction'}
      <LessonInstruction {onPlayMultiplayer} />
    {:else if showProblems}
      <LessonProblems />
    {:else}
      <LessonComplete {onPlayMultiplayer} />
    {/if}
    {#if addition1LessonProgress.error}
      <p>Something went wrong saving your progress.</p>
    {/if}
  {:catch}
    <p>Something went wrong loading your lesson progress. Please reload the page.</p>
  {/await}
</div>

<style>
  .lesson-screen {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .gradient-bg {
    background: linear-gradient(
      180deg,
      #5db4f4,
      #82c8f8 20%,
      #86d165 45%,
      #74c254 60%,
      #86d165 78%,
      #5db4f4
    );
  }
</style>
