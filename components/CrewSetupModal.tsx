'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { setCrewIdentity } from '@/lib/crew-client';

type Mode = 'new' | 'existing';

/**
 * Modal that resolves a crew identity, then drops the user into the persistent
 * crew lobby (`/crew/{slug}`) where games are launched. The host either spins up
 * a new crew or continues an existing one (by code). Game creation is no longer
 * part of this step — it now happens from the lobby — so a crew can exist (and
 * be shared) with no game in flight.
 */
export function CrewSetupModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('new');
  const [crewName, setCrewName] = useState('');
  const [crewCode, setCrewCode] = useState('');
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError('');
    if (!name.trim()) return setError('Enter your name.');
    if (!/^\d{4}$/.test(pin)) return setError('PIN must be exactly 4 digits.');
    if (mode === 'new' && !crewName.trim()) return setError('Name your crew.');
    if (mode === 'existing' && crewCode.trim().length !== 6) {
      return setError('Crew code must be 6 characters.');
    }

    setBusy(true);
    try {
      // Resolve the crew membership (create a crew, or claim/verify in one),
      // cache it on this device, then head to the lobby to launch games.
      let slug: string;
      let memberId: string;
      let confirmedName: string;

      if (mode === 'new') {
        const res = await fetch('/api/crew/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ crewName: crewName.trim(), hostName: name.trim(), pin }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Could not create crew');
        ({ slug, memberId, name: confirmedName } = data);
      } else {
        slug = crewCode.trim().toUpperCase();
        const res = await fetch('/api/crew/join', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug, name: name.trim(), pin }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Could not join crew');
        ({ memberId, name: confirmedName } = data);
      }

      setCrewIdentity(slug, { memberId, name: confirmedName });
      router.push(`/crew/${slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setBusy(false);
    }
  }

  const tab = (m: Mode, label: string) => (
    <button
      onClick={() => {
        setMode(m);
        setError('');
      }}
      className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
        mode === m ? 'bg-amber-400 text-stone-900' : 'bg-stone-700 text-stone-300 hover:bg-stone-600'
      }`}
    >
      {label}
    </button>
  );

  const inputClass =
    'w-full bg-stone-700 text-white placeholder-stone-500 text-lg px-4 py-3 rounded-xl border border-stone-600 focus:outline-none focus:border-amber-400';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-stone-800 rounded-2xl p-7"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-2xl font-bold text-white text-center mb-1">Play with a crew</h2>
        <p className="text-stone-400 text-sm text-center mb-5">
          Keep a running record of wins. No account — just a name and a 4-digit PIN.
        </p>

        <div className="flex gap-2 mb-5">
          {tab('new', 'New crew')}
          {tab('existing', 'Existing crew')}
        </div>

        <div className="space-y-3">
          {mode === 'new' ? (
            <input
              value={crewName}
              onChange={(e) => setCrewName(e.target.value.slice(0, 24))}
              placeholder="Crew name (e.g. Compt)"
              className={inputClass}
              autoFocus
            />
          ) : (
            <input
              value={crewCode}
              onChange={(e) => setCrewCode(e.target.value.toUpperCase().slice(0, 6))}
              placeholder="CREW CODE"
              maxLength={6}
              className={`${inputClass} font-mono text-center tracking-widest uppercase`}
              autoFocus
            />
          )}

          <input
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 24))}
            placeholder="Your name"
            className={inputClass}
          />

          <input
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            onKeyDown={(e) => e.key === 'Enter' && !busy && submit()}
            placeholder="4-digit PIN"
            inputMode="numeric"
            maxLength={4}
            className={`${inputClass} font-mono tracking-[0.5em] text-center`}
          />
        </div>

        {error && <p className="text-red-400 text-sm mt-3">{error}</p>}

        <button
          onClick={submit}
          disabled={busy}
          className="w-full bg-amber-400 hover:bg-amber-300 text-stone-900 font-bold text-lg py-3 rounded-xl transition-colors mt-5 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {busy ? 'Setting up…' : mode === 'new' ? 'Create crew' : 'Continue to lobby'}
        </button>
        <button
          onClick={onClose}
          disabled={busy}
          className="w-full text-stone-400 hover:text-stone-200 text-sm py-2 mt-1 transition-colors disabled:opacity-60"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
