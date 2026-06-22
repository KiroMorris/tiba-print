'use client';

import { useCallback, useEffect, useState } from 'react';

// Central client-side job state: items, settings (job), pack result.
export function useJob() {
  const [job, setJob] = useState(null);
  const [items, setItems] = useState([]);
  const [result, setResult] = useState(null);
  const [packing, setPacking] = useState(false);

  const loadJob = useCallback(async () => {
    const res = await fetch('/api/job');
    const data = await res.json();
    setJob(data.job);
    setItems(data.items);
    return data;
  }, []);

  const pack = useCallback(async (overrides = {}) => {
    setPacking(true);
    try {
      const res = await fetch('/api/job/pack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(overrides),
      });
      const data = await res.json();
      setResult(data.result);
      setItems(data.items);
      return data.result;
    } finally {
      setPacking(false);
    }
  }, []);

  // On first load, fetch the job and auto-pack if it already has items so the
  // canvas shows the last layout immediately instead of an empty roll.
  useEffect(() => {
    (async () => {
      const data = await loadJob();
      if (data?.items?.length) await pack({ allow_rotate: true });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addItem = useCallback(async (design_id, qty = 1) => {
    const res = await fetch('/api/job/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ design_id, qty }),
    });
    const data = await res.json();
    setItems(data.items);
  }, []);

  const updateItem = useCallback(async (id, patch) => {
    const res = await fetch(`/api/job/items/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    setItems(data.items);
  }, []);

  const removeItem = useCallback(async (id) => {
    const res = await fetch(`/api/job/items/${id}`, { method: 'DELETE' });
    const data = await res.json();
    setItems(data.items);
  }, []);

  const saveJob = useCallback(async (patch) => {
    const res = await fetch('/api/job', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    setJob(data.job);
    return data.job;
  }, []);

  return {
    job, items, result, packing,
    loadJob, pack, addItem, updateItem, removeItem, saveJob, setResult,
  };
}
