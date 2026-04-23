'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BrandHeader } from '@/components/BrandHeader';
import {
  PRESSES,
  METHODS,
  LOCATIONS,
  type Press,
} from '@/lib/config';

interface Decoration {
  id: number;
  location: string;
  locationOther: string | null;
  method: string | null;
  colorCount: number | null;
}
interface Job {
  id: number;
  printavoInvoiceNumber: string;
  jobName: string | null;
  customerName: string | null;
  totalQuantity: number | null;
  printavoFetched: boolean;
  hqOrderHint: string | null;
  decorations: Decoration[];
}

function decorationLabel(d: Decoration): string {
  if (d.location === 'Other') return d.locationOther ?? 'Other';
  return d.location;
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
  const [location, setLocation] = useState<string>(LOCATIONS[0]);
  const [locationOther, setLocationOther] = useState('');
  const [method, setMethod] = useState<string>(METHODS[0]);
  const [colorCount, setColorCount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [repullBusy, setRepullBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editLocation, setEditLocation] = useState<string>(LOCATIONS[0]);
  const [editLocationOther, setEditLocationOther] = useState('');
  const [editMethod, setEditMethod] = useState<string>(METHODS[0]);
  const [editColorCount, setEditColorCount] = useState('');
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Job meta edits (customer name + HQ order hint)
  const [metaEditing, setMetaEditing] = useState(false);
  const [metaCustomer, setMetaCustomer] = useState('');
  const [metaHqHint, setMetaHqHint] = useState('');
  const [metaBusy, setMetaBusy] = useState(false);
  const [metaError, setMetaError] = useState<string | null>(null);

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
            locationOther: location === 'Other' ? locationOther : null,
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
      setLocation(LOCATIONS[0]);
      setLocationOther('');
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

  function openEdit(d: Decoration) {
    setEditingId(d.id);
    setEditLocation(d.location);
    setEditLocationOther(d.locationOther ?? '');
    // If the stored method isn't in the picklist (legacy Printavo value like
    // "Screen Printing" or "Finishing"), blank the dropdown so the operator
    // must actively pick a valid one — otherwise the <select> silently shows
    // the first option while state holds the legacy string, and Save fails
    // with "not in the picklist".
    const storedMethod = d.method ?? '';
    const methodIsValid = (METHODS as readonly string[]).includes(storedMethod);
    setEditMethod(methodIsValid ? storedMethod : '');
    setEditColorCount(d.colorCount != null ? String(d.colorCount) : '');
    setEditError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditError(null);
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (editingId == null) return;
    setEditBusy(true);
    setEditError(null);
    try {
      const res = await fetch(
        `/api/jobs/${encodeURIComponent(invoice)}/decorations/${editingId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            location: editLocation,
            locationOther: editLocation === 'Other' ? editLocationOther : null,
            method: editMethod || null,
            colorCount: editColorCount === '' ? null : editColorCount,
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        setEditError(data?.error ?? 'Save failed');
        return;
      }
      setEditingId(null);
      await load();
    } finally {
      setEditBusy(false);
    }
  }

  function openMetaEdit() {
    if (!job) return;
    setMetaCustomer(job.customerName ?? '');
    setMetaHqHint(job.hqOrderHint ?? '');
    setMetaError(null);
    setMetaEditing(true);
  }

  async function saveMeta(e: React.FormEvent) {
    e.preventDefault();
    setMetaBusy(true);
    setMetaError(null);
    try {
      const res = await fetch(`/api/jobs/${encodeURIComponent(invoice)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: metaCustomer.trim() || null,
          hqOrderHint: metaHqHint.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMetaError(data?.error ?? 'Save failed');
        return;
      }
      setMetaEditing(false);
      await load();
    } finally {
      setMetaBusy(false);
    }
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
              {job.customerName && (
                <div className="text-craft-black text-sm mt-1 font-semibold">
                  {job.customerName}
                </div>
              )}
              <div className="flex gap-3 mt-2 text-sm items-center flex-wrap">
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
                {job.hqOrderHint && (
                  <span className="rounded-full bg-craft-grey/10 text-craft-grey px-2 py-0.5 font-semibold">
                    HQ hint: {job.hqOrderHint}
                  </span>
                )}
                <button
                  onClick={repullPrintavo}
                  disabled={repullBusy}
                  className="ml-auto text-xs font-semibold text-craft-cyan hover:underline disabled:opacity-50"
                  title="Force a fresh pull of invoice + imprint data from Printavo"
                >
                  {repullBusy ? 'Pulling\u2026' : 'Re-pull Printavo'}
                </button>
              </div>

              {!metaEditing ? (
                <button
                  onClick={openMetaEdit}
                  className="mt-3 text-xs font-bold text-craft-cyan hover:underline"
                >
                  Edit customer + HQ hint
                </button>
              ) : (
                <form onSubmit={saveMeta} className="mt-3 flex flex-col gap-2">
                  <label className="block">
                    <span className="text-xs font-semibold text-craft-grey">
                      Customer / company name
                    </span>
                    <input
                      value={metaCustomer}
                      onChange={(e) => setMetaCustomer(e.target.value)}
                      placeholder="Auto-filled from Printavo — override here"
                      className="mt-1 w-full rounded-lg border-2 border-craft-grey/20 px-3 py-2"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-semibold text-craft-grey">
                      HQ order# (optional — helps reconcile, not required)
                    </span>
                    <input
                      value={metaHqHint}
                      onChange={(e) => setMetaHqHint(e.target.value)}
                      placeholder="e.g. ORD-12345"
                      className="mt-1 w-full rounded-lg border-2 border-craft-grey/20 px-3 py-2"
                    />
                  </label>
                  {metaError && (
                    <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-3 py-2 text-sm">
                      {metaError}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setMetaEditing(false)}
                      className="flex-1 h-10 rounded-lg border-2 border-craft-grey/30 font-bold text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={metaBusy}
                      className="flex-[2] h-10 rounded-lg bg-craft-cyan text-white font-extrabold text-sm active:scale-[0.99] disabled:opacity-60"
                    >
                      {metaBusy ? 'Saving\u2026' : 'Save'}
                    </button>
                  </div>
                </form>
              )}

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
                  Decorations {'\u2014'} tap one to clock
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
                  <div
                    key={d.id}
                    className="rounded-xl bg-white border-2 border-craft-grey/20 shadow-sm overflow-hidden"
                  >
                    {editingId === d.id ? (
                      <form onSubmit={saveEdit} className="p-4 flex flex-col gap-3">
                        <label className="block">
                          <span className="text-xs font-semibold text-craft-grey">
                            Location
                          </span>
                          <select
                            autoFocus
                            value={editLocation}
                            onChange={(e) => setEditLocation(e.target.value)}
                            className="mt-1 w-full rounded-lg border-2 border-craft-grey/20 px-3 py-3 text-lg bg-white"
                          >
                            {LOCATIONS.map((l) => (
                              <option key={l} value={l}>{l}</option>
                            ))}
                          </select>
                        </label>
                        {editLocation === 'Other' && (
                          <label className="block">
                            <span className="text-xs font-semibold text-craft-grey">
                              Custom location label
                            </span>
                            <input
                              value={editLocationOther}
                              onChange={(e) => setEditLocationOther(e.target.value)}
                              placeholder="e.g. Collar, Back Yoke"
                              className="mt-1 w-full rounded-lg border-2 border-craft-grey/20 px-3 py-3 text-lg"
                            />
                          </label>
                        )}
                        <label className="block">
                          <span className="text-xs font-semibold text-craft-grey">
                            Method
                          </span>
                          <select
                            value={editMethod}
                            onChange={(e) => setEditMethod(e.target.value)}
                            className="mt-1 w-full rounded-lg border-2 border-craft-grey/20 px-3 py-3 text-lg bg-white"
                          >
                            <option value="">{'\u2014 Pick one \u2014'}</option>
                            {METHODS.map((m) => (
                              <option key={m} value={m}>{m}</option>
                            ))}
                          </select>
                          {d.method && !(METHODS as readonly string[]).includes(d.method) && (
                            <div className="mt-1 text-xs text-craft-orange">
                              Imported as {'"'}{d.method}{'"'} {'\u2014'} not a shop method. Pick one above.
                            </div>
                          )}
                        </label>
                        <label className="block">
                          <span className="text-xs font-semibold text-craft-grey">
                            Color count (optional)
                          </span>
                          <input
                            inputMode="numeric"
                            value={editColorCount}
                            onChange={(e) =>
                              setEditColorCount(e.target.value.replace(/\D/g, ''))
                            }
                            className="mt-1 w-full rounded-lg border-2 border-craft-grey/20 px-3 py-3 text-lg"
                          />
                        </label>
                        {editError && (
                          <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-3 py-2 text-sm">
                            {editError}
                          </div>
                        )}
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={cancelEdit}
                            className="flex-1 h-12 rounded-xl border-2 border-craft-grey/30 text-craft-black font-bold"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={editBusy}
                            className="flex-[2] h-12 rounded-xl bg-craft-cyan text-white font-extrabold active:scale-[0.99] disabled:opacity-60"
                          >
                            {editBusy ? 'Saving\u2026' : 'Save'}
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="flex items-stretch">
                        <button
                          onClick={() => pickDecoration(d.id)}
                          className="flex-1 text-left p-4 active:scale-[0.99]"
                        >
                          <div className="text-xl font-extrabold">{decorationLabel(d)}</div>
                          <div className="text-sm text-craft-grey mt-1">
                            {d.method ?? 'Method not set'}
                            {typeof d.colorCount === 'number'
                              ? ` \u2022 ${d.colorCount} colors`
                              : ''}
                          </div>
                        </button>
                        <button
                          onClick={() => openEdit(d)}
                          aria-label="Edit decoration"
                          title="Edit decoration"
                          className="w-14 flex items-center justify-center text-craft-grey hover:text-craft-cyan border-l border-craft-grey/20 active:scale-[0.95]"
                        >
                          <svg
                            width="22"
                            height="22"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M12 20h9" />
                            <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
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
                    <select
                      autoFocus
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      className="mt-1 w-full rounded-lg border-2 border-craft-grey/20 px-3 py-3 text-lg bg-white"
                    >
                      {LOCATIONS.map((l) => (
                        <option key={l} value={l}>{l}</option>
                      ))}
                    </select>
                  </label>
                  {location === 'Other' && (
                    <label className="block">
                      <span className="text-xs font-semibold text-craft-grey">
                        Custom location label
                      </span>
                      <input
                        value={locationOther}
                        onChange={(e) => setLocationOther(e.target.value)}
                        placeholder="e.g. Collar, Back Yoke"
                        className="mt-1 w-full rounded-lg border-2 border-craft-grey/20 px-3 py-3 text-lg"
                      />
                    </label>
                  )}
                  <label className="block">
                    <span className="text-xs font-semibold text-craft-grey">
                      Method
                    </span>
                    <select
                      value={method}
                      onChange={(e) => setMethod(e.target.value)}
                      className="mt-1 w-full rounded-lg border-2 border-craft-grey/20 px-3 py-3 text-lg bg-white"
                    >
                      {METHODS.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
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
