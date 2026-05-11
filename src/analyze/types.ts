/**
 * Type definitions for STS2 run data analysis
 */

export interface RunData {
  acts: string[];
  ascension: number;
  build_id: string;
  game_mode: string;
  killed_by_encounter: string;
  killed_by_event: string;
  map_point_history: MapPointFloor[][];
  modifiers: string[];
  platform_type: string;
  players: PlayerData[];
  run_time: number;
  schema_version: number;
  seed: string;
  start_time: number;
  was_abandoned: boolean;
  win: boolean;
}

export interface PlayerData {
  character: string;
  id: number;
  badges: string[];
  deck: CardInDeck[];
  relics: RelicInDeck[];
  potions: any[];
  max_potion_slot_count: number;
}

export interface CardInDeck {
  id: string;
  floor_added_to_deck: number;
  current_upgrade_level?: number;
  enchantment?: { id: string; amount: number };
}

export interface RelicInDeck {
  id: string;
  floor_added_to_deck: number;
}

export interface MapPointFloor {
  map_point_type: "ancient" | "monster" | "elite" | "boss" | "shop" | "rest_site" | "treasure" | "unknown";
  player_stats: PlayerStats[];
  rooms: Room[];
}

export interface PlayerStats {
  player_id: number;
  current_gold: number;
  current_hp: number;
  max_hp: number;
  damage_taken: number;
  hp_healed: number;
  max_hp_gained: number;
  max_hp_lost: number;
  gold_gained: number;
  gold_lost: number;
  gold_spent: number;
  gold_stolen: number;
  card_choices?: CardChoice[];
  cards_gained?: { id: string; floor_added_to_deck?: number }[];
  cards_transformed?: any[];
  cards_enchanted?: any[];
  relic_choices?: RelicChoice[];
  potion_choices?: PotionChoice[];
  bought_potions?: string[];
  potion_used?: string[];
  potion_discarded?: string[];
  rest_site_choices?: string[];
  upgraded_cards?: string[];
  event_choices?: any[];
  ancient_choice?: AncientChoice[];
}

export interface CardChoice {
  card: { id: string; floor_added_to_deck?: number };
  was_picked: boolean;
}

export interface RelicChoice {
  choice: string;
  was_picked: boolean;
}

export interface AncientChoice {
  TextKey: string;
  title: { key: string; table: string };
  was_chosen: boolean;
}

export interface PotionChoice {
  choice: string;
  was_picked: boolean;
}

export interface Room {
  model_id: string;
  room_type: "monster" | "elite" | "boss" | "shop" | "rest_site" | "treasure" | "event";
  monster_ids?: string[];
  turns_taken: number;
}

// ============================================
// EXTRACTED RUN SUMMARY
// ============================================

export interface ExtractedRun {
  id: string;           // runId
  t: number;            // startTime
  c: string;            // character
  a: number;            // ascension
  w: boolean;           // won
  m: number;            // multiplayerCount (1=solo)
  dmg: number;          // damage taken
  sz: number;           // final deck size
  rc: number;           // final relic count
  fl: number;           // floor reached
  seed: string;
  dur: number;          // duration seconds
  acts: string;         // JSON array of act IDs
  cp: number;           // card picks
  v: string;            // build_id (game version)
  a1c: string[];        // act 1 cards
  a2c: string[];        // act 2 cards
  a3c: string[];        // act 3 cards
  a1sk: number;         // act 1 skips (reward screens where no card was picked)
  a2sk: number;         // act 2 skips
  a3sk: number;         // act 3 skips
  skippedCards: string[]; // card IDs offered in skipped reward screens
  alc?: Array<{ id: number; c: string }>; // allies (multiplayer)
  k?: string;           // killedBy
  cards: string[];      // final deck card IDs (plain, for backward compat)
  cardsMeta: Array<{ id: string; floor: number; upgraded: boolean }>; // deck with floor + upgrade info
  relics: string[];     // final relic IDs
  potions: Array<{
    id: string; o: number; pk: boolean; b: boolean;
    u: boolean; d: boolean; fo: number; fu: number; a: number;
  }>;
  encs: Array<{
    id: string; a: number; d: number; s: boolean;
    tp: number; tu: number; po: number; fn: number; mx: number;
  }>;
}

// ============================================
// ELO RATING STATE
// ============================================

export interface ELORecord {
  rating: number;
  peakRating: number;
  gamesPlayed: number;
  wins: number;
}

/** Extended ELO record produced by the Advanced (Glicko-2) model */
export interface AdvancedELORecord extends ELORecord {
  rd: number;     // Glicko-2 Rating Deviation — uncertainty (lower = more certain)
  sigma: number;  // Glicko-2 Volatility
}

/** character → ascension → cardId → AdvancedELORecord */
export type AdvancedELOState = Record<string, Record<number, Record<string, AdvancedELORecord>>>;

/** Nested map: character → ascension → cardId → ELORecord */
export type ELOState = Record<string, Record<number, Record<string, ELORecord>>>;

/** Nested map: character → relicId → ELORecord (no ascension split — relics persist across acts) */
export type RelicELOState = Record<string, Record<string, ELORecord>>;

export interface ExtractedCardData {
  cardId: string;
  offered: boolean;
  picked: boolean;
  upgraded: boolean;
  floorAdded: number;
}

export interface ExtractedRelicData {
  relicId: string;
  offered: boolean;
  picked: boolean;
  floorAdded: number;
  inFinalDeck: boolean;
}

export interface ExtractedEncounter {
  encounterId: string;
  type: "boss" | "elite" | "monster";
  act: number;
  floor: number;
  damageTaken: number;
  survived: boolean;
  turnsTaken: number;
}

export interface BuildMetrics {
  finalDeckSize: number;
  finalRelicCount: number;
  totalCardChoices: number;
  totalCardsPicked: number;
  totalCardsUpgraded: number;
  totalRelicChoices: number;
  totalRelicsPicked: number;
  totalGoldEarned: number;
  totalGoldSpent: number;
  totalDamageTaken: number;
}

// ============================================
// AGGREGATED ANALYTICS
// ============================================

export interface CardAnalytics {
  cardId: string;
  offeredCount: number;
  pickedCount: number;
  pickRate: number;
  upgradedCount: number;
  upgradeRate: number;
  avgPickPosition: number;
  winsWithCard: number;
  lossesWithCard: number;
  winRateWithCard: number;
  avgDeckSizeWhenPicked: number;
  byAscension: Record<number, CardAscensionStats>;
  byCharacter: Record<string, CardCharacterStats>;
}

export interface CardAscensionStats {
  offeredCount: number;
  pickedCount: number;
  pickRate: number;
  winRate: number;
}

export interface CardCharacterStats {
  offeredCount: number;
  pickedCount: number;
  pickRate: number;
  winRate: number;
}

export interface EncounterAnalytics {
  encounterId: string;
  encounterType: "boss" | "elite" | "monster";
  foughtCount: number;
  survivedCount: number;
  survivalRate: number;
  avgDamageTaken: number;
  timesEndedRun: number;
  byAct: Record<number, EncounterActStats>;
}

export interface EncounterActStats {
  foughtCount: number;
  survivedCount: number;
  survivalRate: number;
  avgDamageTaken: number;
}

export interface RelicAnalytics {
  relicId: string;
  offeredCount: number;
  pickedCount: number;
  pickRate: number;
  avgPickPosition: number;
  winsWithRelic: number;
  lossesWithRelic: number;
  winRateWithRelic: number;
  avgFinalDeckCountWithRelic: number;
  byAscension: Record<number, RelicAscensionStats>;
  byCharacter: Record<string, RelicCharacterStats>;
}

export interface RelicAscensionStats {
  offeredCount: number;
  pickedCount: number;
  pickRate: number;
  winRate: number;
}

export interface RelicCharacterStats {
  offeredCount: number;
  pickedCount: number;
  pickRate: number;
  winRate: number;
}

export interface BuildArchetype {
  character: string;
  ascension: number;
  totalRuns: number;
  wins: number;
  winRate: number;
  avgDeckSize: number;
  avgRelicCount: number;
  topCards: Array<{ cardId: string; frequency: number }>;
  topRelics: Array<{ relicId: string; frequency: number }>;
}

export interface AscensionStats {
  ascensionLevel: number;
  totalRuns: number;
  wins: number;
  winRate: number;
  avgDeckSize: number;
  avgRelicCount: number;
  avgGoldEarned: number;
  mostCommonCharacter: string;
  dealiestEncounter: string;
}

export interface CardSynergy {
  items: string[]; // [card1, card2] or [card, relic] etc
  coOccurrenceCount: number;
  winsWithBoth: number;
  winRateWithBoth: number;
}

export interface GlobalStats {
  totalRuns: number;
  totalWins: number;
  totalLosses: number;
  overallWinRate: number;
  avgDeckSize: number;
  avgRelicCount: number;
  avgRunTime: number;
  characterStats: Record<string, { runs: number; wins: number; winRate: number }>;
  ascensionStats: Record<number, { runs: number; wins: number; winRate: number }>;
}
