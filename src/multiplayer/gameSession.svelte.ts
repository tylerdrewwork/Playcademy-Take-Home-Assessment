import { signInAnonymously } from 'firebase/auth'
import { httpsCallable } from 'firebase/functions'
import { ref, onValue, onDisconnect, remove, type Unsubscribe } from 'firebase/database'
import { auth, rtdb, functions } from '../lib/firebase.js'

interface JoinGameResult {
  gameId: string
  coinsPresented: number
}

interface SubmitAnswerResult {
  correct: boolean
  coinsPresented: number
}

interface PlayerRecord {
  joinedAt: number
  coinsPresented: number
  lastResult: 'correct' | 'incorrect' | null
}

export type GameSessionStatus = 'idle' | 'joining' | 'joined' | 'error'

export class GameSession {
  #status: GameSessionStatus = $state('idle')
  #error: unknown = $state.raw(null)
  #coinsPresented: number | null = $state.raw(null)
  #players: Record<string, PlayerRecord> = $state.raw({})
  #totalMoney: number = $state(0)
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

  get coinsPresented(): number | null {
    return this.#coinsPresented
  }

  get playerCount(): number {
    return Object.keys(this.#players).length
  }

  get totalMoney(): number {
    return this.#totalMoney
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
      this.#coinsPresented = data.coinsPresented

      const playerRef = ref(rtdb, `games/${data.gameId}/players/${user.uid}`)
      onDisconnect(playerRef).remove()

      const playersRef = ref(rtdb, `games/${data.gameId}/players`)
      this.#unsubscribeRoster = onValue(playersRef, (snapshot) => {
        this.#players = snapshot.val() ?? {}
      })

      const totalRef = ref(rtdb, `games/${data.gameId}/totalMoney`)
      this.#unsubscribeTotal = onValue(totalRef, (snapshot) => {
        this.#totalMoney = snapshot.val() ?? 0
      })

      this.#status = 'joined'
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
      this.#coinsPresented = data.coinsPresented
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
    this.#coinsPresented = null
    this.#players = {}
    this.#totalMoney = 0
    this.#lastResult = null
    this.#submitting = false
  }
}
