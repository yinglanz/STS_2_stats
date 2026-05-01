/**
 * File watcher — auto-ingests new .run files as they appear in history/
 *
 * Usage: npx ts-node src/server/watcher.ts
 *
 * Watches history/ for new .run files, extracts them, inserts into SQLite DB,
 * then regenerates dashboard.html automatically.
 */

import fs from "fs";
import path from "path";
import { openDb, insertRun, getRunCount } from "../analyze/database";
import { extractRun } from "../analyze/extractRunData";
import { RunData } from "../analyze/types";
import { generateDashboardHtml } from "../analyze/generateDashboard_v2";

import { HISTORY_PATH } from "../config";

/**
 * Parse and ingest a single .run file into the DB.
 * Returns true if a new run was inserted, false if it was a duplicate.
 */
function ingestFile(filePath: string): boolean {
  const content = fs.readFileSync(filePath, "utf-8");
  const rawRun = JSON.parse(content) as RunData;

  const runId = `run_${rawRun.start_time}`;
  const extracted = extractRun(rawRun, runId);

  const db = openDb();
  const countBefore = getRunCount(db);
  insertRun(db, extracted);
  const countAfter = getRunCount(db);
  db.close();

  return countAfter > countBefore;
}

// ── Start watcher ────────────────────────────────────────────────────────────

console.log(`\n╔═══════════════════════════════════════════════╗`);
console.log(`║     STS2 File Watcher active                  ║`);
console.log(`╚═══════════════════════════════════════════════╝`);
console.log(`  Watching: ${HISTORY_PATH}`);
console.log(`  Press Ctrl+C to stop\n`);

// Debounce map to avoid double-firing on the same file
const debounce = new Map<string, NodeJS.Timeout>();
const DEBOUNCE_MS = 500;

fs.watch(HISTORY_PATH, (event, filename) => {
  if (!filename || !filename.endsWith(".run")) return;

  // Debounce — fs.watch can fire twice for a single write
  if (debounce.has(filename)) {
    clearTimeout(debounce.get(filename)!);
  }

  debounce.set(
    filename,
    setTimeout(() => {
      debounce.delete(filename);

      const fullPath = path.join(HISTORY_PATH, filename);
      if (!fs.existsSync(fullPath)) return; // file was deleted, not created

      try {
        const isNew = ingestFile(fullPath);
        if (isNew) {
          console.log(`[${new Date().toLocaleTimeString()}] ✓ New run ingested: ${filename}`);

          // Regenerate dashboard after ingestion
          try {
            generateDashboardHtml();
            console.log(`[${new Date().toLocaleTimeString()}] ✓ Dashboard regenerated`);
          } catch (dashErr) {
            console.error(`  Dashboard regeneration failed:`, dashErr);
          }
        } else {
          console.log(`[${new Date().toLocaleTimeString()}] - Skipped duplicate: ${filename}`);
        }
      } catch (err) {
        console.error(`[${new Date().toLocaleTimeString()}] ✗ Failed to ingest ${filename}:`, err);
      }
    }, DEBOUNCE_MS)
  );
});
