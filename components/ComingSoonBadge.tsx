// Corner ribbon shown on game cards that aren't playable yet. The outer wrapper
// clips to the card's rounded top-right corner; the inner strip is a 45° band
// centered on that corner so the text stays fully on-ribbon.
export function ComingSoonBadge() {
  return (
    <div className="pointer-events-none absolute right-0 top-0 h-28 w-28 overflow-hidden rounded-tr-3xl">
      <div className="absolute right-[-44px] top-[24px] w-[170px] rotate-45 bg-orange-500 py-1 text-center text-[11px] font-bold uppercase tracking-wider text-stone-950 shadow-lg select-none">
        Coming Soon
      </div>
    </div>
  );
}
