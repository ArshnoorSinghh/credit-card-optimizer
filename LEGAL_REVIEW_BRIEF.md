# Fils — Legal Review Brief

**Status: UNREVIEWED DRAFTS. Nothing in `/legal` is fit to publish.**

This document accompanies the legal pages added under `apps/web/app/legal`. It
records what was built, what was deliberately left out, which UAE instruments the
drafting was based on, and — most importantly — the questions that a qualified
UAE-licensed lawyer needs to answer before any of it goes live.

The drafts were written by Claude (an LLM), not by a lawyer. They are a starting
point intended to save billable hours, not a substitute for advice. Treat every
statement in them as a proposal to be checked.

---

## 1. What was built

Structure mirrors Revolut's `/legal` hub, adapted for a UAE company that is
**not** a licensed financial institution.

| Route | Document | Revolut analogue |
| --- | --- | --- |
| `/legal` | Terms & policies index | Terms & Policies |
| `/legal/terms` | Terms of Use | Website Terms |
| `/legal/privacy` | Privacy Policy | Privacy Policy |
| `/legal/cookies` | Cookie Policy | Cookie Policy |
| `/legal/disclaimer` | Financial Disclaimer | *(none — see §2)* |
| `/legal/complaints` | Complaints Policy | Complaints Policy |
| `/legal/accessibility` | Accessibility Statement | Accessibility |

Implementation notes:

- Content lives in `apps/web/lib/legal.ts` as structured data; `/legal/[slug]`
  renders it and `generateStaticParams` prerenders all six. The hub, the routes
  and the footer therefore cannot drift out of sync.
- `apps/web/components/legal-shell.tsx` renders a **non-dismissible draft banner**
  on every legal page, and highlights unfilled `[PLACEHOLDERS]` in warning colour.
  Both are deliberate safety features. Do not remove them for visual polish before
  sign-off.
- Footer "Legal" column now links to real routes (it previously pointed every
  legal link at `/`).

## 2. What was deliberately omitted

- **Modern Slavery Statement.** Revolut publishes one because of s.54 of the UK
  Modern Slavery Act 2015, which applies above £36m turnover. There is no UAE
  equivalent obligation. Copying it would be cargo-culting.
- **Regulatory disclosures / licence numbers.** Revolut's legal pages are dense
  with FCA/EBA/state-licence references. Fils has none to make, and inventing the
  format would be worse than omitting it.
- A **Financial Disclaimer** was *added* rather than omitted — Revolut does not
  need one because it is licensed and its terms carry that weight. For an
  unlicensed modelling tool that outputs money figures, this is the single most
  important document on the site.

## 3. UAE instruments the drafting was based on

- **Federal Decree-Law No. 45 of 2021** (Personal Data Protection Law) — data
  subject rights, lawful basis, breach notification, and the Art. 22–23
  cross-border transfer rules.
- **Federal Law No. 15 of 2020** on Consumer Protection — relevant to how
  rankings and any future commission are presented.
- **Federal Decree-Law No. 34 of 2021** on Countering Rumours and Cybercrimes —
  referenced in the acceptable-use clause.
- **Sanadak** (the UAE financial sector ombudsman unit) — referenced in the
  Complaints Policy specifically to say it does **not** cover Fils.

### A point worth preserving

Complaints about Fils do **not** go to Sanadak. Sanadak handles complaints against
*licensed* banks, finance companies and insurers. A policy that pointed users
there would misdirect them. The Complaints Policy therefore routes Fils
complaints to the Ministry of Economy / the relevant Department of Economy and
Tourism, and sends card-related complaints to the issuing bank first.

---

## 4. THE OPEN QUESTION — does Fils need a licence?

This outranks every document above and could not be resolved from public sources.

- As a pure information and modelling tool that takes **no card details**,
  performs **no credit check**, and submits **no applications**, Fils is likely
  outside Central Bank of the UAE licensing.
- If Fils ever earns a **referral or introduction fee** from an issuer, the
  analysis may change. Introducing customers to credit providers can amount to
  *arranging deals in credit* — a regulated activity requiring DFSA authorisation
  in DIFC or FSRA authorisation in ADGM, with separate questions onshore.
- Note the tension with the product's own marketing: the landing page
  (`apps/web/app/page.tsx:243`) publicly repudiates referral revenue. That is
  simultaneously a positioning choice, a regulatory-risk reducer, and a closed
  door on the default monetisation route for card comparison. **These are the same
  decision and should be taken together, with counsel and with whoever owns the
  business model.**

**Recommendation: one scoped consultation on the licensing question before any
money is spent polishing the copy.**

## 5. Jurisdiction assumption — must be confirmed

Every draft assumes an **onshore UAE entity** governed by federal law, with
disputes going to onshore courts.

If the entity is incorporated in **DIFC** or **ADGM** instead:

- the free-zone courts apply, not the onshore courts; and
- that zone's **own data protection statute** applies — DIFC Data Protection Law
  No. 5 of 2020, or the ADGM Data Protection Regulations 2021 — **not** the
  federal PDPL.

The second point means the Privacy Policy would need rewriting against a
different statute, not merely editing. A `[NOTE FOR COUNSEL]` marks this in the
Terms of Use.

---

## 6. Placeholders to fill

**23 distinct placeholders, 32 occurrences.** They render highlighted on the live
pages. Company-supplied facts:

| Placeholder | Needed for |
| --- | --- |
| `[LEGAL ENTITY NAME]` ×4 | Terms, Privacy, Disclaimer |
| `[TRADE LICENCE NO.]` | Terms §1 |
| `[REGISTERED ADDRESS]` | Terms §1 |
| `[EMIRATE / FREE ZONE]`, `[EMIRATE]`, `[COURT]` | Terms §1, §10 |
| `[CONTACT EMAIL]` ×4 | Terms, Accessibility |
| `[DPO / PRIVACY EMAIL]` ×4 | Privacy, Complaints |
| `[COMPLAINTS EMAIL]` | Complaints §1 |
| `[AUTHENTICATION PROVIDER]`, `[HOSTING PROVIDER]`, `[ANALYTICS PROVIDER, IF ANY]` | Privacy §5 |
| `[RETENTION PERIOD]` | Privacy §7 |
| `[5]`, `[30]` | Complaints §2 — acknowledgement / resolution SLAs |

Decisions requiring counsel:

- `[LIABILITY CAP — TO BE SET WITH COUNSEL]` — Terms §9
- `[TO BE COMPLETED WITH COUNSEL]` — Privacy §6, cross-border transfer mechanism
  per processor, plus the hosting regions actually in use
- `[FOR COUNSEL]` — Disclaimer §2, whether the "not licensed" statement holds for
  the intended business model
- `[NOTE FOR COUNSEL]` — Terms §10, onshore vs free zone (see §5 above)

Engineering follow-ups:

- `[COOKIE CONSENT BANNER: not yet implemented]` — **required before any
  non-essential cookie is set.** Currently a gap, not just a placeholder.
- `[CONFIRM WHETHER ANALYTICS ARE IN USE — REMOVE THIS SECTION IF NOT]` — Cookie
  Policy §3. Do not describe analytics we do not run.
- `[TO BE COMPLETED AFTER AN AUDIT]` — Accessibility §3. An untested WCAG
  conformance claim is itself a compliance risk, so the gaps section is
  deliberately empty rather than optimistic.

---

## 7. Separately: fabricated claims on the landing page

Not a `/legal` issue, but it sits in the same risk bucket and should reach the
same reviewer. The landing page presents as fact:

- "**8,400+** UAE residents have found their best cards" (`app/page.tsx:223`)
- Three named testimonials — Layla H., Omar R., Priya S. (`app/page.tsx:228–246`)
- "adds **~AED 3,100** a year for me" (`app/page.tsx:231`) — the same figure is
  hardcoded as a demo placeholder in `components/sticky-steps.tsx:365`

If these are invented, they are a consumer-protection exposure under Federal Law
No. 15 of 2020 independent of anything in `/legal`, and the third is externally
checkable by anyone comparing the testimonial to the demo animation. No
disclaimer page cures a fabricated testimonial.

---

## 8. Suggested next steps

1. Confirm the incorporation jurisdiction (onshore / DIFC / ADGM). This gates the
   Privacy Policy's governing statute.
2. Take the §4 licensing question to a UAE-licensed lawyer.
3. Resolve §7 — remove or substantiate the invented figures.
4. Fill the company-supplied placeholders in `apps/web/lib/legal.ts`.
5. Implement the cookie consent banner before enabling any analytics.
6. Have counsel review, then remove `DraftBanner` from
   `apps/web/components/legal-shell.tsx` and set real effective dates in place of
   `LEGAL_DRAFTED`.
