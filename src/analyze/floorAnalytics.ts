/**
 * Floor analytics — grouped by (floorType, actName, actIndex, version).
 *
 * floorType uses friendly names derived from map_point_type + room model_id:
 *   monster + _WEAK suffix  → "Weak"
 *   monster + _NORMAL (or other) → "Normal"
 *   elite      → "Elite"
 *   boss       → "Boss"
 *   rest_site  → "Rest"
 *   shop       → "Shop"
 *   treasure   → "Treasure"
 *   event / unknown(event room) → "Event"
 *   ancient    → "Ancient"
 *
 * actName comes from run.acts[actIdx] (e.g. "ACT.OVERGROWTH" → "Overgrowth").
 * actIndex is the 1-based act position in the run (1/2/3).
 */

import { RunData, Room } from "./types";
import { YOUR_STEAM_ID } from "../config";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getFriendlyFloorType(mapPointType: string, rooms: Room[]): string {
  const room = Array.isArray(rooms) ? rooms[0] : (rooms as unknown as Room);
  const modelId: string = (room?.model_id as unknown as string) || "";
  const roomType: string = (room?.room_type as string) || mapPointType;

  switch (mapPointType) {
    case "boss":      return "Boss";
    case "elite":     return "Elite";
    case "rest_site": return "Rest";
    case "shop":      return "Shop";
    case "treasure":  return "Treasure";
    case "ancient":   return "Ancient";
    case "event":     return "Event";
    case "monster":
      if (modelId.endsWith("_WEAK")) return "Weak";
      return "Normal";
    case "unknown":
      if (roomType === "shop") return "Shop";
      return "Event";
    default:          return mapPointType;
  }
}

function getActName(run: RunData, actIdx: number): string {
  const raw = (run.acts || [])[actIdx] || "";
  return raw
    .replace(/^ACT\./, "")
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ") || `Act ${actIdx + 1}`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface FloorBucket {
  floorType: string;
  actName: string;
  actIndex: number;
  version: string;
  runs: number;
  deaths: number;
  totalDamage: number;
  totalHpHealed: number;
  totalMaxHpGain: number;
  totalMaxHpLoss: number;
  totalGoldGain: number;
  totalGoldSpent: number;
  totalCardsOffered: number;
  totalRelicsOffered: number;
}

export interface FloorStat {
  floorType: string;
  actName: string;
  actIndex: number;
  version: string;
  runs: number;
  deathPct: number;
  avgDamage: number;
  avgHpHealed: number;
  avgMaxHpGain: number;
  avgMaxHpLoss: number;
  avgGoldGain: number;
  avgGoldSpent: number;
  avgCardsOffered: number;
  avgRelicsOffered: number;
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function generateFloorAnalytics(rawRuns: RunData[]): FloorStat[] {
  const statsMap = new Map<string, FloorBucket>();

  for (const run of rawRuns) {
    const version = run.build_id || "unknown";

    // Determine which flat index is the final floor (for death detection)
    const allFlat = (run.map_point_history || []).flat();
    const lastFlatIdx = allFlat.length - 1;
    let flatIdx = 0;

    // Iterate by act — outer array index = act position (0-based)
    for (let actIdx = 0; actIdx < run.map_point_history.length; actIdx++) {
      const actFloors = run.map_point_history[actIdx];
      const actIndex = actIdx + 1;
      const actName = getActName(run, actIdx);

      for (const mapPoint of actFloors) {
        if (!mapPoint) { flatIdx++; continue; }

        const friendly = getFriendlyFloorType(mapPoint.map_point_type, mapPoint.rooms);

        const myStats =
          mapPoint.player_stats?.find((p) => p.player_id === YOUR_STEAM_ID) ??
          mapPoint.player_stats?.[0];

        if (!myStats) { flatIdx++; continue; }

        const isDeath = !run.win && flatIdx === lastFlatIdx;
        const key = `${friendly}|${actName}|${actIndex}|${version}`;

        if (!statsMap.has(key)) {
          statsMap.set(key, {
            floorType: friendly,
            actName,
            actIndex,
            version,
            runs: 0,
            deaths: 0,
            totalDamage: 0,
            totalHpHealed: 0,
            totalMaxHpGain: 0,
            totalMaxHpLoss: 0,
            totalGoldGain: 0,
            totalGoldSpent: 0,
            totalCardsOffered: 0,
            totalRelicsOffered: 0,
          });
        }

        const b = statsMap.get(key)!;
        b.runs++;
        if (isDeath) b.deaths++;
        b.totalDamage     += myStats.damage_taken || 0;
        b.totalHpHealed   += myStats.hp_healed || 0;
        b.totalMaxHpGain  += myStats.max_hp_gained || 0;
        b.totalMaxHpLoss  += myStats.max_hp_lost || 0;
        b.totalGoldGain   += myStats.gold_gained || 0;
        b.totalGoldSpent  += myStats.gold_spent || 0;
        b.totalCardsOffered  += myStats.card_choices?.length || 0;
        b.totalRelicsOffered += myStats.relic_choices?.length || 0;

        flatIdx++;
      }
    }
  }

  const FLOOR_ORDER: Record<string, number> = {
    Ancient: 0, Weak: 1, Normal: 2, Elite: 3, Boss: 4,
    Event: 5, Rest: 6, Shop: 7, Treasure: 8,
  };

  return Array.from(statsMap.values())
    .map((b): FloorStat => ({
      floorType:        b.floorType,
      actName:          b.actName,
      actIndex:         b.actIndex,
      version:          b.version,
      runs:             b.runs,
      deathPct:         b.runs > 0 ? Number(((b.deaths / b.runs) * 100).toFixed(1)) : 0,
      avgDamage:        b.runs > 0 ? Number((b.totalDamage / b.runs).toFixed(1)) : 0,
      avgHpHealed:      b.runs > 0 ? Number((b.totalHpHealed / b.runs).toFixed(1)) : 0,
      avgMaxHpGain:     b.runs > 0 ? Number((b.totalMaxHpGain / b.runs).toFixed(1)) : 0,
      avgMaxHpLoss:     b.runs > 0 ? Number((b.totalMaxHpLoss / b.runs).toFixed(1)) : 0,
      avgGoldGain:      b.runs > 0 ? Number((b.totalGoldGain / b.runs).toFixed(1)) : 0,
      avgGoldSpent:     b.runs > 0 ? Number((b.totalGoldSpent / b.runs).toFixed(1)) : 0,
      avgCardsOffered:  b.runs > 0 ? Number((b.totalCardsOffered / b.runs).toFixed(2)) : 0,
      avgRelicsOffered: b.runs > 0 ? Number((b.totalRelicsOffered / b.runs).toFixed(2)) : 0,
    }))
    .sort((a, b) =>
      a.actIndex - b.actIndex ||
      a.actName.localeCompare(b.actName) ||
      (FLOOR_ORDER[a.floorType] ?? 99) - (FLOOR_ORDER[b.floorType] ?? 99)
    );
}
