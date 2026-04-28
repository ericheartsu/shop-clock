'use client';

import { useState } from 'react';
import { BrandHeader } from '@/components/BrandHeader';

type Step = 'select' | 'verify' | 'new' | 'confirm' | 'done';

export default function ChangePinPage() {
  const [step, setStep] = useState<Step>('select');
  const [operators, setOperators] = useState<Array<{ id: number; name: string }>>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function loadOperators() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/operators?active=1');
      const data = await res.json();
      setOperators(data.operators ?? []);
      setStep('select');
    } catch {
      setError('Could not load operator list.');
    } finally {
      setLoading(false);
    }
  }

  async function verifyCurrentPin() {
    if (!selectedId || !/^\d{4}$/.test(currentPin)) {
      setError('Enter your 4-digit current PIN.');
      return;
    }
    setLoading(true);
    setError(null);
    // We verify by attempting to change to a temporary sentinel — but a cleaner
    // approach is to just proceed and let the server reject a wrong current PIN
    // at the final step. Move straight to new-PIN entry.
    setLoading(false);
    setStep('new');
  }

  async function submitChange() {
    if (!/^\d{4}$/.test(newPin)) { setError('New PIN must be 4 digits.'); return; }
    if (newPin !== confirmPin) { setError('PINs do not match.'); return; }
    if (newPin === currentPin) { setError('New PIN must differ from current PIN.'); return; }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_HQ_API_URL}/api/scan/change-pin`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: selectedId, currentPin, newPin }),
        },
      );
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'PIN change failed.'); return; }
      setStep('done');
    } catch {
      setError('Network error — try again.');
    } finally {
      setLoading(false);
    }
  }

  function PinInput({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
    return (
      <div className="flex flex-col items-center gap-3">
        <p className="text-sm text-zinc-400">{label}</p>
        <div className="flex gap-3">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="w-10 h-12 border border-zinc-600 rounded flex items-center justify-center text-xl font-mono bg-zinc-800">
              {value[i] ? '●' : ''}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2 mt-2">
          {['1','2','3','4','5','6','7','8','9','C','0','⌫'].map(k => (
            <button
              key={k}
              onClick={() => {
                if (k === 'C') { onChange(''); return; }
                if (k === '⌫') { onChange(value.slice(0, -1)); return; }
                if (value.length < 4) onChange(value + k);
              }}
              className="w-14 h-14 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-white text-lg font-mono"
            >
              {k}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-900 text-white flex flex-col">
      <BrandHeader />
      <div className="flex-1 flex flex-col items-center justify-center gap-6 p-6">
        <h1 className="text-xl font-semibold">Change PIN</h1>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        {step === 'select' && operators.length === 0 && (
          <button
            onClick={loadOperators}
            disabled={loading}
            className="px-6 py-3 bg-cyan-600 hover:bg-cyan-500 rounded-lg text-white font-medium"
          >
            {loading ? 'Loading…' : 'Load Operator List'}
          </button>
        )}

        {step === 'select' && operators.length > 0 && (
          <div className="flex flex-col gap-2 w-full max-w-xs">
            <p className="text-sm text-zinc-400 text-center">Select your name</p>
            {operators.map(op => (
              <button
                key={op.id}
                onClick={() => { setSelectedId(op.id); setStep('verify'); setError(null); }}
                className="py-3 px-4 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-left"
              >
                {op.name}
              </button>
            ))}
          </div>
        )}

        {step === 'verify' && (
          <div className="flex flex-col items-center gap-4">
            <PinInput value={currentPin} onChange={setCurrentPin} label="Enter your current PIN" />
            <button
              onClick={verifyCurrentPin}
              disabled={currentPin.length < 4 || loading}
              className="px-6 py-3 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 rounded-lg"
            >
              Continue
            </button>
            <button onClick={() => { setStep('select'); setCurrentPin(''); setError(null); }} className="text-sm text-zinc-400 underline">Back</button>
          </div>
        )}

        {step === 'new' && (
          <div className="flex flex-col items-center gap-4">
            <PinInput value={newPin} onChange={setNewPin} label="Choose a new PIN" />
            <button
              onClick={() => { if (newPin.length === 4) { setStep('confirm'); setError(null); } }}
              disabled={newPin.length < 4}
              className="px-6 py-3 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 rounded-lg"
            >
              Continue
            </button>
          </div>
        )}

        {step === 'confirm' && (
          <div className="flex flex-col items-center gap-4">
            <PinInput value={confirmPin} onChange={setConfirmPin} label="Confirm new PIN" />
            <button
              onClick={submitChange}
              disabled={confirmPin.length < 4 || loading}
              className="px-6 py-3 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 rounded-lg"
            >
              {loading ? 'Saving…' : 'Set New PIN'}
            </button>
            <button onClick={() => { setStep('new'); setConfirmPin(''); setError(null); }} className="text-sm text-zinc-400 underline">Back</button>
          </div>
        )}

        {step === 'done' && (
          <div className="flex flex-col items-center gap-4 text-center">
            <p className="text-green-400 text-lg font-medium">PIN updated successfully.</p>
            <p className="text-zinc-400 text-sm">Your new PIN is active on the next clock-in.</p>
            <a href="/" className="px-6 py-3 bg-zinc-700 hover:bg-zinc-600 rounded-lg">Back to Clock</a>
          </div>
        )}
      </div>
    </div>
  );
}
