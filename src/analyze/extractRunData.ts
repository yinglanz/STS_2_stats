/**
 * Extract and normalize run data from STS2 run files
 */

import fs from "fs";
import path from "path";
import {
  RunData,
  ExtractedRun,
  ExtractedCardData,
  ExtractedRelicData,
  ExtractedEncounter,
  BuildMetrics,
  GlobalStats,
  CardAnalytics,
  EncounterAnalytics,
  RelicAnalytics,
  BuildArchetype,
  AscensionStats,
  CardSynergy,
} from "./types";
import { HISTORY_PATH, YOUR_STEAM_ID } from "../config";

/**
 * Load all run files from history folder
 */
export function loadAllRuns(): RunData[] {
  if (!fs.existsSync(HISTORY_PATH)) {
    console.error(`History path not found: ${HISTORY_PATH}`);
    return [];
  }
  const files = fs.readdirSync(HISTORY_PATH).filter((f) => f.endsWith(".run"));
  console.log(`Found ${files.length} run files`);

  return files
    .map((file) => {
      try {
        const content = fs.readFileSync(path.join(HISTORY_PATH, file), "utf-8");
        const run = JSON.parse(content) as RunData;
        // Basic structural validation
        if (!run || !Array.isArray(run.players) || !Array.isArray(run.map_point_history)) {
          console.warn(`Skipping ${file}: missing required fields`);
          return null;
        }
        return run;
      } catch (error) {
        console.error(`Failed to parse ${file}:`, error);
        return null;
      }
    })
    .filter((run): run is RunData => run !== null);
}

/**
 * Extract individual run into normalized format
 */
export function extractRun(run: RunData, runId: string): ExtractedRun {
  if (!Array.isArray(run.players) || run.players.length === 0) {
    throw new Error(`Run ${runId}: no players data`);
  }
  if (!Array.isArray(run.map_point_history)) {
    throw new Error(`Run ${runId}: missing map_point_history`);
  }

  const myPlayer = run.players.find(p => p.id === YOUR_STEAM_ID) ?? run.players[0];
  const myPlayerIndex = run.players.indexOf(myPlayer);
  const character = myPlayer?.character || "UNKNOWN";
  const won = (run.killed_by_encounter ?? "") === "NONE.NONE" && (run.killed_by_event ?? "") === "NONE.NONE";

  // Extract cards with per-act tracking
  const cardMap = new Map<string, ExtractedCardData>();
  const allCardChoices: string[] = [];
  const actCards: [string[], string[], string[]] = [[], [], []]; // a1c, a2c, a3c
  const actSkips: [number, number, number] = [0, 0, 0]; // a1sk, a2sk, a3sk
  const skippedCards: string[] = []; // card IDs offered in skipped reward screens
  let cardActNum = 1;

  for (let floorIdx = 0; floorIdx < run.map_point_history.length; floorIdx++) {
    const floor = run.map_point_history[floorIdx];
    for (const mapPoint of floor) {
      for (const playerStat of mapPoint.player_stats) {
        // Track offered cards
        if (playerStat.card_choices && playerStat.card_choices.length > 0) {
          const anyPicked = playerStat.card_choices.some(c => c.was_picked);
          const actIdx = Math.min(cardActNum, 3) - 1; // 0-indexed

          if (!anyPicked) {
            // Entire reward screen skipped — track the offered cards + increment skip count
            actSkips[actIdx]++;
            for (const choice of playerStat.card_choices) {
              skippedCards.push(choice.card.id);
            }
          }

          for (const choice of playerStat.card_choices) {
            const cardId = choice.card.id;
            const floor_added = choice.card.floor_added_to_deck || 0;

            if (!cardMap.has(cardId)) {
              cardMap.set(cardId, {
                cardId,
                offered: false,
                picked: false,
                upgraded: false,
                floorAdded: floor_added,
              });
            }

            const card = cardMap.get(cardId)!;
            card.offered = true;
            allCardChoices.push(cardId);

            if (choice.was_picked) {
              card.picked = true;
              card.floorAdded = floor_added;
              // Track which act this card was picked in
              actCards[actIdx].push(cardId);
            }
          }
        }

        // Track upgraded cards
        if (playerStat.upgraded_cards) {
          for (const upgradeId of playerStat.upgraded_cards) {
            const card = cardMap.get(upgradeId);
            if (card) {
              card.upgraded = true;
            }
          }
        }
      }

      // Advance act on boss survival (same logic as encounter extraction)
      if (mapPoint.map_point_type === "boss") {
        const bossPlayerStats = mapPoint.player_stats[0];
        const bossHp = bossPlayerStats?.current_hp || 0;
        if (bossHp > 0) {
          cardActNum = Math.min(cardActNum + 1, 3);
        }
      }
    }
  }

  // Extract relics
  const relicMap = new Map<string, ExtractedRelicData>();
  const allRelicChoices: string[] = [];
  const existingRelicIds = new Set(
    myPlayer?.relics.map((r) => r.id) || []
  );

  for (const floor of run.map_point_history) {
    for (const mapPoint of floor) {
      for (const playerStat of mapPoint.player_stats) {
        // Track relic choices
        if (playerStat.relic_choices) {
          for (const choice of playerStat.relic_choices) {
            const relicId = choice.choice;

            if (!relicMap.has(relicId)) {
              relicMap.set(relicId, {
                relicId,
                offered: false,
                picked: false,
                floorAdded: 0,
                inFinalDeck: false,
              });
            }

            const relic = relicMap.get(relicId)!;
            relic.offered = true;
            allRelicChoices.push(relicId);

            if (choice.was_picked) {
              relic.picked = true;
            }
          }
        }

        // Track ancient choices
        if (playerStat.ancient_choice) {
          for (const choice of playerStat.ancient_choice) {
            const relicId = "RELIC." + choice.TextKey;

            if (!relicMap.has(relicId)) {
              relicMap.set(relicId, {
                relicId,
                offered: false,
                picked: false,
                floorAdded: 0,
                inFinalDeck: false,
              });
            }

            const relic = relicMap.get(relicId)!;
            relic.offered = true;
            allRelicChoices.push(relicId);

            if (choice.was_chosen) {
              relic.picked = true;
            }
          }
        }
      }
    }
  }

  // Mark relics in final deck
  for (const relicId of existingRelicIds) {
    const normalizedId = relicId.startsWith("RELIC.") ? relicId : `RELIC.${relicId}`;
    if (relicMap.has(normalizedId)) {
      relicMap.get(normalizedId)!.inFinalDeck = true;
    } else {
      relicMap.set(normalizedId, {
        relicId: normalizedId,
        offered: false,
        picked: true,
        floorAdded: 1,
        inFinalDeck: true,
      });
    }
  }

  // Extract potions
  const potionMap = new Map<string, { o: number; pk: boolean; b: boolean; u: boolean; d: boolean; fo: number; fu: number; a: number }>();

  for (let floorIdx = 0; floorIdx < run.map_point_history.length; floorIdx++) {
    const floor = run.map_point_history[floorIdx];

    for (const mapPoint of floor) {
      for (const playerStat of mapPoint.player_stats) {
        // Track potion choices
        if (playerStat.potion_choices) {
          for (const choice of playerStat.potion_choices) {
            const potionId = choice.choice;

            if (!potionMap.has(potionId)) {
              potionMap.set(potionId, { o: 0, pk: false, b: false, u: false, d: false, fo: floorIdx, fu: 0, a: 0 });
            }

            const stats = potionMap.get(potionId)!;
            stats.o++;  // offered
            if (choice.was_picked) {
              stats.pk = true;  // picked
            }
          }
        }

        // Track bought potions
        if (playerStat.bought_potions) {
          for (const potionId of playerStat.bought_potions) {
            if (!potionMap.has(potionId)) {
              potionMap.set(potionId, { o: 0, pk: false, b: false, u: false, d: false, fo: floorIdx, fu: 0, a: 0 });
            }
            potionMap.get(potionId)!.b = true;  // bought
          }
        }

        // Track used potions
        if (playerStat.potion_used) {
          for (const potionId of playerStat.potion_used) {
            if (!potionMap.has(potionId)) {
              potionMap.set(potionId, { o: 0, pk: false, b: false, u: false, d: false, fo: 0, fu: floorIdx, a: 0 });
            }
            potionMap.get(potionId)!.u = true;  // used
            potionMap.get(potionId)!.fu = floorIdx;  // floor used
          }
        }

        // Track discarded potions
        if (playerStat.potion_discarded) {
          for (const potionId of playerStat.potion_discarded) {
            if (!potionMap.has(potionId)) {
              potionMap.set(potionId, { o: 0, pk: false, b: false, u: false, d: false, fo: 0, fu: 0, a: 0 });
            }
            potionMap.get(potionId)!.d = true;  // discarded
          }
        }
      }
    }
  }

  const potions = Array.from(potionMap.entries()).map(([id, stats]) => ({
    id,
    ...stats
  }));

  // Extract encounters with proper act tracking
  // Acts are determined by bosses defeated: Act 1 until first boss, Act 2 until second boss, Act 3 thereafter
  const encounters: ExtractedEncounter[] = [];
  let currentAct = 1;
  let bossesSeen = 0;

  for (let floorIdx = 0; floorIdx < run.map_point_history.length; floorIdx++) {
    const floor = run.map_point_history[floorIdx];

    for (const mapPoint of floor) {
      // Skip non-combat/event encounters
      if (
        mapPoint.map_point_type === "monster" ||
        mapPoint.map_point_type === "elite" ||
        mapPoint.map_point_type === "boss"
      ) {
        // Get YOUR player stats for this encounter (use your player's index)
        const playerStats = mapPoint.player_stats[myPlayerIndex];
        const damageTaken = playerStats?.damage_taken || 0;
        const currentHp = playerStats?.current_hp || 0;

        // Determine if encounter was survived (hp > 0 means survived)
        const survived = currentHp > 0;

        // Extract each room in this map point
        for (const room of mapPoint.rooms) {
          encounters.push({
            encounterId: room.model_id,
            type: (mapPoint.map_point_type as any) || "monster",
            act: currentAct,
            floor: floorIdx + 1, // 1-indexed
            damageTaken,
            survived,
            turnsTaken: room.turns_taken,
          });
        }

        // If this was a boss and player survived, move to next act
        // Bosses defeated = act transitions (Boss 1 -> Act 2, Boss 2 -> Act 3, etc.)
        if (mapPoint.map_point_type === "boss" && survived) {
          bossesSeen++;
          currentAct = Math.min(bossesSeen + 1, 3);
        }
      }
    }
  }

  // Get final player stats (from last floor)
  let totalGoldEarned = 0;
  let totalGoldSpent = 0;
  let totalDamageTaken = 0;

  if (run.map_point_history.length > 0) {
    const lastFloor = run.map_point_history[run.map_point_history.length - 1];
    if (lastFloor.length > 0) {
      const lastMapPoint = lastFloor[lastFloor.length - 1];
      if (lastMapPoint.player_stats.length > myPlayerIndex) {
        const finalStats = lastMapPoint.player_stats[myPlayerIndex];
        totalGoldEarned = finalStats.gold_gained || 0;
        totalGoldSpent = finalStats.gold_spent || 0;
      }
    }
  }

  // Calculate total damage as sum of all encounter damage
  totalDamageTaken = encounters.reduce((sum, enc) => sum + (enc.damageTaken || 0), 0);

  // Build metrics
  const buildMetrics: BuildMetrics = {
    finalDeckSize: myPlayer?.deck.length || 0,
    finalRelicCount: myPlayer?.relics.length || 0,
    totalCardChoices: allCardChoices.length,
    totalCardsPicked: Array.from(cardMap.values()).filter((c) => c.picked).length,
    totalCardsUpgraded: Array.from(cardMap.values()).filter((c) => c.upgraded).length,
    totalRelicChoices: allRelicChoices.length,
    totalRelicsPicked: Array.from(relicMap.values()).filter((r) => r.picked).length,
    totalGoldEarned,
    totalGoldSpent,
    totalDamageTaken,
  };

  // Final deck card IDs and relic IDs as plain string arrays
  const finalDeckCards: string[] = (myPlayer?.deck || []).map((c: any) => c.id || c);
  const finalRelicIds: string[] = (myPlayer?.relics || []).map((r: any) => r.id || r);

  // Deck with floor + upgrade metadata (for Advanced ELO model)
  const finalDeckCardsMeta = (myPlayer?.deck || []).map((c: any) => ({
    id: c.id || c,
    floor: c.floor_added_to_deck || 0,
    upgraded: (c.current_upgrade_level ?? 0) > 0,
  }));

  return {
    id: runId,
    t: run.start_time,
    c: character,
    a: run.ascension,
    w: won,
    m: run.players.length,
    dmg: totalDamageTaken,
    sz: buildMetrics.finalDeckSize,
    rc: buildMetrics.finalRelicCount,
    fl: run.map_point_history.length,
    seed: run.seed || '',
    dur: run.run_time || 0,
    acts: JSON.stringify(run.acts || []),
    cp: buildMetrics.totalCardsPicked,
    v: run.build_id || '',
    a1c: actCards[0],
    a2c: actCards[1],
    a3c: actCards[2],
    a1sk: actSkips[0],
    a2sk: actSkips[1],
    a3sk: actSkips[2],
    skippedCards,
    alc: run.players
      .filter(p => p.id !== YOUR_STEAM_ID)
      .map(p => ({ id: p.id, c: p.character })),
    k: run.killed_by_encounter !== 'NONE.NONE' ? run.killed_by_encounter : run.killed_by_event,
    cards: finalDeckCards,
    cardsMeta: finalDeckCardsMeta,
    relics: finalRelicIds,
    potions,
    encs: encounters.map(e => ({
      id: e.encounterId,
      a: e.act,
      d: e.damageTaken,
      s: e.survived,
      tp: e.type === 'boss' ? 3 : e.type === 'elite' ? 2 : 1,
      tu: e.turnsTaken,
      po: 0,
      fn: e.floor,
      mx: 0,
    })),
  };
}

/**
 * Extract all runs
 */
export function extractAllRuns(runs: RunData[]): ExtractedRun[] {
  console.log(`Extracting data from ${runs.length} runs...`);
  return runs
    .map((run, idx) => {
      try {
        const runId = `run_${run.start_time}`;
        return extractRun(run, runId);
      } catch (error) {
        console.error(`Failed to extract run ${idx}:`, error);
        return null;
      }
    })
    .filter((run): run is ExtractedRun => run !== null);
}

/**
 * Calculate global statistics
 */
export function calculateGlobalStats(extractedRuns: ExtractedRun[]): GlobalStats {
  const characterStats = new Map<
    string,
    { runs: number; wins: number; winRate: number }
  >();
  const ascensionStats = new Map<
    number,
    { runs: number; wins: number; winRate: number }
  >();

  let totalWins = 0;
  let totalRunTime = 0;
  let totalDeckSize = 0;
  let totalRelicCount = 0;

  for (const run of extractedRuns) {
    if (run.w) totalWins++;

    // Character stats
    if (!characterStats.has(run.c)) {
      characterStats.set(run.c, { runs: 0, wins: 0, winRate: 0 });
    }
    const charStat = characterStats.get(run.c)!;
    charStat.runs++;
    if (run.w) charStat.wins++;

    // Ascension stats
    if (!ascensionStats.has(run.a)) {
      ascensionStats.set(run.a, { runs: 0, wins: 0, winRate: 0 });
    }
    const ascStat = ascensionStats.get(run.a)!;
    ascStat.runs++;
    if (run.w) ascStat.wins++;

    totalDeckSize += run.sz;
    totalRelicCount += run.rc;
  }

  // Calculate win rates
  for (const stat of characterStats.values()) {
    stat.winRate = stat.runs > 0 ? (stat.wins / stat.runs) * 100 : 0;
  }
  for (const stat of ascensionStats.values()) {
    stat.winRate = stat.runs > 0 ? (stat.wins / stat.runs) * 100 : 0;
  }

  return {
    totalRuns: extractedRuns.length,
    totalWins,
    totalLosses: extractedRuns.length - totalWins,
    overallWinRate: (totalWins / extractedRuns.length) * 100,
    avgDeckSize: totalDeckSize / extractedRuns.length,
    avgRelicCount: totalRelicCount / extractedRuns.length,
    avgRunTime: totalRunTime / extractedRuns.length,
    characterStats: Object.fromEntries(characterStats),
    ascensionStats: Object.fromEntries(ascensionStats),
  };
}

// Main execution
if (require.main === module) {
  try {
    const runs = loadAllRuns();
    console.log(`Loaded ${runs.length} runs`);

    const extracted = extractAllRuns(runs);
    console.log(`Extracted ${extracted.length} runs`);

    const globalStats = calculateGlobalStats(extracted);
    console.log("\n=== GLOBAL STATS ===");
    console.log(`Total Runs: ${globalStats.totalRuns}`);
    console.log(`Total Wins: ${globalStats.totalWins}`);
    console.log(`Win Rate: ${globalStats.overallWinRate.toFixed(1)}%`);
    console.log(`Avg Deck Size: ${globalStats.avgDeckSize.toFixed(1)}`);
    console.log(`Avg Relics: ${globalStats.avgRelicCount.toFixed(1)}`);
    console.log("\nCharacter Win Rates:");
    for (const [char, stat] of Object.entries(globalStats.characterStats)) {
      console.log(`  ${char}: ${stat.winRate.toFixed(1)}% (${stat.wins}/${stat.runs})`);
    }

    // Save extracted data for later use
    fs.writeFileSync(
      path.join(__dirname, "../../output/extracted_runs.json"),
      JSON.stringify(extracted, null, 2)
    );
    console.log("\nExtracted data saved to output/extracted_runs.json");
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

export { ExtractedRun };
