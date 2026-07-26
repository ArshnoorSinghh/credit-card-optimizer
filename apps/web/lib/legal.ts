/*
  Disclosure registry.

  READ THIS BEFORE ADDING ANYTHING HERE.

  Fils is a prototype. There is no incorporated company behind it, no trade
  licence, no registered office, and no monitored support inbox. Everything in
  this file is therefore written to be DESCRIPTIVE, not CONTRACTUAL: it states
  what the software does and does not do, and stops there.

  What that rules out until a real entity exists:
    - an operating entity name, licence number, or registered address
    - contact addresses that do not resolve to an inbox somebody reads
    - anything phrased as a binding undertaking — a liability cap, a retention
      period, a response-time SLA, a governing law or choice of court
    - a rights framework under a named statute (DIFC Data Protection Law,
      federal PDPL), which presupposes an established controller subject to it

  why these documents are full of empty sections: an earlier revision carried
  SAMPLE values for all of the above — an invented DIFC commercial licence
  number, a real Gate Avenue address, @fils.ae inboxes, an AED 500 liability
  cap, a 90-day retention promise, DIFC Courts jurisdiction. Sample or not, they
  render to a reader as statements of fact about a regulated company.

  Rather than delete those sections, each keeps its `heading` and drops its
  `body`/`list`. A heading on its own states nothing, so it binds nobody — while
  still showing the shape a finished document has to take and making the gaps
  countable. `LegalSection` types `body` and `list` as optional precisely so a
  heading-only section is valid; the renderer marks them "Not yet drafted."

  A heading can itself carry a claim, so headings were neutralised where they
  did: "Your rights under the DIFC Data Protection Law" became "Your rights",
  and "Transfers outside the DIFC" became "International transfers". Naming a
  statute asserts that it applies.

  Do not fill any of these in "for completeness". An obviously empty section is
  safer than a convincing fabrication.

  If a real value is ever known but not yet filled in, write it as a
  [BRACKETED CAPITALS] placeholder — Prose in components/legal-shell.tsx renders
  those highlighted, so an unfilled one is impossible to miss.
*/

export type LegalSection = {
  heading: string;
  body?: string[];
  list?: string[];
};

export type LegalDoc = {
  slug: string;
  title: string;
  /** One line for the hub index and page subtitle. */
  summary: string;
  intro: string[];
  sections: LegalSection[];
};

/* No entity constants live here any more — see the file header. There is no
   entity name, licence number or registered office to export, and inventing one
   is the specific failure this file now guards against.

   The one address that does exist. It is a personal Gmail, not a corporate
   domain, and the name says so on purpose: it is a temporary inbox for
   prototype feedback, not a support desk, and nothing about it implies a
   company. The rule in the header still holds — an address may only be
   published if somebody actually reads it.

   why it lives here rather than in the page: /suggestions, the footer and
   /contact all surface it, and one definition means they cannot drift. Changing
   it in this one place changes it everywhere. */
export const SUGGESTIONS_EMAIL = "TempFilsSuggestions@gmail.com";

/* ------------------------------------------------------------------ */

const terms: LegalDoc = {
  slug: "terms",
  title: "Terms of Use",
  summary: "Not written yet — the structure a finished document will need.",
  intro: [
    "There are no terms of use yet. Terms are an agreement between you and a company, and there is no company here to be a party to one.",
    "The headings below are the structure a finished document will need. Nothing is written under them, so nothing here binds you or us. They stay visible so the gaps are countable rather than invisible.",
  ],
  // why every section is empty: this document was previously filled in against a
  // sample entity, with an invented licence number, an AED 500 liability cap and
  // DIFC Courts jurisdiction. Each needs a real incorporated counterparty and a
  // lawyer. Until both exist, the honest content of a contract is nothing.
  sections: [
    { heading: "1. Who we are" },
    { heading: "2. What Fils is, and what it is not" },
    { heading: "3. Eligibility" },
    { heading: "4. Your account" },
    { heading: "5. Acceptable use" },
    { heading: "6. Our content and intellectual property" },
    { heading: "7. Card data and accuracy" },
    { heading: "8. Availability and changes" },
    { heading: "9. Limitation of liability" },
    { heading: "10. Governing law and jurisdiction" },
  ],
};

/* ------------------------------------------------------------------ */

const privacy: LegalDoc = {
  slug: "privacy",
  title: "How Fils handles your data",
  summary: "What the app stores, what it never touches, and who processes it.",
  intro: [
    "This is a factual description of what the software does with the information you give it. It is deliberately not a privacy policy: a policy is an undertaking given by a company, and there is no company here yet.",
    "Sections that would state a commitment are left empty rather than filled with something nobody can currently stand behind.",
  ],
  sections: [
    {
      heading: "1. What we collect",
      list: [
        "Spending inputs, the monthly figures you enter per category, and your stated monthly salary",
        "Preferences, the bank you select, and cards you save to your wallet",
        "Account data, email address and authentication identifiers, handled by our authentication provider",
        "Technical data, IP address, device and browser type, and pages viewed",
      ],
    },
    {
      heading: "2. What we never collect",
      body: [
        "Fils does not ask for and does not store credit card numbers, CVVs, expiry dates, PINs, online banking credentials, Emirates ID numbers, or your Al Etihad Credit Bureau report. It performs no credit checks and submits no applications to banks.",
        "Your salary figure is used only to filter cards whose stated income requirement you would meet. It is never shared with a bank.",
      ],
    },
    {
      heading: "3. Who else processes it",
      body: [
        "Fils runs on third-party infrastructure, so data you enter passes through these providers. They process it in the United States and the European Union:",
      ],
      list: [
        "Clerk (Clerk, Inc.) for account creation and login",
        "Vercel (Vercel Inc.) for application hosting",
        "Neon (Neon, Inc.) for managed Postgres hosting",
      ],
    },
    {
      heading: "4. Used without an account",
      body: [
        "If you use Fils without signing in, the figures you enter stay in your browser and are not written to the database.",
      ],
    },
    {
      // why these five are empty: each states a commitment (a lawful basis, a
      // retention period, a transfer safeguard, an enforceable right, a breach
      // notification route) that presupposes an identified controller subject to
      // a named statute. There is neither. The previous revision answered all
      // five against the DIFC regime on the strength of an assumption.
      heading: "5. Why we process it, and on what basis",
    },
    { heading: "6. How long we keep it" },
    { heading: "7. International transfers" },
    { heading: "8. Your rights" },
    { heading: "9. Security and breaches" },
    {
      heading: "10. Automated processing",
      body: [
        "Recommendations are produced automatically by the optimization engine. They are advisory: no bank sees them, no application is made, and no decision about you is taken by anyone on the basis of the output. You are free to disregard any recommendation.",
      ],
    },
    { heading: "11. Children" },
    { heading: "12. Complaints about your data" },
  ],
};

/* ------------------------------------------------------------------ */

const cookies: LegalDoc = {
  slug: "cookies",
  title: "Cookie Policy",
  summary: "The cookies Fils sets, what each one does, and how to refuse them.",
  intro: [
    "Cookies are small files stored on your device. This policy explains which ones Fils uses and how to control them.",
  ],
  sections: [
    {
      heading: "1. Strictly necessary",
      body: [
        "These keep you logged in, keep your session secure, and remember your progress through onboarding. The service does not work without them, so they are set without asking for consent.",
      ],
    },
    {
      heading: "2. Preferences",
      body: [
        "These remember choices you have made, the bank you selected, the spending figures you entered, so you do not have to re-enter them.",
      ],
    },
    {
      heading: "3. Advertising",
      body: [
        "Fils does not set advertising or cross-site tracking cookies, and does not sell data to advertisers.",
      ],
    },
    {
      heading: "4. Managing cookies",
      body: [
        "You can delete or block cookies in your browser settings. If you block strictly necessary cookies, you will not be able to sign in.",
        // why: states the fact (only two categories are set) without the legal
        // conclusion that used to follow it — whether a banner is required is a
        // question for counsel, not for this file.
        "Fils currently sets only strictly necessary and preference cookies. A consent banner will be added before any analytics or advertising cookie is introduced.",
      ],
    },
  ],
};

/* ------------------------------------------------------------------ */

const disclaimer: LegalDoc = {
  slug: "disclaimer",
  title: "Financial Disclaimer",
  summary: "What our numbers mean, how they are produced, and their limits.",
  intro: [
    "Fils produces estimates. This page explains exactly what they are and are not, because the distinction matters before you act on one.",
  ],
  sections: [
    {
      heading: "1. Not financial advice",
      body: [
        "Fils does not provide financial, investment, credit, tax or legal advice, and does not make personal recommendations within the meaning of any UAE financial services regulation. Output is generic information produced by a model from figures you supplied.",
        "Your circumstances, your other debts, your plans, your risk tolerance, are not known to us and are not modelled. Consider taking independent advice before making a decision.",
      ],
    },
    {
      heading: "2. Not a licensed institution, and not a company yet",
      body: [
        "Fils is a prototype. It is not an incorporated company, holds no trade licence, and is not licensed or regulated by the Central Bank of the UAE, the Securities and Commodities Authority, the Dubai Financial Services Authority or the Financial Services Regulatory Authority.",
        "It does not issue cards, arrange credit, broker applications, or carry on any other activity for which a licence would be required.",
      ],
    },
    {
      heading: "3. How the numbers are produced",
      body: [
        "Our engine takes the spending figures you enter, applies each card's published reward rates and caps, subtracts annual fees, and searches combinations of up to three cards for the highest net annual value.",
        "Every figure is therefore a modelled projection for a hypothetical year in which you spend exactly what you told us. It is not a forecast, a promise, or a quotation.",
      ],
    },
    {
      heading: "4. Where we are uncertain, we say so",
      body: [
        "UAE card terms are published inconsistently, and some reward rates cannot be parsed unambiguously from what the issuer has released. Where that happens we flag the rate and show a range rather than inventing a precise number.",
        "A flagged rate means the true value could fall anywhere in the stated range, and the ranking of cards may change within it.",
      ],
    },
    {
      heading: "5. Verify with the issuer",
      body: [
        "Rates, fees, caps, welcome offers and eligibility rules change without notice. Before applying for any card, confirm its current terms directly with the issuing bank. Where Fils and the issuer disagree, the issuer is correct.",
      ],
    },
    {
      heading: "6. Eligibility is the bank's decision",
      body: [
        "Whether you are approved for a card, and what limit you receive, is decided by the issuing bank against its own criteria, your Al Etihad Credit Bureau record, and Central Bank requirements such as the debt burden ratio cap. Fils filters on stated minimum income only and cannot predict an approval.",
      ],
    },
    {
      heading: "7. Our commercial relationships",
      body: [
        "Fils is not paid by any bank or card issuer to feature, rank or recommend a card, and rankings are produced solely by the model. If that ever changes, any commission would be disclosed prominently, a paid ranking presented as a neutral one is a consumer protection issue under Federal Law No. 15 of 2020.",
      ],
    },
  ],
};

/* ------------------------------------------------------------------ */

const complaints: LegalDoc = {
  slug: "complaints",
  title: "Complaints Policy",
  summary: "Not written yet, except for where a card complaint actually goes.",
  intro: [
    "There is no complaints process yet. A complaints policy commits someone to acknowledge, investigate and respond within a stated time, and there is nobody here to hold to that.",
    "The headings below stay so the gaps are countable. Section 4 is filled in because it is the one part that is true today and binds no one: it tells you where a complaint about a bank or a card actually goes, which is somewhere other than us.",
  ],
  sections: [
    // why 1-3 and 5 are empty: each was a response-time commitment or an
    // escalation route belonging to an entity that does not exist. The previous
    // revision promised acknowledgement in 5 business days and resolution in 30.
    { heading: "1. How to complain" },
    { heading: "2. What happens next" },
    { heading: "3. If you are not satisfied" },
    {
      heading: "4. Complaints about a bank or a card",
      body: [
        "Fils is not a licensed financial institution, so complaints about Fils do not fall to Sanadak, the UAE's independent ombudsman unit for the financial sector. Sanadak handles complaints against licensed banks, finance companies and insurers.",
        "If your complaint is about a card, a fee, or a decision made by an issuing bank, raise it with that bank first, and escalate to Sanadak if their response does not satisfy you.",
      ],
    },
    { heading: "5. Complaints about your data" },
  ],
};

/* ------------------------------------------------------------------ */

const accessibility: LegalDoc = {
  slug: "accessibility",
  title: "Accessibility Statement",
  summary: "Our accessibility target, what is done, and what is not yet.",
  intro: [
    "We want Fils to be usable by everyone, including people using assistive technology. This statement is honest about where we are.",
  ],
  sections: [
    {
      heading: "1. Target",
      body: [
        "We aim to meet the Web Content Accessibility Guidelines (WCAG) 2.2 at level AA.",
      ],
    },
    {
      heading: "2. What is in place",
      list: [
        "All motion respects the operating system's reduced-motion setting, including the animated hero, which renders a static frame instead",
        "Interactive controls have visible keyboard focus indicators",
        "Body and heading colours are chosen to meet AA contrast on our light canvas",
        "Decorative graphics are hidden from screen readers",
      ],
    },
    {
      heading: "3. Known gaps",
      body: [
        "We have not yet carried out a formal WCAG 2.2 audit, so we do not claim full conformance. Known limitations include data tables and charts that have not been fully tested with a screen reader, and some interactive components that still need an ARIA review.",
      ],
    },
    {
      heading: "4. Tell us",
      body: [
        "If you hit a barrier using Fils, tell us what happened and what you were trying to do. Accessibility reports are treated as bugs, not feature requests.",
      ],
    },
  ],
};

/* ------------------------------------------------------------------ */

/* why disclaimer leads: it is the only document here that carries real weight
   for a reader about to act on a number, and the only one that survives the
   no-entity constraint fully intact. The rest follow in the order a reader
   would want them, with the two entirely-empty documents last. */
export const LEGAL_DOCS: LegalDoc[] = [
  disclaimer,
  privacy,
  cookies,
  accessibility,
  terms,
  complaints,
];

export function getLegalDoc(slug: string): LegalDoc | undefined {
  return LEGAL_DOCS.find((d) => d.slug === slug);
}
