import { describe, expect, it } from 'vitest'
import { detectDistraction, detectRageClicks } from './behavioralDetectors.js'
import { DEFAULT_EVALUATION_CONFIG } from './evaluationTypes.js'
import type { InteractionEvent } from './evaluationTypes.js'

// Thresholds under test (from DEFAULT_EVALUATION_CONFIG):
// distraction: 8000ms duration, 1200px travel, 1500ms max move gap
// rage click: clicks ≤600ms apart form a burst — 4+ within a 60px radius
// or 6+ anywhere; keys: 6+ within 1000ms; every burst needs 1000ms quiet
const config = DEFAULT_EVALUATION_CONFIG

const move = (t: number, x: number, y = 0): InteractionEvent => ({ type: 'pointer-move', t, x, y })
const click = (t: number, x = 0, y = 0, target: string | null = null): InteractionEvent =>
  ({ type: 'pointer-down', t, x, y, target })
const key = (t: number, k = 'a', target: string | null = null): InteractionEvent => ({ type: 'key-down', t, key: k, target })
const input = (t: number, value = '5'): InteractionEvent => ({ type: 'input-change', t, value })
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
  // Four rapid clicks hammering one spot (~a button), ending at t=450.
  const areaBurst = (target: string | null = 'submit') => [
    click(0, 100, 100, target),
    click(150, 105, 98, target),
    click(300, 95, 103, target),
    click(450, 102, 101, target),
  ]

  describe('click bursts', () => {
    it('fires on 4 rapid clicks in a small area, confirmed by `now`', () => {
      const findings = detectRageClicks(areaBurst(), 2000, config)
      expect(findings).toHaveLength(1)
      expect(findings[0]).toMatchObject({ signal: 'rage-clicking', polarity: 'concern', t: 0 })
      expect(findings[0].detail).toMatchObject({
        kind: 'area-clicks',
        count: 4,
        quietMsObserved: 1550,
        dominantTarget: 'submit',
        sameTargetRatio: 1,
        truncated: false,
      })
    })

    it('does not fire on 4 rapid clicks scattered across the screen', () => {
      const events = [click(0, 0, 0), click(150, 400, 0), click(300, 0, 400), click(450, 400, 400)]
      expect(detectRageClicks(events, 60_000, config)).toHaveLength(0)
    })

    it('fires on 6 rapid clicks even when scattered across the screen', () => {
      const events = [
        click(0, 0, 0),
        click(150, 400, 0),
        click(300, 0, 400),
        click(450, 400, 400),
        click(600, 200, 700),
        click(750, 700, 200),
      ]
      const findings = detectRageClicks(events, 60_000, config)
      expect(findings).toHaveLength(1)
      expect(findings[0].detail).toMatchObject({ kind: 'scatter-clicks', count: 6 })
    })

    it('labels 6 clicks on one spot as area-clicks (the more specific kind)', () => {
      const events = [...areaBurst(), click(600, 101, 99, 'submit'), click(750, 99, 100, 'submit')]
      const findings = detectRageClicks(events, 60_000, config)
      expect(findings[0].detail).toMatchObject({ kind: 'area-clicks', count: 6 })
    })

    it('confirms a burst by the gap to the next input event', () => {
      const events = [...areaBurst(), key(2000)]
      const findings = detectRageClicks(events, 2000, config)
      expect(findings).toHaveLength(1)
      expect(findings[0].detail).toMatchObject({ quietMsObserved: 1550, truncated: false })
    })

    it('does not fire when clicking resumes before the quiet second elapses', () => {
      // Follow-up click 750ms after the burst: too late to join it (>600ms
      // gap), too soon to count as quiet (<1000ms).
      const events = [...areaBurst(), click(1200, 100, 100, 'submit')]
      expect(detectRageClicks(events, 60_000, config)).toHaveLength(0)
    })

    it('stays silent while the quiet period is still pending', () => {
      expect(detectRageClicks(areaBurst(), 1000, config)).toHaveLength(0)
    })

    it('emits a truncated finding on flush when quiet has not elapsed yet', () => {
      const findings = detectRageClicks(areaBurst(), 1000, config, true)
      expect(findings).toHaveLength(1)
      expect(findings[0].detail).toMatchObject({ truncated: true, quietMsObserved: 550 })
    })

    it('does not fire on slow deliberate clicking, even on one spot', () => {
      // 700ms between clicks: each is its own "burst" of one.
      const events = [0, 700, 1400, 2100, 2800].map((t) => click(t, 100, 100, 'submit'))
      expect(detectRageClicks(events, 60_000, config)).toHaveLength(0)
    })

    it('is invalidated by the tab going hidden during the unconfirmed quiet window', () => {
      const events = [...areaBurst(), hidden(900)]
      expect(detectRageClicks(events, 60_000, config)).toHaveLength(0)
    })

    it('reports the dominant target and its concentration', () => {
      const events = [
        click(0, 100, 100, 'submit'),
        click(150, 102, 99, 'submit'),
        click(300, 98, 101, 'submit'),
        click(450, 101, 102, null),
      ]
      const findings = detectRageClicks(events, 60_000, config)
      expect(findings).toHaveLength(1)
      expect(findings[0].detail).toMatchObject({ dominantTarget: 'submit', sameTargetRatio: 0.75 })
    })
  })

  describe('keyboard mashing', () => {
    const keySpam = () => [0, 100, 200, 300, 400, 500].map((t) => key(t, 'x', 'answer-input'))

    it('fires on 6 key presses packed inside a second', () => {
      const findings = detectRageClicks(keySpam(), 2000, config)
      expect(findings).toHaveLength(1)
      expect(findings[0].detail).toMatchObject({ kind: 'key-spam', count: 6, truncated: false })
    })

    it('is not broken by the input-change events each keystroke produces', () => {
      // Every key-down in the answer field fires input-change moments
      // later — including after the final key. That must not count as
      // "input resumed" during the quiet window.
      const events: InteractionEvent[] = []
      keySpam().forEach((k, i) => {
        events.push(k, input(k.t + 10, 'x'.repeat(i + 1)))
      })
      const findings = detectRageClicks(events, 2000, config)
      expect(findings).toHaveLength(1)
      expect(findings[0].detail).toMatchObject({ kind: 'key-spam' })
    })

    it('does not fire on normal answer typing', () => {
      // Two digits typed and submitted: nowhere near 6 keys in a second.
      const events = [key(0, '1'), input(10, '1'), key(400, '2'), input(410, '12'),
        { type: 'submit', t: 1500, value: '12', correct: false, attemptIndex: 0 } as InteractionEvent]
      expect(detectRageClicks(events, 60_000, config)).toHaveLength(0)
    })

    it('does not fire on steady typing with no dense stretch', () => {
      // 8 keys 900ms apart chain into one cluster but never 6-in-1s.
      const events = [0, 900, 1800, 2700, 3600, 4500, 5400, 6300].map((t) => key(t))
      expect(detectRageClicks(events, 60_000, config)).toHaveLength(0)
    })

    it('does not fire on fewer than keySpamCount presses, however fast', () => {
      const events = [0, 100, 200, 300, 400].map((t) => key(t))
      expect(detectRageClicks(events, 60_000, config)).toHaveLength(0)
    })
  })
})
