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
{/await}
