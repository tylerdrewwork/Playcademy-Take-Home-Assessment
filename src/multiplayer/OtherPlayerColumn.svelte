<script lang="ts">
  import { onDestroy } from 'svelte'
  import gsap from 'gsap'
  import type { PlayerAward } from './gameSession.svelte.js'

  let { name, lastAward }: { name: string; lastAward: PlayerAward | null } = $props()

  let bubbleLayerEl: HTMLDivElement

  // An award that predates this column mounting (e.g. it happened before we
  // joined) must not replay as a fresh bubble — only react to changes. The
  // first effect run records the baseline; `undefined` means "not yet seen".
  let seenAwardAt: number | null | undefined = undefined

  $effect(() => {
    const award = lastAward
    const previous = seenAwardAt
    seenAwardAt = award?.at ?? null
    if (previous === undefined || !award || award.at === previous) return
    spawnBubble(award.cents)
  })

  function spawnBubble(cents: number): void {
    const bubble = document.createElement('span')
    bubble.className = 'award-bubble'
    bubble.textContent = `Earned ${cents} ${cents === 1 ? 'cent' : 'cents'}!`
    bubbleLayerEl.appendChild(bubble)

    gsap
      .timeline({ onComplete: () => bubble.remove() })
      .fromTo(
        bubble,
        { xPercent: -50, y: 10, opacity: 0, scale: 0.8 },
        { xPercent: -50, y: 0, opacity: 1, scale: 1, duration: 0.35, ease: 'back.out(2)' },
      )
      .to(bubble, { y: -36, opacity: 0, duration: 1.1, ease: 'power1.in', delay: 0.7 })
  }

  onDestroy(() => {
    // Bubbles are imperative nodes, so gsap.context() can't track their
    // tweens — kill and clear them by hand (same pattern as the lesson's
    // spark layer).
    if (bubbleLayerEl) {
      gsap.killTweensOf(bubbleLayerEl.children)
      bubbleLayerEl.replaceChildren()
    }
  })
</script>

<div class="player-column">
  <div class="bubble-layer" bind:this={bubbleLayerEl} aria-hidden="true"></div>
  <p class="player-name">{name}</p>
</div>

<style>
  .player-column {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-end;
    min-width: 7rem;
    min-height: 8rem;
    padding: 2.5rem var(--space-4) var(--space-3);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    box-shadow: var(--shadow-sm);
  }

  .player-name {
    margin: 0;
    font-weight: 700;
    color: var(--color-ink-muted);
  }

  .bubble-layer {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 2.6rem;
    pointer-events: none;
  }

  /* Bubbles are created imperatively, so they need :global() to escape
     Svelte's style scoping. GSAP owns the transform (xPercent centers it). */
  .bubble-layer :global(.award-bubble) {
    position: absolute;
    bottom: 0;
    left: 50%;
    white-space: nowrap;
    font-size: var(--text-sm);
    font-weight: 700;
    color: var(--color-success-strong);
  }
</style>
