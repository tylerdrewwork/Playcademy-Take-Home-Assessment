<script>
  import Balloon from '../../Balloon.svelte'

  let { groups } = $props()
</script>

<div class="groups-row">
  {#each groups as group, i}
    {#if i > 0}<span class="operator">+</span>{/if}
    <div class="group-box">
      <h3>Group {i + 1}</h3>
      <div class="balloon-row">
        {#each Array.from({ length: group.count }) as _}
          <Balloon color={group.color} />
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
    justify-content: center;
    gap: 0.5rem;
  }
</style>
