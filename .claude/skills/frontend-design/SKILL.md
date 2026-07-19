---
name: frontend-design
description: >
  Fils frontend design system. Invoke BEFORE building or editing any UI in
  apps/web — pages, components, layout, styling, or animation. Encodes the
  Revolut-inspired dark theme: type scale, 8px spacing grid, color tokens,
  component patterns, and Framer Motion motion rules. Keeps every screen on one
  consistent, premium design system instead of generic AI-default Tailwind.
---

# Fils — Frontend Design Skill

The north star is **Revolut**: a dark canvas, vibrant violet→indigo→cyan
gradients, glass surfaces, big confident typography, generous space, rounded
cards with depth, and motion that makes things feel *alive* — but trustworthy,
because this is money.

Tokens live in `apps/web/app/globals.css` (`@theme`). **Never hardcode a hex
value or a random px size** — always reach for a token or a scale step below.

---

## 1. Color tokens

Use the Tailwind utilities generated from the `@theme` vars. Do not invent hexes.

| Purpose | Token / utility |
| --- | --- |
| Page canvas | `bg-bg` (near-black `#07070c`) |
| Soft canvas (footers, wells) | `bg-bg-soft` |
| Raised card | `bg-surface` |
| Input / card-on-card | `bg-surface-2` |
| Hairline border | `border-line`, hover → `border-line-strong` |
| Primary text | `text-fg` |
| Secondary text | `text-muted` |
| Tertiary / captions | `text-faint` |
| Brand gradient (fills) | `bg-brand` utility, or `.text-gradient` for text |
| Gradient stops | `violet` `indigo` `sky` (e.g. `text-violet`, `bg-sky/30`) |
| Success / warning / danger | `text-success` `text-warning` `text-danger` (+ `/10` bg, `/30` border) |

**Rules**
- Gradient is an accent, not a background wash. One or two gradient moments per
  screen (a headline word, the primary CTA, a key stat) — not every element.
- Body copy is `text-muted`; only headings and key numbers are `text-fg`.
- Confidence/uncertainty flags map to semantic tones: low→`warning`, unknown→`danger`.

---

## 2. Typography

- **Display font** (`font-display`, Space Grotesk) for `h1–h4` and big numbers.
- **Body** (`font-sans`, Inter) for everything else. Already the default.
- Headings get tight tracking (`-0.02em`, baked into base) and `leading-[1.05]`.

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
`text-sm font-medium uppercase tracking-widest text-violet`.

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
- Depth comes from **soft, tinted shadows**, never hard black:
  `shadow-[0_20px_60px_-20px_rgba(124,108,255,0.45)]` on hover-lift cards.
- Frosted panels: the `.glass` class (blur + hairline). Use for the navbar and
  overlays, sparingly.
- Gradient hairline emphasis: `.ring-gradient` (via `<Card glow>`).

---

## 5. Components (use these, don't re-roll)

Located in `apps/web/components`:

- `ui/button.tsx` — `<Button variant="brand|solid|outline|ghost" size>`. Brand is
  the single primary CTA per view.
- `ui/card.tsx` — `<Card hover glow>`. `hover` adds the lift+glow interaction.
- `ui/badge.tsx` — `<Badge tone>` pills for eyebrows, tags, flags.
- `ui/reveal.tsx` — `<Reveal>`, `<Stagger>` + `<StaggerItem>` scroll animations.
- `cursor-glow.tsx`, `aurora.tsx` — ambient background effects.
- `navbar.tsx`, `footer.tsx`, `logo.tsx` — chrome.

Patterns:
- **Button states** are built in (hover scale, tap, focus ring, disabled). Don't
  restyle per-use; pass `variant`/`size`.
- **Card structure**: optional eyebrow/icon → title → body → action. Keep one
  idea per card.
- **Forms**: `bg-surface-2 border border-line rounded-[var(--radius-md)]`,
  focus → `border-line-strong` + `ring-violet/40`. Label above, `text-sm text-muted`.

---

## 6. Motion (Framer Motion) — the premium signal

Per the setup guide, animation is what separates "AI site" from "agency site."

- **Entrances**: wrap sections in `<Reveal>`; grids in `<Stagger>`/`<StaggerItem>`.
  Fade + 20–24px lift, `once: true`, easing `[0.16,1,0.3,1]`, ~0.6–0.7s.
- **Hover**: interactive cards lift (`y:-6`); buttons scale `1.02`. Springy, not linear.
- **Cursor**: the ambient `CursorGlow` trails the pointer (desktop only).
- **Discipline**: motion supports hierarchy — animate the thing you want noticed.
  No spinning, no parallax overload, nothing that loops forever in the periphery.
- **Always** honor `prefers-reduced-motion` (globals kills durations; JS effects
  check the media query).

---

## 7. Avoid the generic-AI aesthetic

Do NOT ship:
- Flat one-color buttons on a pure `#ffffff`/`#000000` background.
- Emoji as icons in product chrome (use `lucide-react`).
- Even, identical cards with no hierarchy — vary size/emphasis.
- Center-everything layouts for data — use real grids, tables, alignment.
- Default Tailwind blue (`blue-500`) or unmodified `slate-*` grays.
- Walls of `text-fg` — most text is `text-muted`; earn the bright white.

The test: could this be any SaaS template? If yes, push the gradient, the motion,
the spacing, and the type contrast until it looks like Fils.
