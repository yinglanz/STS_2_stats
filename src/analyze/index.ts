/**
 * Main orchestrator - runs complete data analysis pipeline
 * 
 * Usage: npx ts-node src/analyze/index.ts
 */

import { loadAllRuns, extractAllRuns, calculateGlobalStats } from "./extractRunData";
import { generateAllReports } from "./reports";
import { generateDashboardHtml } from "./generateDashboard_v2";
import { calculateELOFromRuns } from "./eloCalculator";
import { calculateRelicELOFromRuns } from "./relicEloCalculator";
import { generateFloorAnalytics } from "./floorAnalytics";
import { generateAncientAnalytics } from "./ancientAnalytics";
import { openDb, insertAllRuns, getRunCount } from "./database";
import fs from "fs";
import path from "path";

async function runPipeline() {
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║       STS2 Run Data Analysis Pipeline                      ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  try {
    // Phase 1: Extract run data
    console.log("📊 PHASE 1: Data Extraction & Normalization");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    const rawRuns = loadAllRuns();
    console.log(`✓ Loaded ${rawRuns.length} run files\n`);

    const extractedRuns = extractAllRuns(rawRuns);
    console.log(`✓ Extracted ${extractedRuns.length} runs\n`);

    const globalStats = calculateGlobalStats(extractedRuns);
    console.log("Global Statistics:");
    console.log(`  • Total Runs: ${globalStats.totalRuns}`);
    console.log(`  • Wins: ${globalStats.totalWins} (${globalStats.overallWinRate.toFixed(1)}%)`);
    console.log(`  • Losses: ${globalStats.totalLosses}`);
    console.log(`  • Avg Deck Size: ${globalStats.avgDeckSize.toFixed(1)}`);
    console.log(`  • Avg Relics: ${globalStats.avgRelicCount.toFixed(1)}`);
    console.log("\nCharacter Win Rates:");
    for (const [char, stat] of Object.entries(globalStats.characterStats)) {
      console.log(
        `  • ${char}: ${stat.winRate.toFixed(1)}% (${stat.wins}/${stat.runs})`
      );
    }
    console.log("\nAscension Win Rates:");
    for (const [asc, stat] of Object.entries(globalStats.ascensionStats)) {
      console.log(
        `  • Ascension ${asc}: ${stat.winRate.toFixed(1)}% (${stat.wins}/${stat.runs})`
      );
    }

    // Save extracted data
    const outputPath = path.join(__dirname, "../../output");
    if (!fs.existsSync(outputPath)) {
      fs.mkdirSync(outputPath, { recursive: true });
    }

    // Save to SQLite database
    const db = openDb();
    const newRunsInserted = insertAllRuns(db, extractedRuns);
    const totalInDb = getRunCount(db);
    db.close();
    console.log(`✓ Saved to SQLite DB: ${newRunsInserted} new runs inserted (${totalInDb} total in DB)`);
    console.log(`  Location: output/runs.db\n`);

    // Also keep JSON for dashboard compatibility
    fs.writeFileSync(
      path.join(outputPath, "extracted_runs.json"),
      JSON.stringify(extractedRuns, null, 2)
    );
    console.log(`✓ Saved extracted data to output/extracted_runs.json\n`);

    // Phase 2: Calculate ELO ratings
    console.log("\n🏆 PHASE 2: ELO Rating Calculation");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    const eloState = calculateELOFromRuns(extractedRuns);
    const eloOutputPath = path.join(outputPath, "elo_ratings.json");
    fs.writeFileSync(eloOutputPath, JSON.stringify(eloState, null, 2));
    const totalEloCards = Object.values(eloState).reduce(
      (sum: number, charMap) =>
        sum +
        Object.values(charMap as Record<string, unknown>).reduce(
          (s: number, ascMap) => s + Object.keys(ascMap as Record<string, unknown>).length,
          0
        ),
      0
    );
    console.log(`✓ Rated ${totalEloCards} card×character×ascension entries`);
    console.log(`✓ Saved ELO ratings to output/elo_ratings.json\n`);

    // Relic ELO
    const relicEloState = calculateRelicELOFromRuns(extractedRuns);
    const relicEloPath = path.join(outputPath, "relic_elo_ratings.json");
    fs.writeFileSync(relicEloPath, JSON.stringify(relicEloState, null, 2));
    const totalEloRelics = Object.values(relicEloState).reduce(
      (sum: number, charMap) => sum + Object.keys(charMap as Record<string, unknown>).length, 0
    );
    console.log(`✓ Rated ${totalEloRelics} relic×character entries`);
    console.log(`✓ Saved relic ELO ratings to output/relic_elo_ratings.json\n`);

    // Floor analytics
    const floorStats = generateFloorAnalytics(rawRuns);
    fs.writeFileSync(path.join(outputPath, "floor_analytics.json"), JSON.stringify(floorStats, null, 2));
    console.log(`✓ Generated floor analytics: ${floorStats.length} rows\n`);

    // Ancient (Neow) blessing analytics
    const ancientStats = generateAncientAnalytics(rawRuns);
    fs.writeFileSync(path.join(outputPath, "ancient_analytics.json"), JSON.stringify(ancientStats, null, 2));
    console.log(`✓ Generated ancient analytics: ${ancientStats.length} blessings\n`);

    // Phase 3: Generate CSV reports
    console.log("\n📈 PHASE 3: CSV Report Generation");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    generateAllReports(extractedRuns, eloState);
    console.log("✓ All CSV reports generated in output/reports/\n");

    // Phase 4: Generate Dashboard
    console.log("\n🎨 PHASE 4: Dashboard Generation");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    const dashboardPath = generateDashboardHtml();
    console.log(`✓ Interactive dashboard generated\n`);
    console.log(`📂 Location: ${dashboardPath}`);
    console.log(`🌐 Open in browser: file:///${dashboardPath.replace(/\\\\/g, "/")}\n`);

    // Summary
    console.log("\n╔════════════════════════════════════════════════════════════╗");
    console.log("║                   ✨ Pipeline Complete! ✨                ║");
    console.log("╚════════════════════════════════════════════════════════════╝\n");

    console.log("📁 Output Files:");
    console.log(`  • CSV Reports: output/reports/`);
    console.log(`    - cards.csv              (Card analytics & pick rates)`);
    console.log(`    - encounters.csv         (Encounter survival rates)`);
    console.log(`    - relics.csv             (Relic analytics)`);
    console.log(`    - builds.csv             (Build archetypes)`);
    console.log(`    - ascension.csv          (Ascension difficulty)`);
    console.log(`    - turnEconomy.csv        (Turn efficiency metrics)`);
    console.log(`  • Dashboard: output/dashboard.html (Interactive visualizations)`);
    console.log(`  • Data: output/extracted_runs.json (Normalized run data)`);

    console.log("\n🎯 Next Steps:");
    console.log(`  1. Open output/dashboard.html in your browser`);
    console.log(`  2. Use filters to explore by ascension/character`);
    console.log(`  3. Navigate tabs to analyze different metrics`);
    console.log(`  4. Export CSV files to Excel for deeper analysis`);

    console.log("\n");
  } catch (error) {
    console.error("\n❌ Error during pipeline execution:");
    console.error(error);
    process.exit(1);
  }
}

// Run pipeline
runPipeline();
