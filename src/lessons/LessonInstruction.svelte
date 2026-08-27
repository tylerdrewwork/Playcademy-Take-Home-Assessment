<script>
  import { lessonProgress } from './lessonProgressSingleton.svelte.js'
  import { addition1Content } from './content/addition-1-Content.js'

  let step = $derived(
    addition1Content.instruction.steps[lessonProgress.progress.instruction.currentStepIndex]
  )
</script>

{#if step}
  <section>
    <h2>{step.title}</h2>
    <p>{step.body}</p>
    <button onclick={() => lessonProgress.advanceInstructionStep()}>Next</button>
  </section>
{/if}
