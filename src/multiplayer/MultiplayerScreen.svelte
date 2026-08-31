<script lang="ts">
  import { onDestroy } from 'svelte'
  import { GameSession } from './gameSession.svelte.js'
  import CoinScatter from './CoinScatter.svelte'
  import { adminSettings } from '../adminSettings.svelte.js'
  import backgroundBg from '../assets/multiplayer/background_bg.webp'
  import backgroundFg from '../assets/multiplayer/background_fg.webp'
  import { musicSettings } from './musicSettingsSingleton.js'
  import bgMusicUrl from '../assets/multiplayer/background-music.ogg'

  let { onExit } = $props()

  const session = new GameSession()
  session.join()

  onDestroy(() => session.leave())

  const bgMusic = new Audio(bgMusicUrl)
  bgMusic.loop = true
  bgMusic.volume = 0.25

  // Wait for the persisted mute preference to load before touching playback,
  // so a player who muted last visit doesn't hear a flash of audio before
  // their preference is read back from IndexedDB.
  let musicSettingsReady = $state(false)
  musicSettings.ready.then(() => (musicSettingsReady = true))

  $effect(() => {
    if (!musicSettingsReady) return
    if (musicSettings.muted) {
      bgMusic.pause()
    } else {
      bgMusic.play().catch(() => {})
    }
  })

  onDestroy(() => {
    bgMusic.pause()
    bgMusic.src = ''
  })

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

  {#if session.status === 'joining'}
    <p class="status-message">Joining game…</p>
  {:else if session.status === 'error'}
    <p class="status-message error">Couldn't join the game. Please check your connection and try again.</p>
  {:else if session.status === 'joined'}
    <div class="scoreboard">
      <h3>Players ({session.playerCount})</h3>
      <ul>
        {#each session.players as player (player.uid)}
          <li class:self={player.isSelf}>{player.name}{player.isSelf ? ' (You)' : ''}</li>
        {/each}
      </ul>
    </div>

    {#if session.problem}
      <div class="counter-tray">
        <CoinScatter coins={session.problem.coins} />
      </div>

      <div class="answer-bar">
        <p class="prompt">How many cents are these coins worth?</p>

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
    {/if}
  {/if}
</div>

<style>
  .stage {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }

  .stage-layer {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: left center;
    pointer-events: none;
    user-select: none;
  }

  /* Sits above the room (stage-bg); its transparent middle lets the room
     show through while its opaque edges (espresso machine, pastry case)
     read as furniture standing in front of the game content. */
  .stage-fg {
    z-index: 1;
  }

  .status-message,
  .scoreboard {
    position: absolute;
    top: 1rem;
    left: 1rem;
    z-index: 2;
    max-width: 12rem;
    padding: 0.6rem 0.9rem;
    border-radius: 12px;
    color: #2b1d0e;
    background: rgba(255, 248, 235, 0.9);
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25);
    text-align: left;
  }

  .status-message {
    margin: 0;
    font-size: 0.9rem;
  }

  .status-message.error {
    color: #b3261e;
  }

  .scoreboard h3 {
    margin: 0 0 0.4rem;
    font-size: 0.9rem;
  }

  .scoreboard ul {
    list-style: none;
    margin: 0;
    padding: 0;
    font-size: 0.85rem;
  }

  .scoreboard li {
    padding: 0.15rem 0;
  }

  .scoreboard li.self {
    font-weight: bold;
  }

  /* The counter's wood surface in background_fg.webp starts at 72.2% of
     that image's height and runs to the bottom edge — a band only ~28% of
     the frame tall. Anchoring from a fixed distance above the answer bar
     (rather than a percentage of stage height) keeps the tray's footprint
     on the wood regardless of viewport height, with room reserved below
     it for the bar itself. */
  .counter-tray {
    position: absolute;
    bottom: 3.5rem;
    left: 50%;
    transform: translateX(-50%) scale(0.66);
    transform-origin: 50% 100%;
    z-index: 2;
  }

  /* Docked to the very bottom of the screen, underneath the counter tray —
     reads as the counter's front edge, where a player would be standing to
     answer. */
  .answer-bar {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 2;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    background: rgba(43, 29, 14, 0.75);
    color: #fff8ec;
  }

  .answer-bar .prompt {
    margin: 0;
    font-weight: bold;
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
    background-color: #6b4423;
    color: #fff8ec;
  }

  .feedback {
    margin: 0;
    font-weight: bold;
  }

  .feedback.correct {
    color: #7fd88f;
  }

  .feedback.incorrect {
    color: #ff9d90;
  }
</style>
