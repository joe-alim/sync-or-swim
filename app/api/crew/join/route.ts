import { NextRequest, NextResponse } from 'next/server';
import { generateId } from '@/lib/ids';
import {
  findMemberIdByName,
  hashPin,
  isValidName,
  isValidPin,
  nameKey,
  normalizeName,
  verifyPin,
} from '@/lib/crew';
import {
  clearPinAttempts,
  getCrew,
  registerPinAttempt,
  saveCrew,
} from '@/lib/redis';

/**
 * Join (or re-claim an identity in) a crew by name + PIN.
 *  - Name is free  → claim it: store the PIN, mint a memberId.
 *  - Name is taken → verify the PIN to re-bind to the existing memberId.
 *
 * Returns { memberId, name } which the client caches in localStorage keyed by
 * crew slug and uses as its room playerId.
 *
 * Body: { slug, name, pin }
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const { slug, name, pin } = await req.json();

  if (!slug || !isValidName(name) || !isValidPin(pin)) {
    return NextResponse.json({ error: 'Missing or invalid fields' }, { status: 400 });
  }

  const crew = await getCrew(slug);
  if (!crew) {
    return NextResponse.json({ error: 'Crew not found' }, { status: 404 });
  }

  const existingId = findMemberIdByName(crew, name);

  // Re-claim an existing name: rate-limit, then verify the PIN.
  if (existingId) {
    const ok = await registerPinAttempt(slug, nameKey(name));
    if (!ok) {
      return NextResponse.json(
        { error: 'Too many attempts. Try again in a few minutes.' },
        { status: 429 }
      );
    }
    if (!verifyPin(pin, crew.members[existingId].pinHash)) {
      return NextResponse.json({ error: 'Incorrect PIN for that name' }, { status: 403 });
    }
    await clearPinAttempts(slug, nameKey(name));
    return NextResponse.json({ memberId: existingId, name: crew.members[existingId].name });
  }

  // Fresh name: claim it.
  const memberId = generateId(6);
  crew.members[memberId] = {
    name: normalizeName(name),
    pinHash: hashPin(pin),
    joinedAt: Date.now(),
  };
  await saveCrew(crew);

  return NextResponse.json({ memberId, name: crew.members[memberId].name });
}
