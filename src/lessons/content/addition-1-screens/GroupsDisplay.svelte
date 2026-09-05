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
    gap: 1rem;
    margin: 1.5rem 0;
    flex-wrap: nowrap;
  }

  .operator {
    font-size: 1.5rem;
    font-weight: bold;
    flex-shrink: 0;
  }

  .group-box {
    border: 1px solid light-dark(rgba(169, 201, 232, 0.4), rgba(0, 0, 0, 0.3));
    border-radius: 0.75rem;
    padding: 1rem 1.25rem;
    background: light-dark(#eaf3fc, #16233a);
    box-shadow:
      -6px -6px 12px light-dark(rgba(255, 255, 255, 0.7), rgba(255, 255, 255, 0.04)),
      6px 6px 12px light-dark(rgba(163, 190, 216, 0.55), rgba(0, 0, 0, 0.45));
    /* Pinned to match this box's own light/dark background rather than
       inheriting the lesson card's fixed light color, which is tuned for
       the card's dark wood background, not this box's pale one. */
    color: light-dark(#213547, rgba(255, 255, 255, 0.87));
    min-width: 0;
  }

  .group-box h3 {
    margin: 0 0 0.75rem;
    font-size: 1rem;
  }

  .balloon-row {
    display: flex;
    align-items: flex-end;
    justify-content: center;
    flex-wrap: nowrap;
    gap: clamp(0.25rem, 1.5vw, 1.25rem);
  }
</style>
