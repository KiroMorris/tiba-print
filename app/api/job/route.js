import { getActiveJob, updateJob, getJobItems, clearJob } from '@/lib/jobs';

export const runtime = 'nodejs';

// GET /api/job — the active job + its items.
export async function GET() {
  const job = getActiveJob();
  const items = getJobItems(job.id);
  return Response.json({ job, items });
}

// PATCH /api/job — update job settings (roll width, max len, gap, dpi, format…).
export async function PATCH(req) {
  const job = getActiveJob();
  const patch = await req.json();
  const updated = updateJob(job.id, patch);
  return Response.json({ job: updated });
}

// DELETE /api/job — clear the job (remove all designs from it).
export async function DELETE() {
  const job = getActiveJob();
  clearJob(job.id);
  return Response.json({ items: getJobItems(job.id) });
}
