<script>
  let { onExit } = $props()
</script>

<section class="multiplayer-screen">
  <h2>Multiplayer Coin Game</h2>
  <p>This is a placeholder for the multiplayer coin counting game. Not implemented yet.</p>
  <button onclick={onExit}>Back to lesson</button>
</section>

<style>
  .multiplayer-screen {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    padding: 2rem;
    text-align: center;
  }
</style>
