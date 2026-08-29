<script module>
  // Auto-forward to multiplayer only once per completion. Multiplayer's
  // "Back to lesson" button lands here again (the lesson stays complete), and
  // forwarding every time would bounce the student straight back out.
  let forwardedCompletionAt = null
</script>

<script>
  import gsap from 'gsap'
  import { addition1LessonProgress } from './content/addition-1-LessonProgress.js'

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
    <svg class="check" viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="30" fill="#3f9d46" />
      <path
        d="M18 33 L28 43 L45 24"
        stroke="#ffffff"
        stroke-width="7"
        fill="none"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
    <p class="headline">Great job!</p>
    {#if !autoForward}
      <button class="play" onclick={() => onPlayMultiplayer?.()}>Play the coin game</button>
    {/if}
  </div>
</section>

<style>
  .lesson-complete {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 60vh;
    padding: 1rem;
  }

  .card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
  }

  .check {
    width: clamp(6rem, 24vw, 10rem);
    height: auto;
    filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.25));
  }

  .headline {
    margin: 0;
    font-size: clamp(2rem, 7vw, 3rem);
    font-weight: 800;
    color: #3f9d46;
    text-shadow:
      0 0 2px light-dark(#ffffff, #000000),
      0 2px 8px rgba(0, 0, 0, 0.2);
  }

  .play {
    margin-top: 0.5rem;
    font-size: 1.1rem;
  }
</style>
