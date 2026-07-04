/**
 * SQLite database layer for STS2 run data
 * Replaces extracted_runs.json with queryable persistent storage
 */

import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import type { ExtractedRun } from "./types";

const OUTPUT_PATH = path.join(__dirname, "../../output");
const DB_PATH = path.join(OUTPUT_PATH, "runs.db");

/**
 * Open (or create) the database and ensure schema exists
 */
export function openDb(): Database.Database {
  if (!fs.existsSync(OUTPUT_PATH)) {
    fs.mkdirSync(OUTPUT_PATH, { recursive: true });
  }

  const db = new Database(DB_PATH);

  // Enable WAL mode for better write performance
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS runs (
      id    TEXT PRIMARY KEY,
      t     INTEGER NOT NULL,
      c     TEXT    NOT NULL,
      a     INTEGER NOT NULL,
      w     INTEGER NOT NULL,
      m     INTEGER NOT NULL,
      dmg   INTEGER NOT NULL,
      sz    INTEGER NOT NULL,
      rc    INTEGER NOT NULL,
      fl    INTEGER NOT NULL DEFAULT 0,
      seed  TEXT    NOT NULL DEFAULT '',
      dur   INTEGER NOT NULL DEFAULT 0,
      acts  TEXT    NOT NULL DEFAULT '',
      cp    INTEGER NOT NULL DEFAULT 0,
      a1c   TEXT    NOT NULL DEFAULT '[]',
      a2c   TEXT    NOT NULL DEFAULT '[]',
      a3c   TEXT    NOT NULL DEFAULT '[]',
      alc   TEXT,
      k     TEXT,
      v     TEXT    NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS run_cards (
      run_id   TEXT    NOT NULL REFERENCES runs(id),
      card_id  TEXT    NOT NULL,
      upgraded INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS run_relics (
      run_id   TEXT NOT NULL REFERENCES runs(id),
      relic_id TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS run_encounters (
      run_id   TEXT    NOT NULL REFERENCES runs(id),
      enc_id   TEXT    NOT NULL,
      act      INTEGER NOT NULL,
      damage   INTEGER,
      survived INTEGER NOT NULL,
      enc_type TEXT    DEFAULT 'monster',
      turns    INTEGER DEFAULT 0,
      potions  INTEGER DEFAULT 0,
      floor_num INTEGER DEFAULT 0,
      max_hp   INTEGER DEFAULT 80
    );

    CREATE TABLE IF NOT EXISTS run_potions (
      run_id       TEXT    NOT NULL REFERENCES runs(id),
      potion_id    TEXT    NOT NULL,
      offered      INTEGER NOT NULL DEFAULT 0,
      picked       INTEGER NOT NULL DEFAULT 0,
      bought       INTEGER NOT NULL DEFAULT 0,
      used         INTEGER NOT NULL DEFAULT 0,
      discarded    INTEGER NOT NULL DEFAULT 0,
      floor_offered INTEGER DEFAULT NULL,
      floor_used   INTEGER DEFAULT NULL,
      act_offered  INTEGER DEFAULT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_runs_c   ON runs(c);
    CREATE INDEX IF NOT EXISTS idx_runs_a   ON runs(a);
    CREATE INDEX IF NOT EXISTS idx_runs_w   ON runs(w);
    CREATE INDEX IF NOT EXISTS idx_cards_run ON run_cards(run_id);
    CREATE INDEX IF NOT EXISTS idx_relics_run ON run_relics(run_id);
    CREATE INDEX IF NOT EXISTS idx_encs_run  ON run_encounters(run_id);
    CREATE INDEX IF NOT EXISTS idx_potions_run ON run_potions(run_id);
  `);

  // Add columns for existing DBs that predate these fields.
  // addColumnIfMissing swallows only the expected "column already exists" error —
  // any other failure (disk, syntax, locked file) propagates instead of being silently lost.
  addColumnIfMissing(db, `ALTER TABLE runs ADD COLUMN fl INTEGER NOT NULL DEFAULT 0`);
  addColumnIfMissing(db, `ALTER TABLE runs ADD COLUMN seed TEXT NOT NULL DEFAULT ''`);
  addColumnIfMissing(db, `ALTER TABLE runs ADD COLUMN dur INTEGER NOT NULL DEFAULT 0`);
  addColumnIfMissing(db, `ALTER TABLE runs ADD COLUMN acts TEXT NOT NULL DEFAULT ''`);
  addColumnIfMissing(db, `ALTER TABLE runs ADD COLUMN cp INTEGER NOT NULL DEFAULT 0`);
  addColumnIfMissing(db, `ALTER TABLE runs ADD COLUMN a1c TEXT NOT NULL DEFAULT '[]'`);
  addColumnIfMissing(db, `ALTER TABLE runs ADD COLUMN a2c TEXT NOT NULL DEFAULT '[]'`);
  addColumnIfMissing(db, `ALTER TABLE runs ADD COLUMN a3c TEXT NOT NULL DEFAULT '[]'`);
  addColumnIfMissing(db, `ALTER TABLE runs ADD COLUMN alc TEXT`);
  addColumnIfMissing(db, `ALTER TABLE runs ADD COLUMN a1sk INTEGER NOT NULL DEFAULT 0`);
  addColumnIfMissing(db, `ALTER TABLE runs ADD COLUMN a2sk INTEGER NOT NULL DEFAULT 0`);
  addColumnIfMissing(db, `ALTER TABLE runs ADD COLUMN a3sk INTEGER NOT NULL DEFAULT 0`);
  addColumnIfMissing(db, `ALTER TABLE runs ADD COLUMN skippedCards TEXT NOT NULL DEFAULT '[]'`);
  addColumnIfMissing(db, `ALTER TABLE run_encounters ADD COLUMN enc_type TEXT NOT NULL DEFAULT 'monster'`);
  addColumnIfMissing(db, `ALTER TABLE run_encounters ADD COLUMN turns INTEGER NOT NULL DEFAULT 0`);
  addColumnIfMissing(db, `ALTER TABLE run_encounters ADD COLUMN potions INTEGER NOT NULL DEFAULT 0`);
  addColumnIfMissing(db, `ALTER TABLE run_encounters ADD COLUMN floor_num INTEGER NOT NULL DEFAULT 0`);
  addColumnIfMissing(db, `ALTER TABLE run_encounters ADD COLUMN max_hp INTEGER NOT NULL DEFAULT 80`);
  addColumnIfMissing(db, `ALTER TABLE run_potions ADD COLUMN act_offered INTEGER DEFAULT NULL`);

  relaxEncounterNotNullConstraints(db);

  return db;
}

/**
 * One-time migration: older DBs have `damage`/`enc_type`/`turns`/`potions`/`floor_num`/`max_hp`
 * as NOT NULL on run_encounters, from when ExtractedRun.encs carried that detail per-encounter.
 * The compact encs format ({id, a, s}) no longer captures it, so inserts now pass NULL for those
 * columns — which the old constraint rejects. SQLite can't drop a NOT NULL constraint via ALTER
 * TABLE, so rebuild the table, preserving any historical data already stored for older runs.
 */
function relaxEncounterNotNullConstraints(db: Database.Database): void {
  const columns = db.prepare(`PRAGMA table_info(run_encounters)`).all() as Array<{
    name: string;
    notnull: number;
  }>;
  const damageCol = columns.find((c) => c.name === "damage");
  if (!damageCol || damageCol.notnull === 0) return; // already relaxed (or table doesn't exist yet)

  db.pragma("foreign_keys = OFF");
  db.exec(`
    ALTER TABLE run_encounters RENAME TO run_encounters_old;

    CREATE TABLE run_encounters (
      run_id    TEXT    NOT NULL REFERENCES runs(id),
      enc_id    TEXT    NOT NULL,
      act       INTEGER NOT NULL,
      damage    INTEGER,
      survived  INTEGER NOT NULL,
      enc_type  TEXT    DEFAULT 'monster',
      turns     INTEGER DEFAULT 0,
      potions   INTEGER DEFAULT 0,
      floor_num INTEGER DEFAULT 0,
      max_hp    INTEGER DEFAULT 80
    );

    INSERT INTO run_encounters (run_id, enc_id, act, damage, survived, enc_type, turns, potions, floor_num, max_hp)
      SELECT run_id, enc_id, act, damage, survived, enc_type, turns, potions, floor_num, max_hp FROM run_encounters_old;

    DROP TABLE run_encounters_old;

    CREATE INDEX IF NOT EXISTS idx_encs_run ON run_encounters(run_id);
  `);
  db.pragma("foreign_keys = ON");
}

/**
 * Run an `ALTER TABLE ... ADD COLUMN` migration, ignoring only the error SQLite
 * raises when the column already exists. Any other error (syntax, disk, locked
 * file) is rethrown so a real failure can't be mistaken for a no-op migration.
 */
function addColumnIfMissing(db: Database.Database, sql: string): void {
  try {
    db.exec(sql);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!/duplicate column name/i.test(message)) {
      throw err;
    }
  }
}

/**
 * Insert a single ExtractedRun (skips if run_id already exists)
 */
export function insertRun(db: Database.Database, run: ExtractedRun): void {
  const insertRunStmt = db.prepare(`
    INSERT OR IGNORE INTO runs (id, t, c, a, w, m, dmg, sz, rc, fl, seed, dur, acts, cp, a1c, a2c, a3c, a1sk, a2sk, a3sk, skippedCards, alc, k, v)
    VALUES (@id, @t, @c, @a, @w, @m, @dmg, @sz, @rc, @fl, @seed, @dur, @acts, @cp, @a1c, @a2c, @a3c, @a1sk, @a2sk, @a3sk, @skippedCards, @alc, @k, @v)
  `);

  const insertCard = db.prepare(`
    INSERT INTO run_cards (run_id, card_id, upgraded) VALUES (?, ?, ?)
  `);

  const insertRelic = db.prepare(`
    INSERT INTO run_relics (run_id, relic_id) VALUES (?, ?)
  `);

  const insertEnc = db.prepare(`
    INSERT INTO run_encounters (run_id, enc_id, act, damage, survived, enc_type, turns, potions, floor_num, max_hp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertPotion = db.prepare(`
    INSERT OR IGNORE INTO run_potions (run_id, potion_id, offered, picked, bought, used, discarded, floor_offered, floor_used, act_offered)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Use a transaction for atomicity — all-or-nothing per run
  const txn = db.transaction(() => {
    const inserted = insertRunStmt.run({
      id: run.id,
      t: run.t,
      c: run.c,
      a: run.a,
      w: run.w ? 1 : 0,
      m: run.m,
      dmg: run.dmg,
      sz: run.sz,
      rc: run.rc,
      fl: run.fl,
      seed: run.seed,
      dur: run.dur,
      acts: run.acts,
      cp: run.cp,
      a1c: JSON.stringify(run.a1c),
      a2c: JSON.stringify(run.a2c),
      a3c: JSON.stringify(run.a3c),
      a1sk: run.a1sk ?? 0,
      a2sk: run.a2sk ?? 0,
      a3sk: run.a3sk ?? 0,
      skippedCards: JSON.stringify(run.skippedCards ?? []),
      alc: run.alc && run.alc.length > 0 ? JSON.stringify(run.alc) : null,
      k: run.k ?? null,
      v: run.v ?? '',
    });

    // If run already existed (INSERT OR IGNORE skipped), don't re-insert child rows
    if (inserted.changes === 0) return;

    for (const card of run.cards) {
      insertCard.run(run.id, card, 0);
    }

    for (const relicId of run.relics) {
      insertRelic.run(run.id, relicId);
    }

    for (const enc of run.encs) {
      insertEnc.run(run.id, enc.id, enc.a, null, enc.s ? 1 : 0, null, null, null, null, null);
    }

    for (const pot of run.potions) {
      try {
        insertPotion.run(run.id, pot.id, pot.o, pot.pk ? 1 : 0, pot.b ? 1 : 0, pot.u ? 1 : 0, pot.d ? 1 : 0, null, null, null);
      } catch { /* ignore duplicate potion rows */ }
    }
  });

  txn();
}

/**
 * Bulk-insert all runs using a single transaction for maximum performance
 */
export function insertAllRuns(db: Database.Database, runs: ExtractedRun[]): number {
  const insertRunStmt = db.prepare(`
    INSERT OR IGNORE INTO runs (id, t, c, a, w, m, dmg, sz, rc, fl, seed, dur, acts, cp, a1c, a2c, a3c, a1sk, a2sk, a3sk, skippedCards, alc, k, v)
    VALUES (@id, @t, @c, @a, @w, @m, @dmg, @sz, @rc, @fl, @seed, @dur, @acts, @cp, @a1c, @a2c, @a3c, @a1sk, @a2sk, @a3sk, @skippedCards, @alc, @k, @v)
  `);

  const insertCard = db.prepare(`
    INSERT INTO run_cards (run_id, card_id, upgraded) VALUES (?, ?, ?)
  `);

  const insertRelic = db.prepare(`
    INSERT INTO run_relics (run_id, relic_id) VALUES (?, ?)
  `);

  const insertEnc = db.prepare(`
    INSERT INTO run_encounters (run_id, enc_id, act, damage, survived, enc_type, turns, potions, floor_num, max_hp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertPotion = db.prepare(`
    INSERT INTO run_potions (run_id, potion_id, offered, picked, bought, used, discarded, floor_offered, floor_used, act_offered)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let inserted = 0;

  const txn = db.transaction((runList: ExtractedRun[]) => {
    for (const run of runList) {
      const result = insertRunStmt.run({
        id: run.id,
        t: run.t,
        c: run.c,
        a: run.a,
        w: run.w ? 1 : 0,
        m: run.m,
        dmg: run.dmg,
        sz: run.sz,
        rc: run.rc,
        fl: run.fl,
        seed: run.seed,
        dur: run.dur,
        acts: run.acts,
        cp: run.cp,
        a1c: JSON.stringify(run.a1c),
        a2c: JSON.stringify(run.a2c),
        a3c: JSON.stringify(run.a3c),
        a1sk: run.a1sk ?? 0,
        a2sk: run.a2sk ?? 0,
        a3sk: run.a3sk ?? 0,
        skippedCards: JSON.stringify(run.skippedCards ?? []),
        alc: run.alc ? JSON.stringify(run.alc) : null,
        k: run.k ?? null,
        v: run.v ?? '',
      });

      if (result.changes > 0) {
        inserted++;

        for (const card of run.cards) {
          insertCard.run(run.id, card, 0);
        }
        for (const relicId of run.relics) {
          insertRelic.run(run.id, relicId);
        }
        for (const enc of run.encs) {
          insertEnc.run(run.id, enc.id, enc.a, null, enc.s ? 1 : 0, null, null, null, null, null);
        }
      }
      // Always insert potions (even for re-extracted runs with new act data)
      for (const pot of run.potions) {
        try {
          insertPotion.run(run.id, pot.id, pot.o, pot.pk, pot.b, pot.u, pot.d, null, null, null);
        } catch {
          // Ignore duplicate inserts for same potion
        }
      }
    }
  });

  txn(runs);
  return inserted;
}

/**
 * Load all runs from DB, reconstructing ExtractedRun objects
 */
export function loadAllRunsFromDb(db: Database.Database): ExtractedRun[] {
  const runs = db.prepare(`SELECT * FROM runs ORDER BY t ASC`).all() as any[];

  const cardsByRun = groupBy(
    db.prepare(`SELECT * FROM run_cards`).all() as any[],
    (r) => r.run_id
  );

  const relicsByRun = groupBy(
    db.prepare(`SELECT * FROM run_relics`).all() as any[],
    (r) => r.run_id
  );

  const encsByRun = groupBy(
    db.prepare(`SELECT * FROM run_encounters`).all() as any[],
    (r) => r.run_id
  );

  const potionsByRun = groupBy(
    db.prepare(`SELECT * FROM run_potions`).all() as any[],
    (r) => r.run_id
  );

  return runs.map((row) => ({
    id: row.id,
    t: row.t,
    c: row.c,
    a: row.a,
    w: row.w === 1,
    m: row.m,
    dmg: row.dmg,
    sz: row.sz,
    rc: row.rc,
    fl: row.fl ?? 0,
    seed: row.seed ?? "",
    dur: row.dur ?? 0,
    acts: row.acts ?? "",
    cp: row.cp ?? 0,
    v: row.v ?? '',
    a1c: JSON.parse(row.a1c || "[]"),
    a2c: JSON.parse(row.a2c || "[]"),
    a3c: JSON.parse(row.a3c || "[]"),
    a1sk: row.a1sk ?? 0,
    a2sk: row.a2sk ?? 0,
    a3sk: row.a3sk ?? 0,
    skippedCards: JSON.parse(row.skippedCards || "[]"),
    ...(row.alc ? { alc: JSON.parse(row.alc) } : {}),
    ...(row.k ? { k: row.k } : {}),
    cards: (cardsByRun.get(row.id) ?? []).map((c: any) => c.card_id as string),
    cardsMeta: (cardsByRun.get(row.id) ?? []).map((c: any) => ({
      id: c.card_id as string,
      floor: 0, // floor-per-card not stored in DB; use 0 as fallback
      upgraded: c.upgraded === 1,
    })),
    relics: (relicsByRun.get(row.id) ?? []).map((r: any) => r.relic_id),
    encs: (encsByRun.get(row.id) ?? []).map((e: any) => ({
      id: e.enc_id,
      a: e.act,
      d: e.damage,
      s: e.survived === 1,
      tp: e.enc_type ?? "monster",
      tu: e.turns ?? 0,
      po: e.potions ?? 0,
      fn: e.floor_num ?? 0,
      mx: e.max_hp ?? 80,
    })),
    potions: (potionsByRun.get(row.id) ?? []).map((p: any) => ({
      id: p.potion_id,
      o: p.offered ?? 0,
      pk: p.picked ?? 0,
      b: p.bought ?? 0,
      u: p.used ?? 0,
      d: p.discarded ?? 0,
      fo: p.floor_offered ?? 0,
      fu: p.floor_used ?? 0,
      a: p.act_offered ?? 0,
    })),
  }));
}

/**
 * Get count of runs currently stored
 */
export function getRunCount(db: Database.Database): number {
  const row = db.prepare(`SELECT COUNT(*) as count FROM runs`).get() as any;
  return row.count;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(item);
  }
  return map;
}
