<script>
  import { addition1LessonProgress } from './content/addition-1-LessonProgress.js'
  import LessonInstruction from './content/addition-1-LessonInstruction.svelte'
  import LessonProblems from './LessonProblems.svelte'
  import LessonComplete from './LessonComplete.svelte'
</script>

{#await addition1LessonProgress.ready}
  <p>Loading lesson...</p>
{:then}
  {#if addition1LessonProgress.progress.phase === 'instruction'}
    <LessonInstruction />
  {:else if addition1LessonProgress.progress.phase === 'problems'}
    <LessonProblems />
  {:else}
    <LessonComplete />
  {/if}
  {#if addition1LessonProgress.error}
    <p>Something went wrong saving your progress.</p>
  {/if}
{:catch}
  <p>Something went wrong loading your lesson progress. Please reload the page.</p>
{/await}
