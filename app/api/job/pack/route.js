import { getActiveJob, getJobItems } from '@/lib/jobs';
import { packDesigns, expandItems } from '@/lib/packer';

export const runtime = 'nodejs';

// POST /api/job/pack — auto-pack the active job with the given (or saved) settings.
// Body may override settings live from the UI: { roll_w_cm, max_len_m, gap_mm, edge_mm, allow_rotate }
export async function POST(req) {
  const job = getActiveJob();
  const items = getJobItems(job.id);
  const overrides = await req.json().catch(() => ({}));

  const settings = {
    roll_w_cm: overrides.roll_w_cm ?? job.roll_w_cm,
    max_len_cm: (overrides.max_len_m ?? job.max_len_m) * 100,
    gap_mm: overrides.gap_mm ?? job.gap_mm,
    edge_mm: overrides.edge_mm ?? job.edge_mm,
    allow_rotate: overrides.allow_rotate ?? true,
  };

  if (!items.length) {
    return Response.json({ result: { bins: [], waste_pct: 0, total_used_len_cm: 0, roll_w_cm: settings.roll_w_cm, max_len_cm: settings.max_len_cm }, items });
  }

  const copies = expandItems(items, settings);
  const result = packDesigns(copies, settings);
  return Response.json({ result, items });
}
