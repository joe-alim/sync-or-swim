# Smoke Signals card art

Drop the 17 generated character portraits (+ optional card back) here. Generate
them with [lib/games/smoke-signals/ART-PROMPTS.md](../../../../lib/games/smoke-signals/ART-PROMPTS.md).

## Expected files (one per card id)

`assassin` · `jester` · `guard` · `priest` · `cardinal` · `baron` · `baroness` ·
`handmaid` · `sycophant` · `prince` · `count` · `king` · `constable` · `countess` ·
`dowager-queen` · `princess` · `bishop`  — plus `card-back`.

## Pipeline

1. Generate as PNG (portrait, ~1024×1536). Save each as `<id>.png` here.
2. Convert to WebP — the manifest points at `<id>.webp`:
   `cwebp -q 82 princess.png -o princess.webp` (or any batch converter).
3. In [lib/games/smoke-signals/cards.ts](../../../../lib/games/smoke-signals/cards.ts),
   flip that card's `artReady` to `true`. Until then `<SmokeSignalsCard>` shows a
   placeholder, so you can ship/flip cards one at a time.

Slugs here must match the `CardId`s in `cards.ts`.
