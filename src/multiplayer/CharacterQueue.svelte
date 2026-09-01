<script lang="ts">
  import { onDestroy } from 'svelte'
  import {
    advanceQueue,
    createInitialQueueState,
    type CharacterSprite,
    type QueueEntry,
    type QueueState,
  } from './characterQueue.js'
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

  let queueState: QueueState = $state(createInitialQueueState())

  interface ExitingEntry extends QueueEntry {
    leaving: boolean
  }
  let exiting: ExitingEntry[] = $state([])
  let enteringId: number | null = $state(null)

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

     right: 50% + margin-right: -14.5% (half of the 29% width) centers
     every rank on the same vertical line regardless of its scale — margin
     is resolved at layout time, before the transform's scale() is
     applied, so shrinking a rank never pulls its center off that line. */
  .character {
    position: absolute;
    right: 50%;
    margin-right: -14.5%;
    width: 29%;
    height: 44%;
    object-fit: contain;
    object-position: bottom center;
    transform-origin: bottom center;
    transition:
      right 0.7s ease,
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
    transform: scale(1);
    filter: brightness(1);
    z-index: 3;
  }

  .rank-1 {
    bottom: 17%;
    transform: scale(0.82);
    filter: brightness(0.95);
    z-index: 2;
  }

  .rank-2 {
    bottom: 31%;
    transform: scale(0.68);
    filter: brightness(0.9);
    z-index: 1;
  }

  /* Declared after .rank-2 so it wins the opacity tie-break: starts
     invisible, then the class is removed a couple of frames later so the
     fade-to-1 is an observed transition rather than an instant pop-in. */
  .character.entering {
    opacity: 0;
  }

  /* Declared after .rank-0 so it wins the right/opacity tie-break: the
     departing front character keeps rank-0's size/brightness but slides
     off the right edge and fades as it goes. */
  .character.exiting {
    right: -100%;
    opacity: 0;
  }
</style>
