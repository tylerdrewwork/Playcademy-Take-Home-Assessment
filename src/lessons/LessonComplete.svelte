<script module>
  // Auto-forward to multiplayer only once per completion. Multiplayer's
  // "Back to lesson" button lands here again (the lesson stays complete), and
  // forwarding every time would bounce the student straight back out.
  let forwardedCompletionAt = null
</script>

<script>
  import gsap from 'gsap'
  import { addition1LessonProgress } from './content/addition-1-LessonProgress.js'
  import SuccessCheck from '../ui/SuccessCheck.svelte'

  let { onPlayMultiplayer } = $props()

  let cardEl = $state()

  const completedAt = addition1LessonProgress.progress.lessonCompletedAt
  const autoForward = completedAt !== null && completedAt !== forwardedCompletionAt

  $effect(() => {
    const ctx = gsap.context(() => {
      if (cardEl) {
        gsap.fromTo(
          cardEl,
          { scale: 0, opacity: 0 },
          { scale: 1, opacity: 1, duration: 0.45, ease: 'back.out(2)' },
        )
      }
    })

    // setTimeout (not GSAP) drives the navigation — GSAP stays visuals-only.
    let timer
    if (autoForward) {
      timer = setTimeout(() => {
        forwardedCompletionAt = completedAt
        onPlayMultiplayer?.()
      }, 1000)
    }

    return () => {
      clearTimeout(timer)
      ctx.revert()
    }
  })
</script>

<section class="lesson-complete" role="status">
  <div class="card" bind:this={cardEl} style="opacity: 0">
    <SuccessCheck />
    <p class="headline">Great job!</p>
    {#if !autoForward}
      <button class="btn-primary play" onclick={() => onPlayMultiplayer?.()}>Play the coin game</button>
    {/if}
  </div>
</section>

<style>
  .lesson-complete {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 60vh;
    padding: var(--space-4);
  }

  .card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-3);
    --check-size: clamp(6rem, 24vw, 10rem);
  }

  .headline {
    margin: 0;
    font-size: clamp(var(--text-2xl), 7vw, var(--text-4xl));
    font-weight: 800;
    color: var(--color-success);
    text-shadow:
      0 0 2px #ffffff,
      0 2px 8px rgba(0, 0, 0, 0.15);
  }

  .play {
    margin-top: var(--space-2);
    font-size: var(--text-md);
  }
</style>
