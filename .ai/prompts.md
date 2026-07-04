# Prompt Templates for STS2 Run Analytics

## Feature Development

```text
Follow workflow.md. First create a plan, then implement.

Feature: [describe feature in STS2 context]
Constraints:
- Must maintain strict TypeScript mode
- Database operations need transactions
- Check if multiplayer character extraction is affected
Files likely involved: [optional]
Reference: .github/instructions/[module].instructions.md
```

**Example:**

```text
Feature: Add win rate trending over time
Constraints:
- Must handle per-character filtering
- Need to aggregate by time window
- Character extracted by Steam ID (not array position)
Files likely involved: generateDashboard_v2.ts, database.ts
Reference: .github/instructions/dashboard.instructions.md
```

---

## Database Schema Changes

```text
Use .github/instructions/database.instructions.md patterns.

Change: [describe schema change]
Impact: [which tables, which queries affected]
Migration: [SQL changes needed]
Validation: Will run npm run analyze to verify
```

**Example:**

```text
Change: Add player count (m) field to ExtractedRun
Impact: Need runs table column, extraction logic, dashboard filters
Migration: ALTER TABLE runs ADD COLUMN playerCount INTEGER DEFAULT 1
Validation: Will run npm run analyze to verify all 191 runs process
```

---

## Dashboard Feature

```text
Use .github/instructions/dashboard.instructions.md patterns.

Feature: [tab or chart name]
Data source: [which runs.db queries]
Filters: [which global filters apply]
Validation: Will run npm run dashboard to verify
```

**Example:**

```text
Feature: Add Allies column to Runs tab
Data source: runs.alc field (JSON), run_players table
Filters: Character, Min Ascension, Outcome, Mode
Validation: Will run npm run dashboard and check Runs tab
```

---

## Refactoring

```text
Refactor this code following rules.md.

Goals:
- Improve readability and maintainability
- Reduce duplication
- Preserve behaviour
- Maintain strict TypeScript types
- Keep database operations scoped
```

**Example for extractRunData.ts:**

```text
Goals:
- Reduce duplication in player extraction logic
- Improve clarity of character/allies extraction
- Add comments for multiplayer special case
- Keep Steam ID matching central to logic
```

---

## Debugging

```text
Analyse this issue using workflow.md and architecture.md.

Problem: [describe issue]
Expected: [what should happen]
Actual: [what's happening]
Context: [multiplayer? character extraction? database?]

First explain root cause, then propose fix.
```

**Example:**

```text
Problem: Multiplayer runs showing wrong character
Expected: Character should match YOUR_STEAM_ID (0000000000000000)
Actual: Character matches first player in array
Context: Character extraction in extractRunData.ts using run.players[0]
Root cause: Array position assumption breaks with multiplayer player order
Fix: Use Steam ID matching instead
```

---

## Code Review Against Rules

```text
Review this code against rules.md and architecture.md.

Check for:
1. Explicit return types on all functions
2. No implicit any types
3. Database operations use transactions
4. Database closed after queries
5. Character extraction uses Steam ID matching
6. TypeScript strict mode compliance
```

---

## Performance Analysis

```text
Analyze performance of this code path.

Consider:
- Database query efficiency (use better-sqlite3 patterns)
- Frontend rendering (Plotly.js responsiveness)
- Data structure sizes (ExtractedRun compactness)
- Multiplayer aggregation (per-character/ascension)
```

---

## Adding Tests

```text
Generate tests for this module.

Focus on:
- Edge cases (empty arrays, null values, multiplayer scenarios)
- Failure modes (database connection failures, malformed .run files)
- Character extraction edge cases
- Transaction rollback scenarios
```

---

## Documentation Updates

```text
Update documentation to reflect [feature/change].

Include:
1. .github/copilot-instructions.md (if affects AI guidelines)
2. .github/instructions/ (if affects specific module)
3. CHANGELOG.md (what changed and why)
4. README.md (if user-facing)
```

---

## STS2-Specific Contexts

### When Working With Multiplayer

```text
Context: Multiplayer run handling

Remember:
- Players can be in any order in run.players array
- ALWAYS extract character by Steam ID (0000000000000000)
- Extract allies by filtering out YOUR_STEAM_ID
- Allies stored as JSON array [{id: steamId, c: character}]
```

### When Modifying Character/Ascension Logic

```text
Context: Per-character/ascension analytics

Remember:
- Starter cards vary per character
- ELO calculations are per-character×ascension
- Filters: Character, Min Ascension (slider, not dropdown)
- Heatmap colorscale adapts by character
```

### When Modifying Database

```text
Context: Database schema operations

Remember:
- Use INSERT OR IGNORE (never plain INSERT)
- Always use transactions for multi-table ops
- Always close db after queries
- JSON fields stored as TEXT, parse at runtime
- Use prepared statements for all queries
```

### When Updating Dashboard

```text
Context: Dashboard generation

Remember:
- Single HTML file, no build needed
- 15 tabs across 6 groups: Run, Deck, Combat, Map, Analysis, Utility (full list in .ai/architecture.md)
- 13 CSV reports: cards, encounters, relics, builds, ascension, cardSynergies, relicSynergies, characterAscensionHeatmap, encountersByAct, deckSizeTargets, elo_rankings, turnEconomy, potions
- Global filters: Character, Min Ascension, Outcome, Mode
- Uses Plotly.js for all charts
```

---

## See Also

- `architecture.md` - System architecture
- `workflow.md` - Standard development process
- `rules.md` - Code standards and patterns
- `.github/copilot-instructions.md` - Project guidelines
- `.github/instructions/` - Module-specific technical docs
