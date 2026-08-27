<script>
  import { lessonProgress } from './lessonProgressSingleton.svelte.js'
  import { combiningGroupsContent } from './content/combiningGroupsContent.js'

  let step = $derived(
    combiningGroupsContent.instruction.steps[lessonProgress.progress.instruction.currentStepIndex]
  )
</script>

{#if step}
  <section>
    <h2>{step.title}</h2>
    <p>{step.body}</p>
    <button onclick={() => lessonProgress.advanceInstructionStep()}>Next</button>
  </section>
{/if}
