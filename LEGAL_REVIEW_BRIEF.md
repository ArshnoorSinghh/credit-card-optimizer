# Fils — Legal & Disclosure Brief

**Status: fabricated data removed. What remains is descriptive, not contractual.**

Fils is a prototype. It is **not incorporated**, holds no trade licence, has no
registered office and no monitored inbox. It is deployed at
`https://credit-card-optimizer-web.vercel.app/`.

An earlier revision of this repo carried a complete set of *sample* corporate and
legal details so the pages would read as finished. They have been removed. This
document records what was removed, what was kept, and why — so the same material
does not get reintroduced.

---

## 1. What was removed, and why

### Corporate identity (`apps/web/lib/legal.ts`)

| Removed | Was |
| --- | --- |
| `ENTITY` | `"Fils Technologies Ltd"` |
| `LICENCE_NO` | `"CL-4021"` — an invented number in DIFC commercial-register format |
| `REGISTERED_OFFICE` | Unit 12, Level 3, Gate Avenue South, DIFC, PO Box 507123 |
| `CONTACT_EMAIL` / `PRIVACY_EMAIL` / `COMPLAINTS_EMAIL` | `hello@` / `privacy@` / `complaints@fils.ae` |

`fils.ae` is not a domain Fils uses. The licence number asserted a DFSA-adjacent
regulator relationship that does not exist. The address is a real, physically
locatable Dubai building. All three rendered to a reader as statements of fact
about a regulated company.

### Documents emptied, not deleted

Every section keeps its `heading` and drops its `body`/`list`. **A heading on its
own states nothing, so it binds nobody** — while still showing the shape a
finished document has to take and making the gaps countable. `LegalSection`
already types `body` and `list` as optional, so a heading-only section is valid;
`/legal/[slug]` marks each one *"Not yet drafted."*

- **Terms of Use** — all 10 sections empty. It was a contract from first line to
  last ("By using Fils you agree to them"), between a user and an entity that
  does not exist, carrying an invented **AED 500 liability cap** and **exclusive
  DIFC Courts jurisdiction**.
- **Complaints Policy** — 4 of 5 sections empty; the invented SLAs (acknowledge
  in 5 business days, resolve in 30) are gone. §4 stays filled because it is true
  today and binds no one: it routes card and bank complaints to the issuer and
  Sanadak, which is to say away from us.
- **Privacy** — 7 of 12 sections empty (lawful basis, retention, transfers,
  rights, security, children, data complaints).

A heading can itself carry a claim, so two were neutralised: *"Your rights under
the DIFC Data Protection Law"* → *"Your rights"*, and *"Transfers outside the
DIFC"* → *"International transfers"*. Naming a statute asserts that it applies.

### Fabricated social proof (`apps/web/app/page.tsx`)

Three testimonials attributed to named people in named emirates — "Layla H.,
Dubai Marina" citing **~AED 3,100/year**, plus "Omar R." and "Priya S." Nobody
said them. The `"Illustrative examples."` caption did not cure it: they rendered
as quoted individuals with initial-avatars and locations, and the AED 3,100
matched the hardcoded demo figure in `components/sticky-steps.tsx:365`, making it
externally checkable. Under **Federal Law No. 15 of 2020** (Consumer Protection)
a fabricated testimonial is exposure no disclaimer reaches.

Replaced with a statement of method — no persons, no outcomes.

The `"8,400+ UAE residents"` hero claim flagged in the previous version of this
brief was already gone; verified absent.

### Entity block on `/about`

A `<dl>` under the heading "Who you're dealing with" listing operating entity,
"DIFC Commercial Licence" + number, and registered office. The most
credible-looking fake artefact on the site.

The three rows stay with em-dash values (plus screen-reader text, since a bare
dash announces as nothing), under truthful copy: prototype, not incorporated,
not regulated, not a broker. Same rule as the legal pages — an absent field shows
the gap where a removed one hides it.

### `/contact`

Four `mailto:` channel cards, a postal address at the registered office, and
response-time commitments ("usually answered within 2 business days"). No mail
provider is wired up, so every link was dead.

The four cards stay, describing what each channel is *for* — that costs nothing
and commits to nothing. What went is the part that made a promise: the address
and the turnaround time. Each card now reads *"No address yet."* When an inbox
exists, the address slot is the only thing to fill.

---

## 2. What was kept, and why

The rule applied: **keep text that describes how the software behaves; remove
text that binds someone or asserts a legal fact.**

| Page | Status |
| --- | --- |
| `/legal/disclaimer` | **Kept in full** — the most valuable page on the site, and the only document with no empty sections. §2 rewritten to state the true position (prototype, unincorporated, unlicensed) instead of naming an entity. |
| `/legal/privacy` | **Rewritten** as "How Fils handles your data" — a factual description, explicitly not a policy. Kept: what is collected, what is never collected (card numbers, CVVs, Emirates ID, bureau data), the real processors (Clerk, Vercel, Neon), automated-processing note. Removed: controller identity, DIFC Data Protection Law framing, Art. 26–27 transfer analysis, the rights list, the 90-day retention promise, breach notification to the DIFC Commissioner. New final section states plainly that the page confers no enforceable rights. |
| `/legal/cookies` | **Kept** — already factual. Only the compliance *conclusion* ("no consent banner is required") was removed; the fact that only strictly-necessary and preference cookies are set remains. |
| `/legal/accessibility` | **Kept** — engineering facts. Contact address dropped. |

`components/legal-shell.tsx` renders a **non-dismissible prototype notice** on
every disclosure page. This replaces the draft banner that a previous revision
had removed. It is a safety feature, not decoration — do not make it dismissible
for visual polish.

All six documents remain in `LEGAL_DOCS`, reordered so the two entirely-empty
ones sit last. The footer column is retitled "Disclosures" and still links Terms
and Complaints — a missing link hides the gap, an empty page shows it.
`sitemap.ts` derives from `LEGAL_DOCS` and self-corrects.

## 3. Still true, still useful

- Complaints about Fils do **not** go to Sanadak — that unit covers *licensed*
  banks, finance companies and insurers. Card and bank complaints go to the
  issuer first, then Sanadak. Preserved in Disclaimer §8.
- The card/bank/portfolio counts in `lib/marketing-stats.ts` are **real** —
  derived from the dataset and asserted by `marketing-stats.test.ts`.
- `SITE_URL` was never hardcoded to `fils.ae`; it falls back to `VERCEL_URL`, so
  the deployed site resolves to its own vercel.app host. No change needed.

## 4. Open questions — unchanged, and now the gating ones

1. **Incorporate where?** Onshore / DIFC / ADGM. This single answer determines
   which data protection statute a real privacy policy must be written against —
   a rewrite, not an edit. Everything in §2 stays provisional until it is
   answered.
2. **Does Fils need a licence?** As a pure information tool taking no card
   details, running no credit check and submitting no applications, likely
   outside CBUAE licensing. If Fils ever takes a **referral fee** from an issuer,
   that may become *arranging deals in credit* — a regulated activity. Note the
   tension with the product's own positioning, which publicly repudiates referral
   revenue: that is simultaneously a trust choice, a regulatory-risk reducer, and
   a closed door on the default monetisation route. Same decision; take it once,
   with counsel and with whoever owns the business model.
3. **Contact route.** There is currently none. Publishing a personal address is a
   judgement call that has not been made.

## 5. Before this is offered to the public

1. Incorporate, then fill in the real entity details.
2. Commission a real privacy policy against the applicable statute.
3. Take the licensing question in §4.2 to a UAE-licensed lawyer.
4. Fill in the Terms of Use — drafted by a lawyer against the real entity, not
   reconstructed from this repo. The empty headings are a skeleton to brief
   counsel with, not a draft to edit.
5. Implement a cookie consent banner **before** enabling any analytics.
6. Have counsel review, then remove the prototype notice from `legal-shell.tsx`.

Nothing in `/legal` has been reviewed by a lawyer. It is now honest about that
rather than styled to look otherwise.
