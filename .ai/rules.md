# Development Rules - STS2 Run Analytics

## General Principles

- Always prioritize readability over cleverness
- Prefer simple, maintainable solutions over complex abstractions
- Follow existing STS2 patterns before introducing new ones
- Reference `.github/instructions/` for module-specific guidance

## TypeScript Standards

- **Strict Mode**: Enabled in tsconfig.json (non-negotiable)
- **Return Types**: All functions must have explicit return types
- **Parameter Types**: All parameters must be typed
- **No `any`**: Be specific; use `unknown` if truly unknown, then narrow
- **No TypeScript casts in template literals**: Code inside template literal strings becomes plain JS in the HTML — `as any`, `as T[]`, and `const x: T[]` are syntax errors at runtime

### Example

```typescript
// ❌ WRONG
function extractCharacter(run) {
  return run.players[0].character;
}

// ✅ CORRECT
function extractCharacter(run: RunData): string {
  const player = run.players[0];
  return player?.character || "UNKNOWN";
}
```

## Database Operations

- **Use Prepared Statements**: Always — prevents SQL injection
- **INSERT OR IGNORE**: Never use plain `INSERT` (idempotent by design)
- **Transactions**: Wrap all multi-table operations in `db.transaction()`
- **Close Immediately**: `db.close()` after every handler — no persistent connections
- **JSON Fields**: Store as TEXT, parse at query time with `JSON.parse`
- **insertRun vs insertAllRuns**: Both must insert the same child rows (cards, relics, encounters, **potions**). Keep them in sync.

### DB Example

```typescript
const txn = db.transaction(() => {
  const inserted = insertRunStmt.run({...});
  if (inserted.changes === 0) return;  // already exists, skip child rows
  insertCard.run(...);
  insertRelic.run(...);
  insertEnc.run(...);
  insertPotion.run(...);
});
txn();
db.close();
```

## Dashboard JS Rules

- **`safePlot(id, traces, layout, config)`**: Always use this — never call `Plotly.newPlot` directly. It checks the element exists and catches errors.
- **`darkLayout(extra)`**: Always use for chart layouts — merges `extra` onto the shared `DARK` constant.
- **`DARK` constant**: Defined before any call to `updateDashboard()` (temporal dead zone — `const` does not hoist).
- **`filteredRuns`**: All draw functions must read from `filteredRuns`, never `DATA.runs`.
- **No TS in template strings**: TypeScript syntax in template literals becomes invalid JS.

## Critical Rules for This Project

### Character Extraction

❌ **NEVER** use `run.players[0]?.character` (assumes you're first player)
✅ **ALWAYS** use `run.players.find(p => p.id === YOUR_STEAM_ID)?.character`

### Config

❌ **NEVER** hardcode `YOUR_STEAM_ID` or `HISTORY_PATH` in module files
✅ **ALWAYS** import from `src/config.ts`

### Multiplayer Handling

- Player count: `run.players.length`
- Your character: by Steam ID match
- Allies: filter out YOUR_STEAM_ID, map `{id, c: character}`

### Pipeline Resilience

- `loadAllRuns`: check path exists, validate run structure before use
- `extractRun`: throw with clear message on missing `players` or `map_point_history`
- `loadDashboardData`: check output files exist before `fs.readFileSync`; guard divisions by run count

## File Editing Rules

- ❌ Do not rewrite entire files unless necessary
- ✅ Only modify relevant sections with minimal edits
- ✅ Preserve existing formatting and style
- ✅ Include 3–5 lines of context before/after edit
- ✅ Keep changes scoped to one concern

## Testing & Validation

- Run `npm run analyze` for full pipeline validation
- Run `npx tsc --noEmit` to check TypeScript — must produce zero errors
- Run `npm run dashboard` for UI-only changes (faster)


## General Principles

- Always prioritize readability over cleverness
- Prefer simple, maintainable solutions over complex abstractions
- Follow existing STS2 patterns before introducing new ones
- Reference `.github/instructions/` for module-specific guidance

## TypeScript Standards

- **Strict Mode**: Enabled in tsconfig.json (non-negotiable)
- **Return Types**: All functions must have explicit return types
- **Parameter Types**: All parameters must be typed
- **No `any`**: Be specific; use `unknown` if truly unknown, then narrow type
- **No `implicit any`**: Catch at compile time with strict mode

### Example

```typescript
// ❌ WRONG
function extractCharacter(run) {
  return run.players[0].character;
}

// ✅ CORRECT
function extractCharacter(run: RunData): string {
  const player = run.players[0];
  return player?.character || "UNKNOWN";
}
```

## Database Operations

- **Use Prepared Statements**: Always, for SQL injection prevention
- **INSERT OR IGNORE**: Never use plain INSERT (prevent accidental overwrites)
- **Transactions**: Wrap all multi-table operations in transactions
- **Close Immediately**: Close database after every operation (no persistent connections)
- **JSON Fields**: Store as TEXT, parse at query time with JSON.parse

### DB Example

```typescript
const txn = db.transaction(() => {
  const inserted = insertRunStmt.run({...});
  if (inserted.changes === 0) return;  // Already exists
  insertCard.run(...);
  insertRelic.run(...);
});
txn([...]);
db.close();  // Always close
```

## Critical Rules for This Project

### Character Extraction

❌ **NEVER** use `run.players[0]?.character` (assumes you're first)
✅ **ALWAYS** use `run.players.find(p => p.id === YOUR_STEAM_ID)?.character`

- Multiplayer runs have any player order
- Must match by Steam ID for accuracy

### Multiplayer Handling

- Extract player count: `playerCount = run.players.length`
- Extract character: By Steam ID match
- Extract allies: Filter out YOUR_STEAM_ID, map {id, character}
- Display allies: Show character names (not Steam IDs) in main UI

### Code Standards

- Write small, composable functions (max 20-30 lines)
- Avoid duplication (DRY principle)
- Include type hints everywhere
- Handle edge cases explicitly (nulls, empty arrays, etc.)

### Code Example

```typescript
// ✅ Good: Small, typed, handles edges
function getAllies(run: RunData): AllyInfo[] {
  if (run.players.length <= 1) return [];
  return run.players
    .filter(p => p.id !== YOUR_STEAM_ID)
    .map(p => ({id: p.id, c: p.character}));
}
```

## File Editing Rules

- ❌ Do not rewrite entire files unless necessary
- ✅ Only modify relevant sections with minimal edits
- ✅ Preserve existing formatting and style
- ✅ Include 3-5 lines of context before/after edit
- ✅ Keep commits scoped to one concern

## Testing & Validation

- Test locally with `npm run analyze` before committing
- Verify TypeScript compilation: `npm run build`
- For database changes: regenerate with fresh .run file extraction
- For dashboard changes: `npm run dashboard` only (faster)

## Communication Style (for Copilot Chat)

- Be concise and fact-based
- Show plan before implementing non-trivial tasks
- Reference relevant files (database.instructions.md, etc.)
- Explain trade-offs and constraints
- Always validate with `npm run analyze` after changes

## Code Review Checklist

- [ ] All functions have explicit return types
- [ ] No implicit `any` types
- [ ] Database operations use transactions
- [ ] Database is closed after queries
- [ ] Character extraction uses Steam ID matching
- [ ] Multiplayer handling includes allies tracking
- [ ] Code is commented where complex
- [ ] TypeScript compilation succeeds (strict mode)
- [ ] Changes are minimal and scoped
- [ ] Tests pass: `npm run analyze`

## Anti-Patterns (Don't Do These)

| ❌ Anti-Pattern | ✅ Correct Pattern |
| --- | --- |
| `run.players[0]?.character` | `run.players.find(p => p.id === STEAM_ID)?.character` |
| `INSERT INTO runs ...` | `INSERT OR IGNORE INTO runs ...` |
| Leaving db open | `db.close()` after operations |
| String SQL queries | Prepared statements with parameters |
| Rewriting entire files | Minimal, scoped edits |
| No return types | `function foo(): ReturnType` |
| Using `any` type | Use specific types or `unknown` |
| Implicit type coercion | Explicit type checking |

## Dashboard Features

### Current Tabs (10 Total)
1. Overview - Global statistics, win rates
2. Cards - Card analytics with ELO
3. Encounters - Encounter survival & damage
4. Relics - Relic analytics with ELO
5. Synergies - Card and relic pairing analysis
6. Heatmap - Card picks per act with color gradient
7. Builds - Build archetypes
8. Ascension - Difficulty progression stats
9. Potions - Potion usage statistics (NEW)
10. Help - Comprehensive user guide

### Global Filters
- Character: Single select (Ironclad, Silent, Defect, Necrobinder, Regent)
- Min Ascension: Slider (0-10)
- Outcome: Wins/Losses/All
- Mode: 1P/2P/3P/4P/All

- `.github/copilot-instructions.md` - Project guidelines
- `.github/instructions/database.instructions.md` - DB patterns
- `.ai/workflow.md` - Standard development process
- `CHANGELOG.md` - Recent changes and decisions
