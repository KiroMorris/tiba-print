'use client';

import { useState } from 'react';

export default function DesignRow({ design, onChanged, onAddToJob }) {
  const [open, setOpen] = useState(false);
  const [w, setW] = useState(design.phys_w_cm);
  const [h, setH] = useState(design.phys_h_cm);
  const [rotate, setRotate] = useState(!!design.allow_rotate);
  const [saving, setSaving] = useState(false);

  const patch = async (body) => {
    setSaving(true);
    try {
      await fetch(`/api/designs/${design.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      onChanged?.();
    } finally {
      setSaving(false);
    }
  };

  // Keep aspect ratio when editing one dimension (content trim w/h).
  const aspect = design.trim_w / design.trim_h || 1;

  const onWidth = (val) => {
    const nw = parseFloat(val) || 0;
    setW(nw);
    const nh = +(nw / aspect).toFixed(2);
    setH(nh);
  };
  const onHeight = (val) => {
    const nh = parseFloat(val) || 0;
    setH(nh);
    const nw = +(nh * aspect).toFixed(2);
    setW(nw);
  };

  const del = async () => {
    if (!confirm(`Delete "${design.name}"?`)) return;
    await fetch(`/api/designs/${design.id}`, { method: 'DELETE' });
    onChanged?.();
  };

  return (
    <div className="border-b border-edge/60">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-panel2"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/designs/${design.id}/thumb`}
          alt=""
          className="h-9 w-9 shrink-0 rounded bg-panel2 object-contain"
          style={{ imageRendering: 'auto' }}
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs text-gray-100">
            {design.needs_enhance ? (
              <span title="Low resolution — needs enhancing for a sharp print">⚠ </span>
            ) : null}
            {design.name}
          </span>
          <span className="block text-[10px] text-muted">
            {design.phys_w_cm} × {design.phys_h_cm} cm · {design.file_type.toUpperCase()}
            {design.src_dpi ? ` · ${design.src_dpi}dpi` : ''}
          </span>
          {design.needs_enhance ? (
            <span className="block text-[10px] font-semibold text-amber-400">
              ⚠ Low res — enhance before printing
            </span>
          ) : null}
        </span>
        {onAddToJob && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onAddToJob(design.id);
            }}
            className="shrink-0 rounded bg-accent/80 px-2 py-1 text-[11px] font-semibold text-white hover:bg-accent"
            title="Add to print job"
          >
            + Job
          </span>
        )}
      </button>

      {open && (
        <div className="flex flex-col gap-2 bg-panel2/50 px-3 pb-3 pt-1">
          <div className="flex items-center gap-2 text-[11px]">
            <label className="flex items-center gap-1">
              <span className="text-muted">W</span>
              <input
                type="number"
                step="0.1"
                value={w}
                onChange={(e) => onWidth(e.target.value)}
                className="w-16 rounded border border-edge bg-panel px-1 py-0.5 text-right text-gray-100 outline-none focus:border-accent"
              />
            </label>
            <label className="flex items-center gap-1">
              <span className="text-muted">H</span>
              <input
                type="number"
                step="0.1"
                value={h}
                onChange={(e) => onHeight(e.target.value)}
                className="w-16 rounded border border-edge bg-panel px-1 py-0.5 text-right text-gray-100 outline-none focus:border-accent"
              />
            </label>
            <span className="text-muted">cm</span>
          </div>

          <label className="flex items-center gap-2 text-[11px] text-muted">
            <input
              type="checkbox"
              checked={rotate}
              onChange={(e) => {
                setRotate(e.target.checked);
                patch({ allow_rotate: e.target.checked ? 1 : 0 });
              }}
              className="h-3.5 w-3.5 accent-accent"
            />
            Allow 90° rotation
          </label>

          <div className="flex gap-2">
            <button
              onClick={() => patch({ phys_w_cm: w, phys_h_cm: h })}
              disabled={saving}
              className="flex-1 rounded bg-accent/80 py-1 text-[11px] font-semibold text-white hover:bg-accent disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save size'}
            </button>
            <button
              onClick={del}
              className="rounded border border-red-500/40 px-2 py-1 text-[11px] text-red-400 hover:bg-red-500/10"
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
