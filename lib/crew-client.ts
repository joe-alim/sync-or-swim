// Client-side crew identity cache. A device remembers its `(memberId, name)`
// per crew slug so the common case (same device) rejoins silently — no PIN
// prompt — and a single device can hold a distinct identity in each crew it
// belongs to. Safe to import only in client components (touches localStorage).

export interface CrewIdentity {
  memberId: string;
  name: string;
}

const memberKey = (slug: string) => `crew:${slug}:memberId`;
const nameKey = (slug: string) => `crew:${slug}:name`;

/** The cached identity for a crew, or null if this device hasn't joined it. */
export function getCrewIdentity(slug: string): CrewIdentity | null {
  if (typeof window === 'undefined') return null;
  const memberId = localStorage.getItem(memberKey(slug));
  const name = localStorage.getItem(nameKey(slug));
  if (!memberId || !name) return null;
  return { memberId, name };
}

/** Cache this device's identity for a crew after a successful join/claim. */
export function setCrewIdentity(slug: string, identity: CrewIdentity): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(memberKey(slug), identity.memberId);
  localStorage.setItem(nameKey(slug), identity.name);
}
