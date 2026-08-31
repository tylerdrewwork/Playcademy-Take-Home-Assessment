import { describe, expect, it } from 'vitest'
import {
  CHARACTER_SPRITES,
  advanceQueue,
  createInitialQueueState,
  type QueueState,
} from './characterQueue.js'

/** Deterministic sequence generator for `Math.random()`-shaped fakes — feed
 * it a fixed list of [0, 1) values, cycling once exhausted. */
function fakeRandom(sequence: number[]): () => number {
  let i = 0
  return () => sequence[i++ % sequence.length]
}

describe('createInitialQueueState', () => {
  it('creates exactly three queue entries', () => {
    const state = createInitialQueueState()
    expect(state.queue).toHaveLength(3)
  })

  it('never repeats a sprite between adjacent entries, even when the RNG favors repeats', () => {
    // Every draw returns index 0 unless excluded, which would repeat the
    // same sprite for all three slots if the exclusion logic didn't hold.
    const state = createInitialQueueState(fakeRandom([0, 0, 0]))
    const [front, middle, back] = state.queue
    expect(front.sprite).not.toBe(middle.sprite)
    expect(middle.sprite).not.toBe(back.sprite)
  })

  it('only uses known character sprites', () => {
    const state = createInitialQueueState()
    for (const entry of state.queue) {
      expect(CHARACTER_SPRITES).toContain(entry.sprite)
    }
  })

  it('assigns each entry a unique id', () => {
    const state = createInitialQueueState()
    const ids = state.queue.map((entry) => entry.id)
    expect(new Set(ids).size).toBe(3)
  })

  it('never produces an adjacent repeat across many random seeds', () => {
    for (let i = 0; i < 500; i++) {
      const state = createInitialQueueState(Math.random)
      const [front, middle, back] = state.queue
      expect(front.sprite).not.toBe(middle.sprite)
      expect(middle.sprite).not.toBe(back.sprite)
    }
  })
})

describe('advanceQueue', () => {
  it('moves middle to front and back to middle', () => {
    const before = createInitialQueueState()
    const { state: after, exited } = advanceQueue(before)
    expect(exited).toBe(before.queue[0])
    expect(after.queue[0]).toBe(before.queue[1])
    expect(after.queue[1]).toBe(before.queue[2])
  })

  it('picks a fresh entry for the new back position', () => {
    const before = createInitialQueueState()
    const { state: after, entered } = advanceQueue(before)
    expect(after.queue[2]).toBe(entered)
    expect(entered.id).toBeGreaterThan(before.queue[2].id)
  })

  it('never lets the new back match the new middle, even when the RNG favors repeats', () => {
    const before = createInitialQueueState(fakeRandom([0, 0.9, 0.9]))
    // Force back's sprite to a known value, then bias the RNG to keep
    // re-picking it for the next arrival.
    const biasedRandom = fakeRandom([0])
    const { state: after } = advanceQueue(before, biasedRandom)
    const [, middle, back] = after.queue
    expect(back.sprite).not.toBe(middle.sprite)
  })

  it('keeps ids unique and increasing across repeated advances', () => {
    let state: QueueState = createInitialQueueState()
    const seenIds = new Set(state.queue.map((entry) => entry.id))
    for (let i = 0; i < 50; i++) {
      const result = advanceQueue(state)
      expect(seenIds.has(result.entered.id)).toBe(false)
      seenIds.add(result.entered.id)
      state = result.state
    }
  })

  it('never produces an adjacent repeat across many repeated advances', () => {
    let state: QueueState = createInitialQueueState()
    for (let i = 0; i < 500; i++) {
      const [front, middle, back] = state.queue
      expect(front.sprite).not.toBe(middle.sprite)
      expect(middle.sprite).not.toBe(back.sprite)
      state = advanceQueue(state).state
    }
  })
})
