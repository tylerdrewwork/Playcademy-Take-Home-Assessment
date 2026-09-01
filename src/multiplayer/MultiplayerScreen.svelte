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

  // The coin tray scales itself off the counter's actual rendered height
  // (see CoinScatter's trayHeightPx prop) rather than a fixed CSS
  // transform, so it needs that height as a real pixel measurement.
  let counterEl: HTMLDivElement | undefined = $state()
  let counterHeightPx = $state(0)

  $effect(() => {
    if (!counterEl) return
    const observer = new ResizeObserver(([entry]) => {
      counterHeightPx = entry.contentRect.height
    })
    observer.observe(counterEl)
    return () => observer.disconnect()
  })

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

  // Shows a transient "{name} earned {amount} cents!" note next to a
  // player's name on the scoreboard when their award changes. Keyed by uid
  // so simultaneous awards from different players don't clobber each other.
  // `undefined` means "not yet seen" — an award that predates this screen
  // mounting (e.g. it happened before we joined) must not replay as fresh.
  let earnMessages: Record<string, string> = $state({})
  const seenAwardAt: Record<string, number | null | undefined> = {}
  const earnMessageTimers: Record<string, ReturnType<typeof setTimeout>> = {}

  $effect(() => {
    for (const player of session.players) {
      const award = player.lastAward
      const previous = seenAwardAt[player.uid]
      seenAwardAt[player.uid] = award?.at ?? null
      if (previous === undefined || !award || award.at === previous) continue

      earnMessages[player.uid] =
        `${player.name} earned ${award.cents} ${award.cents === 1 ? 'cent' : 'cents'}!`
      clearTimeout(earnMessageTimers[player.uid])
      earnMessageTimers[player.uid] = setTimeout(() => {
        delete earnMessages[player.uid]
      }, 3000)
    }
  })

  onDestroy(() => {
    for (const timer of Object.values(earnMessageTimers)) clearTimeout(timer)
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

<div class="multiplayer-screen">
  <div class="stage">
    <img class="stage-layer stage-bg" src={backgroundBg} alt="" aria-hidden="true" />
    <CharacterQueue bind:this={characterQueue} />
    <div class="stage-counter" bind:this={counterEl}>
      <img class="stage-counter-img" src={counterImg} alt="" aria-hidden="true" />
      {#if session.status === 'joined' && displayedProblem}
        <div class="counter-tray">
          <CoinScatter coins={displayedProblem.coins} trayHeightPx={counterHeightPx} />
        </div>
      {/if}
    </div>

    {#if session.status === 'joining'}
      <p class="status-message">Joining game…</p>
    {:else if session.status === 'error'}
      <p class="status-message error">Couldn't join the game. Please check your connection and try again.</p>
    {:else if session.status === 'joined'}
      <div class="scoreboard">
        <h3>Current Employees ({session.playerCount})</h3>
        <ul>
          {#each session.players as player (player.uid)}
            <li class:self={player.isSelf}>
              <span class="player-name">{player.name}{player.isSelf ? ' (You)' : ''}</span>
              <span class="earn-message">{earnMessages[player.uid] ?? ''}</span>
            </li>
          {/each}
        </ul>
      </div>
    {/if}
  </div>

  {#if session.status === 'joined' && displayedProblem}
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
</div>

<style>
  /* Stacks the stage above the docked answer-bar so the bar reserves its
     own row instead of floating over the stage as a transparent overlay —
     the stage (flex:1) shrinks to the space left over, so its content
     shifts up rather than being covered. */
  .multiplayer-screen {
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .stage {
    position: relative;
    flex: 1 1 auto;
    min-height: 0;
    overflow: hidden;
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
     content. Doesn't need to be absolutely positioned itself — it's the
     only normal-flow child of .stage (stage-bg/CharacterQueue are both
     absolute), so a plain block at width:200%/height:100% already fills
     the stage exactly, top to bottom, on its own. position:relative
     (rather than static) is still needed so .counter-tray's own
     percentages, and .stage-counter-img's inset:0, resolve against this
     box specifically. */
  .stage-counter {
    position: relative;
    width: 200%;
    height: 100%;
    z-index: 2;
    pointer-events: none;
    user-select: none;
  }

  /* Fills the box .stage-counter establishes above; object-fit:fill (the
     <img> default) stretches the art to match whenever aspect-ratio's
     natural sizing gets overridden by max-height. */
  .stage-counter-img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: fill;
  }

  .status-message,
  .scoreboard {
    position: absolute;
    top: 1rem;
    right: 1rem;
    z-index: 3;
    max-width: 18rem;
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
    display: flex;
    align-items: baseline;
    gap: 0.6rem;
    padding: 0.15rem 0;
  }

  .scoreboard li.self {
    font-weight: bold;
  }

  .scoreboard .player-name {
    flex-shrink: 0;
  }

  /* Reserves room next to the name for a transient "earned N cents!" note,
     so the row doesn't jump width when one appears. */
  .scoreboard .earn-message {
    flex-grow: 1;
    min-width: 6rem;
    font-weight: normal;
    font-size: 0.8em;
    color: #1a7f37;
    text-align: right;
  }

  /* counter.webp's opaque wood band starts about 67% down the source
     image, so it occupies the bottom ~33% of .stage-counter's rendered
     height (object-fit:fill preserves each row's relative position when it
     stretches the art). This tray is a child of .stage-counter, so bottom
     resolves directly against the counter's own actual box, and always
     sits on that wood band however the counter itself ends up sized. left
     is 25%, not 50%, because .stage-counter is itself 200% wide anchored
     at the stage's left edge — the stage's own horizontal center falls at
     the 25% mark of that wider box, not its 50% mark. The scale that used
     to live here as a fixed factor is now CoinScatter's own job (see its
     trayHeightPx prop), since it needs the counter's actual pixel height
     to track it — a plain CSS scale() can't read that. */
  .counter-tray {
    position: absolute;
    bottom: 10%;
    left: 25%;
    transform: translateX(-50%);
    z-index: 3;
  }

  /* A docked footer row (not an overlay floating over the stage), so its
     height comes out of the flex layout above and the stage shrinks to
     make room instead of the bar covering stage content. Solid background
     (no alpha) since it's no longer sitting on top of anything to show
     through. */
  .answer-bar {
    flex: 0 0 auto;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    background: #2b1d0e;
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
