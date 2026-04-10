import { NextRequest, NextResponse } from 'next/server';
import { getGame } from '@/lib/redis';
import { sanitizeState } from '@/lib/game';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;

  const state = await getGame(id);
  if (!state) {
    return NextResponse.json({ error: 'Game not found' }, { status: 404 });
  }

  return NextResponse.json(sanitizeState(state));
}
