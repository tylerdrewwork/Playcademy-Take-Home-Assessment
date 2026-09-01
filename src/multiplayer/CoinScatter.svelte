<script lang="ts">
  import quarterImg from '../assets/multiplayer/coins/quarter.webp'
  import dimeImg from '../assets/multiplayer/coins/dime.webp'
  import nickelImg from '../assets/multiplayer/coins/nickel.webp'
  import pennyImg from '../assets/multiplayer/coins/penny.webp'
  import type { CoinValue } from './gameSession.svelte.js'

  let { coins, trayHeightPx }: { coins: CoinValue[]; trayHeightPx: number } = $props()

  // The tray used to be scaled down by a fixed CSS factor tuned against
  // one viewport size, so it didn't track the counter as it resized.
  // Scaling directly off the counter's own measured pixel height keeps the
  // coins sized proportionally at any viewport. REFERENCE_HEIGHT is the
  // counter height (in px) at which the tray renders at its native,
  // unscaled size (AREA_WIDTH x AREA_HEIGHT below) — tuned to land close
  // to the old fixed 0.66 factor at a typical viewport.
  const REFERENCE_HEIGHT = 1250
  let scale = $derived(trayHeightPx > 0 ? trayHeightPx / REFERENCE_HEIGHT : 1)

  // Diameters keep the coins' real-world size order (quarter > nickel >
  // penny > dime). The transparent source images are square crops sized
  // exactly to the coin's edge, so the drawn coin is exactly `diameter` wide
  // with no per-asset margin compensation.
  const COIN_ART: Record<CoinValue, {
    src: string
    names: [singular: string, plural: string]
    diameter: number
  }> = {
    25: { src: quarterImg, names: ['quarter', 'quarters'], diameter: 80 },
    10: { src: dimeImg, names: ['dime', 'dimes'], diameter: 43 },
    5: { src: nickelImg, names: ['nickel', 'nickels'], diameter: 61 },
    1: { src: pennyImg, names: ['penny', 'pennies'], diameter: 46 },
  }

  const AREA_HEIGHT = 280 // height of the rectangular scatter area, px
  const AREA_WIDTH = AREA_HEIGHT * 1.5
  const HALF_WIDTH = AREA_WIDTH / 2
  const HALF_HEIGHT = AREA_HEIGHT / 2
  // Renders coins 35% larger than COIN_ART's diameters without touching the
  // scatter area itself; folded into totalArea below too, so the
  // MAX_FILL crowding check still reflects what's actually drawn.
  const SIZE_MULTIPLIER = 1.35
  const EDGE_GAP = 2 // minimum space between coin edges, px
  // Random placement stops finding gaps well before the rectangle is half
  // covered, so dense assortments (e.g. dozens of pennies) get scaled down
  // until the coins' total area fits under this fraction of the rectangle.
  const MAX_FILL = 0.45
  const PLACEMENT_TRIES = 80
  // "Spawn tilt" is at most 10% of a full turn in either direction.
  const MAX_TILT_DEG = 36

  interface PlacedCoin {
    src: string
    x: number // offset from the area's center, px
    y: number
    size: number // rendered diameter, px
    tilt: number // deg
  }

  function tryScatter(values: CoinValue[], scale: number): PlacedCoin[] | null {
    const placed: (PlacedCoin & { r: number })[] = []
    for (const value of values) {
      const art = COIN_ART[value]
      // Whole-pixel positions and even-pixel diameters keep the artwork (and
      // its centering translate of -size/2) off half-pixel boundaries, where
      // resampling blurs it.
      const size = Math.max(2, 2 * Math.round((art.diameter * SIZE_MULTIPLIER * scale) / 2))
      const r = size / 2
      let spot: { x: number; y: number } | null = null
      const xBound = Math.max(HALF_WIDTH - r, 0)
      const yBound = Math.max(HALF_HEIGHT - r, 0)
      for (let i = 0; i < PLACEMENT_TRIES && !spot; i++) {
        const x = Math.round((Math.random() * 2 - 1) * xBound)
        const y = Math.round((Math.random() * 2 - 1) * yBound)
        const clear = placed.every((p) => Math.hypot(p.x - x, p.y - y) >= p.r + r + EDGE_GAP)
        if (clear) spot = { x, y }
      }
      if (!spot) return null
      placed.push({
        src: art.src,
        x: spot.x,
        y: spot.y,
        size,
        r,
        tilt: (Math.random() * 2 - 1) * MAX_TILT_DEG,
      })
    }
    return placed
  }

  function scatter(values: CoinValue[]): PlacedCoin[] {
    // Largest coins first pack far more reliably.
    const sorted = [...values].sort((a, b) => COIN_ART[b].diameter - COIN_ART[a].diameter)
    const totalArea = sorted.reduce(
      (sum, value) => sum + Math.PI * ((COIN_ART[value].diameter * SIZE_MULTIPLIER) / 2) ** 2,
      0
    )
    let scale = Math.min(1, Math.sqrt((MAX_FILL * AREA_WIDTH * AREA_HEIGHT) / totalArea))
    // An unlucky arrangement can still wedge itself in; retry slightly
    // smaller each time, so this always terminates.
    for (;;) {
      const placed = tryScatter(sorted, scale)
      if (placed) return placed
      scale *= 0.92
    }
  }

  // Recomputes only when a new problem's coins array arrives, so the layout
  // holds still through unrelated re-renders (typing, wrong answers).
  let layout = $derived(scatter(coins))

  let description = $derived.by(() => {
    const counts = new Map<CoinValue, number>()
    for (const value of coins) counts.set(value, (counts.get(value) ?? 0) + 1)
    return ([25, 10, 5, 1] as const)
      .filter((value) => counts.has(value))
      .map((value) => {
        const count = counts.get(value)!
        return `${count} ${COIN_ART[value].names[count === 1 ? 0 : 1]}`
      })
      .join(', ')
  })
</script>

<div
  class="coin-scatter"
  style:width={`${AREA_WIDTH}px`}
  style:height={`${AREA_HEIGHT}px`}
  style:transform={`scale(${scale})`}
  role="img"
  aria-label={`Coins to count: ${description}`}
>
  {#each layout as coin}
    <div
      class="coin"
      style:width={`${coin.size}px`}
      style:height={`${coin.size}px`}
      style:left={`calc(50% + ${coin.x}px)`}
      style:top={`calc(50% + ${coin.y}px)`}
      style:transform={`translate(-50%, -50%) rotate(${coin.tilt}deg)`}
    >
      <img src={coin.src} alt="" />
    </div>
  {/each}
</div>

<style>
  .coin-scatter {
    position: relative;
    transform-origin: bottom center;
  }

  .coin {
    position: absolute;
  }

  .coin img {
    display: block;
    width: 100%;
    height: 100%;
    /* Shadow hugs the coin's alpha silhouette, not the image rectangle. */
    filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.25));
  }
</style>
