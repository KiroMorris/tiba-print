'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import DesignRow from '@/components/DesignRow';

export default function LibraryPanel({ onDesignsChange, onAddToJob }) {
  const [designs, setDesigns] = useState([]);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [brand, setBrand] = useState('');
  const inputRef = useRef(null);

  const refresh = useCallback(async () => {
    const res = await fetch('/api/designs');
    const data = await res.json();
    setDesigns(data.designs || []);
    onDesignsChange?.(data.designs || []);
  }, [onDesignsChange]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const upload = useCallback(
    async (fileList) => {
      const files = Array.from(fileList).filter((f) => f.size > 0);
      if (!files.length) return;
      setBusy(true);
      const fd = new FormData();
      for (const f of files) fd.append('files', f);
      if (brand.trim()) fd.append('brand', brand.trim());
      try {
        const res = await fetch('/api/designs', { method: 'POST', body: fd });
        const data = await res.json();
        if (data.errors?.length) {
          alert(
            'Some files failed:\n' +
              data.errors.map((e) => `• ${e.file}: ${e.error}`).join('\n')
          );
        }
        await refresh();
      } finally {
        setBusy(false);
      }
    },
    [brand, refresh]
  );

  const onDrop = useCallback(
    (e) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer?.files?.length) upload(e.dataTransfer.files);
    },
    [upload]
  );

  // Group designs by brand for display.
  const groups = {};
  for (const d of designs) {
    const key = d.brand_name || 'Unsorted';
    (groups[key] ||= []).push(d);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-edge px-3 py-2">
        <h2 className="font-heading text-base text-accent">Library</h2>
        <span className="text-[11px] text-muted">{designs.length} designs</span>
      </div>

      {/* Brand + import controls */}
      <div className="flex flex-col gap-2 border-b border-edge p-3">
        <input
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          placeholder="Brand (optional)"
          className="rounded border border-edge bg-panel2 px-2 py-1 text-xs text-gray-100 outline-none focus:border-accent"
        />
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={`cursor-pointer rounded-lg border border-dashed px-3 py-6 text-center text-xs transition ${
            dragOver ? 'border-accent bg-accent/10 text-gray-100' : 'border-edge text-muted'
          }`}
        >
          {busy ? (
            <span>Importing…</span>
          ) : (
            <>
              <div>Drop designs or click</div>
              <div className="mt-1 opacity-70">PNG · JPG · PDF · SVG</div>
            </>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".png,.jpg,.jpeg,.webp,.svg,.pdf"
          className="hidden"
          onChange={(e) => upload(e.target.files)}
        />
      </div>

      {/* Design list grouped by brand */}
      <div className="flex-1 overflow-y-auto">
        {Object.keys(groups).length === 0 && (
          <p className="p-4 text-center text-[11px] text-muted">
            No designs yet. Import some above.
          </p>
        )}
        {Object.entries(groups).map(([brandName, items]) => (
          <div key={brandName}>
            <div className="sticky top-0 bg-panel px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
              {brandName}
            </div>
            {items.map((d) => (
              <DesignRow key={d.id} design={d} onChanged={refresh} onAddToJob={onAddToJob} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
