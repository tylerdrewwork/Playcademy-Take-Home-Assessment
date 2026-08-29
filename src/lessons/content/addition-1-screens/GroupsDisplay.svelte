<script>
  import Balloon from '../../Balloon.svelte'

  // continuousNumbering: false restarts numbering at 1 within each group
  // (used while counting a group on its own); true numbers balloons in
  // order across all groups (used for the final recount of the merged set).
  let { groups, revealedCounts = [], continuousNumbering = false } = $props()

  function numberOffset(groupIndex) {
    if (!continuousNumbering) return 0
    let offset = 0
    for (let k = 0; k < groupIndex; k++) offset += groups[k].count
    return offset
  }
</script>

<div class="groups-row">
  {#each groups as group, i}
    {#if i > 0}<span class="operator">+</span>{/if}
    <div class="group-box">
      <h3>Group {i + 1}</h3>
      <div class="balloon-row" style="--balloon-count: {group.count}">
        {#each Array.from({ length: group.count }) as _, j}
          <Balloon color={group.color} number={j < (revealedCounts[i] ?? 0) ? numberOffset(i) + j + 1 : undefined} />
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
    flex-wrap: wrap;
  }

  .operator {
    font-size: 1.5rem;
    font-weight: bold;
  }

  .group-box {
    border: 2px dashed #a9c9e8;
    border-radius: 0.75rem;
    padding: 1rem 1.25rem;
    background: light-dark(#eaf3fc, #16233a);
  }

  .group-box h3 {
    margin: 0 0 0.75rem;
    font-size: 1rem;
  }

  .balloon-row {
    display: flex;
    align-items: flex-end;
    justify-content: center;
    flex-wrap: wrap;
    gap: clamp(0.5rem, 1.5vw, 1.25rem);
  }
</style>
