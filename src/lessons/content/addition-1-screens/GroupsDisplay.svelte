<script>
  import Balloon from '../../Balloon.svelte'

  // continuousNumbering: false restarts numbering at 1 within each group
  // (used while counting a group on its own); true numbers balloons in
  // order across all groups (used for the final recount of the merged set).
  let { groups, revealedCounts = [], continuousNumbering = false, instant = false } = $props()

  function numberOffset(groupIndex) {
    if (!continuousNumbering) return 0
    let offset = 0
    for (let k = 0; k < groupIndex; k++) offset += groups[k].count
    return offset
  }

  // Balloons size off the combined total (not each group's own count) so
  // that all groups shown together always fit on one row without wrapping,
  // and so a group's balloons don't change size once the other group
  // appears alongside it.
  let totalCount = $derived(groups.reduce((sum, g) => sum + g.count, 0))
</script>

<div class="groups-row" style="--balloon-count: {totalCount}">
  {#each groups as group, i}
    {#if i > 0}<span class="operator">+</span>{/if}
    <div class="group-box">
      <h3>Group {i + 1}</h3>
      <div class="balloon-row">
        {#each Array.from({ length: group.count }) as _, j}
          <Balloon
            color={group.color}
            number={j < (revealedCounts[i] ?? 0) ? numberOffset(i) + j + 1 : undefined}
            {instant}
          />
        {/each}
      </div>
    </div>
  {/each}
</div>

<style>
  .groups-row {
    display: flex;
    align-items: center;
    justify-content: center;
    /* Literal, not a token: CountingCombiningScreen's GSAP timeline tweens
       this gap to/from exactly '1rem'. */
    gap: 1rem;
    margin: var(--space-5) 0;
    flex-wrap: nowrap;
  }

  .operator {
    font-size: var(--text-xl);
    font-weight: 700;
    color: var(--color-ink-muted);
    flex-shrink: 0;
  }

  .group-box {
    border: 2px dashed var(--color-primary-soft);
    border-radius: var(--radius-md);
    /* Literal, not tokens: the GSAP merge/reveal timelines tween this
       padding to/from exactly '1.25rem' and '0.25rem'. */
    padding: 1rem 1.25rem;
    background: var(--color-primary-tint);
    color: var(--color-ink);
    min-width: 0;
  }

  .group-box h3 {
    margin: 0 0 var(--space-3);
    font-size: var(--text-xs);
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--color-ink-muted);
  }

  .balloon-row {
    display: flex;
    align-items: flex-end;
    justify-content: center;
    flex-wrap: nowrap;
    gap: clamp(0.25rem, 1.5vw, 1.25rem);
  }
</style>
