<script lang="ts">
  import { onDestroy } from 'svelte'
  import { GameSession } from './gameSession.svelte.js'

  let { onExit } = $props()

  const session = new GameSession()
  session.join()

  onDestroy(() => session.leave())

  // <input type="number" bind:value> gives Svelte a number (or undefined
  // when the field is empty), never a string — don't treat this as text.
  let answer: number | undefined = $state(undefined)

  const moneyFormatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  })

  const COIN_NAMES: Record<number, [string, string]> = {
    25: ['quarter', 'quarters'],
    10: ['dime', 'dimes'],
    5: ['nickel', 'nickels'],
    1: ['penny', 'pennies'],
  }

  // Placeholder text description of the coin assortment — the underlying
  // `coins` array (one entry per physical coin) is what a future visual
  // rendering (one image per coin) will iterate over instead.
  function describeCoins(coins: number[]): string {
    const counts = new Map<number, number>()
    for (const value of coins) counts.set(value, (counts.get(value) ?? 0) + 1)

    return [25, 10, 5, 1]
      .filter((value) => counts.has(value))
      .map((value) => {
        const count = counts.get(value)!
        const [singular, plural] = COIN_NAMES[value]
        return `${count} ${count === 1 ? singular : plural}`
      })
      .join(', ')
  }

  function handleSubmit(event: SubmitEvent): void {
    event.preventDefault()
    if (answer === undefined || !Number.isFinite(answer)) return

    session.submitAnswer(answer)
    answer = undefined
  }
</script>

<section class="multiplayer-screen">
  <h2>Multiplayer Coin Game</h2>

  {#if session.status === 'joining'}
    <p>Joining game…</p>
  {:else if session.status === 'error'}
    <p class="error">Couldn't join the game. Please check your connection and try again.</p>
  {:else if session.status === 'joined' && session.problem}
    <p>Count the coins: {describeCoins(session.problem.coins)}.</p>
    <p>{session.playerCount} player{session.playerCount === 1 ? '' : 's'} in the room.</p>

    <form class="answer-form" onsubmit={handleSubmit}>
      <input
        type="number"
        inputmode="numeric"
        min="0"
        placeholder="How many cents?"
        aria-label="How many cents do the coins add up to?"
        bind:value={answer}
        disabled={session.submitting}
      />
      <button type="submit" disabled={session.submitting}>Submit</button>
    </form>

    {#if session.lastResult === 'correct'}
      <p class="feedback correct">Correct! Here's a new group to count.</p>
    {:else if session.lastResult === 'incorrect'}
      <p class="feedback incorrect">Not quite — count again and resubmit.</p>
    {/if}
  {/if}

  <button onclick={onExit}>Back to lesson</button>

  {#if session.status === 'joined'}
    <p class="total-money">
      Total money earned: {moneyFormatter.format(session.totalMoneyCents / 100)}
    </p>
  {/if}
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

  .answer-form {
    display: flex;
    gap: 0.5rem;
  }

  .answer-form input {
    width: 8rem;
    padding: 0.4rem 0.6rem;
    font-size: 1rem;
  }

  .answer-form button {
    padding: 0.4rem 0.8rem;
  }

  .feedback {
    margin: 0;
    font-weight: bold;
  }

  .feedback.correct {
    color: #1a7f37;
  }

  .feedback.incorrect {
    color: #b3261e;
  }

  .total-money {
    margin-top: auto;
    font-size: 1.1rem;
    font-weight: bold;
  }
</style>
