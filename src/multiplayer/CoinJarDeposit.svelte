<script lang="ts">
  import { onDestroy } from 'svelte'
  import gsap from 'gsap'
  import type { CoinValue } from './gameSession.svelte.js'
  import quarterImg from '../assets/multiplayer/coins/quarter.webp'
  import dimeImg from '../assets/multiplayer/coins/dime.webp'
  import nickelImg from '../assets/multiplayer/coins/nickel.webp'
  import pennyImg from '../assets/multiplayer/coins/penny.webp'

  // Smaller than CoinScatter's on-counter sizes — these are a flying stand-in
  // for the coins, not the actual counted pile, so they just need to read as
  // the same denominations mid-flight.
  const COIN_ART: Record<CoinValue, { src: string; diameter: number }> = {
    25: { src: quarterImg, diameter: 34 },
    10: { src: dimeImg, diameter: 20 },
    5: { src: nickelImg, diameter: 26 },
    1: { src: pennyImg, diameter: 20 },
  }

  const PILE_RADIUS = 16
  const ABOVE_JAR_OFFSET = 70 // px above the jar's mouth for the mid-flight waypoint
  const SPARKLE_COUNT = 16
  const SPARKLE_COLORS = ['#fff9c4', '#ffe066', '#ffd166', '#ffffff']
  const SPARKLE_DURATION_S = 0.6

  let layerEl: HTMLDivElement | undefined = $state()
  // Every imperatively-created coin/spark element currently mid-tween, so
  // onDestroy can kill and clear them the same way OtherPlayerColumn and
  // LessonProblems' spark layer do for their own imperative nodes.
  let activeEls = new Set<HTMLElement>()

  function relativePoint(target: HTMLElement, layerRect: DOMRect): { x: number; y: number } {
    const rect = target.getBoundingClientRect()
    return {
      x: rect.left + rect.width / 2 - layerRect.left,
      y: rect.top + rect.height / 2 - layerRect.top,
    }
  }

  function spawnSparkleBurst(x: number, y: number): void {
    if (!layerEl) return
    for (let i = 0; i < SPARKLE_COUNT; i++) {
      const angle = (i / SPARKLE_COUNT) * Math.PI * 2 + Math.random() * 0.3
      const distance = 20 + Math.random() * 24
      const size = 4 + Math.random() * 4
      const spark = document.createElement('span')
      spark.className = 'spark'
      spark.style.width = `${size}px`
      spark.style.height = `${size}px`
      spark.style.background = SPARKLE_COLORS[Math.floor(Math.random() * SPARKLE_COLORS.length)]
      layerEl.appendChild(spark)
      activeEls.add(spark)
      gsap.set(spark, { xPercent: -50, yPercent: -50, x, y, scale: 1, opacity: 1 })
      gsap.to(spark, {
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance,
        scale: 0,
        opacity: 0,
        duration: SPARKLE_DURATION_S * (0.7 + Math.random() * 0.4),
        ease: 'power1.out',
        onComplete: () => {
          activeEls.delete(spark)
          spark.remove()
        },
      })
    }
  }

  /** Flies `coins` from `originEl` (the counter tray) into a small pile,
   * up to just above the jar, then down into `jarMouthEl`, then bursts a
   * sparkle there. Resolves the instant the sparkle triggers — the caller
   * is expected to hold back revealing the new total until then. */
  export function playEarnAnimation(
    coins: CoinValue[],
    originEl: HTMLElement,
    jarMouthEl: HTMLElement,
  ): Promise<void> {
    if (!layerEl || coins.length === 0) return Promise.resolve()

    const layerRect = layerEl.getBoundingClientRect()
    const origin = relativePoint(originEl, layerRect)
    const mouth = relativePoint(jarMouthEl, layerRect)
    const aboveJar = { x: mouth.x, y: mouth.y - ABOVE_JAR_OFFSET }

    const coinEls = coins.map((value) => {
      const art = COIN_ART[value]
      const el = document.createElement('div')
      el.className = 'deposit-coin'
      el.style.width = `${art.diameter}px`
      el.style.height = `${art.diameter}px`
      const img = document.createElement('img')
      img.src = art.src
      img.alt = ''
      el.appendChild(img)
      layerEl!.appendChild(el)
      activeEls.add(el)
      gsap.set(el, {
        xPercent: -50,
        yPercent: -50,
        x: origin.x + (Math.random() - 0.5) * 60,
        y: origin.y + (Math.random() - 0.5) * 40,
        rotation: (Math.random() - 0.5) * 40,
      })
      return el
    })

    return new Promise((resolve) => {
      const cleanup = () => {
        for (const el of coinEls) {
          activeEls.delete(el)
          el.remove()
        }
      }

      const tl = gsap.timeline({ onComplete: cleanup })

      // Stage 1: gather the scattered coins into a small pile/circle.
      tl.to(coinEls, {
        x: (i) => origin.x + PILE_RADIUS * Math.cos((i / coinEls.length) * Math.PI * 2),
        y: (i) => origin.y + PILE_RADIUS * Math.sin((i / coinEls.length) * Math.PI * 2),
        rotation: 0,
        duration: 0.4,
        ease: 'power2.inOut',
        stagger: 0.03,
      })

      // Stage 2: carry the pile up to just above the jar.
      tl.to(coinEls, {
        x: (i) => aboveJar.x + PILE_RADIUS * Math.cos((i / coinEls.length) * Math.PI * 2),
        y: (i) => aboveJar.y + PILE_RADIUS * Math.sin((i / coinEls.length) * Math.PI * 2),
        duration: 0.6,
        ease: 'power1.inOut',
      })

      // Stage 3: drop the pile into the jar's mouth, shrinking away as if
      // falling past the rim and out of view.
      tl.to(coinEls, {
        x: mouth.x,
        y: mouth.y,
        scale: 0.3,
        opacity: 0,
        duration: 0.35,
        ease: 'power2.in',
        stagger: 0.02,
      })

      // Stage 4: the sparkle IS the cue to reveal the new total, so resolve
      // the instant it fires rather than waiting for it to fade out.
      tl.call(() => {
        spawnSparkleBurst(mouth.x, mouth.y)
        resolve()
      })
    })
  }

  onDestroy(() => {
    gsap.killTweensOf(Array.from(activeEls))
    for (const el of activeEls) el.remove()
    activeEls.clear()
  })
</script>

<div class="deposit-layer" bind:this={layerEl} aria-hidden="true"></div>

<style>
  .deposit-layer {
    position: absolute;
    inset: 0;
    z-index: 4;
    pointer-events: none;
    overflow: visible;
  }

  /* Coins/sparks are created imperatively, so they need :global() to escape
     Svelte's style scoping — same pattern as OtherPlayerColumn's award
     bubbles and the lesson's spark layer. GSAP owns the transform. */
  .deposit-layer :global(.deposit-coin) {
    position: absolute;
    top: 0;
    left: 0;
  }

  .deposit-layer :global(.deposit-coin img) {
    display: block;
    width: 100%;
    height: 100%;
    filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.25));
  }

  .deposit-layer :global(.spark) {
    position: absolute;
    top: 0;
    left: 0;
    border-radius: 50%;
  }
</style>
