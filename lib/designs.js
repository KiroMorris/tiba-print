import { db } from './db.js';

// --- Brands ---
export function listBrands() {
  return db.prepare('SELECT * FROM brands ORDER BY name').all();
}

export function ensureBrand(name) {
  if (!name || !name.trim()) return null;
  const n = name.trim();
  const existing = db.prepare('SELECT * FROM brands WHERE name = ?').get(n);
  if (existing) return existing;
  const info = db.prepare('INSERT INTO brands (name) VALUES (?)').run(n);
  return db.prepare('SELECT * FROM brands WHERE id = ?').get(info.lastInsertRowid);
}

// --- Designs ---
export function listDesigns() {
  return db
    .prepare(
      `SELECT d.*, b.name AS brand_name
       FROM designs d LEFT JOIN brands b ON b.id = d.brand_id
       ORDER BY d.created_at DESC`
    )
    .all();
}

export function getDesign(id) {
  return db.prepare('SELECT * FROM designs WHERE id = ?').get(id);
}

export function insertDesign(d) {
  const stmt = db.prepare(`
    INSERT INTO designs
      (brand_id, name, file_path, file_type, src_w_px, src_h_px,
       trim_x, trim_y, trim_w, trim_h, auto_trim, phys_w_cm, phys_h_cm, allow_rotate)
    VALUES
      (@brand_id, @name, @file_path, @file_type, @src_w_px, @src_h_px,
       @trim_x, @trim_y, @trim_w, @trim_h, @auto_trim, @phys_w_cm, @phys_h_cm, @allow_rotate)
  `);
  const info = stmt.run({
    brand_id: d.brand_id ?? null,
    name: d.name,
    file_path: d.file_path,
    file_type: d.file_type,
    src_w_px: d.src_w_px,
    src_h_px: d.src_h_px,
    trim_x: d.trim_x,
    trim_y: d.trim_y,
    trim_w: d.trim_w,
    trim_h: d.trim_h,
    auto_trim: d.auto_trim ?? 1,
    phys_w_cm: d.phys_w_cm,
    phys_h_cm: d.phys_h_cm,
    allow_rotate: d.allow_rotate ?? 1,
  });
  return getDesign(info.lastInsertRowid);
}

const EDITABLE = ['name', 'phys_w_cm', 'phys_h_cm', 'allow_rotate', 'auto_trim', 'brand_id'];

export function updateDesign(id, patch) {
  const keys = Object.keys(patch).filter((k) => EDITABLE.includes(k));
  if (!keys.length) return getDesign(id);
  const setClause = keys.map((k) => `${k} = @${k}`).join(', ');
  const values = {};
  for (const k of keys) values[k] = patch[k];
  db.prepare(`UPDATE designs SET ${setClause} WHERE id = @id`).run({ ...values, id });
  return getDesign(id);
}

export function deleteDesign(id) {
  db.prepare('DELETE FROM designs WHERE id = ?').run(id);
}

// Delete every design (and empty out any brands). Wipes the whole library.
export function clearAllDesigns() {
  db.prepare('DELETE FROM designs').run();
  db.prepare('DELETE FROM brands').run();
}
