# GitHub Copilot Instructions - STS2 Run Analytics

## Project Overview

**Slay the Spire 2 Run Analytics** — Node.js/TypeScript analytics pipeline that ingests `.run` JSON files, analyzes gameplay data, and generates an interactive single-file HTML dashboard.

### Data Pipeline

```text
history/*.run (raw JSON) → extractRunData.ts → runs.db (SQLite)
→ ELO calculators (cards/relics/advanced) + floor/ancient analytics
→ reports.ts (CSV reports) → generateDashboard_v2.ts → dashboard.html
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
| `src/analyze/eloCalculator.ts` | Basic card ELO ratings per character (dynamic K-factor 48/32/24) |
| `src/analyze/elo.ts` | Advanced card ELO (Glicko-2, act-weighting, synergy matrix) → `elo_ratings_advanced.json` |
| `src/analyze/relicEloCalculator.ts` | Relic ELO ratings per character (no ascension split) → `relic_elo_ratings.json` |
| `src/analyze/nameMapper.ts` | Maps raw IDs (e.g. `CARD.BIG_BANG`) to friendly display names |
| `src/analyze/floorAnalytics.ts` | Per-floor stats → `floor_analytics.json` |
| `src/analyze/ancientAnalytics.ts` | Ancient blessing ELO across all 3 acts → `ancient_analytics.json` |
| `src/analyze/reports.ts` | CSV report generation (13 reports) |
| `src/analyze/generateDashboard_v2.ts` | Single-file HTML dashboard, 15 tabs, dark theme |
| `src/analyze/index.ts` | Pipeline orchestrator |
| `src/server/index.ts` | Express API endpoints |
| `src/server/watcher.ts` | `fs.watch` auto-ingester |
| `validate_dashboard.ts` (project root) | Checks brace/paren/bracket balance in generated dashboard JS |

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
  a1sk: number; a2sk: number; a3sk: number; // card reward screens skipped per act
  skippedCards: string[];                // card IDs offered but not taken
  cards: string[];                       // final deck card IDs
  cardsMeta: Array<{id: string, floor: number, upgraded: boolean}>;
  relics: string[];                      // final relic IDs
  potions: Array<{id, o, pk, b, u, d}>;
  encs: Array<{id, a, s}>;
  // + dmg, sz, rc, fl, seed, dur, acts, cp, v, k
}
```

**Critical**: Always extract character via `run.players.find(p => p.id === YOUR_STEAM_ID)`, never `run.players[0]`.

### Database Schema

- `runs` — one row per run, JSON columns: `a1c`, `a2c`, `a3c`, `alc`, `skippedCards`
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

## Dashboard Features (15 Tabs, 6 Groups)

**Run:** 📊 Overview, 📈 Ascension, 📋 Runs

**Deck:** 🃏 Cards, ✨ Relics, 🧪 Potions, 🔗 Synergies

**Combat:** ⚔️ Encounters, 🔥 Heatmap, 🎭 Builds

**Map:** 🗺️ Floors, 🌟 Ancients

**Analysis:** 🏆 ELO

**Utility:** 📥 Export, ❓ Help

**Global Filters:** Character, Min Ascension (slider 0-10), Outcome (Win/Loss/All), Mode (1P/2P/3P/4P/Any Multiplayer/All)

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

**Endpoints (`src/server/index.ts`):**

- `GET /` — serves `dashboard.html`
- `GET /api/runs` — filtered runs; query params `character`, `ascension`, `outcome` (`won`/`lost`), `mode`
- `GET /api/stats` — aggregated global stats
- `GET /api/dashboard-data` — full analytics payload consumed by the live dashboard (runs, ELO, reports)
- `POST /api/ingest` — re-scan `history/` and insert new runs

**`mode` query param on `/api/runs`** accepts `"1"`/`"2"`/`"3"`/`"4"` (exact player count), `"single"` (alias for `"1"`), or `"multi"` (any `m > 1`) — same value set as the dashboard's client-side filter JS (`generateDashboard_v2.ts`).

**Response Format:**

```typescript
{ count: number; runs: ExtractedRun[] }   // /api/runs (field is `runs`, not `data`)
{ error: string }                          // errors with HTTP status
```

Always close DB after every request handler.

---

## npm Scripts

| Script | Purpose |
|---|---|
| `npm run analyze` | Full pipeline: extract → DB → ELO → reports → dashboard |
| `npm run extract` | Extraction only → `output/extracted_runs.json` |
| `npm run reports` | CSV reports only (requires `extracted_runs.json`) |
| `npm run dashboard` | Regenerate dashboard.html only (UI changes, no re-extract) |
| `npm run server` | Express API on port 3000 |
| `npm run watch` | File watcher for auto-ingestion |

There is no `npm run build` script — use `npx tsc --noEmit` for type checking.

---

## Recent Major Changes

See `CHANGELOG.md` for the full history. Highlights:

- **Floors & Ancients tabs** (May 2026) — per-floor stats and ancient blessing ELO across all 3 acts
- **Card skip tracking** — `a1sk`/`a2sk`/`a3sk`/`skippedCards` columns, surfaced in Cards and ELO tabs
- **ELO tab** — scatter chart (ELO vs win rate, bubble = games played) + per-act win% table
- **🔴 Critical fix**: multiplayer character extraction now uses Steam ID match, not array position — regenerate DB with `npm run analyze` if upgrading from an old database

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

## Communication

- Be concise and fact-based
- Show plan before major changes (especially database schema changes)
- Reference relevant .run file structures when debugging extraction
- Always validate with `npm run analyze` after code changes
- For UI updates only: run `npm run dashboard` to regenerate dashboard.html without full pipeline
- Document changes in `CHANGELOG.md` for future reference
