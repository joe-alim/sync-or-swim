// Crew — a persistent group of friends that keeps a historical win count across
// games in the Foxflame suite. Identity within a crew is `(crew, name)`,
// re-claimable from any device via a casual 4-digit PIN. No accounts, no OAuth.
//
// This module is pure domain logic (types, validation, PIN hashing, factories).
// It deliberately imports NO Redis so it stays free of a circular dependency
// with lib/redis.ts, which owns persistence and imports the types from here.

import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

export interface CrewMember {
  name: string;
  pinHash: string; // salt:hash hex, never plaintext, never sent to the client
  joinedAt: number;
}

export interface Crew {
  slug: string;
  name: string; // display name, e.g. "Compt"
  createdAt: number;
  hostMemberId: string; // may reset members' PINs (admin)
  members: Record<string, CrewMember>;
}

/** A single leaderboard row, ready for display. */
export interface LeaderboardEntry {
  memberId: string;
  name: string;
  wins: number;
}

/** Names are matched case-insensitively and trimmed; this is the canonical form. */
export function normalizeName(name: string): string {
  return name.trim();
}

export function nameKey(name: string): string {
  return normalizeName(name).toLowerCase();
}

/** A valid name is non-empty after trimming and not absurdly long. */
export function isValidName(name: string): boolean {
  const n = normalizeName(name);
  return n.length >= 1 && n.length <= 24;
}

/** A valid PIN is exactly four digits. */
export function isValidPin(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}

// --- PIN hashing -----------------------------------------------------------
// scrypt with a per-PIN random salt. Stored as `salt:hash` (both hex). Low
// stakes (bragging rights), but no reason to store anything reversible.

const SCRYPT_KEYLEN = 32;

export function hashPin(pin: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(pin, salt, SCRYPT_KEYLEN);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

export function verifyPin(pin: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(':');
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = scryptSync(pin, Buffer.from(saltHex, 'hex'), SCRYPT_KEYLEN);
  // Constant-time compare; timingSafeEqual throws on length mismatch.
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

// --- Factories -------------------------------------------------------------

/**
 * Build a fresh crew with its founding member (the host). `now` is passed in so
 * callers control the clock (and so this stays free of ambient Date usage).
 */
export function createCrew(args: {
  slug: string;
  crewName: string;
  hostMemberId: string;
  hostName: string;
  hostPin: string;
  now: number;
}): Crew {
  return {
    slug: args.slug,
    name: normalizeName(args.crewName),
    createdAt: args.now,
    hostMemberId: args.hostMemberId,
    members: {
      [args.hostMemberId]: {
        name: normalizeName(args.hostName),
        pinHash: hashPin(args.hostPin),
        joinedAt: args.now,
      },
    },
  };
}

/** Find a member id by (case-insensitive) name, or null if the name is free. */
export function findMemberIdByName(crew: Crew, name: string): string | null {
  const key = nameKey(name);
  for (const [id, member] of Object.entries(crew.members)) {
    if (nameKey(member.name) === key) return id;
  }
  return null;
}
