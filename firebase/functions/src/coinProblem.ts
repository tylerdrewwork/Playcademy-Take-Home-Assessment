const MIN_SUM = 1;
const MAX_SUM = 100;
const DENOMINATIONS = [25, 10, 5, 1] as const;

/** Sum cap (in cents) applied when a player has Simple Multiplayer on. */
export const SIMPLE_MAX_SUM = 10;

export type CoinValue = typeof DENOMINATIONS[number];

export interface CoinProblem {
  sum: number;
  coins: CoinValue[];
}

/**
 * Picks a random target sum (in cents) and a random assortment of coins
 * that add up to it — one entry per physical coin, largest-first.
 * @param {number} maxSum Largest sum (in cents) the problem may target.
 * @return {CoinProblem} The target sum and the coins that make it up.
 */
export function randomCoinProblem(maxSum: number = MAX_SUM): CoinProblem {
  const sum = MIN_SUM + Math.floor(Math.random() * (maxSum - MIN_SUM + 1));

  let remaining = sum;
  const coins: CoinValue[] = [];
  while (remaining > 0) {
    const eligible = DENOMINATIONS.filter((d) => d <= remaining);
    const denom = eligible[Math.floor(Math.random() * eligible.length)];
    coins.push(denom);
    remaining -= denom;
  }
  coins.sort((a, b) => b - a);

  return {sum, coins};
}
