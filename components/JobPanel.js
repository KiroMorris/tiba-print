'use client';

export default function JobPanel({ job, settings }) {
  const { items, pack, updateItem, removeItem, clearJob, packing } = job;

  const runPack = () => pack({ allow_rotate: settings.allowRotate });

  const onClear = () => {
    if (items.length === 0) return;
    if (confirm('Clear this print job? This removes all designs from the layout (your library is untouched).')) {
      clearJob();
    }
  };

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between border-b border-edge px-3 py-2">
        <h2 className="font-heading text-base text-accent">Print Job</h2>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted">{items.length} designs</span>
          {items.length > 0 && (
            <button
              onClick={onClear}
              className="rounded border border-red-500/40 px-2 py-0.5 text-[11px] text-red-400 hover:bg-red-500/10"
              title="Remove all designs from this job"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {items.length === 0 ? (
        <p className="p-3 text-[11px] text-muted">
          Add designs from the library with “+ Job”.
        </p>
      ) : (
        <div className="divide-y divide-edge/60">
          {items.map((it) => (
            <div key={it.id} className="flex items-center gap-2 px-3 py-2">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs text-gray-100">{it.name}</span>
                <span className="block text-[10px] text-muted">
                  {it.phys_w_cm} × {it.phys_h_cm} cm
                </span>
                <label className="mt-0.5 flex items-center gap-1 text-[10px] text-muted">
                  <input
                    type="checkbox"
                    checked={!!it.fill_rest}
                    onChange={(e) => updateItem(it.id, { fill_rest: e.target.checked ? 1 : 0 })}
                    className="h-3 w-3 accent-accent"
                  />
                  fill rest of roll
                </label>
              </span>

              {/* Quantity stepper */}
              <span className="flex items-center gap-1">
                <button
                  onClick={() => updateItem(it.id, { qty: Math.max(1, it.qty - 1) })}
                  className="h-5 w-5 rounded bg-panel2 text-xs text-muted hover:text-gray-100"
                >
                  −
                </button>
                <input
                  type="number"
                  min="1"
                  value={it.qty}
                  onChange={(e) =>
                    updateItem(it.id, { qty: Math.max(1, parseInt(e.target.value) || 1) })
                  }
                  className="w-10 rounded border border-edge bg-panel2 px-1 py-0.5 text-center text-xs text-gray-100 outline-none focus:border-accent"
                />
                <button
                  onClick={() => updateItem(it.id, { qty: it.qty + 1 })}
                  className="h-5 w-5 rounded bg-panel2 text-xs text-muted hover:text-gray-100"
                >
                  +
                </button>
              </span>

              <button
                onClick={() => removeItem(it.id)}
                className="text-[11px] text-red-400 hover:text-red-300"
                title="Remove from job"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="border-t border-edge p-3">
        <button
          onClick={runPack}
          disabled={packing || items.length === 0}
          className="w-full rounded bg-accent py-2 text-sm font-semibold text-white hover:bg-accent/90 disabled:opacity-50"
        >
          {packing ? 'Packing…' : 'Auto-pack ⚡'}
        </button>
      </div>
    </div>
  );
}
