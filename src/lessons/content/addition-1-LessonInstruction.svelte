<script>
  import { addition1LessonProgress } from './addition-1-LessonProgress.js'
  import { addition1Content } from './addition-1-Content.js'

  let screen = $derived(
    addition1Content.instruction.screens[
      addition1LessonProgress.progress.instruction.currentScreenIndex
    ]
  )
</script>

{#if screen}
  {#key screen.id}
    <div class="lesson-card">
      <screen.component
        {...screen.props}
        isLastScreen={addition1LessonProgress.isLastScreen}
        onComplete={() => addition1LessonProgress.advanceStep()}
      />
    </div>
  {/key}
{/if}

<style>
  .lesson-card {
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 1rem;
    /* Fills most of the viewport and scales with it. Targets a fixed size
       for a given screen so it doesn't visibly resize between steps, but
       min-height (rather than a hard height) lets it grow on short/wide
       screens where a step's content — e.g. the 4rem transcript text plus
       a full balloon row — needs more room than that target, instead of
       clipping it. Content that doesn't fill it is just centered instead
       of top-anchored with blank space below. */
    width: min(95vw, 85rem);
    min-height: min(88vh, 60rem);
    min-width: 20rem;
    margin: 2rem auto;
    padding: clamp(1.5rem, 3vw, 3rem);
    border-radius: 1rem;
    background: light-dark(#ffffff, #1a1a1a);
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
    text-align: center;
  }
</style>
