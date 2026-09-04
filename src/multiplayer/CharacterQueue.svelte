<script lang="ts">
  import { onDestroy } from 'svelte'
  import { scale } from 'svelte/transition'
  import {
    advanceQueue,
    createInitialQueueState,
    type CharacterSprite,
    type QueueEntry,
    type QueueState,
  } from './characterQueue.js'
  import { SPEECH_PHRASES } from './speechPhrases.js'
  import charBusinessman from '../assets/multiplayer/characters/char-businessman.webp'
  import charDog from '../assets/multiplayer/characters/char-dog.webp'
  import charDoglady from '../assets/multiplayer/characters/char-doglady.webp'
  import charTallMan from '../assets/multiplayer/characters/char-tall-man.webp'
  import charTeen from '../assets/multiplayer/characters/char-teen.webp'

  const SPRITE_SRC: Record<CharacterSprite, string> = {
    'char-businessman': charBusinessman,
    'char-dog': charDog,
    'char-doglady': charDoglady,
    'char-tall-man': charTallMan,
    'char-teen': charTeen,
  }

  // Kept in sync with the CSS transition durations below — advance()'s
  // returned promise waits this long before revealing the settled state, so
  // JS and CSS must agree on how long the step-up takes.
  const STEP_DURATION_MS = 700

  // How long a fresh arrival's speech bubble stays up before fading on its
  // own. Comfortably shorter than the time it'd take another correct answer
  // to advance the queue and change who's standing in the back slot.
  const SPEECH_DURATION_MS = 3800

  let queueState: QueueState = $state(createInitialQueueState())

  interface ExitingEntry extends QueueEntry {
    leaving: boolean
  }
  let exiting: ExitingEntry[] = $state([])
  let enteringId: number | null = $state(null)

  // The freshest arrival's speech bubble text. Always tied to whoever just
  // joined the back of the line (rank 2) — .speech-anchor below mirrors
  // rank-2's own position/scale, so there's no need to track which entry
  // it belongs to beyond gating re-greets in greet() below.
  let speechText: string | null = $state(null)
  let speechTimeout: ReturnType<typeof setTimeout> | null = null

  function greet(): void {
    if (speechTimeout) clearTimeout(speechTimeout)
    speechText = SPEECH_PHRASES[Math.floor(Math.random() * SPEECH_PHRASES.length)]
    speechTimeout = setTimeout(() => {
      speechTimeout = null
      speechText = null
    }, SPEECH_DURATION_MS)
  }

  // Greet the back-of-line arrival everyone sees on first render too — they
  // are just as "new" to the screen as anyone who joins later via advance().
  greet()

  let pendingTimeouts = new Set<ReturnType<typeof setTimeout>>()

  function afterPaint(fn: () => void): void {
    // Two rAFs guarantee the browser has committed the pre-transition style
    // (e.g. opacity: 0) to a paint before we flip the class that starts the
    // CSS transition — a single rAF can still land before that paint.
    requestAnimationFrame(() => requestAnimationFrame(fn))
  }

  /** Steps the line forward: the front character exits to the right, the
   * middle and back characters step up, and a freshly picked character
   * fades in at the back. Resolves once the step-up animation has finished,
   * so callers can gate anything (like revealing a new set of coins) on the
   * new front character actually being in place. */
  export function advance(): Promise<void> {
    const { state: nextState, exited, entered } = advanceQueue(queueState)
    const exitId = exited.id

    exiting = [...exiting, { ...exited, leaving: false }]
    queueState = nextState
    enteringId = entered.id
    greet()

    afterPaint(() => {
      exiting = exiting.map((entry) =>
        entry.id === exitId ? { ...entry, leaving: true } : entry
      )
      enteringId = null
    })

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        pendingTimeouts.delete(timeout)
        exiting = exiting.filter((entry) => entry.id !== exitId)
        resolve()
      }, STEP_DURATION_MS)
      pendingTimeouts.add(timeout)
    })
  }

  onDestroy(() => {
    for (const timeout of pendingTimeouts) clearTimeout(timeout)
    pendingTimeouts.clear()
    if (speechTimeout) clearTimeout(speechTimeout)
  })
</script>

<div class="character-line" aria-hidden="true">
  {#each exiting as entry (entry.id)}
    <img
      class="character rank-0"
      class:exiting={entry.leaving}
      src={SPRITE_SRC[entry.sprite]}
      alt=""
    />
  {/each}
  {#each queueState.queue as entry, rank (entry.id)}
    <img
      class="character rank-{rank}"
      class:entering={entry.id === enteringId}
      src={SPRITE_SRC[entry.sprite]}
      alt=""
    />
  {/each}
  {#if speechText}
    <!-- A standalone overlay (not nested inside a ranked .character element)
         so its own z-index always wins against every rank, including the
         much larger front-of-line character — nesting it inside rank-2's
         own element would trap it in that rank's stacking context, which
         loses to rank-0/rank-1 regardless of any z-index set here. -->
    <div class="speech-anchor">
      <p class="speech-bubble" transition:scale={{ duration: 220, start: 0.6 }}>
        {speechText}
      </p>
    </div>
  {/if}
</div>

<style>
  /* Stands between the room (stage-bg) and the counter/machine (stage-fg),
     so the line queues up in the shop's floor space. The explicit z-index
     opens its own stacking context, so the rank-0/1/2 z-indices below only
     order the characters relative to each other, not to the rest of the
     scene. */
  .character-line {
    position: absolute;
    inset: 0;
    z-index: 1;
    pointer-events: none;
  }

  /* A fixed box (rather than height + width:auto) keeps every sprite the
     same rendered size regardless of the source art's own aspect ratio —
     one of the five sprites ships as a landscape image instead of portrait
     like the rest, and would otherwise render far too large. object-fit
     and object-position keep each character's feet flush with the box's
     bottom edge no matter how much it letterboxes.

     width:100% (spanning the full character-line, left:0) rather than a
     narrow centered column — object-position's "center" keeps each rank's
     sprite centered on the same vertical line regardless of its scale,
     since object-fit:contain draws it centered within the box no matter
     how much wider than the sprite that box is. */
  .character {
    position: absolute;
    left: 0;
    width: 100%;
    height: 44%;
    object-fit: contain;
    object-position: bottom center;
    transform-origin: bottom center;
    transition:
      bottom 0.7s ease,
      transform 0.7s ease,
      filter 0.7s ease,
      opacity 0.5s ease;
  }

  /* Front of the line stands feet-first at the very bottom of the stage,
     behind the counter (character-line's z-index loses to stage-fg's in
     MultiplayerScreen, so the counter drawn there covers everything below
     its top edge). Each rank behind steps up enough that its head clears
     the rank in front — bottom's gain has to outrun the height lost to
     that rank's smaller scale, or it stays hidden behind the front of the
     line instead of stacking above it. */
  .rank-0 {
    bottom: 0%;
    transform: scale(2);
    filter: contrast(1);
    z-index: 3;
  }

  .rank-1 {
    bottom: 30%;
    transform: scale(0.82);
    filter: contrast(0.7);
    z-index: 2;
  }

  .rank-2 {
    bottom: 40%;
    transform: scale(0.68);
    filter: contrast(0.4);
    z-index: 1;
  }

  /* Declared after .rank-2 so it wins the opacity tie-break: starts
     invisible, then the class is removed a couple of frames later so the
     fade-to-1 is an observed transition rather than an instant pop-in. */
  .character.entering {
    opacity: 0;
  }

  /* Declared after .rank-0 so it wins the transform/opacity tie-break: the
     departing front character keeps rank-0's scale (restated here since
     transform doesn't merge across rules) but slides off to the right and
     fades as it goes. left+width are both set on .character now, which
     leaves a plain "right" over-constrained and inert — translateX moves
     it instead. */
  .character.exiting {
    transform: translateX(100%) scale(2);
    opacity: 0;
  }

  /* Mirrors .rank-2's own box exactly (same bottom/height/scale/origin) so
     the bubble always floats directly above whoever just joined the back
     of the line, without being nested inside that rank's element (see the
     comment in the markup above for why). z-index is set far above every
     rank so it's never covered by the larger, closer characters in front. */
  .speech-anchor {
    position: absolute;
    left: 0;
    width: 100%;
    height: 44%;
    bottom: 40%;
    transform: scale(0.68);
    transform-origin: bottom center;
    z-index: 10;
    pointer-events: none;
  }

  /* Centered on the same x:50% the character art itself resolves to
     (object-position: bottom center within the same full-width box), so it
     never drifts to one side of its character. Sized in em/rem rather than
     viewport units — the ambient percentage-based layout plus
     .speech-anchor's own scale(0.68) already make its rendered size
     responsive without any extra media queries, and read as appropriately
     "small" for a back-of-line arrival. */
  .speech-bubble {
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    margin: 0 0 0.5em;
    max-width: 9em;
    padding: 0.45em 0.7em;
    border-radius: 0.9em;
    background: #fff8ec;
    color: #2b1d0e;
    font-size: 0.85rem;
    font-weight: 600;
    line-height: 1.2;
    text-align: center;
    white-space: normal;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.28);
  }

  /* Little tail pointing down toward the character's head. */
  .speech-bubble::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    border: 0.4em solid transparent;
    border-top-color: #fff8ec;
  }
</style>
