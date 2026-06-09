import { NextRequest, NextResponse } from 'next/server';
import { getCrew, getLeaderboard } from '@/lib/redis';

/**
 * Crew standings (pure win count, highest first) plus the crew's display name.
 * Read by the room lobby and the end-of-game results screen.
 *
 * GET /api/crew/leaderboard?slug=XXXXXX
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const slug = req.nextUrl.searchParams.get('slug');
  if (!slug) {
    return NextResponse.json({ error: 'Missing slug' }, { status: 400 });
  }

  const crew = await getCrew(slug);
  if (!crew) {
    return NextResponse.json({ error: 'Crew not found' }, { status: 404 });
  }

  const entries = await getLeaderboard(slug);
  return NextResponse.json({ slug, name: crew.name, entries });
}
