<script lang="ts">
  import { onDestroy } from 'svelte'
  import { GameSession, type CoinProblem } from './gameSession.svelte.js'
  import CoinScatter from './CoinScatter.svelte'
  import CharacterQueue from './CharacterQueue.svelte'
  import { adminSettings } from '../adminSettings.svelte.js'
  import backgroundBg from '../assets/multiplayer/background_bg.webp'
  import counterImg from '../assets/multiplayer/counter.webp'
  import { musicSettings } from './musicSettingsSingleton.js'
  import bgMusicUrl from '../assets/multiplayer/background-music.ogg'

  let { onExit } = $props()

  const session = new GameSession()
  session.join()

  onDestroy(() => session.leave())

  let characterQueue: CharacterQueue | undefined = $state()

  // The server hands over a fresh problem the instant a correct answer
  // lands, but the coins shown on screen should stay put until the
  // character line has finished stepping up — otherwise the coins would
  // change out from under the player before the new character "arrives".
  // `pendingProblem` guards against re-triggering the step-up animation on
  // every reactive re-run while one is already in flight for this problem.
  let displayedProblem: CoinProblem | null = $state.raw(null)
  let pendingProblem: CoinProblem | null = null
  let transitioning = $state(false)

  $effect(() => {
    const problem = session.problem
    const result = session.lastResult
    if (!problem) return
    if (displayedProblem === null) {
      displayedProblem = problem // first problem on join — no animation
      return
    }
    if (problem === displayedProblem || problem === pendingProblem) return
    if (result !== 'correct') {
      // Not a "customer served" transition (e.g. the Simple Multiplayer
      // toggle regenerated the problem) — show it immediately.
      displayedProblem = problem
      return
    }
    pendingProblem = problem
    transitioning = true
    characterQueue?.advance().then(() => {
      displayedProblem = problem
      pendingProblem = null
      transitioning = false
    })
  })

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
    if (session.status !== 'joined' || !displayedProblem || !answerInputEl) return
    if (session.submitting || transitioning) return // field is disabled; focus() would no-op
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
  <CharacterQueue bind:this={characterQueue} />
  <img class="stage-counter" src={counterImg} alt="" aria-hidden="true" />

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

    {#if displayedProblem}
      <div class="counter-tray">
        <CoinScatter coins={displayedProblem.coins} />
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
            disabled={session.submitting || transitioning}
          />
          <button type="submit" disabled={session.submitting || transitioning}>Submit</button>
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
  /* Mirrors .stage-counter's own rendered height (width:200% of stage width
     scaled by the source art's 1152/2048 aspect ratio, capped at 100% of
     stage height) so .counter-tray can size itself off the counter's
     actual footprint instead of a fixed guess. Keep in sync by hand if
     .stage-counter's width or max-height ever change. */
  .stage {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    --counter-height: min(112.5vw, 100%);
  }

  .stage-layer {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center center;
    pointer-events: none;
    user-select: none;
  }

  /* Sits above the room (stage-bg) and the character line queued up in it,
     reading as the counter's wood surface standing in front of the game
     content. Anchored to the stage's bottom edge (rather than stretched to
     cover the full stage like the other layers). height:auto scales the
     counter up with width normally (tracking the character's own growth),
     but max-height caps it at the same point the character's own
     height:44% (below) stops growing — past that width, the box can no
     longer grow taller, so object-fit:fill (the <img> default) stretches
     the art horizontally to keep covering the full width instead of
     cropping it. The negative bottom offset tucks the image's own bottom
     edge just out of view so no seam shows beneath it. */
  .stage-counter {
    position: absolute;
    left: 0;
    right: 0;
    bottom: -1%;
    width: 200%;
    height: auto;
    max-height: 100%;
    object-fit: fill;
    z-index: 2;
    pointer-events: none;
    user-select: none;
  }

  .status-message,
  .scoreboard {
    position: absolute;
    top: 1rem;
    left: 1rem;
    z-index: 3;
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

  /* counter.webp's opaque wood band starts about 67% down the source
     image, so it occupies the bottom ~33% of .stage-counter's rendered
     height (object-fit:fill preserves each row's relative position when it
     stretches the art). Sizing off --counter-height (rather than a fixed
     percentage of stage height) keeps the tray sitting on that wood band
     instead of floating above it once the counter's own height is capped
     at a fraction of the stage's. */
  .counter-tray {
    position: absolute;
    bottom: calc(var(--counter-height) * 0.1);
    left: 50%;
    transform: translateX(-50%) scale(0.66);
    transform-origin: 50% 100%;
    z-index: 3;
  }

  /* Docked to the very bottom of the screen, underneath the counter tray —
     reads as the counter's front edge, where a player would be standing to
     answer. */
  .answer-bar {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 3;
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
