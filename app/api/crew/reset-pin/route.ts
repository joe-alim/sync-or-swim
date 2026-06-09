import { NextRequest, NextResponse } from 'next/server';
import { hashPin, isValidPin } from '@/lib/crew';
import { getCrew, saveCrew } from '@/lib/redis';

/**
 * Host-only PIN reset for a crew member who's locked out (no email = no
 * automated reset). The requester must be the crew host.
 *
 * Body: { slug, hostMemberId, targetMemberId, newPin }
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const { slug, hostMemberId, targetMemberId, newPin } = await req.json();

  if (!slug || !hostMemberId || !targetMemberId || !isValidPin(newPin)) {
    return NextResponse.json({ error: 'Missing or invalid fields' }, { status: 400 });
  }

  const crew = await getCrew(slug);
  if (!crew) {
    return NextResponse.json({ error: 'Crew not found' }, { status: 404 });
  }

  if (crew.hostMemberId !== hostMemberId) {
    return NextResponse.json({ error: 'Only the crew host can reset PINs' }, { status: 403 });
  }

  const target = crew.members[targetMemberId];
  if (!target) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 });
  }

  target.pinHash = hashPin(newPin);
  await saveCrew(crew);

  return NextResponse.json({ success: true });
}
