import { listDesigns, insertDesign, ensureBrand, clearAllDesigns } from '@/lib/designs';
import { ingestFile } from '@/lib/ingest';

export const runtime = 'nodejs';

// GET /api/designs — list all designs (with brand name).
export async function GET() {
  return Response.json({ designs: listDesigns() });
}

// DELETE /api/designs — clear the ENTIRE library (all designs + brands).
export async function DELETE() {
  clearAllDesigns();
  return Response.json({ designs: [] });
}

// POST /api/designs — multipart upload of one or more files.
// Optional form field `brand` assigns them all to that brand.
export async function POST(req) {
  const form = await req.formData();
  const files = form.getAll('files');
  const brandName = form.get('brand');
  const brand = brandName ? ensureBrand(brandName) : null;

  if (!files.length) {
    return Response.json({ error: 'No files uploaded' }, { status: 400 });
  }

  const created = [];
  const errors = [];
  for (const file of files) {
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const meta = await ingestFile(buffer, file.name);
      const design = insertDesign({ ...meta, brand_id: brand?.id ?? null });
      created.push(design);
    } catch (err) {
      errors.push({ file: file.name, error: String(err.message || err) });
    }
  }

  return Response.json({ created, errors });
}
