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
3. Return `{count, data}` (or the endpoint's documented shape) or `{error}` with appropriate HTTP status

### Data Extraction Changes

1. Update `src/analyze/extractRunData.ts`
2. Update `src/analyze/types.ts` if adding fields to ExtractedRun
3. Add `ALTER TABLE … ADD COLUMN` migration to `database.ts`
4. Update `loadAllRunsFromDb()` to map the new column
5. Run `npm run analyze`

### ELO / Analytics Changes

- Card ELO: `eloCalculator.ts` (basic) and `elo.ts` (advanced Glicko-2 model — act-weighted, synergy matrix)
- Relic ELO: `relicEloCalculator.ts`
- Floor stats: `floorAnalytics.ts` → `floor_analytics.json`
- Ancient blessing stats: `ancientAnalytics.ts` → `ancient_analytics.json`
- All four run inside `src/analyze/index.ts`'s Phase 2; outputs land in `output/*.json`

## Quick Reference

```bash
npm run analyze        # Full pipeline — use after data/DB changes
npm run dashboard      # Dashboard only — use after UI/chart changes
npm run extract        # Extraction only — output/extracted_runs.json
npm run reports        # CSV reports only (requires extracted_runs.json)
npm run server         # Express API on :3000
npm run watch          # File watcher for auto-ingestion
npx tsc --noEmit       # Type check only (zero output = no errors)
```

## Full Pipeline Flow

```text
Phase 1: Extract (extractRunData.ts)
  loadAllRuns() → extractAllRuns() → output/extracted_runs.json
  → insertAllRuns() into output/runs.db (SQLite)

Phase 2: Analytics
  eloCalculator.ts          → output/elo_ratings.json (basic card ELO)
  elo.ts                    → output/elo_ratings_advanced.json (Glicko-2 card ELO)
  relicEloCalculator.ts     → output/relic_elo_ratings.json
  floorAnalytics.ts         → output/floor_analytics.json
  ancientAnalytics.ts       → output/ancient_analytics.json

Phase 3: Reports (reports.ts)
  generateAllReports() → output/reports/*.csv (13 files)

Phase 4: Dashboard (generateDashboard_v2.ts)
  generateDashboardHtml() → output/dashboard.html (15 tabs across 6 groups)
```

## File Locations

**Analysis Pipeline:**

- `src/analyze/types.ts` — Type definitions for ExtractedRun and analytics
- `src/analyze/extractRunData.ts` — Parse .run files, extract with Steam ID lookup
- `src/analyze/database.ts` — SQLite schema and operations
- `src/analyze/eloCalculator.ts` — Card ELO ratings (dynamic K-factor: 48/32/24)
- `src/analyze/elo.ts` — Advanced card ELO (Glicko-2, act-weighting, synergy matrix)
- `src/analyze/relicEloCalculator.ts` — Relic ELO ratings (per-character, no ascension split)
- `src/analyze/nameMapper.ts` — Maps raw IDs (e.g. `CARD.BIG_BANG`) to display names
- `src/analyze/floorAnalytics.ts` — Per-floor stats
- `src/analyze/ancientAnalytics.ts` — Ancient blessing ELO/pick/win rates
- `src/analyze/reports.ts` — CSV report generation (13 reports)
- `src/analyze/generateDashboard_v2.ts` — HTML dashboard generation (15 tabs)
- `src/analyze/index.ts` — Pipeline orchestrator
- `validate_dashboard.ts` (project root) — Checks brace/paren/bracket balance in generated dashboard JS

**API Server:**

- `src/server/index.ts` — Express API endpoints
- `src/server/watcher.ts` — fs.watch auto-ingester

**Data Locations:**

- Input: `history/*.run` (raw STS2 save files)
- Database: `output/runs.db` (SQLite)
- Reports: `output/reports/*.csv` (13 analysis reports)
- Dashboard: `output/dashboard.html` (interactive 15-tab dashboard)
- Extracted: `output/extracted_runs.json` (normalized data)
- ELO: `output/elo_ratings.json`, `output/elo_ratings_advanced.json`, `output/relic_elo_ratings.json`

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

### Turn Economy (turnEconomy.csv)

Turn-efficiency metrics generated by `generateTurnEconomy()` — see `reports.ts` for the exact column set.

### Potions (potions.csv)

Offered / picked / bought / used / discarded counts per potion, generated by `generatePotionAnalytics()`.

### ELO Rankings (elo_rankings.csv)

Card/character ELO rankings, generated by `generateELORankings()` only when ELO state is passed into `generateAllReports()`.

---

## Troubleshooting

### "Cannot find module" errors

Run `npm install` to install dependencies.

### Dashboard doesn't load

1. Check that all CSV files exist in `output/reports/`
2. Verify `output/extracted_runs.json` and `output/elo_ratings.json` exist
3. Open browser console (F12) for JavaScript errors
4. If served via `npm run server`, check `http://localhost:3000`; if opened directly, ensure you're opening as `file:///` URL

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
- Add new reports in Phase 3 (additive)
- Add new visualizations in Phase 4 (modular)

## Critical Concepts

### Multiplayer Character Extraction

```typescript
// ❌ WRONG - assumes you're first
const character = run.players[0]?.character;

// ✅ CORRECT - find by Steam ID
const yourPlayer = run.players.find(p => p.id === YOUR_STEAM_ID);
const character = yourPlayer?.character;
```

### Allies Tracking

```typescript
// Extract all other players
const allies = run.players
  .filter(p => p.id !== YOUR_STEAM_ID)
  .map(p => ({id: p.id, c: p.character}));
```

### Database Transactions

```typescript
const txn = db.transaction(() => {
  insertRunStmt.run(...);
  insertCard.run(...);
  insertRelic.run(...);
});
txn();
db.close();  // Always close
```

## Dashboard Features

15 tabs across 6 groups — see `.ai/architecture.md` for the full list (kept canonical there to avoid drift) and `.github/instructions/dashboard.instructions.md` for chart/filter conventions.

### Global Filters (apply across all tabs)

- **Character**: Single character select (Ironclad, Silent, Defect, Necrobinder, Regent)
- **Min Ascension**: Slider (0-10, minimum difficulty threshold)
- **Outcome**: Filter by Wins, Losses, or All runs
- **Mode**: 1P/2P/3P/4P/Any Multiplayer/All

## See Also

- `.github/copilot-instructions.md` - Project-specific AI guidelines
- `.github/instructions/` - Technical specifications by module
- `.ai/architecture.md` - System architecture
- `.ai/rules.md` - Code standards and anti-patterns
- `.ai/prompts.md` - Prompt templates for feature development
- `CHANGELOG.md` - Recent changes and session history
