'use client';

import dynamic from 'next/dynamic';

const RollCanvas = dynamic(() => import('@/components/RollCanvas'), {
  ssr: false,
  loading: () => (
    <div className="flex flex-1 items-center justify-center text-xs text-muted">
      Loading canvas…
    </div>
  ),
});

export default function CanvasStage({ settings, job }) {
  const result = job?.result;
  const usedM = result ? (result.total_used_len_cm / 100).toFixed(2) : '0.00';
  const bins = result?.bins?.length || 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-edge bg-panel px-3 text-xs">
        <span className="text-muted">
          Layout {bins > 1 ? `· ${bins} print files` : ''}
        </span>
        <span className="text-muted">
          Used {usedM} m / {settings.maxLenM} m
          {result ? ` · Waste ${result.waste_pct}%` : ' · Waste —'}
        </span>
      </div>
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <RollCanvas settings={settings} job={job} />
      </div>
    </div>
  );
}
