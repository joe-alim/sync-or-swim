# Smoke Signals — ChatGPT Image Generation Brief

Copy-paste instructions for generating the 17 character card portraits (+ card back)
for **Smoke Signals** using ChatGPT's image generator. The goal is **one cohesive,
matched set**: a woodland *royal court gathered around a campfire*, painterly
storybook style, where regalia signals each card's rank.

See [REQUIREMENTS.md §6](./REQUIREMENTS.md) for how these slot into the game (raster
portrait + SVG/CSS chrome; `public/games/smoke-signals/cards/<slug>.webp`).

---

## How to use this doc

ChatGPT generates conversationally (no style-reference flags like Midjourney's
`--sref`), so consistency comes from **(a) a locked style brief you paste once, and
(b) telling it to match the previous images** on every subsequent card.

1. **Start a fresh chat.** Paste **§1 Master Style Brief** as your first message.
   Tell it: *"This is the locked art style for a 17-card set. Confirm you've got it,
   then wait — I'll send subjects one at a time."*
2. **Generate the anchor card first: the Princess (Doe).** It's the centerpiece and
   sets the palette/lighting everyone else matches. Re-roll until it's perfect — this
   is your reference.
3. **Generate the rest** (§3), one per message, each prefixed with the short
   consistency line in §2. After each, glance at it next to the anchor; if it drifts,
   say *"too [bright/cartoonish/desaturated] — match the Princess card's palette and
   lighting"* and re-roll.
4. **Export** each at the size in §4 and name it by slug (§4 / §5).

> ChatGPT makes one image per request. Don't ask for a grid/sheet of all 17 — you
> lose resolution and control. One card per message.

---

## 1. Master Style Brief (paste once, first message)

```
You are generating a cohesive set of 17 fantasy card-art portraits for a card game
called "Smoke Signals" — a woodland royal court gathered around a campfire. Every
image in this set MUST share the same style, palette, lighting, and framing so they
read as one deck. Here is the locked style — keep it identical for every card:

MEDIUM: Painterly digital storybook illustration. Soft, rich brushwork with visible
texture. Warm, cozy, slightly whimsical fantasy — not cartoonish, not photoreal.

SUBJECT: A single anthropomorphic forest animal portrayed as a member of a royal
court, dressed in period regalia appropriate to their rank. Head-and-shoulders,
3/4 view, facing slightly toward the viewer, centered in frame, expressive face.

THEME: Campfire + royalty at once. Each character looks lit by an off-frame campfire.

LIGHTING: Warm campfire firelight glowing from the lower foreground, casting a soft
orange rim light on the face and shoulders; gentle glowing embers/sparks drifting in
the air; deep shadows behind.

PALETTE: Rich amber and ember-orange highlights, golden firelight, with deep teal and
brown shadows. Twilight pine forest softly blurred (bokeh) in the background.

COMPOSITION: Portrait orientation, subject centered with headroom, shoulders visible,
simple uncluttered background so the figure pops.

DO NOT INCLUDE: No text, letters, numbers, words, logos, or watermarks. No card
frame, border, or UI. No multiple characters. No modern objects.

OUTPUT: Portrait orientation (tall), high detail on the face and costume.

Confirm you've locked this style. I'll send the 17 subjects one at a time, starting
with the Princess.
```

---

## 2. Consistency line (prefix EVERY per-card request with this)

```
Same locked style, palette, firelight, and framing as the previous card(s) in this
set — match them exactly. New subject:
```

…then paste the card's subject block from §3.

---

## 3. The 17 card subjects

Generate in this order (anchor first). Each block already names the animal, court
role, regalia (rank cue), and an expression/personality note drawn from the
character so the cards feel distinct.

> **Rank reads through regalia:** values 0–2 wear plain/servant/clergy garb, 3–5 wear
> nobles' court dress, 6–9 wear crowns and full royal regalia. The prompts bake this
> in — keep it if you tweak them.

**1. Princess — Doe (value 8) — ANCHOR, do this first**
```
A graceful doe (female deer) as a beloved young princess. She wears a delicate crown
of woodland flowers woven with glowing embers. Elegant, luminous, gentle and a little
self-conscious. The most radiant figure of the set — this is the centerpiece card.
```

**2. King — Moose (value 6)**
```
A majestic bull moose as a king. He wears full royal robes and a heavy golden crown
nestled at the base of his broad antlers. Regal, commanding, with a weary authority.
```

**3. Dowager Queen — Swan (value 7)**
```
A stately swan as a dowager queen mother. She wears a regal mourning gown and an
ornate queen's crown. Dignified, sorrowful, watchful.
```

**4. Countess — Fox (value 7)**
```
A sly red fox as an elegant countess. She wears a fine aristocratic gown and a
jeweled tiara. Playful, gossipy, with a cunning sidelong glance.
```

**5. Bishop — Heron (value 9)**
```
A tall, composed heron as a grand bishop. He wears elaborate church vestments and a
grand mitre, holding an ornate crosier (staff). Measured, calculating, secretly kind.
```

**6. Constable — Wolf (value 6)**
```
A grim grey wolf as the captain of the guard / constable. He wears ceremonial plate
armor and a sash of office. Solemn, dutiful, vigilant.
```

**7. Prince — Beaver (value 5)**
```
A cheerful beaver as a young prince. He wears a fine princely tunic and a light
golden circlet. Charming, lighthearted, a sociable matchmaker.
```

**8. Count — Tortoise (value 5)**
```
A wise old tortoise as a court count. He wears a courtier's robes and a heavy chain
of office. Shrewd, patient, careful about whom he supports.
```

**9. Baron — Ram (value 3)**
```
A dignified ram as a minor nobleman / baron. He wears an embroidered doublet. Quiet
and gentle in demeanor, but used to being obeyed.
```

**10. Baroness — Lynx (value 3)**
```
A sharp-eyed lynx as a noblewoman / baroness. She wears an understated gown with a
few fine jewels. Keen, clever, quietly scheming.
```

**11. Cardinal — Red Cardinal (value 2)**
```
A striking red cardinal as a high cardinal. He wears ornate religious vestments and a
mitre. Devout, stern, uncompromising.
```

**12. Priest — Owl (value 2)**
```
A wise owl as a humble confessor / priest. He wears plain monastic robes. Open,
honest, kindly and uplifting.
```

**13. Handmaid — Hedgehog (value 4)**
```
A small hedgehog as a loyal handmaid. She wears a simple servant's dress and holds a
delicate veil. Demure on the surface, secretly clever.
```

**14. Sycophant — Chipmunk (value 4)**
```
An eager chipmunk as a social-climbing courtier. He wears gaudy, over-decorated
finery a little too fancy for his station. Ingratiating, groveling, wide flattering
smile, cheeks slightly puffed.
```

**15. Guard — Badger (value 1)**
```
A sturdy badger as a palace guard. She wears a leather brigandine and holds a spear.
Dutiful, persistent, stern and watchful.
```

**16. Jester — Raccoon (value 0)**
```
A mischievous raccoon as a court jester. He wears a belled motley cap and a striped
collar. Knowing, sees more than people realize, with a sly grin.
```

**17. Assassin — Skunk (value 0)**
```
A shadowy skunk as a court assassin. He wears a dark hooded cloak and holds a small
goblet. Elusive, menacing, with a faint sly smirk half-hidden in shadow.
```

---

## 4. Output & export spec

- **Orientation/size:** ask for **tall portrait**. ChatGPT's portrait size is
  **1024 × 1536** (2:3) — request that. The card design is 5:7 (≈0.71) vs 2:3
  (≈0.67), so the SVG/CSS chrome will crop a sliver top/bottom; keep faces centered
  with headroom and nothing critical at the very top/bottom edge.
- **No text in the image** — the value number and name are added later as overlay
  chrome. If a generated image sneaks in text, re-roll (don't try to edit it out).
- **Background:** keep the painted forest/firelight background (do **not** ask for
  transparency — the bokeh is part of the look).
- **Download** the highest-resolution version offered for each card.

---

## 5. File naming & delivery checklist

Save each as PNG, then we'll convert to WebP during integration. Name by card slug:

| # | File | Card |
|--:|------|------|
| 1 | `princess.png` | Princess (Doe) |
| 2 | `king.png` | King (Moose) |
| 3 | `dowager-queen.png` | Dowager Queen (Swan) |
| 4 | `countess.png` | Countess (Fox) |
| 5 | `bishop.png` | Bishop (Heron) |
| 6 | `constable.png` | Constable (Wolf) |
| 7 | `prince.png` | Prince (Beaver) |
| 8 | `count.png` | Count (Tortoise) |
| 9 | `baron.png` | Baron (Ram) |
| 10 | `baroness.png` | Baroness (Lynx) |
| 11 | `cardinal.png` | Cardinal (Bluejay) |
| 12 | `priest.png` | Priest (Owl) |
| 13 | `handmaid.png` | Handmaid (Hedgehog) |
| 14 | `sycophant.png` | Sycophant (Chipmunk) |
| 15 | `guard.png` | Guard (Badger) |
| 16 | `jester.png` | Jester (Raccoon) |
| 17 | `assassin.png` | Assassin (Skunk) |

Drop them in `public/games/smoke-signals/cards/`. The 17 slugs match the `CardId`s in
the planned `cards.ts` manifest.

### Optional: card back
```
Same locked style, palette, and firelight. New subject: a card back design — a
woodland royal crest (crossed quill and feather over a small flame) centered on a
dark teal field with a subtle amber filigree border, glowing embers in the corners.
Symmetrical, ornamental, no text.
```
Save as `card-back.png`.

---

## 6. Tips & troubleshooting

- **Drift:** if a card looks brighter / flatter / more cartoonish than the anchor,
  say *"match the Princess card's palette, firelight, and brush texture more closely"*
  and re-roll.
- **Wrong framing:** if it's full-body or zoomed out, say *"tighter — head and
  shoulders, 3/4 view, centered, like the others."*
- **Text artifacts:** re-roll rather than edit; the model often repeats the mistake
  when asked to remove text.
- **Variety:** generate 2–3 takes per card and keep the best match to the set.
- **Rank check:** before finalizing, lay the 17 out in value order (0→9) and confirm
  the regalia visibly escalates from plain (Guard/Jester/Assassin) to crowned
  (King/Queen/Princess/Bishop).
