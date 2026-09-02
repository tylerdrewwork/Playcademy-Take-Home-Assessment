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
    padding: 9px 11px 10px 11px;
    /* The border-image frame has square corners, so a rounded box corner
       would just clip into the artwork. */
    border-radius: 0;
    border-style: solid;
    border-width: 9px 11px 10px 11px;
    border-image: url('../../assets/general/wood-border-9slice.png') 9 11 10 11 fill / 9px 11px 10px
      11px;
    background: url('../../assets/general/wood-background.webp') center / cover no-repeat;
    /* The wood photo is dark in both themes, so the card's text color is
       pinned here too instead of following light-dark(). */
    color: #f5e6d3;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
    text-align: center;
  }
</style>
