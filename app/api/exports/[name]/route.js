import fs from 'node:fs';
import path from 'node:path';
import { EXPORTS_DIR } from '@/lib/db';

export const runtime = 'nodejs';

const MIME = { '.png': 'image/png', '.tif': 'image/tiff', '.pdf': 'application/pdf' };

// Serve a rendered export file for download.
export async function GET(_req, { params }) {
  const { name } = await params;
  const safe = path.basename(decodeURIComponent(name)); // prevent traversal
  const abs = path.join(EXPORTS_DIR, safe);
  if (!abs.startsWith(EXPORTS_DIR) || !fs.existsSync(abs)) {
    return new Response('Not found', { status: 404 });
  }
  const buf = fs.readFileSync(abs);
  const ext = path.extname(abs).toLowerCase();
  return new Response(buf, {
    headers: {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${safe}"`,
    },
  });
}
