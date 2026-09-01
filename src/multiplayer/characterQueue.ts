export const CHARACTER_SPRITES = [
  'char-businessman',
  'char-dog',
  'char-doglady',
  'char-tall-man',
  'char-teen',
] as const

export type CharacterSprite = (typeof CHARACTER_SPRITES)[number]

export interface QueueEntry {
  id: number
  sprite: CharacterSprite
}

export interface QueueState {
  /** [front, middle, back] — the character actively being served, and the
   * two waiting behind them. */
  queue: [QueueEntry, QueueEntry, QueueEntry]
  nextId: number
}

export interface AdvanceResult {
  state: QueueState
  /** The character who just finished and stepped out of line. */
  exited: QueueEntry
  /** The freshly picked character who joined at the back of the line. */
  entered: QueueEntry
}

function pickSprite(random: () => number, exclude?: CharacterSprite): CharacterSprite {
  const options = exclude
    ? CHARACTER_SPRITES.filter((sprite) => sprite !== exclude)
    : CHARACTER_SPRITES
  return options[Math.floor(random() * options.length)]
}

/** Builds the initial 3-entry line (front, middle, back). Adjacent entries
 * (front/middle, and middle/back) never share a sprite, so the player never
 * sees the same character twice in a row. */
export function createInitialQueueState(random: () => number = Math.random): QueueState {
  const front: QueueEntry = { id: 0, sprite: pickSprite(random) }
  const middle: QueueEntry = { id: 1, sprite: pickSprite(random, front.sprite) }
  const back: QueueEntry = { id: 2, sprite: pickSprite(random, middle.sprite) }
  return { queue: [front, middle, back], nextId: 3 }
}

/** Shifts the line after the front character is served: front exits,
 * middle steps up to front, back steps up to middle, and a freshly picked
 * character joins at the back. The new arrival never matches the character
 * now standing in front of it (the new middle), so no two adjacent queue
 * positions ever show the same character. */
export function advanceQueue(state: QueueState, random: () => number = Math.random): AdvanceResult {
  const [front, middle, back] = state.queue
  const entered: QueueEntry = { id: state.nextId, sprite: pickSprite(random, back.sprite) }
  return {
    state: { queue: [middle, back, entered], nextId: state.nextId + 1 },
    exited: front,
    entered,
  }
}
