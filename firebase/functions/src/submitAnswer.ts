import {onCall, HttpsError} from "firebase-functions/https";
import {getDatabase} from "firebase-admin/database";
import {GAME_ID} from "./gameConfig.js";
import {randomCoinCount} from "./coinProblem.js";
import {enforceRateLimit} from "./rateLimit.js";

interface Player {
  joinedAt: number;
  coinsPresented: number;
  lastResult: "correct" | "incorrect" | null;
}

interface SubmitAnswerRequest {
  answer: number;
}

interface SubmitAnswerResult {
  correct: boolean;
  coinsPresented: number;
}

export const submitAnswer = onCall<
  SubmitAnswerRequest, Promise<SubmitAnswerResult>
>(
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError(
        "unauthenticated",
        "Sign in is required to answer.",
      );
    }

    await enforceRateLimit(uid);

    const answer = request.data?.answer;
    if (typeof answer !== "number" || !Number.isFinite(answer)) {
      throw new HttpsError("invalid-argument", "Answer must be a number.");
    }

    const playerRef = getDatabase().ref(`games/${GAME_ID}/players/${uid}`);

    let correct = false;
    let coinsAwarded = 0;
    let nextCoinsPresented = 0;

    const result = await playerRef.transaction((player: Player | null) => {
      if (!player) {
        // Not in the room (e.g. left mid-answer) — abort below.
        return player;
      }
      correct = answer === player.coinsPresented;
      coinsAwarded = player.coinsPresented;
      nextCoinsPresented = correct ? randomCoinCount() : player.coinsPresented;
      return {
        ...player,
        coinsPresented: nextCoinsPresented,
        lastResult: correct ? "correct" : "incorrect",
      };
    });

    if (!result.committed || result.snapshot.val() === null) {
      throw new HttpsError(
        "failed-precondition",
        "Join the game before answering.",
      );
    }

    if (correct) {
      const totalRef = getDatabase().ref(`games/${GAME_ID}/totalMoney`);
      await totalRef.transaction((current: number | null) => {
        return (current ?? 0) + coinsAwarded;
      });
    }

    return {correct, coinsPresented: nextCoinsPresented};
  },
);
