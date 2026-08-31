<script lang="ts">
  import quarterImg from '../assets/multiplayer/coins/quarter.webp'
  import dimeImg from '../assets/multiplayer/coins/dime.webp'
  import nickelImg from '../assets/multiplayer/coins/nickel.webp'
  import pennyImg from '../assets/multiplayer/coins/penny.webp'
  import type { CoinValue } from './gameSession.svelte.js'

  let { coins }: { coins: CoinValue[] } = $props()

  // Diameters keep the coins' real-world size order (quarter > nickel >
  // penny > dime). The transparent source images are square crops sized
  // exactly to the coin's edge, so the drawn coin is exactly `diameter` wide
  // with no per-asset margin compensation.
  const COIN_ART: Record<CoinValue, {
    src: string
    names: [singular: string, plural: string]
    diameter: number
  }> = {
    25: { src: quarterImg, names: ['quarter', 'quarters'], diameter: 58 },
    10: { src: dimeImg, names: ['dime', 'dimes'], diameter: 43 },
    5: { src: nickelImg, names: ['nickel', 'nickels'], diameter: 51 },
    1: { src: pennyImg, names: ['penny', 'pennies'], diameter: 46 },
  }

  const AREA_SIZE = 280 // diameter of the circular scatter area, px
  const RADIUS = AREA_SIZE / 2
  const EDGE_GAP = 2 // minimum space between coin edges, px
  // Random placement stops finding gaps well before the circle is half
  // covered, so dense assortments (e.g. dozens of pennies) get scaled down
  // until the coins' total area fits under this fraction of the circle.
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
      const size = Math.max(2, 2 * Math.round((art.diameter * scale) / 2))
      const r = size / 2
      let spot: { x: number; y: number } | null = null
      for (let i = 0; i < PLACEMENT_TRIES && !spot; i++) {
        // sqrt keeps the distribution uniform over the circle's area, and
        // the (RADIUS - r) bound keeps the whole coin inside the area.
        const angle = Math.random() * Math.PI * 2
        const dist = Math.sqrt(Math.random()) * Math.max(RADIUS - r, 0)
        const x = Math.round(Math.cos(angle) * dist)
        const y = Math.round(Math.sin(angle) * dist)
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
      (sum, value) => sum + Math.PI * (COIN_ART[value].diameter / 2) ** 2,
      0
    )
    let scale = Math.min(1, Math.sqrt((MAX_FILL * Math.PI * RADIUS ** 2) / totalArea))
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
  style:width={`${AREA_SIZE}px`}
  style:height={`${AREA_SIZE}px`}
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
    border-radius: 50%;
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
