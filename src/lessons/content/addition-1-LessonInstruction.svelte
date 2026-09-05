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
       here instead of needing to be clipped.
       Height is 100dvh minus a fixed 7rem (not a vh percentage) so the
       centered gap above the card is always >= 3.5rem on every viewport —
       enough to clear the fixed top-left Options pill regardless of how
       short the window is. */
    width: min(95vw, 85rem);
    height: min(calc(100dvh - 7rem), 62rem);
    min-width: 20rem;
    overflow: hidden;
    padding: clamp(1rem, 3vh, 2rem) clamp(1.5rem, 3vw, 3rem);
    border-radius: 2rem;
    background: linear-gradient(180deg, #ffffff 0%, #f3f4f6 100%);
    /* The gradient is a fixed light look in both themes, so the card's
       text color is pinned here too instead of following light-dark(). */
    color: #213547;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
    text-align: center;
  }
</style>
