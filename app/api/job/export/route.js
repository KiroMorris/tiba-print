import { getActiveJob } from '@/lib/jobs';
import { exportJob } from '@/lib/exporter';

export const runtime = 'nodejs';
// Big composites take time; allow a generous budget.
export const maxDuration = 300;

// POST /api/job/export — render the packed result to print file(s).
// Body: { result, dpi, format }
export async function POST(req) {
  const job = getActiveJob();
  const { result, dpi, format } = await req.json();

  if (!result?.bins?.length) {
    return Response.json({ error: 'Nothing to export — pack the job first.' }, { status: 400 });
  }

  try {
    const files = await exportJob(result, {
      dpi: dpi || job.dpi,
      format: format || job.out_format,
      jobName: job.name || 'job',
    });
    return Response.json({ files });
  } catch (err) {
    return Response.json({ error: String(err.message || err) }, { status: 500 });
  }
}
