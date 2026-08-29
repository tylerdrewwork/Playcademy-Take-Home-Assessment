import type { BehavioralDetector, EvaluatorFinding, InteractionEvent } from './evaluationTypes.js'

// Distraction: the pointer keeps moving around the screen for a sustained
// stretch while the student produces no input at all. Any keystroke, click,
// input change, submit, lesson action, or the tab going hidden breaks the
// wander window, as does a pause in movement longer than moveGapMaxMs.
export const detectDistraction: BehavioralDetector = (events, _now, config) => {
  const { minDurationMs, minTravelPx, moveGapMaxMs } = config.distraction
  const findings: EvaluatorFinding[] = []

  let wanderStart: number | null = null
  let lastMove: { t: number; x: number; y: number } | null = null
  let travelPx = 0
  let emittedForStart: number | null = null

  for (const event of events) {
    if (event.type === 'pointer-move') {
      if (lastMove && event.t - lastMove.t > moveGapMaxMs) {
        wanderStart = null
        lastMove = null
        travelPx = 0
      }
      if (wanderStart === null) {
        wanderStart = event.t
        travelPx = 0
      } else if (lastMove) {
        travelPx += Math.hypot(event.x - lastMove.x, event.y - lastMove.y)
      }
      lastMove = { t: event.t, x: event.x, y: event.y }

      if (
        event.t - wanderStart >= minDurationMs &&
        travelPx >= minTravelPx &&
        emittedForStart !== wanderStart
      ) {
        findings.push({
          signal: 'distracted',
          polarity: 'concern',
          attemptIndex: null,
          t: wanderStart,
          detail: { durationMs: event.t - wanderStart, travelPx: Math.round(travelPx) },
        })
        emittedForStart = wanderStart
      }
    } else if (
      event.type === 'pointer-down' ||
      event.type === 'key-down' ||
      event.type === 'input-change' ||
      event.type === 'nonnumeric-input' ||
      event.type === 'submit' ||
      event.type === 'action' ||
      (event.type === 'visibility' && event.hidden)
    ) {
      wanderStart = null
      lastMove = null
      travelPx = 0
    }
  }

  return findings
}

// Only these count as "the student gave input" for rage-click purposes —
// pointer moves deliberately don't, so wiggling the mouse after a burst
// still counts as the quiet period that confirms frustration.
function isInputEvent(event: InteractionEvent): boolean {
  return (
    event.type === 'pointer-down' ||
    event.type === 'key-down' ||
    event.type === 'input-change' ||
    event.type === 'submit'
  )
}

interface Burst {
  start: number
  end: number
  events: InteractionEvent[]
}

// Rage clicking: a dense burst of clicks/keys (minBurstCount within a
// rolling burstWindowMs) followed by quietMs of no input. The quiet period
// is confirmed either by the gap to the next input event, or by `now` from
// the heartbeat when nothing follows at all. A tab-hidden event during the
// unconfirmed quiet window invalidates the episode (hidden time proves
// nothing about the student). On a flush (problem change/unmount) a burst
// whose quiet period hasn't elapsed yet is emitted flagged as truncated
// rather than lost.
export const detectRageClicks: BehavioralDetector = (events, now, config, flush = false) => {
  const { minBurstCount, burstWindowMs, quietMs } = config.rageClick
  const findings: EvaluatorFinding[] = []

  // Cluster input events: consecutive inputs within burstWindowMs of each
  // other belong to the same cluster.
  const inputs = events.filter(isInputEvent)
  const clusters: Burst[] = []
  for (const event of inputs) {
    const current = clusters[clusters.length - 1]
    if (current && event.t - current.end <= burstWindowMs) {
      current.end = event.t
      current.events.push(event)
    } else {
      clusters.push({ start: event.t, end: event.t, events: [event] })
    }
  }

  for (const cluster of clusters) {
    if (cluster.events.length < minBurstCount) continue

    // The cluster must contain a genuinely dense stretch — minBurstCount
    // events inside one burstWindowMs span — so slow steady clicking that
    // chains into a long cluster doesn't qualify.
    let dense = false
    for (let i = 0; i + minBurstCount - 1 < cluster.events.length; i++) {
      if (cluster.events[i + minBurstCount - 1].t - cluster.events[i].t <= burstWindowMs) {
        dense = true
        break
      }
    }
    if (!dense) continue

    // Hidden during the unconfirmed quiet window invalidates the episode.
    const hiddenDuringQuiet = events.some(
      (event) =>
        event.type === 'visibility' &&
        event.hidden &&
        event.t > cluster.end &&
        event.t <= cluster.end + quietMs
    )
    if (hiddenDuringQuiet) continue

    const nextInput = inputs.find((event) => event.t > cluster.end)
    let quietMsObserved: number | null = null
    let truncated = false
    if (nextInput) {
      if (nextInput.t - cluster.end < quietMs) continue // input resumed too soon
      quietMsObserved = nextInput.t - cluster.end
    } else if (now - cluster.end >= quietMs) {
      quietMsObserved = now - cluster.end
    } else if (flush) {
      quietMsObserved = Math.max(0, now - cluster.end)
      truncated = true
    } else {
      continue // quiet period still pending; a later tick may confirm it
    }

    // Which element took the brunt of the burst, from tagged targets.
    const targetCounts = new Map<string, number>()
    for (const event of cluster.events) {
      const target = 'target' in event ? event.target : null
      if (target) targetCounts.set(target, (targetCounts.get(target) ?? 0) + 1)
    }
    let dominantTarget: string | null = null
    let dominantCount = 0
    for (const [target, count] of targetCounts) {
      if (count > dominantCount) {
        dominantTarget = target
        dominantCount = count
      }
    }

    findings.push({
      signal: 'rage-clicking',
      polarity: 'concern',
      attemptIndex: null,
      t: cluster.start,
      detail: {
        count: cluster.events.length,
        burstDurationMs: cluster.end - cluster.start,
        quietMsObserved,
        dominantTarget,
        sameTargetRatio: dominantCount / cluster.events.length,
        truncated,
      },
    })
  }

  return findings
}
