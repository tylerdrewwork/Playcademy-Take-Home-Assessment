import {onCall, HttpsError} from "firebase-functions/https";
import {getDatabase} from "firebase-admin/database";
import {GAME_ID} from "./gameConfig.js";
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
  lastAward?: {cents: number; at: number};
}

interface SubmitAnswerRequest {
  answer?: number;
  /** When true, only spin up the instance — no answer is judged. */
  warmup?: boolean;
  /**
   * When true, replace the caller's current problem with a freshly
   * generated one — no answer is judged, no money is awarded. Sent when
   * the Simple Multiplayer admin toggle flips so the new difficulty
   * applies immediately.
   */
  regenerate?: boolean;
  /** Admin toggle: cap this player's next coin problem at 10 cents. */
  simpleMultiplayer?: boolean;
}

type SubmitAnswerResult =
  | {correct: boolean; problem: CoinProblem}
  | {regenerated: true; problem: CoinProblem}
  | {warmed: true};

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

    if (request.data?.warmup === true) {
      // Called when a player joins a previously empty room: the rate-limit
      // transaction above has already exercised the admin database
      // connection, so the instance is warm for the first real answer.
      return {warmed: true};
    }

    const playerRef = getDatabase().ref(`games/${GAME_ID}/players/${uid}`);
    const simple = request.data?.simpleMultiplayer === true;

    if (request.data?.regenerate === true) {
      const problem = randomCoinProblem(simple ? SIMPLE_MAX_SUM : undefined);
      const regen = await playerRef.transaction((player: Player | null) => {
        if (!player) {
          // Not in the room (e.g. left mid-toggle) — abort below.
          return player;
        }
        // lastResult and lastAward are left as they were: nothing was
        // answered, so no feedback or award state should change.
        return {...player, problem};
      });
      if (!regen.committed || regen.snapshot.val() === null) {
        throw new HttpsError(
          "failed-precondition",
          "Join the game before requesting a new problem.",
        );
      }
      return {regenerated: true, problem};
    }

    const answer = request.data?.answer;
    if (typeof answer !== "number" || !Number.isFinite(answer)) {
      throw new HttpsError("invalid-argument", "Answer must be a number.");
    }

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
      nextProblem = correct ?
        randomCoinProblem(simple ? SIMPLE_MAX_SUM : undefined) :
        player.problem;
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
