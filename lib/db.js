import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';

// All app data lives locally under ./data — nothing leaves the machine.
const DATA_DIR = path.join(process.cwd(), 'data');
const FILES_DIR = path.join(DATA_DIR, 'files');
const EXPORTS_DIR = path.join(DATA_DIR, 'exports');
const DB_PATH = path.join(DATA_DIR, 'library.db');

for (const dir of [DATA_DIR, FILES_DIR, EXPORTS_DIR]) {
  fs.mkdirSync(dir, { recursive: true });
}

// Reuse a single connection across hot-reloads in dev.
let db = globalThis.__tibaDb;
if (!db) {
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  migrate(db);
  globalThis.__tibaDb = db;
}

function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS brands (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL UNIQUE,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS designs (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      brand_id     INTEGER REFERENCES brands(id) ON DELETE SET NULL,
      name         TEXT NOT NULL,
      file_path    TEXT NOT NULL,           -- relative to data/files
      file_type    TEXT NOT NULL,           -- png | jpg | pdf | svg
      src_w_px     INTEGER NOT NULL,        -- source pixel size
      src_h_px     INTEGER NOT NULL,
      trim_x       INTEGER NOT NULL DEFAULT 0,  -- auto-trimmed content bounds (px)
      trim_y       INTEGER NOT NULL DEFAULT 0,
      trim_w       INTEGER NOT NULL DEFAULT 0,
      trim_h       INTEGER NOT NULL DEFAULT 0,
      auto_trim    INTEGER NOT NULL DEFAULT 1,   -- 0/1 toggle per design
      phys_w_cm    REAL NOT NULL,           -- physical print size (editable)
      phys_h_cm    REAL NOT NULL,
      src_dpi      INTEGER NOT NULL DEFAULT 300,  -- real DPI read from the file
      needs_enhance INTEGER NOT NULL DEFAULT 0,   -- 1 = below 300 DPI, will print soft
      allow_rotate INTEGER NOT NULL DEFAULT 1,
      created_at   TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS jobs (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL,
      roll_w_cm   REAL NOT NULL DEFAULT 57,
      max_len_m   REAL NOT NULL DEFAULT 30,
      gap_mm      REAL NOT NULL DEFAULT 3,
      edge_mm     REAL NOT NULL DEFAULT 5,   -- safety margin at roll edges
      dpi         INTEGER NOT NULL DEFAULT 300,
      out_format  TEXT NOT NULL DEFAULT 'png',
      units       TEXT NOT NULL DEFAULT 'metric',
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS job_items (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id     INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      design_id  INTEGER NOT NULL REFERENCES designs(id) ON DELETE CASCADE,
      qty        INTEGER NOT NULL DEFAULT 1,
      fill_rest  INTEGER NOT NULL DEFAULT 0,  -- fill remaining roll with this design
      -- placement after packing (per copy resolved at pack time, stored as JSON):
      placements TEXT
    );
  `);

  // Migrations for DBs created before a column existed. ALTER ... ADD COLUMN
  // throws if the column already exists, so guard each one.
  const designCols = db.prepare(`PRAGMA table_info(designs)`).all().map((c) => c.name);
  if (!designCols.includes('src_dpi')) {
    db.exec(`ALTER TABLE designs ADD COLUMN src_dpi INTEGER NOT NULL DEFAULT 300`);
  }
  if (!designCols.includes('needs_enhance')) {
    db.exec(`ALTER TABLE designs ADD COLUMN needs_enhance INTEGER NOT NULL DEFAULT 0`);
  }
}

export { db, DATA_DIR, FILES_DIR, EXPORTS_DIR };
