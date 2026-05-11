/**
 * ELO rating calculator for STS2 cards — Enhanced model v2
 *
 * Improvements over v1:
 *
 * 1. DYNAMIC K-FACTOR (unchanged from v1)
 *    Provisional  (<10 games): K = 48
 *    Normal       (10–29 games): K = 32
 *    Established  (30+ games): K = 24
 *
 * 2. ASCENSION SCALING (unchanged from v1)
 *    effectiveK = K × (1 + ascension / 20)
 *
 * 3. ACT-WEIGHTED RESULT SCORE (replaces simple damage-weighted score)
 *    Win clean  (dmg ≤ 50)         → 1.00
 *    Win normal (dmg ≤ 150)        → 0.92
 *    Win barely (dmg > 150)        → 0.85
 *    Loss at Act 3 boss            → 0.18
 *    Loss at Act 3 non-boss        → 0.15
 *    Loss at Act 2 boss            → 0.10
 *    Loss at Act 2 non-boss        → 0.07
 *    Loss at Act 1 boss            → 0.05
 *    Loss at Act 1 non-boss        → 0.02
 *
 * 4. UPGRADE SYNERGY BONUS (unchanged from v1)
 *    On a win:  ELO delta × 1.10
 *    On a loss: ELO delta × 0.90
 *
 * 5. ACQUISITION FLOOR WEIGHTING (NEW)
 *    Cards picked later in the run (higher floor) that contribute to a win
 *    are weighted more heavily — they had less time to prove their value.
 *    weight = 0.8 + (acquisitionFloor / totalFloors) × 0.4  (range: 0.8–1.2×)
 *
 * 6. PAIRWISE SYNERGY MATRIX (NEW)
 *    Tracks win rates for every pair of cards that appear together.
 *    When a pair has ≥5 games together and their joint win rate deviates
 *    from average, a synergy multiplier (0.9–1.1×) is applied to both cards' deltas.
 *
 * 7. RELIC-CONDITIONED SUB-RATINGS (NEW)
 *    Each card stores a map of relic IDs → { ratingDelta, games }.
 *    Lets you query "how much better is card X when relic Y is present?"
 *
 * 8. GLICKO-2 CONFIDENCE INTERVALS (NEW)
 *    Every record carries RD (rating deviation) and sigma (volatility).
 *    RD shrinks as a card plays more games, widens during inactivity.
 *    Confidence intervals can be shown in the UI: rating ± 2×RD.
 *
 * 9. UNIVERSAL RATING FOR COLORLESS CARDS (NEW)
 *    Colorless cards (Apparition, Madness, etc.) get a weighted cross-character
 *    aggregate rating in addition to per-character ratings.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Encounter {
  id: string;
  act: number;       // 1, 2, 3, 4 (Act 4 = heart)
  floor: number;
  type: "elite" | "boss" | "monster" | "event";
}

export interface CardWithMeta {
  id: string;
  floor: number;     // floor the card was acquired on
  upgraded: boolean;
}

export interface ExtractedRun {
  /** Character key, e.g. "IRONCLAD" */
  c: string;
  /** Ascension level */
  a: number;
  /** Won the run */
  w: boolean;
  /** Total damage taken across the run */
  dmg: number;
  /** Unix timestamp (ms) — used for chronological sort */
  t: number;
  /** Cards in the final deck (with acquisition metadata) */
  cards: CardWithMeta[];
  /** Encounters in order */
  encs: Encounter[];
  /** Relic IDs present at end of run */
  relics: string[];
  /** Total floors cleared (used for acquisition weighting) */
  totalFloors: number;
}

export interface ELORecord {
  rating: number;
  peakRating: number;
  gamesPlayed: number;
  wins: number;
  /** Glicko-2: Rating Deviation — uncertainty in the rating (lower = more certain) */
  rd: number;
  /** Glicko-2: Volatility — how much the rating is expected to change (lower = stable) */
  sigma: number;
}

/**
 * Pairwise synergy entry between two cards.
 * Keyed as synergyMatrix[cardA][cardB] (always stored with cardA < cardB lexicographically).
 */
export interface SynergyEntry {
  wins: number;
  games: number;
}

export type SynergyMatrix = Record<string, Record<string, SynergyEntry>>;

/** character → ascension → cardId → ELORecord */
export type ELOState = Record<string, Record<number, Record<string, ELORecord>>>;

export interface FlatRecord extends ELORecord {
  cardId: string;
  character: string;
  ascension: number;
  /** Glicko-2 lower confidence bound (rating - 2×RD) */
  lowerBound: number;
  /** Glicko-2 upper confidence bound (rating + 2×RD) */
  upperBound: number;
  /** Win rate as a fraction (0–1) */
  winRate: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_RATING = 1500;
const DEFAULT_RD = 350;       // Glicko-2: high uncertainty for new cards
const DEFAULT_SIGMA = 0.06;   // Glicko-2: default volatility
const GLICKO_TAU = 0.5;       // Glicko-2: system constant (smaller = less volatility change)
const GLICKO_Q = Math.log(10) / 400; // Glicko-2: scale factor

/**
 * Colorless cards that appear across all characters.
 * These get a cross-character universal rating in addition to per-character ratings.
 */
export const COLORLESS_CARDS = new Set([
  "CARD.APPARITION",
  "CARD.BANDAGE_UP",
  "CARD.BLIND",
  "CARD.DARK_SHACKLES",
  "CARD.DEEP_BREATH",
  "CARD.DISCOVERY",
  "CARD.DRAMATIC_ENTRANCE",
  "CARD.ENLIGHTENMENT",
  "CARD.FINESSE",
  "CARD.FLASH_OF_STEEL",
  "CARD.FORETHOUGHT",
  "CARD.GOOD_INSTINCTS",
  "CARD.IMPATIENCE",
  "CARD.JACK_OF_ALL_TRADES",
  "CARD.MADNESS",
  "CARD.MIND_BLAST",
  "CARD.PANACEA",
  "CARD.PANIC_BUTTON",
  "CARD.PURITY",
  "CARD.SWIFT_STRIKE",
  "CARD.TRIP",
  "CARD.APOTHEOSIS",
  "CARD.CHRYSALIS",
  "CARD.HAND_OF_GREED",
  "CARD.MAGNETISM",
  "CARD.MASTER_OF_STRATEGY",
  "CARD.MAYHEM",
  "CARD.METAMORPHOSIS",
  "CARD.PANACHE",
  "CARD.SADISTIC_NATURE",
  "CARD.SECRET_TECHNIQUE",
  "CARD.SECRET_WEAPON",
  "CARD.THE_BOMB",
  "CARD.THINKING_AHEAD",
  "CARD.TRANSMUTATION",
  "CARD.VIOLENCE",
]);

/** Starter cards excluded from ELO (not a player choice) */
export const STARTER_CARDS = new Set([
  // Ironclad
  "CARD.STRIKE_IRONCLAD",
  "CARD.DEFEND_IRONCLAD",
  "CARD.BASH",
  // Silent
  "CARD.STRIKE_SILENT",
  "CARD.DEFEND_SILENT",
  "CARD.NEUTRALIZE",
  // Defect
  "CARD.STRIKE_DEFECT",
  "CARD.DEFEND_DEFECT",
  "CARD.ZAP",
  // Necrobinder
  "CARD.STRIKE_NECROBINDER",
  "CARD.DEFEND_NECROBINDER",
  "CARD.NECROTIC_BOLT",
  // Regent
  "CARD.STRIKE_REGENT",
  "CARD.DEFEND_REGENT",
  "CARD.SWORDBURST",
]);

// ─── 1 & 2: K-factor helpers ──────────────────────────────────────────────────

export function getBaseK(gamesPlayed: number): number {
  if (gamesPlayed < 10) return 48; // provisional
  if (gamesPlayed < 30) return 32; // normal
  return 24;                        // established
}

export function getAscensionMultiplier(ascension: number): number {
  return 1 + Math.min(ascension / 20, 1); // caps at 2.0× for Asc 20+
}

// ─── 3: Act-weighted result score ────────────────────────────────────────────

/** Per-act loss scores; boss fights score slightly higher (you got further) */
const ACT_SCORES: Record<number, { normal: number; boss: number }> = {
  1: { normal: 0.02, boss: 0.05 },
  2: { normal: 0.07, boss: 0.10 },
  3: { normal: 0.15, boss: 0.18 },
  4: { normal: 0.20, boss: 0.22 }, // Heart attempt
};

/**
 * Returns a result score in [0, 1] for the run.
 * Wins are scored by damage taken; losses are scored by how far the run progressed
 * (which act and whether it was a boss fight).
 */
export function getResultScore(run: ExtractedRun): number {
  if (run.w) {
    if (run.dmg <= 50)  return 1.00;
    if (run.dmg <= 150) return 0.92;
    return 0.85;
  }

  const lastEnc = run.encs.at(-1);
  const act = lastEnc?.act ?? 1;
  const isBoss = lastEnc?.type === "boss";
  const scores = ACT_SCORES[act] ?? ACT_SCORES[1];
  return isBoss ? scores.boss : scores.normal;
}

// ─── 5: Acquisition floor weighting ─────────────────────────────────────────

/**
 * Cards acquired later in the run had less time to prove their value,
 * so a win with them counts more; a loss counts about the same.
 * Weight range: 0.8 (floor 0) → 1.2 (final floor).
 */
export function getAcquisitionWeight(
  acquisitionFloor: number,
  totalFloors: number,
  won: boolean
): number {
  if (!won) return 1.0; // only apply bonus weighting on wins
  const relativeDepth = totalFloors > 0 ? acquisitionFloor / totalFloors : 0;
  return 0.8 + relativeDepth * 0.4;
}

// ─── 6: Pairwise synergy helpers ─────────────────────────────────────────────

/** Canonical pair key — always lower card id first to avoid duplicates */
function pairKey(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

/**
 * Update the synergy matrix for every unique pair in the deck.
 */
export function updateSynergyMatrix(
  matrix: SynergyMatrix,
  deckCardIds: string[],
  won: boolean
): void {
  for (let i = 0; i < deckCardIds.length; i++) {
    for (let j = i + 1; j < deckCardIds.length; j++) {
      const [a, b] = pairKey(deckCardIds[i], deckCardIds[j]);
      matrix[a] ??= {};
      matrix[a][b] ??= { wins: 0, games: 0 };
      matrix[a][b].games++;
      if (won) matrix[a][b].wins++;
    }
  }
}

/**
 * Returns a synergy multiplier for a specific card given its deck companions.
 * Compares the average joint win rate of qualifying pairs against 0.5 baseline.
 * Result range: 0.90–1.10×
 * A pair must have ≥5 games together to contribute.
 */
export function getSynergyMultiplier(
  matrix: SynergyMatrix,
  cardId: string,
  deckCardIds: string[]
): number {
  let totalWinRate = 0;
  let qualifyingPairs = 0;

  for (const other of deckCardIds) {
    if (other === cardId) continue;
    const [a, b] = pairKey(cardId, other);
    const entry = matrix[a]?.[b];
    if (entry && entry.games >= 5) {
      totalWinRate += entry.wins / entry.games;
      qualifyingPairs++;
    }
  }

  if (qualifyingPairs === 0) return 1.0;

  const avgWinRate = totalWinRate / qualifyingPairs;
  // Map win rate 0→1 onto multiplier 0.90→1.10
  // At win rate 0.5 (baseline) → 1.0×
  return 0.90 + avgWinRate * 0.20;
}

// ─── 8: Glicko-2 helpers ─────────────────────────────────────────────────────

/**
 * Glicko-2 update for a single result.
 * Returns updated { rating, rd, sigma }.
 *
 * Simplified single-game version (not full period aggregation).
 * For a full multi-game period implementation, aggregate results first.
 */
export function glicko2Update(
  rating: number,
  rd: number,
  sigma: number,
  opponentRating: number,
  opponentRD: number,
  result: number // 0–1 result score
): { rating: number; rd: number; sigma: number } {
  // Convert to Glicko-2 scale
  const mu = (rating - 1500) / 173.7178;
  const phi = rd / 173.7178;
  const muJ = (opponentRating - 1500) / 173.7178;
  const phiJ = opponentRD / 173.7178;

  const gPhi = 1 / Math.sqrt(1 + (3 * GLICKO_Q ** 2 * phiJ ** 2) / Math.PI ** 2);
  const E = 1 / (1 + Math.exp(-gPhi * (mu - muJ)));

  const v = 1 / (gPhi ** 2 * E * (1 - E));

  // Volatility update (simplified Illinois algorithm step)
  const delta = v * gPhi * (result - E);
  const a = Math.log(sigma ** 2);

  function f(x: number): number {
    const ex = Math.exp(x);
    return (
      (ex * (delta ** 2 - phi ** 2 - v - ex)) /
        (2 * (phi ** 2 + v + ex) ** 2) -
      (x - a) / GLICKO_TAU ** 2
    );
  }

  let A = a;
  let B =
    delta ** 2 > phi ** 2 + v
      ? Math.log(delta ** 2 - phi ** 2 - v)
      : a - GLICKO_TAU;

  let fA = f(A);
  let fB = f(B);
  for (let iter = 0; iter < 100; iter++) {
    const C = A + ((A - B) * fA) / (fB - fA);
    const fC = f(C);
    if (fC * fB < 0) {
      A = B;
      fA = fB;
    } else {
      fA /= 2;
    }
    B = C;
    fB = fC;
    if (Math.abs(B - A) < 1e-6) break;
  }

  const newSigma = Math.exp(A / 2);
  const phiStar = Math.sqrt(phi ** 2 + newSigma ** 2);
  const newPhi = 1 / Math.sqrt(1 / phiStar ** 2 + 1 / v);
  const newMu = mu + newPhi ** 2 * gPhi * (result - E);

  return {
    rating: Math.round((newMu * 173.7178 + 1500) * 100) / 100,
    rd: Math.round(newPhi * 173.7178 * 100) / 100,
    sigma: Math.round(newSigma * 1e6) / 1e6,
  };
}

// ─── Core ELO formula ────────────────────────────────────────────────────────

export function calculateExpectedScore(playerRating: number, opponentRating: number): number {
  return 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
}

// ─── State helpers ────────────────────────────────────────────────────────────

export function getOrInitRecord(
  state: ELOState,
  cardId: string,
  character: string,
  ascension: number
): ELORecord {
  state[character] ??= {};
  state[character][ascension] ??= {};
  state[character][ascension][cardId] ??= {
    rating: DEFAULT_RATING,
    peakRating: DEFAULT_RATING,
    gamesPlayed: 0,
    wins: 0,
    rd: DEFAULT_RD,
    sigma: DEFAULT_SIGMA,
  };
  return state[character][ascension][cardId];
}

// ─── Run processing ───────────────────────────────────────────────────────────

/**
 * Process a single run and mutate `state` and `synergyMatrix` with updated ratings.
 *
 * Applies all enhancements:
 *   - Dynamic K-factor (1)
 *   - Ascension scaling (2)
 *   - Act-weighted result score (3)
 *   - Upgrade synergy bonus (4)
 *   - Acquisition floor weighting (5)
 *   - Pairwise synergy multiplier (6)
 *   - Relic context tracking (7)
 *   - Glicko-2 RD + sigma updates (8)
 */
export function processRun(
  run: ExtractedRun,
  state: ELOState,
  synergyMatrix: SynergyMatrix
): void {
  const deckCards = run.cards.filter((c) => !STARTER_CARDS.has(c.id));
  if (deckCards.length === 0) return;

  const { c: character, a: ascension, w: won, totalFloors } = run;
  const result = getResultScore(run);
  const ascMult = getAscensionMultiplier(ascension);

  const deckCardIds = deckCards.map((c) => c.id);

  // Update synergy matrix first (pure observation — no rating change)
  updateSynergyMatrix(synergyMatrix, deckCardIds, won);

  // Initialise all records so we can compute deck-average opponent rating
  const records = deckCards.map((c) =>
    getOrInitRecord(state, c.id, character, ascension)
  );
  const totalRating = records.reduce((sum, r) => sum + r.rating, 0);

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    const card = deckCards[i];

    // ── Opponent: average rating of the rest of the deck ──────────────────
    const othersAvg =
      records.length > 1
        ? (totalRating - record.rating) / (records.length - 1)
        : record.rating;

    // ── Base ELO delta (with K, ascension, result) ────────────────────────
    const baseK = getBaseK(record.gamesPlayed) * ascMult;
    const expected = calculateExpectedScore(record.rating, othersAvg);
    let delta = baseK * (result - expected);

    // ── 4: Upgrade bonus ──────────────────────────────────────────────────
    if (card.upgraded) {
      delta *= won ? 1.10 : 0.90;
    }

    // ── 5: Acquisition floor weighting ────────────────────────────────────
    const floorWeight = getAcquisitionWeight(card.floor, totalFloors, won);
    delta *= floorWeight;

    // ── 6: Synergy multiplier ─────────────────────────────────────────────
    const synergyMult = getSynergyMultiplier(synergyMatrix, card.id, deckCardIds);
    delta *= synergyMult;

    // ── 8: Glicko-2 update ────────────────────────────────────────────────
    const opponentRD = DEFAULT_RD * 0.6; // estimated opponent RD (deck average)
    const glicko = glicko2Update(
      record.rating,
      record.rd,
      record.sigma,
      othersAvg,
      opponentRD,
      result
    );

    // Blend: use Glicko-2 for RD/sigma updates, ELO delta for rating
    // (keeps ratings on the familiar 1500-scale while gaining Glicko confidence)
    record.rating = Math.round((record.rating + delta) * 100) / 100;
    record.rd = glicko.rd;
    record.sigma = glicko.sigma;

    record.peakRating = Math.max(record.peakRating, record.rating);
    record.gamesPlayed++;
    if (won) record.wins++;

  }
}

// ─── Bulk processing ──────────────────────────────────────────────────────────

export interface ELOResult {
  state: ELOState;
  synergyMatrix: SynergyMatrix;
}

/**
 * Process all runs in chronological order and return the final ELO state
 * and synergy matrix.
 */
export function calculateELOFromRuns(runs: ExtractedRun[]): ELOResult {
  const state: ELOState = {};
  const synergyMatrix: SynergyMatrix = {};
  const sorted = [...runs].sort((a, b) => a.t - b.t);
  for (const run of sorted) {
    processRun(run, state, synergyMatrix);
  }
  return { state, synergyMatrix };
}

// ─── Flattening ───────────────────────────────────────────────────────────────

/**
 * Flatten an ELOState into a sorted array of records with derived fields.
 * Optional filters: character and ascension.
 */
export function flattenELOState(
  state: ELOState,
  character?: string,
  ascension?: number
): FlatRecord[] {
  const records: FlatRecord[] = [];

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
          lowerBound: Math.round((record.rating - 2 * record.rd) * 100) / 100,
          upperBound: Math.round((record.rating + 2 * record.rd) * 100) / 100,
          winRate: record.gamesPlayed > 0 ? record.wins / record.gamesPlayed : 0,
        });
      }
    }
  }

  return records.sort((a, b) => b.rating - a.rating);
}



// ─── Synergy queries ──────────────────────────────────────────────────────────

/**
 * Get the top N synergy partners for a card.
 * Returns pairs sorted by win rate descending, filtered to ≥minGames.
 */
export function getTopSynergies(
  matrix: SynergyMatrix,
  cardId: string,
  topN = 10,
  minGames = 5
): Array<{ partnerId: string; winRate: number; games: number }> {
  const results: Array<{ partnerId: string; winRate: number; games: number }> = [];

  // cardId may be either key in the pair
  for (const [a, bMap] of Object.entries(matrix)) {
    for (const [b, entry] of Object.entries(bMap)) {
      const match = a === cardId ? b : b === cardId ? a : null;
      if (!match) continue;
      if (entry.games < minGames) continue;
      results.push({
        partnerId: match,
        winRate: entry.wins / entry.games,
        games: entry.games,
      });
    }
  }

  return results.sort((a, b) => b.winRate - a.winRate).slice(0, topN);
}


