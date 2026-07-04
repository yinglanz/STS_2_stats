# Architecture Overview - STS2 Run Analytics

## Project Purpose

A Node.js/TypeScript analytics pipeline that automatically ingests Slay the Spire 2 `.run` files, analyzes gameplay data, and generates an interactive HTML dashboard with card/relic ratings, encounter statistics, and multiplayer ally tracking.

## Data Pipeline

```text
history/*.run (raw JSON)
    ↓
extractRunData.ts (Parse + normalize + extract character by Steam ID)
    ↓
runs.db (SQLite database with better-sqlite3)
    ↓
ELO calculators (eloCalculator.ts, elo.ts, relicEloCalculator.ts) + floor/ancient analytics
    ↓
reports.ts (13 CSV reports → output/reports/)
    ↓
generateDashboard_v2.ts (Generate single-file HTML dashboard)
    ↓
output/dashboard.html (15-tab interactive dashboard with Plotly.js)
```

## Core Modules

**Data Layer:**

- `src/config.ts` — `YOUR_STEAM_ID` and `HISTORY_PATH` constants (single source of truth)
- `extractRunData.ts` — Parses .run JSON files, extracts character by Steam ID, normalizes to ExtractedRun, filters starter cards/relics. Validates run structure before extraction.
- `database.ts` — SQLite schema, insert/query helpers, WAL mode, transactions, migrations via `ALTER TABLE … ADD COLUMN` blocks
- `types.ts` — TypeScript interfaces for RunData, ExtractedRun, ELOState, analytics aggregations

**Analytics:**

- `eloCalculator.ts` — Basic card ELO ratings per character×ascension, dynamic K-factor (48→32→24), ascension scaling → `elo_ratings.json`
- `elo.ts` — Advanced card ELO (Glicko-2 rating + deviation/volatility, act-weighted scoring, acquisition-floor weighting, pairwise synergy matrix) → `elo_ratings_advanced.json`
- `relicEloCalculator.ts` — Relic ELO per character (no ascension split — relics persist across acts) → `relic_elo_ratings.json`
- `nameMapper.ts` — Maps raw STS2 IDs (e.g. `CARD.BIG_BANG`) to friendly display names
- `reports.ts` — Generates 13 CSV reports from extracted runs (includes skippedCount per card)
- `floorAnalytics.ts` — Per-floor stats grouped by floorType×actName×actIndex×version → `floor_analytics.json`
- `ancientAnalytics.ts` — Ancient blessing ELO + pick/win rates across all 3 acts → `ancient_analytics.json`

**API / Interface:**

- `generateDashboard_v2.ts` — Single-file HTML dashboard, 15 tabs, Plotly.js charts, dark theme, `safePlot()` wrapper, `DARK` layout constant
- `server/index.ts` — Express API endpoints
- `server/watcher.ts` — `fs.watch` auto-ingester for new .run files

**External Dependencies:**

- Node.js 18+, TypeScript (strict), better-sqlite3, Express, Plotly.js v2.27.0

## Key Architecture Decisions

### Central Config (`src/config.ts`)

All Steam ID and path references import from one file. Change here → affects all modules.

```typescript
export const YOUR_STEAM_ID = 0000000000000000;
export const HISTORY_PATH = "C:\\Users\\...\\history";
```

### Character Extraction (CRITICAL)

- **Problem**: Multiplayer runs have multiple players; array position is not reliable
- **Solution**: `run.players.find(p => p.id === YOUR_STEAM_ID) ?? run.players[0]`
- **Impact**: Affects all multiplayer runs; never use `run.players[0]` directly

### Allies Tracking

- Field: `alc` — `Array<{id: number, c: string}>`
- Storage: JSON string in `runs.alc TEXT` column
- Extraction: all players where `p.id !== YOUR_STEAM_ID`
- Display: character names in main UI, Steam IDs in expandable detail rows

### ExtractedRun Compact Format

```typescript
{
  id, t, c, a, w, m,        // run identity
  dmg, sz, rc, fl, dur,     // metrics
  seed, acts, cp, v, k,     // meta
  a1c, a2c, a3c,            // cards picked per act (string[])
  a1sk, a2sk, a3sk,         // card reward screens skipped per act (number)
  skippedCards,             // card IDs offered but not taken (string[])
  alc?,                      // allies (multiplayer only)
  cards, relics,             // final deck
  potions, encs              // detail arrays
}
```

### Database Strategy

- SQLite + better-sqlite3 (synchronous, fast for local use)
- WAL mode, foreign keys enabled
- `INSERT OR IGNORE` everywhere — idempotent pipeline
- Transactions for all multi-table inserts (`insertRun`, `insertAllRuns`)
- JSON fields stored as TEXT, parsed at query time
- Schema migrations via `try { db.exec('ALTER TABLE … ADD COLUMN …') } catch {}` blocks

### Dashboard Architecture

- Single self-contained HTML file (no build step for viewers)
- All JS inline; Plotly.js loaded from CDN
- `const DARK` layout constant defined before first use (temporal dead zone safe)
- `safePlot(id, traces, layout, config)` wrapper — checks element exists, catches errors
- `darkLayout(extra)` merges extra properties onto `DARK` for every chart
- Debounced `window.resize` handler calls `Plotly.Plots.resize` on all charts
- Tab routing in `updateDashboard()` calls per-tab draw functions on `filteredRuns`

## Dashboard Tabs (15 Total)

**Run:** 📊 Overview, 📈 Ascension, 📋 Runs

**Deck:** 🃏 Cards, ✨ Relics, 🧪 Potions, 🔗 Synergies

**Combat:** ⚔️ Encounters, 🔥 Heatmap, 🎭 Builds

**Map:** 🗺️ Floors, 🌟 Ancients

**Analysis:** 🏆 ELO

**Utility:** 📥 Export, ❓ Help

### Global Filters

- Character, Min Ascension (slider), Outcome, Mode — applied in that order on `filteredRuns`
- Mode values: `"1"` / `"2"` / `"3"` / `"4"` (exact count) or `"multi"` (any `m > 1`), empty = all
- `switchTab(name)` finds the active button via `onclick` attribute scan — safe to call programmatically

## Code Standards

### TypeScript

- Strict mode, explicit return types, no implicit any

### Database

- `INSERT OR IGNORE` (never plain `INSERT`)
- Close DB after every operation
- Prepared statements, transactions

### Dashboard JS (embedded in HTML)

- No TypeScript casts (`as any`, `as T[]`) inside template literals — they become plain JS
- Use `safePlot()` not `Plotly.newPlot()` directly
- Read from `filteredRuns` (never `DATA.runs`) in draw functions

### Validation Rules

- Validate run structure before extraction (throws on missing `players` or `map_point_history`)
- `loadAllRuns` checks `HISTORY_PATH` exists and skips structurally invalid files
- `loadDashboardData` checks both `extracted_runs.json` and `elo_ratings.json` exist before reading

## File Organization

```text
src/
├── config.ts                        # YOUR_STEAM_ID, HISTORY_PATH
├── analyze/
│   ├── types.ts                     # ExtractedRun, RunData, ELOState interfaces
│   ├── extractRunData.ts            # Parse .run → ExtractedRun
│   ├── database.ts                  # SQLite operations
│   ├── eloCalculator.ts             # Basic card ELO ratings
│   ├── elo.ts                       # Advanced card ELO (Glicko-2)
│   ├── relicEloCalculator.ts        # Relic ELO ratings
│   ├── nameMapper.ts                # Raw ID → display name mapping
│   ├── floorAnalytics.ts            # Floor stats → floor_analytics.json
│   ├── ancientAnalytics.ts          # Ancient blessing ELO → ancient_analytics.json
│   ├── reports.ts                   # CSV report generation
│   ├── generateDashboard_v2.ts      # HTML dashboard generation
│   └── index.ts                     # Pipeline orchestrator
└── server/
    ├── index.ts                     # Express API
    └── watcher.ts                   # File watcher

validate_dashboard.ts                # Brace/paren/bracket balance check on generated dashboard JS

output/ (auto-generated)
├── runs.db                          # SQLite database
├── extracted_runs.json              # Normalized run array
├── elo_ratings.json                 # Basic ELO state by char/asc/card
├── elo_ratings_advanced.json        # Glicko-2 ELO state
├── relic_elo_ratings.json           # Relic ELO state by char/relic
├── floor_analytics.json             # Floor stats
├── ancient_analytics.json           # Ancient blessing stats
├── dashboard.html                   # Interactive dashboard
└── reports/*.csv                    # 13 analytics CSVs

.github/
├── copilot-instructions.md          # AI development guidelines
└── instructions/
    ├── database.instructions.md
    ├── dashboard.instructions.md
    └── api.instructions.md

.ai/
├── architecture.md                  # This file
├── rules.md                         # Development rules
├── workflow.md                      # Standard processes
└── prompts.md                       # Custom prompts
```

## CSV Reports

| Report | Purpose |
| --- | --- |
| `cards.csv` | Pick rate, ELO, win rate per card |
| `encounters.csv` | Survival rate, damage, turns per encounter |
| `relics.csv` | Pick rate, ELO, win rate per relic |
| `builds.csv` | Build archetypes by character/ascension |
| `ascension.csv` | Win rate, deck size, relic count per ascension |
| `cardSynergies.csv` | Co-occurring card pairs and win rates |
| `relicSynergies.csv` | Co-occurring relic pairs and win rates |
| `characterAscensionHeatmap.csv` | Win rate grid (character × ascension) |
| `encountersByAct.csv` | Per-act encounter survival stats |
| `deckSizeTargets.csv` | Optimal deck sizes per ascension |
| `potions.csv` | Offered / picked / used per potion |
| `turnEconomy.csv` | Turn-efficiency metrics |
| `elo_rankings.csv` | ELO rankings by card / character (only written when ELO state is passed to `generateAllReports`) |

## See Also

- [copilot-instructions.md](.github/copilot-instructions.md) — Project-specific AI guidelines
- [CHANGELOG.md](CHANGELOG.md) — Recent changes
- [README.md](README.md) — Project overview and quick start
- `.github/instructions/` — Technical specifications by module
