/**
 * Shared configuration constants for the STS2 analytics pipeline (local CLI).
 *
 * Copy this file to `src/config.ts` and fill in your own values. `config.ts` is
 * gitignored so your Steam ID / save path stay private and out of the repo.
 *
 * Only the local pipeline (npm run extract / analyze / server) uses this — the
 * hosted browser dashboard does NOT read it (users upload their own runs).
 */

// Your SteamID64 — the profile folder name under ...\steam\<id>\
export const YOUR_STEAM_ID = 0;

// Absolute path to your Slay the Spire 2 run-history folder.
export const HISTORY_PATH =
  "C:\\Users\\<you>\\AppData\\Roaming\\SlayTheSpire2\\steam\\<steam-id>\\profile1\\saves\\history";
