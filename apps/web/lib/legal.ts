/*
  Legal document registry.

  The entity name, DIFC licence number, registered address, contact emails,
  liability cap and retention period below are SAMPLE values chosen so the pages
  read as finished — they are not the real incorporated entity's details, and
  nothing here has been reviewed by a UAE/DIFC-licensed lawyer.

  The documents assume the operating entity is established in the Dubai
  International Financial Centre (DIFC). That assumption drives the substance:
  the data-protection language is written against the DIFC Data Protection Law
  (DIFC Law No. 5 of 2020) and the DIFC Commissioner of Data Protection, and
  governing law / jurisdiction is the DIFC and the DIFC Courts — not the onshore
  federal PDPL.

  Before relying on any of this, a UAE/DIFC-licensed lawyer must:
    - replace every SAMPLE value below (entity name, licence no., address,
      emails, AED 500 liability cap, 90-day retention) with the real
      incorporated entity's details;
    - confirm the DIFC data-protection and jurisdiction positions actually apply
      to the entity as incorporated;
    - confirm the DFSA / non-financial-activity statements in the Financial
      Disclaimer remain accurate for the real business model.

  Structure mirrors Revolut's /legal hub (Terms, Privacy, Cookies, Complaints,
  Website Terms, Accessibility). If any real value is still unknown at edit time,
  write it as a [BRACKETED CAPITALS] placeholder — those render highlighted, so
  an unfilled one is impossible to miss.
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

/* Sample entity used across these documents — see file header.
   Exported because /contact and /about surface the same details; one definition
   means the contact page can never drift from the Terms. */
export const ENTITY = "Fils Technologies Ltd";
export const LICENCE_NO = "CL-4021";
export const REGISTERED_OFFICE = [
  "Unit 12, Level 3, Gate Avenue South",
  "Dubai International Financial Centre",
  "PO Box 507123, Dubai, United Arab Emirates",
];
export const CONTACT_EMAIL = "hello@fils.ae";
export const PRIVACY_EMAIL = "privacy@fils.ae";
export const COMPLAINTS_EMAIL = "complaints@fils.ae";

/* ------------------------------------------------------------------ */

const terms: LegalDoc = {
  slug: "terms",
  title: "Terms of Use",
  summary: "The rules for using the Fils website and tools.",
  intro: [
    "These terms govern your use of the Fils website and the optimization tools on it. By using Fils you agree to them. If you do not agree, please do not use the service.",
  ],
  sections: [
    {
      heading: "1. Who we are",
      body: [
        `Fils is operated by ${ENTITY}, a company established in the Dubai International Financial Centre (DIFC), Dubai, under DIFC Commercial Licence No. ${LICENCE_NO}, with its registered office at ${REGISTERED_OFFICE.join(", ")}.`,
        `You can reach us at ${CONTACT_EMAIL}.`,
      ],
    },
    {
      heading: "2. What Fils is, and what it is not",
      body: [
        "Fils is an information and modelling tool. It estimates what combination of UAE credit cards would earn you the most, based on spending figures you enter yourself.",
        "Fils is not a bank, a finance company, a payment service provider, a credit broker, or an insurance or securities intermediary. It is not licensed by the Central Bank of the UAE, the Securities and Commodities Authority, the DFSA or the FSRA. We do not issue cards, arrange credit, or submit applications on your behalf.",
        "Nothing on Fils is financial, investment, tax or legal advice. See our Financial Disclaimer for the full position.",
      ],
    },
    {
      heading: "3. Eligibility",
      body: [
        "You must be at least 18 years old to use Fils. The service is designed for UAE residents and models UAE-issued credit cards only; results will not be meaningful for cards issued elsewhere.",
      ],
    },
    {
      heading: "4. Your account",
      body: [
        `Some features require an account. You are responsible for keeping your login credentials secure and for activity that happens under your account. Tell us promptly at ${CONTACT_EMAIL} if you believe your account has been accessed without your permission.`,
        "You may close your account at any time. See the Privacy Policy for what happens to your data when you do.",
      ],
    },
    {
      heading: "5. Acceptable use",
      body: ["You agree not to:"],
      list: [
        "use Fils for any unlawful purpose, or in breach of Federal Decree-Law No. 34 of 2021 on Countering Rumours and Cybercrimes",
        "scrape, harvest or systematically extract the card dataset or modelling output",
        "attempt to interfere with, probe or reverse-engineer the service or its infrastructure",
        "resell, redistribute or present our output as your own product",
        "submit information about another person without their knowledge",
      ],
    },
    {
      heading: "6. Our content and intellectual property",
      body: [
        `The Fils name, interface, written content, and the models and code behind the optimizers belong to ${ENTITY} or its licensors. You may use the service for your own personal, non-commercial purposes.`,
        "Credit card names, bank names, logos and scheme marks belong to their respective owners. Their appearance on Fils is descriptive and does not imply any endorsement, partnership or affiliation.",
      ],
    },
    {
      heading: "7. Card data and accuracy",
      body: [
        "Card terms in the UAE change frequently and are published by issuers in inconsistent formats. We take reasonable care to keep our dataset current, but we do not warrant that any rate, fee, cap or eligibility rule shown on Fils is accurate, complete or up to date at the moment you read it.",
        "Where a published rate is genuinely ambiguous, we flag it rather than presenting a single confident figure. Always verify the terms with the issuing bank before applying for or relying on a card.",
      ],
    },
    {
      heading: "8. Availability and changes",
      body: [
        "We may change, suspend or withdraw any part of Fils, including individual features, at any time. We may also update these terms; the version published on this page is the one that applies.",
        "We aim to give reasonable notice of material changes, but we may make changes immediately where needed for security, legal or regulatory reasons.",
      ],
    },
    {
      heading: "9. Limitation of liability",
      body: [
        "To the fullest extent permitted by applicable law, we are not liable for any loss arising from a financial decision you make on the basis of Fils output, including any card you apply for, any card you close, any fee you incur, or any reward you do not receive.",
        "Nothing in these terms limits liability that cannot be limited under applicable law, including liability for fraud or for death or personal injury caused by negligence. Subject to that, our total liability to you for all claims arising out of or in connection with the service is limited to AED 500.",
      ],
    },
    {
      heading: "10. Governing law and jurisdiction",
      body: [
        "These terms are governed by the laws of the Dubai International Financial Centre (DIFC), and the DIFC Courts have exclusive jurisdiction over any dispute arising out of or in connection with them.",
        `Because ${ENTITY} is established in the DIFC, the DIFC's own data protection regime (the DIFC Data Protection Law, DIFC Law No. 5 of 2020) and the DIFC Courts apply to us, rather than the onshore federal position.`,
      ],
    },
  ],
};

/* ------------------------------------------------------------------ */

const privacy: LegalDoc = {
  slug: "privacy",
  title: "Privacy Policy",
  summary: "What personal data we collect, why, and the rights you have over it.",
  intro: [
    "This policy explains how Fils handles your personal data. It is written against the DIFC Data Protection Law (DIFC Law No. 5 of 2020) and the regulations made under it, which apply to us as a company established in the Dubai International Financial Centre.",
  ],
  sections: [
    {
      heading: "1. Controller",
      body: [
        `${ENTITY} is the controller of the personal data described here. Contact us at ${CONTACT_EMAIL}, or our data protection contact at ${PRIVACY_EMAIL}.`,
      ],
    },
    {
      heading: "2. What we collect",
      list: [
        "Spending inputs, the monthly figures you enter per category, and your stated monthly salary",
        "Preferences, the bank you select, and cards you save to your wallet",
        "Account data, email address and authentication identifiers, handled by our authentication provider",
        "Technical data, IP address, device and browser type, and pages viewed",
      ],
    },
    {
      heading: "3. What we never collect",
      body: [
        "Fils does not ask for and does not store credit card numbers, CVVs, expiry dates, PINs, online banking credentials, Emirates ID numbers, or your Al Etihad Credit Bureau report. We do not perform credit checks and we do not submit applications to banks.",
        "Your salary figure is used only to filter cards whose stated income requirement you would meet. It is never shared with a bank.",
      ],
    },
    {
      heading: "4. Why we process it, and on what basis",
      body: [
        "We process spending and preference data to produce your recommendations, this is necessary to provide the service you have asked for. We process account data to operate your login. We process technical data on the basis of our legitimate interest in keeping the service secure and working.",
        "Where we rely on your consent, for any marketing email, you can withdraw it at any time without affecting processing already carried out.",
      ],
    },
    {
      heading: "5. Who we share it with",
      body: [
        "We do not sell your personal data. We share it only with processors who help us run the service, under contract and only on our instructions:",
      ],
      list: [
        "Clerk (Clerk, Inc.) for account creation and login",
        "Vercel (Vercel Inc.) for application hosting",
        "Neon (Neon, Inc.) for managed Postgres hosting",
      ],
    },
    {
      heading: "6. Transfers outside the DIFC",
      body: [
        "Some of these providers store or process data outside the DIFC. Under Articles 26 and 27 of the DIFC Data Protection Law, personal data may be transferred out of the DIFC where the destination ensures an adequate level of protection, or where an appropriate safeguard, such as standard contractual clauses binding the recipient, is in place.",
        "Clerk, Vercel and Neon process data in the United States and the European Union. For transfers to jurisdictions the DIFC does not treat as adequate, we rely on standard contractual clauses with each provider.",
      ],
    },
    {
      heading: "7. How long we keep it",
      body: [
        "We keep your profile and saved wallet for as long as your account is open. If you close your account we delete or anonymise your personal data within 90 days, except where we must keep records longer to meet a legal obligation.",
        "If you use Fils without an account, your inputs stay in your browser and are not stored on our servers.",
      ],
    },
    {
      heading: "8. Your rights under the DIFC Data Protection Law",
      body: ["Subject to the conditions in the law, you have the right to:"],
      list: [
        "be informed about how your data is processed, and request access to it",
        "have inaccurate data corrected",
        "have your data erased",
        "restrict or object to certain processing",
        "receive your data in a structured, machine-readable format and have it ported",
        "withdraw consent where processing is based on it",
        "object to automated processing that produces a legal effect for you",
      ],
      // why: the last item matters more here than in a typical product — the
      // optimizer IS automated decision-making, even though it only advises.
    },
    {
      heading: "9. Automated processing",
      body: [
        "Fils recommendations are produced automatically by our optimization engine. They are advisory: no bank sees them, no application is made, and no decision about you is taken by anyone on the basis of the output. You are free to disregard any recommendation.",
      ],
    },
    {
      heading: "10. Security and breaches",
      body: [
        "We use technical and organisational measures appropriate to the sensitivity of the data, including encryption in transit and access controls on our database.",
        "If a breach occurs that poses a risk to your privacy or security, we will notify the DIFC Commissioner of Data Protection and, where the law requires it, you, without undue delay.",
      ],
    },
    {
      heading: "11. Children",
      body: [
        `Fils is not intended for anyone under 18 and we do not knowingly collect their data. If you believe a minor has provided us personal data, contact ${PRIVACY_EMAIL} and we will delete it.`,
      ],
    },
    {
      heading: "12. Complaints",
      body: [
        `If you are unhappy with how we have handled your data, please contact us first at ${PRIVACY_EMAIL} so we can try to put it right. You also have the right to complain to the DIFC Commissioner of Data Protection.`,
      ],
    },
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
        "Because Fils currently sets only strictly necessary and preference cookies, no consent banner is required. One will be added before any analytics or advertising cookie is introduced.",
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
      heading: "2. Not a licensed financial institution",
      body: [
        `${ENTITY} is not licensed or regulated by the Central Bank of the UAE, the Securities and Commodities Authority, the Dubai Financial Services Authority or the Financial Services Regulatory Authority. Although it is established in the DIFC, it does not carry on any financial activity for which a DFSA licence is required.`,
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
  summary: "How to complain, what happens next, and where to escalate.",
  intro: [
    "If something has gone wrong we would like the chance to fix it. This page explains how to tell us and what to expect.",
  ],
  sections: [
    {
      heading: "1. How to complain",
      body: [
        `Email ${COMPLAINTS_EMAIL} with a description of what happened, when, and what you would like us to do. If it concerns your account, include the email address you registered with.`,
      ],
    },
    {
      heading: "2. What happens next",
      list: [
        "We acknowledge your complaint within 5 business days",
        "We investigate and give you a substantive response within 30 calendar days",
        "If we need longer, we tell you why and give a revised date",
      ],
    },
    {
      heading: "3. If you are not satisfied",
      body: [
        "Tell us, and a different person will review the outcome.",
        "If you remain unsatisfied, you may take the matter to the consumer protection authorities, the Ministry of Economy, or the Department of Economy and Tourism in the relevant emirate.",
      ],
    },
    {
      heading: "4. Complaints about a bank or a card",
      body: [
        "Fils is not a licensed financial institution, so complaints about Fils do not fall to Sanadak, the UAE's independent ombudsman unit for the financial sector. Sanadak handles complaints against licensed banks, finance companies and insurers.",
        "If your complaint is about a card, a fee, or a decision made by an issuing bank, raise it with that bank first, and escalate to Sanadak if you are not satisfied with their response.",
      ],
    },
    {
      heading: "5. Complaints about your data",
      body: [
        `Data protection complaints can be sent to ${PRIVACY_EMAIL}, and escalated to the DIFC Commissioner of Data Protection. See the Privacy Policy.`,
      ],
    },
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
        `If you hit a barrier using Fils, email ${CONTACT_EMAIL} and describe what happened. We treat accessibility reports as bugs, not feature requests.`,
      ],
    },
  ],
};

/* ------------------------------------------------------------------ */

export const LEGAL_DOCS: LegalDoc[] = [
  terms,
  privacy,
  cookies,
  disclaimer,
  complaints,
  accessibility,
];

export function getLegalDoc(slug: string): LegalDoc | undefined {
  return LEGAL_DOCS.find((d) => d.slug === slug);
}
