/**
 * STS2 Analytics API Server
 * Serves run data from SQLite with filtering support
 *
 * Usage: npx ts-node src/server/index.ts
 * Endpoints:
 *   GET  /                        → dashboard.html
 *   GET  /api/runs                → filtered runs (query: character, ascension, outcome, mode)
 *                                    mode: "1"/"2"/"3"/"4" (exact player count), "single" (alias for "1"), "multi" (any m>1)
 *   GET  /api/stats               → aggregated global stats
 *   POST /api/ingest              → parse + insert new .run files from history/
 */

import express, { Request, Response, NextFunction } from "express";
import path from "path";
import fs from "fs";
import { openDb, loadAllRunsFromDb, insertRun, getRunCount } from "../analyze/database";
import { loadAllRuns, extractAllRuns } from "../analyze/extractRunData";
import { loadDashboardData } from "../analyze/generateDashboard_v2";
import { ExtractedRun } from "../analyze/types";

import { HISTORY_PATH } from "../config";

const OUTPUT_PATH = path.join(__dirname, "../../output");
const PORT = Number(process.env.PORT ?? 3000);

const app = express();
app.use(express.json());

// ── Serve dashboard ──────────────────────────────────────────────────────────

app.get("/", (_req: Request, res: Response) => {
  const dashboardPath = path.join(OUTPUT_PATH, "dashboard.html");
  if (!fs.existsSync(dashboardPath)) {
    res.status(404).send("Dashboard not generated yet. Run `npm run dashboard` first.");
    return;
  }
  res.sendFile(dashboardPath);
});

// ── GET /api/runs ────────────────────────────────────────────────────────────

app.get("/api/runs", (req: Request, res: Response) => {
  try {
    const db = openDb();
    const runs = loadAllRunsFromDb(db);
    db.close();

    const { character, ascension, outcome, mode } = req.query as Record<string, string>;

    let filtered = runs;

    if (character) {
      filtered = filtered.filter((r) =>
        r.c.toLowerCase().includes(character.toLowerCase())
      );
    }

    if (ascension !== undefined && ascension !== "") {
      filtered = filtered.filter((r) => r.a === Number(ascension));
    }

    if (outcome === "won") {
      filtered = filtered.filter((r) => r.w);
    } else if (outcome === "lost") {
      filtered = filtered.filter((r) => !r.w);
    }

    if (mode === "single" || mode === "1") {
      filtered = filtered.filter((r) => r.m === 1);
    } else if (mode === "2" || mode === "3" || mode === "4") {
      filtered = filtered.filter((r) => r.m === Number(mode));
    } else if (mode === "multi") {
      filtered = filtered.filter((r) => r.m > 1);
    }

    res.json({ count: filtered.length, runs: filtered });
  } catch (err) {
    console.error("GET /api/runs error:", err);
    res.status(500).json({ error: "Failed to load runs" });
  }
});

// ── GET /api/stats ───────────────────────────────────────────────────────────

app.get("/api/stats", (_req: Request, res: Response) => {
  try {
    const db = openDb();
    const runs = loadAllRunsFromDb(db);
    const total = getRunCount(db);
    db.close();

    const wins = runs.filter((r) => r.w).length;
    const avgDeckSize =
      runs.reduce((sum, r) => sum + r.sz, 0) / runs.length;
    const avgRelics =
      runs.reduce((sum, r) => sum + r.rc, 0) / runs.length;

    // Win rate by character
    const byCharacter: Record<string, { runs: number; wins: number }> = {};
    runs.forEach((r) => {
      if (!byCharacter[r.c]) byCharacter[r.c] = { runs: 0, wins: 0 };
      byCharacter[r.c].runs++;
      if (r.w) byCharacter[r.c].wins++;
    });

    // Win rate by ascension
    const byAscension: Record<number, { runs: number; wins: number }> = {};
    runs.forEach((r) => {
      if (!byAscension[r.a]) byAscension[r.a] = { runs: 0, wins: 0 };
      byAscension[r.a].runs++;
      if (r.w) byAscension[r.a].wins++;
    });

    res.json({
      totalRuns: total,
      wins,
      winRate: total > 0 ? ((wins / total) * 100).toFixed(1) : "0.0",
      avgDeckSize: avgDeckSize.toFixed(1),
      avgRelics: avgRelics.toFixed(1),
      byCharacter,
      byAscension,
    });
  } catch (err) {
    console.error("GET /api/stats error:", err);
    res.status(500).json({ error: "Failed to calculate stats" });
  }
});

// ── GET /api/dashboard-data ─────────────────────────────────────────────────

app.get("/api/dashboard-data", (_req: Request, res: Response) => {
  try {
    const data = loadDashboardData();
    res.json(data);
  } catch (err) {
    console.error("GET /api/dashboard-data error:", err);
    res.status(500).json({ error: "Failed to load dashboard data" });
  }
});

// ── POST /api/ingest ─────────────────────────────────────────────────────────

app.post("/api/ingest", (_req: Request, res: Response) => {
  try {
    const rawRuns = loadAllRuns();
    const extractedRuns = extractAllRuns(rawRuns);

    const db = openDb();
    const countBefore = getRunCount(db);

    let inserted = 0;
    for (const run of extractedRuns) {
      insertRun(db, run);
    }

    const countAfter = getRunCount(db);
    db.close();

    inserted = countAfter - countBefore;

    res.json({
      message: `Ingestion complete`,
      newRunsInserted: inserted,
      totalInDb: countAfter,
    });
  } catch (err) {
    console.error("POST /api/ingest error:", err);
    res.status(500).json({ error: "Ingestion failed" });
  }
});

// ── Error handler ────────────────────────────────────────────────────────────

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n╔═══════════════════════════════════════════════╗`);
  console.log(`║     STS2 Analytics Server running             ║`);
  console.log(`╚═══════════════════════════════════════════════╝`);
  console.log(`  Dashboard : http://localhost:${PORT}/`);
  console.log(`  Runs API  : http://localhost:${PORT}/api/runs`);
  console.log(`  Stats API : http://localhost:${PORT}/api/stats`);
  console.log(`  Ingest    : POST http://localhost:${PORT}/api/ingest`);
  console.log(`\n  Press Ctrl+C to stop\n`);
});
