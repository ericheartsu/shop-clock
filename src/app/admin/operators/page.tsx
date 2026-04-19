'use client';

import { useEffect, useState } from 'react';
import { BrandHeader } from '@/components/BrandHeader';

interface Operator {
  id: number;
  name: string;
  pin: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function OperatorsAdminPage() {
  const [operators, setOperators] = useState<Operator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newPin, setNewPin] = useState('');
  const [busy, setBusy] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editPin, setEditPin] = useState('');
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/operators');
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? 'Failed to load');
        return;
      }
      setOperators(data.operators ?? []);
    } catch (err: any) {
      setError(err?.message ?? 'Network error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function addOperator(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const name = newName.trim();
    const pin = newPin.trim();
    if (!name) {
      setError('Name is required');
      return;
    }
    if (!/^\d{4}$/.test(pin)) {
      setError('PIN must be exactly 4 digits');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/operators', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, pin }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? 'Save failed');
        return;
      }
      setNewName('');
      setNewPin('');
      await load();
    } finally {
      setBusy(false);
    }
  }

  function openEdit(op: Operator) {
    setEditingId(op.id);
    setEditName(op.name);
    setEditPin(op.pin);
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
      const res = await fetch(`/api/operators/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim(), pin: editPin.trim() }),
      });
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

  async function toggleActive(op: Operator) {
    setError(null);
    try {
      const res = await fetch(`/api/operators/${op.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !op.active }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? 'Toggle failed');
        return;
      }
      await load();
    } catch (err: any) {
      setError(err?.message ?? 'Network error');
    }
  }

  return (
    <main className="min-h-screen flex flex-col">
      <BrandHeader crumbs={['Admin', 'Operators']} />

      <div className="p-4 flex flex-col gap-4">
        <section className="rounded-2xl bg-white border border-craft-grey/20 p-4 shadow-sm">
          <h1 className="text-xl font-extrabold">Operators</h1>
          <p className="text-craft-grey text-sm mt-1">
            Operators type their 4-digit PIN at clock-in. History is snapshotted
            on each time entry, so editing or rotating a PIN here does NOT
            rewrite past rows.
          </p>
        </section>

        <section className="rounded-2xl bg-white border-2 border-craft-cyan/40 p-4">
          <div className="text-craft-grey text-xs font-semibold uppercase tracking-wide mb-2">
            Add Operator
          </div>
          <form onSubmit={addOperator} className="flex flex-col gap-3">
            <label className="block">
              <span className="text-xs font-semibold text-craft-grey">Name</span>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="First name or role"
                className="mt-1 w-full rounded-lg border-2 border-craft-grey/20 px-3 py-3 text-lg"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-craft-grey">PIN (4 digits)</span>
              <input
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="1234"
                className="mt-1 w-full rounded-lg border-2 border-craft-grey/20 px-3 py-3 text-lg tracking-widest font-mono"
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
              className="h-12 rounded-xl bg-craft-cyan text-white font-extrabold active:scale-[0.99] disabled:opacity-60"
            >
              {busy ? 'Saving\u2026' : 'Add operator'}
            </button>
          </form>
        </section>

        <section>
          <div className="text-craft-grey text-xs font-semibold uppercase tracking-wide mb-2">
            All operators
          </div>
          {loading && <div className="text-craft-grey">Loading\u2026</div>}
          {!loading && operators.length === 0 && (
            <div className="rounded-xl bg-craft-orange/10 border border-craft-orange/30 p-3 text-sm">
              No operators yet. Add one above or run the seed script (see README).
            </div>
          )}
          <div className="flex flex-col gap-3">
            {operators.map((op) => (
              <div
                key={op.id}
                className={
                  'rounded-xl bg-white border-2 shadow-sm overflow-hidden ' +
                  (op.active ? 'border-craft-grey/20' : 'border-craft-grey/10 opacity-60')
                }
              >
                {editingId === op.id ? (
                  <form onSubmit={saveEdit} className="p-4 flex flex-col gap-3">
                    <label className="block">
                      <span className="text-xs font-semibold text-craft-grey">Name</span>
                      <input
                        autoFocus
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="mt-1 w-full rounded-lg border-2 border-craft-grey/20 px-3 py-3 text-lg"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-semibold text-craft-grey">PIN</span>
                      <input
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={4}
                        value={editPin}
                        onChange={(e) => setEditPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        className="mt-1 w-full rounded-lg border-2 border-craft-grey/20 px-3 py-3 text-lg tracking-widest font-mono"
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
                        className="flex-1 h-12 rounded-xl border-2 border-craft-grey/30 font-bold"
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
                    <div className="flex-1 p-4">
                      <div className="text-xl font-extrabold">{op.name}</div>
                      <div className="text-sm text-craft-grey mt-1 flex items-center gap-2">
                        <span className="font-mono tracking-widest">PIN {op.pin}</span>
                        <span
                          className={
                            'rounded-full px-2 py-0.5 text-xs font-bold ' +
                            (op.active
                              ? 'bg-craft-lime/20 text-craft-black'
                              : 'bg-craft-grey/20 text-craft-grey')
                          }
                        >
                          {op.active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => toggleActive(op)}
                      className="px-4 border-l border-craft-grey/20 text-sm font-bold text-craft-cyan active:scale-95"
                      aria-label={op.active ? 'Deactivate operator' : 'Reactivate operator'}
                    >
                      {op.active ? 'Deactivate' : 'Reactivate'}
                    </button>
                    <button
                      onClick={() => openEdit(op)}
                      className="px-4 border-l border-craft-grey/20 text-sm font-bold active:scale-95"
                    >
                      Edit
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
