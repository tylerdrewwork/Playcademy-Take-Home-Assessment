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
    /* Fills most of the viewport and scales with it, but never exceeds it —
       the page itself is a fixed 100dvh with no scrollbar (see app.css),
       so this card has to fit within that, not grow past it. Centered by
       the flex layout in App.svelte rather than margin. Content sizing
       (transcript font-size, balloon size) is itself vh-aware so it fits
       here instead of needing to be clipped. */
    width: min(95vw, 85rem);
    height: min(94vh, 62rem);
    min-width: 20rem;
    overflow: hidden;
    padding: clamp(1rem, 3vh, 2rem) clamp(1.5rem, 3vw, 3rem);
    border-radius: 1rem;
    background: light-dark(#ffffff, #1a1a1a);
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
    text-align: center;
  }
</style>
