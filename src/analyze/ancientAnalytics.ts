/**
 * Ancient (Neow) blessing analytics
 *
 * For each blessing TextKey, tracks:
 *  - how often it was offered vs picked (overall + per character)
 *  - win rate when chosen (overall + per character)
 *  - version range it appeared in
 *  - ELO rating (baseline-comparison model, same K/ascension logic as relic ELO)
 */

import type { RunData, ELORecord } from "./types";
import { YOUR_STEAM_ID } from "../config";

// ─── Constants ────────────────────────────────────────────────────────────────

export const CHARACTERS = ["Ironclad", "Silent", "Defect", "Regent", "Necrobinder"] as const;

// Friendly display name from TextKey
export function blessingDisplayName(textKey: string): string {
  return textKey
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

// Extract numeric version for comparison ("v0.103.2" → 103.002)
function versionToNum(v: string): number {
  const m = v.replace(/^v/, "").match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!m) return 0;
  return parseInt(m[1]) * 1e6 + parseInt(m[2]) * 1e3 + parseInt(m[3]);
}

// ─── ELO helpers (same model as relicEloCalculator) ───────────────────────────

const DEFAULT_RATING = 1500;

function getBaseK(games: number): number {
  if (games < 10) return 48;
  if (games < 30) return 32;
  return 24;
}

function getAscMult(asc: number): number {
  return 1 + Math.min(asc / 20, 1);
}

function getResultScore(won: boolean, dmg: number, numEncs: number): number {
  if (won) {
    if (dmg <= 50) return 1.0;
    if (dmg <= 150) return 0.92;
    return 0.85;
  }
  if (numEncs >= 12) return 0.15;
  if (numEncs >= 6) return 0.08;
  return 0.02;
}

// ─── Output types ─────────────────────────────────────────────────────────────

export interface CharBlessingStats {
  offered: number;
  picked: number;
  wins: number;
}

export interface AncientBlessingStat {
  textKey: string;
  displayName: string;
  ancient: string;       // e.g. "Neow"
  act: number;
  versionMin: string;
  versionMax: string;
  elo: number;
  peakElo: number;
  overallOffered: number;
  overallPicked: number;
  overallWins: number;
  byChar: Record<string, CharBlessingStats>;  // char display name → stats
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function generateAncientAnalytics(rawRuns: RunData[]): AncientBlessingStat[] {
  // Sort chronologically for ELO ordering
  const sorted = [...rawRuns].sort((a, b) => a.start_time - b.start_time);

  // ELO state: textKey → ELORecord
  const eloState: Record<string, ELORecord> = {};

  // Aggregate stats: textKey → stats
  const statsMap = new Map<string, AncientBlessingStat>();

  function getOrInit(textKey: string, ancient: string, act: number): AncientBlessingStat {
    if (!statsMap.has(textKey)) {
      statsMap.set(textKey, {
        textKey,
        displayName: blessingDisplayName(textKey),
        ancient,
        act,
        versionMin: "",
        versionMax: "",
        elo: DEFAULT_RATING,
        peakElo: DEFAULT_RATING,
        overallOffered: 0,
        overallPicked: 0,
        overallWins: 0,
        byChar: {},
      });
    }
    return statsMap.get(textKey)!;
  }

  function getOrInitChar(stat: AncientBlessingStat, charName: string): CharBlessingStats {
    if (!stat.byChar[charName]) {
      stat.byChar[charName] = { offered: 0, picked: 0, wins: 0 };
    }
    return stat.byChar[charName];
  }

  function getOrInitElo(textKey: string): ELORecord {
    if (!eloState[textKey]) {
      eloState[textKey] = { rating: DEFAULT_RATING, peakRating: DEFAULT_RATING, gamesPlayed: 0, wins: 0 };
    }
    return eloState[textKey];
  }

  for (const run of sorted) {
    const version = run.build_id || "unknown";
    const ascension = run.ascension || 0;
    const won = run.win === true ||
      ((run.killed_by_encounter ?? "") === "NONE.NONE" && (run.killed_by_event ?? "") === "NONE.NONE");
    const myPlayer = run.players.find((p) => p.id === YOUR_STEAM_ID) ?? run.players[0];
    const charRaw = myPlayer?.character || "UNKNOWN";

    // Derive friendly char name
    const charName = charRaw
      .replace(/^CHARACTER\./, "")
      .split("_")
      .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join("");

    // Pre-compute run-level ELO inputs once (total damage + encounter count across all acts)
    const allMapPointsFlat = (run.map_point_history || []).flat();
    const dmg = allMapPointsFlat.reduce((sum, mp) => {
      const ps = mp.player_stats?.find((p) => p.player_id === YOUR_STEAM_ID) ?? mp.player_stats?.[0];
      return sum + (ps?.damage_taken || 0);
    }, 0);
    const numEncs = allMapPointsFlat.filter(
      (mp) => mp.map_point_type === "monster" || mp.map_point_type === "elite" || mp.map_point_type === "boss"
    ).length;
    const result = getResultScore(won, dmg, numEncs);
    const ascMult = getAscMult(ascension);

    // Iterate by act (outer array index = actIdx, act number = actIdx + 1)
    for (let actIdx = 0; actIdx < run.map_point_history.length; actIdx++) {
      const actFloors = run.map_point_history[actIdx];
      const act = actIdx + 1;

      for (const mapPoint of actFloors) {
        if (mapPoint.map_point_type !== "ancient") continue;

        // Room model → Ancient display name
        const rooms = Array.isArray(mapPoint.rooms) ? mapPoint.rooms : [mapPoint.rooms].filter(Boolean);
        const roomModel = (rooms[0] as any)?.model_id || "EVENT.UNKNOWN";
        const ancientName = roomModel
          .replace(/^EVENT\./, "")
          .split("_")
          .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
          .join(" ");

        // Find this player's stats (solo may use local ID; Steam ID preferred)
        const myStats =
          mapPoint.player_stats?.find((p) => p.player_id === YOUR_STEAM_ID) ??
          mapPoint.player_stats?.[0];

        if (!myStats?.ancient_choice?.length) continue;

        const choices = myStats.ancient_choice;

        // Track each offered blessing
        for (const choice of choices) {
          const key = choice.TextKey;
          const stat = getOrInit(key, ancientName, act);
          const cs = getOrInitChar(stat, charName);

          // Version range
          const vn = versionToNum(version);
          if (!stat.versionMin || vn < versionToNum(stat.versionMin)) stat.versionMin = version;
          if (!stat.versionMax || vn > versionToNum(stat.versionMax)) stat.versionMax = version;

          stat.overallOffered++;
          cs.offered++;

          if (choice.was_chosen) {
            stat.overallPicked++;
            cs.picked++;
            if (won) {
              stat.overallWins++;
              cs.wins++;
            }

            // Update ELO for this chosen blessing
            const elo = getOrInitElo(key);
            const k = getBaseK(elo.gamesPlayed) * ascMult;
            const expected = 1 / (1 + Math.pow(10, (DEFAULT_RATING - elo.rating) / 400));
            elo.rating = Math.round((elo.rating + k * (result - expected)) * 100) / 100;
            elo.peakRating = Math.max(elo.peakRating, elo.rating);
            elo.gamesPlayed++;
            if (won) elo.wins++;
          }
        } // end choice loop
      } // end mapPoint loop
    } // end actIdx loop
  } // end run loop

  // Copy final ELO into stats
  for (const [key, stat] of statsMap.entries()) {
    const elo = eloState[key];
    if (elo) {
      stat.elo = Math.round(elo.rating * 10) / 10;
      stat.peakElo = Math.round(elo.peakRating * 10) / 10;
    }
  }

  return Array.from(statsMap.values()).sort((a, b) => b.elo - a.elo);
}
