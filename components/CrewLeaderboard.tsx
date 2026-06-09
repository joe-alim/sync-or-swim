'use client';

import { useEffect, useState } from 'react';
import { LeaderboardEntry } from '@/lib/crew';

/** A crew member currently subscribed to the lobby presence channel. */
export interface PresentMember {
  memberId: string;
  name: string;
}

/**
 * Crew standings (pure all-time win count). Fetched from /api/crew/leaderboard.
 * Used in the room lobby and on the end-of-game screen. Pass `refreshKey` and
 * change it to force a refetch (e.g. bump it once a game has ended).
 *
 * In the crew lobby this board does double duty: pass `presentMembers` (the live
 * presence set) to badge who's here right now and to surface a just-joined
 * member even before the standings refetch knows about them.
 */
export function CrewLeaderboard({
  slug,
  highlightMemberId,
  refreshKey = 0,
  presentMembers,
}: {
  slug: string;
  highlightMemberId?: string | null;
  refreshKey?: number;
  /** When provided, the board runs in lobby presence mode. */
  presentMembers?: PresentMember[];
}) {
  const [crewName, setCrewName] = useState<string | null>(null);
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/crew/leaderboard?slug=${encodeURIComponent(slug)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        setCrewName(data.name);
        setEntries(data.entries);
      } catch {
        // leave previous state; this panel is non-critical
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, refreshKey]);

  const presenceMode = presentMembers !== undefined;
  const presentIds = new Set((presentMembers ?? []).map((m) => m.memberId));

  // In lobby mode, fold in anyone present who isn't yet in the fetched standings
  // (e.g. a member who joined the crew moments ago) so they appear right away.
  let rows = entries;
  if (presenceMode && entries) {
    const known = new Set(entries.map((e) => e.memberId));
    const extras: LeaderboardEntry[] = (presentMembers ?? [])
      .filter((m) => !known.has(m.memberId))
      .map((m) => ({ memberId: m.memberId, name: m.name, wins: 0 }));
    rows = [...entries, ...extras].sort(
      (a, b) => b.wins - a.wins || a.name.localeCompare(b.name)
    );
  }

  const medal = (i: number) => (i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`);

  return (
    <div className="bg-stone-800 rounded-2xl p-5">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-stone-400 text-sm uppercase tracking-widest">
          {crewName ? `${crewName} · Crew wins` : 'Crew wins'}
        </h3>
        {presenceMode ? (
          <span className="text-emerald-400/90 text-xs font-semibold">
            {presentIds.size} here now
          </span>
        ) : (
          <span className="text-stone-600 font-mono text-xs tracking-widest">{slug}</span>
        )}
      </div>

      {rows === null ? (
        <p className="text-stone-500 text-sm">Loading standings…</p>
      ) : rows.length === 0 ? (
        <p className="text-stone-500 text-sm">No members yet.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((e, i) => {
            const here = presentIds.has(e.memberId);
            return (
              <li
                key={e.memberId}
                className={`flex items-center gap-3 rounded-lg px-2 py-1 ${
                  e.memberId === highlightMemberId ? 'bg-amber-400/10' : ''
                }`}
              >
                <span className="text-stone-500 text-sm w-7 text-center">{medal(i)}</span>
                {presenceMode && (
                  <span
                    title={here ? 'In the lobby now' : 'Not here'}
                    className={`h-2 w-2 shrink-0 rounded-full ${
                      here ? 'bg-emerald-400 shadow-[0_0_6px] shadow-emerald-400/70' : 'bg-stone-600'
                    }`}
                  />
                )}
                <span className={`flex-1 truncate ${here || !presenceMode ? 'text-white' : 'text-stone-400'}`}>
                  {e.name}
                  {e.memberId === highlightMemberId && (
                    <span className="text-stone-400 text-sm ml-1">(you)</span>
                  )}
                </span>
                <span className="text-white font-bold tabular-nums">
                  {e.wins}
                  <span className="text-stone-500 text-xs font-normal ml-1">
                    {e.wins === 1 ? 'win' : 'wins'}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
