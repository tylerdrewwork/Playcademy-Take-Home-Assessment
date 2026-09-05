<script>
  import { onDestroy } from 'svelte'
  import { fade } from 'svelte/transition'
  import gsap from 'gsap'

  // instant: skip the number's fade-out (used when a whole group is being
  // faded/removed as a unit — the number shouldn't linger and animate on
  // its own on top of that).
  let { color = 'blue', number = undefined, instant = false } = $props()

  const fills = {
    blue: { body: '#4a90d9', highlight: '#8fc1f0' },
    yellow: { body: '#f0b429', highlight: '#f8d878' },
  }

  let fill = $derived(fills[color] ?? fills.blue)

  let svgEl
  let popTween

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

  onDestroy(() => {
    popTween?.kill()
  })
</script>

<svg bind:this={svgEl} class="balloon" viewBox="0 0 40 56" aria-hidden="true">
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

  .number {
    font-size: 1.1rem;
    font-weight: 800;
    fill: #ffffff;
  }
</style>
