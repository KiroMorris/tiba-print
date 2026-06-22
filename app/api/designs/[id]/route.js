import { getDesign, updateDesign, deleteDesign } from '@/lib/designs';

export const runtime = 'nodejs';

export async function GET(_req, { params }) {
  const { id } = await params;
  const design = getDesign(Number(id));
  if (!design) return Response.json({ error: 'Not found' }, { status: 404 });
  return Response.json({ design });
}

// PATCH — edit physical size, name, rotate/trim flags, or brand.
export async function PATCH(req, { params }) {
  const { id } = await params;
  const patch = await req.json();
  const design = updateDesign(Number(id), patch);
  if (!design) return Response.json({ error: 'Not found' }, { status: 404 });
  return Response.json({ design });
}

export async function DELETE(_req, { params }) {
  const { id } = await params;
  deleteDesign(Number(id));
  return Response.json({ ok: true });
}
