import { getActiveJob, updateJobItem, removeJobItem, getJobItems } from '@/lib/jobs';

export const runtime = 'nodejs';

// PATCH — change quantity or fill_rest for a job item.
export async function PATCH(req, { params }) {
  const { id } = await params;
  const patch = await req.json();
  updateJobItem(Number(id), patch);
  const job = getActiveJob();
  return Response.json({ items: getJobItems(job.id) });
}

// DELETE — remove a design from the job.
export async function DELETE(_req, { params }) {
  const { id } = await params;
  removeJobItem(Number(id));
  const job = getActiveJob();
  return Response.json({ items: getJobItems(job.id) });
}
