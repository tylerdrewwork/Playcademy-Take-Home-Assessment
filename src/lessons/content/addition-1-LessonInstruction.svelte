<script>
  import { addition1LessonProgress } from './addition-1-LessonProgress.js'
  import { addition1Content } from './addition-1-Content.js'

  let { onPlayMultiplayer } = $props()

  let screen = $derived(
    addition1Content.instruction.screens[
      addition1LessonProgress.progress.instruction.currentScreenIndex
    ]
  )

  async function handleScreenComplete() {
    await addition1LessonProgress.advanceStep()
    // Finishing the instruction normally lands on 'problems'. Landing on
    // 'complete' means the problems were already all answered (a replay via
    // Admin Tools) — the problems screen is skipped, go straight to the game.
    if (addition1LessonProgress.progress?.phase === 'complete') onPlayMultiplayer?.()
  }
</script>

{#if screen}
  {#key screen.id}
    <div class="lesson-card">
      <screen.component
        {...screen.props}
        isLastScreen={addition1LessonProgress.isLastScreen}
        onComplete={handleScreenComplete}
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
    padding: clamp(var(--space-4), 3vh, var(--space-6)) clamp(var(--space-5), 3vw, var(--space-8));
    border: 1px solid rgba(255, 255, 255, 0.7);
    border-radius: var(--radius-lg);
    background: linear-gradient(180deg, var(--color-surface) 0%, var(--color-surface-2) 100%);
    color: var(--color-ink);
    /* Sits on the saturated sky/grass gradient, so it needs a real lift. */
    box-shadow: var(--shadow-lg);
    text-align: center;
  }
</style>
