import { NextRequest, NextResponse } from 'next/server';
import { generateId } from '@/lib/ids';
import { createCrew, isValidName, isValidPin } from '@/lib/crew';
import { getCrew, saveCrew } from '@/lib/redis';

/**
 * Spin up a new crew. The creator becomes the founding member (host) and is
 * returned a `memberId` to carry into the room they're about to create.
 *
 * Body: { crewName, hostName, pin }
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const { crewName, hostName, pin } = await req.json();

  if (!isValidName(crewName)) {
    return NextResponse.json({ error: 'Invalid crew name' }, { status: 400 });
  }
  if (!isValidName(hostName)) {
    return NextResponse.json({ error: 'Invalid name' }, { status: 400 });
  }
  if (!isValidPin(pin)) {
    return NextResponse.json({ error: 'PIN must be exactly 4 digits' }, { status: 400 });
  }

  // Find a free slug. Collisions are vanishingly rare at 6 chars; retry a few.
  let slug = generateId(6);
  for (let i = 0; i < 5 && (await getCrew(slug)); i++) {
    slug = generateId(6);
  }
  if (await getCrew(slug)) {
    return NextResponse.json({ error: 'Could not allocate a crew code' }, { status: 503 });
  }

  const hostMemberId = generateId(6);
  const crew = createCrew({
    slug,
    crewName,
    hostMemberId,
    hostName,
    hostPin: pin,
    now: Date.now(),
  });

  await saveCrew(crew);

  return NextResponse.json({ slug, memberId: hostMemberId, name: crew.members[hostMemberId].name });
}
