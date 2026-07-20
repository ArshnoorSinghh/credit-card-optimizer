---
name: frontend-design
description: Fils frontend design system. Invoke BEFORE building or editing any UI in apps/web — pages, components, layout, styling, or animation. Encodes the warm "Gulf Golden Hour" light theme: type scale, 8px spacing grid, color tokens, component patterns, and Framer Motion motion rules. Keeps every screen on one consistent, premium, place-grounded design system instead of generic AI-default Tailwind.
---

# Fils — Frontend Design Skill

The north star is **Gulf golden hour**: a warm, light canvas grounded in the
UAE — eggshell and sand neutrals, the low amber-to-terracotta light of the
desert sun, warm ink, restrained gold, and generous space. Big confident serif
headlines, rounded surfaces with soft warm depth, and motion that makes things
feel *alive* — but trustworthy, because this is money. It should feel like a
Gulf private bank or luxury hospitality, **not** tourist kitsch and **not** the
generic dark-purple-plus-glow "AI SaaS" look we deliberately left behind.

**Light only. There is no dark theme, by design** — the product lives in
daylight. Don't add one.

Tokens live in `apps/web/app/globals.css` (`@theme`). **Never hardcode a hex
value or a random px size** — always reach for a token or a scale step below.
(The one sanctioned exception is `lib/card-design.ts`, which holds the real
third-party brand colors of physical credit cards — isolated and labelled.)

---

## 1. Color tokens

Use the Tailwind utilities generated from the `@theme` vars. Do not invent hexes.

| Purpose | Token / utility |
| --- | --- |
| Page canvas | `bg-bg` (warm eggshell `#f7f1e6`) |
| Soft canvas (footers, wells) | `bg-bg-soft` (deeper sand) |
| Raised card | `bg-surface` (warm near-white) |
| Input / card-on-card | `bg-surface-2` (warm sand) |
| Hairline border | `border-line`, hover → `border-line-strong` |
| Primary text (warm ink) | `text-fg` |
| Secondary / body copy | `text-muted` |
| Tertiary / captions | `text-faint` |
| Brand gradient (fills) | `bg-brand` utility, or `.text-gradient` for headline text |
| Golden-hour stops | `sun` (amber) `flame` (orange) `clay` (terracotta) — e.g. `text-clay`, `bg-flame/10` |
| Restrained gold / oasis green | `text-gold` · `text-oasis` |
| Success / warning / danger | `text-success` `text-warning` `text-danger` (+ `/10` bg, `/30` border) |

**Rules**
- The sun gradient is an accent, not a background wash. One or two golden-hour
  moments per screen (a headline word, the primary CTA, a key stat) — not every
  element.
- **Accent as text vs. as fill.** Orange can't hit AA on a light ground while
  staying vivid, so: use **`clay`** for accent *text* (eyebrows, links, icons —
  it's dark enough to read), and **`flame`** for *fills, borders, rings, dots*.
  Never set small body text in `flame` or `sun`.
- Body copy is `text-muted`; only headings and key numbers are `text-fg`. Earn
  the darkest ink.
- Confidence/uncertainty flags map to semantic tones: low→`warning`, unknown→`danger`.

---

## 2. Typography

- **Display font** (`font-display`, **Fraunces** — a warm, high-contrast serif)
  for `h1–h4` and big numbers. It carries the heritage/private-bank personality;
  use it with restraint.
- **Body** (`font-sans`, **Hanken Grotesk**, a clean humanist sans) for
  everything else, including money figures. Already the default.
- Headings get gentle tracking (`-0.015em`, baked into base) and tight leading.
  Give big headlines `text-wrap: balance`.

Type scale (stick to these steps):

| Role | Classes |
| --- | --- |
| Hero | `text-5xl md:text-7xl font-semibold` |
| Section title | `text-3xl md:text-4xl font-semibold` |
| Card title | `text-xl font-semibold` |
| Body large | `text-lg text-muted` |
| Body | `text-base text-muted` |
| Caption / label | `text-sm` or `text-xs` `text-faint` uppercase tracking-wide |

Eyebrows above section titles: a `<Badge tone="brand">` or
`text-sm font-medium uppercase tracking-widest text-clay`.

Use `tabular-nums` wherever digits line up in columns (results, allocations).

---

## 3. Spacing — 8px grid

All spacing is a multiple of 4px, preferring 8px steps: `2 4 6 8 12 16 20 24`.

- Section vertical rhythm: `py-24 md:py-32`.
- Card padding: `p-6` (compact) or `p-8` (feature).
- Gap between cards in a grid: `gap-5` or `gap-6`.
- Max content width: `max-w-6xl mx-auto px-5`. Prose blocks: `max-w-2xl`.

---

## 4. Radius, elevation, glass

- Cards: `rounded-[var(--radius-lg)]` (24px). Pills/buttons: `rounded-full`.
- Depth comes from **warm, soft shadows** (sunlight, not neon) — use the tokens,
  never a cold black or purple glow:
  - `shadow-card` — the resting elevation on surfaces.
  - `shadow-lift` — hover-lift for interactive cards.
  - `shadow-glow` / `shadow-glow-lg` — the warm amber cast under the primary CTA.
- Frosted panels: the `.glass` class (warm blur + hairline). Navbar and overlays,
  sparingly.
- Gradient hairline emphasis: `.ring-gradient` (via `<Card glow>`).

---

## 5. Components (use these, don't re-roll)

Located in `apps/web/components`:

- `ui/button.tsx` — `<Button variant="brand|solid|outline|ghost" size>`. Brand is
  the single primary CTA per view (sunset fill, warm glow).
- `ui/card.tsx` — `<Card hover glow>`. `hover` adds the lift interaction.
- `ui/badge.tsx` — `<Badge tone>` pills for eyebrows, tags, flags.
- `ui/reveal.tsx` — `<Reveal>`, `<Stagger>` + `<StaggerItem>` scroll animations.
- `burj-sunrise.tsx` — **the signature hero backdrop** (see §6). Landing + auth only.
- `cursor-glow.tsx`, `aurora.tsx` — ambient warm-light background effects.
- `credit-card-art.tsx` — real per-card brand art (dark/colored cards; keeps its
  own white-on-card treatment — that's correct, don't "fix" it to the light theme).
- `navbar.tsx`, `footer.tsx`, `logo.tsx` — chrome.

Patterns:
- **Button states** are built in (hover scale, tap, focus ring, disabled). Don't
  restyle per-use; pass `variant`/`size`.
- **Card structure**: optional eyebrow/icon → title → body → action. One idea per card.
- **Forms**: `bg-surface-2 border border-line rounded-[var(--radius-md)]`,
  focus → `border-line-strong` + `ring-flame/40`. Label above, `text-sm text-muted`.
- **Neutral hovers** on the light ground use `hover:bg-black/[0.04]` — NOT
  `hover:bg-white/5` (invisible on light).

---

## 6. Motion (Framer Motion) — the premium signal

Animation is what separates "AI site" from "agency site."

- **Entrances**: wrap sections in `<Reveal>`; grids in `<Stagger>`/`<StaggerItem>`.
  Fade + 20–24px lift, `once: true`, easing `[0.16,1,0.3,1]`, ~0.6–0.7s.
- **Hover**: interactive cards lift (`y:-6`); buttons scale `1.02`. Springy, not linear.
- **The signature moment — `<BurjSunrise>`**: the low golden-hour sun cresting
  from behind the Dubai skyline / Burj Khalifa. Warm sky wash → a blooming sun
  disc → soft god-rays → a backlit warm silhouette → a few drifting heat motes.
  It plays IN once on load (~2.4s) then settles to a calm, barely-breathing
  state. This is the **one** cinematic surface — it belongs on the **landing hero
  and auth pages only**, NEVER on the optimizer / results / points / card-browser
  working screens, where it would fight the money math.
- **Cursor**: the ambient warm `CursorGlow` trails the pointer (desktop only).
- **Discipline**: motion supports hierarchy — animate the thing you want noticed.
  No spinning logos, no parallax overload, nothing loud looping forever in the
  periphery. The product screens stay calm, warm-neutral, and data-first.
- **Always** honor `prefers-reduced-motion`: globals kills durations; JS effects
  check `useReducedMotion()` and render the final resting frame (BurjSunrise
  drops all motion and shows a static golden-hour still).

---

## 7. Avoid the generic-AI aesthetic

Do NOT ship (these are the anti-patterns we explicitly moved away from):
- **The old Fils look**: near-black/cool canvas, a violet→indigo→cyan gradient
  wash, and ambient purple glow. That is now the thing to avoid.
- Flat one-color buttons on a pure `#ffffff`/`#000000` background.
- Emoji as icons in product chrome (use `lucide-react`).
- Even, identical cards with no hierarchy — vary size/emphasis.
- Center-everything layouts for data — use real grids, tables, alignment.
- Default Tailwind blue (`blue-500`) or unmodified `slate-*` grays; and don't
  reach for the generic Inter/Space-Grotesk pairing — we use Fraunces + Hanken.
- Tourist-kitsch "Dubai" clichés (literal camels, dunes, lamps, gold-everything).
  The UAE reference is *light, material, architectural* — sun, sand, limestone,
  the skyline — handled with restraint.
- Walls of `text-fg` — most text is `text-muted`; earn the darkest ink.

The test: could this be any SaaS template? If yes, push the golden-hour accent,
the motion, the spacing, and the serif/sans type contrast until it looks like
Fils at sunrise.
