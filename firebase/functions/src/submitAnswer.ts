import {onCall, HttpsError} from "firebase-functions/https";
import {getDatabase} from "firebase-admin/database";
import {GAME_ID} from "./gameConfig.js";
import {randomCoinProblem, type CoinProblem} from "./coinProblem.js";
import {enforceRateLimit} from "./rateLimit.js";

interface Player {
  joinedAt: number;
  playerNumber: number;
  problem: CoinProblem;
  lastResult: "correct" | "incorrect" | null;
  lastAward?: {cents: number; at: number};
}

interface SubmitAnswerRequest {
  answer: number;
}

interface SubmitAnswerResult {
  correct: boolean;
  problem: CoinProblem;
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
    let centsAwarded = 0;
    let nextProblem: CoinProblem = {sum: 0, coins: []};

    const result = await playerRef.transaction((player: Player | null) => {
      if (!player) {
        // Not in the room (e.g. left mid-answer) — abort below.
        return player;
      }
      correct = answer === player.problem.sum;
      centsAwarded = player.problem.sum;
      nextProblem = correct ? randomCoinProblem() : player.problem;
      const next: Player = {
        ...player,
        problem: nextProblem,
        lastResult: correct ? "correct" : "incorrect",
      };
      if (correct) {
        // Lets every client float an "Earned N cents!" notice for this
        // player; `at` disambiguates back-to-back awards of equal cents.
        next.lastAward = {cents: centsAwarded, at: Date.now()};
      }
      return next;
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
        return (current ?? 0) + centsAwarded;
      });
    }

    return {correct, problem: nextProblem};
  },
);
