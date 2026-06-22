// DTF roll packer — bottom-left free-rectangle bin packing.
//
// Goal: pack design copies into the roll (fixed width, grows along length) using
// as little length as possible, filling EVERY gap including the strip beside
// tall designs. No overlaps. 90° rotation allowed when it helps.
//
// Algorithm: keep a list of empty "free rectangles". For each item (largest
// first), pick the free rect where the item's TOP sits lowest (then leftmost) —
// this is the classic bottom-left heuristic that naturally fills side strips and
// pockets. Place the item there, then split the consumed free rects around it.
//
// Coordinates are in centimeters. Gap is added around each placed item so the
// printed designs keep their cut spacing.

export function packDesigns(items, settings) {
  const gap = (settings.gap_mm ?? 3) / 10;
  const edge = (settings.edge_mm ?? 5) / 10;
  const roll_w_cm = settings.roll_w_cm ?? 57;
  const max_len_cm = settings.max_len_cm ?? 3000;
  const globalRotate = settings.allow_rotate !== false;

  const usable_w = Math.max(roll_w_cm - edge * 2, 1);

  // Each placed item reserves its size + gap on the right and bottom, so the
  // next item never touches it. We pack in this "padded" space, then strip the
  // gap back off when reporting the real footprint.
  const itemsPadded = items.map((it) => ({
    ...it,
    pw: it.w_cm + gap,
    ph: it.h_cm + gap,
  }));

  // Largest area first — big pieces define the structure, small ones fill in.
  itemsPadded.sort((a, b) => b.pw * b.ph - a.pw * a.ph);

  // Free rectangles in the (infinite-length) roll. Start with the full usable
  // width and effectively unbounded length.
  const BIG = max_len_cm * 4 + 10000;
  let free = [{ x: 0, y: 0, w: usable_w + gap, h: BIG }];

  const placed = [];

  for (const it of itemsPadded) {
    const canRot = globalRotate && it.allow_rotate !== false;

    // Try both orientations, pick the free rect giving the lowest top (best y),
    // tie-break by leftmost x.
    let best = null;
    const tryOrient = (w, h, rotated) => {
      for (const fr of free) {
        if (w <= fr.w + 1e-6 && h <= fr.h + 1e-6) {
          const cand = { x: fr.x, y: fr.y, w, h, rotated, fr };
          if (
            !best ||
            cand.y < best.y - 1e-6 ||
            (Math.abs(cand.y - best.y) < 1e-6 && cand.x < best.x - 1e-6)
          ) {
            best = cand;
          }
        }
      }
    };
    tryOrient(it.pw, it.ph, false);
    if (canRot) tryOrient(it.ph, it.pw, true);

    if (!best) continue; // shouldn't happen with unbounded length

    placed.push({
      id: it.id,
      design_id: it.design_id,
      name: it.name,
      color: it.color,
      needs_enhance: it.needs_enhance ? 1 : 0,
      src_dpi: it.src_dpi ?? 0,
      x: best.x,
      y: best.y,
      w: best.w, // padded
      h: best.h,
      rotated: best.rotated,
    });

    // Split every free rect that overlaps the placed (padded) area.
    free = splitFree(free, best.x, best.y, best.w, best.h);
    pruneContained(free);
  }

  // Convert padded placements to real footprints (strip the gap) + add edge.
  const allItems = placed.map((p) => ({
    id: p.id,
    design_id: p.design_id,
    name: p.name,
    color: p.color,
    needs_enhance: p.needs_enhance,
    src_dpi: p.src_dpi,
    x_cm: +(p.x + edge).toFixed(3),
    y_cm: +p.y.toFixed(3),
    w_cm: +(p.w - gap).toFixed(3),
    h_cm: +(p.h - gap).toFixed(3),
    rotated: p.rotated,
  }));

  // Split into print files at the max-length boundary. Items are grouped by the
  // band [k*max_len, (k+1)*max_len); each band becomes a bin starting at y=0.
  const binMap = new Map();
  for (const p of allItems) {
    const bandTop = p.y_cm;
    const k = Math.floor((bandTop + 1e-6) / max_len_cm);
    if (!binMap.has(k)) binMap.set(k, []);
    binMap.get(k).push({ ...p, y_cm: +(p.y_cm - k * max_len_cm).toFixed(3) });
  }

  const bins = [...binMap.keys()].sort((a, b) => a - b).map((k, idx) => {
    const its = binMap.get(k);
    const used = its.reduce((m, p) => Math.max(m, p.y_cm + p.h_cm), 0);
    return { index: idx, items: its, used_len_cm: +used.toFixed(2) };
  });
  if (bins.length === 0) bins.push({ index: 0, items: [], used_len_cm: 0 });

  // Waste %: placed area vs roll area actually consumed.
  let area = 0;
  let rollArea = 0;
  for (const b of bins) {
    for (const p of b.items) area += p.w_cm * p.h_cm;
    rollArea += roll_w_cm * b.used_len_cm;
  }
  const waste_pct = rollArea > 0 ? +(100 * (1 - area / rollArea)).toFixed(1) : 0;

  return {
    bins,
    roll_w_cm,
    max_len_cm,
    gap_cm: gap,
    edge_cm: edge,
    usable_w_cm: usable_w,
    waste_pct,
    total_used_len_cm: +bins.reduce((m, b) => m + b.used_len_cm, 0).toFixed(2),
  };
}

// Remove the placed rectangle from the free list, splitting each overlapping
// free rect into up to 4 smaller free rects (left/right/top/bottom remainder).
function splitFree(free, px, py, pw, ph) {
  const out = [];
  const px2 = px + pw;
  const py2 = py + ph;
  for (const fr of free) {
    const fx2 = fr.x + fr.w;
    const fy2 = fr.y + fr.h;
    // No overlap → keep as-is.
    if (px >= fx2 || px2 <= fr.x || py >= fy2 || py2 <= fr.y) {
      out.push(fr);
      continue;
    }
    // Left slice
    if (px > fr.x) out.push({ x: fr.x, y: fr.y, w: px - fr.x, h: fr.h });
    // Right slice
    if (px2 < fx2) out.push({ x: px2, y: fr.y, w: fx2 - px2, h: fr.h });
    // Top slice
    if (py > fr.y) out.push({ x: fr.x, y: fr.y, w: fr.w, h: py - fr.y });
    // Bottom slice
    if (py2 < fy2) out.push({ x: fr.x, y: py2, w: fr.w, h: fy2 - py2 });
  }
  return out;
}

// Drop free rects fully contained inside another (keeps the list small/clean).
function pruneContained(free) {
  for (let i = free.length - 1; i >= 0; i--) {
    const a = free[i];
    for (let j = 0; j < free.length; j++) {
      if (i === j) continue;
      const b = free[j];
      if (a.x >= b.x - 1e-6 && a.y >= b.y - 1e-6 &&
          a.x + a.w <= b.x + b.w + 1e-6 && a.y + a.h <= b.y + b.h + 1e-6) {
        free.splice(i, 1);
        break;
      }
    }
  }
}

// Expand job items (with qty / fill_rest) into individual copies for packing.
export function expandItems(jobItems, settings) {
  const copies = [];
  // MyTurtle-harmonized block colors: emerald/gold brand + supporting tones.
  const palette = ['#1A4231', '#C9A227', '#C8643C', '#6FA287', '#2E8C8C', '#8C5A86', '#D9C27E'];
  let colorIdx = 0;

  const fillItems = [];
  for (const ji of jobItems) {
    const color = palette[colorIdx++ % palette.length];
    const base = {
      design_id: ji.design_id,
      name: ji.name,
      w_cm: ji.phys_w_cm,
      h_cm: ji.phys_h_cm,
      allow_rotate: ji.allow_rotate !== 0,
      color,
      needs_enhance: ji.needs_enhance ? 1 : 0,
      src_dpi: ji.src_dpi ?? 0,
    };
    const qty = Math.max(1, ji.qty || 1);
    for (let k = 0; k < qty; k++) copies.push({ ...base, id: `${ji.design_id}-${k}` });
    if (ji.fill_rest) fillItems.push(base);
  }

  // "Fill rest of roll": add many extra copies; the packer places as many as fit
  // and the rest simply spill into later print files.
  if (fillItems.length) {
    const rollLenCm = settings.max_len_cm ?? 3000;
    const usableW = (settings.roll_w_cm ?? 57) - 2 * ((settings.edge_mm ?? 5) / 10);
    for (const base of fillItems) {
      const perRow = Math.max(1, Math.floor(usableW / base.w_cm));
      const rows = Math.ceil(rollLenCm / base.h_cm);
      const maxFit = Math.min(perRow * rows, 2000);
      for (let k = 0; k < maxFit; k++) {
        copies.push({ ...base, id: `fill-${base.design_id}-${k}`, _fill: true });
      }
    }
  }

  return copies;
}
