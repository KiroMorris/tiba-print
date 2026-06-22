import sharp from 'sharp';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { FILES_DIR } from './db.js';

// Default physical size when we can't infer one: assume the source is at 300 DPI.
const ASSUME_DPI = 300;

const EXT_TYPE = {
  '.png': 'png',
  '.jpg': 'jpg',
  '.jpeg': 'jpg',
  '.webp': 'png',
  '.svg': 'svg',
  '.pdf': 'pdf',
};

export function detectType(filename) {
  const ext = path.extname(filename).toLowerCase();
  return EXT_TYPE[ext] || null;
}

// Persist the uploaded bytes under data/files/<hash><ext> and return the
// relative path we store in the DB.
export function saveOriginal(buffer, filename) {
  const hash = crypto.createHash('sha1').update(buffer).digest('hex').slice(0, 16);
  const ext = path.extname(filename).toLowerCase() || '.bin';
  const rel = `${hash}${ext}`;
  const abs = path.join(FILES_DIR, rel);
  if (!fs.existsSync(abs)) fs.writeFileSync(abs, buffer);
  return rel;
}

// Rasterize any supported input to a PNG buffer so sharp can measure + trim it.
// Returns { png, width, height } at native resolution.
async function toRasterPng(buffer, type) {
  if (type === 'png' || type === 'jpg') {
    const img = sharp(buffer, { limitInputPixels: false });
    const meta = await img.metadata();
    const png = await img.png().toBuffer();
    return { png, width: meta.width, height: meta.height };
  }

  if (type === 'svg') {
    // resvg gives accurate vector rasterization. Render at a high zoom so the
    // trim/measurement is precise; physical size is set by the user anyway.
    const { Resvg } = await import('@resvg/resvg-js');
    const r = new Resvg(buffer, { fitTo: { mode: 'zoom', value: 4 } });
    const rendered = r.render();
    const png = rendered.asPng();
    return { png, width: rendered.width, height: rendered.height };
  }

  if (type === 'pdf') {
    const png = await rasterizePdfFirstPage(buffer);
    const meta = await sharp(png).metadata();
    return { png, width: meta.width, height: meta.height };
  }

  throw new Error(`Unsupported type: ${type}`);
}

// Render the first page of a PDF to a PNG buffer using pdfjs + @napi-rs/canvas.
async function rasterizePdfFirstPage(buffer) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    disableFontFace: true,
    isEvalSupported: false,
  }).promise;
  const page = await doc.getPage(1);
  const viewport = page.getViewport({ scale: 3 }); // ~216 DPI for measurement

  const { createCanvas } = await import('@napi-rs/canvas');
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const ctx = canvas.getContext('2d');
  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas.toBuffer('image/png');
}

// Find the tight content bounds of a (possibly transparent) raster.
// sharp.trim() removes uniform borders; we compute the resulting offset/size.
async function contentBounds(png, width, height) {
  try {
    const { info } = await sharp(png, { limitInputPixels: false })
      .trim({ threshold: 10 })
      .toBuffer({ resolveWithObject: true });
    // trimOffsetLeft/Top tell us where the content starts.
    const tx = -(info.trimOffsetLeft ?? 0);
    const ty = -(info.trimOffsetTop ?? 0);
    return {
      trim_x: Math.max(0, tx),
      trim_y: Math.max(0, ty),
      trim_w: info.width,
      trim_h: info.height,
    };
  } catch {
    // Fully uniform image (nothing to trim) — use full bounds.
    return { trim_x: 0, trim_y: 0, trim_w: width, trim_h: height };
  }
}

// Full ingest: save original, measure, trim, and compute a default physical size.
export async function ingestFile(buffer, filename) {
  const type = detectType(filename);
  if (!type) throw new Error(`Unsupported file: ${filename}`);

  const file_path = saveOriginal(buffer, filename);
  const { png, width, height } = await toRasterPng(buffer, type);
  const bounds = await contentBounds(png, width, height);

  // Default physical size: trimmed content interpreted at 300 DPI (1in = 2.54cm).
  const phys_w_cm = +((bounds.trim_w / ASSUME_DPI) * 2.54).toFixed(2);
  const phys_h_cm = +((bounds.trim_h / ASSUME_DPI) * 2.54).toFixed(2);

  return {
    name: path.parse(filename).name,
    file_path,
    file_type: type,
    src_w_px: width,
    src_h_px: height,
    ...bounds,
    phys_w_cm,
    phys_h_cm,
  };
}
