---
description: "Use when adding API endpoints, modifying the Express server, or working with the file watcher. Covers endpoint conventions, error handling, and DB usage in request handlers."
applyTo: "src/server/**"
---

# STS2 API & Server Patterns

## Endpoint Conventions

- `GET /` — serves `dashboard.html`
- `GET /api/runs` — filtered list, query params: `character`, `ascension`, `outcome` (`won`/`lost`), `mode` (see Mode Filter Values below)
- `GET /api/stats` — aggregated global stats
- `GET /api/dashboard-data` — full analytics payload for the live dashboard (calls `loadDashboardData()` from `generateDashboard_v2.ts`)
- `POST /api/ingest` — re-scan history/ and insert new runs

## Response Shape

```typescript
// GET /api/runs
{ count: number, runs: ExtractedRun[] }

// GET /api/stats
{ totalRuns, wins, winRate, avgDeckSize, avgRelics, byCharacter, byAscension }

// GET /api/dashboard-data
// Same shape returned by loadDashboardData() — see dashboard.instructions.md

// Error responses
{ error: string }  // with appropriate HTTP status code
```

## DB Usage in Handlers

Always open, use, and close within the same handler:

```typescript
app.get("/api/runs", (req, res) => {
  const db = openDb();
  try {
    const runs = loadAllRunsFromDb(db);
    // ... filter and return
    res.json({ count: runs.length, data: runs });
  } finally {
    db.close();  // always close
  }
});
```

## Filter Order (most to least selective)

Apply in this order to reduce dataset early:

1. character
2. ascension (minimum)
3. outcome (won/lost)
4. mode (solo/multiplayer count)

## File Watcher Rules

- Debounce `fs.watch` events by 500ms (fires twice per write on Windows)
- Check file still exists before parsing (could be a delete event)
- After successful ingest, regenerate dashboard via `generateDashboardHtml()`
- Log with timestamp: `[HH:MM:SS] ✓ message`
- `insertRun` now inserts potions — no special handling needed for new files

## Mode Filter Values

`GET /api/runs`'s `mode` query param (`src/server/index.ts`) matches `run.m` (integer player count):
- `"1"` or `"single"` → `r.m === 1` (both accepted; `"single"` is a backward-compatible alias)
- `"2"` / `"3"` / `"4"` → exact multiplayer count
- `"multi"` → any run where `r.m > 1`
- omitted / anything else → all runs

This now matches the dashboard's own client-side mode filter (in `generateDashboard_v2.ts`, see `dashboard.instructions.md`) — both implementations accept the same exact-count values, so a query string built for one works against the other.
