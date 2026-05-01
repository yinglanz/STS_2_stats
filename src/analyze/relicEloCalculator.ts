/**
 * ELO rating calculator for STS2 relics.
 *
 * Mirrors the card ELO model with adjustments for relic mechanics:
 *
 * 1. DYNAMIC K-FACTOR — same as cards (48 / 32 / 24 by games played)
 *
 * 2. ASCENSION SCALING — same multiplier as cards
 *
 * 3. DAMAGE-WEIGHTED RESULT SCORE — same as cards
 *
 * 4. No "opponent" pool to average against — each relic is compared against
 *    the fixed baseline rating (1500). This means a relic's rating moves
 *    independently of the other relics in the run, purely driven by
 *    win/loss outcomes. Works well since relics are not all "chosen" the
 *    same way cards are (some come from bosses, events, etc.).
 *
 * Relic ELO is tracked per character only (not per ascension), since relics
 * carry across all acts and the same relic appears at all ascension levels.
 */

import { ExtractedRun, ELORecord, RelicELOState } from "./types";

const DEFAULT_RATING = 1500;

// Starting relics excluded — not a player choice
const STARTER_RELICS = new Set([
  'RELIC.BURNING_BLOOD',     // Ironclad
  'RELIC.RING_OF_THE_SNAKE', // Silent
  'RELIC.CRACKED_CORE',      // Defect
  'RELIC.BOUND_PHYLACTERY',  // Necrobinder
  'RELIC.DIVINE_RIGHT',      // Regent
]);

function getBaseK(gamesPlayed: number): number {
  if (gamesPlayed < 10) return 48;
  if (gamesPlayed < 30) return 32;
  return 24;
}

function getAscensionMultiplier(ascension: number): number {
  return 1 + Math.min(ascension / 20, 1);
}

function getResultScore(run: ExtractedRun): number {
  if (run.w) {
    if (run.dmg <= 50)  return 1.00;
    if (run.dmg <= 150) return 0.92;
    return 0.85;
  } else {
    const encCount = run.encs.length;
    if (encCount >= 12) return 0.15;
    if (encCount >= 6)  return 0.08;
    return 0.02;
  }
}

function getOrInitRecord(state: RelicELOState, relicId: string, character: string): ELORecord {
  if (!state[character]) state[character] = {};
  if (!state[character][relicId]) {
    state[character][relicId] = {
      rating: DEFAULT_RATING,
      peakRating: DEFAULT_RATING,
      gamesPlayed: 0,
      wins: 0,
    };
  }
  return state[character][relicId];
}

export function processRunForRelics(run: ExtractedRun, state: RelicELOState): void {
  const relics = run.relics.filter(r => !STARTER_RELICS.has(r));
  if (relics.length === 0) return;

  const { c: character, a: ascension, w: won } = run;
  const result = getResultScore(run);
  const ascMult = getAscensionMultiplier(ascension);

  for (const relicId of relics) {
    const record = getOrInitRecord(state, relicId, character);
    const k = getBaseK(record.gamesPlayed) * ascMult;
    // Each relic is compared against the baseline (1500) — no deck-average opponent
    const expected = 1 / (1 + Math.pow(10, (DEFAULT_RATING - record.rating) / 400));
    const delta = k * (result - expected);

    record.rating = Math.round((record.rating + delta) * 100) / 100;
    record.peakRating = Math.max(record.peakRating, record.rating);
    record.gamesPlayed++;
    if (won) record.wins++;
  }
}

export function calculateRelicELOFromRuns(runs: ExtractedRun[]): RelicELOState {
  const state: RelicELOState = {};
  const sorted = [...runs].sort((a, b) => a.t - b.t);
  for (const run of sorted) {
    processRunForRelics(run, state);
  }
  return state;
}
