import {onCall, HttpsError} from "firebase-functions/https";
import {getDatabase} from "firebase-admin/database";
import {GAME_ID, MAX_PLAYERS} from "./gameConfig.js";
import {
  randomCoinProblem,
  SIMPLE_MAX_SUM,
  type CoinProblem,
} from "./coinProblem.js";
import {enforceRateLimit} from "./rateLimit.js";

interface Player {
  joinedAt: number;
  playerNumber: number;
  problem: CoinProblem;
  lastResult: "correct" | "incorrect" | null;
}

interface JoinGameRequest {
  /** Admin toggle: cap this player's coin problems at 10 cents. */
  simpleMultiplayer?: boolean;
}

interface JoinGameResult {
  gameId: string;
  problem: CoinProblem;
  /** True when this join filled a previously empty room. */
  firstPlayer: boolean;
}

type Players = Record<string, Player>;

/**
 * Smallest 1-based seat number no current player holds, so labels like
 * "Player 3" stay stable for a player's whole stay even as others come
 * and go. Seats freed by leavers are reused by later joiners.
 * @param {Players} players The room's current players, keyed by uid.
 * @return {number} The lowest unclaimed seat number, starting at 1.
 */
function lowestFreePlayerNumber(players: Players): number {
  const taken = new Set(
    Object.values(players).map((player) => player.playerNumber),
  );
  let seat = 1;
  while (taken.has(seat)) {
    seat++;
  }
  return seat;
}

export const joinGame = onCall<JoinGameRequest, Promise<JoinGameResult>>(
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError(
        "unauthenticated",
        "Sign in is required to join the game.",
      );
    }

    await enforceRateLimit(uid);

    const simple = request.data?.simpleMultiplayer === true;
    const problem = randomCoinProblem(simple ? SIMPLE_MAX_SUM : undefined);
    const playersRef = getDatabase().ref(`games/${GAME_ID}/players`);

    let roomWasEmpty = false;
    const result = await playersRef.transaction((players: Players | null) => {
      players = players ?? {};
      roomWasEmpty = Object.keys(players).length === 0;
      if (players[uid]) {
        // Already in the room (e.g. a retried call) — leave it untouched.
        return players;
      }
      if (Object.keys(players).length >= MAX_PLAYERS) {
        return; // abort: the room is full
      }
      players[uid] = {
        joinedAt: Date.now(),
        playerNumber: lowestFreePlayerNumber(players),
        problem,
        lastResult: null,
      };
      return players;
    });

    if (!result.committed) {
      throw new HttpsError(
        "resource-exhausted",
        "This game room is full. Try again shortly.",
      );
    }

    const joined = result.snapshot.child(uid).val() as Player;
    return {
      gameId: GAME_ID,
      problem: joined.problem,
      firstPlayer: roomWasEmpty,
    };
  },
);
