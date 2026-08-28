// Facade over the 1-20 number voice-over clips in this folder, so lesson
// screens can play "the audio for 7" without importing or naming a .wav
// file directly.

const clipUrls = import.meta.glob('./*.wav', { eager: true, query: '?url', import: 'default' }) as Record<
  string,
  string
>

const urlByNumber = new Map<number, string>()
for (const [path, url] of Object.entries(clipUrls)) {
  const match = path.match(/\/(\d+)\.wav$/)
  if (match) urlByNumber.set(Number(match[1]), url)
}

export interface NumberAudioHandle {
  /** The underlying element, exposed so callers can pause it on cleanup (e.g. component unmount). */
  audio: HTMLAudioElement
  /** Resolves once playback ends, or immediately if it fails to load/play. */
  played: Promise<void>
}

/**
 * Plays the voice-over clip for `n` (1-20) and returns a handle for
 * cleanup/awaiting. Never rejects: a load/playback failure still resolves
 * `played` so callers aren't left stuck waiting on a promise that will
 * never settle.
 */
export function playNumberAudio(n: number): NumberAudioHandle {
  const url = urlByNumber.get(n)
  if (!url) throw new Error(`No number audio clip available for ${n}`)

  const audio = new Audio(url)
  const played = new Promise<void>((resolve) => {
    const finish = () => resolve()
    audio.addEventListener('ended', finish)
    audio.addEventListener('error', finish)
    audio.play().catch(finish)
  })

  return { audio, played }
}

/** The numbers this facade currently has a clip for. */
export const availableNumbers: readonly number[] = Array.from(urlByNumber.keys()).sort((a, b) => a - b)
