import { signInAnonymously } from 'firebase/auth'
import { httpsCallable } from 'firebase/functions'
import { ref, onValue, onDisconnect, remove, type Unsubscribe } from 'firebase/database'
import { auth, rtdb, functions } from '../lib/firebase.js'

export type CoinValue = 25 | 10 | 5 | 1

export interface CoinProblem {
  sum: number
  coins: CoinValue[]
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

interface PlayerRecord {
  joinedAt: number
  problem: CoinProblem
  lastResult: 'correct' | 'incorrect' | null
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
  #uid: string | null = null
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
      const callJoinGame = httpsCallable<void, JoinGameResult>(functions, 'joinGame')
      const { data } = await callJoinGame()

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
      const callSubmitAnswer = httpsCallable<{ answer: number }, SubmitAnswerResult>(
        functions,
        'submitAnswer',
      )
      const { data } = await callSubmitAnswer({ answer })
      this.#problem = data.problem
      this.#lastResult = data.correct ? 'correct' : 'incorrect'
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
