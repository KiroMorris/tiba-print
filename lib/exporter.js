import sharp from 'sharp';
import path from 'node:path';
import fs from 'node:fs';
import { PDFDocument } from 'pdf-lib';
import { getDesign } from './designs.js';
import { FILES_DIR, EXPORTS_DIR } from './db.js';

const CM_PER_INCH = 2.54;

// Render one design to an exact pixel size (its on-roll footprint at DPI),
// honoring auto-trim and rotation. Returns a PNG buffer + the px dimensions.
async function renderDesignToPx(design, targetWpx, targetHpx, rotated) {
  const abs = path.join(FILES_DIR, design.file_path);

  // Get a raster source at high quality.
  let base;
  if (design.file_type === 'svg') {
    const { Resvg } = await import('@resvg/resvg-js');
    // Render SVG directly at the target width for crispness.
    const widthForRender = rotated ? targetHpx : targetWpx;
    const r = new Resvg(fs.readFileSync(abs), {
      fitTo: { mode: 'width', value: Math.max(widthForRender, 8) },
    });
    base = sharp(r.render().asPng(), { limitInputPixels: false });
  } else if (design.file_type === 'pdf') {
    const { ingestPreviewPng } = await import('./ingest-preview.js');
    // Re-render PDF at higher scale for export quality.
    base = sharp(await renderPdfAtScale(abs, 6), { limitInputPixels: false });
  } else {
    base = sharp(abs, { limitInputPixels: false });
  }

  // Auto-trim transparent padding if enabled, so the physical size maps to the
  // real artwork (matches what was measured at import).
  if (design.auto_trim) {
    base = base.trim({ threshold: 10 });
  }

  // Resize to the exact on-roll footprint. If rotated, we resize to the
  // pre-rotation size then rotate 90°.
  const w = rotated ? targetHpx : targetWpx;
  const h = rotated ? targetWpx : targetHpx;
  base = base.resize(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)), {
    fit: 'fill',
  });
  if (rotated) base = base.rotate(90);

  const buf = await base.png().toBuffer();
  const meta = await sharp(buf).metadata();
  return { buf, w: meta.width, h: meta.height };
}

async function renderPdfAtScale(absPath, scale) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const data = new Uint8Array(fs.readFileSync(absPath));
  const doc = await pdfjs.getDocument({ data, disableFontFace: true, isEvalSupported: false }).promise;
  const page = await doc.getPage(1);
  const viewport = page.getViewport({ scale });
  const { createCanvas } = await import('@napi-rs/canvas');
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const ctx = canvas.getContext('2d');
  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas.toBuffer('image/png');
}

// Export every bin to a print file. Trim-to-content: canvas length = used length.
// Returns [{ name, path, url, size }].
export async function exportJob(result, { dpi = 300, format = 'png', jobName = 'job' } = {}) {
  const pxPerCm = dpi / CM_PER_INCH;
  const out = [];
  const stamp = Date.now();

  for (const bin of result.bins) {
    const rollWpx = Math.round(result.roll_w_cm * pxPerCm);
    const usedLenPx = Math.max(1, Math.round(bin.used_len_cm * pxPerCm));

    // Build the composite layer list — one entry per placed design.
    const composites = [];
    for (const it of bin.items) {
      const design = getDesign(it.design_id);
      if (!design) continue;
      const wpx = Math.round(it.w_cm * pxPerCm);
      const hpx = Math.round(it.h_cm * pxPerCm);
      const { buf } = await renderDesignToPx(design, wpx, hpx, it.rotated);
      composites.push({
        input: buf,
        left: Math.round(it.x_cm * pxPerCm),
        top: Math.round(it.y_cm * pxPerCm),
      });
    }

    // Transparent canvas at exact roll width × used length.
    let canvas = sharp({
      create: {
        width: rollWpx,
        height: usedLenPx,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
      limitInputPixels: false,
    }).composite(composites);

    const safeName = jobName.replace(/[^a-z0-9_-]+/gi, '_');
    const fileNo = `${bin.index + 1}of${result.bins.length}`;
    let ext = format === 'tiff' ? 'tif' : format === 'pdf' ? 'pdf' : 'png';
    const filename = `${safeName}_File${fileNo}_${dpi}dpi_${stamp}.${ext}`;
    const absOut = path.join(EXPORTS_DIR, filename);

    if (format === 'png') {
      await canvas.png({ compressionLevel: 9 }).withMetadata({ density: dpi }).toFile(absOut);
    } else if (format === 'tiff') {
      // Tiled TIFF — the crash-proof option for big sheets in RIP software.
      await canvas
        .tiff({ compression: 'deflate', tile: true, tileWidth: 256, tileHeight: 256, xres: dpi / 2.54, yres: dpi / 2.54, resolutionUnit: 'inch' })
        .toFile(absOut);
    } else if (format === 'pdf') {
      // Render to PNG then embed in a PDF page sized to the physical dimensions.
      const pngBuf = await canvas.png().toBuffer();
      const pdf = await PDFDocument.create();
      const img = await pdf.embedPng(pngBuf);
      // PDF points: 72 per inch. Page = physical size.
      const wPt = (result.roll_w_cm / CM_PER_INCH) * 72;
      const hPt = (bin.used_len_cm / CM_PER_INCH) * 72;
      const page = pdf.addPage([wPt, hPt]);
      page.drawImage(img, { x: 0, y: 0, width: wPt, height: hPt });
      fs.writeFileSync(absOut, await pdf.save());
    }

    const stat = fs.statSync(absOut);
    out.push({
      name: filename,
      path: absOut,
      url: `/api/exports/${encodeURIComponent(filename)}`,
      size: humanSize(stat.size),
    });
  }

  return out;
}

function humanSize(bytes) {
  const u = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < u.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(1)} ${u[i]}`;
}
