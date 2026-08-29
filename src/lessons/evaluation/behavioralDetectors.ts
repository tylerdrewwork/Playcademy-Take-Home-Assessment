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

// Deliberate student input, used to confirm the quiet period after a burst.
// input-change is excluded on purpose: every keystroke in the answer field
// fires key-down AND input-change a moment later, and that trailing
// input-change would otherwise "break" the silence after every key burst.
// Pointer moves don't count either — wiggling the mouse is still quiet.
function isDeliberateInput(event: InteractionEvent): boolean {
  return event.type === 'pointer-down' || event.type === 'key-down' || event.type === 'submit'
}

interface Burst<T extends InteractionEvent = InteractionEvent> {
  start: number
  end: number
  events: T[]
}

// Group events so consecutive entries at most maxGapMs apart share a burst.
function clusterByGap<T extends InteractionEvent>(events: T[], maxGapMs: number): Burst<T>[] {
  const clusters: Burst<T>[] = []
  for (const event of events) {
    const current = clusters[clusters.length - 1]
    if (current && event.t - current.end <= maxGapMs) {
      current.end = event.t
      current.events.push(event)
    } else {
      clusters.push({ start: event.t, end: event.t, events: [event] })
    }
  }
  return clusters
}

// Rage input: either a rapid click burst — minAreaClicks confined to a
// small area (a button being hammered) or minScatterClicks anywhere on
// screen — or keyboard mashing (keySpamCount key presses inside
// keySpamWindowMs). Every qualifying burst must be followed by quietMs of
// no deliberate input: confirmed by the gap to the next input event, or by
// `now` from the heartbeat when nothing follows at all. A tab-hidden event
// during the unconfirmed quiet window invalidates the episode (hidden time
// proves nothing about the student). On a flush (problem change/unmount) a
// burst whose quiet period hasn't elapsed yet is emitted flagged as
// truncated rather than lost.
export const detectRageClicks: BehavioralDetector = (events, now, config, flush = false) => {
  const {
    maxClickGapMs,
    minAreaClicks,
    areaRadiusPx,
    minScatterClicks,
    keySpamCount,
    keySpamWindowMs,
    quietMs,
  } = config.rageClick
  const findings: EvaluatorFinding[] = []
  const inputs = events.filter(isDeliberateInput)

  // Confirms the input silence after a burst; null means "doesn't qualify
  // (yet)". Shared by the click and key paths.
  const confirmQuiet = (
    clusterEnd: number
  ): { quietMsObserved: number; truncated: boolean } | null => {
    const hiddenDuringQuiet = events.some(
      (event) =>
        event.type === 'visibility' &&
        event.hidden &&
        event.t > clusterEnd &&
        event.t <= clusterEnd + quietMs
    )
    if (hiddenDuringQuiet) return null

    const nextInput = inputs.find((event) => event.t > clusterEnd)
    if (nextInput) {
      if (nextInput.t - clusterEnd < quietMs) return null // input resumed too soon
      return { quietMsObserved: nextInput.t - clusterEnd, truncated: false }
    }
    if (now - clusterEnd >= quietMs) {
      return { quietMsObserved: now - clusterEnd, truncated: false }
    }
    if (flush) return { quietMsObserved: Math.max(0, now - clusterEnd), truncated: true }
    return null // quiet period still pending; a later tick may confirm it
  }

  const emit = (cluster: Burst, kind: string, quiet: { quietMsObserved: number; truncated: boolean }) => {
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
        kind,
        count: cluster.events.length,
        burstDurationMs: cluster.end - cluster.start,
        quietMsObserved: quiet.quietMsObserved,
        dominantTarget,
        sameTargetRatio: dominantCount / cluster.events.length,
        truncated: quiet.truncated,
      },
    })
  }

  // --- Click bursts ---
  const clicks = events.filter(
    (event): event is Extract<InteractionEvent, { type: 'pointer-down' }> =>
      event.type === 'pointer-down'
  )
  for (const cluster of clusterByGap(clicks, maxClickGapMs)) {
    let kind: string | null = null
    if (cluster.events.length >= minAreaClicks && withinArea(cluster.events, areaRadiusPx)) {
      kind = 'area-clicks'
    } else if (cluster.events.length >= minScatterClicks) {
      kind = 'scatter-clicks'
    }
    if (!kind) continue
    const quiet = confirmQuiet(cluster.end)
    if (quiet) emit(cluster, kind, quiet)
  }

  // --- Keyboard mashing ---
  // Clustered with the wider spam window so a sustained mash stays one
  // episode; the dense-window check below is what demands the actual burst.
  const keys = events.filter((event) => event.type === 'key-down')
  for (const cluster of clusterByGap(keys, keySpamWindowMs)) {
    if (cluster.events.length < keySpamCount) continue
    let dense = false
    for (let i = 0; i + keySpamCount - 1 < cluster.events.length; i++) {
      if (cluster.events[i + keySpamCount - 1].t - cluster.events[i].t <= keySpamWindowMs) {
        dense = true
        break
      }
    }
    if (!dense) continue
    const quiet = confirmQuiet(cluster.end)
    if (quiet) emit(cluster, 'key-spam', quiet)
  }

  return findings
}

// Every click within areaRadiusPx of the burst's centroid — the shape of a
// single button or element being hammered.
function withinArea(
  clicks: Array<Extract<InteractionEvent, { type: 'pointer-down' }>>,
  areaRadiusPx: number
): boolean {
  const cx = clicks.reduce((sum, c) => sum + c.x, 0) / clicks.length
  const cy = clicks.reduce((sum, c) => sum + c.y, 0) / clicks.length
  return clicks.every((c) => Math.hypot(c.x - cx, c.y - cy) <= areaRadiusPx)
}
