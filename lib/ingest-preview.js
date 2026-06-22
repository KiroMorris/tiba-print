import fs from 'node:fs';

// Low-res first-page PDF render used for library thumbnails.
export async function ingestPreviewPng(absPath) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const data = new Uint8Array(fs.readFileSync(absPath));
  const doc = await pdfjs.getDocument({ data, disableFontFace: true, isEvalSupported: false }).promise;
  const page = await doc.getPage(1);
  const viewport = page.getViewport({ scale: 1.5 });
  const { createCanvas } = await import('@napi-rs/canvas');
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const ctx = canvas.getContext('2d');
  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas.toBuffer('image/png');
}
