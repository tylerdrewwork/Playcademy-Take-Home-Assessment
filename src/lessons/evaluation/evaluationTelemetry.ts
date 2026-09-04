import { trace } from 'firebase/performance'
import { perf } from '../../lib/firebase.js'
import type { EvaluationRecorder } from './evaluationRecorder.js'

const PUSH_INTERVAL_MS = 10_000

// Periodically reports newly-recorded findings to Performance Monitoring as
// a custom trace. Findings are append-only (see EvaluationRecorder), so a
// running cursor is enough to guarantee each finding is reported at most
// once — no per-finding key bookkeeping needed. When nothing new has landed
// since the last tick, the interval does nothing at all: no trace is
// started, so no call goes out.
export function startEvaluationTelemetryPush(
  recorder: EvaluationRecorder,
  lessonId: string,
  intervalMs = PUSH_INTERVAL_MS
): () => void {
  let pushedCount = 0

  const flush = () => {
    const pending = recorder.findings.slice(pushedCount)
    if (pending.length === 0) return

    const bySignal = new Map<string, number>()
    for (const finding of pending) {
      bySignal.set(finding.signal, (bySignal.get(finding.signal) ?? 0) + 1)
    }

    const push = trace(perf, 'evaluation_findings_push')
    push.putAttribute('lessonId', lessonId)
    push.start()
    push.putMetric('total', pending.length)
    for (const [signal, count] of bySignal) push.putMetric(signal, count)
    push.stop()

    pushedCount += pending.length
  }

  const timer = setInterval(flush, intervalMs)
  // Report on the way out too — otherwise a batch recorded after the last
  // tick but before unmount (e.g. the lesson's final submit) would never go
  // out at all.
  return () => {
    clearInterval(timer)
    flush()
  }
}
