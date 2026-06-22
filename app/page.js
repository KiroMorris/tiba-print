'use client';

import { useMemo } from 'react';
import LibraryPanel from '@/components/LibraryPanel';
import SettingsPanel from '@/components/SettingsPanel';
import CanvasStage from '@/components/CanvasStage';
import JobPanel from '@/components/JobPanel';
import { useJob } from '@/lib/useJob';

export default function Home() {
  const j = useJob();

  // Settings come from the active job (DB-backed). Defaults until loaded.
  const settings = useMemo(
    () => ({
      rollWcm: j.job?.roll_w_cm ?? 57,
      maxLenM: j.job?.max_len_m ?? 30,
      gapMm: j.job?.gap_mm ?? 3,
      edgeMm: j.job?.edge_mm ?? 5,
      dpi: j.job?.dpi ?? 300,
      outFormat: j.job?.out_format ?? 'png',
      units: j.job?.units ?? 'metric',
      allowRotate: true,
    }),
    [j.job]
  );

  // Persist a settings change to the job, then re-pack.
  const onSettings = async (next) => {
    await j.saveJob({
      roll_w_cm: next.rollWcm,
      max_len_m: next.maxLenM,
      gap_mm: next.gapMm,
      edge_mm: next.edgeMm,
      dpi: next.dpi,
      out_format: next.outFormat,
      units: next.units,
    });
    j.pack({ allow_rotate: next.allowRotate });
  };

  return (
    <div className="flex h-screen w-screen flex-col">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-edge bg-panel px-4">
        <div className="flex items-center gap-2">
          <span className="font-heading text-xl text-accent">Tiba Print</span>
          <span className="text-xs text-muted">DTF Layout &amp; Nesting</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted">
          <span>Roll {settings.rollWcm} cm</span>
          <span>•</span>
          <span>Max {settings.maxLenM} m</span>
          <span>•</span>
          <span>{settings.dpi} DPI</span>
          {j.result && (
            <>
              <span>•</span>
              <span className="text-accent">
                {j.result.bins?.length || 0} file(s) · {j.result.waste_pct}% waste
              </span>
            </>
          )}
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-72 shrink-0 flex-col overflow-hidden border-r border-edge bg-panel">
          <div className="min-h-0 flex-1 overflow-y-auto">
            <LibraryPanel onAddToJob={(id) => j.addItem(id)} />
          </div>
          <div className="max-h-[45%] shrink-0 overflow-y-auto border-t border-edge">
            <JobPanel job={j} settings={settings} />
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col bg-ink">
          <CanvasStage settings={settings} job={j} />
        </main>

        <aside className="w-72 shrink-0 overflow-y-auto border-l border-edge bg-panel">
          <SettingsPanel settings={settings} onChange={onSettings} job={j} />
        </aside>
      </div>
    </div>
  );
}
