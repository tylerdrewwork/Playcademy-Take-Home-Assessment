const MIN_SUM = 1;
const MAX_SUM = 100;
const DENOMINATIONS = [25, 10, 5, 1] as const;

/** Sum cap (in cents) applied when a player has Simple Multiplayer on. */
export const SIMPLE_MAX_SUM = 10;

/**
 * Most physical coins a problem may show. Caps quantity only — the target
 * value is untouched, but sums whose cheapest representation needs more
 * coins than this (94 and 99 at a cap of 8) are excluded from selection.
 */
export const MAX_COINS = 8;

export type CoinValue = typeof DENOMINATIONS[number];

export interface CoinProblem {
  sum: number;
  coins: CoinValue[];
}

/**
 * Fewest coins that can make up `sum`. Greedy largest-first is optimal
 * for the canonical US denominations used here.
 * @param {number} sum Target value in cents.
 * @return {number} Minimum number of coins summing to `sum`.
 */
function minCoinCount(sum: number): number {
  let remaining = sum;
  let count = 0;
  for (const denom of DENOMINATIONS) {
    count += Math.floor(remaining / denom);
    remaining %= denom;
  }
  return count;
}

/**
 * Picks a random target sum (in cents) and a random assortment of at most
 * `maxCoins` coins that add up to it — one entry per physical coin,
 * largest-first. Every coin combination that fits the cap remains
 * reachable: each pick only rules out denominations that would make the
 * remainder impossible to finish within the coin budget.
 * @param {number} maxSum Largest sum (in cents) the problem may target.
 * @param {number} maxCoins Most physical coins the problem may show.
 * @return {CoinProblem} The target sum and the coins that make it up.
 */
export function randomCoinProblem(
  maxSum: number = MAX_SUM,
  maxCoins: number = MAX_COINS,
): CoinProblem {
  const feasibleSums: number[] = [];
  for (let value = MIN_SUM; value <= maxSum; value++) {
    if (minCoinCount(value) <= maxCoins) {
      feasibleSums.push(value);
    }
  }
  const sum = feasibleSums[Math.floor(Math.random() * feasibleSums.length)];

  let remaining = sum;
  const coins: CoinValue[] = [];
  while (remaining > 0) {
    const budgetLeft = maxCoins - coins.length - 1;
    const eligible = DENOMINATIONS.filter(
      (d) => d <= remaining && minCoinCount(remaining - d) <= budgetLeft,
    );
    const denom = eligible[Math.floor(Math.random() * eligible.length)];
    coins.push(denom);
    remaining -= denom;
  }
  coins.sort((a, b) => b - a);

  return {sum, coins};
}
