<script>
  import { addition1LessonProgress } from './content/addition-1-LessonProgress.js'
  import { celebration } from './celebration.svelte.js'
  import LessonInstruction from './content/addition-1-LessonInstruction.svelte'
  import LessonProblems from './LessonProblems.svelte'
  import LessonComplete from './LessonComplete.svelte'

  let { onPlayMultiplayer } = $props()
</script>

{#await addition1LessonProgress.ready}
  <p>Loading lesson...</p>
{:then}
  {#if addition1LessonProgress.progress.phase === 'instruction'}
    <LessonInstruction />
  {:else if addition1LessonProgress.progress.phase === 'problems' || (addition1LessonProgress.progress.phase === 'complete' && celebration.active)}
    <!-- The last problem flips the phase to 'complete' immediately; keep the
         problems screen up until its correct-answer celebration finishes. -->
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
