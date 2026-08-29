import {getDatabase} from "firebase-admin/database";
import {HttpsError} from "firebase-functions/https";

const MAX_CALLS_PER_SECOND = 10;

interface RateLimitWindow {
  windowStart: number;
  count: number;
}

/**
 * Throws resource-exhausted if the given uid has already made
 * MAX_CALLS_PER_SECOND calls (to any rate-limited function) within the
 * current one-second window. Meant as a backstop against buggy retry loops
 * firing tens of requests a second, not as anti-cheat — a real user can
 * never click fast enough to hit this.
 * @param {string} uid The authenticated caller's uid.
 * @return {Promise<void>} Resolves if the call is allowed.
 */
export async function enforceRateLimit(uid: string): Promise<void> {
  const windowStart = Math.floor(Date.now() / 1000);
  const ref = getDatabase().ref(`rateLimits/${uid}`);

  const result = await ref.transaction((current: RateLimitWindow | null) => {
    if (!current || current.windowStart !== windowStart) {
      return {windowStart, count: 1};
    }
    if (current.count >= MAX_CALLS_PER_SECOND) {
      return; // abort: too many calls already this second
    }
    return {windowStart, count: current.count + 1};
  });

  if (!result.committed) {
    throw new HttpsError(
      "resource-exhausted",
      "Too many requests — please slow down and try again.",
    );
  }
}
