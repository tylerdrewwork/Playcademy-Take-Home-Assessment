<script>
  import { lessonProgress } from './lessonProgressSingleton.svelte.js'
  import LessonInstruction from './LessonInstruction.svelte'
  import LessonProblems from './LessonProblems.svelte'
  import LessonComplete from './LessonComplete.svelte'
</script>

{#await lessonProgress.ready}
  <p>Loading lesson...</p>
{:then}
  {#if lessonProgress.progress.phase === 'instruction'}
    <LessonInstruction />
  {:else if lessonProgress.progress.phase === 'problems'}
    <LessonProblems />
  {:else}
    <LessonComplete />
  {/if}
  {#if lessonProgress.error}
    <p>Something went wrong saving your progress.</p>
  {/if}
{:catch}
  <p>Something went wrong loading your lesson progress. Please reload the page.</p>
{/await}
