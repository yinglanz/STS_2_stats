# GitHub Copilot Instructions - STS2 Run Analytics

## Project Overview

**Slay the Spire 2 Run Analytics** — Node.js/TypeScript analytics pipeline that ingests `.run` JSON files, analyzes gameplay data, and generates an interactive single-file HTML dashboard.

### Data Pipeline

```
history/*.run (raw JSON) → extractRunData.ts → runs.db (SQLite)
→ analytics (CSV reports) → generateDashboard_v2.ts → dashboard.html
```

---

## Core Directives

### When Working on This Project

1. **Check instruction files first**: `.github/instructions/{api|dashboard|database}.instructions.md`
2. **Verify database operations**: Use `better-sqlite3` patterns from `database.instructions.md`
3. **Use TypeScript strictly**: No implicit any, explicit return types everywhere
4. **No classes**: Functions and interfaces only
5. **Database safety**: Transactions for multi-table inserts, close immediately after use
6. **Dashboard JS safety**: No TypeScript casts inside template literals (they emit as plain JS)

### Code Standards

**TypeScript:**

- Strict mode in `tsconfig.json`
- Explicit return types on all functions, all parameters typed
- No `as any`, no `const x: T[]` inside embedded JS strings

**Database:**

- `INSERT OR IGNORE` everywhere (never plain `INSERT`)
- Wrap multi-table ops in `db.transaction()`
- `db.close()` after every use — no persistent connections
- Prepared statements for all SQL

**Dashboard JS (embedded in HTML):**

- Always use `safePlot(id, traces, layout, config)` — never `Plotly.newPlot` directly
- Always use `darkLayout(extra)` for Plotly layout objects
- Read from `filteredRuns` in all draw functions — never `DATA.runs`
- `DARK` constant must be defined before `updateDashboard()` is first called

---

## Project Structure

| File | Purpose |
|------|---------|
| `src/config.ts` | `YOUR_STEAM_ID`, `HISTORY_PATH` (single source of truth) |
| `src/analyze/extractRunData.ts` | Parse .run files → ExtractedRun, Steam ID character extraction |
| `src/analyze/database.ts` | SQLite schema, `insertRun`/`insertAllRuns`, migrations |
| `src/analyze/generateDashboard_v2.ts` | Single-file HTML dashboard, 13 tabs, dark theme |
| `src/analyze/eloCalculator.ts` | ELO card ratings per character |
| `src/analyze/types.ts` | TypeScript interfaces |
| `src/server/index.ts` | Express API endpoints |
| `src/server/watcher.ts` | `fs.watch` auto-ingester |

---

## Key Concepts

### ExtractedRun Format

```typescript
{
  id: string;                            // runId (filename stem)
  t: number;                             // startTime
  c: string;                             // character key
  a: number;                             // ascension (0-10)
  w: boolean;                            // won
  m: number;                             // player count (1 = solo)
  alc?: Array<{id: number, c: string}>; // allies (multiplayer only)
  a1c: string[];                         // cards picked in act 1
  a2c: string[];                         // cards picked in act 2
  a3c: string[];                         // cards picked in act 3
  cards: string[];                       // final deck card IDs
  relics: string[];                      // final relic IDs
  potions: Array<{id, o, pk, b, u, d, fo, fu, a}>;
  encs: Array<{id, a, d, s, tp, tu, po, fn, mx}>;
  // + dmg, sz, rc, fl, seed, dur, acts, cp, v, k
}
```

**Critical**: Always extract character via `run.players.find(p => p.id === YOUR_STEAM_ID)`, never `run.players[0]`.

### Database Schema

- `runs` — one row per run, JSON columns: `a1c`, `a2c`, `a3c`, `alc`
- `run_cards` — final deck (run_id, card_id, upgraded)
- `run_relics` — final relics (run_id, relic_id)
- `run_encounters` — per encounter (run_id, enc_id, act, damage, survived, enc_type, turns, …)
- `run_potions` — per potion (run_id, potion_id, offered, picked, bought, used, discarded, …)
- WAL mode, foreign keys ON, all JSON stored as TEXT

### Starter Exclusions

| Character | Starting Relic | Starting Cards |
|---|---|---|
| Ironclad | Burning Blood | Bash, Strike, Defend |
| Silent | Ring of the Snake | Neutralize, Strike, Defend |
| Defect | Cracked Core | Zap, Strike, Defend |
| Necrobinder | Bound Phylactery | Necrotic Bolt, Strike, Defend |
| Regent | Divine Right | Swordburst, Strike, Defend |

Starter cards, Curse cards (`CARD.CURSE_`), and Status cards are excluded.

---

## Dashboard Features (13 Tabs)

**Overview group:** 📊 Overview, 📈 Ascension

**Deck group:** 🃏 Cards (+ per-act win rate), ✨ Relics, 🧪 Potions, 🔗 Synergies (bubble chart)

**Combat group:** ⚔️ Encounters (type labels), 🔥 Heatmap (Plotly + numbers), 🎭 Builds (bar chart)

**Trends group:** 📋 Runs (table + cumulative win rate / Kalman), 🏆 ELO (scatter + per-act win% table)

**Utility group:** 📥 Export, ❓ Help

**Global Filters:** Character, Min Ascension (slider 0-10), Outcome (Win/Loss/All), Mode (1P/2P/3P/4P/All)

### Dark Theme Palette

- Body bg: `#0d1117`, content: `#161b22`, plot bg: `#1a1a2e`, paper bg: `#16213e`
- Gold accent: `#c9a84c`, Green: `#4db87a`, Red: `#e05252`
- Character colors: Ironclad `#e05252`, Silent `#4db87a`, Regent `#c9a84c`, Necrobinder `#9b59b6`, Defect `#3498db`

### DARK Constant (reusable layout)

```javascript
const DARK = {
    plot_bgcolor: '#1a1a2e', paper_bgcolor: '#16213e',
    font: { color: '#e0e0e0', family: 'Segoe UI, sans-serif' },
    xaxis: { gridcolor: '#2a2a4a', zerolinecolor: '#2a2a4a', tickfont: { color: '#aaa' }, titlefont: { color: '#c9a84c' } },
    yaxis: { gridcolor: '#2a2a4a', zerolinecolor: '#2a2a4a', tickfont: { color: '#aaa' }, titlefont: { color: '#c9a84c' } },
    legend: { font: { color: '#ccc' }, bgcolor: 'rgba(0,0,0,0)' },
    hoverlabel: { bgcolor: '#1a1a2e', bordercolor: '#c9a84c', font: { color: '#e0e0e0' } }
};
function darkLayout(extra) { return Object.assign({}, DARK, extra); }
```

---

## API Patterns

**Endpoints:** `GET /runs`, `GET /stats`, `POST /ingest`

**Response Format:**

```typescript
{ count: number; data: any[] }   // list endpoints
{ error: string }                 // errors with HTTP status
```

Always close DB after every request handler.

---

## npm Scripts

| Script | Purpose |
|---|---|
| `npm run analyze` | Full pipeline: extract → DB → ELO → reports → dashboard |
| `npm run dashboard` | Regenerate dashboard.html only (UI changes, no re-extract) |
| `npm run server` | Express API on port 3000 |
| `npm run watch` | File watcher for auto-ingestion |

---

## Recent Major Changes (May 2026)

### ✅ Robustness Hardening

- `extractRun`: throws clearly if `run.players` or `run.map_point_history` missing
- `loadAllRuns`: checks `HISTORY_PATH` exists, validates run structure before returning
- `loadDashboardData`: checks both output files exist before reading, guards division by run count
- `insertRun` (watcher/server path): now inserts potions (was silently dropping them)
- `safePlot()`: all 19 Plotly chart calls go through element-existence check + error catch
- `window.resize`: debounced handler calls `Plotly.Plots.resize` on all visible charts

### ✅ ELO Tab Improvements

- ELO scatter chart: ELO rating vs win rate, bubble size = games played, color by character
- ELO table: aggregated across all ascensions (one row per card per character), per-act win% columns (Act 1/2/3), color-coded win rates

### ✅ Heatmap Numbers

- Character × Ascension Plotly heatmap now shows win rate % as text overlaid on each cell

### ✅ Dashboard UI Redesign (April 2026)

- Full dark theme across all charts using shared `DARK` constant + `darkLayout()`
- 13 tabs in 5 labelled groups with dividers
- Tab Win Rate Trend removed; cumulative win rate chart merged into Runs tab
- New charts: Potions grouped bar, Synergies bubble, Builds bar, Heatmap Plotly

### ✅ Per-Act Card Win Rate

- `a1c`/`a2c`/`a3c` arrays track cards first picked per act
- Cards tab shows per-act win rate chart
- ELO tab table shows Act 1/2/3 win% columns

### 🔴 CRITICAL FIX: Multiplayer Character Extraction

- Character now extracted by Steam ID match, not array position
- Regenerate DB with `npm run analyze` to fix past multiplayer runs

---

## When to Reference Specific Instructions

| Task | Read File |
|------|-----------|
| Adding API endpoints | `.github/instructions/api.instructions.md` |
| Dashboard modifications | `.github/instructions/dashboard.instructions.md` |
| Database queries/schema | `.github/instructions/database.instructions.md` |

---

## Workflow for Changes

1. **Understand** — restate problem, identify affected modules
2. **Check** — read relevant `.github/instructions/` file
3. **Plan** — steps + DB impact
4. **Implement** — scoped edits, no TypeScript in template strings
5. **Validate** — `npm run analyze` for data changes, `npm run dashboard` for UI only, `npx tsc --noEmit` for type safety


## Project Overview
**Slay the Spire 2 Run Analytics** - A Node.js/TypeScript analytics pipeline that ingests run JSON files, analyzes gameplay data, and generates an interactive dashboard with card/relic ratings, encounter stats, and ELO rankings.

### Data Pipeline
```
history/*.run (raw JSON) → extractRunData.ts → runs.db (SQLite) 
→ analytics (CSV/reports) → generateDashboard_v2.ts → dashboard.html
```

---

## Core Directives

### When Working on This Project
1. **Always check instruction files first**: `.github/instructions/{api|dashboard|database}.instructions.md`
2. **Verify database operations**: Use `better-sqlite3` patterns from `database.instructions.md`
3. **Use TypeScript strictly**: No `implicit any`, explicit return types everywhere
4. **No classes**: Use functions and interfaces only
5. **Database safety**: Always use transactions for multi-table inserts, never leave DB connections open

### Code Standards

**TypeScript Requirements:**
- Strict mode enabled in `tsconfig.json`
- Explicit return types on all functions
- No implicit any types
- Type all function parameters

**Database Operations:**
- Use `INSERT OR IGNORE` for duplicates (never overwrite)
- Always wrap multi-table ops in transactions
- Close database immediately after use
- Use prepared statements for SQL queries

**Analytics Logic:**
- Use `better-sqlite3` for queries (faster than in-memory arrays for aggregations)
- ELO calculations: Cards rated by win/loss outcomes per character×ascension
- Starter exclusions: Apply to both cards AND relics per character
- Comments required for complex calculations

### Project Structure

| File | Purpose |
|------|---------|
| `src/analyze/extractRunData.ts` | Parse .run files → ExtractedRun format, starter filtering, character extraction from YOUR_STEAM_ID |
| `src/analyze/database.ts` | SQLite schema, insert/query helpers, transactions |
| `src/analyze/generateDashboard_v2.ts` | Generate single-file HTML dashboard, 13 interactive tabs |
| `src/analyze/eloCalculator.ts` | ELO card ratings with per-character/ascension calculations |
| `src/analyze/types.ts` | TypeScript interfaces (ExtractedRun with allies field) |
| `src/server/index.ts` | Express API endpoints (runs, stats, ingest) |
| `src/server/watcher.ts` | fs.watch auto-ingester for new .run files |

---

## Key Concepts

### ExtractedRun Format
Compact normalized format (~70% smaller than raw RunData):
```typescript
{
  id: string;              // runId
  t: number;               // startTime (chronological ELO ordering)
  c: string;               // character (IRONCLAD, SILENT, DEFECT, NECROBINDER, REGENT)
  a: number;               // ascension (0-10)
  w: boolean;              // won
  m: number;               // multiplayer count (1 = solo, 2+ = multiplayer)
  alc?: Array<{id: number, c: string}>; // allies in multiplayer (all other players except you)
  // ... plus cards, relics, encounters, metrics
}
```

**Critical**: Character must be extracted from `run.players.find(p => p.id === YOUR_STEAM_ID)`, NOT from `run.players[0]`

### Database Schema
- `runs` table: One row per run with final stats + JSON fields (a1c/a2c/a3c for act cards, alc for allies)
- `run_cards`: Final deck cards with upgrade status
- `run_relics`: Final relics in deck
- `run_encounters`: Encounter data per run
- Foreign key constraints enabled, WAL mode for concurrency
- All JSON fields stored as TEXT (parse with JSON.parse in code)

### Allies Tracking
- **Field**: `alc` in ExtractedRun (optional, only for multiplayer)
- **Format**: Array of `{id: steamId, c: character}` 
- **Storage**: JSON string in `runs.alc` column
- **Extraction**: All players in `run.players` except YOUR_STEAM_ID (0000000000000000)
- **Display**: "Allies" column in Runs tab + Export tab shows ally characters

### Starter Exclusions (per character)
| Character | Starting Relic | Starting Cards |
|---|---|---|
| Ironclad | Burning Blood | Bash, Strike, Defend |
| Silent | Ring of the Snake | Neutralize, Strike, Defend |
| Defect | Cracked Core | Zap, Strike, Defend |
| Necrobinder | Bound Phylactery | Necrotic Bolt, Strike, Defend |
| Regent | Divine Right | Swordburst, Strike, Defend |

**Starter cards are excluded** (not player choice), Curse cards and Status cards excluded (involuntary additions)

---

## Dashboard Features (13 Tabs)

1. **Overview** - Win rate by ascension + global stats
2. **Cards** - Pick rate, ELO, win %, deck %
3. **Encounters** - Survivor rate, damage, turns by enemy
4. **Relics** - Pick rate, ELO, win % by relic
5. **Synergies** - Card/relic pairing analysis
6. **Heatmap** - Card picks per act (Red → Character Color → Green), colorscale adapts per character
7. **Builds** - Build archetypes and frequency
8. **Ascension** - Difficulty progression stats
9. **ELO Ratings** - Card strength rankings by character/ascension
10. **Runs** - Individual run details with allies column (multiplayer), expandable rows show ally Steam IDs
11. **Win Rate Trend** - Timeline analysis over time
12. **Export** - CSV download with allies column (respects filters)
13. **Help** - Comprehensive definitions and usage guide (15+ sections on all metrics)

**Dashboard Filters:**
- Character: Single character select (filters analysis)
- Min Ascension: Slider (0-10, minimum difficulty)
- Outcome: Wins/Losses/All
- Mode: 1P/2P/3P/4P/All

---

## API Patterns

**Endpoints:**
- `GET /runs` - Query with params: `?character=IRONCLAD&ascension=5&outcome=win&mode=1P`
- `GET /stats` - Aggregated analytics (cards, relics, encounters)
- `POST /ingest` - Manually ingest run files

**Response Format:**
```typescript
{ count: number; data: any[] }  // for list endpoints
{ error: string }                // errors with appropriate HTTP status
```

**Important:** Close database after EVERY request handler - no persistent connections.

---

## npm Scripts

| Script | Purpose |
|---|---|
| `npm run analyze` | Full pipeline: extract → DB → ELO → reports → dashboard (191 runs) |
| `npm run dashboard` | Regenerate dashboard.html only (useful for UI changes without re-extracting) |
| `npm run server` | Start Express API on port 3000 |
| `npm run watch` | Start file watcher for auto-ingestion of new .run files |

---

## Recent Major Changes

### ✅ Repo-Wide Markdown Lint Fix (April 30, 2026)
- **Scope**: Full audit of all `.md` files — zero linting errors remain
- **Files**: CHANGELOG.md, README_AI.md, SETUP.md, .ai/architecture.md, .ai/rules.md, .ai/prompts.md
- **Rules fixed**: MD022, MD024, MD031, MD032, MD036, MD040, MD060
- **Key changes**: Replaced `**bold**` headings with `####`, added blank lines around fences/lists/headings, added language specifiers to all bare code fences

### 🔴 CRITICAL: Multiplayer Character Fix
- **Problem**: In multiplayer runs, character was extracted from `run.players[0]` assuming you were always first player
- **Solution**: Extract character by matching YOUR_STEAM_ID (0000000000000000) instead of position
- **Impact**: All multiplayer runs now show YOUR correct character, not first player's character
- **Files Modified**: extractRunData.ts, database.ts
- **Data Impact**: Database must be regenerated to fix past multiplayer runs

### ✅ Allies Tracking System
- **Added**: `alc` field to ExtractedRun interface (Array<{id, c}>)
- **Storage**: JSON field in runs.alc TEXT column
- **Display**: "Allies" column in Runs tab shows ally characters, expandable rows show Steam IDs
- **Export**: CSV includes Allies column with character names
- **Database**: Migration: `ALTER TABLE runs ADD COLUMN alc TEXT`

### ✅ Dashboard Help Tab
- **Added**: New Help (❓) tab as 13th tab
- **Content**: 15+ sections covering all metrics, filters, tabs, and definitions
- **Sections**: ELO, Pick Rate, Deck %, Win %, Synergies, Multiplayer modes, Tips
- **Styling**: STS2 themed with gold (#c9a84c) left borders, dark backgrounds
- **Purpose**: User reference guide for understanding all dashboard features

### ✅ Ascension Filter Upgrade
- Changed from dropdown (exact match) to slider (minimum value)
- Range: 0-10, shows "Min Ascension: X" label
- Benefit: Can now see aggregated data for "Asc 5+" instead of just "Asc 5" only
- Files: generateDashboard_v2.ts

### ✅ Card Heatmap STS2 Theming
- Custom colorscale: Red (#e05252) → Character Color → Green (#4db87a)
- Mid-color adapts: Uses character's primary color when single character filtered, gold (#c9a84c) otherwise
- Files: generateDashboard_v2.ts

---

## When to Reference Specific Instructions

| Task | Read File |
|------|-----------|
| Adding API endpoints | `.github/instructions/api.instructions.md` |
| Dashboard modifications | `.github/instructions/dashboard.instructions.md` |
| Database queries/schema | `.github/instructions/database.instructions.md` |

---

## Workflow for Changes

**ALWAYS before coding:**
1. **Understand** - Restate problem, identify constraints
2. **Check** - Reference relevant instruction file from `.github/instructions/`
3. **Plan** - Break into steps, identify database impacts
4. **Implement** - Execute step-by-step, keep changes scoped
5. **Validate** - Run `npm run analyze` to verify full pipeline

---

## Communication
- Be concise and fact-based
- Show plan before major changes (especially database schema changes)
- Reference relevant .run file structures when debugging extraction
- Always validate with `npm run analyze` after code changes
- For UI updates only: run `npm run dashboard` to regenerate dashboard.html without full pipeline
- Document changes in this file's "Recent Major Changes" section for future reference

