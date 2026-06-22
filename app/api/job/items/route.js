import { getActiveJob, addJobItem, getJobItems } from '@/lib/jobs';

export const runtime = 'nodejs';

// POST /api/job/items — add a design to the active job (or bump its qty).
export async function POST(req) {
  const job = getActiveJob();
  const { design_id, qty } = await req.json();
  if (!design_id) return Response.json({ error: 'design_id required' }, { status: 400 });
  addJobItem(job.id, design_id, qty || 1);
  return Response.json({ items: getJobItems(job.id) });
}
