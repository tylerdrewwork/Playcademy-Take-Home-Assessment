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
  // taps via onclick. hint: this is the balloon the student should touch
  // next — it pulses gently until they do. shakeKey: bump it to make the
  // balloon wiggle "no" (a tap that was out of order).
  let {
    color = 'blue',
    number = undefined,
    instant = false,
    clickable = false,
    hint = false,
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
  let popTween
  let hintTween
  let shakeTween

  // Gentle breathing pulse on the balloon the student should touch next.
  // Infinite repeat, so it must be killed both when the hint moves on and
  // on unmount. Declared before the pop effect so that, when the hinted
  // balloon is tapped (hint -> false, number set in the same flush), the
  // pulse is torn down before the pop starts.
  $effect(() => {
    if (!hint || !svgEl) return
    hintTween = gsap.to(svgEl, { scale: 1.12, duration: 0.55, ease: 'sine.inOut', yoyo: true, repeat: -1 })
    return () => {
      hintTween?.kill()
      hintTween = undefined
      gsap.set(svgEl, { scale: 1 })
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
    popTween?.kill()
    hintTween?.kill()
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

<style>
  .balloon {
    /* Scales with the viewport and shrinks as the combined balloon count
       grows, targeting a touch-friendly size. Capped by vh as well as vw
       so a tall balloon (aspect-ratio below) doesn't push the card past
       100dvh on a short screen — flex-shrink (below) is the final
       guarantee that every balloon still fits on one row without
       wrapping, even below this target on very small/crowded screens. */
    width: clamp(2rem, min(calc(80vw / var(--balloon-count, 5)), 12vh), 10rem);
    min-width: 0;
    flex-shrink: 1;
    height: auto;
    aspect-ratio: 40 / 56;
    display: block;
  }

  .balloon.clickable {
    cursor: pointer;
    /* Balloons overflow their box slightly while popping/pulsing, so a
       focus ring drawn outside the shape reads cleaner than one clipped
       to the viewBox. */
    outline-offset: 4px;
    border-radius: 50%;
  }

  .balloon.clickable:focus-visible {
    outline: 3px solid #ffffff;
  }

  .number {
    font-size: 1.1rem;
    font-weight: bold;
    fill: #ffffff;
    stroke: #00000055;
    stroke-width: 0.5px;
  }
</style>
