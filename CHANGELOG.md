# Changelog - STS2 Run Analytics

All notable changes to the project are documented here. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [May 1, 2026]

### ✅ NEW: Floors Tab

- New `floorAnalytics.ts` module generates `output/floor_analytics.json`
- Groups by `floorType × actName × actIndex × version` (no per-character split)
- **Friendly floor types**: Weak / Normal (split by `_WEAK` room model suffix) / Elite / Boss / Event / Rest / Shop / Treasure / Ancient
- **Act name** from `run.acts[actIdx]` (e.g. `ACT.OVERGROWTH` → `Overgrowth`)
- **Act index** = 1-based position in the run (1/2/3)
- Columns: Runs, Death%, Avg Damage, Avg HP Healed, Avg Max HP Gain/Loss, Avg Gold Gain/Spent, Avg Cards Offered, Avg Relics Offered
- Dashboard filters: Floor Type, Act Index (1/2/3), Act Name (auto-populated), Version, Min Runs

### ✅ NEW: Ancients Tab

- New `ancientAnalytics.ts` module generates `output/ancient_analytics.json`
- Tracks ancient blessings across **all 3 acts** — not just Act 1 (Neow)
  - Act 1: Neow (25 blessings)
  - Act 2: Darv, Orobas, Pael, Tezcatara (~38 blessings)
  - Act 3: Nonupeipe, Tanx, Vakuu (~33 blessings)
- ELO only updates on `was_chosen === true`
- Per-character Pick% and Win% columns; collapses to selected char when filtered
- Dashboard filters: Act (1/2/3), Ancient name (auto-populated), Min picks

### ✅ NEW: Card Skip Tracking

- `a1sk`, `a2sk`, `a3sk` columns added to `runs` table (skips per act)
- `skippedCards TEXT` column stores all offered-but-not-picked card IDs
- Cards tab: "Most Skipped" sort option; hover shows `Picks: X | Skips: Y`
- ELO tab: "Skipped" column (red when >0)

### ✅ Tab Reorder (6 groups)

| Group | Tabs |
| --- | --- |
| Run | Overview · Ascension · Runs |
| Deck | Cards · Relics · Potions · Synergies |
| Combat | Encounters · Heatmap · Builds |
| Map | Floors · Ancients |
| Analysis | ELO |
| Utility | Export · Help |

### ✅ Mode Filter Improved

- Now supports exact player counts: 1P / 2P / 3P / 4P / Any Multiplayer / All
- `applyFilters` checks `r.m === parseInt(mode)` for numeric options

### 🐛 Bug Fixes

- **Duplicate `ascensionFilter` listener** removed (was registered as both `input` and `change`)
- **`versionFilter` now wired** — changing version filter now actually re-filters runs
- **`versionFilter` read moved outside `.filter()` loop** — was querying DOM once per run
- **`switchTab` no longer uses implicit global `event`** — finds button via `onclick` attribute scan, safe to call programmatically

### ✅ Help Tab Updated

- New tab-group summary table at top
- Dedicated section for every tab including Floors, Ancients, updated ELO and Cards
- Tips reference new structure (act-name filters, ancient pool per act)

### ✅ Instruction Files Updated

- `database.instructions.md`: added skip columns, floor/ancient JSON outputs
- `dashboard.instructions.md`: updated tab groups, added mode filter values, `switchTab` note, `loadDashboardData` note
- `api.instructions.md`: removed duplicate legacy section, added mode filter value reference

---

## [April 30, 2026]

### ✅ MAINTENANCE: Full Repo Markdown Lint Pass

#### What Changed

- Audited and fixed all markdown linting errors across the entire repository
- Zero lint errors remaining (`get_errors` returns clean on all files)

#### Files Fixed

- **`CHANGELOG.md`** — Fixed duplicate headings, `**bold**` used as headings (replaced with `####`), missing blank lines around fenced code blocks
- **`README_AI.md`** — Fixed missing blank lines between headings and lists
- **`SETUP.md`** — Added language specifiers to bare code fences (`text`), added blank lines around fences and lists
- **`.ai/architecture.md`** — Fixed missing blank lines after headings and around lists, bare code fences (`text`)
- **`.ai/rules.md`** — Fixed duplicate heading names, `**bold**` as heading, missing blank lines, table column style separator
- **`.ai/prompts.md`** — Fully rewrote: all bare code fences given `text` language, all headings have required blank lines, lists properly surrounded

#### Rules Applied

- `MD022` — Blank lines around headings
- `MD024` — No duplicate heading content
- `MD031` — Blank lines around fenced code blocks
- `MD032` — Blank lines around lists
- `MD036` — No emphasis used as heading
- `MD040` — Fenced code blocks must have a language
- `MD060` — Table column style (pipe spacing)

#### Validation

```bash
# Zero errors after fixes
npm run dashboard  # Exit 0, dashboard regenerated clean
```

---

## [Previous Session] - April 29, 2026

### 🔴 CRITICAL FIX: Multiplayer Character Extraction

#### Problem

- In multiplayer runs, player character was extracted from `run.players[0]` (first array element)
- This assumed the user was always the first player in the array
- Result: Many multiplayer runs showed incorrect characters (e.g., showing teammate's character instead of user's)

#### Solution

- Extract character by finding the player matching `YOUR_STEAM_ID`
- Fallback to `run.players[0]` if ID not found
- Filter allies by removing user's Steam ID from player array

#### Files Modified

- `src/analyze/extractRunData.ts`
  - Added constant: `const YOUR_STEAM_ID = <your-steam-id>`
  - Changed: `const character = run.players[0]?.character`
  - To: `const yourPlayer = run.players.find(p => p.id === YOUR_STEAM_ID) || run.players[0]`
  - Updated: Use `yourPlayer` for character extraction, deck size, relics count
- `src/analyze/database.ts` - No changes (ally extraction logic in extractRunData)
- `src/analyze/types.ts` - No changes (allies field added separately)

#### Database Impact

- Old runs still stored with incorrect character
- Solution: Delete and regenerate database (`npm run analyze`)
- All 191 runs now extract correct character from multiplayer matches

#### Testing

```bash
# Verify fix
node -e "const Database = require('better-sqlite3'); 
const db = new Database('output/runs.db'); 
const run = db.prepare('SELECT c, m, alc FROM runs WHERE m > 1 LIMIT 1').get(); 
console.log('Multiplayer run character:', run.c); 
db.close();"
```

---

### ✅ NEW FEATURE: Allies Tracking for Multiplayer

#### Allies Feature Details

- Added ability to track which players (allies) you played with in multiplayer matches
- Store ally Steam IDs and their characters
- Display allies in dashboard for easy reference

#### Implementation

1. **Type System** (`src/analyze/types.ts`)
   - Added `alc` field to `ExtractedRun` interface:

   ```typescript
   alc?: Array<{
     id: number;           // Steam ID of ally
     c: string;            // character they played
   }>;
   ```

2. **Data Extraction** (`src/analyze/extractRunData.ts`)

   ```typescript
   // Extract allies (all players except you)
   const allies = playerCount > 1
     ? run.players.filter(p => p.id !== YOUR_STEAM_ID).map(p => ({
         id: p.id,
         c: p.character
       }))
     : undefined;
   ```

3. **Database Storage** (`src/analyze/database.ts`)
   - Added column: `alc TEXT` in runs table
   - Schema migration: `ALTER TABLE runs ADD COLUMN alc TEXT`
   - Storage format: JSON string (e.g., `"[{\"id\":76561198012293730,\"c\":\"CHARACTER.IRONCLAD\"}]"`)
   - Updated INSERT statements to include `@alc` parameter
   - Updated `loadAllRunsFromDb()` to parse `alc` JSON

4. **Dashboard Display** (`src/analyze/generateDashboard_v2.ts`)
   - **Runs Tab**:
     - Added "Allies" column header
     - Display format: Character names separated by commas
     - Expandable row detail: Shows full ally list with Steam IDs
   - **Export Tab**:
     - Added "Allies" column to table and CSV headers
     - CSV format: Character names separated by semicolons (e.g., "Ironclad; Defect")
   - **Help Tab**: Documents ally tracking in multiplayer explanation

#### Database Migration

```sql
ALTER TABLE runs ADD COLUMN alc TEXT;
```

#### Example Data

```json
{
  "id": "run_1773588154",
  "c": "CHARACTER.IRONCLAD",
  "m": 2,
  "alc": "[{\"id\":76561198012293730,\"c\":\"CHARACTER.IRONCLAD\"}]"
}
```

---

### ✅ NEW FEATURE: Comprehensive Help Tab

#### Help Tab Content

- Added 13th dashboard tab: "Help (❓)" with complete user documentation
- Explains all metrics, filters, and dashboard features
- Reference guide for understanding data and usage

**Content Sections** (15+ sections)

1. Global Filters - Explanation of all filter options
2. Overview Tab - Win rate and stats description
3. Cards Tab - Pick rate, ELO, win %, deck % definitions
4. Encounters Tab - Survivor rate, damage, turns metrics
5. Relics Tab - Relic rating and frequency
6. Synergies Tab - Card/relic pairing analysis
7. Heatmap Tab - Color meanings and heatmap legend
8. Builds Tab - Build archetype explanation
9. Ascension Tab - Difficulty and progression
10. ELO Ratings Tab - ELO scoring system explanation
11. Runs Tab - Individual run details and allies tracking
12. Win Rate Trend Tab - Timeline analysis
13. Export Tab - CSV export functionality
14. Key Metrics - Unified definitions for all metrics
15. Tips - Best practices for using dashboard

**Implementation** (`src/analyze/generateDashboard_v2.ts`)

- Added Help button to tab navigation
- New tab div with comprehensive styled content
- STS2 theming: Gold borders, dark backgrounds, proper colors
- Sections organized with hierarchy and visual separation

#### Styling

- Background: `#16122a` (dark)
- Border: `4px solid #c9a84c` (gold left border)
- Text: `#c8b99a` (light tan)
- Headings: Color-coded per section
- Lists: Proper indentation and spacing

---

### ✅ RENAMED: "Opponents" → "Allies"

#### Reason for Change

- More accurate terminology: they're your teammates, not opponents
- Better reflects multiplayer cooperative nature of STS2

#### Modified Files

- `src/analyze/types.ts` - Field renamed from `opp` to `alc` in ExtractedRun
- `src/analyze/extractRunData.ts` - Variable `opponents` → `allies`
- `src/analyze/database.ts` - Column `opp` → `alc`
- `src/analyze/generateDashboard_v2.ts`
  - Variable: `oppDisplay` → `allyDisplay`
  - Function: All references to opponents changed to allies
  - CSV headers: "Opponents" → "Allies"
  - Table headers: "Opponents" → "Allies"
  - Detail rows: "Opponents:" → "Allies:"

#### Backward Compatibility

- Database column renamed: Old `opp` column no longer used
- If upgrading from old database: Run `npm run analyze` to regenerate
- API: No external API changes (internal only)

---

### 📝 DOCUMENTATION: Updated Project Instructions

**File: `.github/copilot-instructions.md`**

- **Changed from**: Generic React/poker game instructions (outdated/incorrect)
- **Changed to**: STS2-specific project guidelines
- **New Content**:
  - Project overview and data pipeline
  - Core directives for working with STS2 codebase
  - TypeScript and database operation standards
  - Complete ExtractedRun format specification
  - Database schema documentation
  - Allies tracking explanation
  - Starter exclusion tables (per character)
  - Dashboard features (13 tabs) with latest additions
  - API patterns and patterns
  - Recent major changes section (this changelog)
  - Workflow for making changes
  - When to reference specific instruction files

#### Documentation Benefits

- Clear, accurate guidance for future development
- Reference for critical concepts (allies, character extraction, multiplayer handling)
- Troubleshooting info for common issues
- Self-documenting through examples

---

## Release Summary

### Database Changes

- Added `alc TEXT` column to `runs` table for ally tracking
- Schema automatically migrates with `npm run analyze`
- **Action Required**: Delete `output/runs.db` and regenerate for fixed multiplayer characters

### Code Changes

- **Lines Changed**: ~150 lines across 5 files
- **Breaking Changes**: None (character extraction fix is transparent to users)
- **Data Impact**: Multiplayer runs now show correct characters + ally data
- **Dashboard**: 2 new features (Help tab, Allies column) + renaming (Opponents → Allies)

### Testing Completed

- ✅ `npm run analyze` - Full pipeline with 191 runs
- ✅ Database ally storage and retrieval
- ✅ Dashboard rendering with new Help tab
- ✅ Allies column in Runs and Export tabs
- ✅ Multiplayer character extraction verification

### Changed Source Files

- `src/analyze/types.ts` - ExtractedRun interface
- `src/analyze/extractRunData.ts` - Character extraction + ally tracking
- `src/analyze/database.ts` - Schema migration + ally storage
- `src/analyze/generateDashboard_v2.ts` - UI updates + Help tab
- `.github/copilot-instructions.md` - Documentation update

---

## Next Steps / Known Limitations

1. **Ally Name Resolution** - Currently shows Steam IDs in expandable rows; could add friendly nickname mapping
2. **Multiplayer Statistics** - Could add tab for "Most Common Allies" with win rates together
3. **Ally Character Recommendations** - Could suggest best ally pairings based on win rate data
4. **Historical Data** - Old database must be regenerated; consider backup/migration script

---

## How to Use This Changelog

- **For Debugging**: Reference specific changes to understand current behavior
- **For Future Work**: "Next Steps" section identifies potential enhancements
- **For Code Review**: See exact files modified and why
- **For Documentation**: Complete record of all changes in one place
