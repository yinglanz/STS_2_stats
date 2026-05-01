/**
 * Enhanced interactive HTML dashboard with improved filtering and new visualizations
 */

import fs from "fs";
import path from "path";
import { ExtractedRun } from "./types";

const OUTPUT_PATH = path.join(__dirname, "../../output");
const REPORTS_PATH = path.join(OUTPUT_PATH, "reports");

interface DashboardData {
  globalStats: any;
  cards: any[];
  encounters: any[];
  relics: any[];
  builds: any[];
  ascension: any[];
  turnEconomy?: any[];
  cardSynergies: any[];
  relicSynergies: any[];
  charAscHeatmap: any[];
  encountersByAct: any[];
  deckTargets: any[];
  runs: ExtractedRun[];
  eloState: any;
  relicEloState: any;
  floorStats: any[];
  ancientStats: any[];
}

/**
 * Parse CSV file
 */
function parseCsv(filepath: string): any[] {
  const content = fs.readFileSync(filepath, "utf-8");
  const lines = content.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0]
    .split(",")
    .map((h) => h.replace(/^"|"$/g, "").trim());

  const rows = lines.slice(1).map((line) => {
    const values: any = {};
    let current = "";
    let inQuotes = false;
    let colIndex = 0;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        values[headers[colIndex]] = parseValue(current.trim());
        current = "";
        colIndex++;
      } else {
        current += char;
      }
    }
    if (current) values[headers[colIndex]] = parseValue(current.trim());

    return values;
  });

  return rows;
}

/**
 * Parse CSV value
 */
function parseValue(val: string): any {
  if (val.startsWith('"') && val.endsWith('"')) {
    return val.slice(1, -1);
  }
  if (val === "true") return true;
  if (val === "false") return false;
  if (val === "" || val === "N/A" || val === "NONE") return null;
  const num = Number(val);
  return isNaN(num) ? val : num;
}

/**
 * Load all dashboard data
 */
function loadDashboardData(): DashboardData {
  const runsPath = path.join(OUTPUT_PATH, "extracted_runs.json");
  const eloPath = path.join(OUTPUT_PATH, "elo_ratings.json");

  if (!fs.existsSync(runsPath)) {
    throw new Error(`Missing ${runsPath} — run "npm run analyze" first`);
  }
  if (!fs.existsSync(eloPath)) {
    throw new Error(`Missing ${eloPath} — run "npm run analyze" first`);
  }

  const extractedRuns = JSON.parse(
    fs.readFileSync(runsPath, "utf-8")
  ) as ExtractedRun[];

  const n = extractedRuns.length;
  const wins = extractedRuns.filter((r) => r.w).length;
  const globalStats = {
    totalRuns: n,
    totalWins: wins,
    overallWinRate: n > 0 ? (wins / n) * 100 : 0,
    avgDeckSize: n > 0 ? extractedRuns.reduce((sum, r) => sum + (r.sz ?? 0), 0) / n : 0,
    avgRelicCount: n > 0 ? extractedRuns.reduce((sum, r) => sum + (r.rc ?? 0), 0) / n : 0,
  };

  const loadCsv = (name: string) => {
    const p = path.join(REPORTS_PATH, name);
    if (!fs.existsSync(p)) { console.warn(`Missing report: ${name}`); return []; }
    return parseCsv(p);
  };

  return {
    globalStats,
    cards: loadCsv("cards.csv"),
    encounters: loadCsv("encounters.csv"),
    relics: loadCsv("relics.csv"),
    builds: loadCsv("builds.csv"),
    ascension: loadCsv("ascension.csv"),
    cardSynergies: loadCsv("cardSynergies.csv"),
    relicSynergies: loadCsv("relicSynergies.csv"),
    charAscHeatmap: loadCsv("characterAscensionHeatmap.csv"),
    encountersByAct: loadCsv("encountersByAct.csv"),
    deckTargets: loadCsv("deckSizeTargets.csv"),
    runs: extractedRuns,
    eloState: JSON.parse(fs.readFileSync(eloPath, "utf-8")),
    relicEloState: (() => {
      const p = path.join(OUTPUT_PATH, "relic_elo_ratings.json");
      if (!fs.existsSync(p)) { console.warn("Missing relic_elo_ratings.json — run npm run analyze"); return {}; }
      return JSON.parse(fs.readFileSync(p, "utf-8"));
    })(),
    floorStats: (() => {
      const p = path.join(OUTPUT_PATH, "floor_analytics.json");
      if (!fs.existsSync(p)) { console.warn("Missing floor_analytics.json — run npm run analyze"); return []; }
      return JSON.parse(fs.readFileSync(p, "utf-8"));
    })(),
    ancientStats: (() => {
      const p = path.join(OUTPUT_PATH, "ancient_analytics.json");
      if (!fs.existsSync(p)) { console.warn("Missing ancient_analytics.json — run npm run analyze"); return []; }
      return JSON.parse(fs.readFileSync(p, "utf-8"));
    })(),
  };
}

/**
 * Generate enhanced dashboard HTML
 */
function generateDashboard(data: DashboardData): string {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>STS2 Run Analytics Dashboard - Enhanced</title>
    <script src="https://cdn.plot.ly/plotly-latest.min.js"></script>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            background: #0d1117;
            color: #e0e0e0;
            min-height: 100vh;
            padding: 0;
        }

        .container {
            max-width: 1800px;
            margin: 0 auto;
            background: #161b22;
            border-radius: 0;
            box-shadow: none;
            overflow: hidden;
            min-height: 100vh;
        }

        header {
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            color: #e0e0e0;
            padding: 24px 30px;
            text-align: left;
            border-bottom: 2px solid #c9a84c;
            display: flex;
            align-items: center;
            gap: 20px;
        }

        header h1 {
            font-size: 1.6em;
            color: #c9a84c;
            letter-spacing: 0.5px;
        }

        header p {
            font-size: 0.9em;
            color: #888;
        }

        .controls {
            background: #1a1f2b;
            padding: 14px 30px;
            border-bottom: 1px solid #2a2f3a;
        }

        .global-filters {
            display: flex;
            gap: 18px;
            flex-wrap: wrap;
            align-items: center;
            margin-bottom: 0;
        }

        .filter-group {
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .filter-group label {
            font-weight: 600;
            color: #aaa;
            font-size: 13px;
            min-width: 70px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .filter-group select {
            padding: 6px 10px;
            border: 1px solid #3a3f4a;
            border-radius: 4px;
            font-size: 13px;
            background: #0d1117;
            color: #e0e0e0;
            cursor: pointer;
        }

        .filter-group select:focus {
            border-color: #c9a84c;
            outline: none;
        }

        .reset-btn {
            padding: 6px 14px;
            background: #c9a84c;
            color: #0d1117;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-weight: 700;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            transition: background 0.2s;
        }

        .reset-btn:hover {
            background: #e0c065;
        }

        .tab-specific-filters {
            display: none;
            padding: 12px;
            background: #1e2530;
            border-radius: 4px;
            margin-top: 10px;
            border: 1px solid #2a2f3a;
        }

        .tab-specific-filters.active {
            display: block;
        }

        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 12px;
            padding: 16px 30px;
            background: #1a1f2b;
        }

        .stat-card {
            background: #0d1117;
            padding: 14px;
            border-radius: 6px;
            border-left: 3px solid #c9a84c;
            box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
        }

        .stat-card h3 {
            font-size: 10px;
            color: #888;
            text-transform: uppercase;
            font-weight: 600;
            letter-spacing: 1px;
            margin-bottom: 6px;
        }

        .stat-card .value {
            font-size: 22px;
            font-weight: bold;
            color: #c9a84c;
        }

        /* ── Tab Navigation ── */
        .tabs {
            display: flex;
            flex-wrap: wrap;
            background: #0d1117;
            padding: 8px 20px 0;
            gap: 2px;
            border-bottom: 2px solid #2a2f3a;
        }

        .tab-group {
            display: flex;
            align-items: flex-end;
            gap: 2px;
            position: relative;
            margin-right: 8px;
        }

        .tab-group::after {
            content: '';
            display: block;
            width: 1px;
            height: 24px;
            background: #2a2f3a;
            margin: 0 4px;
            align-self: center;
        }

        .tab-group:last-child::after {
            display: none;
        }

        .tab-group-label {
            position: absolute;
            top: -2px;
            left: 4px;
            font-size: 8px;
            text-transform: uppercase;
            letter-spacing: 1.5px;
            color: #555;
            font-weight: 700;
            pointer-events: none;
        }

        .tab-button {
            padding: 10px 14px;
            border: none;
            background: transparent;
            cursor: pointer;
            font-size: 13px;
            font-weight: 600;
            color: #777;
            transition: all 0.2s ease;
            border-bottom: 2px solid transparent;
            margin-bottom: -2px;
            white-space: nowrap;
            border-radius: 6px 6px 0 0;
        }

        .tab-button:hover {
            background: #161b22;
            color: #c9a84c;
        }

        .tab-button.active {
            color: #c9a84c;
            background: #161b22;
            border-bottom-color: #c9a84c;
        }

        .tab-content {
            display: none;
            padding: 24px 30px;
            background: #161b22;
            animation: fadeIn 0.2s ease;
        }

        .tab-content.active {
            display: block;
        }

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(4px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .chart-container {
            background: #1a1f2b;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 24px;
            border: 1px solid #2a2f3a;
        }

        .chart-container h2 {
            font-size: 16px;
            margin-bottom: 12px;
            color: #c9a84c;
            font-weight: 600;
        }

        .chart {
            width: 100%;
            height: 500px;
            position: relative;
        }

        .small-chart {
            height: 400px;
        }

        .table-container {
            overflow-x: auto;
            margin-bottom: 20px;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
        }

        th {
            background: #1a1a2e;
            color: #c9a84c;
            padding: 10px 12px;
            text-align: left;
            font-weight: 600;
            cursor: pointer;
            user-select: none;
            white-space: nowrap;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.3px;
            border-bottom: 2px solid #c9a84c;
        }

        th:hover {
            background: #222540;
        }

        th.sort-asc::after  { content: ' ▲'; font-size: 10px; color: #4db87a; }
        th.sort-desc::after { content: ' ▼'; font-size: 10px; color: #e05252; }

        td {
            padding: 8px 12px;
            border-bottom: 1px solid #2a2f3a;
            color: #ccc;
        }

        tr:hover {
            background: #1e2530;
        }

        tr:nth-child(even) {
            background: rgba(255,255,255,0.02);
        }

        tr:nth-child(even):hover {
            background: #1e2530;
        }

        .note {
            font-size: 12px;
            color: #777;
            margin-bottom: 12px;
            font-style: italic;
        }

        .filter-row {
            display: flex;
            gap: 15px;
            align-items: center;
            flex-wrap: wrap;
            margin-bottom: 12px;
            padding: 10px 14px;
            background: #0d1117;
            border-radius: 4px;
            font-size: 13px;
            border: 1px solid #2a2f3a;
        }

        .filter-row label {
            display: flex;
            align-items: center;
            gap: 6px;
            font-weight: 600;
            color: #aaa;
        }

        .filter-row input[type="number"],
        .filter-row select {
            padding: 4px 8px;
            border: 1px solid #3a3f4a;
            border-radius: 4px;
            font-size: 13px;
            background: #161b22;
            color: #e0e0e0;
        }

        .filter-row input[type="number"]:focus,
        .filter-row select:focus {
            border-color: #c9a84c;
            outline: none;
        }

        footer {
            text-align: center;
            padding: 16px;
            color: #555;
            font-size: 11px;
            border-top: 1px solid #2a2f3a;
            background: #0d1117;
        }

        /* Scrollbar styling */
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: #0d1117; }
        ::-webkit-scrollbar-thumb { background: #3a3f4a; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: #c9a84c; }

        @media (max-width: 768px) {
            header h1 { font-size: 1.3em; }
            .global-filters { flex-direction: column; align-items: flex-start; }
            .stats-grid { grid-template-columns: 1fr; }
            .tabs { padding: 6px 10px 0; }
            .tab-group { flex-wrap: wrap; }
            .chart { height: 350px; }
            .tab-content { padding: 15px; }
            .tab-button { padding: 8px 10px; font-size: 12px; }
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>🎮 STS2 Run Analytics</h1>
            <p>${data.globalStats.totalRuns} runs · ${data.globalStats.totalWins} wins · ${data.globalStats.overallWinRate.toFixed(1)}% win rate</p>
        </header>

        <div class="controls">
            <div class="global-filters">
                <div class="filter-group">
                    <label for="ascensionFilter">Min Ascension:</label>
                    <input type="range" id="ascensionFilter" min="0" max="10" value="0" style="width: 150px;">
                    <span id="ascensionLabel">0+</span>
                </div>
                <div class="filter-group">
                    <label for="characterFilter">Character:</label>
                    <select id="characterFilter">
                        <option value="">All</option>
                    </select>
                </div>
                <div class="filter-group">
                    <label for="outcomeFilter">Outcome:</label>
                    <select id="outcomeFilter">
                        <option value="">All</option>
                        <option value="won">Wins Only</option>
                        <option value="lost">Losses Only</option>
                    </select>
                </div>
                <div class="filter-group">
                    <label for="multiplayerFilter">Mode:</label>
                    <select id="multiplayerFilter">
                        <option value="">All</option>
                        <option value="1">1P (Solo)</option>
                        <option value="2">2P</option>
                        <option value="3">3P</option>
                        <option value="4">4P</option>
                        <option value="multi">Any Multiplayer</option>
                    </select>
                </div>
                <div class="filter-group">
                    <label for="versionFilter">Version:</label>
                    <select id="versionFilter">
                        <option value="">All Versions</option>
                    </select>
                </div>
                <button class="reset-btn" onclick="resetFilters()">Reset Filters</button>
            </div>
            <div id="tabSpecificFilters" class="tab-specific-filters"></div>
        </div>

        <div class="stats-grid">
            <div class="stat-card">
                <h3>Total Runs</h3>
                <div class="value" id="statTotalRuns">-</div>
            </div>
            <div class="stat-card">
                <h3>Win Rate</h3>
                <div class="value" id="statWinRate">-</div>
            </div>
            <div class="stat-card">
                <h3>Avg Deck Size</h3>
                <div class="value" id="statAvgDeck">-</div>
            </div>
            <div class="stat-card">
                <h3>Avg Relics</h3>
                <div class="value" id="statAvgRelics">-</div>
            </div>
        </div>

        <div class="tabs">
            <div class="tab-group">
                <span class="tab-group-label">Run</span>
                <button class="tab-button active" onclick="switchTab('overview')">📊 Overview</button>
                <button class="tab-button" onclick="switchTab('ascension')">📈 Ascension</button>
                <button class="tab-button" onclick="switchTab('runs')">📋 Runs</button>
            </div>
            <div class="tab-group">
                <span class="tab-group-label">Deck</span>
                <button class="tab-button" onclick="switchTab('cards')">🃏 Cards</button>
                <button class="tab-button" onclick="switchTab('relics')">✨ Relics</button>
                <button class="tab-button" onclick="switchTab('potions')">🧪 Potions</button>
                <button class="tab-button" onclick="switchTab('synergies')">🔗 Synergies</button>
            </div>
            <div class="tab-group">
                <span class="tab-group-label">Combat</span>
                <button class="tab-button" onclick="switchTab('encounters')">⚔️ Encounters</button>
                <button class="tab-button" onclick="switchTab('heatmap')">🔥 Heatmap</button>
                <button class="tab-button" onclick="switchTab('builds')">🎭 Builds</button>
            </div>
            <div class="tab-group">
                <span class="tab-group-label">Map</span>
                <button class="tab-button" onclick="switchTab('floors')">🗺️ Floors</button>
                <button class="tab-button" onclick="switchTab('ancients')">🌟 Ancients</button>
            </div>
            <div class="tab-group">
                <span class="tab-group-label">Analysis</span>
                <button class="tab-button" onclick="switchTab('elo')">🏆 ELO</button>
            </div>
            <div class="tab-group">
                <span class="tab-group-label"></span>
                <button class="tab-button" onclick="switchTab('export')">📥 Export</button>
                <button class="tab-button" onclick="switchTab('help')">❓ Help</button>
            </div>
        </div>

        <div id="overview" class="tab-content active">
            <div class="chart-container">
                <h2>Win Rate by Ascension Level</h2>
                <div class="chart" id="chartAscensionWins"></div>
            </div>
            <div class="chart-container">
                <h2>Win Rate by Character</h2>
                <div class="chart" id="chartCharacterWins"></div>
            </div>
            <div class="chart-container">
                <h2>Deck Size Targets by Ascension</h2>
                <p class="note">📌 Recommended deck size based on winning runs</p>
                <div class="chart" id="chartDeckTargets"></div>
            </div>
        </div>

        <div id="cards" class="tab-content">
            <div id="cardsFilters" class="tab-specific-filters"></div>
            <div class="chart-container">
                <h2>Card Heat Map - Pick Rate vs Win Rate</h2>
                <p class="note">💡 Strong: High pick & win | Trap: High pick, low win | Hidden gems: Low pick, high win</p>
                <div class="filter-row">
                    <label>Min offers: <input type="number" id="cardMinOffers" value="3" min="1" max="50" style="width:60px" oninput="drawCardHeatmap()"></label>
                    <label>Show top: <input type="number" id="cardTopN" value="100" min="10" max="500" style="width:70px" oninput="drawCardHeatmap()"></label>
                </div>
                <div class="chart small-chart" id="chartCardHeatmap"></div>
            </div>
            <div class="chart-container">
                <h2>Top Cards by Pick Rate</h2>
                <div class="filter-row">
                    <label>Show top: <input type="number" id="cardTopNBar" value="15" min="5" max="50" style="width:60px" oninput="drawTopCardsChart()"></label>
                    <label>Sort by: <select id="cardSortBy" onchange="drawTopCardsChart()"><option value="pickRate">Most Picked</option><option value="winRate">Win Rate</option><option value="skips">Most Skipped</option></select></label>
                </div>
                <div class="chart small-chart" id="chartTopCards"></div>
            </div>
            <div class="chart-container">
                <h2>Card Win Rate by Act Picked</h2>
                <p class="note">🎯 How does picking a card in Act 1 vs Act 2 vs Act 3 affect your win rate? Only shows cards picked 3+ times in at least one act.</p>
                <div class="filter-row">
                    <label>Show top: <input type="number" id="actCardTopN" value="20" min="5" max="100" style="width:60px" oninput="drawActCardWinRate()"></label>
                    <label>Sort by: <select id="actCardSort" onchange="drawActCardWinRate()"><option value="diff">Biggest Act Difference</option><option value="overall">Overall Win Rate</option><option value="name">Name</option></select></label>
                </div>
                <div class="chart" id="chartActCardWinRate"></div>
            </div>
            <div class="chart-container">
                <h2>Card Win Rate by Act — Data Table</h2>
                <div class="table-container">
                    <table id="tableActCardWinRate"></table>
                </div>
            </div>
        </div>

        <div id="encounters" class="tab-content">
            <div id="encountersFilters" class="tab-specific-filters"></div>
            <div class="chart-container">
                <h2>Encounter Survival Rates (by Deadliness)</h2>
                <div class="filter-row">
                    <label>Type: <select id="encTypeFilter" onchange="drawEncounterSurvivalChart()"><option value="">All</option><option value="boss">Boss</option><option value="elite">Elite</option><option value="monster">Monster</option></select></label>
                    <label>Show top: <input type="number" id="encTopN" value="15" min="5" max="100" style="width:60px" oninput="drawEncounterSurvivalChart()"></label>
                </div>
                <div class="chart small-chart" id="chartEncounterSurvival"></div>
            </div>
            <div class="chart-container">
                <h2>Encounters That End Runs</h2>
                <p class="note">⚠️ Top encounter killers</p>
                <div class="table-container">
                    <table id="tableEndingEncounters"></table>
                </div>
            </div>
            <div class="chart-container">
                <h2>Encounter Difficulty by Act</h2>
                <div class="table-container">
                    <table id="tableEncountersByAct"></table>
                </div>
            </div>
        </div>

        <div id="relics" class="tab-content">
            <div id="relicsFilters" class="tab-specific-filters"></div>
            <div class="chart-container">
                <h2>Relic Tier List (by Pick Rate)</h2>
                <div class="filter-row">
                    <label>Min picks: <input type="number" id="relicMinPicks" value="2" min="1" max="30" style="width:60px" oninput="drawRelicTierChart()"></label>
                    <label>Show top: <input type="number" id="relicTopN" value="20" min="5" max="50" style="width:60px" oninput="drawRelicTierChart()"></label>
                </div>
                <div class="chart small-chart" id="chartRelicTier"></div>
            </div>
            <div class="chart-container">
                <h2>Top Relics by Win Rate</h2>
                <div class="filter-row">
                    <label>Min picks: <input type="number" id="relicWinMinPicks" value="2" min="1" max="30" style="width:60px" oninput="drawRelicWinRateChart()"></label>
                    <label>Show top: <input type="number" id="relicWinTopN" value="15" min="5" max="50" style="width:60px" oninput="drawRelicWinRateChart()"></label>
                </div>
                <div class="chart small-chart" id="chartRelicWinRate"></div>
            </div>
            <div class="chart-container">
                <h2>Relic ELO Ratings</h2>
                <p class="note">🏆 Relic strength rankings based on ELO. Bubble size = games played. Aggregated across all ascensions per character. Min 3 games required.</p>
                <div class="chart small-chart" id="chartRelicEloScatter"></div>
            </div>
            <div class="chart-container">
                <h2>Relic ELO Table</h2>
                <div class="table-container">
                    <table id="tableRelicElo"></table>
                </div>
            </div>
        </div>

        <div id="synergies" class="tab-content">
            <div id="synergiesFilters" class="tab-specific-filters"></div>
            <div class="chart-container">
                <h2>🃏 Card Synergy Map</h2>
                <p class="note">Bubble size = co-occurrences, color = win rate. Hover for details.</p>
                <div class="chart small-chart" id="chartCardSynergies"></div>
            </div>
            <div class="chart-container">
                <h2>🃏 Top Card Synergies</h2>
                <p class="note">Strong card pairs that work well together</p>
                <div class="table-container">
                    <table id="tableCardSynergies"></table>
                </div>
            </div>
            <div class="chart-container">
                <h2>✨ Top Relic Synergies</h2>
                <p class="note">Relic combinations that support winning runs</p>
                <div class="table-container">
                    <table id="tableRelicSynergies"></table>
                </div>
            </div>
        </div>

        <div id="heatmap" class="tab-content">
            <div id="heatmapFilters" class="tab-specific-filters"></div>
            <div class="chart-container">
                <h2>Character × Ascension Win Rate Heatmap</h2>
                <p class="note">🟢 Green = high win rate, 🔴 Red = low win rate. Hover for details.</p>
                <div class="chart" id="chartCharAscHeatmap"></div>
            </div>
            <div class="chart-container">
                <h2>Win Rate Data</h2>
                <div class="table-container">
                    <table id="tableCharAscHeatmap"></table>
                </div>
            </div>
        </div>

        <div id="builds" class="tab-content">
            <div id="buildsFilters" class="tab-specific-filters"></div>
            <div class="chart-container">
                <h2>Most Common Cards by Character</h2>
                <p class="note">🎭 Top 10 most frequently picked cards per character (excluding starters)</p>
                <div class="chart" id="chartBuilds"></div>
            </div>
            <div class="chart-container">
                <h2>Build Archetypes - Top Cards &amp; Relics per Character</h2>
                <div class="table-container">
                    <table id="tableBuilds"></table>
                </div>
            </div>
        </div>

        <div id="ascension" class="tab-content">
            <div id="ascensionFilters" class="tab-specific-filters"></div>
            <div class="chart-container">
                <h2>Ascension Difficulty Curve</h2>
                <div class="chart small-chart" id="chartAscensionCurve"></div>
            </div>
            <div class="chart-container">
                <h2>Ascension Statistics</h2>
                <div class="table-container">
                    <table id="tableAscension"></table>
                </div>
            </div>
        </div>

        <div id="runs" class="tab-content">
            <div class="chart-container">
                <h2>Overall Win Rate Over Time</h2>
                <p class="note">📉 All methods: Raw cumulative, Bayesian (Beta-Binomial), Kalman (fixed σ=0.1), Kalman (MLE σ). Shaded = 95% CI.</p>
                <div class="chart" id="chartRunsOverall"></div>
            </div>
            <div class="chart-container">
                <h2>Per-Character Win Rate (Kalman MLE)</h2>
                <p class="note">📊 Individual character Kalman-filtered trajectories with 95% confidence bands</p>
                <div class="chart" id="chartRunsCharacter"></div>
            </div>
            <div class="chart-container">
                <h2>Win Rate Analysis Data</h2>
                <p class="note">📋 Full run-by-run breakdown with all estimators. Click column headers to sort.</p>
                <div class="table-container">
                    <table id="tableRunsWinrate"></table>
                </div>
            </div>
            <div class="chart-container">
                <h2>Raw Cumulative Win Rate</h2>
                <p class="note">📊 Simple running total win rate across all runs chronologically</p>
                <div class="chart small-chart" id="chartCumulativeWinRate"></div>
            </div>
        </div>

        <div id="floors" class="tab-content">
            <div id="floorsFilters" class="tab-specific-filters"></div>
            <div class="chart-container">
                <h2>Floor Statistics by Type, Act &amp; Position</h2>
                <p class="note">Each row = a unique (Floor Type × Act Name × Act Index × Version) combination. Respects character filter above. Min 2 runs required.</p>
                <div class="filter-row" style="flex-wrap:wrap;gap:8px;margin-bottom:12px;">
                    <label>Floor Type: <select id="floorTypeFilter" onchange="drawFloorTable()">
                        <option value="">All</option>
                        <option value="Weak">Weak</option>
                        <option value="Normal">Normal</option>
                        <option value="Elite">Elite</option>
                        <option value="Boss">Boss</option>
                        <option value="Event">Event</option>
                        <option value="Rest">Rest</option>
                        <option value="Shop">Shop</option>
                        <option value="Treasure">Treasure</option>
                        <option value="Ancient">Ancient</option>
                    </select></label>
                    <label>Act Index: <select id="floorActFilter" onchange="drawFloorTable()">
                        <option value="">All</option>
                        <option value="1">Act 1</option>
                        <option value="2">Act 2</option>
                        <option value="3">Act 3</option>
                    </select></label>
                    <label>Act Name: <select id="floorActNameFilter" onchange="drawFloorTable()"><option value="">All</option></select></label>
                    <label>Version: <select id="floorVersionFilter" onchange="drawFloorTable()"><option value="">All</option></select></label>
                    <label>Min Runs: <input type="number" id="floorMinRuns" value="2" min="1" max="20" style="width:60px" oninput="drawFloorTable()"></label>
                </div>
                <div class="table-container">
                    <table id="tableFloors"></table>
                </div>
            </div>
        </div>

        <div id="ancients" class="tab-content">
            <div class="chart-container">
                <h2>Ancient (Neow) Blessing Analytics</h2>
                <p class="note">✨ All Neow blessings offered at the start of a run. ELO rated by run outcomes. Pick% = chosen when offered. Win% = win rate when that blessing was taken.</p>
                <div class="filter-row" style="flex-wrap:wrap;gap:8px;margin-bottom:12px;">
                    <label>Act: <select id="ancientActFilter" onchange="drawAncientTable()">
                        <option value="">All Acts</option>
                        <option value="1">Act 1 (Neow)</option>
                        <option value="2">Act 2</option>
                        <option value="3">Act 3</option>
                    </select></label>
                    <label>Ancient: <select id="ancientNameFilter" onchange="drawAncientTable()"><option value="">All</option></select></label>
                    <label>Min picks: <input type="number" id="ancientMinPicks" value="3" min="1" max="20" style="width:60px" oninput="drawAncientTable()"></label>
                </div>
                <div class="table-container">
                    <table id="tableAncients"></table>
                </div>
            </div>
        </div>

        <div id="export" class="tab-content">
            <div class="chart-container">
                <h2>📥 Export Filtered Runs as CSV</h2>
                <p class="note">Download your filtered run data (based on current filters above)</p>
                <button class="reset-btn" onclick="exportFilteredRunsToCSV()" style="padding: 12px 24px; font-size: 16px; margin-bottom: 20px;">⬇️ Download CSV</button>
                <div class="table-container">
                    <table id="tableExport"></table>
                </div>
            </div>
        </div>

        <div id="potions" class="tab-content">
            <div class="chart-container">
                <h2>Potion Pick Rate vs Usage</h2>
                <p class="note">🧪 How often potions are picked when offered, and how often picked potions get used</p>
                <div class="chart small-chart" id="chartPotions"></div>
            </div>
            <div class="chart-container">
                <h2>Potion Usage Statistics</h2>
                <div class="table-container">
                    <table id="tablePotions"></table>
                </div>
            </div>
        </div>

        <div id="elo" class="tab-content">
            <div class="chart-container">
                <h2>ELO Rating vs Win Rate</h2>
                <p class="note">📊 Bubble size = games played. Dashed line = 50% win rate. Cards bottom-right are strong but unlucky; top-left are weak but lucky.</p>
                <div class="chart small-chart" id="chartEloScatter"></div>
            </div>
            <div class="chart-container">
                <h2>ELO Card Ratings with Per-Act Win Rates</h2>
                <p class="note">🏆 Win% columns show how often runs were won when this card was first picked in that act. Min 3 ELO games required. Act columns require ≥2 picks.</p>
                <div class="table-container">
                    <table id="tableElo"></table>
                </div>
            </div>
        </div>

        <div id="help" class="tab-content">
            <div style="max-width: 900px; margin: 0 auto; line-height: 1.8;">
                <h2>📖 Dashboard Help &amp; Definitions</h2>

                <h3 style="border-bottom: 2px solid #c9a84c; padding-bottom: 10px; margin-top: 30px;">📊 Global Filters</h3>
                <p><strong>Character:</strong> Filter runs by the character you played (Ironclad, Silent, Defect, Necrobinder, Regent).</p>
                <p><strong>Min Ascension:</strong> Show only runs at this ascension level or higher (0–10). "5+" shows all Asc 5–10 combined.</p>
                <p><strong>Outcome:</strong> Filter by Wins, Losses, or All runs.</p>
                <p><strong>Mode:</strong> Filter by player count — 1P (solo), 2P, 3P, 4P, or All.</p>

                <h3 style="border-bottom: 2px solid #c9a84c; padding-bottom: 10px; margin-top: 30px;">🗂️ Tab Groups</h3>
                <table style="width:100%;border-collapse:collapse;margin-bottom:8px;">
                  <tr style="color:#c9a84c;"><th style="text-align:left;padding:4px 8px;">Group</th><th style="text-align:left;padding:4px 8px;">Tabs</th><th style="text-align:left;padding:4px 8px;">Purpose</th></tr>
                  <tr><td style="padding:4px 8px;">Run</td><td style="padding:4px 8px;">Overview · Ascension · Runs</td><td style="padding:4px 8px;">Run-level summaries and history</td></tr>
                  <tr><td style="padding:4px 8px;">Deck</td><td style="padding:4px 8px;">Cards · Relics · Potions · Synergies</td><td style="padding:4px 8px;">What you drafted and how it performed</td></tr>
                  <tr><td style="padding:4px 8px;">Combat</td><td style="padding:4px 8px;">Encounters · Heatmap · Builds</td><td style="padding:4px 8px;">Fight outcomes, pick patterns, archetypes</td></tr>
                  <tr><td style="padding:4px 8px;">Map</td><td style="padding:4px 8px;">Floors · Ancients</td><td style="padding:4px 8px;">Per-floor stats and act-start blessings</td></tr>
                  <tr><td style="padding:4px 8px;">Analysis</td><td style="padding:4px 8px;">ELO</td><td style="padding:4px 8px;">Card strength rankings by character</td></tr>
                </table>

                <h3 style="border-bottom: 2px solid #c9a84c; padding-bottom: 10px; margin-top: 30px;">📊 Overview</h3>
                <p>Win rate by ascension level and character. Deck size targets based on winning runs.</p>

                <h3 style="border-bottom: 2px solid #c9a84c; padding-bottom: 10px; margin-top: 30px;">📈 Ascension</h3>
                <p><strong>Difficulty Curve:</strong> Win rate as ascension increases — shows which levels are hardest.</p>
                <p><strong>Per-Ascension Table:</strong> Runs, wins, avg deck size, avg relics, and deadliest encounter per level.</p>

                <h3 style="border-bottom: 2px solid #c9a84c; padding-bottom: 10px; margin-top: 30px;">📋 Runs</h3>
                <p>Individual run history table. Shows date, character, ascension, outcome, deck size, relics, damage taken, and allies (multiplayer).</p>
                <p>Includes a cumulative win-rate trend chart with Kalman-smoothed line.</p>
                <p><strong>Allies:</strong> In multiplayer runs, shows the characters your teammates played.</p>

                <h3 style="border-bottom: 2px solid #c9a84c; padding-bottom: 10px; margin-top: 30px;">🃏 Cards</h3>
                <p><strong>Pick Rate:</strong> How often this card appeared in your final deck (%).</p>
                <p><strong>Skip Rate:</strong> How often you were offered this card but didn't take it.</p>
                <p><strong>Win %:</strong> Win rate of runs where you ended up with this card.</p>
                <p><strong>Deck %:</strong> Average share of your final deck this card represented.</p>
                <p><strong>Per-Act Win %:</strong> Win rate when the card was first picked in Act 1, 2, or 3.</p>
                <p><strong>Starter cards</strong> (Strike, Defend, character starters), Curses, and Status cards are excluded.</p>

                <h3 style="border-bottom: 2px solid #c9a84c; padding-bottom: 10px; margin-top: 30px;">✨ Relics</h3>
                <p><strong>Pick Rate:</strong> How often this relic appeared in your final loadout.</p>
                <p><strong>Win %:</strong> Win rate of runs where you had this relic.</p>
                <p><strong>ELO:</strong> Relic strength estimate, rated vs a 1500 baseline by run outcomes.</p>
                <p><strong>Starting relics</strong> (Burning Blood, Ring of the Snake, Cracked Core, Bound Phylactery, Divine Right) are excluded.</p>

                <h3 style="border-bottom: 2px solid #c9a84c; padding-bottom: 10px; margin-top: 30px;">🧪 Potions</h3>
                <p><strong>Offered / Picked / Used / Discarded:</strong> Lifecycle counts per potion type across all runs.</p>
                <p>Shows which potions you find most useful (high used/picked ratio).</p>

                <h3 style="border-bottom: 2px solid #c9a84c; padding-bottom: 10px; margin-top: 30px;">🔗 Synergies</h3>
                <p>Card and relic pairs that appear together in winning decks. Bubble size = frequency. Look for combos with high win rates and multiple occurrences.</p>

                <h3 style="border-bottom: 2px solid #c9a84c; padding-bottom: 10px; margin-top: 30px;">⚔️ Encounters</h3>
                <p><strong>Survivor Rate:</strong> % of times you defeated this enemy.</p>
                <p><strong>Avg Damage:</strong> Average HP lost per fight against this enemy.</p>
                <p><strong>Times Ended Run:</strong> How many times this enemy was the final fight of a losing run.</p>
                <p><strong>Act Breakdown:</strong> Survival rates split by act (1, 2, 3).</p>

                <h3 style="border-bottom: 2px solid #c9a84c; padding-bottom: 10px; margin-top: 30px;">🔥 Heatmap</h3>
                <p>Card picks per act, visualised as a Character × Ascension heatmap. Color: Red = low win rate → Character color → Green = high win rate. Numbers show win rate % per cell.</p>

                <h3 style="border-bottom: 2px solid #c9a84c; padding-bottom: 10px; margin-top: 30px;">🎭 Builds</h3>
                <p>Build archetypes grouped by character × ascension. Shows the most common cards and relics in winning runs at each difficulty.</p>

                <h3 style="border-bottom: 2px solid #c9a84c; padding-bottom: 10px; margin-top: 30px;">🗺️ Floors</h3>
                <p>Per-floor statistics aggregated by Floor Type × Act Name × Act Index × Version.</p>
                <p><strong>Floor Types:</strong> Weak (easy fight), Normal (standard fight), Elite, Boss, Event, Rest, Shop, Treasure, Ancient.</p>
                <p><strong>Act:</strong> The act name (Overgrowth, Underdocks, Hive, Glory…) — useful for comparing acts across different versions.</p>
                <p><strong>Act Index:</strong> Position in the run (1 = first act, 2 = second, 3 = third).</p>
                <p><strong>Death%:</strong> % of runs that ended on this floor. Color: Red ≥ 10%, Gold ≥ 3%.</p>

                <h3 style="border-bottom: 2px solid #c9a84c; padding-bottom: 10px; margin-top: 30px;">🌟 Ancients</h3>
                <p>Blessings offered by ancients at the start of each act (Neow in Act 1, act-specific ancients in Acts 2 &amp; 3).</p>
                <p><strong>ELO:</strong> Blessing strength rated by run outcomes. Only updates when the blessing was chosen.</p>
                <p><strong>Pick%:</strong> How often you chose this blessing when it was offered.</p>
                <p><strong>Win%:</strong> Win rate of runs where you took this blessing.</p>
                <p>Filter by Act (1/2/3) or by specific ancient to compare blessings within a pool.</p>

                <h3 style="border-bottom: 2px solid #c9a84c; padding-bottom: 10px; margin-top: 30px;">🏆 ELO</h3>
                <p>Card ELO ratings by character. Dynamic K-factor (48 → 32 → 24 over time), ascension-scaled, and damage-weighted result scoring.</p>
                <p><strong>Peak ELO:</strong> Highest rating ever reached — indicates upside even if recent form has dropped.</p>
                <p><strong>Act Win%:</strong> Win rate specifically when this card was first picked in Act 1, 2, or 3.</p>
                <p><strong>Skipped:</strong> How many times this card was offered but not taken (red highlight = frequently skipped).</p>

                <h3 style="border-bottom: 2px solid #c9a84c; padding-bottom: 10px; margin-top: 30px;">❓ Multiplayer</h3>
                <p>2P/3P/4P runs include allies. The Allies column in Runs shows which characters your teammates played. All stats reflect only your own character's performance.</p>

                <h3 style="border-bottom: 2px solid #c9a84c; padding-bottom: 10px; margin-top: 30px;">💡 Tips</h3>
                <ul style="margin-left: 20px;">
                  <li>Click any table column header to sort; click again to reverse.</li>
                  <li>Use Min Ascension slider to see aggregated stats across a difficulty range (e.g. Asc 5+).</li>
                  <li>ELO stabilises with more data — cross-check with Win% and Pick Rate for newer cards.</li>
                  <li>Floors tab + Act filter is useful for comparing how dangerous Act 2 is vs Act 3 at the same floor type.</li>
                  <li>Ancients tab Act filter lets you compare blessing quality across the three ancient pools independently.</li>
                </ul>
            </div>
        </div>

        <footer>
            Generated on ${new Date().toLocaleString()} | STS2 Analytics v2.0 (Enhanced)
        </footer>
    </div>

    <script>
        // Friendly name mapping
        const nameMapper = {
            getCardName: (id) => {
                return id.replace('CARD.', '').split('_').map(part => 
                    part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
                ).join(' ');
            },
            getCharacterName: (id) => {
                return id.replace('CHARACTER.', '').split('_').map(part =>
                    part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
                ).join('');
            },
            getRelicName: (id) => {
                return id.replace('RELIC.', '').split('_').map(part =>
                    part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
                ).join(' ');
            },
            getEncounterName: (id) => {
                return id.replace('ENCOUNTER.', '')
                    .replace(/_(NORMAL|WEAK|ELITE|BOSS)$/i, '')
                    .split('_').map(part =>
                        part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
                    ).join(' ');
            },
            getPotionName: (id) => {
                return id.replace('POTION.', '').split('_').map(part =>
                    part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
                ).join(' ');
            }
        };

        // Starter relics (excluded from analysis like starter cards)
        const STARTER_RELICS = new Set([
            'RELIC.BURNING_BLOOD',      // Ironclad
            'RELIC.RING_OF_THE_SNAKE',  // Silent
            'RELIC.CRACKED_CORE',       // Defect
            'RELIC.BOUND_PHYLACTERY',   // Necrobinder
            'RELIC.DIVINE_RIGHT'        // Regent
        ]);

        // Starter cards (excluded from builds analysis - not player choices)
        const STARTER_CARDS = new Set([
            'CARD.STRIKE_IRONCLAD', 'CARD.DEFEND_IRONCLAD', 'CARD.BASH',
            'CARD.STRIKE_SILENT',   'CARD.DEFEND_SILENT',   'CARD.NEUTRALIZE',  'CARD.SURVIVOR',
            'CARD.STRIKE_DEFECT',   'CARD.DEFEND_DEFECT',   'CARD.ZAP',
            'CARD.STRIKE_NECROBINDER', 'CARD.DEFEND_NECROBINDER',
            'CARD.STRIKE_REGENT',   'CARD.DEFEND_REGENT',
            'CARD.STRIKE',          'CARD.DEFEND'
        ]);

        // Global data
        const DATA = ${JSON.stringify(data)};
        let filteredRuns = [...DATA.runs];
        let currentTab = 'overview';

        // Generic sortable table utility — call after setting innerHTML on any table
        function makeSortable(tableId) {
            const table = document.getElementById(tableId);
            if (!table) return;
            const headers = table.querySelectorAll('tr:first-child th');
            headers.forEach((th, colIndex) => {
                th._sortDir = null;
                th.addEventListener('click', () => {
                    const dir = th._sortDir === 'asc' ? 'desc' : 'asc';
                    headers.forEach(h => { h.classList.remove('sort-asc', 'sort-desc'); h._sortDir = null; });
                    th._sortDir = dir;
                    th.classList.add(dir === 'asc' ? 'sort-asc' : 'sort-desc');
                    // Collect all data rows (skip header row)
                    const rows = Array.from(table.querySelectorAll('tr')).slice(1);
                    rows.sort((a, b) => {
                        const aCell = a.cells[colIndex];
                        const bCell = b.cells[colIndex];
                        const aRaw = aCell?.dataset.sort ?? (aCell ? aCell.textContent : '');
                        const bRaw = bCell?.dataset.sort ?? (bCell ? bCell.textContent : '');
                        const aText = aRaw.trim().replace(/%$/, '');
                        const bText = bRaw.trim().replace(/%$/, '');
                        const aNum = parseFloat(aText);
                        const bNum = parseFloat(bText);
                        const isNum = !isNaN(aNum) && !isNaN(bNum);
                        const cmp = isNum ? aNum - bNum : aText.localeCompare(bText);
                        return dir === 'asc' ? cmp : -cmp;
                    });
                    rows.forEach(r => table.appendChild(r));
                });
            });
        }

        // ── Reusable dark theme layout ──
        const DARK = {
            plot_bgcolor: '#1a1a2e', paper_bgcolor: '#16213e',
            font: { color: '#e0e0e0', family: 'Segoe UI, sans-serif' },
            xaxis: { gridcolor: '#2a2a4a', zerolinecolor: '#2a2a4a', tickfont: { color: '#aaa' }, titlefont: { color: '#c9a84c' } },
            yaxis: { gridcolor: '#2a2a4a', zerolinecolor: '#2a2a4a', tickfont: { color: '#aaa' }, titlefont: { color: '#c9a84c' } },
            legend: { font: { color: '#ccc' }, bgcolor: 'rgba(0,0,0,0)' },
            hoverlabel: { bgcolor: '#1a1a2e', bordercolor: '#c9a84c', font: { color: '#e0e0e0' } }
        };
        function darkLayout(extra) { return Object.assign({}, DARK, extra); }

        // Safe Plotly wrapper — skips if element doesn't exist in current DOM
        function safePlot(id, traces, layout, config) {
            const el = document.getElementById(id);
            if (!el) { console.warn('safePlot: element not found:', id); return; }
            try { Plotly.newPlot(el, traces, layout, config || { responsive: true }); }
            catch (e) { console.error('Plotly error for', id, e); }
        }

        // Resize all visible Plotly charts when window resizes
        let _resizeTimer;
        window.addEventListener('resize', function() {
            clearTimeout(_resizeTimer);
            _resizeTimer = setTimeout(function() {
                document.querySelectorAll('.js-plotly-plot').forEach(function(el) {
                    try { Plotly.Plots.resize(el); } catch(e) {}
                });
            }, 150);
        });

        // Initialize immediately (script is at end of body, so DOM is ready)
        console.log('Initializing dashboard...', DATA.runs.length, 'runs loaded');
        populateFilters();
        updateDashboard();
        console.log('Dashboard initialized');

        // Add filter listeners
        document.getElementById('ascensionFilter')?.addEventListener('input', applyFilters);
        document.getElementById('characterFilter')?.addEventListener('change', applyFilters);
        document.getElementById('outcomeFilter')?.addEventListener('change', applyFilters);
        document.getElementById('multiplayerFilter')?.addEventListener('change', applyFilters);

        function resetFilters() {
            document.getElementById('ascensionFilter').value = '0';
            document.getElementById('characterFilter').value = '';
            document.getElementById('outcomeFilter').value = '';
            document.getElementById('multiplayerFilter').value = '';
            document.getElementById('versionFilter').value  = '';
            applyFilters();
        }

        function populateFilters() {
            try {
                console.log('Populating filters...');
                const ascensions = new Set(DATA.runs.map(r => r.a));
                const characters = new Set(DATA.runs.map(r => nameMapper.getCharacterName(r.c)));
                const versions = new Set(DATA.runs.map(r => r.v).filter(Boolean));

                console.log('Ascension slider initialized (0-10 range)');

                const chr = document.getElementById('characterFilter');
                if (!chr) { console.error('characterFilter element not found'); return; }
                
                Array.from(characters).sort().forEach(c => {
                    const opt = document.createElement('option');
                    opt.value = c;
                    opt.textContent = c;
                    chr.appendChild(opt);
                });
                console.log('Populated characters:', Array.from(characters).length);

                const ver = document.getElementById('versionFilter');
                if (ver) {
                    Array.from(versions).sort().reverse().forEach(v => {
                        const opt = document.createElement('option');
                        opt.value = v;
                        opt.textContent = v;
                        ver.appendChild(opt);
                    });
                    console.log('Populated versions:', Array.from(versions).length);
                }
            } catch (e) {
                console.error('Error populating filters:', e);
            }
        }

        function applyFilters() {
            try {
                const ascension = parseInt(document.getElementById('ascensionFilter')?.value || '0');
                const character = document.getElementById('characterFilter')?.value;
                const outcome = document.getElementById('outcomeFilter')?.value;
                const multiplayer = document.getElementById('multiplayerFilter')?.value;
                const version = document.getElementById('versionFilter')?.value;

                document.getElementById('ascensionLabel').textContent = ascension + '+';

                filteredRuns = DATA.runs.filter(r => {
                    if (r.a < ascension) return false;
                    const charName = nameMapper.getCharacterName(r.c);
                    if (character && charName !== character) return false;
                    if (outcome === 'won' && !r.w) return false;
                    if (outcome === 'lost' && r.w) return false;
                    if (multiplayer === '1' && r.m !== 1) return false;
                    if (multiplayer === '2' && r.m !== 2) return false;
                    if (multiplayer === '3' && r.m !== 3) return false;
                    if (multiplayer === '4' && r.m !== 4) return false;
                    if (multiplayer === 'multi' && r.m === 1) return false;
                    if (version && r.v !== version) return false;
                    return true;
                });

                console.log('Filtered to', filteredRuns.length, 'runs');
                updateDashboard();
            } catch (e) {
                console.error('Error applying filters:', e);
            }
        }

        function updateStats() {
            const wins = filteredRuns.filter(r => r.w).length;
            const avgDeck = filteredRuns.reduce((sum, r) => sum + r.sz, 0) / filteredRuns.length;
            const avgRelics = filteredRuns.reduce((sum, r) => sum + r.rc, 0) / filteredRuns.length;

            document.getElementById('statTotalRuns').textContent = filteredRuns.length;
            document.getElementById('statWinRate').textContent = filteredRuns.length > 0 ? ((wins / filteredRuns.length) * 100).toFixed(1) + '%' : '-';
            document.getElementById('statAvgDeck').textContent = filteredRuns.length > 0 ? avgDeck.toFixed(1) : '-';
            document.getElementById('statAvgRelics').textContent = filteredRuns.length > 0 ? avgRelics.toFixed(1) : '-';
        }

        function updateDashboard() {
            try {
                updateStats();
            } catch (e) {
                console.error('Error updating stats:', e);
            }
            
            try {
                if (currentTab === 'overview') {
                    drawAscensionWinsChart();
                    drawCharacterWinsChart();
                    drawDeckTargetsChart();
                } else if (currentTab === 'cards') {
                    drawCardHeatmap();
                    drawTopCardsChart();
                    drawActCardWinRate();
                } else if (currentTab === 'encounters') {
                    drawEncounterSurvivalChart();
                    drawEndingEncountersTable();
                    drawEncountersByActTable();
                } else if (currentTab === 'relics') {
                    drawRelicTierChart();
                    drawRelicWinRateChart();
                    drawRelicEloScatter();
                    drawRelicEloTable();
                } else if (currentTab === 'synergies') {
                    drawCardSynergiesTable();
                    drawCardSynergiesChart();
                    drawRelicSynergiesTable();
                } else if (currentTab === 'heatmap') {
                    drawCharAscHeatmapChart();
                    drawCharAscHeatmapTable();
                } else if (currentTab === 'builds') {
                    drawBuildsChart();
                    drawBuildsTable();
                } else if (currentTab === 'floors') {
                    drawFloorTable();
                } else if (currentTab === 'ancients') {
                    drawAncientTable();
                } else if (currentTab === 'ascension') {
                    drawAscensionCurveChart();
                    drawAscensionStatsTable();
                } else if (currentTab === 'runs') {
                    drawRunsTable();
                    drawCumulativeWinRate();
                } else if (currentTab === 'export') {
                    drawExportTable();
                } else if (currentTab === 'potions') {
                    drawPotionsTable();
                    drawPotionsChart();
                } else if (currentTab === 'elo') {
                    drawEloTable();
                    drawEloScatter();
                }
            } catch (e) {
                console.error('Error drawing charts for tab ' + currentTab + ':', e);
            }
        }



        function drawAscensionWinsChart() {
            const byAsc = {};
            filteredRuns.forEach(r => {
                if (!byAsc[r.a]) byAsc[r.a] = { runs: 0, wins: 0 };
                byAsc[r.a].runs++;
                if (r.w) byAsc[r.a].wins++;
            });

            const ascensions = Object.keys(byAsc).sort((a, b) => Number(a) - Number(b));
            const winRates = ascensions.map(a => ((byAsc[a].wins / byAsc[a].runs) * 100).toFixed(1));
            const runCounts = ascensions.map(a => byAsc[a].runs);

            safePlot('chartAscensionWins', [{
                x: ascensions.map(a => 'Asc ' + a),
                y: winRates,
                type: 'bar',
                marker: { color: winRates.map(r => Number(r) >= 50 ? '#4db87a' : Number(r) >= 25 ? '#c9a84c' : '#e05252') },
                text: runCounts.map(n => n + ' runs'),
                hovertemplate: '<b>%{x}</b><br>Win Rate: %{y}%<br>%{text}<extra></extra>'
            }], darkLayout({ margin: { t: 10, b: 40, l: 50, r: 20 }, height: 400, yaxis: { ...DARK.yaxis, title: 'Win Rate (%)' } }), { responsive: true });
        }

        function drawCharacterWinsChart() {
            const CHAR_COLORS_MAP = { Ironclad: '#e05252', Silent: '#4db87a', Regent: '#c9a84c', Necrobinder: '#9b59b6', Defect: '#3498db' };
            const byChar = {};
            filteredRuns.forEach(r => {
                const name = nameMapper.getCharacterName(r.c);
                if (!byChar[name]) byChar[name] = { runs: 0, wins: 0 };
                byChar[name].runs++;
                if (r.w) byChar[name].wins++;
            });

            const chars = Object.keys(byChar).sort();
            const winRates = chars.map(c => ((byChar[c].wins / byChar[c].runs) * 100).toFixed(1));

            safePlot('chartCharacterWins', [{
                x: chars,
                y: winRates,
                type: 'bar',
                marker: { color: chars.map(c => CHAR_COLORS_MAP[c] || '#c9a84c') },
                text: chars.map(c => byChar[c].wins + 'W / ' + byChar[c].runs + ' runs'),
                hovertemplate: '<b>%{x}</b><br>Win Rate: %{y}%<br>%{text}<extra></extra>'
            }], darkLayout({ margin: { t: 10, b: 40, l: 50, r: 20 }, height: 400, yaxis: { ...DARK.yaxis, title: 'Win Rate (%)' } }), { responsive: true });
        }

        function drawDeckTargetsChart() {
            const targets = DATA.deckTargets;
            safePlot('chartDeckTargets', [{
                x: targets.map(t => 'Asc ' + t.ascensionLevel),
                y: targets.map(t => Number(t.avgWinningDeckSize)),
                type: 'bar',
                marker: { color: '#4db87a' },
                text: targets.map(t => t.recommendation),
                hovertemplate: '<b>%{x}</b><br>Avg Winning Deck: %{y:.1f}<br>%{text}<extra></extra>'
            }], darkLayout({ margin: { t: 10, b: 40, l: 50, r: 20 }, height: 400, yaxis: { ...DARK.yaxis, title: 'Avg Deck Size' } }), { responsive: true });
        }

        function drawCardHeatmap() {
            // Use pre-calculated card stats from DATA
            const minOffers = parseInt(document.getElementById('cardMinOffers')?.value || '3');
            const topN = parseInt(document.getElementById('cardTopN')?.value || '100');
            
            const cardData = (DATA.cards || [])
                .filter(c => Number(c.pickedCount) >= minOffers)
                .map(c => ({
                    card: c.card,
                    pickRate: Number(c.pickedCount) || 0,
                    winRate: Number(c.winRateWithCard) || 0,
                    offeredCount: Number(c.pickedCount) || 0
                }))
                .sort((a, b) => b.winRate - a.winRate)
                .slice(0, topN);

            if (cardData.length === 0) {
                document.getElementById('chartCardHeatmap').innerHTML = '<div style="padding: 20px;">No card data available</div>';
                return;
            }

            safePlot('chartCardHeatmap', [{
                x: cardData.map(c => c.pickRate),
                y: cardData.map(c => c.winRate),
                mode: 'markers',
                type: 'scatter',
                text: cardData.map(c => c.card),
                marker: {
                    size: cardData.map(c => Math.max(Math.sqrt(c.offeredCount) * 3, 6)),
                    color: cardData.map(c => c.winRate),
                    colorscale: [[0, '#e05252'], [0.5, '#c9a84c'], [1, '#4db87a']],
                    showscale: true,
                    colorbar: { title: 'Win%', tickfont: { color: '#aaa' }, titlefont: { color: '#c9a84c' } },
                    line: { width: 1, color: 'rgba(255,255,255,0.2)' }
                },
                hovertemplate: '<b>%{text}</b><br>Picks: %{x:.0f}<br>Win Rate: %{y:.1f}%<extra></extra>'
            }], darkLayout({
                xaxis: { ...DARK.xaxis, title: 'Times Picked' },
                yaxis: { ...DARK.yaxis, title: 'Win Rate (%)' },
                margin: { t: 10, b: 50, l: 60, r: 100 },
                height: 500
            }), { responsive: true });
        }

        function drawTopCardsChart() {
            // Recalculate from filtered runs
            const cardMap = new Map();
            filteredRuns.forEach(run => {
                // Track skips
                (run.skippedCards || []).forEach(card => {
                    if (!cardMap.has(card)) cardMap.set(card, { name: nameMapper.getCardName(card), picks: 0, wins: 0, skips: 0 });
                    cardMap.get(card).skips++;
                });
                run.cards.forEach(card => {
                    if (!cardMap.has(card)) {
                        cardMap.set(card, { name: nameMapper.getCardName(card), picks: 0, wins: 0, skips: 0 });
                    }
                    const c = cardMap.get(card);
                    c.picks++;
                    if (run.w) c.wins++;
                });
            });
            
            const topNBar = parseInt(document.getElementById('cardTopNBar')?.value || '15');
            const sortBy = document.getElementById('cardSortBy')?.value || 'pickRate';
            const cardDataFull = Array.from(cardMap.values()).map(c => ({
                card: c.name,
                picks: c.picks,
                skips: c.skips,
                pickRate: c.picks,
                winRate: c.picks > 0 ? (c.wins / c.picks) * 100 : 0
            }));
            const top = cardDataFull
                .sort((a, b) => sortBy === 'winRate' ? b.winRate - a.winRate : sortBy === 'skips' ? b.skips - a.skips : b.pickRate - a.pickRate)
                .slice(0, topNBar);
            const topY = top.map(c => sortBy === 'winRate' ? Number(c.winRate) : sortBy === 'skips' ? c.skips : c.picks);
            const topLabel = sortBy === 'winRate' ? 'Win Rate (%)' : sortBy === 'skips' ? 'Times Skipped' : 'Times Picked';

            safePlot('chartTopCards', [{
                x: top.map(c => c.card),
                y: topY,
                type: 'bar',
                marker: { color: sortBy === 'skips' ? '#e05252' : topY.map(v => v >= 50 ? '#4db87a' : '#c9a84c') },
                hovertemplate: '<b>%{x}</b><br>' + topLabel + ': %{y}<br>' +
                    top.map(c => \`Picks: \${c.picks} | Skips: \${c.skips} | WR: \${c.winRate.toFixed(1)}%\`).map((_, i, arr) => '%{customdata}'),
                customdata: top.map(c => \`Picks: \${c.picks} | Skips: \${c.skips} | WR: \${c.winRate.toFixed(1)}%\`),
                hovertemplate: '<b>%{x}</b><br>%{customdata}<extra></extra>'
            }], darkLayout({ 
                margin: { t: 10, b: 100, l: 50, r: 20 },
                height: 400,
                xaxis: { ...DARK.xaxis, tickangle: -45 },
                yaxis: { ...DARK.yaxis, title: topLabel }
            }), { responsive: true });
        }

        function drawActCardWinRate() {
            const MIN_PICKS = 3;
            const topN = parseInt(document.getElementById('actCardTopN')?.value || '20');
            const sortBy = document.getElementById('actCardSort')?.value || 'diff';

            // Aggregate: card → { act1: {wins, total}, act2: ..., act3: ... }
            const cardActs = new Map();
            filteredRuns.forEach(run => {
                const actFields = [run.a1c || [], run.a2c || [], run.a3c || []];
                actFields.forEach((cards, actIdx) => {
                    cards.forEach(cardId => {
                        if (!cardActs.has(cardId)) cardActs.set(cardId, { name: nameMapper.getCardName(cardId), acts: [{w:0,t:0},{w:0,t:0},{w:0,t:0}] });
                        const entry = cardActs.get(cardId);
                        entry.acts[actIdx].t++;
                        if (run.w) entry.acts[actIdx].w++;
                    });
                });
            });

            // Filter to cards with MIN_PICKS in at least one act
            let rows = Array.from(cardActs.values()).filter(c => c.acts.some(a => a.t >= MIN_PICKS));
            rows.forEach(c => {
                c.wr = c.acts.map(a => a.t > 0 ? (a.w / a.t) * 100 : null);
                c.overall = c.acts.reduce((s, a) => s + a.w, 0) / Math.max(c.acts.reduce((s, a) => s + a.t, 0), 1) * 100;
                const valid = c.wr.filter(v => v !== null);
                c.spread = valid.length > 1 ? Math.max(...valid) - Math.min(...valid) : 0;
            });

            if (sortBy === 'diff') rows.sort((a, b) => b.spread - a.spread);
            else if (sortBy === 'overall') rows.sort((a, b) => b.overall - a.overall);
            else rows.sort((a, b) => a.name.localeCompare(b.name));
            rows = rows.slice(0, topN);

            if (rows.length === 0) {
                document.getElementById('chartActCardWinRate').innerHTML = '<div style="padding:20px;">No per-act card data. Run full pipeline with <code>npm run analyze</code>.</div>';
                document.getElementById('tableActCardWinRate').innerHTML = '';
                return;
            }

            // Grouped bar chart
            const ACT_COLORS = ['#3498db', '#c9a84c', '#e05252'];
            const ACT_NAMES = ['Act 1', 'Act 2', 'Act 3'];
            const traces = ACT_NAMES.map((actName, i) => ({
                x: rows.map(c => c.name),
                y: rows.map(c => c.wr[i] !== null ? c.wr[i] : 0),
                name: actName,
                type: 'bar',
                marker: { color: ACT_COLORS[i] },
                text: rows.map(c => c.wr[i] !== null ? c.wr[i].toFixed(1) + '%' : 'n/a'),
                textposition: 'none',
                hovertemplate: '<b>%{x}</b><br>' + actName + ': %{y:.1f}% (%{customdata} picks)<extra></extra>',
                customdata: rows.map(c => c.acts[i].t),
            }));

            safePlot('chartActCardWinRate', traces, {
                barmode: 'group',
                plot_bgcolor: '#1a1a2e', paper_bgcolor: '#16213e',
                font: { color: '#e0e0e0' },
                xaxis: { tickangle: -45, tickfont: { color: '#aaa' } },
                yaxis: { title: 'Win Rate (%)', range: [0, 100], gridcolor: '#2a2a4a', titlefont: { color: '#c9a84c' }, tickfont: { color: '#aaa' } },
                margin: { t: 20, b: 120, l: 50, r: 20 },
                height: 500,
                legend: { orientation: 'h', y: -0.25, font: { color: '#ccc' } },
                hoverlabel: { bgcolor: '#1a1a2e', bordercolor: '#c9a84c', font: { color: '#e0e0e0' } }
            }, { responsive: true });

            // Data table
            let html = '<tr><th>Card</th><th>Act 1 Win%</th><th>Act 1 Picks</th><th>Act 2 Win%</th><th>Act 2 Picks</th><th>Act 3 Win%</th><th>Act 3 Picks</th><th>Overall Win%</th><th>Act Spread</th></tr>';
            rows.forEach(c => {
                const fmt = (v) => v !== null ? v.toFixed(1) + '%' : '-';
                html += '<tr>'
                    + '<td><strong>' + c.name + '</strong></td>'
                    + '<td>' + fmt(c.wr[0]) + '</td><td>' + c.acts[0].t + '</td>'
                    + '<td>' + fmt(c.wr[1]) + '</td><td>' + c.acts[1].t + '</td>'
                    + '<td>' + fmt(c.wr[2]) + '</td><td>' + c.acts[2].t + '</td>'
                    + '<td>' + c.overall.toFixed(1) + '%</td>'
                    + '<td>' + c.spread.toFixed(1) + '</td>'
                    + '</tr>';
            });
            document.getElementById('tableActCardWinRate').innerHTML = html;
            makeSortable('tableActCardWinRate');
        }

        function drawEncounterSurvivalChart() {
            // Recalculate from filtered runs
            const encMap = new Map();
            filteredRuns.forEach(run => {
                run.encs.forEach(enc => {
                    if (!encMap.has(enc.id)) {
                        encMap.set(enc.id, { id: enc.id, name: nameMapper.getEncounterName(enc.id), survived: 0, total: 0 });
                    }
                    const e = encMap.get(enc.id);
                    e.total++;
                    if (enc.s) e.survived++;
                });
            });
            
            const encTypeFilter = document.getElementById('encTypeFilter')?.value || '';
            const encTopN = parseInt(document.getElementById('encTopN')?.value || '15');
            const getEncType = (id) => id.endsWith('_BOSS') ? 'boss' : id.endsWith('_ELITE') ? 'elite' : 'monster';
            const sorted = Array.from(encMap.values())
                .filter(e => !encTypeFilter || getEncType(e.id) === encTypeFilter)
                .map(e => ({ encounter: e.name, survivalRate: (e.survived / e.total) * 100 }))
                .sort((a, b) => Number(a.survivalRate) - Number(b.survivalRate))
                .slice(0, encTopN);
            
            if (sorted.length === 0) {
                safePlot('chartEncounterSurvival', [], { title: 'No encounters in filtered data' });
                return;
            }

            safePlot('chartEncounterSurvival', [{
                x: sorted.map(e => e.encounter),
                y: sorted.map(e => Number(e.survivalRate)),
                type: 'bar',
                marker: { color: sorted.map(e => Number(e.survivalRate) < 50 ? '#e05252' : Number(e.survivalRate) < 75 ? '#c9a84c' : '#4db87a') },
                hovertemplate: '<b>%{x}</b><br>Survival: %{y:.1f}%<extra></extra>'
            }], darkLayout({
                margin: { t: 10, b: 120, l: 50, r: 20 },
                height: 400,
                xaxis: { ...DARK.xaxis, tickangle: -45 },
                yaxis: { ...DARK.yaxis, title: 'Survival Rate (%)' }
            }), { responsive: true });
        }

        function drawEndingEncountersTable() {
            // Recalculate from filtered runs - track all encounters, find ones that ended runs
            const encMap = new Map();
            filteredRuns.forEach(run => {
                run.encs.forEach(enc => {
                    if (!encMap.has(enc.id)) {
                        const type = enc.tp === 3 ? 'Boss' : enc.tp === 2 ? 'Elite' : 'Monster';
                        encMap.set(enc.id, { name: nameMapper.getEncounterName(enc.id), type, kills: 0, total: 0 });
                    }
                    const e = encMap.get(enc.id);
                    e.total++;
                    if (!enc.s) e.kills++;
                });
            });
            
            const endingEncs = Array.from(encMap.values())
                .filter(e => e.kills > 0)
                .map(e => ({
                    encounter: e.name,
                    type: e.type,
                    timesEndedRun: e.kills,
                    totalFought: e.total,
                    survivalRate: ((e.total - e.kills) / e.total) * 100
                }))
                .sort((a, b) => b.timesEndedRun - a.timesEndedRun)
                .slice(0, 15);

            const typeColors = { Boss: '#e05252', Elite: '#c9a84c', Monster: '#aaa' };
            let html = '<tr><th>Encounter</th><th>Type</th><th>Times Ended Run</th><th>Fought</th><th>Survival Rate</th></tr>';
            endingEncs.forEach(e => {
                const tc = typeColors[e.type] || '#aaa';
                html += \`<tr>
                    <td><strong>\${e.encounter}</strong></td>
                    <td><span style="color: \${tc}; font-weight: 600;">\${e.type}</span></td>
                    <td><strong style="color: #e05252;">\${e.timesEndedRun}</strong></td>
                    <td>\${e.totalFought}</td>
                    <td>\${Number(e.survivalRate).toFixed(1)}%</td>
                </tr>\`;
            });
            document.getElementById('tableEndingEncounters').innerHTML = html || '<tr><td colspan="5">No data</td></tr>';
            makeSortable('tableEndingEncounters');
        }

        function drawEncountersByActTable() {
            // Recalculate from filtered runs
            const byAct = {};
            filteredRuns.forEach(run => {
                run.encs.forEach(e => {
                    const key = 'Act ' + e.a;
                    if (!byAct[key]) byAct[key] = {};
                    const encName = e.id;
                    if (!byAct[key][encName]) {
                        byAct[key][encName] = { act: key, encounter: nameMapper.getEncounterName(encName), encountered: 0, survived: 0, survivalRate: 0 };
                    }
                    byAct[key][encName].encountered++;
                    if (e.s) byAct[key][encName].survived++;
                });
            });
            
            // Flatten structure
            const encsByAct = [];
            Object.keys(byAct).forEach(act => {
                Object.values(byAct[act]).forEach((e) => {
                    e.survivalRate = (e.survived / e.encountered) * 100;
                    encsByAct.push(e);
                });
            });

            let html = '<tr><th>Act</th><th>Encounter</th><th>Fought</th><th>Survived</th><th>Survival Rate</th></tr>';
            encsByAct.forEach(e => {
                html += \`<tr>
                    <td><strong>\${e.act}</strong></td>
                    <td>\${e.encounter}</td>
                    <td>\${e.encountered}</td>
                    <td>\${e.survived}</td>
                    <td><strong>\${Number(e.survivalRate).toFixed(1)}%</strong></td>
                </tr>\`;
            });
            document.getElementById('tableEncountersByAct').innerHTML = html || '<tr><td colspan="5">No data</td></tr>';
            makeSortable('tableEncountersByAct');
        }

        function drawRelicTierChart() {
            // Use pre-calculated relic stats from DATA
            const relicMinPicks = parseInt(document.getElementById('relicMinPicks')?.value || '2');
            const relicTopN = parseInt(document.getElementById('relicTopN')?.value || '20');
            
            const relics = (DATA.relics || [])
                .filter(r => !STARTER_RELICS.has(r.relic))  // Exclude starter relics
                .filter(r => Number(r.pickedCount) >= relicMinPicks)
                .map(r => ({
                    relic: r.relic,
                    pickCount: Number(r.pickedCount) || 0
                }))
                .sort((a, b) => b.pickCount - a.pickCount)
                .slice(0, relicTopN);

            if (relics.length === 0) {
                document.getElementById('chartRelicTier').innerHTML = '<div style="padding: 20px;">No relic data available</div>';
                return;
            }

            safePlot('chartRelicTier', [{
                x: relics.map(r => r.relic),
                y: relics.map(r => r.pickCount),
                type: 'bar',
                marker: { color: '#c9a84c' },
                hovertemplate: '<b>%{x}</b><br>Picks: %{y}<extra></extra>'
            }], darkLayout({
                margin: { t: 10, b: 120, l: 50, r: 20 },
                height: 400,
                xaxis: { ...DARK.xaxis, tickangle: -45 },
                yaxis: { ...DARK.yaxis, title: 'Times Picked' }
            }), { responsive: true });
        }

        function drawRelicWinRateChart() {
            // Use pre-calculated relic stats from DATA
            const relicWinMinPicks = parseInt(document.getElementById('relicWinMinPicks')?.value || '2');
            const relicWinTopN = parseInt(document.getElementById('relicWinTopN')?.value || '15');
            
            const top = (DATA.relics || [])
                .filter(r => !STARTER_RELICS.has(r.relic))  // Exclude starter relics
                .filter(r => Number(r.pickedCount) >= relicWinMinPicks)
                .map(r => ({
                    relic: r.relic,
                    winRate: Number(r.winRateWithRelic) || 0
                }))
                .sort((a, b) => b.winRate - a.winRate)
                .slice(0, relicWinTopN);

            if (top.length === 0) {
                document.getElementById('chartRelicWinRate').innerHTML = '<div style="padding: 20px;">No relic data available</div>';
                return;
            }

            safePlot('chartRelicWinRate', [{
                x: top.map(r => r.relic),
                y: top.map(r => r.winRate),
                type: 'bar',
                marker: { color: top.map(r => r.winRate >= 50 ? '#4db87a' : '#c9a84c') },
                hovertemplate: '<b>%{x}</b><br>Win Rate: %{y:.1f}%<extra></extra>'
            }], darkLayout({
                margin: { t: 10, b: 120, l: 50, r: 20 },
                height: 400,
                xaxis: { ...DARK.xaxis, tickangle: -45 },
                yaxis: { ...DARK.yaxis, title: 'Win Rate (%)' }
            }), { responsive: true });
        }

        function drawRelicEloScatter() {
            const relicEloState = DATA.relicEloState;
            if (!relicEloState || !Object.keys(relicEloState).length) return;
            const character = document.getElementById('characterFilter')?.value;
            const CHAR_COLORS_R = { Ironclad: '#e05252', Silent: '#4db87a', Regent: '#c9a84c', Necrobinder: '#9b59b6', Defect: '#3498db' };

            const byChar = {};
            for (const char of Object.keys(relicEloState)) {
                const cName = nameMapper.getCharacterName(char);
                if (character && cName !== character) continue;
                for (const [relicId, rec] of Object.entries(relicEloState[char])) {
                    const r = rec;
                    if (r.gamesPlayed < 3) continue;
                    if (!byChar[cName]) byChar[cName] = [];
                    byChar[cName].push({
                        name: nameMapper.getRelicName(relicId),
                        rating: r.rating,
                        winRate: (r.wins / r.gamesPlayed) * 100,
                        games: r.gamesPlayed
                    });
                }
            }

            const allPoints = [].concat(...Object.values(byChar));
            if (allPoints.length === 0) return;
            const rMin = Math.min(...allPoints.map(c => c.rating));
            const rMax = Math.max(...allPoints.map(c => c.rating));

            const traces = [{
                x: [rMin, rMax], y: [50, 50], mode: 'lines', type: 'scatter',
                name: '50% win rate', showlegend: true,
                line: { color: 'rgba(201,168,76,0.4)', width: 1, dash: 'dash' },
                hoverinfo: 'skip'
            }];

            Object.keys(byChar).sort().forEach(cName => {
                traces.push({
                    x: byChar[cName].map(c => c.rating),
                    y: byChar[cName].map(c => c.winRate),
                    mode: 'markers', type: 'scatter', name: cName,
                    text: byChar[cName].map(c => \`<b>\${c.name}</b> (\${cName})<br>ELO: \${c.rating.toFixed(0)}<br>Win Rate: \${c.winRate.toFixed(1)}%<br>Games: \${c.games}\`),
                    hovertemplate: '%{text}<extra></extra>',
                    marker: {
                        size: byChar[cName].map(c => Math.max(Math.sqrt(c.games) * 3, 6)),
                        color: CHAR_COLORS_R[cName] || '#888', opacity: 0.75,
                        line: { width: 1, color: 'rgba(255,255,255,0.2)' }
                    }
                });
            });

            safePlot('chartRelicEloScatter', traces, darkLayout({
                xaxis: { ...DARK.xaxis, title: 'ELO Rating' },
                yaxis: { ...DARK.yaxis, title: 'Win Rate (%)' },
                margin: { t: 10, b: 50, l: 60, r: 20 }, height: 420,
                legend: { ...DARK.legend, orientation: 'h', y: -0.15 }, hovermode: 'closest'
            }), { responsive: true });
        }

        function drawRelicEloTable() {
            const relicEloState = DATA.relicEloState;
            if (!relicEloState || !Object.keys(relicEloState).length) {
                document.getElementById('tableRelicElo').innerHTML = '<tr><td colspan="6">No relic ELO data — run npm run analyze</td></tr>';
                return;
            }
            const character = document.getElementById('characterFilter')?.value;

            const records = [];
            for (const char of Object.keys(relicEloState)) {
                const cName = nameMapper.getCharacterName(char);
                if (character && cName !== character) continue;
                for (const [relicId, rec] of Object.entries(relicEloState[char])) {
                    const r = rec;
                    if (r.gamesPlayed < 3) continue;
                    records.push({
                        relic: nameMapper.getRelicName(relicId),
                        character: cName,
                        rating: r.rating.toFixed(0),
                        peak: r.peakRating.toFixed(0),
                        games: r.gamesPlayed,
                        winRate: ((r.wins / r.gamesPlayed) * 100).toFixed(1)
                    });
                }
            }

            records.sort((a, b) => Number(b.rating) - Number(a.rating));

            const wrColor = v => Number(v) >= 50 ? '#4db87a' : Number(v) >= 30 ? '#c9a84c' : '#e05252';
            let html = '<tr><th>Relic</th><th>Char</th><th>ELO</th><th>Peak</th><th>Games</th><th>Win %</th></tr>';
            records.forEach(r => {
                const ratingColor = Number(r.rating) >= 1500 ? '#4db87a' : Number(r.rating) < 1450 ? '#e05252' : '#c9a84c';
                html += \`<tr>
                    <td><strong>\${r.relic}</strong></td>
                    <td>\${r.character}</td>
                    <td><strong style="color:\${ratingColor}">\${r.rating}</strong></td>
                    <td style="color:#888">\${r.peak}</td>
                    <td>\${r.games}</td>
                    <td><strong style="color:\${wrColor(r.winRate)}">\${r.winRate}%</strong></td>
                </tr>\`;
            });
            document.getElementById('tableRelicElo').innerHTML = html || '<tr><td colspan="6">No relic ELO data (try adjusting filters)</td></tr>';
            makeSortable('tableRelicElo');
        }

        function drawCardSynergiesTable() {
            // Recalculate from filtered runs
            const pairMap = new Map();
            filteredRuns.forEach(run => {
                const pickedCards = run.cards.map(c => nameMapper.getCardName(c));
                for (let i = 0; i < pickedCards.length; i++) {
                    for (let j = i + 1; j < pickedCards.length; j++) {
                        const pair = [pickedCards[i], pickedCards[j]].sort().join(' + ');
                        if (!pairMap.has(pair)) pairMap.set(pair, { pair, count: 0, wins: 0 });
                        const p = pairMap.get(pair);
                        p.count++;
                        if (run.w) p.wins++;
                    }
                }
            });
            const synergies = Array.from(pairMap.values())
                .filter(p => p.count >= 2)
                .map(p => ({ cardPair: p.pair, coOccurrences: p.count, winsTogether: p.wins, winRate: (p.wins / p.count) * 100 }))
                .sort((a, b) => b.winsTogether - a.winsTogether)
                .slice(0, 20);
            let html = '<tr><th>Card Pair</th><th>Co-Occurrences</th><th>Wins Together</th><th>Win Rate</th></tr>';
            synergies.forEach(s => {
                html += \`<tr>
                    <td><strong>\${s.cardPair}</strong></td>
                    <td>\${s.coOccurrences}</td>
                    <td>\${s.winsTogether}</td>
                    <td><strong style="color: #4db87a;">\${Number(s.winRate).toFixed(1)}%</strong></td>
                </tr>\`;
            });
            document.getElementById('tableCardSynergies').innerHTML = html || '<tr><td colspan="4">No synergies found</td></tr>';
            makeSortable('tableCardSynergies');
        }

        function drawRelicSynergiesTable() {
            // Recalculate from filtered runs
            const pairMap = new Map();
            filteredRuns.forEach(run => {
                const pickedRelics = run.relics
                    .filter(r => !STARTER_RELICS.has(r))
                    .map(r => nameMapper.getRelicName(r));
                for (let i = 0; i < pickedRelics.length; i++) {
                    for (let j = i + 1; j < pickedRelics.length; j++) {
                        const pair = [pickedRelics[i], pickedRelics[j]].sort().join(' + ');
                        if (!pairMap.has(pair)) pairMap.set(pair, { pair, count: 0, wins: 0 });
                        const p = pairMap.get(pair);
                        p.count++;
                        if (run.w) p.wins++;
                    }
                }
            });
            const synergies = Array.from(pairMap.values())
                .filter(p => p.count >= 2)
                .map(p => ({ relicPair: p.pair, coOccurrences: p.count, winsTogether: p.wins, winRate: (p.wins / p.count) * 100 }))
                .sort((a, b) => b.winsTogether - a.winsTogether)
                .slice(0, 20);
            let html = '<tr><th>Relic Pair</th><th>Co-Occurrences</th><th>Wins Together</th><th>Win Rate</th></tr>';
            synergies.forEach(s => {
                html += \`<tr>
                    <td><strong>\${s.relicPair}</strong></td>
                    <td>\${s.coOccurrences}</td>
                    <td>\${s.winsTogether}</td>
                    <td><strong style="color: #4db87a;">\${Number(s.winRate).toFixed(1)}%</strong></td>
                </tr>\`;
            });
            document.getElementById('tableRelicSynergies').innerHTML = html || '<tr><td colspan="4">No synergies found</td></tr>';
            makeSortable('tableRelicSynergies');
        }

        function drawCharAscHeatmapTable() {
            // Recalculate from filtered runs
            const pivotData = {};
            filteredRuns.forEach(run => {
                const char = nameMapper.getCharacterName(run.c);
                const asc = run.a;
                if (!pivotData[char]) pivotData[char] = {};
                if (!pivotData[char][asc]) pivotData[char][asc] = { wins: 0, total: 0 };
                pivotData[char][asc].total++;
                if (run.w) pivotData[char][asc].wins++;
            });
            
            // Calculate win rates
            Object.keys(pivotData).forEach(char => {
                Object.keys(pivotData[char]).forEach(asc => {
                    const data = pivotData[char][asc];
                    data.winRate = (data.wins / data.total) * 100;
                });
            });

            const characters = Object.keys(pivotData).sort();
            const ascensions = new Set();
            Object.keys(pivotData).forEach(char => {
                Object.keys(pivotData[char]).forEach(asc => ascensions.add(Number(asc)));
            });
            const ascArray = Array.from(ascensions).sort((a, b) => a - b);

            let html = '<tr><th>Character</th>';
            ascArray.forEach(asc => html += \`<th>Asc \${asc}</th>\`);
            html += '</tr>';

            characters.forEach(char => {
                html += \`<tr><td><strong>\${char}</strong></td>\`;
                ascArray.forEach(asc => {
                    const data = pivotData[char][asc];
                    const rate = data ? data.winRate : undefined;
                    const color = rate !== undefined ? (rate >= 50 ? 'rgba(77,184,122,0.3)' : rate >= 25 ? 'rgba(201,168,76,0.3)' : 'rgba(224,82,82,0.3)') : 'transparent';
                    html += \`<td style="background: \${color}; text-align: center;"><strong>\${rate !== undefined ? rate.toFixed(0) + '%' : '-'}</strong></td>\`;
                });
                html += '</tr>';
            });

            document.getElementById('tableCharAscHeatmap').innerHTML = html || '<tr><td colspan="12">No data</td></tr>';
        }

        function drawBuildsTable() {
            // Recalculate from filtered runs
            const buildMap = new Map();
            filteredRuns.forEach(run => {
                const char = nameMapper.getCharacterName(run.c);
                const key = char + '|' + run.a;
                if (!buildMap.has(key)) buildMap.set(key, { character: char, ascension: run.a, runs: 0, wins: 0, cardCounts: {}, relicCounts: {} });
                const b = buildMap.get(key);
                b.runs++;
                if (run.w) b.wins++;
                run.cards.filter(c => !STARTER_CARDS.has(c)).forEach(c => { const n = nameMapper.getCardName(c); b.cardCounts[n] = (b.cardCounts[n] || 0) + 1; });
                run.relics.filter(r => !STARTER_RELICS.has(r)).forEach(r => { const n = nameMapper.getRelicName(r); b.relicCounts[n] = (b.relicCounts[n] || 0) + 1; });
            });
            const builds = Array.from(buildMap.values())
                .filter(b => b.runs >= 1)
                .map(b => ({
                    character: b.character,
                    ascension: b.ascension,
                    totalRuns: b.runs,
                    winRate: (b.wins / b.runs) * 100,
                    topCards: Object.entries(b.cardCounts).sort((x, y) => y[1] - x[1]).slice(0, 3).map(e => e[0]).join(', '),
                    topRelics: Object.entries(b.relicCounts).sort((x, y) => y[1] - x[1]).slice(0, 3).map(e => e[0]).join(', ')
                }))
                .sort((a, b) => Number(b.winRate) - Number(a.winRate)).slice(0, 30);

            let html = '<tr><th>Character</th><th>Asc</th><th>Runs</th><th>Win Rate</th><th>Top Cards</th><th>Top Relics</th></tr>';
            builds.forEach(b => {
                html += \`<tr>
                    <td><strong>\${b.character}</strong></td>
                    <td>\${b.ascension}</td>
                    <td>\${b.totalRuns}</td>
                    <td><strong style="color: #c9a84c;">\${Number(b.winRate).toFixed(1)}%</strong></td>
                    <td style="font-size: 12px;">\${b.topCards || 'N/A'}</td>
                    <td style="font-size: 12px;">\${b.topRelics || 'N/A'}</td>
                </tr>\`;
            });
            document.getElementById('tableBuilds').innerHTML = html || '<tr><td colspan="6">No data</td></tr>';
            makeSortable('tableBuilds');
        }

        function drawAncientTable() {
            const stats = DATA.ancientStats;
            if (!stats || !stats.length) {
                document.getElementById('tableAncients').innerHTML = '<tr><td colspan="20">No ancient data — run npm run analyze</td></tr>';
                return;
            }

            const character = document.getElementById('characterFilter')?.value;
            const actFilter = document.getElementById('ancientActFilter')?.value || '';
            const ancientFilter = document.getElementById('ancientNameFilter')?.value || '';
            const minPicks = parseInt(document.getElementById('ancientMinPicks')?.value || '3');

            // Populate Ancient dropdown once
            const ancSel = document.getElementById('ancientNameFilter');
            if (ancSel && ancSel.options.length <= 1) {
                const ancients = [...new Set(stats.map(s => s.ancient))].sort();
                ancients.forEach(a => {
                    const opt = document.createElement('option');
                    opt.value = a; opt.textContent = a;
                    ancSel.appendChild(opt);
                });
            }

            // Characters in display order
            const CHARS = ['Ironclad', 'Silent', 'Defect', 'Regent', 'Necrobinder'];

            const wrColor = v => {
                const n = parseInt(v);
                if (isNaN(n)) return '#555';
                return n >= 50 ? '#4db87a' : n >= 30 ? '#c9a84c' : '#e05252';
            };
            const eloColor = v => v >= 1550 ? '#4db87a' : v < 1450 ? '#e05252' : '#c9a84c';

            const visChars = character ? [character] : CHARS;
            let charHeaders = '';
            visChars.forEach(c => { charHeaders += \`<th>\${c} Pick%</th><th>\${c} Win%</th>\`; });

            let html = \`<tr>
                <th>Blessing</th><th>Ancient</th><th>Act</th><th>Versions</th>
                <th>ELO</th><th>Peak ELO</th><th>Offered</th><th>Picked</th>
                <th>Overall Pick%</th><th>Overall Win%</th>
                \${charHeaders}
            </tr>\`;

            const filtered = stats.filter(s => {
                if (actFilter && String(s.act) !== actFilter) return false;
                if (ancientFilter && s.ancient !== ancientFilter) return false;
                if (character) {
                    const cs = s.byChar[character];
                    if (!cs || cs.offered === 0) return false;
                }
                if (s.overallPicked < minPicks) return false;
                return true;
            });

            filtered.forEach(s => {
                const versionStr = s.versionMin === s.versionMax
                    ? s.versionMin
                    : \`\${s.versionMin} – \${s.versionMax}\`;

                let charCells = '';
                visChars.forEach(c => {
                    const cs = s.byChar[c] || { offered: 0, picked: 0, wins: 0 };
                    const pickPct = cs.offered > 0 ? Math.round((cs.picked / cs.offered) * 100) : null;
                    const winPct = cs.picked > 0 ? Math.round((cs.wins / cs.picked) * 100) : null;
                    const pickStr = pickPct !== null ? pickPct + '%' : '<span style="color:#555">—</span>';
                    const winStr = winPct !== null ? \`<strong style="color:\${wrColor(winPct)}">\${winPct}%</strong>\` : '<span style="color:#555">—</span>';
                    charCells += \`<td>\${pickStr}</td><td>\${winStr}</td>\`;
                });

                const overallPickPct = s.overallOffered > 0 ? Math.round((s.overallPicked / s.overallOffered) * 100) : 0;
                const overallWinPct = s.overallPicked > 0 ? Math.round((s.overallWins / s.overallPicked) * 100) : 0;

                html += \`<tr>
                    <td><strong>\${s.displayName}</strong></td>
                    <td style="color:#888">\${s.ancient}</td>
                    <td>\${s.act}</td>
                    <td style="color:#888;font-size:11px">\${versionStr}</td>
                    <td><strong style="color:\${eloColor(s.elo)}">\${s.elo}</strong></td>
                    <td style="color:#888">\${s.peakElo}</td>
                    <td style="color:#888">\${s.overallOffered}</td>
                    <td>\${s.overallPicked}</td>
                    <td>\${overallPickPct}%</td>
                    <td><strong style="color:\${wrColor(overallWinPct)}">\${overallWinPct}%</strong></td>
                    \${charCells}
                </tr>\`;
            });

            document.getElementById('tableAncients').innerHTML = html || '<tr><td colspan="20">No blessings match current filters</td></tr>';
            makeSortable('tableAncients');
        }

        function drawFloorTable() {
            const allStats = DATA.floorStats;
            if (!allStats || !allStats.length) {
                document.getElementById('tableFloors').innerHTML = '<tr><td colspan="13">No floor data — run npm run analyze</td></tr>';
                return;
            }

            const floorTypeFilter = document.getElementById('floorTypeFilter')?.value || '';
            const actIndexFilter  = document.getElementById('floorActFilter')?.value || '';
            const actNameFilter   = document.getElementById('floorActNameFilter')?.value || '';
            const versionFilter   = document.getElementById('floorVersionFilter')?.value || '';
            const minRuns = parseInt(document.getElementById('floorMinRuns')?.value || '2');

            // Populate act-name and version dropdowns once
            const actNameSel = document.getElementById('floorActNameFilter');
            if (actNameSel && actNameSel.options.length <= 1) {
                const names = [...new Set(allStats.map(s => s.actName))].sort();
                names.forEach(n => {
                    const opt = document.createElement('option');
                    opt.value = n; opt.textContent = n;
                    actNameSel.appendChild(opt);
                });
            }
            const versionSel = document.getElementById('floorVersionFilter');
            if (versionSel && versionSel.options.length <= 1) {
                const versions = [...new Set(allStats.map(s => s.version))].sort();
                versions.forEach(v => {
                    const opt = document.createElement('option');
                    opt.value = v; opt.textContent = v;
                    versionSel.appendChild(opt);
                });
            }

            const rows = allStats.filter(s => {
                if (floorTypeFilter && s.floorType !== floorTypeFilter) return false;
                if (actIndexFilter  && String(s.actIndex) !== actIndexFilter)  return false;
                if (actNameFilter   && s.actName !== actNameFilter)   return false;
                if (versionFilter   && s.version !== versionFilter)   return false;
                if (s.runs < minRuns) return false;
                return true;
            });

            const FLOOR_ICONS = {
                Weak: '⚔️', Normal: '⚔️', Elite: '💀', Boss: '🏆',
                Rest: '🔥', Shop: '🛒', Event: '🎲', Treasure: '📦', Ancient: '✨'
            };

            const deathColor = v => Number(v) >= 10 ? '#e05252' : Number(v) >= 3 ? '#c9a84c' : '#4db87a';
            const dmgColor   = v => Number(v) >= 20 ? '#e05252' : Number(v) >= 8 ? '#c9a84c' : '#e0e0e0';

            let html = \`<tr>
                <th>Floor Type</th><th>Act</th><th>Act Index</th><th>Version</th>
                <th>Runs</th><th>Death%</th><th>Avg Damage</th><th>Avg HP Healed</th>
                <th>Avg Max HP Gain</th><th>Avg Max HP Loss</th><th>Avg Gold Gain</th>
                <th>Avg Gold Spent</th><th>Avg Cards Offered</th><th>Avg Relics Offered</th>
            </tr>\`;

            rows.forEach(r => {
                const icon = FLOOR_ICONS[r.floorType] || '❓';
                html += \`<tr>
                    <td>\${icon} \${r.floorType}</td>
                    <td>\${r.actName}</td>
                    <td>\${r.actIndex}</td>
                    <td style="color:#888;font-size:11px">\${r.version}</td>
                    <td>\${r.runs}</td>
                    <td><strong style="color:\${deathColor(r.deathPct)}">\${r.deathPct}%</strong></td>
                    <td style="color:\${dmgColor(r.avgDamage)}">\${r.avgDamage}</td>
                    <td style="color:#4db87a">\${r.avgHpHealed}</td>
                    <td style="color:#4db87a">\${r.avgMaxHpGain}</td>
                    <td style="color:\${r.avgMaxHpLoss > 0 ? '#e05252' : '#888'}">\${r.avgMaxHpLoss}</td>
                    <td style="color:#c9a84c">\${r.avgGoldGain}</td>
                    <td>\${r.avgGoldSpent}</td>
                    <td>\${r.avgCardsOffered}</td>
                    <td>\${r.avgRelicsOffered}</td>
                </tr>\`;
            });

            document.getElementById('tableFloors').innerHTML = html || '<tr><td colspan="14">No rows match current filters</td></tr>';
            makeSortable('tableFloors');
        }

        function drawAscensionCurveChart() {
            // Recalculate from filtered runs
            const ascMap = new Map();
            filteredRuns.forEach(run => {
                const level = run.a;
                if (!ascMap.has(level)) {
                    ascMap.set(level, { level, wins: 0, total: 0, deckSizes: [] });
                }
                const a = ascMap.get(level);
                a.total++;
                if (run.w) a.wins++;
                a.deckSizes.push(run.sz);
            });
            
            const asc = Array.from(ascMap.values())
                .map(a => ({
                    ascensionLevel: a.level,
                    winRate: (a.wins / a.total) * 100,
                    avgDeckSize: a.deckSizes.reduce((sum, s) => sum + s, 0) / a.deckSizes.length
                }))
                .sort((a, b) => a.ascensionLevel - b.ascensionLevel);

            safePlot('chartAscensionCurve', [
                {
                    x: asc.map(a => 'Asc ' + a.ascensionLevel),
                    y: asc.map(a => Number(a.winRate)),
                    name: 'Win Rate %',
                    yaxis: 'y',
                    marker: { color: '#c9a84c' }
                },
                {
                    x: asc.map(a => 'Asc ' + a.ascensionLevel),
                    y: asc.map(a => Number(a.avgDeckSize)),
                    name: 'Avg Deck Size',
                    yaxis: 'y2',
                    marker: { color: '#3498db' }
                }
            ], darkLayout({
                yaxis: { ...DARK.yaxis, title: 'Win Rate (%)' },
                yaxis2: { title: 'Avg Deck Size', overlaying: 'y', side: 'right', gridcolor: 'transparent', tickfont: { color: '#3498db' }, titlefont: { color: '#3498db' } },
                hovermode: 'x unified',
                margin: { t: 10, b: 50, l: 60, r: 60 },
                height: 400,
                legend: { ...DARK.legend, orientation: 'h', y: -0.15 }
            }), { responsive: true });
        }

        function drawAscensionStatsTable() {
            // Recalculate from filtered runs
            const ascMap = new Map();
            filteredRuns.forEach(run => {
                const level = run.a;
                if (!ascMap.has(level)) {
                    ascMap.set(level, { level, wins: 0, total: 0, deckSizes: [], deadlyEnc: new Map() });
                }
                const a = ascMap.get(level);
                a.total++;
                if (run.w) a.wins++;
                a.deckSizes.push(run.sz);
                // Track deadliest encounter
                run.encs.forEach(enc => {
                    if (!enc.s) {
                        const current = a.deadlyEnc.get(enc.id) || 0;
                        a.deadlyEnc.set(enc.id, current + 1);
                    }
                });
            });
            
            const stats = Array.from(ascMap.values())
                .map(a => ({
                    ascensionLevel: a.level,
                    totalRuns: a.total,
                    wins: a.wins,
                    winRate: (a.wins / a.total) * 100,
                    avgDeckSize: a.deckSizes.reduce((sum, s) => sum + s, 0) / a.deckSizes.length,
                    avgRelicCount: 0, // Would need to track from filtered data
                    deadliestEncounter: a.deadlyEnc.size > 0 
                        ? (() => {
                            const [encId] = Array.from(a.deadlyEnc.entries()).sort((x, y) => y[1] - x[1])[0];
                            const cleanName = encId
                              .replace('ENCOUNTER.', '')
                              .replace(/_(?:BOSS|ELITE|WEAK)$/, '')
                              .split('_')
                              .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
                              .join(' ');
                            return cleanName;
                          })()
                        : 'N/A'
                }))
                .sort((a, b) => a.ascensionLevel - b.ascensionLevel);

            let html = '<tr><th>Ascension</th><th>Runs</th><th>Wins</th><th>Win Rate</th><th>Avg Deck</th><th>Deadliest Encounter</th></tr>';
            stats.forEach(s => {
                html += \`<tr>
                    <td><strong>Ascension \${s.ascensionLevel}</strong></td>
                    <td>\${s.totalRuns}</td>
                    <td>\${s.wins}</td>
                    <td><strong style="color: #c9a84c;">\${Number(s.winRate).toFixed(1)}%</strong></td>
                    <td>\${Number(s.avgDeckSize).toFixed(1)}</td>
                    <td style="font-size: 12px;">\${s.deadliestEncounter}</td>
                </tr>\`;
            });
            document.getElementById('tableAscension').innerHTML = html;
            makeSortable('tableAscension');
        }

        function drawPotionsTable() {
            const potionMap = new Map();
            let potionCount = 0;
            let runsWithPotions = 0;
            
            filteredRuns.forEach(run => {
                if (!run.potions || run.potions.length === 0) return;
                runsWithPotions++;
                run.potions.forEach(pot => {
                    potionCount++;
                    const key = pot.id;
                    if (!potionMap.has(key)) {
                        potionMap.set(key, { id: pot.id, offered: 0, picked: 0, used: 0, bought: 0, discarded: 0 });
                    }
                    const stats = potionMap.get(key);
                    stats.offered += pot.o;  // offered count in this run
                    if (pot.pk) stats.picked++;  // picked in this run (boolean)
                    if (pot.u) stats.used++;  // used in this run (boolean)
                    if (pot.b) stats.bought++;  // bought in this run (boolean)
                    if (pot.d) stats.discarded++;  // discarded in this run (boolean)
                });
            });

            const report = Array.from(potionMap.values())
                .map(p => ({
                    potion: nameMapper.getPotionName(p.id),
                    offered: p.offered,
                    pickRate: p.offered > 0 ? ((p.picked / p.offered) * 100).toFixed(1) : '0.0',
                    used: p.used,
                    bought: p.bought,
                    discarded: p.discarded
                }))
                .sort((a, b) => Number(b.offered) - Number(a.offered));

            let html = '<tr><th>Potion</th><th>Offered</th><th>Pick Rate</th><th>Used</th><th>Bought</th><th>Discarded</th></tr>';
            if (report.length === 0) {
                html += '<tr><td colspan="6">No potion data (filteredRuns: ' + filteredRuns.length + ', runs with potions: ' + runsWithPotions + ', potion count: ' + potionCount + ')</td></tr>';
            } else {
                report.forEach(p => {
                    html += '<tr><td><strong>' + p.potion + '</strong></td><td>' + p.offered + '</td><td>' + p.pickRate + '%</td><td>' + p.used + '</td><td>' + p.bought + '</td><td>' + p.discarded + '</td></tr>';
                });
            }
            document.getElementById('tablePotions').innerHTML = html;
            makeSortable('tablePotions');
        }

        function getActReached(run) {
            try {
                const acts = JSON.parse(run.acts || '[]');
                if (acts.length === 0) return '-';
                const last = acts[acts.length - 1];
                const match = last.match(/(\d+)$/);
                return match ? Number(match[1]) : acts.length;
            } catch (e) { return '-'; }
        }

        // ── Potions Chart ──
        function drawPotionsChart() {
            const potionMap = new Map();
            filteredRuns.forEach(run => {
                if (!run.potions) return;
                run.potions.forEach(pot => {
                    if (!potionMap.has(pot.id)) potionMap.set(pot.id, { name: nameMapper.getPotionName(pot.id), offered: 0, picked: 0, used: 0 });
                    const s = potionMap.get(pot.id);
                    s.offered += pot.o;
                    if (pot.pk) s.picked++;
                    if (pot.u) s.used++;
                });
            });
            const potions = Array.from(potionMap.values()).filter(p => p.offered >= 2).sort((a, b) => b.offered - a.offered).slice(0, 20);
            if (potions.length === 0) return;

            safePlot('chartPotions', [
                { x: potions.map(p => p.name), y: potions.map(p => p.offered), name: 'Offered', type: 'bar', marker: { color: '#3498db' } },
                { x: potions.map(p => p.name), y: potions.map(p => p.picked), name: 'Picked', type: 'bar', marker: { color: '#c9a84c' } },
                { x: potions.map(p => p.name), y: potions.map(p => p.used), name: 'Used', type: 'bar', marker: { color: '#4db87a' } }
            ], darkLayout({
                barmode: 'group',
                margin: { t: 10, b: 100, l: 50, r: 20 },
                height: 400,
                xaxis: { ...DARK.xaxis, tickangle: -45 },
                yaxis: { ...DARK.yaxis, title: 'Count' },
                legend: { ...DARK.legend, orientation: 'h', y: -0.25 }
            }), { responsive: true });
        }

        // ── Card Synergies Bubble Chart ──
        function drawCardSynergiesChart() {
            const pairMap = new Map();
            filteredRuns.forEach(run => {
                const cards = run.cards.map(c => nameMapper.getCardName(c));
                for (let i = 0; i < cards.length; i++) {
                    for (let j = i + 1; j < cards.length; j++) {
                        const pair = [cards[i], cards[j]].sort().join(' + ');
                        if (!pairMap.has(pair)) pairMap.set(pair, { pair, count: 0, wins: 0 });
                        const p = pairMap.get(pair);
                        p.count++;
                        if (run.w) p.wins++;
                    }
                }
            });
            const synergies = Array.from(pairMap.values()).filter(p => p.count >= 3)
                .map(p => ({ ...p, wr: (p.wins / p.count) * 100 }))
                .sort((a, b) => b.wins - a.wins).slice(0, 40);
            if (synergies.length === 0) return;

            safePlot('chartCardSynergies', [{
                x: synergies.map(s => s.count),
                y: synergies.map(s => s.wr),
                mode: 'markers',
                type: 'scatter',
                text: synergies.map(s => s.pair),
                marker: {
                    size: synergies.map(s => Math.max(Math.sqrt(s.count) * 5, 8)),
                    color: synergies.map(s => s.wr),
                    colorscale: [[0, '#e05252'], [0.5, '#c9a84c'], [1, '#4db87a']],
                    showscale: true,
                    colorbar: { title: 'Win%', tickfont: { color: '#aaa' }, titlefont: { color: '#c9a84c' } },
                    line: { width: 1, color: 'rgba(255,255,255,0.2)' }
                },
                hovertemplate: '<b>%{text}</b><br>Co-occurrences: %{x}<br>Win Rate: %{y:.1f}%<extra></extra>'
            }], darkLayout({
                xaxis: { ...DARK.xaxis, title: 'Co-occurrences' },
                yaxis: { ...DARK.yaxis, title: 'Win Rate (%)' },
                margin: { t: 10, b: 50, l: 60, r: 100 },
                height: 400
            }), { responsive: true });
        }

        // ── Character × Ascension Heatmap Chart ──
        function drawCharAscHeatmapChart() {
            const pivotData = {};
            filteredRuns.forEach(run => {
                const char = nameMapper.getCharacterName(run.c);
                const asc = run.a;
                if (!pivotData[char]) pivotData[char] = {};
                if (!pivotData[char][asc]) pivotData[char][asc] = { wins: 0, total: 0 };
                pivotData[char][asc].total++;
                if (run.w) pivotData[char][asc].wins++;
            });

            const characters = Object.keys(pivotData).sort();
            const ascSet = new Set();
            characters.forEach(c => Object.keys(pivotData[c]).forEach(a => ascSet.add(Number(a))));
            const ascArray = Array.from(ascSet).sort((a, b) => a - b);

            const z = [], text = [];
            characters.forEach(char => {
                const row = [], textRow = [];
                ascArray.forEach(asc => {
                    const d = pivotData[char]?.[asc];
                    if (d && d.total > 0) {
                        const wr = (d.wins / d.total) * 100;
                        row.push(wr);
                        textRow.push(char + ' Asc ' + asc + ': ' + wr.toFixed(0) + '% (' + d.wins + '/' + d.total + ')');
                    } else {
                        row.push(null);
                        textRow.push('No data');
                    }
                });
                z.push(row);
                text.push(textRow);
            });

            safePlot('chartCharAscHeatmap', [{
                x: ascArray.map(a => 'Asc ' + a),
                y: characters,
                z: z,
                text: text,
                type: 'heatmap',
                colorscale: [[0, '#e05252'], [0.35, '#c9a84c'], [0.65, '#c9a84c'], [1, '#4db87a']],
                hovertemplate: '%{text}<extra></extra>',
                showscale: true,
                colorbar: { title: 'Win%', tickfont: { color: '#aaa' }, titlefont: { color: '#c9a84c' } },
                zmin: 0, zmax: 100
            }, {
                x: [].concat(...ascArray.map(a => characters.map(() => 'Asc ' + a))),
                y: [].concat(...ascArray.map((a, ai) => characters.map((c, ci) => c))),
                mode: 'text',
                type: 'scatter',
                text: [].concat(...ascArray.map((a, ai) => characters.map((c, ci) => {
                    const val = z[ci][ai];
                    return val !== null ? val.toFixed(0) + '%' : '';
                }))),
                textfont: { color: '#fff', size: 13, family: 'Segoe UI, sans-serif' },
                hoverinfo: 'skip',
                showlegend: false
            }], darkLayout({
                margin: { t: 10, b: 50, l: 120, r: 80 },
                height: Math.max(300, characters.length * 60 + 100),
                yaxis: { ...DARK.yaxis, autorange: 'reversed' }
            }), { responsive: true });
        }

        // ── Builds Bar Chart ──
        function drawBuildsChart() {
            const CHAR_COLORS_B = { Ironclad: '#e05252', Silent: '#4db87a', Regent: '#c9a84c', Necrobinder: '#9b59b6', Defect: '#3498db' };
            const charCardMap = {};
            filteredRuns.forEach(run => {
                const char = nameMapper.getCharacterName(run.c);
                if (!charCardMap[char]) charCardMap[char] = {};
                run.cards.filter(c => !STARTER_CARDS.has(c)).forEach(c => {
                    const name = nameMapper.getCardName(c);
                    charCardMap[char][name] = (charCardMap[char][name] || 0) + 1;
                });
            });

            const traces = [];
            Object.keys(charCardMap).sort().forEach(char => {
                const topCards = Object.entries(charCardMap[char]).sort((a, b) => b[1] - a[1]).slice(0, 10);
                traces.push({
                    x: topCards.map(e => e[0]),
                    y: topCards.map(e => e[1]),
                    name: char,
                    type: 'bar',
                    marker: { color: CHAR_COLORS_B[char] || '#888' },
                    hovertemplate: '<b>%{x}</b><br>' + char + ': %{y} picks<extra></extra>'
                });
            });

            safePlot('chartBuilds', traces, darkLayout({
                barmode: 'group',
                margin: { t: 10, b: 100, l: 50, r: 20 },
                height: 500,
                xaxis: { ...DARK.xaxis, tickangle: -45 },
                yaxis: { ...DARK.yaxis, title: 'Times Picked' },
                legend: { ...DARK.legend, orientation: 'h', y: -0.2 }
            }), { responsive: true });
        }

        // ── Cumulative Win Rate Chart (moved from Win Trend tab) ──
        function drawCumulativeWinRate() {
            const sorted = [...filteredRuns].filter(r => r.t).sort((a, b) => a.t - b.t);
            if (sorted.length === 0) return;
            let cumWins = 0;
            const cumRates = sorted.map((run, i) => { if (run.w) cumWins++; return (cumWins / (i + 1)) * 100; });
            const xDates = sorted.map(r => new Date(r.t * 1000));

            safePlot('chartCumulativeWinRate', [
                { x: [xDates[0], xDates[xDates.length - 1]], y: [50, 50], type: 'scatter', mode: 'lines',
                  line: { color: 'rgba(201,168,76,0.3)', width: 1, dash: 'dash' }, showlegend: false, hoverinfo: 'skip' },
                { x: xDates, y: cumRates, type: 'scatter', mode: 'lines',
                  name: 'Cumulative Win Rate', line: { color: '#4db87a', width: 2 },
                  fill: 'tozeroy', fillcolor: 'rgba(77,184,122,0.1)',
                  text: cumRates.map((r, i) => r.toFixed(1) + '% (' + (i + 1) + ' runs)'),
                  hoverinfo: 'x+text' }
            ], darkLayout({
                yaxis: { ...DARK.yaxis, title: 'Cumulative Win Rate (%)', range: [0, 100] },
                xaxis: { ...DARK.xaxis, type: 'date', tickformat: '%b %d' },
                margin: { t: 10, b: 50, l: 55, r: 15 },
                height: 350
            }), { responsive: true });
        }

        function buildActWinMap() {
            // card name -> [{w,t}, {w,t}, {w,t}] for acts 1/2/3
            const m = new Map();
            filteredRuns.forEach(run => {
                [run.a1c || [], run.a2c || [], run.a3c || []].forEach((cards, i) => {
                    cards.forEach(id => {
                        const name = nameMapper.getCardName(id);
                        if (!m.has(name)) m.set(name, [{w:0,t:0},{w:0,t:0},{w:0,t:0}]);
                        m.get(name)[i].t++;
                        if (run.w) m.get(name)[i].w++;
                    });
                });
            });
            return m;
        }

        function drawEloTable() {
            const eloState = DATA.eloState;
            if (!eloState) return;

            const character = document.getElementById('characterFilter')?.value;
            const actMap = buildActWinMap();

            // Build skip lookup: cardName → skippedCount (from live filteredRuns)
            const skipMap = new Map();
            filteredRuns.forEach(run => {
                (run.skippedCards || []).forEach(id => {
                    const name = nameMapper.getCardName(id);
                    skipMap.set(name, (skipMap.get(name) || 0) + 1);
                });
            });

            // Aggregate across all ascensions: key = "cardName|charName"
            const agg = new Map();
            for (const char of Object.keys(eloState)) {
                const cName = nameMapper.getCharacterName(char);
                if (character && cName !== character) continue;
                for (const asc of Object.keys(eloState[char])) {
                    for (const [cardId, rec] of Object.entries(eloState[char][asc])) {
                        const r = rec;
                        const cardName = nameMapper.getCardName(cardId);
                        const key = cardName + '|' + cName;
                        if (!agg.has(key)) agg.set(key, { card: cardName, character: cName, ratingSum: 0, peakMax: 0, games: 0, wins: 0 });
                        const a = agg.get(key);
                        // weighted rating accumulation; we'll divide by total games later
                        a.ratingSum += r.rating * r.gamesPlayed;
                        a.peakMax = Math.max(a.peakMax, r.peakRating);
                        a.games += r.gamesPlayed;
                        a.wins += r.wins;
                    }
                }
            }

            const records = [];
            agg.forEach(a => {
                if (a.games < 3) return;
                const cardName = a.card;
                const acts = actMap.get(cardName) || [{w:0,t:0},{w:0,t:0},{w:0,t:0}];
                const actWr = acts.map(act => act.t >= 2 ? ((act.w / act.t) * 100).toFixed(1) : null);
                records.push({
                    card: cardName,
                    character: a.character,
                    rating: (a.ratingSum / a.games).toFixed(0),
                    peak: a.peakMax.toFixed(0),
                    games: a.games,
                    winRate: ((a.wins / a.games) * 100).toFixed(1),
                    skipped: skipMap.get(cardName) || 0,
                    a1wr: actWr[0], a1n: acts[0].t,
                    a2wr: actWr[1], a2n: acts[1].t,
                    a3wr: actWr[2], a3n: acts[2].t,
                });
            });

            records.sort((a, b) => Number(b.rating) - Number(a.rating));

            const wrColor = (v) => v === null ? '#888' : Number(v) >= 50 ? '#4db87a' : Number(v) >= 30 ? '#c9a84c' : '#e05252';
            const fmtAct = (wr, n) => wr !== null
                ? \`<span style="color:\${wrColor(wr)};font-weight:600">\${wr}%</span><span style="color:#666;font-size:11px"> (\${n})</span>\`
                : '<span style="color:#555">—</span>';

            let html = '<tr><th>Card</th><th>Char</th><th>ELO</th><th>Peak</th><th>Games</th><th>Win %</th><th>Skipped</th><th>Act 1 Win%</th><th>Act 2 Win%</th><th>Act 3 Win%</th></tr>';
            records.forEach(r => {
                const ratingColor = Number(r.rating) >= 1500 ? '#4db87a' : Number(r.rating) < 1450 ? '#e05252' : '#c9a84c';
                html += \`<tr>
                    <td><strong>\${r.card}</strong></td>
                    <td>\${r.character}</td>
                    <td><strong style="color: \${ratingColor};">\${r.rating}</strong></td>
                    <td style="color:#888">\${r.peak}</td>
                    <td>\${r.games}</td>
                    <td><strong style="color:\${wrColor(r.winRate)}">\${r.winRate}%</strong></td>
                    <td style="color:\${r.skipped > 0 ? '#e05252' : '#888'}">\${r.skipped}</td>
                    <td>\${fmtAct(r.a1wr, r.a1n)}</td>
                    <td>\${fmtAct(r.a2wr, r.a2n)}</td>
                    <td>\${fmtAct(r.a3wr, r.a3n)}</td>
                </tr>\`;
            });
            document.getElementById('tableElo').innerHTML = html || '<tr><td colspan="10">No ELO data (try adjusting filters)</td></tr>';
            makeSortable('tableElo');
        }

        function drawEloScatter() {
            const eloState = DATA.eloState;
            if (!eloState) return;
            const character = document.getElementById('characterFilter')?.value;
            const CHAR_COLORS_E = { Ironclad: '#e05252', Silent: '#4db87a', Regent: '#c9a84c', Necrobinder: '#9b59b6', Defect: '#3498db' };

            // Aggregate across all ascensions per card+character
            const agg = new Map();
            for (const char of Object.keys(eloState)) {
                const cName = nameMapper.getCharacterName(char);
                if (character && cName !== character) continue;
                for (const asc of Object.keys(eloState[char])) {
                    for (const [cardId, rec] of Object.entries(eloState[char][asc])) {
                        const r = rec;
                        const key = nameMapper.getCardName(cardId) + '|' + cName;
                        if (!agg.has(key)) agg.set(key, { name: nameMapper.getCardName(cardId), char: cName, ratingSum: 0, games: 0, wins: 0 });
                        const a = agg.get(key);
                        a.ratingSum += r.rating * r.gamesPlayed;
                        a.games += r.gamesPlayed;
                        a.wins += r.wins;
                    }
                }
            }

            const byChar = {};
            agg.forEach(a => {
                if (a.games < 3) return;
                if (!byChar[a.char]) byChar[a.char] = [];
                byChar[a.char].push({ name: a.name, rating: a.ratingSum / a.games, winRate: (a.wins / a.games) * 100, games: a.games });
            });

            const allPoints = [].concat(...Object.values(byChar));
            if (allPoints.length === 0) return;
            const rMin = Math.min(...allPoints.map(c => c.rating));
            const rMax = Math.max(...allPoints.map(c => c.rating));

            const traces = [{
                x: [rMin, rMax], y: [50, 50], mode: 'lines', type: 'scatter',
                name: '50% win rate', showlegend: true,
                line: { color: 'rgba(201,168,76,0.4)', width: 1, dash: 'dash' },
                hoverinfo: 'skip'
            }];

            Object.keys(byChar).sort().forEach(cName => {
                traces.push({
                    x: byChar[cName].map(c => c.rating),
                    y: byChar[cName].map(c => c.winRate),
                    mode: 'markers',
                    type: 'scatter',
                    name: cName,
                    text: byChar[cName].map(c => \`<b>\${c.name}</b> (\${cName})<br>ELO: \${c.rating.toFixed(0)}<br>Win Rate: \${c.winRate.toFixed(1)}%<br>Games: \${c.games}\`),
                    hovertemplate: '%{text}<extra></extra>',
                    marker: {
                        size: byChar[cName].map(c => Math.max(Math.sqrt(c.games) * 3, 6)),
                        color: CHAR_COLORS_E[cName] || '#888',
                        opacity: 0.75,
                        line: { width: 1, color: 'rgba(255,255,255,0.2)' }
                    }
                });
            });

            safePlot('chartEloScatter', traces, darkLayout({
                xaxis: { ...DARK.xaxis, title: 'ELO Rating' },
                yaxis: { ...DARK.yaxis, title: 'Win Rate (%)' },
                margin: { t: 10, b: 50, l: 60, r: 20 },
                height: 420,
                legend: { ...DARK.legend, orientation: 'h', y: -0.15 },
                hovermode: 'closest'
            }), { responsive: true });
        }

        function drawRunsTable() {
            const sorted = [...filteredRuns].filter(r => r.t).sort((a, b) => a.t - b.t);
            if (sorted.length === 0) {
                document.getElementById('tableRunsWinrate').innerHTML = '<tr><td>No runs</td></tr>';
                return;
            }

            const CHARS = ['Ironclad', 'Silent', 'Regent', 'Necrobinder', 'Defect'];
            const CHAR_COLORS = { Ironclad: '#e05252', Silent: '#4db87a', Regent: '#c9a84c', Necrobinder: '#9b59b6', Defect: '#3498db' };
            const CHAR_FILLS  = { Ironclad: 'rgba(224,82,82,0.12)', Silent: 'rgba(77,184,122,0.12)', Regent: 'rgba(201,168,76,0.12)', Necrobinder: 'rgba(155,89,182,0.12)', Defect: 'rgba(52,152,219,0.12)' };
            const keys = ['Overall', ...CHARS];
            const sigmoid = x => 1 / (1 + Math.exp(-x));
            function cn(c) { return nameMapper.getCharacterName(c); }

            // ── MLE for σ_drift per key ──
            function kalmanLL(driftSq, key) {
                let mu = 0, vr = 1, ll = 0;
                for (const r of sorted) {
                    const ch = cn(r.c), y = r.w ? 1 : 0;
                    const ck = CHARS.includes(ch) ? ch : null;
                    const obs = ck ? ['Overall', ck] : ['Overall'];
                    if (!obs.includes(key)) continue;
                    vr += driftSq;
                    const p = sigmoid(mu);
                    ll += y === 1 ? Math.log(Math.max(p, 1e-10)) : Math.log(Math.max(1 - p, 1e-10));
                    const w = p * (1 - p);
                    const K = vr * w / (1 + vr * w);
                    mu += K * (y - p);
                    vr *= (1 - K * w);
                }
                return ll;
            }

            function goldenSearch(f, lo, hi, tol) {
                const gr = (Math.sqrt(5) - 1) / 2;
                let a = lo, b = hi, c = b - gr * (b - a), d = a + gr * (b - a);
                let fc = f(c), fd = f(d);
                while (Math.abs(b - a) > tol) {
                    if (fc > fd) { b = d; d = c; fd = fc; c = b - gr * (b - a); fc = f(c); }
                    else         { a = c; c = d; fc = fd; d = a + gr * (b - a); fd = f(d); }
                }
                return (a + b) / 2;
            }

            const mleDriftSq = {};
            keys.forEach(k => {
                const n = sorted.filter(r => { const ch = cn(r.c); const ck = CHARS.includes(ch) ? ch : null; return k === 'Overall' || ck === k; }).length;
                mleDriftSq[k] = n < 10 ? 0.01 : goldenSearch(ds => kalmanLL(ds, k), 1e-6, 1.0, 1e-4);
            });

            // ── State trackers ──
            const FIXED_DRIFT_SQ = 0.01; // σ = 0.1
            const wins = {}, total = {};
            const kMu = {}, kVar = {};   // Fixed drift
            const mMu = {}, mVar = {};   // MLE drift
            keys.forEach(k => { wins[k] = 0; total[k] = 0; kMu[k] = 0; kVar[k] = 1; mMu[k] = 0; mVar[k] = 1; });

            // Per-run series
            const s = {};
            keys.forEach(k => { s[k] = { raw: [], bayes: [], kalF: [], kalFLo: [], kalFHi: [], kalM: [], kalMLo: [], kalMHi: [] }; });
            const runNums = [], dates = [], chars = [], outcomes = [];

            let runNum = 0;
            for (const r of sorted) {
                const ch = cn(r.c), y = r.w ? 1 : 0;
                const ck = CHARS.includes(ch) ? ch : null;
                const uKeys = ck ? ['Overall', ck] : ['Overall'];
                runNum++;

                total['Overall']++; if (r.w) wins['Overall']++;
                if (ck) { total[ck]++; if (r.w) wins[ck]++; }

                // Kalman fixed drift
                keys.forEach(k => {
                    if (!uKeys.includes(k)) return;
                    kVar[k] += FIXED_DRIFT_SQ;
                    const p = sigmoid(kMu[k]), w = p * (1 - p);
                    const K = kVar[k] * w / (1 + kVar[k] * w);
                    kMu[k] += K * (y - p); kVar[k] *= (1 - K * w);
                });

                // Kalman MLE drift
                keys.forEach(k => {
                    if (!uKeys.includes(k)) return;
                    mVar[k] += mleDriftSq[k];
                    const p = sigmoid(mMu[k]), w = p * (1 - p);
                    const K = mVar[k] * w / (1 + mVar[k] * w);
                    mMu[k] += K * (y - p); mVar[k] *= (1 - K * w);
                });

                // Record all series
                uKeys.forEach(k => {
                    s[k].raw.push(total[k] > 0 ? (wins[k] / total[k]) * 100 : 0);
                    s[k].bayes.push(((wins[k] + 1) / (total[k] + 2)) * 100);
                    s[k].kalF.push(sigmoid(kMu[k]) * 100);
                    s[k].kalFLo.push(sigmoid(kMu[k] - 1.96 * Math.sqrt(kVar[k])) * 100);
                    s[k].kalFHi.push(sigmoid(kMu[k] + 1.96 * Math.sqrt(kVar[k])) * 100);
                    s[k].kalM.push(sigmoid(mMu[k]) * 100);
                    s[k].kalMLo.push(sigmoid(mMu[k] - 1.96 * Math.sqrt(mVar[k])) * 100);
                    s[k].kalMHi.push(sigmoid(mMu[k] + 1.96 * Math.sqrt(mVar[k])) * 100);
                });

                runNums.push(runNum);
                dates.push(r.t ? new Date(r.t * 1000).toLocaleDateString() : '-');
                chars.push(ch);
                outcomes.push(r.w ? 'Win' : 'Loss');
            }

            // ── Dark theme layout base ──
            const darkLayout = {
                plot_bgcolor: '#1a1a2e',
                paper_bgcolor: '#16213e',
                font: { color: '#e0e0e0', family: 'Segoe UI, sans-serif' },
                yaxis: { title: 'Win Rate (%)', range: [0, 100], gridcolor: '#2a2a4a', zerolinecolor: '#2a2a4a', tickfont: { color: '#aaa' }, titlefont: { color: '#c9a84c' } },
                xaxis: { gridcolor: '#2a2a4a', zerolinecolor: '#2a2a4a', tickfont: { color: '#aaa' }, titlefont: { color: '#c9a84c' } },
                legend: { orientation: 'h', y: -0.15, font: { color: '#ccc', size: 11 }, bgcolor: 'rgba(0,0,0,0)' },
                margin: { t: 10, b: 60, l: 55, r: 15 },
                hovermode: 'x unified',
                hoverlabel: { bgcolor: '#1a1a2e', bordercolor: '#c9a84c', font: { color: '#e0e0e0', size: 12 } }
            };

            // ── Build real date X-axis and per-run hover text ──
            const ov = s['Overall'];
            const xDates = sorted.map(r => r.t ? new Date(r.t * 1000) : null);
            const hoverTexts = sorted.map((r, i) => {
                const ch = chars[i], date = dates[i], result = outcomes[i];
                return '<b>' + date + '</b> — ' + ch + ' (' + result + ')<br>'
                     + 'Raw: ' + ov.raw[i].toFixed(1) + '% · Bayes: ' + ov.bayes[i].toFixed(1) + '%<br>'
                     + 'Kalman Fixed: ' + ov.kalF[i].toFixed(1) + '% · MLE: ' + ov.kalM[i].toFixed(1) + '%<br>'
                     + 'MLE 95% CI: ' + ov.kalMLo[i].toFixed(1) + '–' + ov.kalMHi[i].toFixed(1) + '%';
            });

            // Win/loss scatter markers
            const winX = [], winY = [], lossX = [], lossY = [];
            sorted.forEach((r, i) => {
                if (r.w) { winX.push(xDates[i]); winY.push(ov.kalM[i]); }
                else     { lossX.push(xDates[i]); lossY.push(ov.kalM[i]); }
            });

            // ── Chart 1: Overall — all 4 methods ──
            const overallTraces = [
                // CI bands
                { x: xDates, y: ov.kalFHi, type: 'scatter', mode: 'lines',
                  line: { width: 0 }, showlegend: false, hoverinfo: 'skip' },
                { x: xDates, y: ov.kalFLo, type: 'scatter', mode: 'lines',
                  line: { width: 0 }, fill: 'tonexty', fillcolor: 'rgba(52,152,219,0.08)', showlegend: false, hoverinfo: 'skip' },
                { x: xDates, y: ov.kalMHi, type: 'scatter', mode: 'lines',
                  line: { width: 0 }, showlegend: false, hoverinfo: 'skip' },
                { x: xDates, y: ov.kalMLo, type: 'scatter', mode: 'lines',
                  line: { width: 0 }, fill: 'tonexty', fillcolor: 'rgba(77,184,122,0.12)', showlegend: false, hoverinfo: 'skip' },
                // Lines
                { x: xDates, y: ov.raw, type: 'scatter', mode: 'lines', name: 'Raw Win%',
                  line: { color: 'rgba(255,255,255,0.3)', width: 1, dash: 'dot' }, hoverinfo: 'skip' },
                { x: xDates, y: ov.bayes, type: 'scatter', mode: 'lines', name: 'Bayesian',
                  line: { color: '#c9a84c', width: 1.5, dash: 'dash' }, hoverinfo: 'skip' },
                { x: xDates, y: ov.kalF, type: 'scatter', mode: 'lines', name: 'Kalman (σ=0.1)',
                  line: { color: '#3498db', width: 2 }, hoverinfo: 'skip' },
                { x: xDates, y: ov.kalM, type: 'scatter', mode: 'lines', name: 'Kalman (MLE σ)',
                  line: { color: '#4db87a', width: 3 }, text: hoverTexts, hoverinfo: 'text' },
                // Win/loss markers
                { x: winX, y: winY, type: 'scatter', mode: 'markers', name: 'Win',
                  marker: { color: '#4db87a', size: 5, symbol: 'triangle-up', line: { width: 0 } }, hoverinfo: 'skip' },
                { x: lossX, y: lossY, type: 'scatter', mode: 'markers', name: 'Loss',
                  marker: { color: '#e05252', size: 5, symbol: 'triangle-down', line: { width: 0 } }, hoverinfo: 'skip' },
                // 50% reference line
                { x: [xDates[0], xDates[xDates.length - 1]], y: [50, 50], type: 'scatter', mode: 'lines',
                  line: { color: 'rgba(201,168,76,0.3)', width: 1, dash: 'dash' }, showlegend: false, hoverinfo: 'skip' },
            ];

            safePlot('chartRunsOverall', overallTraces, {
                ...darkLayout,
                xaxis: { ...darkLayout.xaxis, title: '', type: 'date', tickformat: '%b %d' },
            }, { responsive: true });

            // ── Chart 2: Per-character Kalman MLE on shared timeline ──
            const charTraces = [];
            // Track per-character data aligned to overall timeline
            const charIdxMap = {};
            CHARS.forEach(ch => { charIdxMap[ch] = []; });
            sorted.forEach((r, i) => {
                const ch = cn(r.c);
                if (CHARS.includes(ch)) charIdxMap[ch].push(i);
            });

            CHARS.forEach(ch => {
                const idxs = charIdxMap[ch];
                if (idxs.length < 2) return;
                const cs = s[ch];
                const xCh = idxs.map(i => xDates[i]);
                // CI band
                charTraces.push({ x: xCh, y: cs.kalMHi, type: 'scatter', mode: 'lines',
                    line: { width: 0 }, showlegend: false, hoverinfo: 'skip', legendgroup: ch });
                charTraces.push({ x: xCh, y: cs.kalMLo, type: 'scatter', mode: 'lines',
                    line: { width: 0 }, fill: 'tonexty', fillcolor: CHAR_FILLS[ch],
                    showlegend: false, hoverinfo: 'skip', legendgroup: ch });
                // Main line
                charTraces.push({ x: xCh, y: cs.kalM, type: 'scatter', mode: 'lines',
                    name: ch, line: { color: CHAR_COLORS[ch], width: 2.5 }, legendgroup: ch,
                    text: cs.kalM.map((v, j) => '<b>' + ch + '</b>: ' + v.toFixed(1) + '% (±' + ((cs.kalMHi[j] - cs.kalMLo[j]) / 2).toFixed(1) + ')'),
                    hoverinfo: 'text' });
                // Win/loss dots per character
                idxs.forEach((gi, j) => {
                    // skip, handled by markers below
                });
            });
            // Per-character win/loss markers
            CHARS.forEach(ch => {
                const idxs = charIdxMap[ch];
                if (idxs.length < 2) return;
                const cs = s[ch];
                const wX = [], wY = [], lX = [], lY = [];
                idxs.forEach((gi, j) => {
                    if (sorted[gi].w) { wX.push(xDates[gi]); wY.push(cs.kalM[j]); }
                    else              { lX.push(xDates[gi]); lY.push(cs.kalM[j]); }
                });
                if (wX.length) charTraces.push({ x: wX, y: wY, type: 'scatter', mode: 'markers',
                    marker: { color: CHAR_COLORS[ch], size: 4, symbol: 'triangle-up', opacity: 0.6 },
                    showlegend: false, hoverinfo: 'skip', legendgroup: ch });
                if (lX.length) charTraces.push({ x: lX, y: lY, type: 'scatter', mode: 'markers',
                    marker: { color: CHAR_COLORS[ch], size: 4, symbol: 'triangle-down', opacity: 0.4 },
                    showlegend: false, hoverinfo: 'skip', legendgroup: ch });
            });
            // 50% line
            charTraces.push({ x: [xDates[0], xDates[xDates.length - 1]], y: [50, 50], type: 'scatter', mode: 'lines',
                line: { color: 'rgba(201,168,76,0.3)', width: 1, dash: 'dash' }, showlegend: false, hoverinfo: 'skip' });

            safePlot('chartRunsCharacter', charTraces, {
                ...darkLayout,
                xaxis: { ...darkLayout.xaxis, title: '', type: 'date', tickformat: '%b %d' },
            }, { responsive: true });

            // ── Table: run-by-run data with all estimators ──
            // ── Best ELO card per act helper ──
            function bestEloCard(cards, charKey, eloState) {
                if (!cards || !cards.length || !eloState || !eloState[charKey]) return null;
                let best = null, bestRating = -Infinity;
                const charData = eloState[charKey];
                cards.forEach(id => {
                    // aggregate across all ascension buckets for this char
                    let ratingSum = 0, games = 0;
                    Object.values(charData).forEach(ascMap => {
                        const rec = ascMap[id];
                        if (rec && rec.gamesPlayed > 0) { ratingSum += rec.rating * rec.gamesPlayed; games += rec.gamesPlayed; }
                    });
                    if (games > 0) {
                        const avg = ratingSum / games;
                        if (avg > bestRating) { bestRating = avg; best = nameMapper.getCardName(id); }
                    }
                });
                return best ? { name: best, rating: Math.round(bestRating) } : null;
            }

            let html = '<tr><th>#</th><th>Date</th><th>Char</th><th>Result</th><th>CP</th><th>Deck</th><th>Ver</th><th>Best A1</th><th>Best A2</th><th>Best A3</th><th>Raw%</th><th>Bayesian</th><th>Kalman (σ=0.1)</th><th>Kalman MLE</th><th>MLE 95% CI</th></tr>';
            let tWins = 0;
            sorted.forEach((r, i) => {
                if (r.w) tWins++;
                const raw = ((tWins / (i + 1)) * 100).toFixed(1);
                const bay = (((tWins + 1) / (i + 3)) * 100).toFixed(1);
                const kf = ov.kalF[i] ? ov.kalF[i].toFixed(1) : '-';
                const km = ov.kalM[i] ? ov.kalM[i].toFixed(1) : '-';
                const lo = ov.kalMLo[i] ? ov.kalMLo[i].toFixed(1) : '-';
                const hi = ov.kalMHi[i] ? ov.kalMHi[i].toFixed(1) : '-';
                const outcomeColor = r.w ? '#4db87a' : '#e05252';

                const eloState = DATA.eloState;
                const charKey = r.c;
                const a1best = bestEloCard(r.a1c || [], charKey, eloState);
                const a2best = bestEloCard(r.a2c || [], charKey, eloState);
                const a3best = bestEloCard(r.a3c || [], charKey, eloState);
                const fmtBest = b => b ? \`<span title="ELO \${b.rating}" style="color:#c9a84c">\${b.name}</span><span style="color:#555;font-size:10px"> \${b.rating}</span>\` : '<span style="color:#555">—</span>';

                const rowId = 'run-detail-' + i;
                const deckCards = (r.cards || []).filter(c => !STARTER_CARDS.has(c)).map(c => nameMapper.getCardName(c)).join(', ');
                const ver = r.v || '-';

                html += \`<tr style="cursor:pointer" onclick="var d=document.getElementById('\${rowId}');d.style.display=d.style.display==='table-row'?'none':'table-row'">
                    <td>\${i + 1}</td>
                    <td>\${dates[i]}</td>
                    <td><strong>\${chars[i]}</strong></td>
                    <td><strong style="color: \${outcomeColor};">\${outcomes[i]}</strong></td>
                    <td>\${r.cp || 0}</td>
                    <td>\${r.sz || 0}</td>
                    <td style="color:#666;font-size:11px">\${ver}</td>
                    <td>\${fmtBest(a1best)}</td>
                    <td>\${fmtBest(a2best)}</td>
                    <td>\${fmtBest(a3best)}</td>
                    <td>\${raw}%</td>
                    <td>\${bay}%</td>
                    <td>\${kf}%</td>
                    <td>\${km}%</td>
                    <td>\${lo}% – \${hi}%</td>
                </tr>
                <tr id="\${rowId}" style="display:none;background:#0d1117">
                    <td colspan="15" style="padding:10px 16px;font-size:12px;color:#aaa;border-top:1px solid #2a2a4a">
                        <strong style="color:#c9a84c">Final Deck:</strong> \${deckCards || '(empty)'}
                    </td>
                </tr>\`;
            });
            document.getElementById('tableRunsWinrate').innerHTML = html;
            makeSortable('tableRunsWinrate');
        }

        function drawExportTable() {
            const rows = filteredRuns.map(run => ({
                ts: run.t ?? 0,
                date: run.t ? new Date(run.t * 1000).toLocaleDateString() : '-',
                character: nameMapper.getCharacterName(run.c),
                ascension: run.a,
                outcome: run.w ? 'Win' : 'Loss',
                deckSize: run.sz,
                relicCount: run.rc,
                damage: run.dmg != null ? run.dmg : '-',
                act: getActReached(run),
                killedBy: run.w ? '-' : (run.k ? nameMapper.getEncounterName(run.k) : '-'),
                duration: run.dur ? Math.floor(run.dur / 60) + 'm ' + (run.dur % 60) + 's' : '-',
                durSort: run.dur || 0,
                players: run.m === 1 ? '1P' : run.m + 'P'
            }));

            let html = '<tr><th>Date Played</th><th>Character</th><th>Asc</th><th>Outcome</th><th>Killed By</th><th>Cards</th><th>Relics</th><th>Total Damage Taken</th><th>Act</th><th>Duration</th><th>Players</th></tr>';
            rows.forEach(r => {
                const outcomeColor = r.outcome === 'Win' ? '#4db87a' : '#e05252';
                html += \`<tr>
                    <td data-sort="\${r.ts}">\${r.date}</td>
                    <td><strong>\${r.character}</strong></td>
                    <td>\${r.ascension}</td>
                    <td><strong style="color: \${outcomeColor};">\${r.outcome}</strong></td>
                    <td>\${r.killedBy}</td>
                    <td>\${r.deckSize}</td>
                    <td>\${r.relicCount}</td>
                    <td>\${r.damage}</td>
                    <td>\${r.act}</td>
                    <td data-sort="\${r.durSort}">\${r.duration}</td>
                    <td>\${r.players}</td>
                </tr>\`;
            });
            document.getElementById('tableExport').innerHTML = html || '<tr><td colspan="11">No runs (try adjusting filters above)</td></tr>';
            makeSortable('tableExport');
        }

        function exportFilteredRunsToCSV() {
            const headers = ['Date Played', 'Character', 'Ascension', 'Outcome', 'Killed By', 'Cards', 'Relic Count', 'Total Damage Taken', 'Act Reached', 'Duration', 'Players'];
            
            const rows = filteredRuns.map(run => [
                run.t ? new Date(run.t * 1000).toLocaleDateString() : '-',
                nameMapper.getCharacterName(run.c),
                run.a,
                run.w ? 'Win' : 'Loss',
                run.w ? '-' : (run.k ? nameMapper.getEncounterName(run.k) : '-'),
                run.sz,
                run.rc,
                run.dmg != null ? run.dmg : '-',
                getActReached(run),
                run.dur ? Math.floor(run.dur / 60) + 'm ' + (run.dur % 60) + 's' : '-',
                run.m === 1 ? '1P' : run.m + 'P'
            ]);

            let csvContent = headers.map(h => \`"\${h}"\`).join(',') + '\\n';
            rows.forEach(row => {
                csvContent += row.map(cell => \`"\${cell}"\`).join(',') + '\\n';
            });

            const date = new Date().toISOString().split('T')[0];
            const filename = \`STS2_runs_export_\${date}.csv\`;
            const blob = new Blob([csvContent], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);
        }


        function switchTab(tabName) {
            document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
            document.getElementById(tabName)?.classList.add('active');
            // Mark the matching tab button active by searching by tab name
            document.querySelectorAll('.tab-button').forEach(b => {
                if (b.getAttribute('onclick') === \`switchTab('\${tabName}')\`) b.classList.add('active');
            });
            currentTab = tabName;
            updateDashboard();
        }

        // Add filter listeners (versionFilter wired here; ascensionFilter uses 'input' above)
        document.getElementById('versionFilter')?.addEventListener('change', applyFilters);
    </script>
</body>
</html>`;

  return html;
}

/**
 * Main execution
 */
export function generateDashboardHtml() {
  const data = loadDashboardData();
  const html = generateDashboard(data);
  const outputPath = path.join(OUTPUT_PATH, "dashboard.html");
  fs.writeFileSync(outputPath, html);
  console.log(`✓ Enhanced dashboard generated: ${outputPath}`);
  return outputPath;
}

if (require.main === module) {
  try {
    generateDashboardHtml();
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}



