import sharp from 'sharp';
import path from 'node:path';
import { getDesign } from '@/lib/designs';
import { FILES_DIR } from '@/lib/db';

export const runtime = 'nodejs';

// Small trimmed thumbnail for the library list. Not used on the layout canvas
// (that stays as colored placeholders for speed) — only the side panel.
export async function GET(_req, { params }) {
  const { id } = await params;
  const design = getDesign(Number(id));
  if (!design) return new Response('Not found', { status: 404 });

  const abs = path.join(FILES_DIR, design.file_path);

  try {
    let img;
    if (design.file_type === 'svg') {
      const { Resvg } = await import('@resvg/resvg-js');
      const fs = await import('node:fs');
      const r = new Resvg(fs.readFileSync(abs), { fitTo: { mode: 'width', value: 200 } });
      img = sharp(r.render().asPng());
    } else if (design.file_type === 'pdf') {
      // Reuse ingest's PDF rasterizer path indirectly via a low-res render.
      const { ingestPreviewPng } = await import('@/lib/ingest-preview');
      img = sharp(await ingestPreviewPng(abs));
    } else {
      img = sharp(abs, { limitInputPixels: false });
    }

    const out = await img
      .trim({ threshold: 10 })
      .resize(160, 160, { fit: 'inside', withoutEnlargement: true })
      .png()
      .toBuffer();

    return new Response(out, {
      headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400' },
    });
  } catch (err) {
    return new Response(`Thumb error: ${err.message}`, { status: 500 });
  }
}
