import { db } from '@/lib/db';

export const runtime = 'nodejs';

// Confirms the server + SQLite are wired. Returns table counts.
export async function GET() {
  const tables = ['brands', 'designs', 'jobs', 'job_items'];
  const counts = {};
  for (const t of tables) {
    counts[t] = db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n;
  }
  return Response.json({ ok: true, db: 'connected', counts });
}
