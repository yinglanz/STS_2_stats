/**
 * Browser-side dashboard data builder.
 *
 * Mirrors the file-based `loadDashboardData()` in generateDashboard_v2.ts, but
 * computes everything in-memory from raw `.run` JSON the user uploads — no fs,
 * no SQLite. Reuses the exact same analytics/ELO functions as the CLI pipeline
 * so the output is identical to `npm run analyze`.
 */

import { RunData, ExtractedRun } from "../analyze/types";
import { extractAllRuns } from "../analyze/extractRunData";
import {
  generateCardAnalytics,
  generateEncounterAnalytics,
  generateRelicAnalytics,
  generateBuildArchetypes,
  generateAscensionStats,
  generateTurnEconomy,
  generateCardSynergyPairs,
  generateRelicSynergyPairs,
  generateCharacterAscensionHeatmap,
  generateEncounterByAct,
  generateDeckSizeTargets,
} from "../analyze/reports";
import { calculateELOFromRuns } from "../analyze/eloCalculator";
import { calculateRelicELOFromRuns } from "../analyze/relicEloCalculator";
import { calculateELOFromRuns as calculateAdvancedELOFromRuns } from "../analyze/elo";
import type { ExtractedRun as AdvancedRun } from "../analyze/elo";
import { generateFloorAnalytics } from "../analyze/floorAnalytics";
import { generateAncientAnalytics } from "../analyze/ancientAnalytics";
import { DashboardData, parseCsvContent } from "../analyze/generateDashboard_v2";

/**
 * Parse and structurally validate a single uploaded `.run` file's text.
 * Returns null (and warns) for anything that isn't a valid run, mirroring
 * the tolerant behavior of loadAllRuns().
 */
export function parseRunFile(name: string, text: string): RunData | null {
  try {
    const run = JSON.parse(text) as RunData;
    if (!run || !Array.isArray(run.players) || !Array.isArray(run.map_point_history)) {
      console.warn(`Skipping ${name}: missing required fields`);
      return null;
    }
    return run;
  } catch (error) {
    console.warn(`Failed to parse ${name}:`, error);
    return null;
  }
}

/**
 * Build the full DashboardData object from raw run records. Pure — safe to run
 * in the browser.
 */
export function buildDashboardData(rawRuns: RunData[]): DashboardData {
  const extractedRuns: ExtractedRun[] = extractAllRuns(rawRuns);

  const n = extractedRuns.length;
  const wins = extractedRuns.filter((r) => r.w).length;
  const globalStats = {
    totalRuns: n,
    totalWins: wins,
    overallWinRate: n > 0 ? (wins / n) * 100 : 0,
    avgDeckSize: n > 0 ? extractedRuns.reduce((sum, r) => sum + (r.sz ?? 0), 0) / n : 0,
    avgRelicCount: n > 0 ? extractedRuns.reduce((sum, r) => sum + (r.rc ?? 0), 0) / n : 0,
  };

  // Report generators return CSV strings; parse them back into rows exactly as
  // the CLI dashboard does, so downstream rendering sees identical shapes.
  const rows = (csv: string) => parseCsvContent(csv);

  // Advanced ELO expects a slightly different run shape (see analyze/index.ts).
  const advancedRuns: AdvancedRun[] = extractedRuns.map((r) => ({
    c: r.c,
    a: r.a,
    w: r.w,
    dmg: r.dmg,
    t: r.t,
    totalFloors: r.fl,
    cards: (r.cardsMeta || []).map((cm) => ({ id: cm.id, floor: cm.floor, upgraded: cm.upgraded })),
    encs: r.encs.map((e) => ({
      id: e.id,
      act: e.a,
      floor: 0,
      type: "monster" as "boss" | "elite" | "monster",
    })),
    relics: r.relics,
  }));

  return {
    globalStats,
    cards: rows(generateCardAnalytics(extractedRuns)),
    encounters: rows(generateEncounterAnalytics(extractedRuns)),
    relics: rows(generateRelicAnalytics(extractedRuns)),
    builds: rows(generateBuildArchetypes(extractedRuns)),
    ascension: rows(generateAscensionStats(extractedRuns)),
    turnEconomy: rows(generateTurnEconomy(extractedRuns)),
    cardSynergies: rows(generateCardSynergyPairs(extractedRuns)),
    relicSynergies: rows(generateRelicSynergyPairs(extractedRuns)),
    charAscHeatmap: rows(generateCharacterAscensionHeatmap(extractedRuns)),
    encountersByAct: rows(generateEncounterByAct(extractedRuns)),
    deckTargets: rows(generateDeckSizeTargets(extractedRuns)),
    runs: extractedRuns,
    eloState: calculateELOFromRuns(extractedRuns),
    eloAdvancedState: calculateAdvancedELOFromRuns(advancedRuns).state,
    relicEloState: calculateRelicELOFromRuns(extractedRuns),
    floorStats: generateFloorAnalytics(rawRuns),
    ancientStats: generateAncientAnalytics(rawRuns),
  };
}
