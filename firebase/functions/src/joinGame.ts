import {onCall, HttpsError} from "firebase-functions/https";
import {getDatabase} from "firebase-admin/database";
import {GAME_ID, MAX_PLAYERS} from "./gameConfig.js";
import {randomCoinCount} from "./coinProblem.js";
import {enforceRateLimit} from "./rateLimit.js";

interface Player {
  joinedAt: number;
  coinsPresented: number;
  lastResult: "correct" | "incorrect" | null;
}

interface JoinGameResult {
  gameId: string;
  coinsPresented: number;
}

type Players = Record<string, Player>;

export const joinGame = onCall<void, Promise<JoinGameResult>>(
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError(
        "unauthenticated",
        "Sign in is required to join the game.",
      );
    }

    await enforceRateLimit(uid);

    const coinsPresented = randomCoinCount();
    const playersRef = getDatabase().ref(`games/${GAME_ID}/players`);

    const result = await playersRef.transaction((players: Players | null) => {
      players = players ?? {};
      if (players[uid]) {
        // Already in the room (e.g. a retried call) — leave it untouched.
        return players;
      }
      if (Object.keys(players).length >= MAX_PLAYERS) {
        return; // abort: the room is full
      }
      players[uid] = {joinedAt: Date.now(), coinsPresented, lastResult: null};
      return players;
    });

    if (!result.committed) {
      throw new HttpsError(
        "resource-exhausted",
        "This game room is full. Try again shortly.",
      );
    }

    const joined = result.snapshot.child(uid).val() as Player;
    return {gameId: GAME_ID, coinsPresented: joined.coinsPresented};
  },
);
