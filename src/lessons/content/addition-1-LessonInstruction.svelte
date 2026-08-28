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
    max-width: 40rem;
    margin: 2rem auto;
    padding: 2rem;
    border-radius: 1rem;
    background: light-dark(#ffffff, #1a1a1a);
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
    text-align: center;
  }
</style>
