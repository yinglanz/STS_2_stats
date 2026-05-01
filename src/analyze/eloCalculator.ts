/**
 * ELO rating calculator for STS2 cards — Enhanced model
 *
 * Improvements over a simple binary ELO:
 *
 * 1. DYNAMIC K-FACTOR
 *    Provisional  (<10 games): K = 48  — high volatility to find the right rating fast
 *    Normal       (10–29 games): K = 32
 *    Established  (30+ games): K = 24  — stable, small adjustments
 *
 * 2. ASCENSION SCALING
 *    Higher ascension is harder; wins/losses should count for more.
 *    effectiveK = K × (1 + ascension / 20)
 *    Asc 0 → 1.0×  |  Asc 10 → 1.5×  |  Asc 20+ → 2.0×
 *
 * 3. DAMAGE-WEIGHTED RESULT SCORE
 *    Instead of a binary 1/0, result is a float in [0, 1]:
 *      Win clean  (dmg ≤ 50)   → 1.00
 *      Win normal (dmg ≤ 150)  → 0.92
 *      Win barely (dmg > 150)  → 0.85
 *      Loss, got far  (≥ 12 encounters) → 0.15
 *      Loss, mid      (6–11 encounters) → 0.08
 *      Loss, died early (< 6 encounters) → 0.02
 *
 * 4. UPGRADE SYNERGY BONUS
 *    Upgraded cards signal deliberate investment.
 *    On a win:  ELO delta × 1.10
 *    On a loss: ELO delta × 0.90  (protected slightly)
 */

import { ExtractedRun, ELORecord, ELOState } from "./types";

const DEFAULT_RATING = 1500;

// Starter cards (excluded from ELO calculation as they are not player choice)
const STARTER_CARDS = new Set([
  // Ironclad
  'CARD.STRIKE_IRONCLAD',
  'CARD.DEFEND_IRONCLAD',
  'CARD.BASH',
  // Silent
  'CARD.STRIKE_SILENT',
  'CARD.DEFEND_SILENT',
  'CARD.NEUTRALIZE',
  // Defect
  'CARD.STRIKE_DEFECT',
  'CARD.DEFEND_DEFECT',
  'CARD.ZAP',
  // Necrobinder
  'CARD.STRIKE_NECROBINDER',
  'CARD.DEFEND_NECROBINDER',
  'CARD.NECROTIC_BOLT',
  // Regent
  'CARD.STRIKE_REGENT',
  'CARD.DEFEND_REGENT',
  'CARD.SWORDBURST'
]);

// ─── K-factor helpers ─────────────────────────────────────────────────────────

function getBaseK(gamesPlayed: number): number {
  if (gamesPlayed < 10) return 48;  // provisional
  if (gamesPlayed < 30) return 32;  // normal
  return 24;                         // established
}

function getAscensionMultiplier(ascension: number): number {
  return 1 + Math.min(ascension / 20, 1); // caps at 2.0× for Asc 20+
}

// ─── Result score ─────────────────────────────────────────────────────────────

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

// ─── Core formula ─────────────────────────────────────────────────────────────

/**
 * Expected score for a player rated `playerRating` against an
 * opponent rated `opponentRating` (standard chess formula).
 */
export function calculateExpectedScore(playerRating: number, opponentRating: number): number {
  return 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
}

/**
 * Calculate a new ELO rating after one result.
 */
export function calculateNewRating(
  rating: number,
  expected: number,
  result: number,
  kFactor: number
): number {
  return Math.round((rating + kFactor * (result - expected)) * 100) / 100;
}

// ─── State helpers ────────────────────────────────────────────────────────────

/**
 * Return the ELO record for a card in the given scope,
 * creating a default record at 1500 if it does not yet exist.
 */
export function getOrInitRecord(
  state: ELOState,
  cardId: string,
  character: string,
  ascension: number
): ELORecord {
  if (!state[character]) state[character] = {};
  if (!state[character][ascension]) state[character][ascension] = {};
  if (!state[character][ascension][cardId]) {
    state[character][ascension][cardId] = {
      rating: DEFAULT_RATING,
      peakRating: DEFAULT_RATING,
      gamesPlayed: 0,
      wins: 0,
    };
  }
  return state[character][ascension][cardId];
}

// ─── Run processing ───────────────────────────────────────────────────────────

/**
 * Process a single run and mutate `state` with updated ratings.
 *
 * Uses damage-weighted result scores, dynamic K-factors, ascension
 * scaling, and upgrade bonuses for a more nuanced rating system.
 */
export function processRun(run: ExtractedRun, state: ELOState): void {
  const deckCards = run.cards.filter(c => !STARTER_CARDS.has(c));
  if (deckCards.length === 0) return;

  const { c: character, a: ascension, w: won } = run;
  const result = getResultScore(run);
  const ascMult = getAscensionMultiplier(ascension);

  // Ensure all records exist before computing averages
  const records = deckCards.map((c) =>
    getOrInitRecord(state, c, character, ascension)
  );

  const totalRating = records.reduce((sum, r) => sum + r.rating, 0);

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    // Each card's "opponent" is the average rating of the rest of the deck
    const othersAvg =
      records.length > 1
        ? (totalRating - record.rating) / (records.length - 1)
        : record.rating;

    const k = getBaseK(record.gamesPlayed) * ascMult;
    const expected = calculateExpectedScore(record.rating, othersAvg);
    const delta = k * (result - expected);

    record.rating = Math.round((record.rating + delta) * 100) / 100;
    record.peakRating = Math.max(record.peakRating, record.rating);
    record.gamesPlayed++;
    if (won) record.wins++;
  }
}

// ─── Bulk processing ──────────────────────────────────────────────────────────

/**
 * Process all runs in chronological order and return the final ELO state.
 * Runs are sorted by start time to ensure consistent rating history.
 */
export function calculateELOFromRuns(runs: ExtractedRun[]): ELOState {
  const state: ELOState = {};
  const sorted = [...runs].sort((a, b) => a.t - b.t);
  for (const run of sorted) {
    processRun(run, state);
  }
  return state;
}

// ─── Flattening ───────────────────────────────────────────────────────────────

/**
 * Flatten an ELOState into a sorted array of ELO record objects with context.
 * Optional filters: character and ascension.
 */
export function flattenELOState(
  state: ELOState,
  character?: string,
  ascension?: number
): Array<ELORecord & { cardId: string; character: string; ascension: number }> {
  const records: Array<ELORecord & { cardId: string; character: string; ascension: number }> = [];

  for (const char of Object.keys(state)) {
    if (character && char !== character) continue;
    for (const asc of Object.keys(state[char]) as unknown as number[]) {
      if (ascension !== undefined && Number(asc) !== ascension) continue;
      for (const [cardId, record] of Object.entries(state[char][asc])) {
        records.push({
          ...record,
          cardId,
          character: char,
          ascension: Number(asc),
        });
      }
    }
  }

  return records.sort((a, b) => b.rating - a.rating);
}
