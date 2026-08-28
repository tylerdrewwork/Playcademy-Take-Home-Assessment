<script>
  import { addition1LessonProgress } from './addition-1-LessonProgress.js'
  import { addition1Content } from './addition-1-Content.js'
  import GroupsDisplay from './addition-1-steps/GroupsDisplay.svelte'
  import CombineDisplay from './addition-1-steps/CombineDisplay.svelte'

  const stepVisuals = {
    groups: GroupsDisplay,
    combine: CombineDisplay,
  }

  let step = $derived(
    addition1Content.instruction.steps[addition1LessonProgress.progress.instruction.currentStepIndex]
  )
  let StepVisual = $derived(stepVisuals[step?.kind])
</script>

{#if step}
  {#key step.id}
    <div class="lesson-card">
      <h2>{step.title}</h2>
      <p>{step.body}</p>

      {#if StepVisual}
        <StepVisual groups={step.groups} />
      {/if}

      <button onclick={() => addition1LessonProgress.advanceStep()}>
        {addition1LessonProgress.isLastStep ? "Got it! Let's Practice!" : 'Next'}
      </button>
    </div>
  {/key}
{/if}

<style>
  .lesson-card {
    max-width: 40rem;
    margin: 2rem auto;
    padding: 2rem;
    border-radius: 1rem;
    background: light-dark(#ffffff, #1a1a1a);
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
    text-align: center;
  }

  h2 {
    margin-top: 0;
  }
</style>
