/**
 * Pool of display names handed out to players as they join. Mixed boy and
 * girl names, kept at twice MAX_PLAYERS (40 vs 20) so an unused name is
 * always available in a full room.
 */
export const PLAYER_NAMES: readonly string[] = [
  "Liam",
  "Olivia",
  "Noah",
  "Emma",
  "Mateo",
  "Sophia",
  "Ethan",
  "Ava",
  "Lucas",
  "Mia",
  "Aiden",
  "Isabella",
  "Elijah",
  "Zoe",
  "James",
  "Lily",
  "Benjamin",
  "Chloe",
  "Henry",
  "Harper",
  "Caleb",
  "Ruby",
  "Owen",
  "Nora",
  "Leo",
  "Stella",
  "Isaac",
  "Maya",
  "Julian",
  "Penelope",
  "Wyatt",
  "Layla",
  "Ezra",
  "Violet",
  "Miles",
  "Hazel",
  "Theo",
  "Aurora",
  "Kai",
  "Ivy",
];

/**
 * Picks a random name no current player is using. The pool is twice the
 * room cap, so a free name always exists; if that invariant is ever broken
 * (e.g. the cap is raised past the pool size), fall back to any random
 * name rather than failing the join.
 * @param {Iterable<string>} takenNames Names current players already hold.
 * @return {string} A display name for the joining player.
 */
export function pickPlayerName(takenNames: Iterable<string>): string {
  const taken = new Set(takenNames);
  const available = PLAYER_NAMES.filter((name) => !taken.has(name));
  const pool = available.length > 0 ? available : PLAYER_NAMES;
  return pool[Math.floor(Math.random() * pool.length)];
}
