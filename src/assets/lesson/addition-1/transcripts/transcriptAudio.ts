// Facade over the generated narration clips in this folder (one
// <step-label>.wav per lesson step, produced by tools/voice-clips-generator),
// so lesson screens can play "the narration for step X" without importing
// or naming a .wav file directly. Clips that haven't been generated yet
// simply aren't offered — callers fall back to their own pacing.

import type { NumberAudioHandle } from '../../../general/numbers/numberAudio.js'
import { voiceVolume } from '../../../../voiceVolumeSingleton.js'

const clipUrls = import.meta.glob('./*.wav', { eager: true, query: '?url', import: 'default' }) as Record<
  string,
  string
>

const urlByLabel = new Map<string, string>()
for (const [path, url] of Object.entries(clipUrls)) {
  const match = path.match(/\/([^/]+)\.wav$/)
  if (match) urlByLabel.set(match[1], url)
}

/**
 * Plays the narration clip for the step `label` and returns a handle for
 * cleanup/awaiting, or undefined when no clip has been generated for that
 * label — callers should fall back to their own pacing (e.g. a reading-pace
 * timer) so the lesson still works without audio. Like playNumberAudio,
 * `played` never rejects: a load/playback failure still resolves it.
 */
export function playTranscriptAudio(label: string): NumberAudioHandle | undefined {
  const url = urlByLabel.get(label)
  if (!url) return undefined

  const audio = new Audio(url)
  voiceVolume.registerAudio(audio)
  const played = new Promise<void>((resolve) => {
    const finish = () => resolve()
    audio.addEventListener('ended', finish)
    audio.addEventListener('error', finish)
    audio.play().catch(finish)
  })

  return { audio, played }
}

/** The step labels this facade currently has a clip for. */
export const availableTranscriptLabels: readonly string[] = Array.from(urlByLabel.keys()).sort()
