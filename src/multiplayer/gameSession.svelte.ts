import { signInAnonymously } from 'firebase/auth'
import { httpsCallable } from 'firebase/functions'
import { ref, onValue, onDisconnect, remove, type Unsubscribe } from 'firebase/database'
import { auth, rtdb, functions } from '../lib/firebase.js'
import { adminSettings } from '../adminSettings.svelte.js'

export type CoinValue = 25 | 10 | 5 | 1

export interface CoinProblem {
  sum: number
  coins: CoinValue[]
}

interface JoinGameRequest {
  simpleMultiplayer?: boolean
}

interface JoinGameResult {
  gameId: string
  problem: CoinProblem
  firstPlayer: boolean
}

interface SubmitAnswerResult {
  correct: boolean
  problem: CoinProblem
}

export interface PlayerAward {
  cents: number
  at: number
}

interface PlayerRecord {
  joinedAt: number
  playerNumber?: number
  name?: string
  problem: CoinProblem
  lastResult: 'correct' | 'incorrect' | null
  lastAward?: PlayerAward
}

/** One roster entry, ready for rendering as a player column. */
export interface PlayerView {
  uid: string
  isSelf: boolean
  name: string
  joinedAt: number
  lastAward: PlayerAward | null
}

export type GameSessionStatus = 'idle' | 'joining' | 'joined' | 'error'

export class GameSession {
  #status: GameSessionStatus = $state('idle')
  #error: unknown = $state.raw(null)
  #problem: CoinProblem | null = $state.raw(null)
  #players: Record<string, PlayerRecord> = $state.raw({})
  #totalMoneyCents: number = $state(0)
  #submitting: boolean = $state(false)
  #lastResult: 'correct' | 'incorrect' | null = $state.raw(null)
  #uid: string | null = $state.raw(null)
  #gameId: string | null = null
  #unsubscribeRoster: Unsubscribe | null = null
  #unsubscribeTotal: Unsubscribe | null = null

  get status(): GameSessionStatus {
    return this.#status
  }

  get error(): unknown {
    return this.#error
  }

  get problem(): CoinProblem | null {
    return this.#problem
  }

  get playerCount(): number {
    return Object.keys(this.#players).length
  }

  /** Everyone in the room, in join order. Names are server-assigned on join
   * (random, unique within the room) and stay fixed for a player's whole
   * stay; records written before names existed fall back to the old
   * seat-number label. */
  get players(): PlayerView[] {
    return Object.entries(this.#players)
      .sort(([uidA, a], [uidB, b]) => a.joinedAt - b.joinedAt || uidA.localeCompare(uidB))
      .map(([uid, record], index) => ({
        uid,
        isSelf: uid === this.#uid,
        name: record.name ?? `Player ${record.playerNumber ?? index + 1}`,
        joinedAt: record.joinedAt,
        lastAward: record.lastAward ?? null,
      }))
  }

  /** Running total across all players' correct answers, in cents. */
  get totalMoneyCents(): number {
    return this.#totalMoneyCents
  }

  get submitting(): boolean {
    return this.#submitting
  }

  get lastResult(): 'correct' | 'incorrect' | null {
    return this.#lastResult
  }

  async join(): Promise<void> {
    if (this.#status === 'joining' || this.#status === 'joined') return
    this.#status = 'joining'
    this.#error = null

    try {
      const user = auth.currentUser ?? (await signInAnonymously(auth)).user
      const callJoinGame = httpsCallable<JoinGameRequest, JoinGameResult>(functions, 'joinGame')
      const { data } = await callJoinGame({ simpleMultiplayer: adminSettings.simpleMultiplayer })

      this.#uid = user.uid
      this.#gameId = data.gameId
      this.#problem = data.problem

      const playerRef = ref(rtdb, `games/${data.gameId}/players/${user.uid}`)
      onDisconnect(playerRef).remove()

      const playersRef = ref(rtdb, `games/${data.gameId}/players`)
      this.#unsubscribeRoster = onValue(playersRef, (snapshot) => {
        this.#players = snapshot.val() ?? {}
      })

      const totalRef = ref(rtdb, `games/${data.gameId}/totalMoney`)
      this.#unsubscribeTotal = onValue(totalRef, (snapshot) => {
        this.#totalMoneyCents = snapshot.val() ?? 0
      })

      this.#status = 'joined'

      if (data.firstPlayer) {
        // The room was empty, so submitAnswer's instance has likely scaled
        // to zero. Warm it now, fire-and-forget, so this player's first
        // answer doesn't sit behind a multi-second cold start.
        httpsCallable<{ warmup: true }, { warmed: true }>(functions, 'submitAnswer')({
          warmup: true,
        }).catch(() => {})
      }
    } catch (err) {
      this.#error = err
      this.#status = 'error'
    }
  }

  async submitAnswer(answer: number): Promise<void> {
    if (this.#submitting || this.#status !== 'joined') return
    this.#submitting = true

    try {
      const callSubmitAnswer = httpsCallable<
        { answer: number; simpleMultiplayer?: boolean },
        SubmitAnswerResult
      >(functions, 'submitAnswer')
      const { data } = await callSubmitAnswer({
        answer,
        simpleMultiplayer: adminSettings.simpleMultiplayer,
      })
      // On an incorrect answer the server echoes the same problem back as a
      // fresh object; keep the existing one so the coin layout (keyed on the
      // coins array's identity) doesn't reshuffle under the student.
      if (data.correct) this.#problem = data.problem
      this.#lastResult = data.correct ? 'correct' : 'incorrect'
    } catch (err) {
      this.#error = err
    } finally {
      this.#submitting = false
    }
  }

  /** Swaps the current problem for a freshly generated one — used when the
   * Simple Multiplayer toggle flips so the new difficulty applies right away
   * instead of after the next correct answer. */
  async regenerateProblem(): Promise<void> {
    if (this.#submitting || this.#status !== 'joined') return
    this.#submitting = true

    try {
      const callRegenerate = httpsCallable<
        { regenerate: true; simpleMultiplayer?: boolean },
        { regenerated: true; problem: CoinProblem }
      >(functions, 'submitAnswer')
      const { data } = await callRegenerate({
        regenerate: true,
        simpleMultiplayer: adminSettings.simpleMultiplayer,
      })
      this.#problem = data.problem
      // Feedback about the previous problem no longer applies to this one.
      this.#lastResult = null
    } catch (err) {
      this.#error = err
    } finally {
      this.#submitting = false
    }
  }

  leave(): void {
    this.#unsubscribeRoster?.()
    this.#unsubscribeRoster = null
    this.#unsubscribeTotal?.()
    this.#unsubscribeTotal = null

    if (this.#uid && this.#gameId) {
      remove(ref(rtdb, `games/${this.#gameId}/players/${this.#uid}`)).catch(() => {})
    }

    this.#uid = null
    this.#gameId = null
    this.#status = 'idle'
    this.#problem = null
    this.#players = {}
    this.#totalMoneyCents = 0
    this.#lastResult = null
    this.#submitting = false
  }
}
