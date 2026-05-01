/**
 * Generate CSV reports from extracted run data
 */

import fs from "fs";
import path from "path";
import {
  ExtractedRun,
  CardAnalytics,
  EncounterAnalytics,
  RelicAnalytics,
  BuildArchetype,
  AscensionStats,
  GlobalStats,
  ELOState,
} from "./types";
import {
  getCardName,
  getCharacterName,
  getRelicName,
  getEncounterName,
  getEncounterType,
  getPotionName,
} from "./nameMapper";
import { flattenELOState } from "./eloCalculator";

const OUTPUT_PATH = path.join(__dirname, "../../output/reports");

// Starter relics (excluded from analysis as they are not player choice)
const STARTER_RELICS = new Set([
  'RELIC.BURNING_BLOOD',      // Ironclad
  'RELIC.RING_OF_THE_SNAKE',  // Silent
  'RELIC.CRACKED_CORE',       // Defect
  'RELIC.BOUND_PHYLACTERY',   // Necrobinder
  'RELIC.DIVINE_RIGHT'        // Regent
]);

// Starter cards (excluded from analysis as they are not player choice)
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

/**
 * Ensure output directory exists
 */
function ensureOutputDir() {
  if (!fs.existsSync(OUTPUT_PATH)) {
    fs.mkdirSync(OUTPUT_PATH, { recursive: true });
  }
}

/**
 * Convert object array to CSV string
 */
function toCsv(data: any[], headers: string[]): string {
  const lines: string[] = [];
  lines.push(headers.map((h) => `"${h}"`).join(","));

  for (const row of data) {
    const values = headers.map((h) => {
      const val = row[h];
      if (val === null || val === undefined) return "";
      if (typeof val === "object") return `"${JSON.stringify(val)}"`;
      const str = String(val).replace(/"/g, '""');
      return isNaN(Number(val)) ? `"${str}"` : str;
    });
    lines.push(values.join(","));
  }

  return lines.join("\n");
}

/**
 * Generate Card Analytics report with friendly names
 */
export function generateCardAnalytics(runs: ExtractedRun[]): string {
  const cardMap = new Map<string, any>();

  // Aggregate card data from final decks
  runs.forEach((run) => {
    // Track skipped card offers
    (run.skippedCards ?? []).forEach((card) => {
      if (STARTER_CARDS.has(card)) return;
      if (!cardMap.has(card)) {
        cardMap.set(card, {
          cardId: card,
          cardName: getCardName(card),
          pickedCount: 0,
          upgradedCount: 0,
          totalWinsWhenPicked: 0,
          totalRunsWhenPicked: 0,
          totalDeckSizeWhenPicked: 0,
          skippedCount: 0,
        });
      }
      cardMap.get(card).skippedCount++;
    });

    run.cards.forEach((card) => {
      // Skip starter cards - not player choice
      if (STARTER_CARDS.has(card)) return;
      
      if (!cardMap.has(card)) {
        cardMap.set(card, {
          cardId: card,
          cardName: getCardName(card),
          pickedCount: 0,
          upgradedCount: 0,
          totalWinsWhenPicked: 0,
          totalRunsWhenPicked: 0,
          totalDeckSizeWhenPicked: 0,
          skippedCount: 0,
        });
      }

      const stats = cardMap.get(card);
      stats.pickedCount++;
      if (run.w) stats.totalWinsWhenPicked++;
      stats.totalRunsWhenPicked++;
      stats.totalDeckSizeWhenPicked += run.sz;
    });
  });

  // Calculate rates and convert to array
  const report = Array.from(cardMap.values())
    .map((stats) => {
      const upgradeRate = stats.pickedCount > 0 ? Number(((stats.upgradedCount / stats.pickedCount) * 100).toFixed(1)) : 0;
      const winRate = stats.totalRunsWhenPicked > 0
        ? Number(((stats.totalWinsWhenPicked / stats.totalRunsWhenPicked) * 100).toFixed(1))
        : 0;
      const synergyScore = ((upgradeRate + winRate) / 2).toFixed(1);
      
      return {
        card: stats.cardName,
        pickedCount: stats.pickedCount,
        skippedCount: stats.skippedCount ?? 0,
        upgradeRate: upgradeRate.toFixed(1),
        winRateWithCard: winRate.toFixed(1),
        synergyScore: synergyScore,
        avgDeckSizeWhenPicked: stats.totalRunsWhenPicked > 0
          ? (stats.totalDeckSizeWhenPicked / stats.totalRunsWhenPicked).toFixed(1)
          : "0.0",
      };
    })
    .sort((a, b) => Number(b.pickedCount) - Number(a.pickedCount));

  const headers = [
    "card",
    "pickedCount",
    "skippedCount",
    "upgradeRate",
    "winRateWithCard",
    "synergyScore",
    "avgDeckSizeWhenPicked",
  ];

  return toCsv(report, headers);
}

/**
 * Generate Encounter Analytics report
 */
export function generateEncounterAnalytics(runs: ExtractedRun[]): string {
  const encounterMap = new Map<string, any>();

  runs.forEach((run) => {
    run.encs.forEach((enc) => {
      const key = enc.id;
      if (!encounterMap.has(key)) {
        encounterMap.set(key, {
          encounterId: enc.id,
          encounterName: getEncounterName(enc.id),
          encounterType: getEncounterType(enc.id),
          foughtCount: 0,
          survivedCount: 0,
          totalDamageTaken: 0,
          timesEndedRun: 0,
          byAct: new Map<number, { count: number; survived: number; damageTaken: number }>(),
        });
      }

      const stats = encounterMap.get(key);
      stats.foughtCount++;
      if (enc.s) stats.survivedCount++;
      stats.totalDamageTaken += enc.d;

      // Track if this encounter ended the run (last encounter not survived)
      if (!enc.s && enc === run.encs[run.encs.length - 1]) {
        stats.timesEndedRun++;
      }

      // Act breakdown
      if (!stats.byAct.has(enc.a)) {
        stats.byAct.set(enc.a, { count: 0, survived: 0, damageTaken: 0 });
      }
      const actStats = stats.byAct.get(enc.a);
      actStats.count++;
      if (enc.s) actStats.survived++;
      actStats.damageTaken += enc.d;
    });
  });

  const report = Array.from(encounterMap.values())
    .map((stats) => {
      // Generate act breakdown string (e.g., "Act 1: 80%, Act 2: 60%")
      const actBreakdown = (Array.from(stats.byAct.entries()) as any[])
        .sort((a: any, b: any) => a[0] - b[0])
        .map(([act, data]: any) => {
          const rate = ((data.survived / data.count) * 100).toFixed(0);
          return `Act ${act}: ${rate}% (${data.survived}/${data.count})`;
        })
        .join(" | ");

      return {
        encounter: stats.encounterName,
        type: stats.encounterType,
        totalFought: stats.foughtCount,
        totalSurvived: stats.survivedCount,
        survivalRate: ((stats.survivedCount / stats.foughtCount) * 100).toFixed(1),
        avgDamage: (stats.totalDamageTaken / stats.foughtCount).toFixed(1),
        timesEndedRun: stats.timesEndedRun,
        byActBreakdown: actBreakdown,
      };
    })
    .sort((a, b) => Number(a.survivalRate) - Number(b.survivalRate));

  const headers = [
    "encounter",
    "type",
    "totalFought",
    "totalSurvived",
    "survivalRate",
    "avgDamage",
    "timesEndedRun",
    "byActBreakdown",
  ];

  return toCsv(report, headers);
}

/**
 * Generate Relic Analytics report with friendly names
 */
export function generateRelicAnalytics(runs: ExtractedRun[]): string {
  const relicMap = new Map<string, any>();

  // Relics in compact format are just IDs in the final deck
  runs.forEach((run) => {
    run.relics.forEach((relicId) => {
      // Skip starter relics - not player choice
      if (STARTER_RELICS.has(relicId)) return;
      
      if (!relicMap.has(relicId)) {
        relicMap.set(relicId, {
          relicId,
          relicName: getRelicName(relicId),
          pickedCount: 0,
          totalWinsWhenPicked: 0,
          totalRunsWhenPicked: 0,
          totalFinalDeckCountWhenPicked: 0,
        });
      }

      const stats = relicMap.get(relicId);
      stats.pickedCount++;
      if (run.w) stats.totalWinsWhenPicked++;
      stats.totalRunsWhenPicked++;
      stats.totalFinalDeckCountWhenPicked += run.rc;
    });
  });

  const report = Array.from(relicMap.values())
    .map((stats) => ({
      relic: stats.relicName,
      pickedCount: stats.pickedCount,
      winRateWithRelic: stats.totalRunsWhenPicked > 0
        ? ((stats.totalWinsWhenPicked / stats.totalRunsWhenPicked) * 100).toFixed(1)
        : "0.0",
      avgFinalDeckCountWithRelic: stats.totalRunsWhenPicked > 0
        ? (stats.totalFinalDeckCountWhenPicked / stats.totalRunsWhenPicked).toFixed(1)
        : "0.0",
    }))
    .sort((a, b) => Number(b.pickedCount) - Number(a.pickedCount));

  const headers = [
    "relic",
    "pickedCount",
    "winRateWithRelic",
    "avgFinalDeckCountWithRelic",
  ];

  return toCsv(report, headers);
}

/**
 * Generate Potion Analytics report
 */
export function generatePotionAnalytics(runs: ExtractedRun[]): string {
  const potionMap = new Map<string, any>();

  // Aggregate potion data across all runs
  runs.forEach((run) => {
    if (!run.potions || run.potions.length === 0) return;

    run.potions.forEach((potion) => {
      const key = potion.id;

      if (!potionMap.has(key)) {
        potionMap.set(key, {
          potionId: potion.id,
          potionName: getPotionName(potion.id),
          timesOffered: 0,
          timesPicked: 0,
          timesUsed: 0,
          timesBought: 0,
          timesDiscarded: 0,
          totalWinsWhenUsed: 0,
          totalRunsWhenUsed: 0,
        });
      }

      const stats = potionMap.get(key);
      stats.timesOffered += potion.o;
      if (potion.pk) stats.timesPicked++;
      if (potion.u) stats.timesUsed++;
      if (potion.b) stats.timesBought++;
      if (potion.d) stats.timesDiscarded++;
      
      // Track win rate when potion was used
      if (potion.u) {
        stats.totalRunsWhenUsed++;
        if (run.w) stats.totalWinsWhenUsed++;
      }
    });
  });

  // Calculate rates and convert to array
  const report = Array.from(potionMap.values())
    .map((stats) => {
      const pickRate = stats.timesOffered > 0
        ? ((stats.timesPicked / stats.timesOffered) * 100).toFixed(1)
        : "0.0";
      const winRateWhenUsed = stats.totalRunsWhenUsed > 0
        ? ((stats.totalWinsWhenUsed / stats.totalRunsWhenUsed) * 100).toFixed(1)
        : "0.0";

      return {
        potion: stats.potionName,
        timesOffered: stats.timesOffered,
        timesPicked: stats.timesPicked,
        pickRate: pickRate,
        timesUsed: stats.timesUsed,
        timesBought: stats.timesBought,
        timesDiscarded: stats.timesDiscarded,
        winRateWhenUsed: winRateWhenUsed,
      };
    })
    .sort((a, b) => Number(b.timesOffered) - Number(a.timesOffered));

  const headers = [
    "potion",
    "timesOffered",
    "timesPicked",
    "pickRate",
    "timesUsed",
    "timesBought",
    "timesDiscarded",
    "winRateWhenUsed",
  ];

  return toCsv(report, headers);
}

/**
 * Generate Build Archetype report with friendly names
 */
export function generateBuildArchetypes(runs: ExtractedRun[]): string {
  const buildMap = new Map<string, any>();

  runs.forEach((run) => {
    const key = `${run.c}_${run.a}`;
    if (!buildMap.has(key)) {
      buildMap.set(key, {
        character: getCharacterName(run.c),
        ascension: run.a,
        totalRuns: 0,
        wins: 0,
        cardFrequency: new Map<string, number>(),
        relicFrequency: new Map<string, number>(),
        totalDeckSize: 0,
        totalRelicCount: 0,
      });
    }

    const stats = buildMap.get(key);
    stats.totalRuns++;
    if (run.w) stats.wins++;
    stats.totalDeckSize += run.sz;
    stats.totalRelicCount += run.rc;

    // Track card frequency
    run.cards.forEach((card) => {
      const cardName = getCardName(card);
      stats.cardFrequency.set(cardName, (stats.cardFrequency.get(cardName) || 0) + 1);
    });

    // Track relic frequency
    run.relics.forEach((relicId) => {
      const relicName = getRelicName(relicId);
      stats.relicFrequency.set(relicName, (stats.relicFrequency.get(relicName) || 0) + 1);
    });
  });

  const report = Array.from(buildMap.values())
    .map((stats) => {
      const topCardsArray = (Array.from(stats.cardFrequency.entries()) as any[]).sort(
        (a: any, b: any) => b[1] - a[1]
      );
      const topRelicsArray = (Array.from(stats.relicFrequency.entries()) as any[]).sort(
        (a: any, b: any) => b[1] - a[1]
      );

      return {
        character: stats.character,
        ascension: stats.ascension,
        totalRuns: stats.totalRuns,
        wins: stats.wins,
        winRate: ((stats.wins / stats.totalRuns) * 100).toFixed(1),
        avgDeckSize: (stats.totalDeckSize / stats.totalRuns).toFixed(1),
        avgRelicCount: (stats.totalRelicCount / stats.totalRuns).toFixed(1),
        topCard1: topCardsArray[0]?.[0] || "N/A",
        topCard2: topCardsArray[1]?.[0] || "N/A",
        topCard3: topCardsArray[2]?.[0] || "N/A",
        topRelic1: topRelicsArray[0]?.[0] || "N/A",
        topRelic2: topRelicsArray[1]?.[0] || "N/A",
        topRelic3: topRelicsArray[2]?.[0] || "N/A",
      };
    })
    .sort((a, b) => Number(b.winRate) - Number(a.winRate));

  const headers = [
    "character",
    "ascension",
    "totalRuns",
    "wins",
    "winRate",
    "avgDeckSize",
    "avgRelicCount",
    "topCard1",
    "topCard2",
    "topCard3",
    "topRelic1",
    "topRelic2",
    "topRelic3",
  ];

  return toCsv(report, headers);
}

/**
 * Generate Ascension Impact report with friendly names
 */
export function generateAscensionStats(runs: ExtractedRun[]): string {
  const ascensionMap = new Map<number, any>();

  runs.forEach((run) => {
    if (!ascensionMap.has(run.a)) {
      ascensionMap.set(run.a, {
        ascensionLevel: run.a,
        totalRuns: 0,
        wins: 0,
        totalDeckSize: 0,
        totalRelics: 0,
        encounterDeaths: new Map<string, number>(),
      });
    }

    const stats = ascensionMap.get(run.a);
    stats.totalRuns++;
    if (run.w) stats.wins++;
    stats.totalDeckSize += run.sz;
    stats.totalRelics += run.rc;

    // Track deadliest encounter
    if (!run.w && run.encs.length > 0) {
      const lastEnc = run.encs[run.encs.length - 1];
      const encName = getEncounterName(lastEnc.id);
      stats.encounterDeaths.set(encName, (stats.encounterDeaths.get(encName) || 0) + 1);
    }
  });

  const report = Array.from(ascensionMap.values())
    .map((stats) => {
      const dealiestEncArray = (Array.from(stats.encounterDeaths.entries()) as any[]).sort(
        (a: any, b: any) => b[1] - a[1]
      );

      return {
        ascensionLevel: stats.ascensionLevel,
        totalRuns: stats.totalRuns,
        wins: stats.wins,
        winRate: ((stats.wins / stats.totalRuns) * 100).toFixed(1),
        avgDeckSize: (stats.totalDeckSize / stats.totalRuns).toFixed(1),
        avgRelicCount: (stats.totalRelics / stats.totalRuns).toFixed(1),
        deadliestEncounter: dealiestEncArray[0]?.[0] || "N/A",
      };
    })
    .sort((a, b) => a.ascensionLevel - b.ascensionLevel);

  const headers = [
    "ascensionLevel",
    "totalRuns",
    "wins",
    "winRate",
    "avgDeckSize",
    "avgRelicCount",
    "deadliestEncounter",
  ];

  return toCsv(report, headers);
}

/**
 * Generate Turn Economy report with friendly names
 * NOTE: Turn count per encounter not available in compact schema
 */
export function generateTurnEconomy(runs: ExtractedRun[]): string {
  const encounterMap = new Map<string, any>();

  runs.forEach((run) => {
    run.encs.forEach((enc) => {
      const key = enc.id;
      if (!encounterMap.has(key)) {
        encounterMap.set(key, {
          encounterId: enc.id,
          encounterName: getEncounterName(enc.id),
          totalFights: 0,
          winCount: 0,
          lossCount: 0,
          totalDamage: 0,
        });
      }

      const stats = encounterMap.get(key);
      stats.totalFights++;
      stats.totalDamage += enc.d;

      if (enc.s) {
        stats.winCount++;
      } else {
        stats.lossCount++;
      }
    });
  });

  const report = Array.from(encounterMap.values())
    .map((stats) => ({
      encounter: stats.encounterName,
      totalFights: stats.totalFights,
      wins: stats.winCount,
      losses: stats.lossCount,
      winRate: ((stats.winCount / stats.totalFights) * 100).toFixed(1),
      avgDamagePerFight: (stats.totalDamage / stats.totalFights).toFixed(2),
    }))
    .sort((a, b) => Number(b.winRate) - Number(a.winRate));

  const headers = [
    "encounter",
    "totalFights",
    "wins",
    "losses",
    "winRate",
    "avgDamagePerFight",
  ];

  return toCsv(report, headers);
}

/**
 * Generate Card Synergy Pairs report (cards appearing together in wins)
 */
export function generateCardSynergyPairs(runs: ExtractedRun[]): string {
  const winRuns = runs.filter((r) => r.w);
  const pairMap = new Map<string, { count: number; wins: number }>();

  winRuns.forEach((run) => {
    const pickedCardIds = run.cards.filter(c => !STARTER_CARDS.has(c));

    // Generate all pairs
    for (let i = 0; i < pickedCardIds.length; i++) {
      for (let j = i + 1; j < pickedCardIds.length; j++) {
        const card1 = getCardName(pickedCardIds[i]);
        const card2 = getCardName(pickedCardIds[j]);
        const key = [card1, card2].sort().join(" + ");

        if (!pairMap.has(key)) {
          pairMap.set(key, { count: 0, wins: 0 });
        }
        pairMap.get(key)!.wins++;
      }
    }
  });

  // Also count all runs (not just wins) to calculate win rate
  runs.forEach((run) => {
    const pickedCardIds = run.cards.filter(c => !STARTER_CARDS.has(c));

    for (let i = 0; i < pickedCardIds.length; i++) {
      for (let j = i + 1; j < pickedCardIds.length; j++) {
        const card1 = getCardName(pickedCardIds[i]);
        const card2 = getCardName(pickedCardIds[j]);
        const key = [card1, card2].sort().join(" + ");

        if (!pairMap.has(key)) {
          pairMap.set(key, { count: 0, wins: 0 });
        }
        pairMap.get(key)!.count++;
      }
    }
  });

  const report = Array.from(pairMap.entries())
    .filter(([_, stats]) => stats.count >= 3) // Only pairs that appear at least 3 times
    .map(([pair, stats]) => ({
      cardPair: pair,
      coOccurrences: stats.count,
      winsTogether: stats.wins,
      winRate: ((stats.wins / stats.count) * 100).toFixed(1),
    }))
    .sort((a, b) => Number(b.winRate) - Number(a.winRate))
    .slice(0, 50); // Top 50 synergies

  const headers = ["cardPair", "coOccurrences", "winsTogether", "winRate"];
  return toCsv(report, headers);
}

/**
 * Generate Relic Synergy Pairs report
 */
export function generateRelicSynergyPairs(runs: ExtractedRun[]): string {
  const winRuns = runs.filter((r) => r.w);
  const pairMap = new Map<string, { count: number; wins: number }>();

  winRuns.forEach((run) => {
    const relicIds = run.relics.filter(rid => !STARTER_RELICS.has(rid));

    // Generate all pairs
    for (let i = 0; i < relicIds.length; i++) {
      for (let j = i + 1; j < relicIds.length; j++) {
        const relic1 = getRelicName(relicIds[i]);
        const relic2 = getRelicName(relicIds[j]);
        const key = [relic1, relic2].sort().join(" + ");

        if (!pairMap.has(key)) {
          pairMap.set(key, { count: 0, wins: 0 });
        }
        pairMap.get(key)!.wins++;
      }
    }
  });

  // Count all runs
  runs.forEach((run) => {
    const relicIds = run.relics.filter(rid => !STARTER_RELICS.has(rid));

    for (let i = 0; i < relicIds.length; i++) {
      for (let j = i + 1; j < relicIds.length; j++) {
        const relic1 = getRelicName(relicIds[i]);
        const relic2 = getRelicName(relicIds[j]);
        const key = [relic1, relic2].sort().join(" + ");

        if (!pairMap.has(key)) {
          pairMap.set(key, { count: 0, wins: 0 });
        }
        pairMap.get(key)!.count++;
      }
    }
  });

  const report = Array.from(pairMap.entries())
    .filter(([_, stats]) => stats.count >= 2)
    .map(([pair, stats]) => ({
      relicPair: pair,
      coOccurrences: stats.count,
      winsTogether: stats.wins,
      winRate: ((stats.wins / stats.count) * 100).toFixed(1),
    }))
    .sort((a, b) => Number(b.winRate) - Number(a.winRate))
    .slice(0, 50);

  const headers = ["relicPair", "coOccurrences", "winsTogether", "winRate"];
  return toCsv(report, headers);
}

/**
 * Generate Character vs Ascension win rate heatmap data
 */
export function generateCharacterAscensionHeatmap(runs: ExtractedRun[]): string {
  const heatmapMap = new Map<string, { runs: number; wins: number }>();

  runs.forEach((run) => {
    const key = `${getCharacterName(run.c)}|${run.a}`;
    if (!heatmapMap.has(key)) {
      heatmapMap.set(key, { runs: 0, wins: 0 });
    }
    const stats = heatmapMap.get(key)!;
    stats.runs++;
    if (run.w) stats.wins++;
  });

  const report = Array.from(heatmapMap.entries())
    .map(([key, stats]) => {
      const [character, ascension] = key.split("|");
      return {
        character,
        ascension,
        runs: stats.runs,
        wins: stats.wins,
        winRate: ((stats.wins / stats.runs) * 100).toFixed(1),
      };
    })
    .sort((a, b) => {
      const asc = Number(a.ascension) - Number(b.ascension);
      if (asc !== 0) return asc;
      return a.character.localeCompare(b.character);
    });

  const headers = ["character", "ascension", "runs", "wins", "winRate"];
  return toCsv(report, headers);
}

/**
 * Generate Encounter progression by Act
 */
export function generateEncounterByAct(runs: ExtractedRun[]): string {
  const actEncounterMap = new Map<string, { encountered: number; survived: number }>();

  runs.forEach((run) => {
    run.encs.forEach((enc) => {
      const key = `Act ${enc.a}|${getEncounterName(enc.id)}`;
      if (!actEncounterMap.has(key)) {
        actEncounterMap.set(key, { encountered: 0, survived: 0 });
      }
      const stats = actEncounterMap.get(key)!;
      stats.encountered++;
      if (enc.s) stats.survived++;
    });
  });

  const report = Array.from(actEncounterMap.entries())
    .map(([key, stats]) => {
      const [act, encounter] = key.split("|");
      return {
        act,
        encounter,
        encountered: stats.encountered,
        survived: stats.survived,
        survivalRate: ((stats.survived / stats.encountered) * 100).toFixed(1),
      };
    })
    .sort((a, b) => {
      const actA = Number(a.act.replace("Act ", ""));
      const actB = Number(b.act.replace("Act ", ""));
      if (actA !== actB) return actA - actB;
      return Number(b.survivalRate) - Number(a.survivalRate);
    });

  const headers = ["act", "encounter", "encountered", "survived", "survivalRate"];
  return toCsv(report, headers);
}

/**
 * Generate suggested deck size targets per ascension
 */
export function generateDeckSizeTargets(runs: ExtractedRun[]): string {
  const ascensionMap = new Map<number, { totalSize: number; winningSize: number; winCount: number; runCount: number }>();

  runs.forEach((run) => {
    if (!ascensionMap.has(run.a)) {
      ascensionMap.set(run.a, { totalSize: 0, winningSize: 0, winCount: 0, runCount: 0 });
    }
    const stats = ascensionMap.get(run.a)!;
    stats.totalSize += run.sz;
    stats.runCount++;
    if (run.w) {
      stats.winningSize += run.sz;
      stats.winCount++;
    }
  });

  const report = Array.from(ascensionMap.entries())
    .map(([asc, stats]) => ({
      ascensionLevel: asc,
      avgDeckSize: (stats.totalSize / stats.runCount).toFixed(1),
      avgWinningDeckSize: stats.winCount > 0 ? (stats.winningSize / stats.winCount).toFixed(1) : "N/A",
      totalRuns: stats.runCount,
      wins: stats.winCount,
      recommendation: stats.winCount > 0 ? `Aim for ~${Math.round(stats.winningSize / stats.winCount)} cards` : "Insufficient data",
    }))
    .sort((a, b) => a.ascensionLevel - b.ascensionLevel);

  const headers = ["ascensionLevel", "avgDeckSize", "avgWinningDeckSize", "totalRuns", "wins", "recommendation"];
  return toCsv(report, headers);
}

/**
 * Generate ELO rankings report (per character × ascension leaderboard)
 */
export function generateELORankings(eloState: ELOState): string {
  const records = flattenELOState(eloState);

  const rows = records.map((r) => ({
    character: getCharacterName(r.character),
    ascension: r.ascension,
    card: getCardName(r.cardId),
    cardId: r.cardId,
    eloRating: r.rating.toFixed(1),
    peakRating: r.peakRating.toFixed(1),
    gamesPlayed: r.gamesPlayed,
    wins: r.wins,
    losses: r.gamesPlayed - r.wins,
    winRate: r.gamesPlayed > 0
      ? ((r.wins / r.gamesPlayed) * 100).toFixed(1)
      : "0.0",
  }));

  const headers = [
    "character",
    "ascension",
    "card",
    "cardId",
    "eloRating",
    "peakRating",
    "gamesPlayed",
    "wins",
    "losses",
    "winRate",
  ];

  return toCsv(rows, headers);
}

/**
 * Generate all CSV reports
 */
export function generateAllReports(runs: ExtractedRun[], eloState?: ELOState) {
  ensureOutputDir();

  console.log("Generating reports...");

  const reports = [
    { name: "cards.csv", fn: () => generateCardAnalytics(runs) },
    { name: "encounters.csv", fn: () => generateEncounterAnalytics(runs) },
    { name: "relics.csv", fn: () => generateRelicAnalytics(runs) },
    { name: "potions.csv", fn: () => generatePotionAnalytics(runs) },
    { name: "builds.csv", fn: () => generateBuildArchetypes(runs) },
    { name: "ascension.csv", fn: () => generateAscensionStats(runs) },
    { name: "turnEconomy.csv", fn: () => generateTurnEconomy(runs) },
    { name: "cardSynergies.csv", fn: () => generateCardSynergyPairs(runs) },
    { name: "relicSynergies.csv", fn: () => generateRelicSynergyPairs(runs) },
    { name: "characterAscensionHeatmap.csv", fn: () => generateCharacterAscensionHeatmap(runs) },
    { name: "encountersByAct.csv", fn: () => generateEncounterByAct(runs) },
    { name: "deckSizeTargets.csv", fn: () => generateDeckSizeTargets(runs) },
  ];

  for (const report of reports) {
    const csv = report.fn();
    const filepath = path.join(OUTPUT_PATH, report.name);
    fs.writeFileSync(filepath, csv);
    console.log(`✓ Generated ${report.name}`);
  }

  if (eloState) {
    const csv = generateELORankings(eloState);
    fs.writeFileSync(path.join(OUTPUT_PATH, "elo_rankings.csv"), csv);
    console.log("✓ Generated elo_rankings.csv");
  }
}

// Main execution
if (require.main === module) {
  try {
    const data = fs.readFileSync(
      path.join(__dirname, "../../output/extracted_runs.json"),
      "utf-8"
    );
    const runs = JSON.parse(data) as ExtractedRun[];
    generateAllReports(runs);
    console.log("\n✓ All reports generated");
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}
