'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
import { useState } from 'react';
import { ACTIVE_CLOCK_KEY, type ActiveClockPayload } from '@/lib/time';

interface Props {
  crumbs?: string[];
  /**
   * Hide the "New Project" / home button (used on the home page itself).
   */
  hideHome?: boolean;
}

export function BrandHeader({ crumbs, hideHome }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [busy, setBusy] = useState(false);

  // On the home page, suppress the New Project button regardless of caller.
  const suppressHome = hideHome || pathname === '/';

  async function goHome() {
    if (busy) return;
    let active: ActiveClockPayload | null = null;
    try {
      const raw = localStorage.getItem(ACTIVE_CLOCK_KEY);
      if (raw) active = JSON.parse(raw) as ActiveClockPayload;
    } catch {
      /* ignore */
    }

    if (active) {
      const ok = window.confirm(
        `You have an active clock running for invoice ${active.invoice} (${active.phase}).\n\nStop it first?\n\nOK = stop & start new\nCancel = keep clock running`,
      );
      if (!ok) return;
      setBusy(true);
      try {
        await fetch('/api/clock/stop', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entryId: active.entryId, notes: null }),
        });
      } catch {
        /* ignore — we still navigate home */
      }
      localStorage.removeItem(ACTIVE_CLOCK_KEY);
      setBusy(false);
    }
    router.push('/');
  }

  return (
    <header className="bg-craft-black text-white px-4 py-3 flex items-center gap-3 shadow-md">
      <Link href="/" className="flex items-center gap-2 active:opacity-60">
        <Image
          src="/craft-icon.png"
          alt="Craft MFG"
          width={32}
          height={32}
          priority
          className="w-8 h-8"
        />
        <span className="font-extrabold tracking-wide text-lg">SHOP CLOCK</span>
      </Link>
      {crumbs && crumbs.length > 0 && (
        <div className="flex-1 text-right text-xs text-white/70 truncate">
          {crumbs.join(' / ')}
        </div>
      )}
      {!suppressHome && (
        <button
          onClick={goHome}
          disabled={busy}
          className="ml-auto flex items-center gap-1 rounded-lg bg-craft-cyan/90 hover:bg-craft-cyan px-3 py-2 text-xs font-extrabold uppercase tracking-wide text-white shadow active:scale-95 disabled:opacity-60"
          aria-label="Start a new project (go home)"
        >
          <span aria-hidden>+</span>
          <span>New Project</span>
        </button>
      )}
    </header>
  );
}
