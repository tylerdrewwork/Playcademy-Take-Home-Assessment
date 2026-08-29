<script lang="ts">
  import { onDestroy } from 'svelte'
  import { GameSession } from './gameSession.svelte.js'

  let { onExit } = $props()

  const session = new GameSession()
  session.join()

  onDestroy(() => session.leave())
</script>

<section class="multiplayer-screen">
  <h2>Multiplayer Coin Game</h2>

  {#if session.status === 'joining'}
    <p>Joining game…</p>
  {:else if session.status === 'error'}
    <p class="error">Couldn't join the game. Please check your connection and try again.</p>
  {:else if session.status === 'joined'}
    <p>You're presented with {session.coinsPresented} coins to count.</p>
    <p>{session.playerCount} player{session.playerCount === 1 ? '' : 's'} in the room.</p>
  {/if}

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

  .error {
    color: #b3261e;
  }
</style>
