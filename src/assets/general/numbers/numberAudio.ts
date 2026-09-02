// Facade over the 1-20 number voice-over clips in this folder, so lesson
// screens can play "the audio for 7" without importing or naming a .wav
// file directly. Each number can have several "takes" — 7a.wav, 7b.wav,
// 7c.wav — and playback picks one at random so repeated counting doesn't
// sound robotic. A take-less filename (7.wav) also works, as a single take.

import { voiceVolume } from '../../../voiceVolumeSingleton.js'

const clipUrls = import.meta.glob('./*.wav', { eager: true, query: '?url', import: 'default' }) as Record<
  string,
  string
>

const urlsByNumber = new Map<number, string[]>()
for (const [path, url] of Object.entries(clipUrls)) {
  const match = path.match(/\/(\d+)[a-z]?\.wav$/)
  if (!match) continue
  const n = Number(match[1])
  const takes = urlsByNumber.get(n)
  if (takes) {
    takes.push(url)
  } else {
    urlsByNumber.set(n, [url])
  }
}

export interface NumberAudioHandle {
  /** The underlying element, exposed so callers can pause it on cleanup (e.g. component unmount). */
  audio: HTMLAudioElement
  /** Resolves once playback ends, or immediately if it fails to load/play. */
  played: Promise<void>
}

/**
 * Plays a randomly chosen take of the voice-over clip for `n` (1-20) and
 * returns a handle for cleanup/awaiting. Never rejects: a load/playback
 * failure still resolves `played` so callers aren't left stuck waiting on
 * a promise that will never settle.
 */
export function playNumberAudio(n: number): NumberAudioHandle {
  const takes = urlsByNumber.get(n)
  if (!takes) throw new Error(`No number audio clip available for ${n}`)
  const url = takes[Math.floor(Math.random() * takes.length)]

  const audio = new Audio(url)
  audio.volume = voiceVolume.volume
  const played = new Promise<void>((resolve) => {
    const finish = () => resolve()
    audio.addEventListener('ended', finish)
    audio.addEventListener('error', finish)
    audio.play().catch(finish)
  })

  return { audio, played }
}

/** The numbers this facade currently has at least one take for. */
export const availableNumbers: readonly number[] = Array.from(urlsByNumber.keys()).sort((a, b) => a - b)
