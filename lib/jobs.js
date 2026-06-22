import { db } from './db.js';

// Get or create the single active job. For v1 we keep one working job; Phase 5
// adds save/reload of multiple named jobs.
export function getActiveJob() {
  let job = db.prepare('SELECT * FROM jobs ORDER BY id DESC LIMIT 1').get();
  if (!job) {
    const info = db.prepare('INSERT INTO jobs (name) VALUES (?)').run('Untitled Job');
    job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(info.lastInsertRowid);
  }
  return job;
}

export function updateJob(id, patch) {
  const cols = ['name', 'roll_w_cm', 'max_len_m', 'gap_mm', 'edge_mm', 'dpi', 'out_format', 'units'];
  const keys = Object.keys(patch).filter((k) => cols.includes(k));
  if (keys.length) {
    const setClause = keys.map((k) => `${k} = @${k}`).join(', ');
    const values = {};
    for (const k of keys) values[k] = patch[k];
    db.prepare(`UPDATE jobs SET ${setClause} WHERE id = @id`).run({ ...values, id });
  }
  return db.prepare('SELECT * FROM jobs WHERE id = ?').get(id);
}

// Job items joined with their design's physical size + rotation flag.
export function getJobItems(jobId) {
  return db
    .prepare(
      `SELECT ji.id, ji.job_id, ji.design_id, ji.qty, ji.fill_rest,
              d.name, d.phys_w_cm, d.phys_h_cm, d.allow_rotate,
              d.file_type
       FROM job_items ji
       JOIN designs d ON d.id = ji.design_id
       WHERE ji.job_id = ?
       ORDER BY ji.id`
    )
    .all(jobId);
}

export function addJobItem(jobId, designId, qty = 1) {
  // If already present, bump quantity instead of duplicating.
  const existing = db
    .prepare('SELECT * FROM job_items WHERE job_id = ? AND design_id = ?')
    .get(jobId, designId);
  if (existing) {
    db.prepare('UPDATE job_items SET qty = qty + ? WHERE id = ?').run(qty, existing.id);
    return existing.id;
  }
  const info = db
    .prepare('INSERT INTO job_items (job_id, design_id, qty) VALUES (?, ?, ?)')
    .run(jobId, designId, qty);
  return info.lastInsertRowid;
}

export function updateJobItem(id, patch) {
  const cols = ['qty', 'fill_rest'];
  const keys = Object.keys(patch).filter((k) => cols.includes(k));
  if (!keys.length) return;
  const setClause = keys.map((k) => `${k} = @${k}`).join(', ');
  const values = {};
  for (const k of keys) values[k] = patch[k];
  db.prepare(`UPDATE job_items SET ${setClause} WHERE id = @id`).run({ ...values, id });
}

export function removeJobItem(id) {
  db.prepare('DELETE FROM job_items WHERE id = ?').run(id);
}

// Remove every design from a job (clears the canvas / starts fresh).
export function clearJob(jobId) {
  db.prepare('DELETE FROM job_items WHERE job_id = ?').run(jobId);
}

export function savePlacements(jobId, packResult) {
  // Store the full pack result on the job for the canvas + export to read back.
  db.prepare('UPDATE jobs SET name = name WHERE id = ?').run(jobId); // touch
  const stmt = db.prepare('UPDATE job_items SET placements = ? WHERE id = ?');
  // We don't split placements per item row here; the canvas reads the job-level
  // result from the pack endpoint response. Kept simple for v1.
}
