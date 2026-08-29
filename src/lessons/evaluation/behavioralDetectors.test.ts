import { describe, expect, it } from 'vitest'
import { detectDistraction, detectRageClicks } from './behavioralDetectors.js'
import { DEFAULT_EVALUATION_CONFIG } from './evaluationTypes.js'
import type { InteractionEvent } from './evaluationTypes.js'

// Thresholds under test (from DEFAULT_EVALUATION_CONFIG):
// distraction: 8000ms duration, 1200px travel, 1500ms max move gap
// rage click: 5 inputs within a 2000ms window, then 4000ms quiet
const config = DEFAULT_EVALUATION_CONFIG

const move = (t: number, x: number, y = 0): InteractionEvent => ({ type: 'pointer-move', t, x, y })
const click = (t: number, target: string | null = null): InteractionEvent => ({ type: 'pointer-down', t, target })
const key = (t: number, k = 'a', target: string | null = null): InteractionEvent => ({ type: 'key-down', t, key: k, target })
const hidden = (t: number): InteractionEvent => ({ type: 'visibility', t, hidden: true })

// Steady wandering: one move every 500ms, each 100px further along x.
function wander(fromT: number, toT: number, stepMs = 500, stepPx = 100): InteractionEvent[] {
  const events: InteractionEvent[] = []
  for (let t = fromT, i = 0; t <= toT; t += stepMs, i++) {
    events.push(move(t, i * stepPx))
  }
  return events
}

describe('detectDistraction', () => {
  it('fires once duration and travel thresholds are both met', () => {
    const findings = detectDistraction(wander(0, 8000), 8000, config)
    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({ signal: 'distracted', polarity: 'concern', t: 0, attemptIndex: null })
    expect(findings[0].detail).toMatchObject({ durationMs: 8000 })
  })

  it('emits only one finding per wander window even as it keeps growing', () => {
    const findings = detectDistraction(wander(0, 20_000), 20_000, config)
    expect(findings).toHaveLength(1)
  })

  it('reports the same start timestamp when re-scanned with more events, so dedupe holds', () => {
    const first = detectDistraction(wander(0, 8000), 8000, config)
    const second = detectDistraction(wander(0, 12_000), 12_000, config)
    expect(second[0].t).toBe(first[0].t)
  })

  it('does not fire when the duration is just short of the threshold', () => {
    const findings = detectDistraction(wander(0, 7500), 7500, config)
    expect(findings).toHaveLength(0)
  })

  it('does not fire when the pointer barely travels', () => {
    // 17 samples over 8s but only 10px apart: 160px total travel.
    const findings = detectDistraction(wander(0, 8000, 500, 10), 8000, config)
    expect(findings).toHaveLength(0)
  })

  it('is reset by a keystroke mid-wander', () => {
    const events = [...wander(0, 4000), key(4100), ...wander(4500, 12_000)]
    expect(detectDistraction(events, 12_000, config)).toHaveLength(0)
    // Give the post-keystroke wander enough time and it fires, starting there.
    const longer = [...wander(0, 4000), key(4100), ...wander(4500, 12_500)]
    const findings = detectDistraction(longer, 12_500, config)
    expect(findings).toHaveLength(1)
    expect(findings[0].t).toBe(4500)
  })

  it('is reset by a pause in movement longer than moveGapMaxMs', () => {
    const events = [...wander(0, 4000), ...wander(6000, 12_000)]
    expect(detectDistraction(events, 12_000, config)).toHaveLength(0)
  })

  it('is reset by the tab going hidden', () => {
    const events = [...wander(0, 4000), hidden(4100), ...wander(4500, 12_000)]
    expect(detectDistraction(events, 12_000, config)).toHaveLength(0)
  })
})

describe('detectRageClicks', () => {
  const burst = (target: string | null = 'submit') => [
    click(0, target),
    click(200, target),
    click(400, target),
    click(600, target),
    click(800, target),
  ]

  it('confirms a burst by the gap to the next input event', () => {
    const events = [...burst(), key(6000)]
    const findings = detectRageClicks(events, 6000, config)
    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({ signal: 'rage-clicking', polarity: 'concern', t: 0 })
    expect(findings[0].detail).toMatchObject({
      count: 5,
      quietMsObserved: 5200,
      dominantTarget: 'submit',
      sameTargetRatio: 1,
      truncated: false,
    })
  })

  it('confirms a burst by `now` when nothing follows (never-submitted case)', () => {
    const findings = detectRageClicks(burst(), 5000, config)
    expect(findings).toHaveLength(1)
    expect(findings[0].detail).toMatchObject({ quietMsObserved: 4200 })
  })

  it('stays silent while the quiet period is still pending', () => {
    expect(detectRageClicks(burst(), 3000, config)).toHaveLength(0)
  })

  it('emits a truncated finding on flush when quiet has not elapsed yet', () => {
    const findings = detectRageClicks(burst(), 3000, config, true)
    expect(findings).toHaveLength(1)
    expect(findings[0].detail).toMatchObject({ truncated: true, quietMsObserved: 2200 })
  })

  it('does not fire when input resumes before the quiet period elapses', () => {
    // Next input 3s after the burst: too late to join the cluster (>2s),
    // too soon to count as quiet (<4s).
    const events = [...burst(), key(3800)]
    expect(detectRageClicks(events, 20_000, config)).toHaveLength(0)
  })

  it('does not fire on fewer than minBurstCount inputs', () => {
    const events = burst().slice(0, 4)
    expect(detectRageClicks(events, 60_000, config)).toHaveLength(0)
  })

  it('does not fire on slow steady clicking with no dense stretch', () => {
    // 6 clicks 1.9s apart chain into one cluster but never 5-in-2s.
    const events = [0, 1900, 3800, 5700, 7600, 9500].map((t) => click(t))
    expect(detectRageClicks(events, 60_000, config)).toHaveLength(0)
  })

  it('is invalidated by the tab going hidden during the unconfirmed quiet window', () => {
    const events = [...burst(), hidden(2000)]
    expect(detectRageClicks(events, 60_000, config)).toHaveLength(0)
  })

  it('reports the dominant target and its concentration', () => {
    const events = [click(0, 'submit'), click(200, 'submit'), click(400, 'submit'), click(600, 'push-together'), key(800, 'a', null)]
    const findings = detectRageClicks(events, 10_000, config)
    expect(findings).toHaveLength(1)
    expect(findings[0].detail).toMatchObject({ dominantTarget: 'submit', sameTargetRatio: 0.6 })
  })
})
