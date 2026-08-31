<script lang="ts">
  import { onDestroy } from 'svelte'
  import { GameSession } from './gameSession.svelte.js'
  import CoinScatter from './CoinScatter.svelte'
  import OtherPlayerColumn from './OtherPlayerColumn.svelte'
  import { adminSettings } from '../adminSettings.svelte.js'
  import backgroundBg from '../assets/multiplayer/background_bg.webp'
  import backgroundFg from '../assets/multiplayer/background_fg.webp'

  let { onExit } = $props()

  const session = new GameSession()
  session.join()

  const otherPlayers = $derived(session.players.filter((player) => !player.isSelf))

  onDestroy(() => session.leave())

  // When the Simple Multiplayer toggle flips mid-game, swap in a freshly
  // generated problem right away so the new difficulty doesn't wait for the
  // next correct answer. Compared against the previous value so the effect's
  // first run on mount doesn't regenerate the problem join() just dealt.
  let lastSimpleMultiplayer = adminSettings.simpleMultiplayer
  $effect(() => {
    const simple = adminSettings.simpleMultiplayer
    if (simple === lastSimpleMultiplayer) return
    lastSimpleMultiplayer = simple
    session.regenerateProblem()
  })

  // <input type="number" bind:value> gives Svelte a number (or undefined
  // when the field is empty), never a string — don't treat this as text.
  let answer: number | undefined = $state(undefined)
  let answerInputEl: HTMLInputElement | undefined = $state()

  // Pressing a digit anywhere on the screen types it into the answer field
  // and focuses it, so the student can just type "5" + Enter without
  // clicking the box first — same behavior as the lesson's problem screen.
  function handleGlobalDigit(event: KeyboardEvent): void {
    if (session.status !== 'joined' || !session.problem || !answerInputEl) return
    if (session.submitting) return // field is disabled; focus() would no-op
    if (event.ctrlKey || event.metaKey || event.altKey) return
    if (!/^\d$/.test(event.key)) return
    const target = event.target
    if (target === answerInputEl) return // already typing in the field
    // Leave other editable elements and open dialogs (Admin Tools) alone.
    if (
      target instanceof Element &&
      (target.closest('dialog') || target.matches('input, textarea, select, [contenteditable]'))
    ) {
      return
    }
    event.preventDefault()
    answerInputEl.focus()
    const digits = answer === undefined ? '' : String(answer)
    if (digits.length >= 3) return // sums max out at 100 cents
    answer = Number(digits + event.key)
  }

  const moneyFormatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  })

  function handleSubmit(event: SubmitEvent): void {
    event.preventDefault()
    if (answer === undefined || !Number.isFinite(answer)) return

    session.submitAnswer(answer)
    answer = undefined
  }
</script>

<svelte:window onkeydown={handleGlobalDigit} />

<div class="stage">
  <img class="stage-layer stage-bg" src={backgroundBg} alt="" aria-hidden="true" />
  <img class="stage-layer stage-fg" src={backgroundFg} alt="" aria-hidden="true" />

  <section class="multiplayer-screen">
    <h2>Multiplayer Coin Game</h2>

    {#if session.status === 'joining'}
      <p>Joining game…</p>
    {:else if session.status === 'error'}
      <p class="error">Couldn't join the game. Please check your connection and try again.</p>
    {:else if session.status === 'joined' && session.problem}
      <div class="columns">
        <div class="self-column">
          <p>How many cents are these coins worth?</p>
          <CoinScatter coins={session.problem.coins} />
          <p>{session.playerCount} player{session.playerCount === 1 ? '' : 's'} in the room.</p>

          <form class="answer-form" onsubmit={handleSubmit}>
            <input
              type="number"
              inputmode="numeric"
              min="0"
              placeholder="How many cents?"
              aria-label="How many cents do the coins add up to?"
              bind:this={answerInputEl}
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
        </div>

        {#each otherPlayers as player (player.uid)}
          <OtherPlayerColumn name={player.name} lastAward={player.lastAward} />
        {/each}
      </div>
    {/if}

    <button onclick={onExit}>Back to lesson</button>

    {#if session.status === 'joined'}
      <p class="total-money">
        Total money earned: {moneyFormatter.format(session.totalMoneyCents / 100)}
      </p>
    {/if}
  </section>
</div>

<style>
  .stage {
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 16px;
    overflow: hidden;
  }

  .stage-layer {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    pointer-events: none;
    user-select: none;
  }

  /* Sits above the room (stage-bg); its transparent middle lets the room
     show through while its opaque edges (espresso machine, pastry case)
     read as furniture standing in front of the game content. */
  .stage-fg {
    z-index: 1;
  }

  .multiplayer-screen {
    position: relative;
    z-index: 2;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    padding: 2rem;
    text-align: center;
    max-height: 100%;
    overflow-y: auto;
    color: #2b1d0e;
    background: rgba(255, 248, 235, 0.9);
    border-radius: 16px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
  }

  .columns {
    display: flex;
    flex-wrap: wrap;
    align-items: stretch;
    justify-content: center;
    gap: 0.75rem;
    max-width: 100%;
  }

  /* Same stack the screen rendered before other players got columns. */
  .self-column {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
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

  /* The card's fixed cream background and dark text don't track the OS
     light/dark scheme, so buttons need their own fixed colors too —
     otherwise dark mode's near-black button background hides this dark
     text. */
  .multiplayer-screen button {
    background-color: #6b4423;
    color: #fff8ec;
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
