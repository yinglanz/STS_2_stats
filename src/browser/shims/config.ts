/**
 * Browser stub for `src/config.ts` (which is gitignored — it holds the dev's
 * personal Steam ID / save path and is only used by the local CLI).
 *
 * In the hosted app every visitor uploads their own runs, so there is no single
 * "your Steam ID". The extraction code uses `p.id === YOUR_STEAM_ID ?? players[0]`,
 * so a 0 here just means "fall back to the first (only) player in each run",
 * which is correct for the single-player uploads this dashboard targets.
 */
export const YOUR_STEAM_ID = 0;
export const HISTORY_PATH = "";
