<script>
  import { onDestroy } from 'svelte'
  import { fade } from 'svelte/transition'
  import gsap from 'gsap'

  // instant: skip the number's fade-out (used when a whole group is being
  // faded/removed as a unit — the number shouldn't linger and animate on
  // its own on top of that).
  //
  // clickable: the student is expected to touch balloons right now (the
  // "we do" count); the balloon becomes a focusable button and reports
  // taps via onclick. bounce: this is the balloon the student should touch
  // next — it bounces up and down until they do. hint: when non-empty, a
  // callout with this text and a pointing hand appears under the balloon
  // (shown on top of the bounce once the student has stalled or missed).
  // shakeKey: bump it to make the balloon wiggle "no" (a tap that was out
  // of order).
  let {
    color = 'blue',
    number = undefined,
    instant = false,
    clickable = false,
    bounce = false,
    hint = '',
    shakeKey = 0,
    onclick = undefined,
  } = $props()

  const fills = {
    blue: { body: '#4a90d9', highlight: '#8fc1f0' },
    yellow: { body: '#f0b429', highlight: '#f8d878' },
  }

  let fill = $derived(fills[color] ?? fills.blue)

  // Decorative by default (hidden from assistive tech); a real, focusable
  // button while the student is expected to touch it.
  let a11yAttrs = $derived(
    clickable
      ? { role: 'button', tabindex: 0, 'aria-label': `${color} balloon` }
      : { 'aria-hidden': 'true' }
  )

  let svgEl
  let bounceTween
  let popTween
  let shakeTween

  // The balloon to touch next bounces up and down so it stands out from
  // its neighbours. Infinite repeat, so it must be killed both when the
  // bounce moves on and on unmount. Declared before the pop effect so that,
  // when the bouncing balloon is tapped (bounce cleared and number set in
  // the same flush), the bounce is torn down first.
  $effect(() => {
    if (!bounce || !svgEl) return
    bounceTween = gsap.to(svgEl, { y: -10, duration: 0.4, ease: 'sine.inOut', yoyo: true, repeat: -1 })
    return () => {
      bounceTween?.kill()
      bounceTween = undefined
      gsap.set(svgEl, { y: 0 })
    }
  })

  // Pop the balloon larger as it's counted, then settle back down, so the
  // student's eye is drawn to whichever balloon the count just landed on.
  $effect(() => {
    if (number === undefined || !svgEl) return
    popTween?.kill()
    popTween = gsap
      .timeline()
      .to(svgEl, { scale: 1.3, duration: 0.25, ease: 'expo.out' })
      .to(svgEl, { scale: 1, duration: 0.3, ease: 'power1.inOut' })
  })

  // A quick side-to-side "no" when the student taps this balloon out of
  // order — feedback that the tap registered but this isn't the next one.
  $effect(() => {
    if (!shakeKey || !svgEl) return
    shakeTween?.kill()
    shakeTween = gsap
      .timeline()
      .to(svgEl, { x: -6, duration: 0.07 })
      .to(svgEl, { x: 6, duration: 0.07 })
      .to(svgEl, { x: -4, duration: 0.07 })
      .to(svgEl, { x: 0, duration: 0.07 })
  })

  onDestroy(() => {
    bounceTween?.kill()
    popTween?.kill()
    shakeTween?.kill()
  })

  function handleClick() {
    if (!clickable) return
    onclick?.()
  }

  function handleKeydown(event) {
    if (!clickable) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onclick?.()
    }
  }
</script>

<!-- The wrapper (not the svg) is the sized flex item so the hint callout
     can hang below the balloon without changing the row's layout. -->
<div class="balloon-slot">
  <svg
    bind:this={svgEl}
    class="balloon"
    class:clickable
    viewBox="0 0 40 56"
    {...a11yAttrs}
    onclick={handleClick}
    onkeydown={handleKeydown}
  >
    <ellipse cx="20" cy="22" rx="18" ry="20" fill={fill.body} />
    <ellipse cx="14" cy="14" rx="6" ry="8" fill={fill.highlight} opacity="0.7" />
    <path d="M17 41 L20 47 L23 41 Z" fill={fill.body} />
    <line x1="20" y1="47" x2="20" y2="56" stroke="#999" stroke-width="1" />
    {#if number !== undefined}
      <text x="20" y="27" text-anchor="middle" class="number" out:fade={{ duration: instant ? 0 : 400 }}>{number}</text>
    {/if}
  </svg>
  {#if hint}
    <div class="hint" transition:fade={{ duration: 200 }} role="status">
      <span class="hint-hand" aria-hidden="true">👆</span>
      <span class="hint-text">{hint}</span>
    </div>
  {/if}
</div>

<style>
  .balloon-slot {
    /* Scales with the viewport and shrinks as the combined balloon count
       grows, targeting a touch-friendly size. Capped by vh as well as vw
       so a tall balloon (aspect-ratio below) doesn't push the card past
       100dvh on a short screen — flex-shrink (below) is the final
       guarantee that every balloon still fits on one row without
       wrapping, even below this target on very small/crowded screens. */
    width: clamp(2rem, min(calc(80vw / var(--balloon-count, 5)), 12vh), 10rem);
    min-width: 0;
    flex-shrink: 1;
    position: relative;
  }

  .balloon {
    width: 100%;
    height: auto;
    aspect-ratio: 40 / 56;
    display: block;
  }

  .balloon.clickable {
    cursor: pointer;
    /* No focus ring: a ring around a tapped balloon reads as part of the
       lesson's feedback (is it counted? selected?) when it isn't. The
       number pop and hint callout carry the state instead. */
    outline: none;
  }

  .number {
    font-size: 1.1rem;
    font-weight: bold;
    fill: #ffffff;
    stroke: #00000055;
    stroke-width: 0.5px;
  }

  /* Hangs centered under the balloon, out of the row's layout flow, and
     is allowed to spill past the group box so the text never wraps into
     an unreadable column at small balloon sizes. */
  .hint {
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.1rem;
    padding-top: 0.15rem;
    white-space: nowrap;
    pointer-events: none;
    z-index: 1;
  }

  .hint-hand {
    font-size: 1.75rem;
    line-height: 1;
    animation: hint-bob 0.8s ease-in-out infinite;
  }

  .hint-text {
    font-size: 0.95rem;
    font-weight: bold;
    padding: 0.25rem 0.6rem;
    border-radius: 999px;
    background: light-dark(#fff8dc, #4a3f1a);
    color: light-dark(#213547, #fff8dc);
    border: 2px solid #f0b429;
    box-shadow: 0 2px 6px #00000033;
  }

  @keyframes hint-bob {
    0%,
    100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(-0.35rem);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .hint-hand {
      animation: none;
    }
  }
</style>
