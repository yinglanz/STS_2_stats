# Development Rules - STS2 Run Analytics

## General Principles

- Always prioritize readability over cleverness
- Prefer simple, maintainable solutions over complex abstractions
- Follow existing STS2 patterns before introducing new ones
- Write small, composable functions; avoid duplication (DRY)
- Reference `.github/instructions/` for module-specific guidance

## TypeScript Standards

- **Strict Mode**: Enabled in `tsconfig.json` (non-negotiable)
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
- **insertRun vs insertAllRuns**: Both must insert the same child rows (cards, relics, encounters, potions). Keep them in sync.

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
- Run `npx tsc --noEmit` to check TypeScript — must produce zero errors (there is no `npm run build` script)
- Run `npm run dashboard` for UI-only changes (faster)

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
- [ ] TypeScript compilation succeeds (strict mode): `npx tsc --noEmit`
- [ ] Changes are minimal and scoped
- [ ] Pipeline validated: `npm run analyze`

## Anti-Patterns (Don't Do These)

| ❌ Anti-Pattern | ✅ Correct Pattern |
| --- | --- |
| `run.players[0]?.character` | `run.players.find(p => p.id === YOUR_STEAM_ID)?.character` |
| `INSERT INTO runs ...` | `INSERT OR IGNORE INTO runs ...` |
| Leaving db open | `db.close()` after operations |
| String SQL queries | Prepared statements with parameters |
| Rewriting entire files | Minimal, scoped edits |
| No return types | `function foo(): ReturnType` |
| Using `any` type | Use specific types or `unknown` |
| `Plotly.newPlot()` directly | `safePlot(id, traces, layout, config)` |

## Dashboard Features

The dashboard has 15 tabs across 6 groups (Run, Deck, Combat, Map, Analysis, Utility) and 4 global filters (Character, Min Ascension, Outcome, Mode). See `.ai/architecture.md` for the full tab list and `.github/instructions/dashboard.instructions.md` for chart/filter conventions — do not duplicate that list here, it drifts out of sync.

## See Also

- `.github/copilot-instructions.md` - Project guidelines
- `.github/instructions/database.instructions.md` - DB patterns
- `.ai/workflow.md` - Standard development process
- `.ai/architecture.md` - System architecture and current tab/report list
- `CHANGELOG.md` - Recent changes and decisions
