# AI Development Workflow - STS2 Run Analytics

## Standard Process

### 1. Understand

- Restate the problem in STS2 context
- Identify affected modules (extract / database / dashboard / api)
- Check if multiplayer/character extraction is involved (CRITICAL)
- Identify database schema impacts

### 2. Plan

- Reference `.github/instructions/` for module-specific patterns
- Break into steps, highlight risks (especially DB schema changes)
- Choose approach: prefer minimal edits

### 3. Implement

- Execute step-by-step, keep changes scoped
- Use transaction patterns from `database.instructions.md`
- Never use TypeScript casts inside JS template literals (they become plain JS in HTML)

### 4. Validate

- `npm run analyze` — full pipeline (extract → DB → ELO → reports → dashboard)
- `npx tsc --noEmit` — must produce zero errors
- `npm run dashboard` — faster, for UI-only changes

## Rules

- ❌ NEVER jump straight to code for complex changes
- ✅ ALWAYS reference `.github/instructions/` for module patterns
- ✅ ALWAYS use transactions for multi-table database operations
- ✅ ALWAYS close database connections immediately after queries
- ❌ NEVER use `run.players[0]` for character extraction
- ✅ ALWAYS use Steam ID matching for character extraction
- ❌ NEVER use plain `INSERT` (always `INSERT OR IGNORE`)
- ✅ ALWAYS include explicit return types on all functions
- ❌ NEVER use `Plotly.newPlot` directly — use `safePlot()`
- ✅ ALWAYS use `darkLayout()` for Plotly layout objects

## Module-Specific Workflows

### Database Operations

See `.github/instructions/database.instructions.md`:

1. Write SQL with prepared statements
2. Wrap multi-table ops in `db.transaction()`
3. Use `INSERT OR IGNORE`
4. Parse JSON fields at query time
5. Close DB immediately
6. Keep `insertRun` and `insertAllRuns` in sync (same child rows: cards, relics, encounters, potions)

### Dashboard Changes

See `.github/instructions/dashboard.instructions.md`:

1. Modify `generateDashboard_v2.ts`
2. Add tab button in `.tabs` div with appropriate group divider
3. Add `<div id="tabId" class="tab-content">` with chart + table containers
4. Add case in `updateDashboard()`: `else if (currentTab === 'tabId') { drawMyChart(); }`
5. Implement draw function using `safePlot()` and `darkLayout()`, reading `filteredRuns`
6. Run `npm run dashboard` to regenerate

### API Endpoints

See `.github/instructions/api.instructions.md`:

1. Add route to `src/server/index.ts`
2. `openDb()` → query → `db.close()` within handler
3. Return `{count, data}` or `{error}` with appropriate HTTP status

### Data Extraction Changes

1. Update `src/analyze/extractRunData.ts`
2. Update `src/analyze/types.ts` if adding fields to ExtractedRun
3. Add `ALTER TABLE … ADD COLUMN` migration to `database.ts`
4. Update `loadAllRunsFromDb()` to map the new column
5. Run `npm run analyze`

### Adding a New Chart

1. Add a `<div class="chart" id="chartMyName">` in the tab HTML
2. Write `function drawMyChart()` using `safePlot('chartMyName', …, darkLayout({…}), {responsive:true})`
3. Call it from the tab's case in `updateDashboard()`
4. Use `filteredRuns` not `DATA.runs`

## Quick Reference

```bash
npm run analyze        # Full pipeline — use after data/DB changes
npm run dashboard      # Dashboard only — use after UI/chart changes
npm run server         # Express API on :3000
npm run watch          # File watcher for auto-ingestion
npx tsc --noEmit       # Type check only (zero output = no errors)
```


## Standard Process

### 1. Understand
- Restate the problem in STS2 context
- Identify affected modules (extract/database/dashboard/api)
- Check if multiplayer/character extraction is involved (CRITICAL)
- Identify database impacts

### 2. Plan
- Reference `.github/instructions/` for module-specific patterns
- Break into steps
- Highlight risks (especially database schema changes)
- Choose approach (prefer minimal edits)

### 3. Implement
- Execute step-by-step
- Keep changes scoped and minimal
- Use transaction patterns from database.instructions.md
- Update database schema if needed

### 4. Validate
- Run `npm run analyze` to verify full pipeline
- Check TypeScript compilation (strict mode)
- Verify database operations complete
- For UI only: `npm run dashboard` to regenerate

## Rules
- ❌ NEVER jump straight to code for complex changes
- ✅ ALWAYS reference `.github/instructions/` for module patterns
- ✅ ALWAYS use transactions for multi-table database operations
- ✅ ALWAYS close database connections immediately after queries
- ❌ NEVER use `run.players[0]` for character extraction
- ✅ ALWAYS use Steam ID matching for multiplayer character extraction
- ❌ NEVER use `INSERT` (always use `INSERT OR IGNORE`)
- ✅ ALWAYS include explicit return types on all functions

## Module-Specific Workflows

### Database Operations
See `.github/instructions/database.instructions.md`:
1. Write SQL with prepared statements
2. Wrap multi-table ops in `db.transaction()`
3. Use `INSERT OR IGNORE` to prevent overwrites
4. Parse JSON fields at query time
5. Close database immediately

### Dashboard Changes
See `.github/instructions/dashboard.instructions.md`:
1. Modify generateDashboard_v2.ts
2. Add tab button in navigation with `onclick="switchTab('tabId')"`
3. Add tab content div with `id="tabId" class="tab-content"`
4. Add data loading function (e.g., `drawPotionsTable()` for Potions tab)
5. Update `switchTab()` function to call your rendering function
6. Run `npm run dashboard` to regenerate

### API Endpoints
See `.github/instructions/api.instructions.md`:
1. Add route to src/server/index.ts
2. Query database with prepared statements
3. Close database before returning
4. Return {count, data} format or {error}

### Data Extraction
1. Update src/analyze/extractRunData.ts for parsing logic
2. Update src/analyze/types.ts for new fields
3. Add database migrations to database.ts
4. Update loadAllRunsFromDb() for new fields

## Quick Start

```bash
# Install dependencies
npm install

# Run full pipeline (extract → db → ELO → reports → dashboard)
npm run analyze

# Regenerate dashboard only (UI changes)
npm run dashboard

# Start development server
npm run server    # API on port 3000

# Watch for new .run files
npm run watch

# Check TypeScript
npm run build
```

## Full Pipeline Flow

```
Phase 1: Extract (extractRunData.ts)
  ↓ loadAllRuns() → extractAllRuns()
  ↓ output/extracted_runs.json
  ↓ Insert to runs.db (SQLite)
  
Phase 2: Calculate ELO (eloCalculator.ts)
  ↓ calculateELOFromRuns()
  ↓ output/elo_ratings.json
  
Phase 3: Generate Reports (reports.ts)
  ↓ generateAllReports()
  ↓ output/reports/*.csv (11 CSV files)
  
Phase 4: Generate Dashboard (generateDashboard_v2.ts)
  ↓ generateDashboardHtml()
  ↓ output/dashboard.html (10 interactive tabs)
```

## File Locations

**Analysis Pipeline:**
- `src/analyze/types.ts` — Type definitions for ExtractedRun and analytics
- `src/analyze/extractRunData.ts` — Parse .run files, extract with Steam ID lookup
- `src/analyze/database.ts` — SQLite schema and operations
- `src/analyze/eloCalculator.ts` — Card/relic ELO ratings per character/ascension
- `src/analyze/reports.ts` — CSV report generation (11 reports)
- `src/analyze/generateDashboard_v2.ts` — HTML dashboard generation (10 tabs)
- `src/analyze/index.ts` — Pipeline orchestrator

**API Server:**
- `src/server/index.ts` — Express API endpoints
- `src/server/watcher.ts` — fs.watch auto-ingester

**Data Locations:**
- Input: `history/*.run` (raw STS2 save files)
- Database: `output/runs.db` (SQLite)
- Reports: `output/reports/*.csv` (13 analysis reports)
- Dashboard: `output/dashboard.html` (interactive 10-tab dashboard)
- Extracted: `output/extracted_runs.json` (normalized data)
- ELO: `output/elo_ratings.json` (card ratings)

## Common Tasks

### Run Complete Analysis Pipeline

```bash
npm run analyze
```

This executes all phases in sequence:

1. **Phase 1**: Loads all run files, extracts and normalizes data
   - Parses ~200 run JSON files from `history/`
   - Extracts cards, relics, encounters, build metrics per run
   - Calculates global statistics
   - Outputs: `output/extracted_runs.json`

2. **Phase 2**: Generates CSV reports
   - `cards.csv` — Card pick rates, win rates, upgrade frequency
   - `encounters.csv` — Encounter survival rates, deadliest encounters
   - `relics.csv` — Relic pick rates, win rates, frequency in winning builds
   - `builds.csv` — Build archetypes by character/ascension with top cards/relics
   - `ascension.csv` — Win rates and metrics per ascension level
   - `cardSynergies.csv` — Top 50 card pairs by win rate (min 3 co-occurrences)
   - `relicSynergies.csv` — Top 50 relic pairs by win rate (min 2 co-occurrences)
   - `characterAscensionHeatmap.csv` — Win rate grid by character × ascension
   - `encountersByAct.csv` — Per-act encounter survival rates
   - `deckSizeTargets.csv` — Optimal deck size targets per ascension level

3. **Phase 3**: Generates interactive dashboard
   - `output/dashboard.html` — Single-file HTML dashboard with Plotly.js charts
   - Built by `generateDashboard_v2.ts` with enhanced filtering and visualizations
   - Open in browser to explore

### View Interactive Dashboard

After running analysis, open `output/dashboard.html` in any web browser:

```text
file:///C:/code/STS_2_stats/output/dashboard.html
```

**Dashboard Features:**

- **Overview Tab** — Win rate by ascension & character
- **Cards Tab** — Heat map (pick rate vs win rate), top cards
- **Encounters Tab** — Survival rates, deadliest fights, encounters that end runs
- **Relics Tab** — Tier list, win rates, relic frequency
- **Builds Tab** — Archetype breakdown by character/ascension
- **Ascension Tab** — Difficulty curve, stats by ascension level
- **Timeline Tab** — Skill progression (rolling win rate over time)

**Filtering:**

- Ascension level slider (min ascension)
- Character filter
- Outcome filter (all/wins only/losses only)
- Real-time chart updates

### Extract Data Only

```bash
npm run extract
```

Parses all run files and outputs `output/extracted_runs.json`. This is the normalized data source for all downstream analysis.

**Key Extraction Logic:**

- Cards: Tracks offered → picked → upgraded lifecycle
- Relics: Tracks offered → picked → final deck presence
- Encounters: Classifies as Boss/Elite/Regular with act number
- Outcomes: Win = `killed_by_encounter === "NONE.NONE"`

### Generate CSV Reports Only

```bash
npm run reports
```

Requires `output/extracted_runs.json` from previous extraction. Generates all CSV files in `output/reports/`.

**Export to Excel:**
All CSV files can be imported directly into Excel/Sheets for pivot tables, manual analysis, etc.

### Generate Dashboard Only

```bash
npm run dashboard
```

Requires all CSV files in `output/reports/`. Generates single interactive HTML file with embedded data and visualizations.

---

## Data Analysis Guide

### Card Analytics (cards.csv)

**Columns**: Card ID | Offered Count | Picked Count | Pick Rate (%) | Upgraded Count | Upgrade Rate (%) | Win Rate With Card (%) | Avg Deck Size When Picked

**Usage:**

- Identify strong cards: High pick rate + high win rate
- Find trap cards: High pick rate + low win rate
- Discover hidden gems: Low pick rate + high win rate
- Compare by ascension/character in dashboard

### Encounter Analytics (encounters.csv)

**Columns**: Encounter ID | Type (Boss/Elite/Monster) | Fought Count | Survived Count | Survival Rate (%) | Avg Damage Taken | Times Ended Run

**Usage:**

- Find deadliest encounters (sort by survival rate)
- Identify encounters that end runs most frequently
- See which are optional vs must-win fights
- Understand power progression (elites tougher in later acts)

### Relic Analytics (relics.csv)

**Columns**: Relic ID | Offered Count | Picked Count | Pick Rate (%) | Win Rate With Relic (%) | Avg Final Deck Count

**Usage:**

- Tier list relics by pick rate vs win rate
- See which relics enable winning strategies
- Identify essential vs situational relics
- Check if frequently picked relics actually help

### Build Archetypes (builds.csv)

**Columns**: Character | Ascension | Total Runs | Wins | Win Rate (%) | Avg Deck Size | Avg Relics | Top 3 Cards | Top 3 Relics

**Usage:**

- Compare character win rates across ascensions
- See most common cards/relics per character
- Identify synergies (cards/relics that appear together)
- Benchmark deck composition for different strategies

### Ascension Difficulty (ascension.csv)

**Columns**: Ascension Level | Total Runs | Wins | Win Rate (%) | Avg Deck Size | Avg Relics | Deadliest Encounter

**Usage:**

- Track skill progression as ascension increases
- Identify difficulty spike points (where win rate drops)
- See if deck/relic strategy changes with difficulty
- Know worst enemies at each ascension

### Card Synergies (cardSynergies.csv)

**Columns**: Card Pair | Co-Occurrences | Wins Together | Win Rate (%)

**Usage:**

- Discover which card combinations win most often
- Identify powerful two-card cores to build around
- Filter out noise — only pairs appearing 3+ times included
- Top 50 pairs sorted by win rate

### Relic Synergies (relicSynergies.csv)

**Columns**: Relic Pair | Co-Occurrences | Wins Together | Win Rate (%)

**Usage:**

- Find relic combinations that appear in winning runs
- Identify essential relic pairings per character
- Only pairs appearing 2+ times included
- Top 50 pairs sorted by win rate

### Character × Ascension Heatmap (characterAscensionHeatmap.csv)

**Columns**: Character | Ascension | Runs | Wins | Win Rate (%)

**Usage:**

- See win rates for every character at every ascension level
- Identify which characters scale best with difficulty
- Find your strongest character at your current ascension

### Encounters by Act (encountersByAct.csv)

**Columns**: Act | Encounter | Encountered | Survived | Survival Rate (%)

**Usage:**

- Compare the same encounter's difficulty across acts
- See which act has the most dangerous encounters
- Sorted by act then survival rate

### Deck Size Targets (deckSizeTargets.csv)

**Columns**: Ascension | Avg Deck Size in Wins | Avg Deck Size in Losses | Recommended Target

**Usage:**

- Know the optimal deck size for your ascension level
- See if over/under-drafting is hurting win rate
- Benchmark deck pruning decisions

---

## Implementation Details

### Phase 1: Data Extraction

**Location**: `src/analyze/extractRunData.ts`

**Key Functions:**

- `loadAllRuns()` — Reads all .run files from `history/`
- `extractRun(run, runId)` — Normalizes single run into typed structure
- `extractAllRuns(runs)` — Batch extraction with error handling
- `calculateGlobalStats(runs)` — Aggregates statistics across all runs

**Data Flow:**

1. Read JSON run files → `RunData` type
2. Extract per-floor data → track cards/relics/encounters
3. Normalize IDs and classifications
4. Output `ExtractedRun[]` with clean schema

### Phase 2: Report Generation

**Location**: `src/analyze/reports.ts`

**Functions per Report:**

- `generateCardAnalytics()` — Aggregates card data across runs
- `generateEncounterAnalytics()` — Groups encounter stats with act breakdown
- `generateRelicAnalytics()` — Tracks relic outcomes
- `generateBuildArchetypes()` — Character/ascension combinations
- `generateAscensionStats()` — Per-ascension metrics
- `generateCardSynergyPairs()` — Top 50 card co-occurrence pairs by win rate
- `generateRelicSynergyPairs()` — Top 50 relic co-occurrence pairs by win rate
- `generateCharacterAscensionHeatmap()` — Win rate grid by character × ascension
- `generateEncounterByAct()` — Per-act encounter survival
- `generateDeckSizeTargets()` — Deck size analysis per ascension
- `generateAllReports()` — Orchestrates all reports in one call

### Phase 3: Dashboard Generation

**Location**: `src/analyze/generateDashboard_v2.ts`

**Architecture:**

- Single-file HTML with embedded CSS + JavaScript
- Plotly.js library (CDN) for charts
- Client-side filtering (no server needed)
- Reads all CSV reports + `extracted_runs.json`
- Responsive design (mobile-friendly)

**Key Functions:**

- `generateDashboardHtml()` — Entry point, reads CSVs and calls `generateDashboard(data)`
- `generateDashboard(data)` — Builds the full HTML string with embedded data
- `parseCsv(filepath)` — Internal CSV parser with quote handling

**Charts:**

- Bar charts: Pick rates, win rates, survival rates
- Scatter plot: Card heat map (pick rate vs win rate)
- Line chart: Win rate trend over time
- Heatmap: Character × ascension win rates
- Tables: Detailed breakdowns with synergy data

---

## Troubleshooting

### "Cannot find module" errors

Run `npm install` to install TypeScript dependencies.

### Dashboard doesn't load

1. Check that all CSV files exist in `output/reports/`
2. Verify `output/extracted_runs.json` exists
3. Open browser console (F12) for JavaScript errors
4. Ensure you're opening as `file:///` URL, not `http://`

### Empty charts in dashboard

1. Verify run files were successfully extracted
2. Check `output/extracted_runs.json` has data
3. Confirm CSV files have content (not headers-only)
4. Check that filters aren't excluding all data

### CSV files are empty (headers only)

1. Run `npm run extract` to regenerate extracted data
2. Run `npm run reports` to regenerate reports
3. Verify `history/` contains .run files

---

## Performance Notes

- **Extraction**: ~200+ runs processed in <1s
- **Reports**: CSV files generated in <200ms
- **Dashboard**: Renders in browser in ~500ms
- **Total Pipeline**: Complete analysis in <2s

For adding new features:

- Keep extraction logic in Phase 1 (single pass)
- Add new reports in Phase 2 (additive)
- Add new visualizations in Phase 3 (modular)

## Critical Concepts

### Multiplayer Character Extraction
```typescript
// ❌ WRONG - assumes you're first
const character = run.players[0]?.character;

// ✅ CORRECT - find by Steam ID
const yourPlayer = run.players.find(p => p.id === 0000000000000000);
const character = yourPlayer?.character;
```

### Allies Tracking
```typescript
// Extract all other players
const allies = run.players
  .filter(p => p.id !== 0000000000000000)
  .map(p => ({id: p.id, c: p.character}));
```

### Database Transactions
```typescript
const txn = db.transaction(() => {
  insertRunStmt.run(...);
  insertCard.run(...);
  insertRelic.run(...);
});
txn([...]);  // Execute
db.close();  // Always close
```

### TypeScript Strict Mode
```typescript
// ❌ WRONG
function getValue(item) {
  return item.value;
}

// ✅ CORRECT
function getValue(item: {value: number}): number {
  return item.value;
}
```

## Dashboard Features

### Current Tabs (10 Total)
1. **Overview** - Global statistics, win rates by ascension
2. **Cards** - Card analytics, pick rates, ELO, win rates
3. **Encounters** - Encounter survival rates, damage analysis
4. **Relics** - Relic analytics, pick rates, ELO
5. **Synergies** - Card and relic pairing analysis
6. **Heatmap** - Card picks per act with color gradient (Red → Character Color → Green)
7. **Builds** - Build archetypes and patterns
8. **Ascension** - Difficulty progression statistics
9. **Potions** - Potion usage statistics and frequency (NEW)
10. **Help** - Comprehensive user guide with 15+ sections

### Global Filters (apply across all tabs)
- **Character**: Single character select (Ironclad, Silent, Defect, Necrobinder, Regent)
- **Min Ascension**: Slider (0-10, minimum difficulty threshold)
- **Outcome**: Filter by Wins, Losses, or All runs
- **Mode**: Filter by multiplayer count (1P/2P/3P/4P/All)

### CSV Reports Generated

All 13 reports are generated and loaded by the dashboard:
- `cards.csv` - Pick rate, ELO, win %, deck %
- `encounters.csv` - Survivor rate, damage, turns
- `relics.csv` - Pick rate, ELO, win %
- `builds.csv` - Build archetypes
- `ascension.csv` - Win rates by difficulty
- `cardSynergies.csv` - Top card pairings
- `relicSynergies.csv` - Top relic pairings
- `characterAscensionHeatmap.csv` - Win rate grid
- `encountersByAct.csv` - Per-act encounter stats
- `deckSizeTargets.csv` - Optimal deck sizes
- `elo_rankings.csv` - Card/relic ELO rankings
- `turnEconomy.csv` - Turn-based metrics
- `potions.csv` - Potion usage statistics

## See Also
- `.github/copilot-instructions.md` - Project-specific AI guidelines
- `.github/instructions/` - Technical specifications by module
- `.ai/architecture.md` - System architecture
- `.ai/rules.md` - Code standards and anti-patterns
- `.ai/prompts.md` - Prompt templates for feature development
- `CHANGELOG.md` - Recent changes and session history
