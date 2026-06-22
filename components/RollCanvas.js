'use client';

import { useEffect, useRef, useState } from 'react';
import { Stage, Layer, Rect, Line, Text, Group } from 'react-konva';

// Renders the packed result: one roll column per bin (print file), each block a
// colored placeholder (name + size). Blocks are draggable for manual tweaks.
// Everything is centimeters internally; `scale` converts cm → screen px.
export default function RollCanvas({ settings, job }) {
  const outerRef = useRef(null); // non-scrolling positioning context (overlays)
  const wrapRef = useRef(null); // inner scroller holding the Stage
  const [size, setSize] = useState({ w: 0, h: 0 });
  const result = job?.result;

  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Attach wheel zoom as a NON-passive native listener so preventDefault works
  // (React's synthetic onWheel is passive and can't stop the page from scrolling).
  // Depend on `size.w` so it (re)attaches once the scroller div is mounted.
  const onWheelRef = useRef(null);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const handler = (e) => onWheelRef.current?.(e);
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [size.w]);

  const rollWcm = settings.rollWcm;
  const PAD = 40;
  const GUTTER = 40; // gap between roll columns

  // User zoom multiplier (1 = fit-to-width). Wheel / trackpad pinch adjusts it.
  const [zoom, setZoom] = useState(1);

  // Base scale fits one roll column; final scale = base × user zoom.
  const colTargetPx = Math.min((size.w - PAD * 2) / Math.max(result?.bins?.length || 1, 1), 360);
  const baseScale = Math.max(colTargetPx / rollWcm, 1.2); // px per cm at zoom 1
  const scale = baseScale * zoom;
  const rollPxW = rollWcm * scale;

  // Zoom toward the cursor on wheel / two-finger scroll. We keep the point under
  // the pointer fixed by adjusting the wrapper's scroll after the scale changes.
  const onWheel = (e) => {
    const el = wrapRef.current;
    if (!el) return;
    // Option(⌥)/Alt OR Command(⌘)/Ctrl + wheel = scroll the roll UP/DOWN (done
    // manually so it's vertical). Plain wheel = ZOOM at cursor.
    if (e.altKey || e.metaKey || e.ctrlKey) {
      e.preventDefault();
      el.scrollTop += e.deltaY; // wheel up → up, wheel down → down
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    const rect = el.getBoundingClientRect();
    const px = e.clientX - rect.left + el.scrollLeft; // pointer in content px
    const py = e.clientY - rect.top + el.scrollTop;
    const factor = Math.exp(-e.deltaY * 0.0015); // smooth, direction-correct
    setZoom((z) => {
      const next = Math.min(Math.max(z * factor, 0.3), 8);
      if (next === z) return z;
      const ratio = next / z;
      // Keep the point under the cursor fixed after the scale change.
      requestAnimationFrame(() => {
        el.scrollLeft = px * ratio - (e.clientX - rect.left);
        el.scrollTop = py * ratio - (e.clientY - rect.top);
      });
      return next;
    });
  };
  // Keep the native wheel listener pointed at the latest handler.
  onWheelRef.current = onWheel;

  const bins = result?.bins || [];
  // Empty state: draw a single empty roll preview.
  const showEmpty = bins.length === 0;

  const onDragEnd = (binIndex, itemIdx, e) => {
    // The block lives inside RollColumn's inner <Group x y>, so node.x()/y() are
    // already roll-LOCAL pixels (origin = roll top-left). Just divide by scale.
    const node = e.target;
    const it = bins[binIndex].items[itemIdx];
    let x_cm = node.x() / scale;
    let y_cm = node.y() / scale;
    x_cm = Math.max(0, Math.min(x_cm, rollWcm - it.w_cm));
    y_cm = Math.max(0, y_cm);

    // Lego rule: no overlaps AND no floating gaps. Snap the dropped design tight:
    // first clear any overlap, then pull it UP until it rests on something (or the
    // top), then pull it LEFT until it butts against a neighbor (or the edge).
    const others = bins[binIndex].items.filter((_, i) => i !== itemIdx);
    const gap = result.gap_cm ?? 0.3;
    const placed = settleTight(
      { x: x_cm, y: y_cm, w: it.w_cm, h: it.h_cm },
      others,
      rollWcm,
      gap
    );
    x_cm = placed.x;
    y_cm = placed.y;

    // Snap the Konva node to the resolved spot so the visual matches the data
    // (otherwise the block stays where the mouse dropped it).
    node.x(x_cm * scale);
    node.y(y_cm * scale);

    // Mutate the result locally and push back so stats update.
    const next = structuredClone(result);
    next.bins[binIndex].items[itemIdx].x_cm = +x_cm.toFixed(2);
    next.bins[binIndex].items[itemIdx].y_cm = +y_cm.toFixed(2);
    // Recompute used length for this bin.
    next.bins[binIndex].used_len_cm = +next.bins[binIndex].items
      .reduce((m, p) => Math.max(m, p.y_cm + p.h_cm), 0)
      .toFixed(2);
    next.total_used_len_cm = +next.bins
      .reduce((m, b) => m + b.used_len_cm, 0)
      .toFixed(2);
    job.setResult(next);
  };

  // Double-click → rotate the design 90°. Swap w/h, then re-resolve collisions
  // using the new (rotated) bounding box so it never overlaps a neighbor.
  const onRotate = (binIndex, itemIdx) => {
    const next = structuredClone(result);
    const it = next.bins[binIndex].items[itemIdx];
    const newW = it.h_cm;
    const newH = it.w_cm;
    it.w_cm = newW;
    it.h_cm = newH;
    it.rotated = !it.rotated;
    // Keep it inside the roll width, then push clear of any overlaps.
    const others = next.bins[binIndex].items.filter((_, i) => i !== itemIdx);
    const gap = result.gap_cm ?? 0.3;
    const placed = resolveCollision(
      { x: Math.min(it.x_cm, rollWcm - newW), y: it.y_cm, w: newW, h: newH },
      others,
      rollWcm,
      gap
    );
    it.x_cm = placed.x;
    it.y_cm = placed.y;
    next.bins[binIndex].used_len_cm = +next.bins[binIndex].items
      .reduce((m, p) => Math.max(m, p.y_cm + p.h_cm), 0)
      .toFixed(2);
    next.total_used_len_cm = +next.bins
      .reduce((m, b) => m + b.used_len_cm, 0)
      .toFixed(2);
    job.setResult(next);
  };

  // Hover tooltip state (HTML overlay positioned over the canvas).
  const [hover, setHover] = useState(null); // { it, left, top }

  // Longest column drives canvas height.
  const maxLenCm = showEmpty
    ? 300
    : Math.max(...bins.map((b) => b.used_len_cm), 50) + 20;
  const stageH = Math.max(maxLenCm * scale + PAD * 2, size.h);
  const stageW = Math.max(
    PAD * 2 + Math.max(bins.length, 1) * (rollPxW + GUTTER),
    size.w
  );

  return (
    <div ref={outerRef} className="relative h-full w-full overflow-hidden">
      <div ref={wrapRef} className="h-full w-full overflow-auto">
      {size.w > 0 && (
        <Stage width={stageW} height={stageH}>
          <Layer>
            {showEmpty && (
              <RollColumn
                x={PAD}
                y={PAD}
                wPx={rollPxW}
                hPx={300 * scale}
                scale={scale}
                rollWcm={rollWcm}
                label="File 1"
              >
                <Text
                  x={rollPxW / 2 - 90}
                  y={140 * scale}
                  width={180}
                  align="center"
                  text="Add designs and Auto-pack"
                  fontSize={12}
                  fill="#5a6273"
                />
              </RollColumn>
            )}

            {bins.map((bin) => {
              const colX = PAD + bin.index * (rollPxW + GUTTER);
              const colH = bin.used_len_cm * scale;
              return (
                <RollColumn
                  key={bin.index}
                  x={colX}
                  y={PAD}
                  wPx={rollPxW}
                  hPx={Math.max(colH, 40)}
                  scale={scale}
                  rollWcm={rollWcm}
                  label={`File ${bin.index + 1} · ${bin.used_len_cm.toFixed(0)}cm`}
                >
                  {bin.items.map((it, i) => (
                    <DesignBlock
                      key={it.id + '-' + i}
                      it={it}
                      scale={scale}
                      onDragEnd={(e) => onDragEnd(bin.index, i, e)}
                      onDblClick={() => onRotate(bin.index, i)}
                      onHover={(on) =>
                        setHover(
                          on
                            ? {
                                it,
                                left: colX + it.x_cm * scale + (it.w_cm * scale) / 2,
                                top: PAD + it.y_cm * scale,
                              }
                            : null
                        )
                      }
                    />
                  ))}
                </RollColumn>
              );
            })}
          </Layer>
        </Stage>
      )}
      </div>

      {/* Hover info tooltip — name, real size, rotation. The overlay sits on the
          non-scrolling outer container, so subtract the inner scroll offset. */}
      {hover && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded border border-edge bg-panel2/95 px-2 py-1 text-[11px] text-gray-100 shadow-lg"
          style={{
            left: hover.left - (wrapRef.current?.scrollLeft || 0),
            top: hover.top - (wrapRef.current?.scrollTop || 0) - 6,
          }}
        >
          <div className="font-semibold">{hover.it.name}</div>
          <div className="text-muted">
            {hover.it.w_cm} × {hover.it.h_cm} cm
          </div>
          <div className="text-muted">
            {hover.it.rotated ? '⟳ rotated 90°' : 'upright'}
            {hover.it.src_dpi ? ` · ${hover.it.src_dpi} DPI` : ''}
          </div>
          {hover.it.needs_enhance === 1 && (
            <div className="mt-0.5 font-semibold text-amber-400">
              ⚠ Low resolution — needs enhancing for sharp print
            </div>
          )}
          <div className="mt-0.5 text-[10px] text-muted/80">double-click to rotate</div>
        </div>
      )}

      {/* Zoom control — scroll/two-finger to zoom toward the cursor; click % to reset. */}
      <div className="absolute bottom-3 right-3 z-10 flex items-center gap-1 rounded border border-edge bg-panel2/90 px-1 py-1 text-[11px] text-gray-200 shadow-lg">
        <button onClick={() => setZoom((z) => Math.max(z / 1.25, 0.3))}
          className="h-6 w-6 rounded hover:bg-edge">−</button>
        <button onClick={() => setZoom(1)}
          className="w-12 rounded px-1 hover:bg-edge" title="Reset zoom">
          {Math.round(zoom * 100)}%
        </button>
        <button onClick={() => setZoom((z) => Math.min(z * 1.25, 8))}
          className="h-6 w-6 rounded hover:bg-edge">+</button>
      </div>
    </div>
  );
}

// Two rects overlap if their gap-expanded areas intersect on BOTH axes.
// The gap is the required clear space between designs.
function overlaps(a, b, gap) {
  return (
    a.x < b.x_cm + b.w_cm + gap &&
    a.x + a.w > b.x_cm - gap &&
    a.y < b.y_cm + b.h_cm + gap &&
    a.y + a.h > b.y_cm - gap
  );
}

// "Lego" snapping: from the drop point, push the box straight down past EVERY
// design it overlaps until it rests in clear space — never overlapping. Each
// pass jumps below the lowest obstacle currently hit, then re-scans (a new
// obstacle may appear lower down). Stays within the roll width.
function resolveCollision(box, others, rollWcm, gap) {
  const x = Math.max(0, Math.min(box.x, rollWcm - box.w));
  let y = Math.max(0, box.y);
  for (let guard = 0; guard < 500; guard++) {
    const hits = others.filter((o) => overlaps({ x, y, w: box.w, h: box.h }, o, gap));
    if (hits.length === 0) break;
    // Drop below the lowest bottom edge among everything we currently overlap.
    const lowestBottom = Math.max(...hits.map((o) => o.y_cm + o.h_cm));
    y = +(lowestBottom + gap).toFixed(3);
  }
  return { x: +x.toFixed(3), y: +y.toFixed(3) };
}

// Does {x,y,w,h} clash with any other design (gap-aware)?
function clashes(box, others, gap) {
  return others.some((o) => overlaps(box, o, gap));
}

// Settle a dropped design near WHERE YOU DROPPED IT — respecting your intent,
// not yanking it up/left across the canvas.
//   • If the drop spot is already clear, keep it (optionally snap-align to a
//     nearby neighbor edge so it sits flush instead of with a tiny gap).
//   • If it overlaps, find the CLOSEST non-overlapping spot by sliding it the
//     minimal distance in whichever direction (up/down/left/right) is nearest.
// This lets you place the star right next to the circles instead of it dropping.
function settleTight(box, others, rollWcm, gap) {
  let x = Math.max(0, Math.min(box.x, rollWcm - box.w));
  let y = Math.max(0, box.y);

  if (!clashes({ x, y, w: box.w, h: box.h }, others, gap)) {
    // Already clear — snap-align to the nearest neighbor edge within a small
    // threshold so it sits flush (no hairline gaps), then done.
    return snapAlign({ x, y, w: box.w, h: box.h }, others, rollWcm, gap);
  }

  // Overlapping: find the closest spot to the drop point that fully clears.
  // We test a rich set of candidate (x, y) pairs built from neighbor edges, so a
  // block can slot into an interior GAP between blocks (flush-x of a left/right
  // neighbor AND aligned to a row's y), not just fall straight down.
  const candidates = [];
  const tryPos = (nx, ny) => {
    nx = Math.max(0, Math.min(nx, rollWcm - box.w));
    ny = Math.max(0, ny);
    if (!clashes({ x: nx, y: ny, w: box.w, h: box.h }, others, gap)) {
      candidates.push({ x: nx, y: ny, dist: Math.hypot(nx - x, ny - y) });
    }
  };

  // Build candidate X edges (just left/right of every block, plus the drop x and
  // roll edges) and Y edges (top/bottom of every block, row tops, drop y, top).
  const xEdges = new Set([x, 0, rollWcm - box.w]);
  const yEdges = new Set([y, 0]);
  for (const o of others) {
    xEdges.add(o.x_cm + o.w_cm + gap); // flush to its right (= a gap slot)
    xEdges.add(o.x_cm - box.w - gap);  // flush to its left
    yEdges.add(o.y_cm);                 // align with its top (sit in the row)
    yEdges.add(o.y_cm + o.h_cm + gap);  // below it
    yEdges.add(o.y_cm - box.h - gap);   // above it
  }
  // Cross every x edge with every y edge — this surfaces true gap-fits.
  for (const ex of xEdges) for (const ey of yEdges) tryPos(ex, ey);

  // Pure gravity-down fallback so there's always at least one valid spot.
  const gd = resolveCollision({ x, y, w: box.w, h: box.h }, others, rollWcm, gap);
  candidates.push({ x: gd.x, y: gd.y, dist: Math.hypot(gd.x - x, gd.y - y) });

  candidates.sort((a, b) => a.dist - b.dist);
  const best = candidates[0];
  return { x: +best.x.toFixed(3), y: +best.y.toFixed(3) };
}

// Gently snap a clear box to nearby neighbor/roll edges so it sits flush —
// but ONLY when the edge is close (within SNAP cm). This kills hairline gaps
// without yanking the box out of an interior pocket you intentionally dropped
// it into. Each axis snaps to the nearest candidate edge within range.
function snapAlign(box, others, rollWcm, gap) {
  const SNAP = 2.5; // cm: only magnetize if a target edge is this close
  let { x, y } = box;

  // Candidate X positions: flush-left against a neighbor's right edge, flush-
  // right against a neighbor's left edge (for blocks that share the row), and 0.
  const xTargets = [0];
  const yTargets = [0];
  for (const o of others) {
    const vOverlap = y < o.y_cm + o.h_cm + gap && y + box.h > o.y_cm - gap;
    if (vOverlap) {
      xTargets.push(o.x_cm + o.w_cm + gap);          // sit to its right
      xTargets.push(o.x_cm - box.w - gap);            // sit to its left
    }
    const hOverlap = x < o.x_cm + o.w_cm + gap && x + box.w > o.x_cm - gap;
    if (hOverlap) {
      yTargets.push(o.y_cm + o.h_cm + gap);          // sit below it
      yTargets.push(o.y_cm - box.h - gap);            // sit above it
      yTargets.push(o.y_cm);                          // align tops
    }
  }

  // Snap to the closest in-range X target that doesn't cause an overlap.
  const nearestValid = (cur, targets, axis) => {
    let bestVal = cur, bestD = SNAP + 1e-6;
    for (const t of targets) {
      if (t < -1e-6 || (axis === 'x' && t + box.w > rollWcm + 1e-6)) continue;
      const d = Math.abs(cur - t);
      if (d > SNAP || d >= bestD) continue;
      const probe = axis === 'x'
        ? { x: t, y, w: box.w, h: box.h }
        : { x, y: t, w: box.w, h: box.h };
      if (!clashes(probe, others, gap)) { bestVal = t; bestD = d; }
    }
    return bestVal;
  };

  x = +Math.max(0, nearestValid(x, xTargets, 'x')).toFixed(3);
  y = +Math.max(0, nearestValid(y, yTargets, 'y')).toFixed(3);

  if (clashes({ x, y, w: box.w, h: box.h }, others, gap)) {
    return { x: +box.x.toFixed(3), y: +box.y.toFixed(3) };
  }
  return { x, y };
}

function RollColumn({ x, y, wPx, hPx, scale, rollWcm, label, children }) {
  // Ruler ticks every 10cm.
  const ticks = [];
  for (let cm = 0; cm * scale <= hPx; cm += 10) ticks.push(cm);
  return (
    <Group>
      <Text x={x} y={y - 16} text={label} fontSize={11} fill="#C9A227" />
      <Text x={x} y={y - 30} text={`${rollWcm} cm`} fontSize={10} fill="#8FA89A" />
      <Rect
        x={x}
        y={y}
        width={wPx}
        height={hPx}
        fill="#0c1712"
        stroke="#2C5443"
        strokeWidth={1.5}
        cornerRadius={2}
      />
      {ticks.map((cm) => (
        <Line
          key={cm}
          points={[x - 6, y + cm * scale, x, y + cm * scale]}
          stroke="#3a5a4a"
          strokeWidth={1}
        />
      ))}
      {/* The column's children are positioned relative to the stage, not the
          group, so we render them after the frame. */}
      <Group x={x} y={y}>{children}</Group>
    </Group>
  );
}

// Pick black or white text for legibility on a given block color.
function textOn(hex) {
  const c = hex.replace('#', '');
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? '#16241c' : '#ffffff'; // dark text on light/gold blocks
}

function DesignBlock({ it, scale, onDragEnd, onDblClick, onHover }) {
  const wPx = it.w_cm * scale;
  const hPx = it.h_cm * scale;
  const fontSize = Math.max(Math.min(wPx / 8, 12), 7);
  const ink = textOn(it.color || '#1A4231');
  return (
    <Group
      x={it.x_cm * scale}
      y={it.y_cm * scale}
      draggable
      onDragEnd={onDragEnd}
      onDblClick={onDblClick}
      onDblTap={onDblClick}
      onMouseEnter={(e) => {
        onHover?.(true);
        const stage = e.target.getStage();
        if (stage) stage.container().style.cursor = 'pointer';
      }}
      onMouseLeave={(e) => {
        onHover?.(false);
        const stage = e.target.getStage();
        if (stage) stage.container().style.cursor = 'default';
      }}
    >
      <Rect
        width={wPx}
        height={hPx}
        fill={it.color}
        opacity={0.92}
        cornerRadius={2}
        // Low-DPI designs get a dashed amber outline so they stand out at a glance.
        stroke={it.needs_enhance ? '#E0BE4A' : '#0006'}
        strokeWidth={it.needs_enhance ? 2 : 0.5}
        dash={it.needs_enhance ? [6, 4] : undefined}
      />
      {it.rotated && (
        <Text x={3} y={3} text="⟳" fontSize={fontSize + 2} fill={ink} opacity={0.95} />
      )}
      {it.needs_enhance === 1 && (
        <Text
          x={wPx - fontSize - 4}
          y={3}
          text="⚠"
          fontSize={fontSize + 3}
          fill="#E0BE4A"
          opacity={0.95}
        />
      )}
      {wPx > 30 && hPx > 14 && (
        <Text
          x={2}
          y={hPx / 2 - fontSize / 2}
          width={wPx - 4}
          align="center"
          text={`${it.name}\n${it.w_cm}×${it.h_cm}`}
          fontSize={fontSize}
          fill={ink}
          opacity={0.95}
          ellipsis
          wrap="none"
        />
      )}
    </Group>
  );
}
