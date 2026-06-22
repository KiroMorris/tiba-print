'use client';

import { useEffect, useState } from 'react';

function NumField({ label, unit, value, step = 1, min = 0, onCommit }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <label className="flex items-center justify-between gap-2 text-xs">
      <span className="text-muted">{label}</span>
      <span className="flex items-center gap-1">
        <input
          type="number"
          value={v}
          step={step}
          min={min}
          onChange={(e) => setV(e.target.value)}
          onBlur={() => onCommit(parseFloat(v))}
          onKeyDown={(e) => e.key === 'Enter' && onCommit(parseFloat(v))}
          className="w-20 rounded border border-edge bg-panel2 px-2 py-1 text-right text-gray-100 outline-none focus:border-accent"
        />
        {unit && <span className="w-6 text-muted">{unit}</span>}
      </span>
    </label>
  );
}

export default function SettingsPanel({ settings, onChange, job }) {
  // Commit a single setting → persists to DB job + re-packs.
  const set = (key, value) => onChange({ ...settings, [key]: value });

  const canExport = (job?.result?.bins?.length || 0) > 0;

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-edge px-3 py-2">
        <h2 className="font-heading text-base text-accent">Print File Settings</h2>
      </div>

      <div className="flex flex-col gap-4 p-3">
        <section className="flex flex-col gap-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted">Roll</h3>
          <NumField label="Width" unit="cm" value={settings.rollWcm} step={0.5} onCommit={(v) => set('rollWcm', v)} />
          <NumField label="Max length" unit="m" value={settings.maxLenM} step={0.5} onCommit={(v) => set('maxLenM', v)} />
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted">Spacing</h3>
          <NumField label="Gap between" unit="mm" value={settings.gapMm} step={0.5} onCommit={(v) => set('gapMm', v)} />
          <NumField label="Edge margin" unit="mm" value={settings.edgeMm} step={0.5} onCommit={(v) => set('edgeMm', v)} />
          <div className="flex gap-1">
            {[2, 3, 6].map((g) => (
              <button key={g} onClick={() => set('gapMm', g)}
                className="flex-1 rounded border border-edge bg-panel2 py-1 text-[11px] text-muted hover:border-accent hover:text-gray-100">
                {g} mm
              </button>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted">Output</h3>
          <NumField label="DPI" value={settings.dpi} step={50} onCommit={(v) => set('dpi', v)} />
          <label className="flex items-center justify-between gap-2 text-xs">
            <span className="text-muted">Format</span>
            <select
              value={settings.outFormat}
              onChange={(e) => set('outFormat', e.target.value)}
              className="w-28 rounded border border-edge bg-panel2 px-2 py-1 text-gray-100 outline-none focus:border-accent"
            >
              <option value="png">PNG</option>
              <option value="tiff">TIFF (tiled)</option>
              <option value="pdf">PDF</option>
            </select>
          </label>
          <label className="flex items-center justify-between gap-2 text-xs">
            <span className="text-muted">Allow 90° rotation</span>
            <input
              type="checkbox"
              checked={settings.allowRotate}
              onChange={(e) => set('allowRotate', e.target.checked)}
              className="h-4 w-4 accent-accent"
            />
          </label>
        </section>
      </div>

      <div className="mt-auto border-t border-edge p-3">
        <ExportButton job={job} settings={settings} disabled={!canExport} />
      </div>
    </div>
  );
}

function ExportButton({ job, settings, disabled }) {
  const [state, setState] = useState({ busy: false, files: null, error: null });

  const run = async () => {
    setState({ busy: true, files: null, error: null });
    try {
      const res = await fetch('/api/job/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          result: job.result,
          dpi: settings.dpi,
          format: settings.outFormat,
        }),
      });
      const data = await res.json();
      if (data.error) setState({ busy: false, files: null, error: data.error });
      else setState({ busy: false, files: data.files, error: null });
    } catch (e) {
      setState({ busy: false, files: null, error: String(e.message || e) });
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={run}
        disabled={disabled || state.busy}
        className="w-full rounded bg-accent py-2 text-sm font-semibold text-white hover:bg-accent/90 disabled:opacity-50"
      >
        {state.busy ? 'Rendering…' : 'Export Print File'}
      </button>
      {state.error && <p className="text-[11px] text-red-400">{state.error}</p>}
      {state.files?.map((f) => (
        <a
          key={f.url}
          href={f.url}
          download
          className="block truncate rounded bg-panel2 px-2 py-1 text-[11px] text-accent hover:underline"
        >
          ⬇ {f.name} ({f.size})
        </a>
      ))}
      {state.files?.length > 0 && (
        <button
          onClick={() => fetch('/api/exports/open', { method: 'POST' })}
          className="rounded border border-edge bg-panel2 px-2 py-1 text-[11px] text-muted hover:text-gray-100"
        >
          📁 Open exports folder
        </button>
      )}
    </div>
  );
}
