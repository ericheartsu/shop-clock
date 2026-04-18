'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BrandHeader } from '@/components/BrandHeader';
import { PRESSES, type Press } from '@/lib/config';

interface Decoration {
  id: number;
  location: string;
  method: string | null;
  colorCount: number | null;
}
interface Job {
  id: number;
  printavoInvoiceNumber: string;
  jobName: string | null;
  totalQuantity: number | null;
  printavoFetched: boolean;
  decorations: Decoration[];
}

export default function JobPage({
  params,
}: {
  params: Promise<{ invoice: string }>;
}) {
  const { invoice } = use(params);
  const router = useRouter();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [press, setPress] = useState<Press>(PRESSES[0]);
  const [showAdd, setShowAdd] = useState(false);
  const [location, setLocation] = useState('');
  const [method, setMethod] = useState('Screen Print');
  const [colorCount, setColorCount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [repullBusy, setRepullBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/jobs/${encodeURIComponent(invoice)}`);
      const data = await res.json();
      if (res.ok) setJob(data.job);
      else setError(data?.error ?? 'Failed to load job');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoice]);

  async function addDecoration(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(
        `/api/jobs/${encodeURIComponent(invoice)}/decorations`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            location,
            method: method || null,
            colorCount: colorCount || null,
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? 'Failed to add');
        return;
      }
      setLocation('');
      setColorCount('');
      setShowAdd(false);
      await load();
    } finally {
      setBusy(false);
    }
  }

  function pickDecoration(id: number) {
    router.push(
      `/job/${encodeURIComponent(invoice)}/${id}/phase?press=${encodeURIComponent(press)}`,
    );
  }

  async function repullPrintavo() {
    if (repullBusy) return;
    setRepullBusy(true);
    setError(null);
    setToast(null);
    try {
      const res = await fetch(
        `/api/jobs/${encodeURIComponent(invoice)}/repull`,
        { method: 'POST' },
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? 'Re-pull failed');
        return;
      }
      setToast('Pulled from Printavo');
      setJob(data.job);
      setTimeout(() => setToast(null), 3000);
    } catch (err: any) {
      setError(err?.message ?? 'Network error');
    } finally {
      setRepullBusy(false);
    }
  }

  return (
    <main className="min-h-screen flex flex-col">
      <BrandHeader crumbs={[`Invoice ${invoice}`]} />

      <div className="p-4 flex flex-col gap-4">
        {loading && <div className="text-craft-grey">{'Loading\u2026'}</div>}

        {job && (
          <>
            <section className="rounded-2xl bg-white border border-craft-grey/20 p-4 shadow-sm">
              <div className="text-craft-grey text-xs font-semibold uppercase tracking-wide">
                Invoice
              </div>
              <div className="text-2xl font-extrabold">{job.printavoInvoiceNumber}</div>
              {job.jobName && (
                <div className="text-craft-grey text-sm mt-1">{job.jobName}</div>
              )}
              <div className="flex gap-3 mt-2 text-sm items-center">
                {typeof job.totalQuantity === 'number' && (
                  <span className="rounded-full bg-craft-cyan/10 text-craft-cyan px-2 py-0.5 font-semibold">
                    Qty {job.totalQuantity}
                  </span>
                )}
                <span
                  className={
                    'rounded-full px-2 py-0.5 font-semibold ' +
                    (job.printavoFetched
                      ? 'bg-craft-lime/20 text-craft-black'
                      : 'bg-craft-orange/20 text-craft-orange')
                  }
                >
                  {job.printavoFetched ? 'Printavo linked' : 'Manual entry'}
                </span>
                <button
                  onClick={repullPrintavo}
                  disabled={repullBusy}
                  className="ml-auto text-xs font-semibold text-craft-cyan hover:underline disabled:opacity-50"
                  title="Force a fresh pull of invoice + imprint data from Printavo"
                >
                  {repullBusy ? 'Pulling\u2026' : 'Re-pull Printavo'}
                </button>
              </div>
              {toast && (
                <div className="mt-2 rounded-lg bg-craft-lime/20 border border-craft-lime text-craft-black px-3 py-2 text-xs font-semibold">
                  {toast}
                </div>
              )}
            </section>

            <section>
              <div className="text-craft-grey text-xs font-semibold uppercase tracking-wide mb-2">
                Press
              </div>
              <div className="grid grid-cols-2 gap-3">
                {PRESSES.map((p) => (
                  <button
                    key={p}
                    onClick={() => setPress(p)}
                    className={
                      'h-16 rounded-xl font-bold text-lg border-2 transition active:scale-[0.98] ' +
                      (press === p
                        ? 'bg-craft-black text-white border-craft-black'
                        : 'bg-white text-craft-black border-craft-grey/30')
                    }
                  >
                    {p}
                  </button>
                ))}
              </div>
            </section>

            <section>
              <div className="flex items-end justify-between mb-2">
                <div className="text-craft-grey text-xs font-semibold uppercase tracking-wide">
                  Decorations — tap one to clock
                </div>
                <button
                  onClick={() => setShowAdd((v) => !v)}
                  className="text-craft-cyan font-bold text-sm"
                >
                  {showAdd ? 'Cancel' : '+ Add'}
                </button>
              </div>

              {job.decorations.length === 0 && !showAdd && (
                <div className="rounded-xl bg-craft-orange/10 border border-craft-orange/30 text-craft-black p-3 text-sm">
                  No decorations on this job yet. Tap <b>+ Add</b> to create one.
                </div>
              )}

              <div className="flex flex-col gap-3">
                {job.decorations.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => pickDecoration(d.id)}
                    className="text-left rounded-xl bg-white border-2 border-craft-grey/20 p-4 shadow-sm active:scale-[0.99]"
                  >
                    <div className="text-xl font-extrabold">{d.location}</div>
                    <div className="text-sm text-craft-grey mt-1">
                      {d.method ?? 'Method not set'}
                      {typeof d.colorCount === 'number' ? ` \u2022 ${d.colorCount} colors` : ''}
                    </div>
                  </button>
                ))}
              </div>

              {showAdd && (
                <form
                  onSubmit={addDecoration}
                  className="mt-3 rounded-xl bg-white border-2 border-craft-cyan/40 p-4 flex flex-col gap-3"
                >
                  <label className="block">
                    <span className="text-xs font-semibold text-craft-grey">
                      Location
                    </span>
                    <input
                      autoFocus
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="Front, Back, Neck Tag\u2026"
                      className="mt-1 w-full rounded-lg border-2 border-craft-grey/20 px-3 py-3 text-lg"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-semibold text-craft-grey">
                      Method
                    </span>
                    <select
                      value={method}
                      onChange={(e) => setMethod(e.target.value)}
                      className="mt-1 w-full rounded-lg border-2 border-craft-grey/20 px-3 py-3 text-lg bg-white"
                    >
                      <option>Screen Print</option>
                      <option>DTG</option>
                      <option>Transfer</option>
                      <option>Embroidery</option>
                      <option>Other</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-xs font-semibold text-craft-grey">
                      Color count (optional)
                    </span>
                    <input
                      inputMode="numeric"
                      value={colorCount}
                      onChange={(e) => setColorCount(e.target.value.replace(/\D/g, ''))}
                      className="mt-1 w-full rounded-lg border-2 border-craft-grey/20 px-3 py-3 text-lg"
                    />
                  </label>
                  {error && (
                    <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-3 py-2 text-sm">
                      {error}
                    </div>
                  )}
                  <button
                    type="submit"
                    disabled={busy}
                    className="h-14 rounded-xl bg-craft-cyan text-white font-extrabold text-lg active:scale-[0.99] disabled:opacity-60"
                  >
                    {busy ? 'Saving\u2026' : 'Save decoration'}
                  </button>
                </form>
              )}
            </section>
          </>
        )}

        {error && !job && (
          <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-3 py-2 text-sm">
            {error}
          </div>
        )}
      </div>
    </main>
  );
}
