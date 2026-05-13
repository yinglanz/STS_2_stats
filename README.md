# STS2 Run Analytics Dashboard

A comprehensive analytics platform for Slay the Spire 2 (STS2) run data, built with TypeScript, SQLite, and Express.

## Overview

This project automatically ingests `.run` files from your STS2 save folder and provides:

- **Interactive Dashboard** with 15 tabs across 6 groups (Overview, Deck, Combat, Map, Analysis, Utility)
- **Automatic Data Processing**: Extracts, normalizes, and stores run data in SQLite
- **Live File Watching**: Auto-ingests new runs as you play
- **Advanced Analytics**: ELO ratings, Kalman filtering, per-act card tracking, floor stats, ancient blessing ELO
- **Multiplayer Support**: Tracks allies in multiplayer runs with proper character identification
- **Dark Theme**: Full STS2-inspired dark color palette throughout all charts and tables

## Data Source

The project reads `.run` files directly from your STS2 save folder:

```text
C:\Users\[YOUR_USERNAME]\AppData\Roaming\SlayTheSpire2\steam\[STEAM_ID]\profile1\saves\history\
```

**Current Configuration:**

- User: `you`
- Steam ID: `0000000000000000`
- Profile: `profile1`
- Path configured in `src/config.ts`

⚠️ **To use with a different profile**, update `YOUR_STEAM_ID` and `HISTORY_PATH` in `src/config.ts`.

## Data Pipeline

```text
STS2 Save Folder (.run files)
    ↓
extractRunData.ts (Normalize & extract by Steam ID)
    ↓
runs.db (SQLite database)
    ↓
Express API Server
    ├─ /api/dashboard-data (loads all analytics)
    ├─ /api/runs (filtered run queries)
    ├─ /api/stats (aggregated stats)
    └─ / (serves dashboard.html)
    ↓
http://localhost:3000 (Interactive website)
```

## Quick Start

### Installation

```bash
npm install
```

### Build Dashboard

```bash
npm run analyze    # Full pipeline: extract → DB → ELO → reports → dashboard
npm run dashboard  # Regenerate dashboard only (fast, for UI changes)
```

### Run as Website

**Terminal 1 — Start the server:**
```bash
npm run server     # Express API on http://localhost:3000
```

**Terminal 2 (optional) — Auto-ingest new runs:**
```bash
npm run watch      # File watcher for new .run files
```

Then open **http://localhost:3000** in your browser.

## Dashboard Features

### Tabs (15 Total, grouped)

**Overview:** 📊 Overview · 📈 Ascension · 📋 Runs

**Deck:** 🃏 Cards · ✨ Relics · 🧪 Potions · 🔗 Synergies

**Combat:** ⚔️ Encounters · 🔥 Heatmap · 🎭 Builds

**Map:** 🗺️ Floors · 🌟 Ancients

**Analysis:** 🏆 ELO

**Utility:** 📥 Export · ❓ Help

### Global Filters (apply across all tabs)

- **Character**: Single-character select (Ironclad, Silent, Defect, Necrobinder, Regent, or All)
- **Min Ascension**: Slider (0–10) — shows runs at this level or higher
- **Outcome**: Wins / Losses / All
- **Mode**: 1P (Solo) / 2P / 3P / 4P / Any Multiplayer / All
- **Version**: Filter by game build version (e.g. v0.98.3)

## What Gets Tracked

### Per Run

- Character (extracted by Steam ID — correct in multiplayer), Ascension, Result
- Seed, Duration, Total damage taken (sum across all encounters), Act reached
- Cards picked per act (a1c / a2c / a3c), final deck, relics, potions
- Multiplayer mode and ally characters

### Per Encounter

- Type (Monster / Elite / Boss), Act, Floor, Damage taken, Turns, Survival

## Key Analytics

### Data Quality

- ✅ Starter relics automatically excluded per character
- ✅ Curse cards (`CARD.CURSE_`) and Status cards filtered
- ✅ Character extracted by Steam ID (not array index) — correct in multiplayer
- ✅ Damage taken is your player's damage only (by player index), summed across all encounters
- ✅ Run files validated before extraction (players + map_point_history required)

### ELO Ratings

- Dynamic K-factor (48 → 32 → 24 as rating increases)
- Aggregated across all ascension levels per card per character
- Per-act win% columns (Act 1 / Act 2 / Act 3) show win rate when card first picked that act
- ELO vs win rate scatter chart with bubble size = games played

### Win Rate Trend (in Runs tab)

- **Kalman MLE Drift**: Fitted via golden-section search
- **Kalman Fixed Drift** (σ=0.1): Conservative CI bands
- **Bayesian** (Beta-Binomial): Prior-informed estimate
- **Raw Win %**: Unfiltered win rate
- 95% confidence intervals, date-based x-axis

## Project Structure

```text
c:\code\STS_2_stats\
├── src/
│   ├── config.ts                        # YOUR_STEAM_ID and HISTORY_PATH
│   ├── analyze/
│   │   ├── extractRunData.ts            # Parse .run files → ExtractedRun
│   │   ├── database.ts                  # SQLite schema & queries
│   │   ├── generateDashboard_v2.ts      # Generate single-file dashboard HTML
│   │   ├── eloCalculator.ts             # Card ELO rankings
│   │   ├── floorAnalytics.ts            # Per-floor stats → floor_analytics.json
│   │   ├── ancientAnalytics.ts          # Ancient blessing ELO → ancient_analytics.json
│   │   ├── reports.ts                   # CSV report generation
│   │   ├── index.ts                     # Pipeline orchestrator
│   │   └── types.ts                     # TypeScript interfaces
│   └── server/
│       ├── index.ts                     # Express API
│       └── watcher.ts                   # File watcher for auto-ingest
├── output/
│   ├── runs.db                          # SQLite database (auto-generated)
│   ├── extracted_runs.json              # Normalized run data (auto-generated)
│   ├── elo_ratings.json                 # Card ELO state (auto-generated)
│   ├── floor_analytics.json             # Floor stats (auto-generated)
│   ├── ancient_analytics.json           # Ancient blessing stats (auto-generated)
│   ├── dashboard.html                   # Interactive dashboard (auto-generated)
│   └── reports/                         # CSV analytics reports (auto-generated)
└── .github/
    ├── copilot-instructions.md          # AI code generation guidelines
    └── instructions/
        ├── api.instructions.md          # API endpoint patterns
        ├── dashboard.instructions.md    # Dashboard architecture
        └── database.instructions.md    # SQLite patterns
```

## Troubleshooting

### No runs appearing

- Check `src/config.ts` has correct `HISTORY_PATH`
- Verify `.run` files exist in the history folder
- Run `npm run analyze` to manually trigger extraction

### Dashboard shows old data

- Run `npm run dashboard` to regenerate from existing DB
- Or delete `output/runs.db` and run `npm run analyze` to re-extract everything

### Missing output files error

- Run `npm run analyze` first — `npm run dashboard` requires `extracted_runs.json` and `elo_ratings.json`

## Documentation

- **[CHANGELOG.md](CHANGELOG.md)** — Change history
- **[.github/copilot-instructions.md](.github/copilot-instructions.md)** — AI development guidelines
- **[.github/instructions/](./github/instructions/)** — Module-specific technical specs
- **[.ai/](./ai/)** — Architecture, rules, prompts, workflow reference

---

**Last Updated**: May 10, 2026
**Status**: Active Development
