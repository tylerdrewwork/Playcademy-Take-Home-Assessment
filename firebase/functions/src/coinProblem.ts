const MIN_COINS = 1;
const MAX_COINS = 20;

/**
 * Picks how many coins a player is presented with next.
 * @return {number} A whole number of coins between MIN_COINS and MAX_COINS.
 */
export function randomCoinCount(): number {
  return MIN_COINS + Math.floor(Math.random() * (MAX_COINS - MIN_COINS + 1));
}
